#!/usr/bin/env python3
"""Convert the three DM-review markdown docs into discrete spreadsheet rows (CSV).

Outputs (canon/_review-sheets/):
  - questionnaire.csv          one row per lore question, blank answer columns
  - spelling-conflicts.csv     one row per spelling conflict
  - FOR-JON--spoiler-review.csv   one row per spoiler item  (GITIGNORED — private)

Import each CSV as a tab in Google Sheets so Jon answers in discrete cells.
Re-run any time the source markdown changes. Faithful extraction, no rewriting.
"""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANON = ROOT / "canon"
OUT = CANON / "_review-sheets"
OUT.mkdir(exist_ok=True)


def strip_md(s: str) -> str:
    s = s.replace("**", "").replace("`", "")
    return re.sub(r"\s+", " ", s).strip()


def convert_questionnaire():
    src = (CANON / "dm-questionnaire.md").read_text()
    lines = src.splitlines()
    section = ""
    group = ""
    rows = []
    block = None  # (num, [lines])
    q_start = re.compile(r"^\*\*(W?\d+)\.\s*(.*)$")        # **1. ... / **W1. ...
    q_start_plain = re.compile(r"^(\d+)\.\s+(.*)$")          # 30. ... (section 3)

    def flush():
        if not block:
            return
        num, buf = block
        # The answer marker is a → at the START of a line; arrows inside the
        # question or answer prose (e.g. "Zook → Evac", "texerine → texere") are mid-line.
        split = next((i for i, l in enumerate(buf) if l.strip().startswith("→")), None)
        if split is None:
            ask, ans = " ".join(buf), ""
        else:
            ask = " ".join(buf[:split])
            ans = " ".join([buf[split].strip()[1:]] + buf[split + 1:])
        ask = ask.strip().rstrip("→ ").strip()          # drop a trailing inline → marker
        rows.append([section, group, num, strip_md(ask), strip_md(ans), "", ""])

    for ln in lines:
        if ln.startswith("## "):
            flush(); block = None
            section = strip_md(ln[3:]); group = ""
            continue
        if ln.startswith("### "):
            flush(); block = None
            group = strip_md(ln[4:])
            continue
        if set(ln.strip()) <= {"-"} and ln.strip():        # horizontal rule "---"
            continue
        if re.match(r"^\*[^*].*\*\s*$", ln.strip()):        # italic-only footer line
            continue
        m = q_start.match(ln) or q_start_plain.match(ln)
        if m:
            flush()
            block = (m.group(1), [m.group(2)])
        elif re.match(r"^\*\*[^0-9*].*\*\*:?\s*$", ln):     # fully-bold standalone label = group
            flush(); block = None
            group = strip_md(ln)
        elif block is not None:
            block[1].append(ln)
    flush()

    out = OUT / "questionnaire.csv"
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Section", "Group", "#", "Question / my assumption",
                    "Pre-filled (from DM docs)", "Jon: yes / no / ?", "Correction if no"])
        w.writerows(rows)
    return len(rows), out


def convert_spelling():
    src = (CANON / "_spelling-conflicts.md").read_text()
    rows = []
    for ln in src.splitlines():
        if not ln.strip().startswith("|"):
            continue
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        if len(cells) < 5:
            continue
        if cells[0].lower() == "entity" or set(cells[0]) <= {"-", " ", ":"}:
            continue                                          # header / separator
        rows.append([strip_md(cells[0]), strip_md(cells[1]), strip_md(cells[2]),
                     strip_md(cells[3]), "", ""])
    out = OUT / "spelling-conflicts.csv"
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Entity", "Variants Jon used", "Chosen canonical",
                    "Where they disagree", "Jon: confirm? (y/n)", "Correction"])
        w.writerows(rows)
    return len(rows), out


def convert_spoiler():
    p = CANON / "FOR-JON--spoiler-review.md"
    if not p.exists():
        return 0, None
    lines = p.read_text().splitlines()
    section = ""
    rows = []
    cur = None  # dict
    item_hdr = re.compile(r"^### ([A-Z]\d+)\.\s*(.*)$")
    field = re.compile(r"^\s*-\s*\*\*([^:*]+):\*\*\s*(.*)$")

    def flush():
        if cur:
            rows.append([section, cur["id"], cur["title"], cur.get("Source", ""),
                         cur.get("Content", ""), cur.get("Reason held back", ""),
                         cur.get("Confidence", ""), cur.get("ASK", ""), ""])

    for ln in lines:
        sm = re.match(r"^## ([A-Z])\.\s*(.*)$", ln)
        if sm:
            flush(); cur = None
            section = f"{sm.group(1)} — {strip_md(sm.group(2))}"
            continue
        im = item_hdr.match(ln)
        if im:
            flush()
            cur = {"id": im.group(1), "title": strip_md(im.group(2))}
            continue
        fm = field.match(ln)
        if fm and cur is not None:
            cur[fm.group(1).strip()] = strip_md(fm.group(2))
    flush()

    out = OUT / "FOR-JON--spoiler-review.csv"
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Section", "Item", "Title", "Source", "Flagged content",
                    "Reason held back", "Confidence", "ASK", "Jon's decision"])
        w.writerows(rows)
    return len(rows), out


if __name__ == "__main__":
    for fn in (convert_questionnaire, convert_spelling, convert_spoiler):
        n, out = fn()
        if out:
            print(f"{out.relative_to(ROOT)}: {n} rows")
        else:
            print(f"{fn.__name__}: source not found, skipped")
