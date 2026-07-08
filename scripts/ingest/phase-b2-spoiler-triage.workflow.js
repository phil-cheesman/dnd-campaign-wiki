export const meta = {
  name: 'phase-b2-dm-prep-spoiler-triage',
  description: 'Phase B2: triage Jon\'s gitignored DM-prep docs into a gitignored DM-only quarantine + the Jon review packet, with a strict adversarial spoiler-gate before any committed episode backfill',
  phases: [
    { title: 'Triage', detail: 'one read-only agent per DM-prep doc → facts classified player-safe-played vs DM-only, with targets' },
    { title: 'Plan', detail: 'single synthesis agent consolidates → quarantine orders, packet items, committed-backfill candidates' },
    { title: 'Quarantine', detail: 'parallel writers → canon/_dm-only/<entity>.md (gitignored)' },
    { title: 'SpoilerGate', detail: 'adversarial verifier per backfill candidate; default-reject if not provably player-known by E161' },
    { title: 'Backfill', detail: 'parallel writers append ONLY gate-confirmed player-safe facts to committed episode/dossier pages' },
    { title: 'Reconcile', detail: 'append rejects to packet, B2 coverage report, verify gitignore' },
  ],
}

const REPO = '/Users/phillipcheesman/Developer/alambor-campaign'
const CURRENT_PLAY = 'E161'

const PREAMBLE = `You are working in the Alambor D&D campaign wiki repo at ${REPO}, Phase B2.
You are triaging the DM (Jon)'s RAW PREP docs — the most spoiler-dense material in the project.

HARD RULES (override any instinct):
- sources/dm-docs/ is IMMUTABLE — READ, never edit. All writes go in canon/.
- These prep docs are GITIGNORED and local-only BECAUSE they are spoilers. The repo goes PUBLIC. Current play is ~${CURRENT_PLAY}.
- A fact may be written into COMMITTED canon/ ONLY if the players have demonstrably ALREADY EXPERIENCED/LEARNED it in actual play at or before ${CURRENT_PLAY}. Prep is what Jon PLANNED — it routinely diverges from what happened. Treat as DM-ONLY (never commit): unrevealed true identities, villain plans not yet sprung, dungeon layouts/solutions/puzzle answers, stat blocks, "evil boss TBD", phylactery/lich mechanics, anything in a FUTURE/endgame arc (e.g. "Final Ziven Ruin", anything tagged 1XX or beyond ${CURRENT_PLAY}), and DM meta (real-world module reskins, 5e.tools/published-module references, inspiration names).
- external_reference docs (a-complete-guide-to-lichdom, lich, Limithron naval guide) are 3rd-party/published content — EXCLUDE from canon entirely; just note them.
- GLOSSARY-FIRST name resolution (read canon/glossary.md). FACTS-ONLY, "(?)" for inference.
- FAIL SAFE: when unsure whether a fact is player-known, classify it DM-only. It is far worse to leak a spoiler into committed canon/ than to over-quarantine.

TWO DESTINATIONS:
1. canon/_dm-only/<entity-slug>.md  — GITIGNORED quarantine. The rich DM-only truth, organized by entity. Safe to be thorough here.
2. canon/FOR-JON--spoiler-review.md — GITIGNORED packet (already exists from B1; you APPEND). For hide-vs-surface judgment calls.
Committed canon/episodes/eNNN.md + dossiers receive ONLY gate-confirmed, already-played facts, appended under a clearly labeled section.`

