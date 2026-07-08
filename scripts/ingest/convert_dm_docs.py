#!/usr/bin/env python3
"""
Phase A converter: turn Jon's raw "Dungeon Master Docs" dump into faithful,
committed markdown under sources/dm-docs/, with images/maps extracted to
gitignored side folders and a coverage manifest.

This is a MECHANICAL, verbatim conversion — no rewriting. sources/ is an
immutable input layer; canon/ enrichment (judgment) happens later in Phase B.

Re-runnable: clobbers prior converted output. Raw binaries, /media, /maps are
gitignored; only the .md text + the manifest are committed.
"""
import json, re, shutil, subprocess, sys, zipfile
from pathlib import Path

REPO = Path("/Users/phillipcheesman/Developer/alambor-campaign")
SRC  = REPO / "sources/dm-docs/_raw/Dungeon Master Docs"
DEST = REPO / "sources/dm-docs"
MEDIA = DEST / "media"
MAPS  = DEST / "maps"

# top-level Drive folder -> area under sources/dm-docs/
AREA = {
    "Kingdom Details": "kingdoms",
    "City Details": "cities",
    "Faction Details": "factions",
    "Episode Prep (since anthology notes ended)": "episode-prep",
    "Campaign Sidequests": "sidequests",
    "Character Backstories": "character-backstories",
    "Maps": "maps",
}
# loose root docs -> worldbuilding
ROOT_AREA = "worldbuilding"

# first-pass dm_only (spoiler) guess by area; Phase B refines per-section
DM_ONLY_BY_AREA = {
    "episode-prep": True, "sidequests": True,
    "kingdoms": False, "cities": False, "factions": False,
    "character-backstories": False, "worldbuilding": False, "maps": False,
}
DM_ONLY_FILE_HINTS = {  # loose worldbuilding files needing a non-default guess
    "anthology-notes": True, "vault-of-izzdar-notes": True,
    "campaign-2-log-for-the-boys": True,
}
EXTERNAL_HINTS = ("lich", "limithron", "naval combat", "anycubic", "guide to lichdom")

IMG_EXT = {".jpg", ".jpeg", ".png", ".jfif", ".gif", ".webp"}
SKIP_EXT = {".tmp", ".lnk", ".ds_store"}

def is_junk(p: Path) -> bool:
    n = p.name
    return n.startswith("~$") or n.startswith("~WRL") or n == ".DS_Store" \
        or p.suffix.lower() in SKIP_EXT

def kebab(s: str) -> str:
    s = re.sub(r"[_\s]+", "-", s.strip())
    s = re.sub(r"[^A-Za-z0-9\-]", "", s)
    s = re.sub(r"-+", "-", s).strip("-").lower()
    return s or "untitled"

def rel_under_src(p: Path) -> str:
    return str(p.relative_to(SRC))

def collapse_dupes(parts):
    """Drop consecutive duplicate path segments: Carstone/Carstone -> Carstone."""
    out = []
    for seg in parts:
        if out and out[-1] == seg:
            continue
        out.append(seg)
    return out

def area_and_subpath(p: Path):
    parts = list(p.relative_to(SRC).parts)
    if len(parts) == 1:                       # loose root file
        return ROOT_AREA, []
    top = parts[0]
    area = AREA.get(top, ROOT_AREA)
    mid = [kebab(s) for s in collapse_dupes(parts[1:-1])]  # kebab intermediate dirs
    return area, mid

def frontmatter(title, source_rel, area, doc_type, dm_only, external, extra=None):
    fm = {
        "title": title, "source": f"dm-docs/_raw/Dungeon Master Docs/{source_rel}",
        "owner": "Jon (DM)", "area": area, "doc_type": doc_type,
        "dm_only": dm_only, "external_reference": external,
        "converted_with": "scripts/ingest/convert_dm_docs.py",
    }
    if extra: fm.update(extra)
    lines = ["---"]
    for k, v in fm.items():
        lines.append(f"{k}: {json.dumps(v) if isinstance(v,(bool,list,dict)) else v}")
    lines.append("---\n")
    return "\n".join(lines)

def convert_docx(p, out_md, media_dir):
    media_dir.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ["pandoc", str(p), "-f", "docx", "-t", "gfm",
         "--wrap=none", f"--extract-media={media_dir}"],
        capture_output=True, text=True)
    if r.returncode != 0:
        return None, r.stderr.strip()[:300]
    # drop empty media dir
    if media_dir.exists() and not any(media_dir.rglob("*")):
        shutil.rmtree(media_dir, ignore_errors=True)
    # rewrite pandoc's absolute image paths (both <img src> and ![]() forms) to
    # repo-dm-docs-relative references
    abs_prefix = re.escape(f"{DEST}/")
    out = re.sub(r'<img src="' + abs_prefix + r'([^"]*)"[^>]*/>',
                 lambda m: f'![]({m.group(1)})', r.stdout)
    out = re.sub(r'!\[\]\(' + abs_prefix + r'([^)]*)\)',
                 lambda m: f'![]({m.group(1)})', out)
    return out, None

