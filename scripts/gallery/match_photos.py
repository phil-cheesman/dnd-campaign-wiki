#!/usr/bin/env python3
"""Match shared-album session photos to episodes by EXIF capture date.

Reads the raw JPEGs exported from the "DnD" iCloud Shared Album (gitignored under
`sources/photos_raw/`), pulls each photo's `DateTimeOriginal`, and assigns it to the
episode whose `date:` frontmatter is nearest. Writes a hand-editable YAML manifest at
`canon/gallery/session-photos.yaml`.

Why nearest-date works (validated against the real export, 427 photos / 162 episodes):
  - 44% land exactly on a session day, 97% within 3 days.
  - Jon photographs his minis 1-3 days BEFORE a session; sessions are ~2 weeks apart,
    so those early shots are still nearest to the upcoming episode and attach correctly.
  - Capture date (not upload/add date) sidesteps the "someone added it months later" problem.

Confidence: high = within +/-1 day; medium = within +/-3; review = >3 days off, no EXIF
date, or genuinely ambiguous (a second session nearly equidistant, or a shared session date).

Re-run safe. Auto fields (`suggested`, `delta_days`, `confidence`, `captured`, `note`) are
always recomputed so new photos appear and you can spot suggestion drift. Your manual fields
(`episode`, `skip`, `caption`) are NEVER overwritten for photos already in the manifest; new
photos default `episode` to the suggestion. Edit `episode` to re-assign (or null to unassign),
set `skip: true` to drop memes/screenshots, and fill `caption` for a custom lightbox label.

Usage:
  scripts/gen/.venv/bin/python scripts/gallery/match_photos.py            # refresh + write
  scripts/gen/.venv/bin/python scripts/gallery/match_photos.py --dry-run  # summary only
"""
import argparse
import json
import re
import sys
from datetime import datetime, date
from pathlib import Path

from PIL import Image, ExifTags

REPO = Path(__file__).resolve().parent.parent.parent
PHOTOS_DIR = REPO / "sources" / "photos_raw"
EPISODES_DIR = REPO / "canon" / "episodes"
MANIFEST = REPO / "canon" / "gallery" / "session-photos.yaml"

IMAGE_EXTS = {".jpg", ".jpeg"}
VIDEO_EXTS = {".mov", ".mp4"}
DATE_RE = re.compile(r"^date:\s*(\d{4}-\d{2}-\d{2})\s*$", re.M)
EPISODE_RE = re.compile(r"^episode:\s*(\d+)\s*$", re.M)
TITLE_RE = re.compile(r"^title:\s*(.*)$", re.M)
_EXIF_ORIGINAL = 36867  # DateTimeOriginal
_EXIF_DATETIME = 306     # DateTime (fallback)


# ----------------------------------------------------------------------------- episodes
class Episode:
    __slots__ = ("slug", "number", "title", "date")

    def __init__(self, slug, number, title, d):
        self.slug, self.number, self.title, self.date = slug, number, title, d


def load_episodes():
    """All episodes with a parseable date, keyed by slug (== filename stem)."""
    eps = []
    for path in sorted(EPISODES_DIR.glob("e*.md")):
        head = path.read_text()[:600]
        dm = DATE_RE.search(head)
        if not dm:
            continue
        num = EPISODE_RE.search(head)
        tm = TITLE_RE.search(head)
        title = (tm.group(1).strip() if tm else "") or ""
        if title in ("null", "~"):
            title = ""
        eps.append(Episode(
            slug=path.stem,
            number=int(num.group(1)) if num else None,
            title=title.strip('"'),
            d=date.fromisoformat(dm.group(1)),
        ))
    if not eps:
        sys.exit(f"No episodes with dates found under {EPISODES_DIR}")
    return eps


def match(photo_date, eps):
    """-> (best Episode, delta_days, confidence, note). delta<0 = photo before session."""
    if photo_date is None:
        return None, None, "review", "no EXIF capture date"
    ranked = sorted(eps, key=lambda e: abs((photo_date - e.date).days))
    best = ranked[0]
    delta = (photo_date - best.date).days
    # ambiguity: another *different* session nearly as close, or a shared session date.
    note = ""
    rivals = [e for e in ranked[1:] if abs((photo_date - e.date).days) - abs(delta) <= 1]
    same_date = [e for e in eps if e.date == best.date and e.slug != best.slug]
    if same_date:
        note = "shared session date: " + ", ".join(e.slug for e in [best, *same_date])
    elif rivals and abs(delta) >= 1:
        note = "near-tie: " + ", ".join(
            f"{e.slug}({(photo_date - e.date).days:+d}d)" for e in [best, rivals[0]])
    if note:
        return best, delta, "review", note
    if abs(delta) <= 1:
        return best, delta, "high", ""
    if abs(delta) <= 3:
        return best, delta, "medium", ""
    return best, delta, "review", f"{abs(delta)}d from nearest session"


# ----------------------------------------------------------------------------- photos
def capture_date(path):
    """EXIF DateTimeOriginal as a date, or None. Returns (date|None, raw_str|None)."""
    try:
        with Image.open(path) as im:
            exif = im.getexif()
            raw = exif.get_ifd(ExifTags.IFD.Exif).get(_EXIF_ORIGINAL) or exif.get(_EXIF_DATETIME)
    except Exception:
        return None, None
    if not raw:
        return None, None
    try:
        dt = datetime.strptime(str(raw).strip()[:19], "%Y:%m:%d %H:%M:%S")
        return dt.date(), dt.strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None, None


