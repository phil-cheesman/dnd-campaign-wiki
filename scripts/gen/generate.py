#!/usr/bin/env python3
"""Minimal Phase-2 image-gen harness — generate one portrait and save a PNG.

This is the smoke-test rig: it proves the API path and lets us eyeball style/quality
on a few entities BEFORE building the full brief→assemble→commit pipeline and scaling
to ~250 entities. It does NOT write frontmatter yet (we look first).

Backends: `openai` (gpt-image-2) is wired. `fal` (Flux) is a stub for the cost/
consistency comparison right after.

Usage
-----
  # assemble from a smoke entity + a candidate style:
  python generate.py --slug quinton --style A
  python generate.py --slug mally-grisham --style B --quality high

  # the A-vs-B smoke set across all smoke entities (both styles each):
  python generate.py --smoke-set

  # raw prompt passthrough (bypasses assembly), e.g. paste a ChatGPT-validated prompt:
  python generate.py --prompt @my_prompt.txt --slug quinton --type portrait --label custom

Output: art-smoke/<slug>-<style>.png  (gitignored — experiments, not published art).
Final published art will live at site/public/art/<collection>/<slug>.png once approved.

Env: set OPENAI_API_KEY (platform.openai.com → API keys). gpt-image-2 needs a
*verified* organization (Settings → Organization → Verify). See README.md.
"""
import argparse
import base64
import datetime
import glob
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import fm
import optimize
from style import STYLES, FRAMING, SIZE, STYLE_VERSION, NO_TEXT, LOCKED
from smoke_entities import SMOKE

REPO = Path(__file__).resolve().parent.parent.parent
SMOKE_OUT = REPO / "art-smoke"
CANON = REPO / "canon"
SITE_ART = REPO / "site" / "public" / "art"
MASTERS = REPO / "art-originals"
BRIEFS = Path(__file__).resolve().parent / "briefs"


def load_env():
    """Load REPO/.env (gitignored) without a dependency, and alias key-name variants.

    Phil's .env uses OPEN_AI_API_KEY; the OpenAI SDK wants OPENAI_API_KEY — map it.
    """
    env = REPO / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    if "OPENAI_API_KEY" not in os.environ and "OPEN_AI_API_KEY" in os.environ:
        os.environ["OPENAI_API_KEY"] = os.environ["OPEN_AI_API_KEY"]

# Per-image cost estimate (USD), for the pre-flight confirmation only. Measured:
# a 6-image medium batch (1024x1536) billed ~8¢ → ~1.3¢/image. low/high extrapolated.
COST_HINT = {"low": 0.006, "medium": 0.014, "high": 0.05, "auto": 0.014}


def assemble(visual: str, name: str, role: str, art_type: str, style_key: str) -> str:
    """STYLE BLOCK + per-type framing + subject identity + visual attributes."""
    framing = FRAMING[art_type]
    style = STYLES[style_key]
    return (
        f"{style}\n\n{framing}\n\n"
        f"Subject: {name} — {role}.\n"
        f"Appearance: {visual}\n\n"
        f"{NO_TEXT}"
    )


def prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode()).hexdigest()[:12]


def slug_seed(slug: str) -> int:
    """Deterministic per-entity seed (stable regen). gpt-image-2 ignores it; fal uses it."""
    return int(hashlib.sha256(slug.encode()).hexdigest()[:8], 16)


def gen_openai(prompt: str, size: str, quality: str, retries: int = 4) -> bytes:
    try:
        from openai import OpenAI
    except ImportError:
        sys.exit("openai SDK not installed. Run: pip install -r scripts/gen/requirements.txt")
    client = OpenAI()  # reads OPENAI_API_KEY
    last = None
    for attempt in range(retries):
        try:
            resp = client.images.generate(
                model="gpt-image-2", prompt=prompt, size=size, quality=quality, n=1
            )
            return base64.b64decode(resp.data[0].b64_json)
        except Exception as e:  # retry rate-limits / transient 5xx with backoff
            last = e
            msg = str(e).lower()
            transient = any(s in msg for s in ("rate", "429", "timeout", "500", "502", "503", "overloaded", "connection"))
            if attempt == retries - 1 or not transient:
                raise
            time.sleep(2 ** attempt + 1)  # 2s, 3s, 5s, 9s
    raise last


