# Phase B2 coverage report — DM-prep triage

> Spoiler-free summary of the Phase B2 ingest of Jon's RAW episode-prep + sidequest docs (`sources/dm-docs/episode-prep/`, `sources/dm-docs/sidequests/`, plus the remaining worldbuilding/faction prep). **Counts only** — this file is committed/public-bound, so it contains NO DM-only content and NO episode-specific spoilers. All rich/unrevealed prep was routed to the gitignored quarantine (`canon/_dm-only/`) and the gitignored review packet (`canon/FOR-JON--spoiler-review.md`), both local-only.

## Gate principle

A prep fact was written into **committed** `canon/` only if the players have demonstrably **already experienced/learned** it in actual play at or before the current play edge (~E161). Prep = what Jon *planned*; it routinely diverges from what happened. When unsure, the fact was classified DM-only (fail-safe quarantine). It is far worse to leak a spoiler into committed canon than to over-quarantine.

## Docs triaged

- **44** DM-prep docs triaged in this batch (episode-prep + sidequest tier + remaining faction/worldbuilding prep).
- **2** docs EXCLUDED as external/3rd-party (`external_reference: true`) — never enter canon:
  - `sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/a-complete-guide-to-lichdom.md` — generic published-5e lichdom guide (phylactery crafting, transformation potion, Orcus/archdevil-pact lore from published modules). Zero Alambor-specific facts.
  - `sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/lich.md` — body is only embedded images of a 3rd-party "lich" infographic/stat-block guide; no campaign text.
- **EXCLUDE-AS-EMBEDDED 3rd-party blocks inside internal prep** (host file is internal but these blocks are handled like external_reference and kept out of canon): the Tomb-of-Annihilation / 5e.tools reskin content in `vault-of-izzdar-notes.md`; the Critical Role Uk'otoa fandom-wiki and Avernus fandom-wiki pastes in `anthology-notes.md`; the Worst-Witch potion-ingredient list and the rpgtinker.com statblock in `anthology-notes.md`; the two randroll.com Shadowfell encounter tables in `episode-114-the-vermelock.md`; the Forgotten-Realms-wiki "Description" block in `episode-120-125-the-shadowfell.md`; the 5esrd.com Shadow Captain stat block in the Knights-of-Thadun docs; and the verbatim published-5e Dawn War pantheon "commandments" text in `annals-of-the-kings-rulers-and-gods-pre-sundering.md`.
- **NOTE:** the Limithron naval guide named in the brief as an external 3rd-party guide was not present among the docs in this batch; flagged for exclusion if/when encountered.

## Quarantine written (gitignored, local-only)

- **57** entity-organized DM-only dossiers under `canon/_dm-only/` (the rich, thorough prep truth — villain origins/interiority, dungeon solutions & layouts, statblocks, unrevealed identities, future/endgame-arc material, relic-vessel design, and DM meta/real-world-reskin names). None of this is tracked by git.

## Committed backfill (gate-confirmed, player-experienced facts only)

- **9** committed `canon/` files received an appended, clearly-labeled `## From DM prep (?)` section containing ONLY facts the gate confirmed players had already experienced/learned by the play edge. Every bullet is marked `(?)` (prep can diverge from play). Files touched:
  - `canon/characters/quinton.md`
  - `canon/locations/surtree.md`
  - `canon/episodes/e009.md`
  - `canon/episodes/e108.md`
  - `canon/episodes/e110.md`
  - `canon/episodes/e116.md`
  - `canon/episodes/e129.md`
  - `canon/episodes/e136.md`
  - `canon/episodes/e159.md`
- One `sources:` provenance addition (`canon/locations/surtree.md`) for the anthology prep doc.

## Backfill gate tally

- **Backfill candidates considered:** 17 (player-experience-adjacent prep beats evaluated for committed canon).
- **Approved by the gate → committed:** 8 (the labeled `## From DM prep (?)` bullets across the 9 files above).
- **Rejected by the gate → kept DM-only:** 9 (future-arc, dungeon-solution, villain-interiority, or not-demonstrably-player-known; enumerated in the gitignored packet so Jon can opt to surface any).

## Packet (gitignored, local-only)

- Appended a `## Phase B2 — DM-prep triage (consolidated reconcile)` section to `canon/FOR-JON--spoiler-review.md` (B1 content preserved, not overwritten):
  - **13** consolidated packet items (P1–P13) — contradictions, alias collisions, meta-name flags, relic-map divergence, play-edge spoilers, and surface-vs-hide judgment calls.
  - **9** gate-rejected backfill candidates re-listed for Jon's optional surfacing.

## Public-safety posture

No DM-only content, dungeon solution, statblock, unrevealed identity, future-arc detail, or real-world/3rd-party reskin name was written into committed `canon/`. The quarantine (`canon/_dm-only/`) and the review packet (`canon/FOR-JON--spoiler-review.md`) are both gitignored and local-only. Fail-safe held throughout: when player-known status was unclear, the fact stayed quarantined.
