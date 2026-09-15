#!/usr/bin/env python3
"""Insert a validated `route:` or `recap:` into a canon episode's frontmatter.

One guarded writer so parallel agents can't each invent their own YAML surgery.
Idempotent: an episode that already has the field is left alone and reported SKIP.

Usage:
    python scripts/route/add_route.py e042 < route.yaml            # route, YAML on stdin
    python scripts/route/add_route.py --recap e042 < recap.txt     # recap, prose on stdin
    python scripts/route/add_route.py --check                      # validate every episode
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
EPISODES = ROOT / "canon" / "episodes"

KINDS = {"travel", "explore", "social", "combat", "commerce", "rest"}
REQUIRED = {"place", "kind", "beat"}
ALLOWED = REQUIRED | {"why", "when"}


def validate(route) -> list[str]:
    """Return a list of problems; empty means the block is good."""
    errs: list[str] = []
    if not isinstance(route, list) or not route:
        return ["route must be a non-empty list"]
    if len(route) > 8:
        errs.append(f"{len(route)} stations — the format tops out around 6")
    for i, s in enumerate(route, 1):
        at = f"station {i}"
        if not isinstance(s, dict):
            errs.append(f"{at}: not a mapping")
            continue
        missing = REQUIRED - s.keys()
        if missing:
            errs.append(f"{at}: missing {', '.join(sorted(missing))}")
        extra = s.keys() - ALLOWED
        if extra:
            errs.append(f"{at}: unknown key(s) {', '.join(sorted(extra))}")
        if s.get("kind") not in KINDS:
            errs.append(f"{at}: kind {s.get('kind')!r} not in {sorted(KINDS)}")
        for field in ("place", "beat", "why"):
            v = s.get(field)
            if isinstance(v, str) and ("*" in v or "**" in v or "_" in v.strip("_")):
                if "*" in v:
                    errs.append(f"{at}: {field} contains markdown emphasis — plain text only")
        beat = s.get("beat")
        if isinstance(beat, str) and len(beat.split()) > 8:
            errs.append(f"{at}: beat is {len(beat.split())} words — keep it to ~6")
    return errs


def split_frontmatter(text: str) -> tuple[str, str]:
    """-> (frontmatter_text, rest_including_delimiters). Raises if malformed."""
    if not text.startswith("---\n"):
        raise ValueError("no frontmatter")
    end = text.index("\n---\n", 3)
    return text[4:end + 1], text[end + 1:]


def insert(eid: str, route_yaml: str) -> str:
    path = EPISODES / f"{eid}.md"
    if not path.exists():
        return f"FAIL {eid}: no such episode file"

    text = path.read_text(encoding="utf-8")
    try:
        fm_text, rest = split_frontmatter(text)
    except ValueError as e:
        return f"FAIL {eid}: {e}"

    fm = yaml.safe_load(fm_text) or {}
    if fm.get("route"):
        return f"SKIP {eid}: already has {len(fm['route'])} stations"

    try:
        parsed = yaml.safe_load(route_yaml)
    except yaml.YAMLError as e:
        return f"FAIL {eid}: route YAML does not parse — {e}"
    if isinstance(parsed, dict) and "route" in parsed:
        parsed = parsed["route"]

    errs = validate(parsed)
    if errs:
        return f"FAIL {eid}: " + "; ".join(errs)

    # Re-emit from the parsed structure so indentation/quoting is always canonical.
    block = yaml.safe_dump(
        {"route": parsed}, sort_keys=False, allow_unicode=True, width=100, default_flow_style=False
    )

    # Keep the long `art:` block last; otherwise append to the end of frontmatter.
    if "\nart:\n" in fm_text:
        new_fm = fm_text.replace("\nart:\n", "\n" + block + "art:\n", 1)
    else:
        new_fm = fm_text.rstrip("\n") + "\n" + block

    new_text = "---\n" + new_fm + rest
    # Paranoia: the whole frontmatter must still parse before we touch disk.
    try:
        yaml.safe_load(split_frontmatter(new_text)[0])
    except Exception as e:
        return f"FAIL {eid}: insertion broke the frontmatter — {e}"

    path.write_text(new_text, encoding="utf-8")
    return f"OK   {eid}: {len(parsed)} stations"



# ── recap ────────────────────────────────────────────────────────────────────
# The plain-language catch-up (3–5 sentences) that sits above the dense Summary.

RECAP_MIN, RECAP_MAX = 250, 1400


def validate_recap(text: str) -> list[str]:
    errs: list[str] = []
    t = (text or "").strip()
    if not t:
        return ["recap is empty"]
    if len(t) < RECAP_MIN:
        errs.append(f"{len(t)} chars — too short, aim for 3–5 real sentences")
    if len(t) > RECAP_MAX:
        errs.append(f"{len(t)} chars — too long, this is a catch-up not a summary")
    if "*" in t or "_" in t or "#" in t:
        errs.append("contains markdown — plain text only")
    if "\n" in t:
        errs.append("contains a newline — write one paragraph, the template wraps it")
    sentences = [x for x in t.replace("!", ".").replace("?", ".").split(".") if x.strip()]
    if len(sentences) < 3:
        errs.append(f"{len(sentences)} sentence(s) — aim for 3–5")
    if len(sentences) > 7:
        errs.append(f"{len(sentences)} sentences — trim to 3–5")
    return errs


def insert_recap(eid: str, text: str) -> str:
    path = EPISODES / f"{eid}.md"
    if not path.exists():
        return f"FAIL {eid}: no such episode file"
    raw = path.read_text(encoding="utf-8")
    try:
        fm_text, rest = split_frontmatter(raw)
    except ValueError as e:
        return f"FAIL {eid}: {e}"

    fm = yaml.safe_load(fm_text) or {}
    if fm.get("recap"):
        return f"SKIP {eid}: already has a recap"

    t = " ".join((text or "").split())  # collapse any wrapping the agent introduced
    errs = validate_recap(t)
    if errs:
        return f"FAIL {eid}: " + "; ".join(errs)

    block = yaml.safe_dump(
        {"recap": t}, sort_keys=False, allow_unicode=True, width=96, default_flow_style=False
    )

    # Sits just above `route:` when there is one, else above `art:`, else appended.
    if "\nroute:\n" in fm_text:
        new_fm = fm_text.replace("\nroute:\n", "\n" + block + "route:\n", 1)
    elif "\nart:\n" in fm_text:
        new_fm = fm_text.replace("\nart:\n", "\n" + block + "art:\n", 1)
    else:
        new_fm = fm_text.rstrip("\n") + "\n" + block

    new_text = "---\n" + new_fm + rest
    try:
        back = yaml.safe_load(split_frontmatter(new_text)[0])
        assert back.get("recap", "").strip() == t
    except Exception as e:
        return f"FAIL {eid}: insertion broke the frontmatter — {e}"

    path.write_text(new_text, encoding="utf-8")
    return f"OK   {eid}: recap, {len(t)} chars"


def check_all() -> int:
    bad = 0
    missing = []
    for path in sorted(EPISODES.glob("[!_]*.md")):
        eid = path.stem
        try:
            fm = yaml.safe_load(split_frontmatter(path.read_text(encoding="utf-8"))[0]) or {}
        except Exception as e:
            print(f"FAIL {eid}: unreadable frontmatter — {e}")
            bad += 1
            continue
        route = fm.get("route")
        if not route:
            missing.append(eid)
            continue
        errs = validate(route)
        if errs:
            print(f"FAIL {eid}: " + "; ".join(errs))
            bad += 1
    no_recap = []
    for path in sorted(EPISODES.glob("[!_]*.md")):
        try:
            fm = yaml.safe_load(split_frontmatter(path.read_text(encoding="utf-8"))[0]) or {}
        except Exception:
            continue
        r = fm.get("recap")
        if not r:
            no_recap.append(path.stem)
            continue
        errs = validate_recap(r)
        if errs:
            print(f"FAIL {path.stem} (recap): " + "; ".join(errs))
            bad += 1
    print(f"\n{len(missing)} episode(s) with no route: {' '.join(missing) if missing else '—'}")
    print(f"{len(no_recap)} episode(s) with no recap: {' '.join(no_recap) if no_recap else '—'}")
    print(f"{bad} episode(s) with an invalid route/recap")
    return 1 if bad else 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(check_all())
    if "--recap" in sys.argv:
        args = [a for a in sys.argv[1:] if a != "--recap"]
        if not args:
            sys.exit(__doc__)
        print(insert_recap(args[0], sys.stdin.read()))
        sys.exit(0)
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    print(insert(sys.argv[1], sys.stdin.read()))
