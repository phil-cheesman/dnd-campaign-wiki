---
name: generate-art
description: >-
  Generate Alambor-wiki art via the scripts/gen harness in one of two modes.
  `scene` — episode/arc recap plates (composites EXISTING entity masters via
  gpt-image-2 images.edit for likeness; flips frontmatter status pending→generated).
  `portrait` — text-only entity portraits from a dossier/Jon's description (+optional
  ref image, extracted to TEXT, never uploaded). Use after ingest leaves a
  status:pending scene brief ("generate art for E<num>"), or to make/redo an entity
  portrait. Style is LOCKED = B "inked codex" + NO_TEXT; both modes inherit it.
---

# Generate wiki art

Thin orchestration over `scripts/gen/`. **Never reimplement the generators** —
`scene_gen.py` (scenes) and `generate.py` (portraits/entities) own prompt assembly,
the Style-B lock, retry/backoff, optimize→WebP, and frontmatter writes. This skill
adds the operational safety rails and picks the right command.

Run generators from `scripts/gen/` (they import sibling modules). Gen venv:
`scripts/gen/.venv/bin/python`. API key: repo-root `.env` (`OPEN_AI_API_KEY`, aliased
to `OPENAI_API_KEY` by the harness). **Don't run `npm run dev`** — server is on `:4321`.

## Shared ops (both modes inherit)

- **Style B + NO_TEXT lock.** Already baked into `style.py` (`LOCKED="B"`,
  `STYLE_VERSION="B-v1"`) and appended to every prompt. Don't pass style overrides.
- **Billing pre-flight.** Billing hard-limits have blocked runs twice and there's no
  balance API, so the pre-flight is empirical: **generate ONE image first and confirm
  it succeeds** (not a `billing_hard_limit` / 400) before any fan-out. A single-slug
  run (the common case) *is* its own pre-flight — just run it. For a batch, do one
  slug, confirm the `.webp` lands, then fan out the rest.
- **Concurrency cap: 4 workers / under 5 images-per-min.** gpt-image-2 on Phil's org
  ≈ 5 img/min; 6 workers overran historically. Only relevant for batches (arcs, or
  many portraits). Launch the ≤4 workers as the **main agent's own
  `run_in_background` Bash calls**, each a `--slug …` invocation — NOT a Workflow
  (workflow workers got killed mid-run last time). Retry/backoff is the safety net.
- **Disk-is-truth mop-up loop.** Worker reports lie; disk doesn't. After any parallel
  run, re-scan for missing `<slug>.webp` and run a **sequential** mop-up for the
  gaps. Loop until none missing.
- **Cost reality.** Scene `images.edit` with uploaded refs ≈ **$0.15–0.20/image** at
  medium (input-image tokens dominate — NOT the ~$0.02 generate price the harness
  prints). Text-only portraits ≈ **1.3¢/image**. Re-estimate batches on that basis.
- **`--publish`** writes the full-res master (`art-originals/`, gitignored), the
  committed `site/public/art/<collection>/<slug>.webp`, and the frontmatter `art{}`.
  Without it, output is a gitignored smoke to `art-smoke/`. Both generators are
  **idempotent**: they skip `art.status: generated` unless `--force`.

---

## Mode: `scene` — episode / arc recap plate

Composites established entity masters INTO the scene (max likeness) — the opposite of
the portrait lane. Reads the brief from `scripts/gen/episodes.json` (episodes) or
`arcs.json` (arcs).

**Argument:** an episode slug (`e162`) or arc slug (`03-…`).

1. **Confirm the brief exists.** For an episode the `ingest-episode` skill should have
   appended it (Step 7b). If `scene_gen.py` reports "no brief", run
   `./.venv/bin/python add_episode_brief.py <slug>` (reads the frontmatter art block
   → episodes.json). For arcs, the brief is already in `arcs.json`.
2. **Dry-run** to verify entity resolution (which `key_entities` get reference masters
   vs. render from text — `*` marks an attached ref):
   ```
   cd scripts/gen
   ./.venv/bin/python scene_gen.py --collection episodes --slug <slug> --publish --dry-run
   ```
   Unresolved entities print `· unresolved entity:` — fix via `canon/glossary.md`
   aliases or a glossary descriptor before spending.
3. **Generate (publish).** Single slug = its own billing pre-flight:
   ```
   ./.venv/bin/python scene_gen.py --collection episodes --slug <slug> --publish --yes
   ```
   (`--collection arcs` for arcs. `--force` to redo a `generated` plate. `--max-refs N`
   caps attached refs, default 4. `--quality high` for hero plates — slower, pricier.)
4. **Mop-up check (disk-is-truth):** confirm `site/public/art/episodes/<slug>.webp`
   and `art-originals/episodes/<slug>.png` exist, and the frontmatter flipped to
   `status: generated`. If a batch left gaps, re-run the missing slugs sequentially.
5. **Thumbnail** (page lists + home cards need it; idempotent):
   ```
   ./.venv/bin/python thumbs.py --collection episodes
   ```
6. **Rebuild changelog** so the new-art row can surface (git-history driven — the row
   lights up once the `.webp` is committed):
   ```
   node ../changelog/build.mjs
   ```
7. **Report**: the plate path, that status flipped to generated, thumbnail built,
   changelog rebuilt. Remind Phil to **restart the dev server** if this is the first
   art on a brand-new episode page (the glob loader doesn't pick up the new frontmatter
   live), and that nothing is committed.

> Batch (e.g. several pending episodes or all arcs): pre-flight one slug, then 4
> `run_in_background` workers each running `scene_gen.py --slug … --publish` on a
> disjoint slug, then the disk-is-truth mop-up loop, then thumbs + changelog once.

## Mode: `portrait` — entity portrait (text-only lane)

Pure text-to-image — **never upload reference pixels** (uploading clones the pose;
Phil wants likeness from attributes, not replication). For PCs/NPCs/locations/etc.

**Argument:** an entity dossier slug (e.g. `quinton`, `mally-grisham`).

1. **Find/author the brief** in `scripts/gen/briefs/<collection>.json` (a list of
   `{slug, collection, name, role, type, eligibility, visual, ref_images}`;
   `type` ∈ `portrait|landscape|crest|object` by collection). If absent, add an entry
   built from the `canon/` dossier (canon wins on conflicts).
2. **If Jon/Phil supplied a reference image:** VIEW it (Read tool), **extract visual
   attributes to TEXT** (hair/skin/scale color, key features, costume, palette) and
   merge into the brief's `visual`. Copy the ref to `refs/<slug>/` (gitignored) for
   provenance and list it in the brief's `ref_images` (metadata only — generation
   stays text-only via `images.generate`). **Do NOT pass it to the API.**
3. **Generate.** `--from-briefs` publishes by default (master + committed WebP +
   frontmatter) — there is **no `--publish` flag** on `generate.py`. It's idempotent
   (skips `status: generated`); add `--force` to redo:
   ```
   cd scripts/gen
   ./.venv/bin/python generate.py --from-briefs --only-slugs <slug> --yes
   ```
   (`--force` to redo a `generated` portrait. `--quality high` for a hero portrait.)
4. **Mop-up check:** confirm `site/public/art/<collection>/<slug>.webp` +
   `art-originals/<collection>/<slug>.png` exist and the dossier frontmatter `art{}`
   updated.
5. **Rebuild changelog** (`node ../changelog/build.mjs`) and report. Note the Astro
   glob caveat for brand-new dossier `.md` files (restart needed); nothing committed.

> Batch of portraits: same 4-worker / pre-flight-one / disk-is-truth-mop-up pattern,
> using `--only-slugs a,b,c,d` split across the background workers.
