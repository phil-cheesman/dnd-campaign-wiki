#!/usr/bin/env python3
"""Smoke-test episode SCENE art from scripts/gen/briefs/episodes.json.

Renders a few episode reference-image candidates to art-smoke/ (gitignored) so we
can eyeball Style B in the new "scene" framing BEFORE wiring a full --from-briefs
batch (which would write frontmatter + publish WebP). This writes NO frontmatter
and publishes nothing — it just proves the look.

Usage
-----
  python smoke_episodes.py --slug e030 --slug e095 --quality medium --yes
  python smoke_episodes.py --limit 5 --confidence high   # first 5 high-confidence

Output: art-smoke/<slug>-scene.png
Env: OPENAI_API_KEY (see README.md) — same path as generate.py.
"""
import argparse
import json
import sys
from pathlib import Path

from generate import gen_openai, load_env, prompt_hash, REPO, SMOKE_OUT
from style import STYLES, FRAMING, SIZE, STYLE_VERSION, NO_TEXT, LOCKED

BRIEFS = Path(__file__).resolve().parent / "episodes.json"
COST = {"low": 0.006, "medium": 0.014, "high": 0.05, "auto": 0.014}


def assemble_scene(b: dict, style_key: str) -> str:
    """STYLE + scene framing + the depicted moment + NO_TEXT (no portrait Subject line)."""
    art_type = b.get("art_type", "scene")
    framing = FRAMING[art_type]
    style = STYLES[style_key]
    cap = b.get("scene_title", "")
    return (
        f"{style}\n\n{framing}\n\n"
        f"Scene: {cap}.\n"
        f"{b['visual']}\n\n"
        f"{NO_TEXT}"
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slug", action="append", default=[], help="episode slug; repeatable")
    ap.add_argument("--limit", type=int, help="render the first N matching briefs")
    ap.add_argument("--confidence", help="only this confidence (high/medium/low)")
    ap.add_argument("--candidates-only", action="store_true", help="skip has_candidate==false")
    ap.add_argument("--quality", default="medium", choices=["low", "medium", "high", "auto"])
    ap.add_argument("--tag", default="", help="filename suffix")
    ap.add_argument("--yes", action="store_true", help="skip cost confirmation")
    args = ap.parse_args()
    load_env()

    briefs = json.load(open(BRIEFS))
    by_slug = {b["slug"]: b for b in briefs}
    if args.slug:
        jobs = [by_slug[s] for s in args.slug if s in by_slug]
        missing = [s for s in args.slug if s not in by_slug]
        if missing:
            print(f"  ⚠ no brief for: {missing}")
    else:
        jobs = list(briefs)
        if args.confidence:
            jobs = [b for b in jobs if b.get("confidence") == args.confidence]
        if args.candidates_only:
            jobs = [b for b in jobs if b.get("has_candidate")]
        if args.limit:
            jobs = jobs[: args.limit]

    if not jobs:
        sys.exit("no matching briefs.")
    est = len(jobs) * COST.get(args.quality, 0.014)
    print(f"Style {LOCKED} ({STYLE_VERSION}) | {len(jobs)} scene(s) | q={args.quality} | est ~${est:.2f}")
    for b in jobs:
        print(f"  - {b['slug']}: {b.get('scene_title','')}")
    if not args.yes and input("proceed? [y/N] ").strip().lower() not in ("y", "yes"):
        sys.exit("aborted.")

    suffix = f"-{args.tag}" if args.tag else ""
    SMOKE_OUT.mkdir(parents=True, exist_ok=True)
    for b in jobs:
        prompt = assemble_scene(b, LOCKED)
        size = SIZE[b.get("art_type", "scene")]
        out = SMOKE_OUT / f"{b['slug']}-scene{suffix}.png"
        print(f"\n▶ {b['slug']} [{b.get('art_type','scene')}] {size} q={args.quality} hash={prompt_hash(prompt)}", flush=True)
        png = gen_openai(prompt, size, args.quality)
        out.write_bytes(png)
        print(f"  ✓ {out.relative_to(REPO)} ({len(png)//1024} KB)")


if __name__ == "__main__":
    main()
