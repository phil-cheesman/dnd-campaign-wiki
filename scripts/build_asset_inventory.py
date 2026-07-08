#!/usr/bin/env python3
"""Inventory every image asset in the repo and map it to canon entities.

Emits:
  - assets/inventory.json   full machine-readable inventory (all images, incl. spoiler areas)
  - assets/INVENTORY.md     committed-safe human report (spoiler-area filenames redacted)

Purpose: find which canon entities already have candidate reference art (skip AI gen)
vs. which still need a ref sourced, so the Phase-2 image pipeline can wire `art.ref_images`.
"""
import json, re, subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CANON = REPO / "canon"
ASSETS = REPO / "assets"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".bmp", ".tiff"}
SKIP_DIRS = {".git", "node_modules", "_raw", ".vscode"}
# Mirror the established DM-docs spoiler policy (see scripts/ingest/coverage_report.py):
# these areas are gitignored / DM-only; never leak their filenames in committed artifacts.
SPOILER_TOKENS = ("episode-prep", "sidequests", "vault-of-izzdar", "vault-of-izdar",
                  "anthology-notes")

CANON_KINDS = ["characters", "npcs", "locations", "factions", "items"]
NOISE_TOKENS = {"the", "of", "and", "a", "an", "city", "kingdom", "kingdoms", "cities",
                "notes", "overview", "backstory", "backstories", "media", "map", "maps",
                "info", "background", "player", "details", "for", "character", "worldbuilding"}


def fm(md: Path):
    """Parse YAML-ish frontmatter (name + aliases) without a yaml dep."""
    t = md.read_text(errors="ignore")
    m = re.match(r"---\n(.*?)\n---", t, re.S)
    name, aliases = md.stem, []
    if m:
        for line in m.group(1).splitlines():
            if line.startswith("name:"):
                name = line.split(":", 1)[1].strip().strip('"')
            elif line.startswith("aliases:"):
                raw = line.split(":", 1)[1].strip().strip("[]")
                aliases = [a.strip().strip('"') for a in raw.split(",") if a.strip()]
    return name, aliases


def load_entities():
    ents = []
    for kind in CANON_KINDS:
        d = CANON / kind
        if not d.exists():
            continue
        for md in sorted(d.glob("*.md")):
            name, aliases = fm(md)
            # token bag for matching: slug + display name + aliases
            bag = set()
            for s in [md.stem, name, *aliases]:
                bag |= {w for w in re.split(r"[^a-z0-9]+", s.lower()) if w and w not in NOISE_TOKENS}
            ents.append({"slug": md.stem, "kind": kind, "name": name, "tokens": bag})
    return ents


def categorize(rel: str):
    p = rel.lower()
    if p.startswith("refs/"):
        return "reference"  # curated, entity-anchored reference art (refs/<slug>/...)
    if "/maps/" in p or p.startswith("canon/maps") or "world-map" in p:
        return "map"
    if "character-backstor" in p:
        return "pc-avatar"
    if "factions-" in p or "/factions" in p:
        return "faction"
    if "kingdoms-" in p or "cities-" in p:
        return "location"
    if "/design/" in p:
        return "design"
    return "world-art"


def match_entity(folder_slug: str, ents):
    """Best canon-entity guess by token overlap with the source folder name."""
    ftoks = {w for w in re.split(r"[^a-z0-9]+", folder_slug.lower()) if w and w not in NOISE_TOKENS}
    if not ftoks:
        return None, 0.0
    best, best_score = None, 0.0
    for e in ents:
        overlap = ftoks & e["tokens"]
        if not overlap:
            continue
        # score: fraction of the (smaller) entity token bag matched, weighted by overlap size
        score = len(overlap) / max(1, min(len(e["tokens"]), len(ftoks)))
        if len(overlap) >= 1 and score > best_score:
            best, best_score = e, score
    return (best, round(best_score, 2)) if best else (None, 0.0)


