#!/usr/bin/env python3
"""Apply content-sanitization overrides to canon/.

Episode titles (and a few entity names) flow verbatim from the Google Doc into
canon/, so a manual edit there is undone on the next resync. This script re-applies
the rewrites recorded in title-overrides.yaml, and is meant to be run after every
resync/re-split. It is idempotent: running it twice changes nothing the second time.

Usage:
    python scripts/sanitize/apply_overrides.py            # apply + report
    python scripts/sanitize/apply_overrides.py --report   # show the map, change nothing
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CANON = ROOT / "canon"
MAP_PATH = Path(__file__).resolve().parent / "title-overrides.yaml"


def load_map() -> dict:
    with MAP_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def ordered_replacements(data: dict) -> list[tuple[str, str]]:
    """Phrase replacements first (compound names before short ones), then titles."""
    pairs: list[tuple[str, str]] = []
    for p in data.get("phrase_replacements", []):
        pairs.append((p["find"], p["replace"]))
    for _id, e in sorted(data.get("episode_titles", {}).items()):
        pairs.append((e["original"], e["sanitized"]))
    return pairs


def canon_files() -> list[Path]:
    return sorted([*CANON.rglob("*.md"), *CANON.rglob("*.yaml")])


def parse_episode_num(eid: str) -> tuple[int, bool]:
    """'e045' -> (45, False); 'e108-dup2' -> (108, True)."""
    body = eid[1:]
    return int(body.split("-")[0]), "-dup" in body


def set_placeholder_titles(data: dict) -> tuple[int, list[str]]:
    """Set a title for episodes that had none, BY ID (the empty markers aren't unique).

    Touches the frontmatter `title: null`, the `# ENN — untitled` heading, and the
    matching `(untitled)` cell in timeline.md. Idempotent.
    """
    placeholders = data.get("placeholder_titles", {})
    timeline = CANON / "timeline.md"
    tl_lines = timeline.read_text(encoding="utf-8").splitlines(keepends=True) if timeline.exists() else []
    set_count = 0
    notes: list[str] = []

    for eid, info in sorted(placeholders.items()):
        title = info["title"]
        num, is_dup = parse_episode_num(eid)
        changed = False

        path = CANON / "episodes" / f"{eid}.md"
        if path.exists():
            text = path.read_text(encoding="utf-8")
            new = text.replace("title: null", f"title: {title}", 1)
            new = re.sub(
                rf"^(# E{num} [—–-] )untitled[ \t]*$",
                lambda m: m.group(1) + title,
                new,
                count=1,
                flags=re.M,
            )
            if new != text:
                path.write_text(new, encoding="utf-8")
                changed = True
        else:
            notes.append(f"{eid}: episode file missing")

        token = f"E{num} (dup) " if is_dup else f"E{num} "
        for i, ln in enumerate(tl_lines):
            if ln.startswith(token) and "(untitled)" in ln:
                tl_lines[i] = ln.replace("(untitled)", title, 1)
                changed = True
                break

        if changed:
            set_count += 1
        else:
            notes.append(f"{eid}: nothing to set (already applied?)")

    if tl_lines:
        timeline.write_text("".join(tl_lines), encoding="utf-8")
    return set_count, notes


def apply(data: dict) -> int:
    pairs = ordered_replacements(data)
    counts = {find: 0 for find, _ in pairs}
    files_changed = 0

    for path in canon_files():
        text = path.read_text(encoding="utf-8")
        new = text
        for find, repl in pairs:
            if find in new:
                counts[find] += new.count(find)
                new = new.replace(find, repl)
        if new != text:
            path.write_text(new, encoding="utf-8")
            files_changed += 1

    # Placeholder titles for episodes that had none (set by id, after the text pass
    # so the timeline is re-read with any gist edits already applied).
    placeholders_set, placeholder_notes = set_placeholder_titles(data)

    # Glossary line removals.
    removed = 0
    glossary = CANON / "glossary.md"
    if glossary.exists():
        matches = [r["match"] for r in data.get("glossary_removals", [])]
        if matches:
            lines = glossary.read_text(encoding="utf-8").splitlines(keepends=True)
            kept = [ln for ln in lines if not any(m in ln for m in matches)]
            removed = len(lines) - len(kept)
            if removed:
                glossary.write_text("".join(kept), encoding="utf-8")

    # Report.
    print(f"Sanitization pass over {CANON.relative_to(ROOT)}/")
    print(f"  files modified : {files_changed}")
    print(f"  glossary lines removed : {removed}")
    titles = data.get("episode_titles", {})
    unmatched = []
    for _id, e in sorted(titles.items()):
        if counts.get(e["original"], 0) == 0:
            unmatched.append((_id, e["original"]))
    matched = len(titles) - len(unmatched)
    print(f"  episode titles rewritten : {matched}/{len(titles)}")
    print(f"  placeholder titles set : {placeholders_set}/{len(data.get('placeholder_titles', {}))}")
    for find, repl in [(p["find"], p["replace"]) for p in data.get("phrase_replacements", [])]:
        print(f"  phrase '{find}' -> '{repl}': {counts.get(find, 0)} hit(s)")
    if unmatched:
        print("\n  NOTE: these titles produced 0 replacements (already applied, or the")
        print("        source title changed and the map needs updating):")
        for _id, orig in unmatched:
            print(f"        {_id}: {orig!r}")
    skipped = [n for n in placeholder_notes if "already applied" not in n]
    if skipped:
        print("\n  NOTE (placeholders):")
        for n in skipped:
            print(f"        {n}")
    return 0


def report(data: dict) -> int:
    print("| ep | tier | original | -> sanitized |")
    print("|----|------|----------|--------------|")
    for _id, e in sorted(data.get("episode_titles", {}).items()):
        print(f"| {_id} | {e.get('tier','')} | {e['original']} | {e['sanitized']} |")
    for _id, e in sorted(data.get("placeholder_titles", {}).items()):
        print(f"| {_id} | placeholder | (untitled) | {e['title']} |")
    return 0


def main(argv: list[str]) -> int:
    data = load_map()
    if "--report" in argv:
        return report(data)
    return apply(data)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
