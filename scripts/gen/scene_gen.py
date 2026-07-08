#!/usr/bin/env python3
"""Reference-anchored EPISODE SCENE generation.

Unlike the entity portrait pipeline (which deliberately did NOT upload reference
pixels, to avoid cloning a pose), episode scenes WANT maximum similarity to the
art we already made: the same Cruucar, the same Arbor Alma, the same Kraken.

So for each episode brief we:
  1. resolve every key_entity -> dossier descriptor + full-res reference master
     (scripts/gen/entity_index.py),
  2. attach those masters to a gpt-image-2 images.edit call with input_fidelity=high
     (the "stay faithful to the references" knob),
  3. wrap it in the LOCKED Style B engraving block + the scene framing, with the
     canonical CAST notes authoritative over any conflicting scene-text detail.

Smoke output: art-smoke/<slug>-ref.png (gitignored). No frontmatter, no publish —
this is the redo smoke to validate the new direction before any bulk run.

Usage:
  python scene_gen.py --slug e002 --slug e000 --quality medium --yes
  python scene_gen.py --slug e158 --max-refs 4 --quality high --yes
"""
import argparse
import base64
import datetime
import json
import sys
import time
from pathlib import Path

from openai import OpenAI

import fm
import optimize
from entity_index import Index
from generate import load_env, prompt_hash, slug_seed, REPO, SMOKE_OUT
from style import STYLES, FRAMING, SIZE, STYLE_VERSION, NO_TEXT, LOCKED

HERE = Path(__file__).resolve().parent
COST = {"low": 0.011, "medium": 0.02, "high": 0.07, "auto": 0.02}  # edit calls run a bit higher


def paths_for(collection):
    """Per-collection I/O: briefs json, canon dossiers, committed WebP, gitignored masters."""
    return {
        "briefs": HERE / f"{collection}.json",
        "canon": REPO / "canon" / collection,
        "site_art": REPO / "site" / "public" / "art" / collection,
        "masters": REPO / "art-originals" / collection,
    }

ANTI_OIL = ("This is an antique pen-and-ink engraving with fine cross-hatching and a sepia-and-gold "
            "wash on aged parchment — NOT an oil painting, NOT a soft painterly render, NOT photoreal.")

# Per-entity accessory suppression. Reference portraits bake in signature props that look silly
# carried into every scene (e.g. Pierre always nursing a wine glass, even mid-battle). The general
# CAST clause drops incidental props, but for prominent portrait props we name them explicitly so
# the edit reliably omits them. Keyed by dossier slug; signature WEAPONS/armor/staves are NOT listed.
OMIT_ACCESSORIES = {
    "pierre-beaubois": "the wine glass / goblet / cup / any drink he holds in his portrait",
}


def build_prompt(brief, featured):
    art_type = "scene" if brief.get("art_type") not in FRAMING else brief["art_type"]
    framing = FRAMING[art_type]
    refs = [f for f in featured if f["master"]]
    noref = [f for f in featured if not f["master"]]

    lines = [STYLES[LOCKED], "", framing, "",
             f"Depict this scene: {brief['scene_title']}.", brief["visual"]]
    if refs:
        lines += ["",
                  "CAST & KEY ELEMENTS — these specific, ESTABLISHED characters/places/things appear "
                  "in this scene. Reference images are attached IN THIS ORDER. Render each to match its "
                  "reference exactly — same face, build, skin/scale color, hair, and costume — naturally "
                  "re-posed and staged into the action above. KEEP each character's signature weapon, "
                  "armor, staff, or familiar (e.g. a barbarian's axe, a mage's staff). But do NOT carry "
                  "over INCIDENTAL held props or accessories from a reference portrait when they do not "
                  "fit this scene — especially a wine glass, goblet, cup, bottle, drink, food, pipe, or a "
                  "musical instrument someone is not actively playing. Hands should hold only what the "
                  "action calls for (a weapon in a fight, nothing if empty-handed). Do NOT substitute "
                  "generic look-alikes. Where the scene text conflicts with a reference or a note below, "
                  "the reference and note win:"]
        for i, f in enumerate(refs, 1):
            note = f["visual"]
            omit = OMIT_ACCESSORIES.get(f.get("slug"))
            if omit:
                note += f" — IMPORTANT: do NOT include {omit} in this scene unless the action explicitly involves it."
            lines.append(f"{i}. {f['display']} — {note}".rstrip(" —"))
    if noref:
        lines += ["",
                  "Also appearing (no reference image — render faithfully from these canonical notes):"]
        for f in noref:
            lines.append(f"- {f['display']} — {f['visual']}".rstrip(" —"))
    lines += ["", f"{NO_TEXT} {ANTI_OIL}"]
    return "\n".join(lines), art_type, [f["master"] for f in refs]


