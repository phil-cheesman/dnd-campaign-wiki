---
name: new-episode
description: >-
  Run the full post-session pipeline for an Alambor episode end-to-end, with human
  gates: ingest-episode (+ review sheet) → generate-art (scene) → commit+push →
  reconcile the table's filled review sheet → draft-newsletter, stopping at each gate
  for Phil. Resumable on the hand-off signals; reads and appends the standing
  lessons-learned log; surfaces clarifications MID-run and an areas-for-improvement
  summary at the END for Phil's feedback/corrections. Use when Phil says "run the
  pipeline for E<num>", "new-episode E<num>", or after a recording lands. Invokes the
  sub-skills via the Skill tool — never reimplements them. NEVER auto-sends email;
  NEVER commits without asking.
---

# new-episode — the pipeline orchestrator

One entry point that runs the three pipeline skills in order and stops at the gates.
It **sequences and supervises** — it does not reimplement anything. Read
`docs/specs/episode-pipeline.md` (§3 order, §4 gates, §9 hand-offs, §11 build notes) and
`docs/specs/pipeline-learnings.md` (accumulated lessons) before starting.

**Argument:** the episode number, e.g. `164` → slug `e164`. Below `<N>` = the number.

**This is NOT a Workflow.** It's sequential work with human gates — a procedure skill,
not parallel fan-out. (Also: `generate-art` requires plain background Bash workers, not
Workflow.) Invoke sub-skills with the **Skill tool**; honor every CLAUDE.md ground rule
(work on `main`, commit only when asked, stage only this session's files, sanitization,
don't run `npm run dev`).

## Step 0 — Load lessons & open a run log

1. **Read `docs/specs/pipeline-learnings.md`** and apply its active lessons this run
   (e.g. run the ingest room-mic due-diligence, derive play_day, expect the changelog
   as a separate commit). This is how the pipeline compounds — past corrections shape
   the current run.
2. Start a scratch run-note for this episode to collect what to append back at the end:
   friction hit, gates that needed Phil, corrections he made, ideas for improvement.

## The lessons-learned loop (Phil's standing requirement — do not skip)

This pipeline is expected to keep improving. Therefore:
- **Mid-run:** whenever confidence is low or a decision is Phil's, **stop and ask** — a
  short, specific question, not a guess. Don't batch everything to the end.
- **At every gate:** report what just happened + what's next in 2–4 lines, then wait.
- **At the END (always):** present an **"Areas for improvement"** summary — what was
  rough, what you'd change in a skill, anything you're unsure you got right — and
  explicitly **invite Phil's feedback and corrections.** Assume he'll have some.
- **After his feedback:** apply the corrections, then **append the durable lessons to
  `docs/specs/pipeline-learnings.md`** (promote into the phase sections; add a dated
  per-run entry). Offer to commit that doc with the episode.

## Resumability — branch on the hand-off signals, don't keep your own state

Re-running `new-episode <N>` resumes from the first incomplete step. Check the §9 signals
on disk and skip what's done — **never redo a paid/sent step:**

| Phase | Done when | If done |
|---|---|---|
| ingest | `canon/episodes/e<N>.md` exists, `art.status: pending` (or generated) | skip to art |
| art | `art.status: generated` **and** `site/public/art/episodes/e<N>.webp` exists | skip to push |
| push | `e<N>.md` committed **and** the live plate URL returns 200 | skip to reconcile |
| review sheet | a Sheet `E<N> Review — …` exists in the Alambor Drive folder | skip creation; check if filled |
| reconcile | Phil signals the sheet is filled in (no clean on-disk marker — it's Phil-gated) | fold answers into canon, then newsletter |
| newsletter | a Gmail draft `Alambor E<N> …` already exists (count > 0) | report, don't re-append (append-only stacks) |

## The sequence (stop ⏸ at each gate)

**Phase 1 — Ingest (+ review sheet)** → `Skill(ingest-episode, "<N>")`.
Precondition: `sources/recordings/e<N>/` + `scripts/transcribe/tracks.e<N>.json` (the
hand-authored mic→character map — **halt and ask Phil if missing**, incl. the room
topology). Apply the room-mic due-diligence + character-sheet validation. Ingest's Step 10
creates the **Google-Sheet review digest** (story-spine + open questions) in the shared
Alambor Drive folder.
⏸ **GATE — proofread canon + hand off the sheet:** present the proposed title, the
summary, new/merged entities, and the **review-sheet link**. Remind Phil to **set sharing
and send it to the table** (Jon/Elliot/Kendall) — reconciliation (Phase 4) waits on it
coming back. Get Phil's title confirm + corrections before proceeding.

**Phase 2 — Art** → `Skill(generate-art, "scene e<N>")`.
⏸ **GATE — approve spend + subject:** show the staged scene beat and invite an
alternative; confirm the (~$0.15–0.20) spend. After generating, show the plate; offer a
`--force` regen. Skip entirely if `art.status: generated` already.

**Phase 3 — Commit + push** (this skill does it; not a sub-skill).
⏸ **GATE — confirm publish:** stage **only this session's e<N> files** (explicit paths;
diff anything pre-modified), commit content, **rebuild changelog → separate commit**,
push. Then **poll the live plate URL until 200** before Phase 4 (Vercel deploy lag).

**Phase 4 — Reconcile the review sheet** (this skill does it; the reconciliation half of
`ingest-episode`).
This is the **human-in-the-loop gate that must clear before the newsletter** — its whole
purpose is that the table validates the recap spine + open questions *before* friends see
polished prose. It is a genuine wait: the sheet may take days.
⏸ **GATE — wait for Phil's signal.** Do not proceed to Phase 4 reconciliation until Phil
says the sheet is filled in (or pastes it). When he does, follow the ingest-episode
**Reconciliation** section: read the sheet, ✓ drops the `(?)`, typed corrections are
authoritative (Jon's especially — [[dm-clarification-email-loop]]), conflicts → ask;
flow into canon, write finals into the sheet's `Resolution (Phil)` column. Because Phase 3
already published, canon corrections here produce a **follow-up commit** (stage only the
reconciliation edits; rebuild changelog if a title changed) — present it at the gate.
> If Phil wants to draft the newsletter *before* the sheet returns (he's caught up and
> impatient), that's his call — flag that unreconciled `(?)`s will ride into the draft,
> and proceed only on his explicit OK.

**Phase 5 — Newsletter** → `Skill(draft-newsletter, "<N>")`.
Runs only after the episode is live **and the review sheet is reconciled** (or Phil waived
it). Confirm the crit/fumble tally (route to whoever ran the PCs if Phil was absent),
author the content, dry-run, append the **Phil-only** draft, and hand Phil the
`e<N>-share.html` spot-check copy.
⏸ **GATE — proofread:** Phil reviews; on his OK, `draft-newsletter <N> --to-all`. The
scheduled send stays Phil's separate, cancellable step. **NEVER auto-send.**

## Configurable gates (carry Phase 1 → 3 autonomy without a rewrite)

Default: stop at all gates. Support an **auto-approve** mode (e.g. `new-episode <N> --yolo`
or per-gate flags) for later phases — auto-run the safe/reversible gates (proofread canon,
confirm publish) but **keep the spend gate, the reconcile gate, and the email gates manual**
regardless. The reconcile gate can't be auto-approved anyway — there's nothing to reconcile
until the table fills the sheet, so it always waits on Phil's signal. The email-send gate
never fully closes (cancellable scheduled send is the most it relaxes to).

## Done — final report

End with: the **live episode URL**, the **review-sheet link + its state** (sent / filled /
reconciled), the **Gmail draft** state (+ any duplicate warning), the **scheduled-send**
reminder, the **share-HTML path**, and — always — the **"Areas for improvement" summary +
an explicit ask for Phil's feedback/corrections.** Then append the run's durable lessons to
`docs/specs/pipeline-learnings.md`.

> **Batched weeks:** when Phil is catching up on several episodes at once (e.g. ingesting
> E166 before E165's sheet returns), run Phases 1–3 for each so all the review sheets go
> out together, then reconcile + newsletter each as its sheet comes back. The per-episode
> gates are independent; don't block a later episode's ingest on an earlier one's reconcile.
