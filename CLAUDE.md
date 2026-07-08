# D&D Second Brain — Alambor Campaign

Knowledge base for a long-running D&D 5e campaign ("Alambor", party AKA the Alambor Six). DM: Jon (plays remotely over Discord). Active PCs: Berrian, Cruucar, Noctis, Quinton Shackleford, Torgoth ("Tor"), Vane. Deceased PCs: Evac, Zook. Departed PC (left the party, still alive): Zanim.

## Layout

- `sources/` — immutable inputs. Binaries (docx/pdf) and raw transcripts are gitignored; converted `.md` text is committed.
  - `adventure-log/` — snapshot of the shared Google Doc ("Alambor Adventure Log"). `full-log.md` is the converted text; `split/eNNN.md` is one file per episode, split on the `E<num> <date> <title>` headers. The Google Doc is the living source of truth — re-sync via the Google Drive connector, then re-run the split. **After any resync, run `python scripts/sanitize/apply_overrides.py`** — titles flow verbatim from the Doc, so a resync reintroduces the raw source titles/names; the script re-applies the published-safe rewrites.
  - `handouts/` — DM-provided artifacts (letters, journals, campaign background). Mostly early-campaign lore.
  - `transcripts/` — raw AI-recorder transcripts, named `e<num>.txt`. Gitignored. How these are produced (Craig multi-track recording + per-track Whisper) is in `recording-pipeline.md`.
  - `character-sheets/` — sheet exports per character.
- `canon/` — the derived, queryable knowledge base. **Answer questions from here first.**
  - `glossary.md` — canonical entity names + all known aliases/misspellings. **Always resolve names through this before searching**; the table misspells everything (e.g. O'Malley appears as Shauwn O'Malley / Shawn Omallery / Mally).
  - `episodes/eNNN.md` — structured recap per episode (frontmatter + Summary/Key events/Loot/Combat/Open threads).
  - `arcs/` — chapter-level "story so far" narratives; `timeline.md` — one line per episode.
  - `characters/`, `npcs/`, `locations/`, `factions/`, `items/` — entity dossiers.

## Conventions

- Canonical spellings come from `glossary.md`. When a new spelling variant appears in a source, add it to the entity's aliases — never create a second entity for a spelling variant.
- Episode numbering quirks: E06 has no notes; E108 and E126 were each accidentally used for two different sessions (`-dup2` files). Don't renumber.
- Episode files are facts-only: never invent or embellish beyond what a source says; mark uncertain inferences `(?)`.
- All derived files: lowercase kebab-case names, YAML frontmatter.
- **Sanitization is enforced, not hand-edited.** Certain source-derived episode titles and entity names are rewritten for the public site by `scripts/sanitize/apply_overrides.py` (map: `scripts/sanitize/title-overrides.yaml`, local-only, never published). Never hand-fix a sanitized title in `canon/` — a resync reverts it. When a *new* source title/name needs rewriting, add it to the override map and re-run; don't copy the raw string into canon. The map is the local audit record of what was changed.

## Ingesting a new transcript

When a new `sources/transcripts/e<num>.txt` lands:

1. **Scrub** → `sources/transcripts/e<num>-clean.md`: drop A/V troubleshooting, food orders, off-topic table talk; keep narration, in-character dialogue, rolls/outcomes, outcome-changing rules talk. Segment into `##` scenes.
2. **Attribute by character, not player.** Diarization is unreliable (one room mic for 5–6 players; Jon is remote on speakerphone and talks the most). Long narration → `**DM (Jon)**`; "I cast X" → the PC with that ability (check `canon/characters/`); otherwise `**Party**`. Never guess player names.
3. **Extract the DM's opening recap** — Jon recaps the previous episode(s) in detail at the start of each session. This is the highest-value content; use it to backfill/verify earlier episode pages (append under `## From E<num> DM recap`).
4. **Write/enrich** `canon/episodes/e<num>.md` in the standard schema, merging with the shared-notes bullets for that episode. Tag `transcript-enriched`.
5. **Update** glossary aliases, timeline, and any affected entity dossiers.

## Dev server & agents

The wiki lives in `site/` (Astro). **A dev server is already running at `http://localhost:4321`** — Phil starts it manually in his own terminal.

- **Do NOT run `npm run dev` / `astro dev`.** The port is pinned with `strictPort`, so a second server will fail loudly anyway. To inspect the site, `curl` or browser-navigate to `http://localhost:4321`. If it's not responding, ask Phil to start it — don't spin up your own.
- **Concurrency:** many agents can read/screenshot `:4321` at once with no conflict. The real collision is two agents *editing the same files at once* on `main` — coordinate so only one writer touches a given area at a time.
- **Browser (Chrome MCP):** call `tabs_context_mcp` first, create your **own** new tab, and only drive tabs you created. Never reuse a tab ID from another session.

## Git workflow

- **Work directly on `main`.** Do not create feature branches and do not use git worktrees unless Phil explicitly authorizes it for a specific task. Commit to `main` directly when asked. (This overrides the default "branch first when on the default branch" behavior.)
- Still **commit only when Phil asks** — staying on `main` is not permission to commit unprompted.
- **Commit only the work from the current session.** Multiple Claude Code sessions may be running in parallel against the same working tree, so the working tree can contain edits this session did not make. Never blindly `git add -A` / `git commit -a`. Before committing, run `git status` and stage **only** the specific files this session created or modified; leave everything else untouched (do not revert, stash, or commit other sessions' changes). If unsure whether a changed file is yours, ask Phil rather than committing it.
- **Never push unless Phil explicitly asks.** "Commit" means commit only — stop after the commit and leave `git push` for a separate, explicit request.

## Answering campaign questions

For "what happened in E<x>" → `canon/episodes/`. For "story so far" / "where are we" → `canon/arcs/` + most recent episodes. For people/places → glossary first, then the dossier, then grep `canon/episodes/` with the name AND its aliases. For tactical "what should <PC> do" → character dossier + character sheet + current arc's open threads.
