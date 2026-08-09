---
name: ingest-episode
description: >-
  Ingest a new D&D session for the Alambor campaign end-to-end: Craig multi-track
  FLAC recordings → speaker-labeled transcript → scrubbed clean.md → canon episode
  page + glossary/timeline/dossier updates → sanitization → scene-art brief
  (status: pending) → rebuilt changelog.json → a review digest (story-spine + open
  questions) written as a CSV for Phil to import as a new e<num> tab in the single
  permanent "AI Recap Fact Review" workbook. Use when a new sources/recordings/e<num>/
  or sources/transcripts/e<num>.txt lands, or Phil says "ingest E<num>". Also runs the
  reconciliation half: when Phil points back at a filled review tab (the table's
  "RETCON committee"), fold the answers into canon. Idempotent and resumable — each step skips if its output exists.
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
6. **Before inventing ANY new proper-noun spelling, grep Jon's own DM docs.** This is the
   highest-value check in the whole step and it is cheap:
   ```
   grep -rin "<phonetic fragment>" canon/_dm-only/ canon/worldbuilding/ canon/glossary.md
   ```
   Jon's `canon/_dm-only/` files are **a higher authority than the transcript** — they are
   his written spellings. In E166 the dynasty was ingested as "Zevan" while
   `canon/_dm-only/hive-zivens-sundering-lore.md` had been spelling it **Ziven** 155 times
   the whole campaign; Jon later ruled Ziven canonical, forcing a wiki-wide rename that a
   single grep would have avoided. Search on the *sound*, not the guess (`ziv`, `zev`,
   `kael`, `vorr`), because you don't yet know the spelling.