def resolve_featured(idx, brief, max_refs):
    feat, seen = [], set()
    for name in brief.get("key_entities", []):
        r = idx.resolve(name)
        if not r or not r.get("visual"):
            if r is None:
                print(f"    · unresolved entity: {name!r}")
            continue
        key = r.get("slug") or r["visual"][:24]
        if key in seen:
            continue
        seen.add(key)
        feat.append(r)
    # cap reference IMAGES (keep all as text); prefer the first key_entities (≈importance)
    out, used = [], 0
    for f in feat:
        if f["master"] and used >= max_refs:
            f = {**f, "master": None}   # demote extra refs to text-only
        elif f["master"]:
            used += 1
        out.append(f)
    return out


def _retry(fn, retries=5):
    last = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            last = e
            msg = str(e).lower()
            transient = any(s in msg for s in ("rate", "429", "timeout", "500", "502", "503", "overloaded", "connection"))
            if attempt == retries - 1 or not transient:
                raise
            time.sleep(2 ** attempt + 2)  # 3s, 4s, 6s, 10s, 18s
    raise last


def gen_edit(client, prompt, image_paths, size, quality):
    def call():
        files = [open(p, "rb") for p in image_paths]
        try:
            resp = client.images.edit(
                model="gpt-image-2", image=files, prompt=prompt,
                size=size, quality=quality, n=1,
            )
        finally:
            for f in files:
                f.close()
        return base64.b64decode(resp.data[0].b64_json)
    return _retry(call)


def gen_plain(client, prompt, size, quality):
    def call():
        resp = client.images.generate(
            model="gpt-image-2", prompt=prompt, size=size, quality=quality, n=1)
        return base64.b64decode(resp.data[0].b64_json)
    return _retry(call)


