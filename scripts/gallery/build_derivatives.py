#!/usr/bin/env python3
"""Build web derivatives for the session photos and an episode->photos index.

Reads the reviewed manifest (`canon/gallery/session-photos.yaml`) and, for every photo
that is NOT skipped and HAS an episode, writes two EXIF-stripped WebP files:
  site/public/session-photos/<episode>/<name>.thumb.webp   (<=400px long edge -- strip)
  site/public/session-photos/<episode>/<name>.webp         (<=1600px long edge -- lightbox)
EXIF is dropped on save (no GPS leaks); orientation is baked in first so nothing renders
sideways. Then writes `site/src/data/session-photos.json` mapping episode slug -> ordered
photo list (capture order) for the episode page to import.

Incremental: a photo is only re-encoded when its derivatives are missing or older than
the source, so re-runs touch only what actually changed (keeps git history lean instead
of rewriting ~90 MB of binaries every run). Orphans from deleted/skipped/reassigned photos
are pruned, and empty episode dirs removed. Use --force after changing the size/quality
constants below to re-encode everything.

Usage:
  scripts/gen/.venv/bin/python scripts/gallery/build_derivatives.py
  scripts/gen/.venv/bin/python scripts/gallery/build_derivatives.py --force
"""
import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from match_photos import REPO, PHOTOS_DIR, MANIFEST, parse_existing, _unquote, capture_date

OUT_DIR = REPO / "site" / "public" / "session-photos"
INDEX = REPO / "site" / "src" / "data" / "session-photos.json"
THUMB_EDGE = 400
FULL_EDGE = 1600
QUALITY = 80


def fit(im, edge):
    """Downscale so the long edge is <= edge (never upscale)."""
    w, h = im.size
    scale = edge / max(w, h)
    if scale >= 1:
        return im
    return im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def safe_name(stem, used):
    """URL-safe, unique-within-episode filename stem."""
    base = re.sub(r"[^A-Za-z0-9]+", "-", stem).strip("-") or "photo"
    name, i = base, 2
    while name in used:
        name = f"{base}-{i}"
        i += 1
    used.add(name)
    return name


def build(force=False):
    records = parse_existing(MANIFEST)
    if not records:
        sys.exit(f"No manifest at {MANIFEST} -- run match_photos.py first.")

    # Collect assigned, non-skipped photos with their capture time (for ordering).
    chosen = []
    for fname, fields in records.items():
        if fields.get("skip", "false").lower() == "true":
            continue
        ep = fields.get("episode", "null")
        if ep in ("null", "", "~"):
            continue
        src = PHOTOS_DIR / fname
        if not src.exists():
            print(f"  ! missing source, skipping: {fname}")
            continue
        d, raw = capture_date(src)
        chosen.append((ep.strip('"'), raw or "", src, _unquote(fields.get("caption", '""'))))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index, used, expected = {}, {}, set()
    chosen.sort(key=lambda r: (r[0], r[1], r[2].name))  # episode, capture time, filename
    n_enc = n_kept = 0
    for ep, _raw, src, caption in chosen:
        ep_dir = OUT_DIR / ep
        ep_dir.mkdir(parents=True, exist_ok=True)
        stem = safe_name(src.stem, used.setdefault(ep, set()))
        full_path, thumb_path = ep_dir / f"{stem}.webp", ep_dir / f"{stem}.thumb.webp"
        expected.update((full_path, thumb_path))

        # Incremental: skip re-encoding when both derivatives exist and are at least as
        # new as the source. Reassigning a photo changes its episode dir, so the new path
        # is missing -> re-encoded there, and the old one is pruned below.
        src_mtime = src.stat().st_mtime
        fresh = (not force and full_path.exists() and thumb_path.exists()
                 and full_path.stat().st_mtime >= src_mtime
                 and thumb_path.stat().st_mtime >= src_mtime)
        try:
            if fresh:
                with Image.open(full_path) as fim:
                    w, h = fim.size
                n_kept += 1
            else:
                with Image.open(src) as im:
                    im = ImageOps.exif_transpose(im).convert("RGB")  # bake orientation, drop EXIF
                    full = fit(im, FULL_EDGE)
                    full.save(full_path, "WEBP", quality=QUALITY, method=6)
                    fit(im, THUMB_EDGE).save(thumb_path, "WEBP", quality=QUALITY, method=6)
                    w, h = full.size
                n_enc += 1
        except Exception as e:
            print(f"  ! failed {src.name}: {e}")
            continue
        index.setdefault(ep, []).append({
            "thumb": f"/session-photos/{ep}/{stem}.thumb.webp",
            "src": f"/session-photos/{ep}/{stem}.webp",
            "w": w,
            "h": h,
            "caption": caption or "",
        })

    # Prune orphans (deleted/skipped/reassigned photos) and now-empty episode dirs.
    removed = 0
    for p in OUT_DIR.rglob("*.webp"):
        if p not in expected:
            p.unlink()
            removed += 1
    for d in sorted(OUT_DIR.glob("*")):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()

    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(index, indent=2, sort_keys=True) + "\n")
    total_kb = sum(p.stat().st_size for p in OUT_DIR.rglob("*.webp")) // 1024
    n_ok = sum(len(v) for v in index.values())
    print(f"\n{n_ok} photos across {len(index)} episodes -> {OUT_DIR.relative_to(REPO)} ({total_kb/1024:.1f} MB)")
    print(f"  encoded {n_enc} · reused {n_kept} · pruned {removed}")
    print(f"Index: {INDEX.relative_to(REPO)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build web derivatives for session photos (incremental).")
    ap.add_argument("--force", action="store_true", help="re-encode every photo (use after changing size/quality)")
    build(force=ap.parse_args().force)
