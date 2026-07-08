---
name: ingest-episode
description: >-
  Ingest a new D&D session for the Alambor campaign end-to-end: Craig multi-track
  FLAC recordings → speaker-labeled transcript → scrubbed clean.md → canon episode
  page + glossary/timeline/dossier updates → sanitization → scene-art brief
  (status: pending) → rebuilt changelog.json. Use when a new
  sources/recordings/e<num>/ or sources/transcripts/e<num>.txt lands, or Phil says
  "ingest E<num>". Idempotent and resumable — each step skips if its output exists.
---

# Ingest a campaign episode

Turns a recorded session into a feed-complete canon episode. Orchestrates the
existing Python/Node harnesses — **never reimplement them**. Read `CLAUDE.md`
("Ingesting a new transcript") and `recording-pipeline.md` if you need the why.

**Argument:** the episode number, e.g. `162` → slug `e162`. Below, `<N>` = the
number, `<slug>` = `e<N>`.

## Ground rules (from CLAUDE.md — do not violate)

- **Work on `main`.** No feature branches, no worktrees unless Phil authorizes.
- **Commit only when Phil asks.** Finishing a step is not permission to commit.
  When you do, stage only this session's files (`git status` first; never `git add -A`).
- **Never invent facts.** Episode pages are facts-only; mark uncertain inferences `(?)`.
- **Resolve every name through `canon/glossary.md`** before searching/writing. A new
  spelling variant becomes an *alias* on the existing entity — never a second entity.
- **Sanitization is enforced, not hand-edited** (Step 6). Never copy an offensive
  source title/name into `canon/` raw.
- **Don't run `npm run dev`.** A dev server is already up at `:4321` (`strictPort`).

## Resumability

Each step checks for its own output and skips if present. To resume an interrupted
ingest, just re-run from the top — completed steps no-op. Reference output to match:
`canon/episodes/e162.md` (the E162 worked example) and its E161 `## From E162 DM recap`
backfill.

Tools:
- Transcribe venv (arm64, mlx-whisper): `scripts/transcribe/.venv/bin/python`
- Gen venv (pyyaml/pillow/openai): `scripts/gen/.venv/bin/python`
- Changelog: `node` (uses `site/node_modules`)

---

## Step 0 — Transcribe (Craig FLACs → transcript)

Skip if `sources/transcripts/e<N>.txt` already exists.

**Preconditions (halt and ask Phil if either is missing):**
1. `sources/recordings/e<N>/` contains the per-Discord-user FLAC tracks
   (`1-<user>.flac`, …).
2. `scripts/transcribe/tracks.e<N>.json` exists — the **Discord-user → character**
   map. This is **hand-authored when recording** and cannot be derived (diarization
   is unreliable; players change characters over time). Model it on
   `tracks.e162.json`:
   ```json
   {
     "episode": "e<N>",
     "model": "mlx-community/whisper-large-v3-turbo",
     "dir": "../../sources/recordings/e<N>",
     "tracks": [
       { "file": "1-<user>.flac", "label": "DM (Jon)" },
       { "file": "2-<user>.flac", "label": "Quinton" }
     ]
   }
   ```
   Use canonical character labels (`DM (Jon)`, PC names) or `Party` for a shared
   room track. Never guess player names.

