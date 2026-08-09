---
name: draft-newsletter
description: >-
  Turn a PUBLISHED Alambor episode into a recap EMAIL DRAFT to the party — "The
  Alambor Chronicle" in the locked Illuminated design. Reads canon/episodes/e<N>.md,
  rewrites it into the punchy section set, parameterizes the HTML template, builds
  prefilled Google-Form poll links, hot-links live site images, and APPENDs the draft
  to Gmail Drafts over IMAP. Use after an episode is pushed live ("draft the newsletter
  for E<num>"). NEVER auto-sends. Idempotent (append-only + report duplicates).
---

# Draft the Alambor Chronicle (recap email)

Thin orchestration over `scripts/newsletter/`. **Never reimplement the harness** —
`build_draft.py` owns the hard-won delivery mechanics (template render, image
hot-linking, prefilled poll links, IMAP APPEND). This skill reads canon, authors the
**per-episode content JSON**, and drives the harness. Design lives in
`template.html.j2`; prose lives in `content/e<N>.json`.

**Flow:** read canon → confirm crit tally → author content → dry-run → **⏸ committee
spot-check via `e<N>-share.html`** → append Gmail draft → **⏸ Phil proofread** →
`--to-all` → Phil schedules the send. Two hard stops, and Gmail isn't touched until the
first one clears.

Read alongside `docs/specs/draft-newsletter-skill.md` (the full brief — §3 delivery
decisions, §7 voice/policy), `docs/specs/episode-pipeline.md` (§3 order, §9 hand-offs),
and `CLAUDE.md`.

**Argument:** the episode number, e.g. `162` → slug `e162`. Below `<N>` = the number.

Tools: harness venv `scripts/newsletter/.venv/bin/python` (jinja2). Run `build_draft.py`
from `scripts/newsletter/` (it resolves paths off the repo root).

## Ground rules (from CLAUDE.md — do not violate)

- **Work on `main`.** Commit only when Phil asks; stage only this session's files.
- **Don't run `npm run dev`** — a server is already up at `:4321`.
- **NEVER auto-send.** This skill only ever leaves a Gmail **draft**. The Monday send is
  a separate, cancellable step Phil controls (Gmail native scheduled-send). Keep this
  gate forever.
- **Sanitization is inverted here, deliberately.** The newsletter is **private** to the
  party, so the crude/edgy in-jokes are *wanted* (see §7 of the brief). Source the
  offensive originals from `scripts/sanitize/title-overrides.yaml` + the transcript —
  **never from `canon/`** (canon stays sanitized) and **never let a raw original flow
  back into `canon/`**. The content JSON lives in gitignored `content/` for this reason.
- **Never fabricate a quote** attributed to a real person (esp. Jon). Omit "From Jon's
  Desk" unless he actually supplied a note or there's a real verbatim transcript line.
- **Claude will not author actual racial/ableist slurs** even on a private list — lean
  dark/roast/absurd instead (established group bits like the "Adolf" nickname are fine).

## Precondition — the episode must be LIVE

The email **hot-links** the scene plate and entity portraits from
`https://alambor.vercel.app/...` and links the live episode page. **Run this only after
the episode is committed and pushed** (pipeline §3). Quick checks:
- `canon/episodes/e<N>.md` exists with `art.status: generated` + `image: /art/episodes/e<N>.webp`.
- `curl -sI https://alambor.vercel.app/art/episodes/e<N>.webp` → `200` (plate is live).

If the plate 404s, stop and tell Phil to push first — the email would render broken.

---

## Step 1 — Read the source

Read `canon/episodes/e<N>.md` (frontmatter + Summary / Key events / Combat & deaths /
Open threads / Loot). Resolve every name through `canon/glossary.md`. Skim the scrubbed
transcript `sources/transcripts/e<N>-clean.md` for quotable lines, crit/fumble moments,
and crude table bits worth a callback. Note the live URLs:
`/episodes/e<N>`, `/art/episodes/e<N>.webp`, and each PC's `/art/characters/<slug>.webp`.

## Step 2 — Confirm the crit/fumble tally (then persist it)

The Crit Watch bar chart renders from `config/newsletter-crit-tally.json` (committed,
not secret), accumulating nat-20s / nat-1s per PC. **Auto-extract, then confirm with
Phil** (decided with Phil):

1. Scan the episode page + transcript for **nat-20s** and **nat-1s** and who rolled them
   (canon prose names crits like "Cruucar's nat-20 for 57"; nat-1s are spottier — check
   the transcript).
2. **Show Phil the proposed per-PC counts and get a yes/correction** before writing —
   nat-1s especially are easy to miss.
3. Set the episode's entry in the tally, **keyed by episode number so a re-run replaces
   in place** (idempotent):
   ```json
   "episodes": { "<N>": { "nat20": { "Cruucar": 1 }, "nat1": {} } }
   ```
   Edit the JSON directly. `build_draft.py` renders **cumulative** nat-20 bars across all
   episodes ≤ `<N>`, so don't pre-sum — just record this episode's counts.

## Step 3 — Author `scripts/newsletter/content/e<N>.json`

Rewrite the recap into the locked section set, in the punchy **"previously on…"** voice
(full spoilers — audience is the party). Model it on `content/e162.json` (the worked
example). The template (`template.html.j2`) consumes these keys:

**Required scalars / blocks**
- `episode` (int, must equal `<N>`), `subject` (`"Alambor E<N> — <Title>"`), `title`,
  `episode_ordinal` (`"162nd"`), `date_line` (`"17 June"`), `locations_line`,
  `recap_url`, `preview_text` (hidden inbox preheader).
- `hero_caption_html`, `dek_html` (one-line tease under the title).
- `previously_dropcap` (single leading letter) + `previously_html` (the rest of the
  drop-capped teaser paragraph; the dropcap letter is rendered separately so
  `previously_html` starts mid-word, e.g. `"he stairwell…"`).
- `play_day` (the day the group next plays — **varies per week, ask Phil if unsure**).
- `heading_into`: list of `{ "html": "<b>…</b> …" }` — open threads / cliffhangers.
- `party`: the 6 PCs, each `{ "slug", "name", "note_html", "tag_html"? }`
  (`tag_html` optional, e.g. the "Adolf" nickname). `slug` must have a matching entry
  in `images`.
- `by_the_numbers`: 3 `{ "value", "label_html" }` standout stats.
- `crit_watch`: `{ "crit": {"pc","note_html"}, "fumble": {"pc","note_html"} }` — the two
  highlight cards (the "20" and "1" are fixed in the design).
- `season_caption_html`, `fumble_note_html` — captions around the season bar chart.
- `quote`: `{ "text_html", "attrib_html" }`.
- `poll`: `{ "question", "options": [ {"key":"A","emoji":"…","label":"…"}, … ] }` — 3–4
  options, keys `A/B/C/D`. The harness turns each into a **prefilled** Google-Form link
  from `config/newsletter-poll.json` (one form serves every episode). Map A/B/C to that
  week's choices. `emoji`/`label`/`question` may contain HTML entities.
- `next_session`: `{ "day", "teaser_html" }`.
- `images`: token → site path, e.g. `"hero": "/art/episodes/e<N>.webp"`,
  `"berrian": "/art/characters/berrian.webp"`, plus any NPC used in a spotlight. `logo`
  defaults to `/icon-512.png`. Paths may be bare (`/art/…`) or full URLs.

**Conditional / rotating (include the key only when there's real content; omit otherwise)**
- `npc_spotlight`: `{ "image": "<token>", "name", "body_html" }` — the token must be in
  `images`.
- `extra_sections`: list of `{ "heading", "body_html" }` for rotating one-offs —
  "From Jon's Desk" (ONLY a real note/verbatim quote), "New on the Wiki" (only when
  non-episode content shipped), "On This Day in Alambor" (a `timeline.md` flashback).
  "From the Table" (session photo) is back-burner (group plays remote).

> **Content sourcing:** prose is yours to write; **facts come from canon/the transcript**
> — don't invent events. Crude originals come from `title-overrides.yaml` + transcript,
> never canon. Keep the innuendo at ~"halfway" — funniest bits, not wall-to-wall.

## Step 4 — Dry-run and eyeball

```
cd scripts/newsletter
./.venv/bin/python build_draft.py <N> --dry-run
```
Writes **two** gitignored files (every run does — dry-run *and* append):
- `scripts/newsletter/e<N>-draft.eml` — the email itself (hot-linked images). **Open it
  in Apple Mail** to preview — no Gmail is touched.
- `scripts/newsletter/e<N>-share.html` — a **self-contained** copy with every image
  inlined as base64. Renders offline in any browser and in iMessage previews — this is
  Phil's standard spot-check copy to **text to players before sending** (essential when
  he was absent for the session). Always tell Phil this path in the final report.

The harness fails loudly on unresolved template tokens or leftover `cid:` refs, so a
clean dry-run means the content JSON keys all matched. Fix prose/keys and re-run until it
reads right.

## Step 5 — ⏸ COMMITTEE SPOT-CHECK GATE (stop here; Gmail is still untouched)

**This gate comes BEFORE any Gmail draft exists** (decided with Phil, E167). The dry-run
already wrote `scripts/newsletter/e<N>-share.html` — self-contained, every image inlined
as base64, no external requests — so it renders in an iMessage preview and offline in any
browser. That file is the committee's read.

1. **Hand Phil the path** `scripts/newsletter/e<N>-share.html` and state plainly that
   **nothing has been drafted or sent yet**. Use `SendUserFile` so he can forward it
   straight from the conversation.
2. **Stop and wait.** Phil texts it to the RETCON committee (Jon/Elliot/Kendall) as the
   final read. This is a real wait — do not proceed to Step 6 on your own initiative.
3. **Fold their corrections back in when they land**, routing by kind:
   - **Prose / tone / a joke that didn't land** → edit `content/e<N>.json`, re-run
     `--dry-run`, hand back the regenerated share HTML.
   - **A factual error** → treat it exactly like a reconcile answer. Fix
     `canon/episodes/e<N>.md`, the glossary, and any affected dossiers **first**, then a
     **follow-up commit** (stage only those files; rebuild `changelog.json` if a title
     changed) — *then* fix the email to match. The wiki and the newsletter must never
     drift apart, and the committee catching it here is the last cheap chance to fix
     canon before friends read the polished version.
   - Log every correction for the end-of-run "areas for improvement" summary.
4. Re-run the dry-run and re-offer the share HTML until the committee is happy.

> Why before the draft: appending first and asking second leaves a **stale Gmail draft**
> behind every time a correction lands (the harness is append-only and never deletes).
> Gating here means exactly one clean draft gets created, once the content is settled.

## Step 6 — Append the Gmail draft

Needs `.env` at repo root: `GMAIL_ADDRESS=<phil-personal-gmail>` +
`GMAIL_APP_PASSWORD=…` (Google app password). **Default to drafting to Phil only first**
so he can proofread the real thing in Gmail:
```
./.venv/bin/python build_draft.py <N>            # → draft addressed to Phil only
```
Once Phil approves the content, the full-party draft:
```
./.venv/bin/python build_draft.py <N> --to-all   # → addressed to the whole party list
```

**Idempotency (append-only, decided with Phil):** the harness **never deletes** a draft.
It counts existing `Alambor E<N> …` drafts and reports the total after appending. If a
re-run leaves duplicates, it says so — Phil deletes the stale ones in Gmail by hand.
(The skill must not delete drafts.)

## Done — report to Phil

Summarize: the subject, who it's addressed to (Phil-only vs `--to-all`), the dry-run
`.eml` path if used, the **`scripts/newsletter/e<N>-share.html` spot-check copy** (the
committee's read — Step 5), whether the committee has signed off yet, any canon
corrections their review forced (and the follow-up commit), and any duplicate-draft
warning. Remind Phil that:
- **Nothing was sent** — it's a draft; the **Monday 07:00 send is his separate,
  cancellable step** (Gmail native scheduled-send).
- The crit-tally (`config/newsletter-crit-tally.json`) gained E<N>'s entry; **nothing is
  committed** unless he asks. The content JSON is gitignored by design.
