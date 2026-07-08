#!/usr/bin/env python3
"""Sync a canon episode's scene-art brief into scripts/gen/episodes.json.

scene_gen.py reads briefs from episodes.json, but the ingest pipeline authors a
new episode's scene brief into the episode frontmatter `art:` block (status:
pending). This bridges the two: it reads the frontmatter art block and
appends (or updates, idempotently) the matching brief object so
`scene_gen.py --slug <eNNN> --publish` can consume it.

Usage (run from scripts/gen/, gen venv):
    ./.venv/bin/python add_episode_brief.py e162
"""
import json
import sys
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit("usage: add_episode_brief.py <eNNN>")
    slug = sys.argv[1]
    md_path = REPO / "canon" / "episodes" / f"{slug}.md"
    if not md_path.exists():
        sys.exit(f"no canon episode: {md_path}")

    data = yaml.safe_load(md_path.read_text().split("---", 2)[1])
    art = data.get("art") or {}
    for req in ("visual", "scene_title", "key_entities"):
        if not art.get(req):
            sys.exit(f"{slug}: frontmatter art.{req} missing — author the brief first")

    brief = {
        "slug": slug,
        "episode": data.get("episode"),
        "title": data.get("title"),
        "has_candidate": True,
        "confidence": "high",
        "art_type": art.get("type", "scene"),
        "scene_title": art["scene_title"],
        "rationale": art.get("rationale", f"Ingest-authored scene brief for {slug}."),
        "visual": art["visual"].strip(),
        "key_entities": art["key_entities"],
        "collection": "episodes",
        "ref_images": [],
    }

    p = HERE / "episodes.json"
    briefs = json.load(open(p))
    idx = next((i for i, b in enumerate(briefs) if b["slug"] == slug), None)
    if idx is None:
        briefs.append(brief)
        action = "appended"
    else:
        briefs[idx] = brief
        action = "updated"
    p.write_text(json.dumps(briefs, indent=2, ensure_ascii=False) + "\n")
    print(f"{action} {slug}; episodes.json now {len(briefs)} briefs "
          f"(refs resolved at gen-time from key_entities: {brief['key_entities']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