def dims(path: Path):
    try:
        out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
                             capture_output=True, text=True, timeout=15).stdout
        w = re.search(r"pixelWidth:\s*(\d+)", out)
        h = re.search(r"pixelHeight:\s*(\d+)", out)
        return (int(w.group(1)), int(h.group(1))) if w and h else (None, None)
    except Exception:
        return (None, None)


def main():
    ents = load_entities()
    images = []
    for p in REPO.rglob("*"):
        if p.is_dir() or p.suffix.lower() not in IMAGE_EXTS:
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        rel = str(p.relative_to(REPO))
        folder = p.parent.name
        # the meaningful "doc slug" is usually the grandparent (…/<doc-slug>/media/img.png)
        doc_slug = p.parent.parent.name if folder == "media" else folder
        spoiler = any(tok in rel.lower() for tok in SPOILER_TOKENS)
        cat = categorize(rel)
        if cat == "reference":
            # refs/<slug>/ — the folder name IS the canonical slug; require an exact match
            # rather than fuzzy-grabbing a neighbor (a miss means the entity needs creating).
            hit = next((e for e in ents if e["slug"] == doc_slug), None)
            ent, score = (hit, 1.0) if hit else (None, 0.0)
        else:
            ent, score = match_entity(doc_slug, ents)
        w, h = dims(p)
        images.append({
            "path": rel,
            "category": cat,
            "doc_slug": doc_slug,
            "entity": ent["slug"] if ent else None,
            "entity_kind": ent["kind"] if ent else None,
            "match_score": score,
            "width": w, "height": h,
            "kb": round(p.stat().st_size / 1024),
            "spoiler": spoiler,
        })

    images.sort(key=lambda x: (x["category"], x["entity"] or "~", x["path"]))
    ASSETS.mkdir(exist_ok=True)
    (ASSETS / "inventory.json").write_text(json.dumps(images, indent=2))

    # ---- committed-safe markdown report ----
    by_cat = {}
    for im in images:
        by_cat.setdefault(im["category"], []).append(im)

    # entity coverage (non-spoiler candidates only — a public-safe signal)
    cover = {e["slug"]: {"kind": e["kind"], "name": e["name"], "n": 0} for e in ents}
    for im in images:
        if im["entity"] and not im["spoiler"]:
            cover[im["entity"]]["n"] += 1

    L = ["# Asset inventory", "",
         f"Auto-generated by `scripts/build_asset_inventory.py`. **{len(images)}** images total.",
         "Spoiler-area (DM-only) filenames are redacted per repo policy; only counts shown.",
         "", "## By category", "", "| Category | Count | Spoiler-area |", "|---|---|---|"]
    for cat in sorted(by_cat):
        rows = by_cat[cat]
        L.append(f"| {cat} | {len(rows)} | {sum(r['spoiler'] for r in rows)} |")

    L += ["", "## Canon entity coverage (candidate refs, non-spoiler)", "",
          "Entities with **0** candidates still need a reference sourced (or AI-gen from text).",
          "", "| Entity | Kind | Candidate images |", "|---|---|---|"]
    for slug in sorted(cover, key=lambda s: (cover[s]["kind"], s)):
        c = cover[slug]
        flag = "" if c["n"] else " ⚠️ needs ref"
        L.append(f"| {c['name']} (`{slug}`) | {c['kind']} | {c['n']}{flag} |")

    miss = sum(1 for c in cover.values() if c["n"] == 0)
    L.insert(5, f"Coverage: **{len(cover) - miss}/{len(cover)}** canon entities have ≥1 candidate; "
                f"**{miss}** still need a ref.\n")
    (ASSETS / "INVENTORY.md").write_text("\n".join(L) + "\n")

    print(f"Wrote assets/inventory.json ({len(images)} images) and assets/INVENTORY.md")
    print(f"Entity coverage: {len(cover) - miss}/{len(cover)} have a candidate, {miss} need a ref.")


if __name__ == "__main__":
    main()