def gen_fal(prompt: str, size: str, seed: int) -> bytes:
    raise NotImplementedError(
        "fal/Flux backend not wired yet — that's the cost/consistency comparison "
        "right after the gpt-image-2 smoke test."
    )


def generate_one(slug, style_key, quality, backend, prompt_override=None,
                 art_type=None, label=None, tag=""):
    if prompt_override is not None:
        ent = SMOKE.get(slug, {})
        art_type = art_type or ent.get("type", "portrait")
        prompt = prompt_override
        label = label or "custom"
    else:
        ent = SMOKE[slug]
        art_type = ent["type"]
        prompt = assemble(ent["visual"], ent["name"], ent["role"], art_type, style_key)
        label = style_key

    size = SIZE[art_type]
    ph = prompt_hash(prompt)
    seed = slug_seed(slug)
    suffix = f"-{tag}" if tag else ""
    out = SMOKE_OUT / f"{slug}-{label}{suffix}.png"
    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n▶ {slug} [style {label}] type={art_type} size={size} q={quality}")
    print(f"  model=gpt-image-2 style_version={STYLE_VERSION} prompt_hash={ph} seed={seed}")

    if backend == "openai":
        png = gen_openai(prompt, size, quality)
    else:
        png = gen_fal(prompt, size, seed)

    out.write_bytes(png)
    print(f"  ✓ wrote {out.relative_to(REPO)} ({len(png)//1024} KB)")
    return out


def load_briefs():
    out = []
    for f in sorted(glob.glob(str(BRIEFS / "*.json"))):
        out += json.load(open(f))
    return out


