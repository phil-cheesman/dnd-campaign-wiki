#!/usr/bin/env python3
"""Generate small list/card thumbnails from the published scene plates.

The full hero plates (site/public/art/<coll>/<slug>.webp) are ~1024x683 / ~234 KB
each — far too heavy to use as the tiny thumbnails on the episodes header page
(163 rows) or the home "Recent episodes" cards. This makes a dedicated thumbnail
per plate (3:2 preserved, ~360 px wide, ~20 KB) under
site/public/art/<coll>/thumbs/<slug>.webp.

Idempotent: skips a thumb that already exists and is newer than its source,
unless --force. Run it after any scene-art batch so new episodes get thumbnails.

    ./.venv/bin/python thumbs.py                 # episodes + arcs
    ./.venv/bin/python thumbs.py --collection episodes
    ./.venv/bin/python thumbs.py --force
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
ART = REPO / "site" / "public" / "art"
WIDTH = 360          # display ≤180 px → 2x crisp; covers row + card uses
QUALITY = 80


def gen(coll: str, force: bool) -> tuple[int, int]:
    src_dir = ART / coll
    out_dir = src_dir / "thumbs"
    out_dir.mkdir(exist_ok=True)
    made = skipped = 0
    for src in sorted(src_dir.glob("*.webp")):
        out = out_dir / src.name
        if not force and out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            h = round(im.height * WIDTH / im.width)
            im.resize((WIDTH, h), Image.LANCZOS).save(out, "WEBP", quality=QUALITY, method=6)
        made += 1
    print(f"  {coll}: {made} generated, {skipped} up-to-date  ({out_dir.relative_to(REPO)})")
    return made, skipped


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--collection", choices=["episodes", "arcs"], action="append",
                    help="default: both episodes and arcs")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    colls = args.collection or ["episodes", "arcs"]
    print(f"Thumbnails → {WIDTH}px wide WebP q{QUALITY}")
    for c in colls:
        gen(c, args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
