# Phase B kickoff prompt (paste into a fresh Claude Code session)

---

We're doing Phase B of ingesting the DM's authoritative worldbuilding into the Alambor campaign wiki. Phase A is done and committed on branch `dm-docs-ingest`: Jon's "Dungeon Master Docs" were converted to markdown under `sources/dm-docs/`. Now enrich `canon/` from that material. **Use a workflow of subagents to orchestrate this** — it's a large, parallelizable job.

## Read these first
- `CLAUDE.md` — repo conventions (glossary-first name resolution, facts-only, kebab-case, frontmatter).
- The approved plan: `~/.claude/plans/okay-using-the-google-idempotent-toast.md` — full design + the 4 confirmed decisions.
- `sources/dm-docs/COVERAGE.md` and `sources/dm-docs/_manifest.json` — what Phase A landed (82 docs by area + flags).
- `canon/glossary.md` and `canon/dm-questionnaire.md` — the alias registry and the 55 open questions.

## Hard rules
- `sources/dm-docs/` is an **immutable input layer** — read it, never edit it. All changes go in `canon/`.
- **Glossary-first:** resolve every name through `canon/glossary.md` aliases before searching. Never create a second dossier for a spelling variant — add the variant as an alias.
- Facts-only; mark uncertain inferences `(?)`. Don't invent beyond a source.
- Work on the `dm-docs-ingest` branch. Commit at the end; don't push unless asked.
- **Spoilers / public-repo safety:** the DM's raw prep is **gitignored and local-only** — `sources/dm-docs/{episode-prep,sidequests}/`, `worldbuilding/{anthology-notes,vault-of-izzdar-notes,campaign-2-log-for-the-boys}.md` (read them locally; they're not in git). This repo is intended to go **public**, so **nothing you write into committed `canon/` may contain a spoiler** — not even in a `## DM-only` section. Spoiler content goes ONLY to the gitignored quarantine `canon/_dm-only/` and the gitignored packet `canon/FOR-JON--spoiler-review.md`.

## The 4 decisions (already made — apply them)
1. **Spelling: Jon's docs win.** Prose docs (kingdom/city/faction/backstory) are the spelling authority over maps. Where Jon's canonical differs from current canon → **rename the canon file (`git mv`) and rewrite the glossary canonical, demoting the old spelling to an alias.** Where Jon conflicts with himself (maps especially, e.g. Kierkenwall/Kirkenwall/Kierkenvall; "Quentin" vs "Quinton"), pick one canonical and **log the conflict** for Jon in a `canon/_spelling-conflicts.md` file.
2. **Spoilers: triage is YOUR job, the player never reads raw prep.** For every fact decide player-safe vs DM-only:
   - **player-safe** (already revealed in play by the current episode, ~E161) → committed `canon/` dossiers.
   - **DM-only** (unrevealed truths, intended/never-happened plot, dungeon solutions, future beyond current play) → write to the gitignored quarantine `canon/_dm-only/<entity>.md`, and add an entry to `canon/FOR-JON--spoiler-review.md` (gitignored): source location + the flagged content + your reason + confidence, so Jon can confirm hide-vs-surface. **Never** place DM-only content in a committed `canon/` file.
   When unsure, treat as DM-only (fail safe). The `dm_only` flags already in `sources/dm-docs/` frontmatter are a first-pass folder heuristic — refine per fact.
3. **Geo structure:** add a `canon/kingdoms/` tier for the 5 nations (Gidian Empire, Carasian Kingdom, Luzonovian Sovereignty, Maadolonia/Islands of Maadolonia, Parathia). Keep cities & regions in `canon/locations/` and add `kingdom:` + `parent:` frontmatter links.
4. **Sequencing:** this is the enrichment phase; Phase A (raw landing) is already complete.

## Frontmatter additions (all enriched entities)
```yaml
sources: [dm-docs/kingdoms/gidian-empire/gidian-empire.md]   # provenance to Jon's doc(s)
art:
  has_visual_source: true     # Jon's text gives a concrete visual (appearance/architecture/landscape/banner)
  visual: |                   # the verbatim/condensed describable passage, for later AI image-gen
    <pulled description>
  image: null                 # filled in Phase 2 when generated
dm_only: false                # true => spoiler; or isolate secrets under a `## DM-only` section
```
Locations also get `kingdom:` and `parent:`. Set `art.has_visual_source: true` wherever Jon's prose is richly describable — this drives the roadmap's Phase 2 image generation.

## Phase B tasks
1. **Extract entities** from each landed doc (people/places/factions/items), resolved through the glossary.
2. **Spelling promotion** — rename + flip aliases per decision 1; log self-conflicts.
3. **Enrich / create dossiers** — merge Jon's lore into existing `canon/{characters,npcs,locations,factions,items}` dossiers, and create new ones incl. `canon/kingdoms/`. Set `art.*`, `sources:`, `dm_only`/`## DM-only`, `kingdom:`/`parent:`.
4. **Auto-answer the questionnaire** — fill `canon/dm-questionnaire.md` `→` lines with `yes`/`no`/`?` + one-line cited evidence from the docs; leave genuinely unresolved ones flagged. (Confirmed gettable: **Q5 Linxes** ← `sources/dm-docs/character-backstories/linxes-faeyassa.md`; most place-name questions ← the map labels + city/kingdom docs.)
5. **Reconcile (barrier step)** — update `canon/glossary.md`, `canon/arcs/timeline.md`, and affected dossiers; write a Phase B coverage report of every change.

## Suggested workflow shape
`pipeline(landedDocs, extractEntities → proposeEnrichment[+visual+spoiler flags])` with schema-validated structured output, then a **barrier** to dedupe entities across all docs, then `parallel` dossier writes + spelling promotions, then a single **reconcile agent** for glossary/timeline/questionnaire (needs the full set).

## Known watch-outs
- **Episode-prep is a goldmine:** `sources/dm-docs/episode-prep/` has per-episode prep for E103–E161 — use it to backfill/verify `canon/episodes/` (but it's prep, so spoiler-screen and mark prep-vs-played `(?)`).
- **External refs** flagged `external_reference: true` (lich guides, Limithron naval guide) — exclude from canon.
- **Harpers** has a duplicate: `the-harpers-overview.md` + `...-for-elliot.md` (player-specific) — prefer the canonical Overview, mine the variant for extras.
- **Real-world placeholder names** (an NPC named after a real-world historical figure; "Maena and Alambor Overlay") — Jon's inspiration shorthand; choose sensible in-world display names and note the origin.
- **Maps are gitignored** in `sources/dm-docs/maps/` (review locally). Coordinate/geo-pin tagging (`canon/maps/registry.yaml`) is deferred to roadmap Phase 3 — don't attempt pixel coords now.
- `Grillers 1.pdf` is 0 bytes (corrupt in Jon's dump) — note it, don't rely on it.

## Deliverables
Enriched **player-safe** `canon/` (new `canon/kingdoms/`, updated dossiers, promoted spellings), drafted `canon/dm-questionnaire.md` answers, `canon/_spelling-conflicts.md`, an updated glossary + timeline, the gitignored `canon/_dm-only/` quarantine + `canon/FOR-JON--spoiler-review.md` packet, and a (spoiler-free) Phase B coverage report. Commit on `dm-docs-ingest` — and verify `git status`/`git ls-files` show no spoiler content staged.