def from_briefs(quality, backend, only_types=None, only_slugs=None, force=False, dry=False, limit=None):
    """Batch-generate from scripts/gen/briefs/*.json, publish PNGs, write frontmatter.

    Idempotent: skips entities already status==generated (unless --force). Writes the
    full art{} block to each dossier (image + provenance for generated; status:skipped
    for eligibility==skip).
    """
    briefs = load_briefs()
    if only_types:
        briefs = [b for b in briefs if b["type"] in only_types]
    if only_slugs:
        want = set(only_slugs)
        briefs = [b for b in briefs if b["slug"] in want]
    today = datetime.date.today().isoformat()
    todo, done, skipped, missing = [], 0, 0, []

    # Plan first (for the cost preflight).
    for b in briefs:
        path = CANON / b["collection"] / f"{b['slug']}.md"
        if not path.exists():
            missing.append(str(path.relative_to(REPO)))
            continue
        existing = fm.parse_art_scalars(fm.split(path)[1])
        if b["eligibility"] == "skip":
            skipped += 1
            continue
        if existing.get("status") == "generated" and not force:
            done += 1
            continue
        todo.append((b, path, existing))

    n = len(todo)
    est = n * COST_HINT.get(quality, 0.014)
    print(f"from-briefs: {len(briefs)} briefs | already-done {done} | "
          f"skip(eligibility) {skipped} | TO GENERATE {n} | est ~${est:.2f}")
    if missing:
        print(f"  ⚠ {len(missing)} briefs have no matching dossier: {missing[:5]}"
              + (" …" if len(missing) > 5 else ""))
    if dry or n == 0:
        return
    if not force and quality and not os.environ.get("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY not set. See scripts/gen/README.md.")

    count = 0
    for b, path, existing in todo:
        if limit and count >= limit:
            print(f"  (stopping at --limit {limit})")
            break
        art_type = b["type"]
        prompt = assemble(b["visual"], b["name"], b.get("role", ""), art_type, LOCKED)
        size = SIZE[art_type]
        ph = prompt_hash(prompt)
        seed = slug_seed(b["slug"])
        master = MASTERS / b["collection"] / f"{b['slug']}.png"   # full-res, gitignored
        webp = SITE_ART / b["collection"] / f"{b['slug']}.webp"    # optimized, committed
        master.parent.mkdir(parents=True, exist_ok=True)
        print(f"▶ {b['collection']}/{b['slug']} [{art_type}] {size} hash={ph}", flush=True)
        try:
            png = gen_openai(prompt, size, quality) if backend == "openai" else gen_fal(prompt, size, seed)
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            fields = {**b, "has_visual_source": bool(b.get("ref_images")) or existing.get("has_visual_source") == "true",
                      "status": "failed"}
            fm.write_art_block(path, fields)
            continue
        master.write_bytes(png)
        ki, ko = optimize.to_webp(master, webp)
        fields = {
            **b,
            "has_visual_source": bool(b.get("ref_images")) or existing.get("has_visual_source") == "true",
            "model": "gpt-image-2", "style_version": STYLE_VERSION,
            "prompt_hash": ph, "seed": seed, "status": "generated",
            "generated_at": today, "image": f"/art/{b['collection']}/{b['slug']}.webp",
        }
        fm.write_art_block(path, fields)
        count += 1
        print(f"  ✓ {webp.relative_to(REPO)} ({ko} KB, from {ki} KB master)")
    print(f"\nGenerated {count} image(s).")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slug", action="append", default=[],
                    help="smoke entity slug; repeatable (e.g. --slug cruucar --slug ford)")
    ap.add_argument("--styles", default=None,
                    help="comma list of style candidates, e.g. A,B,C (default: A)")
    ap.add_argument("--smoke-set", action="store_true",
                    help="every smoke entity in every style")
    ap.add_argument("--tag", default="", help="filename suffix, e.g. v2 → quinton-A-v2.png")
    ap.add_argument("--quality", default="medium", choices=["low", "medium", "high", "auto"])
    ap.add_argument("--backend", default="openai", choices=["openai", "fal"])
    ap.add_argument("--prompt", help="raw prompt string, or @file to read from a file")
    ap.add_argument("--type", help="art type for raw-prompt mode", choices=list(SIZE))
    ap.add_argument("--label", help="output filename label for raw-prompt mode")
    ap.add_argument("--yes", action="store_true", help="skip the cost confirmation prompt")
    # batch mode (publish to site/public/art + write frontmatter):
    ap.add_argument("--from-briefs", action="store_true",
                    help="batch-generate from scripts/gen/briefs/*.json, publish + write frontmatter")
    ap.add_argument("--only-types", help="restrict batch to these art types, comma list "
                    "(portrait,landscape,crest,object)")
    ap.add_argument("--only-slugs", help="restrict batch to these slugs, comma list "
                    "(used by parallel workers to take disjoint chunks)")
    ap.add_argument("--force", action="store_true", help="regenerate even if status==generated")
    ap.add_argument("--dry-run", action="store_true", help="plan + cost only, no API calls")
    ap.add_argument("--limit", type=int, help="stop after N generations (sampling)")
    args = ap.parse_args()
    load_env()

    if args.from_briefs:
        only = args.only_types.split(",") if args.only_types else None
        if not args.dry_run and not args.yes:
            briefs = load_briefs()
            print(f"About to batch-generate from {len(briefs)} briefs at quality={args.quality}.")
            if input("proceed? [y/N] ").strip().lower() not in ("y", "yes"):
                sys.exit("aborted.")
        slugs = args.only_slugs.split(",") if args.only_slugs else None
        from_briefs(args.quality, args.backend, only_types=only, only_slugs=slugs,
                    force=args.force, dry=args.dry_run, limit=args.limit)
        return

    style_keys = args.styles.split(",") if args.styles else [LOCKED]
    for s in style_keys:
        if s not in STYLES:
            ap.error(f"unknown style {s!r}; choices: {','.join(STYLES)}")

    # Build the job list.
    jobs = []  # (slug, style_key)
    if args.smoke_set:
        jobs = [(slug, sk) for slug in SMOKE for sk in style_keys]
    elif args.slug:
        jobs = [(slug, sk) for slug in args.slug for sk in style_keys]
    else:
        ap.error("pass --slug (repeatable), or --smoke-set")

    # Pre-flight cost confirmation.
    n = len(jobs)
    est = n * COST_HINT.get(args.quality, 0.07)
    print(f"Backend={args.backend} quality={args.quality} → {n} image(s), est ~${est:.2f} (rough)")
    if args.backend == "openai" and not os.environ.get("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY not set. See scripts/gen/README.md.")
    if not args.yes:
        if input("proceed? [y/N] ").strip().lower() not in ("y", "yes"):
            sys.exit("aborted.")

    prompt_override = None
    if args.prompt:
        prompt_override = (
            Path(args.prompt[1:]).read_text() if args.prompt.startswith("@") else args.prompt
        )

    for slug, style_key in jobs:
        generate_one(slug, style_key, args.quality, args.backend,
                     prompt_override=prompt_override, art_type=args.type,
                     label=args.label, tag=args.tag)


if __name__ == "__main__":
    main()
