#!/usr/bin/env python3
"""Optimize generated art for the web: full-res PNG master -> display-size WebP.

The raw gpt-image-2 output is ~4 MB at 1024–1536px — far too big to commit or to
serve (the wiki shows portraits at ~300px). We keep the masters locally (gitignored
`art-originals/`, since they're paid-for and enable re-deriving / external hosting
later) and commit only the small WebP under `site/public/art/`.

Target widths (retina-friendly for the infobox display sizes):
  portrait / crest / object (tall or square)  -> 640px wide
  landscape (wide)                              -> 1024px wide
WebP quality 80 — visually lossless at these display sizes, ~40–80 KB each.

Used both for the one-time migration of the existing batch (`--migrate`) and by
generate.py for every future render.
"""
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parent.parent.parent
MASTERS = REPO / "art-originals"
SITE_ART = REPO / "site" / "public" / "art"
QUALITY = 80


def target_width(w, h):
    return 1024 if w > h else 640


def to_webp(src_png: Path, dst_webp: Path):
    """Resize a master PNG to display size and write WebP. Returns (kb_in, kb_out)."""
    dst_webp.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src_png).convert("RGB")
    tw = target_width(*im.size)
    if im.width > tw:
        im = im.resize((tw, round(im.height * tw / im.width)), Image.LANCZOS)
    im.save(dst_webp, "WEBP", quality=QUALITY, method=6)
    return src_png.stat().st_size // 1024, dst_webp.stat().st_size // 1024


def migrate():
    """Convert every master in art-originals/ to a WebP under site/public/art/."""
    pngs = sorted(MASTERS.rglob("*.png"))
    tin = tout = 0
    for p in pngs:
        rel = p.relative_to(MASTERS).with_suffix(".webp")
        ki, ko = to_webp(p, SITE_ART / rel)
        tin += ki
        tout += ko
        print(f"  {rel}  {ki} KB -> {ko} KB")
    print(f"\n{len(pngs)} images: {tin//1024} MB masters -> {tout/1024:.1f} MB WebP")


if __name__ == "__main__":
    migrate()
