#!/usr/bin/env python3
"""Build tiny WebP thumbnails of entity art for the force-graph nodes.

The graph paints each node's portrait/crest into a ~20-50px circle, redrawing
EVERY frame (the layout drifts perpetually). Feeding it the full 640x960 dossier
art means ~15 MB of downloads, ~250 MB of decoded bitmap RAM, and the canvas
rescaling huge source bitmaps 100x per frame -> slow load + jank on zoom. These
thumbnails (short edge 192px) cut all three by ~10x while still looking crisp at
node sizes and a reasonable zoom-in.

For every node-eligible art file at
  site/public/art/<collection>/<slug>.<ext>
it writes
  site/public/art-thumb/<collection>/<slug>.webp   (short edge <= 192px)

`graph.ts` joins these by the same `/art/ -> /art-thumb/` path convention and the
canvas painter prefers the thumb (falling back to the full image if absent), so a
missing thumb degrades to "heavier but correct", never to a broken node.

Short edge (not long edge) is bounded so BOTH portrait and landscape art keep a
min dimension >= 192 -- cover-fitting into a circle samples the short edge, so
this guarantees no upscale blur at the node sizes the graph uses.

Incremental: a thumb is re-encoded only when missing or older than its source, so
re-runs touch only what changed. Orphans (art deleted/renamed) are pruned. Use
--force after changing the size/quality constants below.

Usage:
  scripts/gen/.venv/bin/python scripts/art/build_node_thumbs.py
  scripts/gen/.venv/bin/python scripts/art/build_node_thumbs.py --force
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[2]
ART_DIR = REPO / "site" / "public" / "art"
OUT_DIR = REPO / "site" / "public" / "art-thumb"

# Tiers whose nodes carry art in the graph. Episodes (164) and arcs now carry
# scene art too -> they MUST be thumbed, or the graph falls back to painting the
# full 1024px source for every one each frame (a ~45 MB / heavy-decode regression
# the thumbs exist to prevent).
COLLECTIONS = ["characters", "npcs", "locations", "kingdoms", "factions", "items", "worldbuilding", "episodes", "arcs"]
EXTS = {".webp", ".png", ".jpg", ".jpeg"}
SHORT_EDGE = 192
QUALITY = 82


def fit_short(im, edge):
    """Downscale so the SHORT edge is <= edge (never upscale)."""
    w, h = im.size
    scale = edge / min(w, h)
    if scale >= 1:
        return im
    return im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def build(force=False):
    if not ART_DIR.is_dir():
        sys.exit(f"No art dir at {ART_DIR}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    expected = set()
    n_enc = n_kept = 0

    for collection in COLLECTIONS:
        src_dir = ART_DIR / collection
        if not src_dir.is_dir():
            continue
        for src in sorted(src_dir.iterdir()):
            if src.suffix.lower() not in EXTS:
                continue
            out = OUT_DIR / collection / f"{src.stem}.webp"
            expected.add(out)
            out.parent.mkdir(parents=True, exist_ok=True)

            fresh = (
                not force
                and out.exists()
                and out.stat().st_mtime >= src.stat().st_mtime
            )
            if fresh:
                n_kept += 1
                continue
            try:
                with Image.open(src) as im:
                    im = ImageOps.exif_transpose(im).convert("RGB")
                    fit_short(im, SHORT_EDGE).save(out, "WEBP", quality=QUALITY, method=6)
                n_enc += 1
            except Exception as e:  # noqa: BLE001 -- report and keep going
                print(f"  ! failed {src.relative_to(ART_DIR)}: {e}")

    # Prune orphans (source art deleted/renamed) and now-empty dirs.
    removed = 0
    for p in OUT_DIR.rglob("*.webp"):
        if p not in expected:
            p.unlink()
            removed += 1
    for d in sorted(OUT_DIR.glob("*")):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()

    total_kb = sum(p.stat().st_size for p in OUT_DIR.rglob("*.webp")) // 1024
    n_ok = len(expected)
    print(f"\n{n_ok} thumbs -> {OUT_DIR.relative_to(REPO)} ({total_kb/1024:.1f} MB)")
    print(f"  encoded {n_enc} · reused {n_kept} · pruned {removed}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build force-graph node thumbnails (incremental).")
    ap.add_argument("--force", action="store_true", help="re-encode every thumb (after changing size/quality)")
    build(force=ap.parse_args().force)