// 44 gitignored DM-prep docs. external=true => exclude from canon (note only).
const DOCS = [
  { path: 'sources/dm-docs/worldbuilding/anthology-notes.md', span: 'E00-arc opening prep' },
  { path: 'sources/dm-docs/worldbuilding/vault-of-izzdar-notes.md', span: 'E103-110 dungeon (ToA reskin)' },
  { path: 'sources/dm-docs/worldbuilding/campaign-2-log-for-the-boys.md', span: 'whole-campaign log/registry' },
  { path: 'sources/dm-docs/sidequests/the-alpha-and-the-omega/the-alpha-and-the-omega.md', span: 'sidequest' },
  { path: 'sources/dm-docs/sidequests/the-black-dread/lj-and-the-dragon.md', span: 'E69-90 Black Dread' },
  { path: 'sources/dm-docs/sidequests/the-rotten-mother-and-the-white-knights-of-thadun/the-rotten-mother-and-the-white-knights-of-thadun.md', span: 'E80-131' },
  { path: 'sources/dm-docs/episode-prep/episode-103-110-vault-of-izzdar/episode-103-the-rift.md', span: 'E103' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/episode-113-ankhor-market-showdown.md', span: 'E113' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/episode-114-the-harpers-showdown.md', span: 'E114' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/episode-114-the-vermelock.md', span: 'E114' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/episode-120-125-the-shadowfell.md', span: 'E120-125' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/episode-126-127-the-tower-of-illmoor.md', span: 'E126-127' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/episode-128-131-dash-to-the-sorrowshade-and-the-rotten-mother.md', span: 'E128-131' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/episode-132-farwell-berrian.md', span: 'E132' },
  { path: 'sources/dm-docs/episode-prep/episode-113-133-the-knights-of-thadun/the-rotten-mother-and-the-white-knights-of-thadun.md', span: 'E113-133' },
  { path: 'sources/dm-docs/episode-prep/episode-133-138-the-betrayal/death-of-a-king.md', span: 'E133-138' },
  { path: 'sources/dm-docs/episode-prep/episode-133-138-the-betrayal/fallout-campaign-arch-3-kickoff.md', span: 'E133-138' },
  { path: 'sources/dm-docs/episode-prep/episode-133-138-the-betrayal/letter-from-the-shadowed-moon.md', span: 'E133-138' },
  { path: 'sources/dm-docs/episode-prep/episode-133-138-the-betrayal/the-shadowed-moon-tower.md', span: 'E133-138' },
  { path: 'sources/dm-docs/episode-prep/episode-133-138-the-betrayal/the-shadowed-moon-transcript.md', span: 'E133-138' },
  { path: 'sources/dm-docs/episode-prep/episode-133-138-the-betrayal/the-shadowed-moon-unmasking.md', span: 'E133-138' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/adun-backstory.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/donum-vite.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/donum-vite-2.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/donum-vitemesis-cordisartifacts.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/information-for-berrian.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/kuro-and-berrian-s-news.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/morgenrath-adun-backstory.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/noctis-and-berrian-plans.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/the-archivists-overview.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/updated-story-berrian-noctis.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/whisper-of-the-verdant-veil.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-139-141-donum-vite/ziven-dynasty-sundering.md', span: 'E139-141' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/a-pirates-life-for-me-ep-146-149.md', span: 'E146-149' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/anchors-rest.md', span: 'E142+ (endgame)' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/annals-of-the-kings-rulers-and-gods-pre-sundering.md', span: 'lore' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/dead-men-tell-no-tales-ep-150-152.md', span: 'E150-152' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/on-the-high-seas-ep-143-145.md', span: 'E143-145' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/potentium/potentium-spells-forest.md', span: 'mechanics' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/race-to-jazaka-ep-157-159.md', span: 'E157-159' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/ships/wrecked-at-the-reef.md', span: 'ships' },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/the-forbidden-temple-ep-160-161.md', span: 'E160-161 (at play edge)' },
  // external_reference — exclude from canon
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/a-complete-guide-to-lichdom.md', span: 'EXTERNAL', external: true },
  { path: 'sources/dm-docs/episode-prep/episodes-142-1xx-final-ziven-ruin/lich.md', span: 'EXTERNAL', external: true },
]

// ===========================================================================
// PHASE 1 — Triage (read-only, one agent per prep doc)
// ===========================================================================
phase('Triage')

const TRIAGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['doc', 'is_external', 'dm_only_points', 'backfill_candidates', 'packet_items', 'entities', 'notes'],
  properties: {
    doc: { type: 'string' },
    is_external: { type: 'boolean' },
    dm_only_points: {
      type: 'array', description: 'DM-only truths for the quarantine, grouped by entity',
      items: {
        type: 'object', additionalProperties: false,
        required: ['entity', 'slug', 'points'],
        properties: {
          entity: { type: 'string' },
          slug: { type: 'string', description: 'kebab slug for canon/_dm-only/<slug>.md' },
          points: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    backfill_candidates: {
      type: 'array', description: 'facts you believe players ALREADY experienced by ' + CURRENT_PLAY + ' and could backfill committed canon. Be conservative.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['target', 'episode', 'fact', 'why_player_safe'],
        properties: {
          target: { type: 'string', description: 'canon/episodes/eNNN.md or a canon dossier path' },
          episode: { type: 'string' },
          fact: { type: 'string' },
          why_player_safe: { type: 'string', description: 'the in-play evidence it was revealed by ' + CURRENT_PLAY },
        },
      },
    },
    packet_items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['content', 'reason', 'confidence'],
        properties: { content: { type: 'string' }, reason: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] } },
      },
    },
    entities: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const triage = await pipeline(
  DOCS,
  (d) => agent(
    `${PREAMBLE}\n\nTASK: Read ONLY ${d.path} (span: ${d.span}${d.external ? '; EXTERNAL reference — exclude from canon, return is_external:true with a one-line note only' : ''}). Read canon/glossary.md for names. Do NOT write.\n\nClassify every substantive fact:\n- dm_only_points: unrevealed truths / plans / dungeon solutions / future-arc / meta — grouped by the entity they belong to (for the quarantine).\n- backfill_candidates: ONLY facts the players have demonstrably already lived through by ${CURRENT_PLAY} (e.g. a recap of an event in an episode ≤${CURRENT_PLAY} that clearly happened in play). Each needs concrete in-play justification. When in doubt, put it in dm_only_points instead.\n- packet_items: hide-vs-surface judgment calls for Jon.\nRemember: this is PREP — divergence from play is the default assumption. Fail safe.`,
    { label: `triage:${d.path.split('/').slice(-1)[0]}`, phase: 'Triage', schema: TRIAGE_SCHEMA }
  )
).then((rs) => rs.filter(Boolean))