def convert_xlsx(p):
    import openpyxl
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        out.append(f"\n## Sheet: {ws.title}\n")
        rows = []
        for row in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c).replace("|", "\\|").replace("\n", " ")
                     for c in row]
            while cells and cells[-1] == "":
                cells.pop()
            if cells:
                rows.append(cells)
        if not rows:
            out.append("_(empty)_\n"); continue
        width = max(len(r) for r in rows)
        rows = [r + [""] * (width - len(r)) for r in rows]
        # drop columns that are empty across every row (sparse-sheet noise)
        keep = [c for c in range(width) if any(r[c] for r in rows)]
        rows = [[r[c] for c in keep] for r in rows]
        width = len(keep)
        if width == 0:
            out.append("_(empty)_\n"); continue
        out.append("| " + " | ".join(rows[0]) + " |")
        out.append("| " + " | ".join(["---"] * width) + " |")
        for r in rows[1:]:
            out.append("| " + " | ".join(r) + " |")
        out.append("")
    wb.close()
    return "\n".join(out)

def extract_pptx_media(p, dest_prefix):
    """pptx isn't pandoc-readable; pull its embedded images into maps/."""
    n = 0
    try:
        with zipfile.ZipFile(p) as z:
            for name in z.namelist():
                if name.startswith("ppt/media/"):
                    data = z.read(name)
                    ext = Path(name).suffix.lower() or ".bin"
                    out = MAPS / f"{dest_prefix}--{Path(name).name}"
                    out.write_bytes(data); n += 1
    except Exception as e:
        return -1, str(e)
    return n, None

def main():
    for d in (MEDIA, MAPS):
        d.mkdir(parents=True, exist_ok=True)
    manifest = []
    counts = {}
    def bump(k): counts[k] = counts.get(k, 0) + 1

    for p in sorted(SRC.rglob("*")):
        if p.is_dir():
            continue
        source_rel = rel_under_src(p)
        if is_junk(p):
            manifest.append({"source": source_rel, "action": "skipped-junk"}); bump("skipped-junk"); continue

        area, mid = area_and_subpath(p)
        ext = p.suffix.lower()
        stem = kebab(p.stem)
        external = any(h in p.name.lower() for h in EXTERNAL_HINTS)

        # --- images -> maps/ (gitignored) ---
        if ext in IMG_EXT:
            tag = kebab("-".join(([area] + mid) or [area]))
            out = MAPS / f"{tag}--{stem}{'.jpg' if ext=='.jfif' else ext}"
            shutil.copy2(p, out)
            manifest.append({"source": source_rel, "action": "image->maps", "out": str(out.relative_to(REPO))}); bump("image"); continue

        # --- pptx -> extract media to maps/, note ---
        if ext == ".pptx":
            tag = kebab("-".join(([area] + mid + [stem])))
            n, err = extract_pptx_media(p, tag)
            manifest.append({"source": source_rel, "action": "pptx-media->maps",
                             "images": n, "error": err, "note": "labeled map/handout slides; review images"}); bump("pptx"); continue

        # --- pdf -> copy binary to maps/ (gitignored); flag text extraction need ---
        if ext == ".pdf":
            tag = kebab("-".join(([area] + mid)) or [area])
            out = MAPS / f"{tag}--{stem}.pdf"
            shutil.copy2(p, out)
            manifest.append({"source": source_rel, "action": "pdf->maps(binary)",
                             "out": str(out.relative_to(REPO)), "external_reference": external,
                             "note": "pandoc can't read pdf; if text-bearing, extract via Drive connector in a follow-up"}); bump("pdf"); continue

        out_dir = DEST.joinpath(area, *mid)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_md = out_dir / f"{stem}.md"
        dm_only = DM_ONLY_FILE_HINTS.get(stem, DM_ONLY_BY_AREA.get(area, False))

        # --- docx -> markdown ---
        if ext == ".docx":
            media_dir = MEDIA / kebab("-".join(([area] + mid + [stem])))
            body, err = convert_docx(p, out_md, media_dir)
            if err:
                manifest.append({"source": source_rel, "action": "docx-FAILED", "error": err}); bump("docx-failed"); continue
            had_media = media_dir.exists()
            extra = {"media_dir": str(media_dir.relative_to(REPO))} if had_media else None
            out_md.write_text(frontmatter(p.stem, source_rel, area, "docx", dm_only, external, extra) + body)
            manifest.append({"source": source_rel, "action": "docx->md",
                             "out": str(out_md.relative_to(REPO)), "media": had_media,
                             "dm_only": dm_only, "external_reference": external}); bump("docx"); continue

        # --- xlsx -> markdown tables ---
        if ext == ".xlsx":
            try:
                body = convert_xlsx(p)
            except Exception as e:
                manifest.append({"source": source_rel, "action": "xlsx-FAILED", "error": str(e)[:300]}); bump("xlsx-failed"); continue
            out_md.write_text(frontmatter(p.stem, source_rel, area, "xlsx", dm_only, external) + body)
            manifest.append({"source": source_rel, "action": "xlsx->md",
                             "out": str(out_md.relative_to(REPO)), "dm_only": dm_only}); bump("xlsx"); continue

        manifest.append({"source": source_rel, "action": "UNHANDLED", "ext": ext}); bump("unhandled")

    (DEST / "_manifest.json").write_text(json.dumps(manifest, indent=2))
    print("=== conversion summary ===")
    for k in sorted(counts):
        print(f"  {k:18} {counts[k]}")
    print(f"  {'TOTAL files':18} {len(manifest)}")
    print(f"manifest -> {DEST/'_manifest.json'}")

if __name__ == "__main__":
    sys.exit(main())