def select(briefs, args):
    """Pick the brief list from --slug / --first / --range (briefs are pre-ordered)."""
    if args.slug:
        out = [b for s in args.slug for b in briefs if b["slug"] == s]
        miss = [s for s in args.slug if not any(b["slug"] == s for b in briefs)]
        if miss:
            print(f"  ⚠ no brief for: {miss}")
        return out
    if args.range:  # episode-number range — only meaningful for collections with `episode`
        lo, hi = (int(x) for x in args.range.split("-"))
        return [b for b in briefs if lo <= b.get("episode", -1) <= hi]
    if args.first:
        return briefs[: args.first]
    return list(briefs)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--collection", default="episodes", choices=["episodes", "arcs"],
                    help="which canon tier to generate scene plates for (reads scripts/gen/<collection>.json)")
    ap.add_argument("--slug", action="append", default=[], help="slug; repeatable")
    ap.add_argument("--first", type=int, help="first N entries (file order)")
    ap.add_argument("--range", help="episode number range, e.g. 0-49 (episodes only)")
    ap.add_argument("--quality", default="medium", choices=["low", "medium", "high", "auto"])
    ap.add_argument("--max-refs", type=int, default=4, help="max reference images to attach per scene")
    ap.add_argument("--publish", action="store_true",
                    help="write master + WebP + frontmatter art{} (default: smoke to art-smoke/)")
    ap.add_argument("--force", action="store_true", help="regenerate even if art.status==generated")
    ap.add_argument("--tag", default="ref", help="smoke filename suffix (non-publish)")
    ap.add_argument("--dry-run", action="store_true", help="plan only, no API calls")
    ap.add_argument("--yes", action="store_true")
    args = ap.parse_args()
    load_env()

    P = paths_for(args.collection)
    briefs = json.load(open(P["briefs"]))
    idx = Index()
    jobs = select(briefs, args)
    if not jobs:
        sys.exit("no matching briefs.")

    today = datetime.date.today().isoformat()
    plans, skipped = [], 0
    for b in jobs:
        if args.publish and not args.force:
            path = P["canon"] / f"{b['slug']}.md"
            if path.exists() and fm.parse_art_scalars(fm.split(path)[1]).get("status") == "generated":
                skipped += 1
                continue
        feat = resolve_featured(idx, b, args.max_refs)
        prompt, art_type, refs = build_prompt(b, feat)
        plans.append((b, prompt, art_type, refs, feat))

    est = len(plans) * COST.get(args.quality, 0.02)
    dest = "PUBLISH (master+webp+frontmatter)" if args.publish else f"smoke art-smoke/*-{args.tag}.png"
    print(f"Style {LOCKED} ({STYLE_VERSION}) | {len(plans)} scene(s) | q={args.quality} | "
          f"est ~${est:.2f} | {dest}" + (f" | skipped {skipped} already-generated" if skipped else ""))
    for b, _, art_type, refs, feat in plans:
        names = ", ".join(f["display"] + ("*" if f["master"] else "") for f in feat) or "—"
        print(f"  - {b['slug']} [{art_type}] {len(refs)} ref(s): {names}")
    print("  (* = has reference image attached)")
    if args.dry_run or not plans:
        return
    if not args.yes and input("proceed? [y/N] ").strip().lower() not in ("y", "yes"):
        sys.exit("aborted.")

    client = OpenAI()
    SMOKE_OUT.mkdir(parents=True, exist_ok=True)
    done = 0
    for b, prompt, art_type, refs, feat in plans:
        size = SIZE[art_type]
        ph, seed = prompt_hash(prompt), slug_seed(b["slug"])
        mode = f"edit×{len(refs)}" if refs else "generate"
        print(f"\n▶ {b['slug']} [{art_type}] {size} q={args.quality} {mode} hash={ph}", flush=True)
        try:
            png = gen_edit(client, prompt, refs, size, args.quality) if refs else gen_plain(client, prompt, size, args.quality)
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            continue
        if not args.publish:
            out = SMOKE_OUT / f"{b['slug']}-{args.tag}.png"
            out.write_bytes(png)
            print(f"  ✓ {out.relative_to(REPO)} ({len(png)//1024} KB)")
            continue
        master = P["masters"] / f"{b['slug']}.png"
        webp = P["site_art"] / f"{b['slug']}.webp"
        master.parent.mkdir(parents=True, exist_ok=True)
        master.write_bytes(png)
        ki, ko = optimize.to_webp(master, webp)
        fields = {
            "type": art_type, "eligibility": "ok",
            "has_visual_source": bool(refs),
            "ref_images": [f"art-originals/{r.split('/art-originals/')[-1]}" for r in refs],
            "visual": b["visual"],
            "model": "gpt-image-2", "style_version": STYLE_VERSION,
            "prompt_hash": ph, "seed": seed, "status": "generated",
            "generated_at": today, "scene_title": b.get("scene_title"),
            "key_entities": b.get("key_entities"),
            "image": f"/art/{args.collection}/{b['slug']}.webp",
        }
        fm.write_art_block(P["canon"] / f"{b['slug']}.md", fields)
        done += 1
        print(f"  ✓ {webp.relative_to(REPO)} ({ko} KB, from {ki} KB) + frontmatter")
    if args.publish:
        print(f"\nPublished {done} episode plate(s).")


if __name__ == "__main__":
    main()
