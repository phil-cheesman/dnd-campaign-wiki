#!/usr/bin/env python3
"""Downscale Jon's full-res region/city maps into committed display images.

The interactive map (Phase 3) renders downscaled JPGs from `site/public/maps/`; the
full-res sources in `sources/dm-docs/maps/` are gitignored (copyright + binaries-out
policy, and Kirkenwall alone is 18 MB). This script is the one place that turns a messy
source filename into a clean `<id>-display.jpg` so we never hand-commit a full-res map.

It mirrors `scripts/gallery/build_derivatives.py`: Pillow, EXIF-stripped, incremental
(re-encode only when the source is newer than the derivative), `--force` to rebuild all.

The MANIFEST maps a stable map id (the key used in `canon/map/places.yaml` `maps:`) to its
source file. Add a row here when a new region/city map is wired. Output dimensions are
printed so they can be transcribed into the `maps:` entry (coords are normalised, but the
bounds need the right aspect ratio).

Usage:
  scripts/gen/.venv/bin/python scripts/maps/build_displays.py
  scripts/gen/.venv/bin/python scripts/maps/build_displays.py --force
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[2]
SRC_DIR = REPO / "sources" / "dm-docs" / "maps"
OUT_DIR = REPO / "site" / "public" / "maps"
LONG_EDGE = 2048
QUALITY = 82

# map id (places.yaml `maps:` key)  ->  source filename under sources/dm-docs/maps/
MANIFEST = {
    # --- Tier 1: regional (kingdom-overview) maps ---
    "gidia": "maps-gidia--gidia.jpg",
    "carasia": "maps-carasia--carasian-kingdom-map.jpg",
    "dalacia": "maps-dalacia--dalacia.jpg",
    # --- Tier 2: city maps (deferred — add rows as they're wired) ---
    # "goldcrest-city": "maps-gidia--goldcrest.jpg",
    # "kirkenwall-city": "cities-kirkenwall--kierkenwall.jpg",
}


def fit(im, edge):
    """Downscale so the long edge is <= edge (never upscale)."""
    w, h = im.size
    scale = edge / max(w, h)
    if scale >= 1:
        return im
    return im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def build(force=False):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    n_enc = n_kept = 0
    rows = []
    for map_id, src_name in MANIFEST.items():
        src = SRC_DIR / src_name
        if not src.exists():
            print(f"  ! missing source for '{map_id}': {src_name}")
            continue
        out = OUT_DIR / f"{map_id}-display.jpg"

        fresh = (not force and out.exists()
                 and out.stat().st_mtime >= src.stat().st_mtime)
        if fresh:
            with Image.open(out) as oim:
                w, h = oim.size
            n_kept += 1
        else:
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")  # bake orientation, drop EXIF
                disp = fit(im, LONG_EDGE)
                disp.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
                w, h = disp.size
            n_enc += 1
        kb = out.stat().st_size // 1024
        rows.append((map_id, w, h, kb))

    print(f"\nencoded {n_enc} · reused {n_kept} → {OUT_DIR.relative_to(REPO)}\n")
    print("  Transcribe these dims into canon/map/places.yaml `maps:`:")
    for map_id, w, h, kb in rows:
        print(f"    {map_id:16}  width: {w:5}  height: {h:5}   ({kb} KB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Downscale region/city maps to committed display JPGs.")
    ap.add_argument("--force", action="store_true", help="re-encode every map")
    build(force=ap.parse_args().force)