Run (idempotent — per-track Whisper output is cached under
`scripts/transcribe/cache/<ep>/`; delete a track's cache json to force re-transcribe):
```
scripts/transcribe/.venv/bin/python scripts/transcribe/transcribe_merge.py \
    scripts/transcribe/tracks.e<N>.json
```
→ writes `sources/transcripts/e<N>.txt` (gitignored), chronological and
speaker-labeled. Because tracks are pre-labeled, attribution (Step 2) is near-automatic.

## Step 1 — Scrub → `sources/transcripts/e<N>-clean.md`

Skip if the file exists. **Drop:** A/V troubleshooting, food orders, off-topic table
talk. **Keep:** narration, in-character dialogue, rolls/outcomes, outcome-changing
rules discussion. Segment into `##` scenes.

## Step 2 — Attribute by character (not player)

In the clean.md: long narration → `**DM (Jon)**`; "I cast X" → the PC with that
ability (check `canon/characters/`); otherwise `**Party**`. Per-track labels from
Step 0 make solo tracks (Jon, any remote-on-own-mic PC) automatic. **Never guess
player names.**

### The shared room mic is the #1 source of errors — treat its attributions as claims, not facts.

When several players share one room mic, that whole track is labeled `**Party**` and
diarization can't tell them apart. A full table spot-check of the first auto-ingest
(E163) found 9 errors; ~5 were room-mic mis-attributions. Apply this **due-diligence
protocol** to every `Party`-track action before asserting who did it:

1. **Name-callout anchoring (highest-value).** Scan nearby DM lines for the DM
   addressing a PC by name ("Quentin, this is the most you've spoken…", "Tor, roll…").
   When Jon names a PC next to an action, attribute that action to that PC. This alone
   would have fixed multiple E163 errors — *do this pass explicitly.*
2. **Character-sheet validation (Phil's due-diligence layer).** Before attributing a
   **spell or class feature** to a PC, confirm they actually have it: grep that PC's
   `canon/characters/<slug>.md` frontmatter `spells:` / `features:` block.
   - If the named ability is **not** on their sheet → **do not assert it.** Either
     reassign to a PC who *does* have it, or, if the source named the spell, keep the
     spell but mark the caster `(?)`. (E163: "Quinton's Dominate Monster" was wrong —
     Quinton's sheet has **Hold Monster**, not Dominate; Dominate is Vane's. The sheet
     check catches this instantly.)
   - This is cheap: the spell lists are already in frontmatter. Only run it on the
     low-confidence `Party`-track ability calls, not every line.
3. **PC-vs-PC overlap → flag, don't pick.** If an action maps to >1 PC's sheet (e.g.
   Dominate Monster is on both Vane and Quinton), mark `(?)` and surface it for Phil —
   never silently choose.
4. **Never invent spell-name specificity.** Only name a spell/ability if the transcript
   names it. Otherwise write "a spell `(?)`" — do **not** guess a plausible name.
5. **Verbatim names win.** If the DM spells a name out letter-by-letter or corrects a
   spelling, use that exact spelling (E163: Jon spelled "A-E-R-A-L-O-R-A" → Aeralora,
   not the phonetic guess).

**Mark every still-uncertain `Party`-track attribution with `(?)`** in canon, and collect
them for the Step 9 confirm-checklist. **Upstream fix to recommend to Phil:** have each
in-room player join Discord on their own mic/headset so Craig records separate tracks
(like the clean solo remote track) — that removes the root cause for future episodes.

## Step 3 — DM recap backfill (highest-value content)

Jon opens each session recapping prior episode(s) in detail. Extract it and **append**
`## From E<N> DM recap` to the affected earlier `canon/episodes/e*.md` page(s), using
it to backfill/verify. (E162 added one to `canon/episodes/e161.md`.)

## Step 4 — Write/enrich `canon/episodes/e<N>.md`

Standard schema (frontmatter + `## Summary` / `## Key events` / `## Loot` /
`## Combat` / `## Open threads`), merging with any shared-notes bullets for the
episode. Frontmatter: `episode`, `date`, `title`, `locations`, `npcs`, `characters`,
`combat`, `tags: [transcript-enriched]`. Facts-only; `(?)` for uncertain inferences.
Match `canon/episodes/e162.md`.

## Step 5 — Glossary / timeline / dossiers

- `canon/glossary.md`: add any new spelling variants as **aliases** on existing
  entities; add genuinely new entities.
- `canon/timeline.md`: one line for E<N>.
- Affected `canon/{characters,npcs,locations,factions,items}/` dossiers: update with
  new facts.

## Step 6 — SANITIZATION GATE (hard requirement)

Per `docs/content-sanitization.md`. If any **offensive source title or name** showed
up (crude/slur/atrocity/real-person/antisemitic-coded), add it to
`scripts/sanitize/title-overrides.yaml` (`original` → `sanitized` + `tier` + `reason`)
— **never** copy the raw string into `canon/`. Then always run (idempotent):
```
python scripts/sanitize/apply_overrides.py
```
Run it even if nothing new appeared — it re-applies the published-safe rewrites that a
resync would otherwise revert. This MUST happen before Step 8 so the changelog never
echoes a pre-sanitization title.

## Step 7 — Scene-art brief (leave it `status: pending`)

Author the recap-plate brief and wire it for the `generate-art` skill. Two writes:

**7a — Frontmatter `art:` block** on `canon/episodes/e<N>.md`, `status: pending`.
Pick the episode's single most spectacular/emotionally-resonant beat. Fields (match
e162.md): `type: scene`, `eligibility: ok`, `has_visual_source: true`,
`ref_images` (the masters for cast you expect composited),
`visual:` (a `|` block — the staged scene, naming each key entity with its canonical
look; honor the accessory-omit rule), `scene_title:`, `key_entities:` (ordered by
importance — only the first `--max-refs` get reference images; the rest render from
text), and the locked `model: gpt-image-2` / `style_version: B-v1`.

**7b — Append the brief to `scripts/gen/episodes.json`** (the input scene_gen.py
actually reads — decided with Phil). Deterministic helper reads the frontmatter art
block and appends/updates idempotently:
```
cd scripts/gen && ./.venv/bin/python add_episode_brief.py e<N>
```

> Do **not** generate the art here. That's the `generate-art` skill (`scene` mode),
> run separately so the API spend is explicit. This skill only leaves the
> `status: pending` brief ready to consume.

## Step 8 — Rebuild the changelog

After Step 6 (sanitized titles), regenerate the committed feed data:
```
node scripts/changelog/build.mjs
```
→ rewrites `site/src/data/changelog.json` (drives the homepage "Latest edits" feed and
`/changelog`). **It is git-history driven:** the new-article row appears once the canon
episode is committed; the **new-art** row appears only after `generate-art` runs *and*
the `.webp` is committed and this is re-run. Re-running is cheap and idempotent — the
`generate-art` skill re-runs it too.

## Step 9 — Emit the "confirm these" checklist (room-mic due diligence)

Collect every `(?)`-marked low-confidence attribution from Step 2 (who cast what, who was
targeted, who healed whom on the shared `Party` track) into a short **bulleted checklist
for Phil to run past the table.** Group by PC. This is the cheapest guard against the
room-mic error class — Phil (or whoever ran that PC) confirms/corrects in one pass, and
the corrections flow back into canon + the newsletter. Lead the report with it when the
episode leaned on a shared mic.

## Done — report to Phil

Summarize what landed (transcript, episode page, recap backfills, glossary/timeline/
dossier edits, any sanitization additions, the pending art brief) and that the
changelog was rebuilt. Then surface, prominently:
- the **Step 9 confirm-these checklist** (low-confidence `Party`-track calls), and
- any **character-sheet validation flags** (an ability named in the source that isn't on
  the attributed PC's sheet).

Remind Phil that **(a)** the scene art still needs `generate-art scene e<N>`, and
**(b)** nothing is committed — commit only on request.
