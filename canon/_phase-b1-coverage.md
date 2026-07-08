# Phase B1 coverage report — DM-docs ingest

> Spoiler-free summary of the Phase B1 ingest of Jon's authoritative worldbuilding docs (`sources/dm-docs/`) into `canon/`. Counts only — no DM-only content. (Quarantined/DM-only items live in the gitignored `canon/FOR-JON--spoiler-review.md` packet and are referenced here by count only.)

## Source docs processed

- `sources/dm-docs/` holds **87** converted `.md` docs across `character-backstories/` (11), `cities/` (16), `factions/` (4), `kingdoms/` (5), `maps/` (4), `worldbuilding/` (5), `episode-prep/` (38), and `sidequests/` (3).
- Phase B1 focused on the **kingdoms, cities, factions, and core worldbuilding** docs (the player-safe lore tier). Episode-prep and sidequest prep were treated as DM-only and not converted into canon prose.

## New canon tier added: `canon/kingdoms/`

Five top-level kingdom dossiers created (each renamed from the prior `locations/` stub and enriched from Jon's kingdom docs, with `sources:` provenance, `art.has_visual_source`, and `dm_only: false`):

- `kingdoms/gidian-empire.md`
- `kingdoms/carasian-kingdom.md`
- `kingdoms/luzonovian-sovereignty.md`
- `kingdoms/parathia.md`
- `kingdoms/islands-of-maadolonia.md`

## Files created vs. enriched

**Created (6 canon files + 1 conflicts log):**
- `worldbuilding/the-sundering-and-the-gift.md` (new `canon/worldbuilding/` tier)
- `locations/carstone.md`, `locations/feldbruk.md`, `locations/grillers.md`
- `items/pierres-pocket-book.md`
- `_spelling-conflicts.md` (Jon-vs-Jon conflict log)

**Enriched (existing dossiers updated from DM docs):**
- Factions (5): `archivists.md`, `harpers.md`, `knights-of-gidia.md`, `vithian-alliance.md`, `volstruckers.md`
- Locations (5): `dalacia.md`, `goldcrest.md`, `kirkenwall.md`, `tarleaf.md`, `vallon.md`
- `glossary.md`, `timeline.md`, `dm-questionnaire.md` (reconcile pass)

## Spelling promotions (canonical flips per "Jon's prose wins" decision)

Six dossier renames (`git mv` + glossary canonical flip; old spelling demoted to alias):
- `locations/gidia.md` → `kingdoms/gidian-empire.md`
- `locations/carasia.md` → `kingdoms/carasian-kingdom.md`
- `locations/luzonovia.md` → `kingdoms/luzonovian-sovereignty.md`
- `locations/paratha.md` → `kingdoms/parathia.md`
- `locations/mandalonia.md` → `kingdoms/islands-of-maadolonia.md`
- `locations/sultray.md` → `locations/surtree.md`

Additional glossary-only canonical flips (no separate dossier rename required): Grellier → **Grillers**, Feldbrook → **Feldbruk**, Rupert the Young → **Ruprecht the Young**.

## Self-conflicts logged (Jon vs. Jon)

Nine author-vs-author spelling conflicts recorded in `_spelling-conflicts.md` for Jon to confirm, including:
- **Kirkenwall** vs. Kierkenwall / Kierkewall / Kierkenwald (kept Kirkenwall — entrenched + map asset)
- **Tarleaf** vs. Tarlif / Tarilif (kept Tarleaf — entrenched in play; NOT promoted)
- **Surtree** vs. Surterre / Sutree, **Strathmore** vs. Stathmore, **Wintervale** vs. Wintervail
- **Luzonovia** vs. Luzanovia / Luzonivia, **Islands of Maadolonia** vs. Maadolinia / Maandolin
- **Grillers** vs. Grelliers, **Ruprecht the Young** vs. Rupert, **Queen Beatrice** vs. Beatris Lionsblood

Two entrenched canonicals (**Kirkenwall**, **Tarleaf**) were deliberately NOT renamed despite Jon's prose; flagged for his call.

## Glossary alias additions (reconcile pass)

Alias additions applied across **18** glossary entries (locations, factions, NPCs) — new aliases drawn from Jon's docs (province names, in-world short forms, settlement names, order/site names). No aliases removed; all prior aliases and the pre-approved canonical promotions preserved.

## Questionnaire

- Added **Section 0 — Worldbuilding facts established from Jon's docs**: **7** big-picture answers locked in with cited evidence (Trine founding/Council of Reckoning, capitals, vassal states, the Archivists, national militaries, pirate Trinity, transmutation/texere).
- Opportunistically filled **4** of the existing 55 lore-check questions where the docs gave clear evidence (Q5 Linxes, Q14 Balom=Vallon, Q24 Great Calamity=Sundering, Q25 Alborama=Arbor Alma).
- The remaining entity-merge coin-flips were left untouched/flagged for Jon.

## Timeline

Added a brief **"World history (pre-campaign anchors)"** block (the Sundering, 17 P.T. Council of Reckoning / founding of the Trine, vassal-conquest dates). No invented session events; per-episode lines unchanged.

## DM-only items routed to the spoiler-review packet

**9** consolidated DM-only / flag items routed to the gitignored `canon/FOR-JON--spoiler-review.md`:
- **6** high-confidence quarantine items (dungeon-design reskins, opening-arc prep, real-world placeholder names / map overlay, a drafting artifact).
- **3** medium-confidence "needs yes/no" items (deep royal lineage, full pirate roster + treasure caches, unvisited Parathian features).
- Plus **5** real-world placeholder names mapped to recommended in-world display names.

No DM-only content was written into committed `canon/`. Fail-safe: when unsure, left out and flagged.