7. **Mark invented spellings as provisional in the page itself**, not only in the review
   sheet — e.g. `**Kalvor** (spelling unconfirmed)`. In E166 the DM corrected **every
   single** invented proper noun (Kalvor→Kael'vorr, Zirin Val→Xeran Vaal,
   Ilhares→Ilharess, Talakvor→Tu'narath). Assume yours are wrong until confirmed, so a
   reader mid-week can see which names are load-bearing guesses.

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

## Step 9 — Collect the "confirm these" items (room-mic due diligence)

Collect every `(?)`-marked low-confidence call into a list — this feeds the Step 10 review
sheet, so gather it don't just print it. Two buckets:
- **Attributions** from Step 2 (who cast what, who was targeted, who healed whom on the
  shared `Party` track), grouped by PC — the room-mic error class.
- **Ambiguities** — any `(?)` in the episode page a player or Jon could resolve in one
  line (an unnamed NPC in the initiative order, a number that hinges on a sheet, a
  lore/name conflict with existing canon, a spelling the DM might correct).

Also pull any **character-sheet validation flags** (an ability named in the source that
isn't on the attributed PC's sheet) — those become questions too.

## Step 10 — Add the episode's review tab (the "RETCON committee")

The table validates the recap spine and answers the Step 9 open questions in one skim —
the human-in-the-loop gate *before* the newsletter, so friends aren't editing dense AI
prose. Phil's table calls this the **RETCON committee**.

### One workbook, one tab per episode (decided with Phil, E166 — do NOT create new files)

There is a **single permanent Google Sheet** that every episode's review lives in:

| | |
|---|---|
| **Title** | `AI Recap Fact Review` |
| **File ID** | `1dVg4mTa-oKk0BH1gKGEZ5_pFgTCT8eiNUCoMJSgXnhI` |
| **Folder** | `parentId = 1fH4LeftuT2tFvobfmIOkCif0Nk9zJOCn` |
| **Tab naming** | lowercase `e<N>` — `e165`, `e166`, `e167`… |

Each episode gets **a new tab in that workbook**, never a new file. Earlier runs created
one standalone Sheet per episode; Phil consolidated them by hand and wants the tab model
from here on. If you can't find the workbook by ID, locate it with
`mcp__claude_ai_Google_Drive__search_files` on the title `AI Recap Fact Review` — do not
fall back to creating a file.

### The connector cannot add a tab — so hand Phil an importable CSV

**Important limitation, do not fight it:** the Google Drive connector exposes no
cell-write or add-sheet capability (`create_file`, `read_file_content`, `search_files`,
`copy_file`, metadata — that's all). It **cannot** append a tab to an existing
spreadsheet, and calling `create_file` will just litter Drive with a stray file. So:

1. **Write the CSV locally** to `docs/review/e<N>-review.csv` (gitignored — `docs/review/`
   is not published).
2. **Show Phil the CSV inline** in the chat as well, so he can paste it directly if he
   prefers.
3. **Tell Phil the one manual step:** open **AI Recap Fact Review** →
   `File ▸ Import ▸ Upload` → pick `e<N>-review.csv` → **Import location: "Insert new
   sheet(s)"** → rename the new tab `e<N>`. (Paste-into-a-blank-tab works equally well.)
4. Also write the human-readable mirror `docs/review/e<N>-review.md` (spine + questions +
   an empty answer log) — this is the local audit record and what you update at
   reconciliation.

### Sheet contents

**Columns (exactly):** `#`, `Type`, `Fact / question`, `Jon`, `Elliot`, `Kendall`,
`Resolution (Phil)`.
- Reviewer columns are the DM + the two most-engaged players: **Jon** (DM), **Elliot**
  (Noctis), **Kendall** (Berrian). Adjust only if Phil names different people. Never
  guess player↔PC mappings beyond these three confirmed ones.

**Rows:**
1. A title row, then a `HOW TO` row: *"For each row, put a ✓ (or y) in YOUR column if it
   matches your memory. If something's off, type the correction in your column instead.
   Skip rows you don't remember."*
2. A header row with the seven column names.
3. `S1…Sn` — **the story spine**, `Type = Beat`: ~8–12 one-line beats that are the
   episode's skimmable backbone (this is also the spine a reader should be able to follow
   without the dense `## Summary` — keep them punchy and causal). One beat per row.
4. `Q1…Qn` — **the open questions**, `Type = Question`, from Step 9. Prefix each with the
   person best placed to answer in brackets where useful (`[Jon]`, `[Steve]`, `[Table]`).

Model the layout on the `e166` tab (`docs/review/e166-review.md` mirrors its content).
Validate the CSV parses to exactly 7 columns on every row before handing it over — a
stray unquoted comma silently shifts every reviewer's answer one column left.

> **Sharing is Phil's manual step** — the connector can't set link-sharing. Once the
> workbook is shared with Jon/Elliot/Kendall it stays shared, so this is a one-time cost
> that new tabs inherit. Real tickable checkboxes aren't possible via CSV import; a typed
> ✓/"y" is what to expect and is readable back.

## Reconciliation — when Phil returns with the filled tab

Triggered by "the E<N> review is filled in" / "reconcile the review sheet" / "the RETCON
committee came back" / Phil pasting the workbook link. This is the back half of the loop:

1. `read_file_content` on the workbook (ID above). **It returns every tab concatenated**,
   each under a `# <tabname>` markdown heading with the rows in a fenced block. Find the
   `# e<N>` section and work only within it — and expect to see *other* episodes' tabs in
   the same response.
   - Phil may hand back **several tabs at once** (he did E165+E166 together). Reconcile
     each episode against its own canon page; don't let one episode's answers leak into
     another's.
2. For each row, read the reviewer columns. A ✓/`y` confirms the beat/fact as written —
   drop the `(?)`. A typed correction is **authoritative** (Jon's answers especially — see
   the [[dm-clarification-email-loop]] rule: the DM's reply corrects canon). Conflicting
   reviewer answers → surface to Phil, don't pick.
3. Flow every confirmation/correction into canon: the episode page (`(?)` → fact, or the
   fixed value), glossary aliases, affected dossiers, timeline. Watch for answers that
   **correct existing canon**, not just this episode — flag old-episode sweeps rather than
   mass-rewriting (see the Ziven precedent in `docs/specs/pipeline-learnings.md`).
4. **Expect proper-noun spellings to come back wrong.** In E166 the DM corrected *every*
   invented spelling (Kalvor→Kael'vorr, Zirin Val→Xeran Vaal, Ilhares→Ilharess,
   Talakvor→Tu'narath). Rename across canon, keep the old forms as **aliases**, and never
   blanket-replace inside a glossary `Aliases:` clause — split each line at `Aliases:` and
   rewrite only the prose before it.
5. Record the answers in the local mirror `docs/review/e<N>-review.md` (answer log:
   question → answer → applied-to-canon), and tell Phil which rows are still unanswered.
   You cannot write back into the Sheet's `Resolution (Phil)` column — the connector is
   read-only for cells — so the mirror **is** the audit record; say so.
6. Report what changed. The episode is now clean enough to hand to `draft-newsletter`.

## Done — report to Phil

Summarize what landed (transcript, episode page, recap backfills, glossary/timeline/
dossier edits, any sanitization additions, the pending art brief) and that the
changelog was rebuilt. Then surface, prominently:
- the **review tab** (Step 10) — the path to `docs/review/e<N>-review.csv`, the one-line
  import instruction (AI Recap Fact Review → File ▸ Import ▸ Insert new sheet(s) → rename
  the tab `e<N>`), and the workbook link, and
- any **character-sheet validation flags** (an ability named in the source that isn't on
  the attributed PC's sheet) — noting these are already rows in the sheet.

Remind Phil that **(a)** the scene art still needs `generate-art scene e<N>`, **(b)**
nothing is committed — commit only on request, and **(c)** the newsletter waits on the
review sheet coming back (point me at it and I'll reconcile, then draft).