# ----------------------------------------------------------------------------- manifest I/O
def parse_existing(path):
    """Read prior manual edits keyed by file: {file: {episode, skip, caption}}. Tolerant parser."""
    if not path.exists():
        return {}
    kept, cur = {}, None
    for ln in path.read_text().splitlines():
        m = re.match(r"^  - file:\s*(.+?)\s*$", ln)
        if m:
            cur = m.group(1).strip().strip('"')
            kept[cur] = {}
            continue
        if cur is None:
            continue
        m = re.match(r"^    (\w+):\s*(.*)$", ln)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if key in ("episode", "skip", "caption"):
            kept[cur][key] = val
    return kept


def _yaml_str(val):
    """Emit a value as JSON (double-quoted, escaped) so the parser can round-trip it."""
    return json.dumps(val)


def write_manifest(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    n_assigned = sum(1 for r in records if r["episode"] and not r["skip"])
    n_skip = sum(1 for r in records if r["skip"])
    n_review = sum(1 for r in records if r["confidence"] == "review" and not r["skip"])
    L = [
        "# Session photos -> episode assignments.",
        "# AUTO-GENERATED by scripts/gallery/match_photos.py -- but your hand-edits are PRESERVED.",
        "#",
        "# Edit these three fields; re-running the script never overwrites them:",
        "#   episode  - effective assignment (slug like e108, or null to unassign)",
        "#   skip     - true to exclude (memes, screenshots, videos)",
        "#   caption  - optional custom lightbox label (\"\" = none)",
        "# The other fields (suggested/delta_days/confidence/captured/note) are recomputed each run.",
        f"# {len(records)} files | {n_assigned} assigned | {n_skip} skipped | {n_review} need review",
        "",
        "photos:",
    ]
    for r in records:
        ep = r["episode"]
        label = f'E{r["ep_number"]}' if r["ep_number"] else (r["suggested"] or "?")
        if r["ep_title"]:
            label += f' "{r["ep_title"]}"'
        delta = f'{r["delta_days"]:+d}d' if r["delta_days"] is not None else "??"
        L.append(f"  # {label}  -  taken {r['captured_date'] or '????-??-??'}  -  {delta}  -  {r['confidence']}"
                 + (f"  -  {r['note']}" if r["note"] else ""))
        L.append(f"  - file: {r['file']}")
        L.append(f"    captured: {_yaml_str(r['captured']) if r['captured'] else 'null'}")
        L.append(f"    suggested: {r['suggested'] or 'null'}")
        L.append(f"    episode: {ep if ep else 'null'}")
        L.append(f"    delta_days: {r['delta_days'] if r['delta_days'] is not None else 'null'}")
        L.append(f"    confidence: {r['confidence']}")
        L.append(f"    skip: {'true' if r['skip'] else 'false'}")
        L.append(f"    caption: {_yaml_str(r['caption'])}")
    path.write_text("\n".join(L) + "\n")


# ----------------------------------------------------------------------------- main
def build(dry_run=False):
    eps = load_episodes()
    by_slug = {e.slug: e for e in eps}
    kept = parse_existing(MANIFEST)

    files = sorted(
        p for p in PHOTOS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in (IMAGE_EXTS | VIDEO_EXTS)
    )
    if not files:
        sys.exit(f"No photos found under {PHOTOS_DIR}")

    records = []
    for p in files:
        is_video = p.suffix.lower() in VIDEO_EXTS
        if is_video:
            d, raw = None, None
            best, delta, conf, note = None, None, "review", "video (not a still photo)"
        else:
            d, raw = capture_date(p)
            best, delta, conf, note = match(d, eps)
        suggested = best.slug if best else None

        prev = kept.get(p.name)
        if prev is not None:                       # known file -> preserve manual fields verbatim
            ep_val = prev.get("episode", "null")
            episode = None if ep_val in ("null", "", "~") else ep_val.strip('"')
            skip = prev.get("skip", "false").lower() == "true"
            caption = _unquote(prev.get("caption", '""'))
        else:                                      # new file -> sensible defaults
            episode = None if is_video else suggested
            skip = is_video
            caption = ""

        ep_obj = by_slug.get(episode) if episode else (best if not is_video else None)
        records.append({
            "file": p.name, "captured": raw, "captured_date": d.isoformat() if d else None,
            "suggested": suggested, "episode": episode, "delta_days": delta,
            "confidence": conf, "skip": skip, "caption": caption, "note": note,
            "ep_number": ep_obj.number if ep_obj else None,
            "ep_title": ep_obj.title if ep_obj else "",
        })

    summarize(records)
    if dry_run:
        print("\n(dry run -- manifest not written)")
        return
    write_manifest(MANIFEST, records)
    print(f"\nWrote {MANIFEST.relative_to(REPO)}")


def _unquote(raw):
    raw = raw.strip()
    if raw.startswith('"'):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw.strip('"')
    return raw


def summarize(records):
    from collections import Counter
    photos = [r for r in records if not (r["confidence"] == "review" and r["note"].startswith("video"))]
    conf = Counter(r["confidence"] for r in photos)
    print(f"{len(records)} files ({len(records) - len(photos)} videos skipped)")
    print(f"  high: {conf['high']}   medium: {conf['medium']}   review: {conf['review']}")
    review = [r for r in photos if r["confidence"] == "review"]
    if review:
        print(f"\nNeed a look ({len(review)}):")
        for r in review[:40]:
            print(f"  {r['file']:32}  {r['captured_date'] or 'no-date':10}  -> "
                  f"{r['suggested'] or '?':9}  {r['note']}")
        if len(review) > 40:
            print(f"  ... and {len(review) - 40} more")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Match session photos to episodes by capture date.")
    ap.add_argument("--dry-run", action="store_true", help="print summary without writing the manifest")
    build(dry_run=ap.parse_args().dry_run)