log(`Triaged ${triage.length}/${DOCS.length} prep docs`)

// ===========================================================================
// PHASE 2 — Plan (barrier: consolidate across all docs)
// ===========================================================================
phase('Plan')

const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['quarantine_orders', 'backfill_candidates', 'packet_items', 'external_excluded', 'summary'],
  properties: {
    quarantine_orders: {
      type: 'array', description: 'ONE per canon/_dm-only/<slug>.md file; merge all docs\' points for an entity',
      items: {
        type: 'object', additionalProperties: false,
        required: ['slug', 'title', 'source_docs', 'points'],
        properties: {
          slug: { type: 'string' }, title: { type: 'string' },
          source_docs: { type: 'array', items: { type: 'string' } },
          points: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    backfill_candidates: {
      type: 'array', description: 'deduped; each gets adversarially gated before any commit',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'target', 'episode', 'fact', 'why_player_safe', 'source_doc'],
        properties: {
          id: { type: 'string' }, target: { type: 'string' }, episode: { type: 'string' },
          fact: { type: 'string' }, why_player_safe: { type: 'string' }, source_doc: { type: 'string' },
        },
      },
    },
    packet_items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['source', 'content', 'reason', 'confidence'],
        properties: { source: { type: 'string' }, content: { type: 'string' }, reason: { type: 'string' }, confidence: { type: 'string' } },
      },
    },
    external_excluded: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const plan = await agent(
  `${PREAMBLE}\n\nTASK: Synthesis/planner. Below are triage results from ${triage.length} prep docs. Consolidate across them. You may Read canon/glossary.md and existing canon files. Do NOT write.\nProduce:\n- quarantine_orders: one per DM-only entity file (canon/_dm-only/<slug>.md), merging all points.\n- backfill_candidates: the deduped list of already-played facts to consider for committed canon. Assign each a stable id. STAY CONSERVATIVE — drop anything you are not confident the players learned by ${CURRENT_PLAY}.\n- packet_items: consolidated hide-vs-surface calls.\n- external_excluded: external_reference docs excluded.\n\nTRIAGE DATA:\n${JSON.stringify(triage, null, 2)}`,
  { label: 'plan:consolidate', phase: 'Plan', schema: PLAN_SCHEMA }
)

