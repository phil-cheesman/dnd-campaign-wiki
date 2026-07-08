#!/usr/bin/env python3
"""Resolve free-text entity names (from episode briefs' key_entities) to the
canonical dossier: slug, collection, the locked visual descriptor, and the
full-res reference master we generated in Phase 2.

This is what lets episode SCENE art TIE INTO the existing gallery instead of
re-summarizing notes: for every person/place/thing named in a scene we pull
(a) its canonical look (so colors/features are right — Arbor Alma is purple-leaf
white-bark, not lime-green) and (b) its actual reference image (so the model
composes the SAME character/monster/item into the scene, not a lookalike).

Sources, in priority order for the descriptor:
  1. canon/<collection>/<slug>.md frontmatter art.visual (the locked prompt text)
  2. glossary.md headword descriptor line (covers entities with no dossier/art,
     e.g. Arbor Alma, one-off monsters)

Reference image = art-originals/<collection>/<slug>.png (full-res master, gitignored).
We upload masters, not the committed WebP, for best fidelity.

Usage (debug):
  python entity_index.py "Quinton Shackleford" "Arbor Alma" "Marquise Avesy"
"""
import re
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent.parent
CANON = REPO / "canon"
MASTERS = REPO / "art-originals"

# honorifics/titles stripped when normalizing for a match (kept in display name)
TITLES = {
    "sir", "lord", "lady", "king", "queen", "prince", "princess", "captain",
    "marquise", "marquis", "viscount", "viscountess", "baron", "baroness",
    "count", "countess", "high", "chancellor", "rector", "architect", "mag",
    "the", "general", "admiral", "master", "father", "mother",
}


def normalize(s: str) -> str:
    s = s.lower().strip()
    s = s.replace("’", "'")
    s = re.sub(r"\([^)]*\)", " ", s)        # drop parentheticals
    s = re.sub(r'["“”]', " ", s)   # drop quotes
    s = re.sub(r"[^a-z0-9' ]+", " ", s)      # punctuation -> space
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _strip_titles(norm: str) -> str:
    toks = [t for t in norm.split(" ") if t not in TITLES]
    return " ".join(toks).strip()


def _variants(name: str):
    n = normalize(name)
    out = {n, _strip_titles(n)}
    # also a no-apostrophe form (Zuk'taal -> zuktaal) to match slugs
    out |= {v.replace("'", "") for v in list(out)}
    return {v for v in out if v}


def _split_frontmatter(path: Path):
    txt = path.read_text(encoding="utf-8")
    if not txt.startswith("---"):
        return {}, txt
    end = txt.find("\n---", 3)
    if end == -1:
        return {}, txt
    raw = txt[3:end].strip()
    try:
        fm = yaml.safe_load(raw) or {}
    except Exception:
        fm = {}
    return fm, txt


def _glossary_descriptors():
    """headword/alias -> short descriptor from glossary.md bullet lines.

    Line shape: `- **Name** (...) — descriptor sentence. Aliases: a, b. Episodes: ...`
    """
    g = CANON / "glossary.md"
    out = {}
    if not g.exists():
        return out
    for line in g.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*-\s+\*\*(.+?)\*\*(.*)", line)
        if not m:
            continue
        head, rest = m.group(1), m.group(2)
        # descriptor = text after the first em/en dash, trimmed of Aliases/Episodes tails
        dm = re.search(r"[—–-]\s*(.+)", rest)
        desc = dm.group(1).strip() if dm else ""
        desc = re.split(r"\s*Aliases:|\s*Episodes:", desc)[0].strip().rstrip(".")
        names = [head]
        am = re.search(r"Aliases:\s*(.+?)(?:\.\s*Episodes:|$)", rest)
        if am:
            names += [a.strip() for a in am.group(1).split(",") if a.strip()]
        for nm in names:
            for v in _variants(nm):
                out.setdefault(v, desc)
    return out


class Index:
    def __init__(self):
        self.by_key = {}          # normalized name/alias -> record
        self.tokens = []          # [(token_set, record)] for subset fallback
        self.gloss = _glossary_descriptors()
        self.gloss_tokens = [(set(k.split()), v) for k, v in self.gloss.items()]
        self._load_dossiers()

    def _load_dossiers(self):
        for md in CANON.glob("*/*.md"):
            if md.name.startswith("_"):
                continue
            collection = md.parent.name
            fm, _ = _split_frontmatter(md)
            if not isinstance(fm, dict) or "name" not in fm:
                continue
            slug = md.stem
            art = fm.get("art") or {}
            master = MASTERS / collection / f"{slug}.png"
            rec = {
                "slug": slug,
                "collection": collection,
                "name": fm.get("name", slug),
                "visual": (art.get("visual") or "").strip(),
                "art_type": art.get("type"),
                "has_art": art.get("status") == "generated" and master.exists(),
                "master": str(master) if master.exists() else None,
            }
            names = [fm.get("name", "")] + list(fm.get("aliases") or [])
            tokset = set()
            for nm in names:
                for v in _variants(nm):
                    # first writer wins, but prefer records that actually have art
                    if v not in self.by_key or (rec["has_art"] and not self.by_key[v]["has_art"]):
                        self.by_key[v] = rec
                    tokset |= set(v.split())
            tokset -= TITLES
            if tokset:
                self.tokens.append((tokset, rec))

    def resolve(self, name: str):
        """Return a dict with name + descriptor (+ master ref if any), or None."""
        for v in _variants(name):
            if v in self.by_key:
                r = dict(self.by_key[v])
                if not r["visual"]:
                    for vv in _variants(name):
                        if vv in self.gloss:
                            r["visual"] = self.gloss[vv]
                            break
                r["display"] = name
                return r
        # token-subset fallback: every query token (minus titles) present in a record
        qt = set(_strip_titles(normalize(name)).split())
        if qt:
            hits = [rec for ts, rec in self.tokens if qt <= ts]
            if hits:
                hits.sort(key=lambda r: (not r["has_art"], len(r["name"])))
                r = dict(hits[0])
                if not r["visual"]:
                    for ts, desc in self.gloss_tokens:
                        if qt <= ts:
                            r["visual"] = desc
                            break
                r["display"] = name
                return r
        # no dossier — glossary descriptor only (exact, then token-subset)
        for v in _variants(name):
            if v in self.gloss:
                return {"slug": None, "collection": None, "name": name,
                        "display": name, "visual": self.gloss[v],
                        "art_type": None, "has_art": False, "master": None}
        if qt:
            for ts, desc in self.gloss_tokens:
                if qt <= ts:
                    return {"slug": None, "collection": None, "name": name,
                            "display": name, "visual": desc,
                            "art_type": None, "has_art": False, "master": None}
        return None


if __name__ == "__main__":
    idx = Index()
    for q in sys.argv[1:]:
        r = idx.resolve(q)
        if not r:
            print(f"  {q!r:30} -> UNRESOLVED")
        else:
            ref = "REF " + r["master"].split("/art-originals/")[-1] if r["master"] else "no-ref"
            print(f"  {q!r:30} -> {r['slug'] or '(glossary)':22} [{ref}]  {r['visual'][:70]}")
