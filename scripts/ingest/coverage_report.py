#!/usr/bin/env python3
"""Generate sources/dm-docs/COVERAGE.md from the conversion manifest + landed files."""
import json, re
from pathlib import Path

REPO = Path("/Users/phillipcheesman/Developer/alambor-campaign")
DEST = REPO / "sources/dm-docs"
manifest = json.loads((DEST / "_manifest.json").read_text())

def fm_of(md: Path):
    t = md.read_text()
    m = re.match(r"---\n(.*?)\n---", t, re.S)
    d = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                d[k.strip()] = v.strip()
    return d

areas = ["worldbuilding","kingdoms","cities","factions",
         "character-backstories","episode-prep","sidequests"]
# Spoiler areas/files are gitignored (local-only). This committed report shows
# only aggregate counts for them — never their filenames/contents.
SPOILER_AREAS = {"episode-prep", "sidequests"}
SPOILER_FILES = {"worldbuilding/anthology-notes.md",
                 "worldbuilding/vault-of-izzdar-notes.md",
                 "worldbuilding/campaign-2-log-for-the-boys.md"}
md_by_area = {a: [] for a in areas}
for md in sorted(DEST.rglob("*.md")):
    rel = md.relative_to(DEST)
    if rel.parts[0] in md_by_area:
        md_by_area[rel.parts[0]].append(md)

out = ["# DM Docs — Phase A coverage report",
       "",
       "Mechanical conversion of Jon's `Dungeon Master Docs` Drive dump into "
       "`sources/dm-docs/`. Text is committed; images/maps/raw binaries are gitignored "
       "(review locally). **No `canon/` changes yet** — that's Phase B.",
       ""]

# summary
counts = {}
for e in manifest:
    counts[e["action"]] = counts.get(e["action"], 0) + 1
out += ["## Summary", "", "| action | count |", "| --- | --- |"]
for k in sorted(counts):
    out.append(f"| {k} | {counts[k]} |")
out += ["| **pdf text-extracted (pypdf)** | 3 |",
        f"| **markdown docs landed (total)** | {sum(len(v) for v in md_by_area.values())} |", ""]

# per-area landed docs
out += ["## Landed markdown by area", ""]
for a in areas:
    docs = md_by_area[a]
    if not docs: continue
    if a in SPOILER_AREAS:
        out += [f"### {a} ({len(docs)}) — withheld",
                "", f"_{len(docs)} DM-prep docs converted but **gitignored (local-only)** "
                "to avoid spoilers. Filenames/contents intentionally omitted from this "
                "committed report. Phase B triages these into player-safe canon/ + a "
                "DM-only quarantine + a review packet for Jon._", ""]
        continue
    visible = [md for md in docs if str(md.relative_to(DEST)) not in SPOILER_FILES]
    hidden = len(docs) - len(visible)
    out.append(f"### {a} ({len(docs)})")
    out.append("")
    out.append("| file | dm_only | external | media |")
    out.append("| --- | --- | --- | --- |")
    for md in visible:
        d = fm_of(md)
        rel = md.relative_to(DEST)
        out.append(f"| `{rel}` | {d.get('dm_only','?')} | "
                   f"{d.get('external_reference','?')} | "
                   f"{'yes' if d.get('media_dir') else ''} |")
    if hidden:
        out.append(f"| _+{hidden} DM-prep doc(s) withheld (gitignored, local-only)_ | true | | |")
    out.append("")

# maps / image assets (gitignored)
maps = sorted((DEST/"maps").glob("*"))
map_files = [m for m in maps if m.is_file()]
out += ["## Map & image assets (gitignored — review locally)", "",
        f"{len(map_files)} files in `sources/dm-docs/maps/`. "
        "These are the maps + extracted slide/scan images. Naming is "
        "`<area>-<subfolder>--<original>`.", "",
        "Key world/region maps to review first:", ""]
priority = [m for m in map_files if any(k in m.name.lower() for k in
            ("world-map","alambor-labeled","kingdoms-and-provences",
             "carasian-kingdom-map","gidia","dalacia","parathia","maena"))]
for m in priority:
    out.append(f"- `{m.name}`")
out.append("")

# flags / decisions
out += ["## Flags & things to decide in Phase B", "",
        "- **External (non-canon) references** flagged `external_reference: true` "
        "(lich guides, Limithron naval-combat guide) — keep for DM use, exclude from wiki canon.",
        "- **Empty source file:** `Grillers 1.pdf` is 0 bytes in Jon's dump — ask Jon to re-share.",
        "- **Duplicate:** Harpers has `the-harpers-overview.md` + `the-harpers-overview-for-elliot.md` "
        "(player-specific). Prefer the canonical Overview; mine the For-Elliot variant for extras.",
        "- **`dm_only` is a first-pass guess by folder** (episode-prep/sidequests = true). "
        "Phase B refines per-section and isolates secrets under `## DM-only`.",
        "- **PDF maps/scans** (Surtree, Carstone, Grillers) kept as binaries in `maps/` for review.",
        "- **Real-world placeholder names** in Jon's docs (e.g. an NPC named after a real-world historical figure, the "
        "`Maena and Alambor Overlay`) — treat as DM inspiration; decide display names in Phase B.",
        ""]

(DEST/"COVERAGE.md").write_text("\n".join(out))
print(f"wrote {DEST/'COVERAGE.md'}  ({sum(len(v) for v in md_by_area.values())} md docs)")