log(`Plan: ${plan.quarantine_orders.length} quarantine files, ${plan.backfill_candidates.length} backfill candidates (pre-gate), ${plan.packet_items.length} packet items`)

// ===========================================================================
// PHASE 3 — Quarantine (parallel, gitignored writes — safe)
// ===========================================================================
phase('Quarantine')

const quarantined = await parallel(
  plan.quarantine_orders.map((q) => () => agent(
    `${PREAMBLE}\n\nTASK: Write the GITIGNORED quarantine file canon/_dm-only/${q.slug}.md (create canon/_dm-only/ if needed; it is gitignored so this is safe and thorough). Title: ${q.title}. Read the cited source doc(s) ${JSON.stringify(q.source_docs)} for fidelity and canon/glossary.md for names. Write a clean DM-only dossier: frontmatter (name, dm_only: true, sources), a "# ${q.title}" heading, and organized facts-only prose/bullets capturing the DM-only truth. This is for Jon's eyes only — be thorough and precise.\n\nKEY POINTS: ${JSON.stringify(q.points, null, 2)}\n\nAfter writing, confirm with: git check-ignore canon/_dm-only/${q.slug}.md (must report it ignored).`,
    { label: `quarantine:${q.slug}`, phase: 'Quarantine' }
  ).then(() => q.slug))
).then((rs) => rs.filter(Boolean))

log(`Quarantined ${quarantined.length}/${plan.quarantine_orders.length} DM-only entity files`)

// ===========================================================================
// PHASE 4 — SpoilerGate (adversarial, per backfill candidate; default reject)
// ===========================================================================
phase('SpoilerGate')

const GATE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'verdict', 'reason'],
  properties: {
    id: { type: 'string' },
    verdict: { type: 'string', enum: ['player-safe', 'dm-only'] },
    reason: { type: 'string' },
  },
}

const gated = await parallel(
  plan.backfill_candidates.map((c) => () => agent(
    `${PREAMBLE}\n\nTASK (ADVERSARIAL SPOILER GATE): You are a skeptical reviewer. A candidate fact is proposed for COMMITTED, PUBLIC canon. Default to REJECT (dm-only). Approve (player-safe) ONLY if you can independently confirm the players learned this in actual play by ${CURRENT_PLAY}.\n\nTo confirm, READ the committed target page ${c.target} and, if useful, the canon/episodes/ pages and dossiers around episode ${c.episode}, plus canon/glossary.md. If the committed canon already reflects this event (showing it was played), approve. If it only appears in Jon's prep and you cannot find independent in-play corroboration, REJECT. Any unrevealed identity/plan/solution/future-arc detail → REJECT.\n\nCANDIDATE id=${c.id}, episode ${c.episode}, target ${c.target}:\nFACT: ${c.fact}\nCLAIMED player-safe because: ${c.why_player_safe}\nSOURCE (prep): ${c.source_doc}\n\nReturn the verdict with a one-line reason.`,
    { label: `gate:${c.id}`, phase: 'SpoilerGate', schema: GATE_SCHEMA }
  ))
).then((rs) => rs.filter(Boolean))

const approvedIds = new Set(gated.filter((g) => g.verdict === 'player-safe').map((g) => g.id))
const approved = plan.backfill_candidates.filter((c) => approvedIds.has(c.id))
const rejected = plan.backfill_candidates.filter((c) => !approvedIds.has(c.id))
log(`SpoilerGate: ${approved.length} approved player-safe, ${rejected.length} rejected → DM-only/packet`)

// group approved by committed target file so no two writers touch the same file
const byTarget = {}
for (const c of approved) { (byTarget[c.target] = byTarget[c.target] || []).push(c) }
const targets = Object.keys(byTarget)

// ===========================================================================
// PHASE 5 — Backfill (parallel, one writer per committed target file)
// ===========================================================================
phase('Backfill')

const backfilled = await parallel(
  targets.map((t) => () => agent(
    `${PREAMBLE}\n\nTASK: Append gate-CONFIRMED, already-played facts to the COMMITTED file ${t}. You own only this file.\nSteps:\n1. Read ${t}. Preserve ALL existing content.\n2. Append (or extend if present) a section exactly titled "## From DM prep (?)" — a note line: "Sourced from Jon's episode prep; prep can differ from play, marked (?)." Then add the facts as concise bullets, each ending with "(?)" where it is an inference about what happened.\n3. FACTS-ONLY, no spoilers — every bullet here was gate-approved as already-played by ${CURRENT_PLAY}. If on reading the page a bullet looks like it actually reveals something the page shows the players did NOT yet know, OMIT it (last-line safety).\n4. Do not touch frontmatter except you may add the source doc to a sources: list if one exists.\n\nCONFIRMED FACTS for ${t}:\n${JSON.stringify(byTarget[t].map((c) => ({ episode: c.episode, fact: c.fact, source: c.source_doc })), null, 2)}`,
    { label: `backfill:${t.split('/').slice(-1)[0]}`, phase: 'Backfill' }
  ).then(() => t))
).then((rs) => rs.filter(Boolean))

log(`Backfilled ${backfilled.length}/${targets.length} committed pages`)

// ===========================================================================
// PHASE 6 — Reconcile (serial: packet append, coverage report, gitignore verify)
// ===========================================================================
phase('Reconcile')

const report = await agent(
  `${PREAMBLE}\n\nTASK: Final reconcile for Phase B2.\n\n1. PACKET: APPEND to canon/FOR-JON--spoiler-review.md (gitignored; it already exists from B1 — add a "## Phase B2 — DM-prep triage" section, do not overwrite B1 content). Include the consolidated packet items and the gate-REJECTED backfill candidates (so Jon can choose to surface any). Packet items: ${JSON.stringify(plan.packet_items, null, 2)}\nRejected (kept DM-only): ${JSON.stringify(rejected.map((c) => ({ episode: c.episode, fact: c.fact, source: c.source_doc })), null, 2)}\n\n2. COVERAGE REPORT: write canon/_phase-b2-coverage.md (COMMITTED — MUST be spoiler-free, COUNTS ONLY, no DM-only content, no episode-specific spoilers): docs triaged, external excluded (${JSON.stringify(plan.external_excluded)}), # quarantine files written, # backfill candidates / approved / rejected by the gate, # packet items. Note the quarantine + packet are gitignored and local-only.\n\n3. VERIFY (run and report): \`git status --porcelain\` and \`git check-ignore -v canon/_dm-only canon/FOR-JON--spoiler-review.md\` — confirm NOTHING under canon/_dm-only/ and NOT the packet is staged/tracked; confirm the only NEW committed files are canon/_phase-b2-coverage.md plus the appended "## From DM prep (?)" sections in episode/dossier pages. List exactly which committed files changed.\n\nReturn a concise plain-text operator summary, explicitly listing every COMMITTED file touched so the human can review the diff.`,
  { label: 'reconcile', phase: 'Reconcile' }
)

return { report, quarantine_files: quarantined.length, approved: approved.length, rejected: rejected.length, packet_items: plan.packet_items.length, committed_backfills: backfilled.length, summary: plan.summary }
