export const meta = {
  name: 'phase-b1-player-safe-enrich',
  description: 'Phase B1: enrich canon/ from Jon\'s player-safe DM worldbuilding docs (kingdoms/cities/factions/backstories), promote spellings, draft questionnaire answers',
  phases: [
    { title: 'Extract', detail: 'one read-only agent per player-safe doc → structured entity/spelling/visual/questionnaire proposals' },
    { title: 'Plan', detail: 'single synthesis agent dedupes entities across all docs → rename list, write-orders, glossary/questionnaire plan' },
    { title: 'Promote', detail: 'single agent: git mv spelling renames + _spelling-conflicts.md + glossary canonical flips' },
    { title: 'Write', detail: 'parallel dossier writers, one per target file (kingdoms/locations/factions/characters/npcs/items)' },
    { title: 'Reconcile', detail: 'single agent: glossary alias merge, timeline, questionnaire answers, Phase B1 coverage report' },
  ],
}

// ---------------------------------------------------------------------------
// Shared context handed to every agent. The repo conventions are non-negotiable.
// ---------------------------------------------------------------------------
const REPO = '/Users/phillipcheesman/Developer/alambor-campaign'

const PREAMBLE = `You are working in the Alambor D&D campaign wiki repo at ${REPO}.
This is Phase B1 of ingesting the DM (Jon)'s authoritative worldbuilding docs into canon/.

HARD RULES (override any instinct):
- sources/dm-docs/ is an IMMUTABLE input layer — READ it, NEVER edit it. All writes go in canon/.
- GLOSSARY-FIRST: resolve every name through canon/glossary.md aliases BEFORE concluding it is new. Never create a second dossier for a spelling variant — add the variant as an alias instead. The glossary deliberately lists misspellings.
- FACTS-ONLY: never invent or embellish beyond what a source says. Mark uncertain inferences with "(?)".
- SPOILER / PUBLIC-REPO SAFETY: this repo is intended to go PUBLIC. canon/ is committed. Current play is ~episode E161, so a fact is "player-safe" only if the players have plausibly already encountered/learned it by E161. Even inside a doc folder marked player-safe, individual facts may be DM-only secrets (an unrevealed true identity, an intended-but-never-happened plot, a dungeon solution players bypassed, anything set in the future beyond current play, or DM meta like real-world inspiration names). Do NOT write any such DM-only fact into committed canon/. When genuinely unsure, leave it OUT of canon/ and flag it in your structured output for the DM review packet. Fail safe.
- DM META / placeholder names: Jon sometimes uses real-world inspiration shorthand (e.g. an NPC named after a real-world historical figure; the "Maena and Alambor Overlay" meaning the world map is traced over a real-world map). These are author devices, NOT in-world canon — never surface them in player-facing prose; flag them.
- Spelling decision (already made by the user): Jon's PROSE docs are the spelling authority. Where Jon's canonical spelling differs from current canon, the canon file gets renamed and the glossary canonical flipped (old spelling demoted to alias). Where Jon conflicts with HIMSELF (e.g. Kirkenwall vs Kierkenwall vs Kierkenvall; Quentin vs Quinton), pick one canonical and LOG the conflict — do not silently choose.

CANON DOSSIER FORMAT (match it exactly):
- YAML frontmatter: name, aliases: [..], episodes: [E..]. Lowercase-kebab filenames.
- "# Title", then a dense facts-only narrative paragraph with episode citations like (E27), then "## Relationships / whereabouts" bullets, then "## Open questions" bullets.
- Phase B frontmatter ADDITIONS for enriched/created entities:
    sources: [dm-docs/kingdoms/gidian-empire/gidian-empire.md]   # provenance to Jon's doc(s)
    art:
      has_visual_source: true     # true when Jon's prose gives a concrete describable visual (appearance/architecture/landscape/banner)
      visual: |
        <the verbatim/condensed describable passage, for later AI image-gen>
      image: null
    dm_only: false                # committed canon is always false; isolate any secret OUT, not under a section
  Locations/cities also get: kingdom: <Gidian Empire|Carasian Kingdom|Luzonovian Sovereignty|Islands of Maadolonia|Parathia|...> and parent: <region/kingdom slug or name>.
`

// ---------------------------------------------------------------------------
// Player-safe source docs (committed, plus the 4 gitignored-but-player-safe map
// geography docs). DM-prep / sidequest / anthology / vault docs are handled in a
// separate Phase B2 workflow — NOT here.
// ---------------------------------------------------------------------------
const DOCS = [
  // kingdoms (5)
  { path: 'sources/dm-docs/kingdoms/carasian-kingdom/carasian-kingdom.md', area: 'kingdom' },
  { path: 'sources/dm-docs/kingdoms/gidian-empire/gidian-empire.md', area: 'kingdom' },
  { path: 'sources/dm-docs/kingdoms/luzonovian-sovereignty/luzonovian-sovereignty.md', area: 'kingdom' },
  { path: 'sources/dm-docs/kingdoms/maadolonia/islands-of-maadolonia.md', area: 'kingdom' },
  { path: 'sources/dm-docs/kingdoms/parathia/parathia-overview.md', area: 'kingdom' },
  // cities (16)
  { path: 'sources/dm-docs/cities/carstone/carstone.md', area: 'city' },
  { path: 'sources/dm-docs/cities/feldbruk/city-of-feldbruk-notes.md', area: 'city' },
  { path: 'sources/dm-docs/cities/goldcrest/goldcrest-notes.md', area: 'city' },
  { path: 'sources/dm-docs/cities/grillers/arcane-infinity.md', area: 'city' },
  { path: 'sources/dm-docs/cities/grillers/city-of-grillers-notes.md', area: 'city' },
  { path: 'sources/dm-docs/cities/grillers/map-of-grillers.md', area: 'city' },
  { path: 'sources/dm-docs/cities/handouts/devlin-s-journal.md', area: 'handout' },
  { path: 'sources/dm-docs/cities/handouts/false-entrance.md', area: 'handout' },
  { path: 'sources/dm-docs/cities/handouts/izzdars-messages.md', area: 'handout' },
  { path: 'sources/dm-docs/cities/handouts/starfallen-backstory.md', area: 'handout' },
  { path: 'sources/dm-docs/cities/handouts/withers-journal.md', area: 'handout' },
  { path: 'sources/dm-docs/cities/kirkenwall/city-of-kierkenwall-notes.md', area: 'city' },
  { path: 'sources/dm-docs/cities/surtree/surtree.md', area: 'city' },
  { path: 'sources/dm-docs/cities/tarlif/city-of-tarlif-notes.md', area: 'city' },
  { path: 'sources/dm-docs/cities/vallon/city-of-vallon-notes.md', area: 'city' },
  { path: 'sources/dm-docs/cities/vallon/vallon-print.md', area: 'city' },
  // factions (4)
  { path: 'sources/dm-docs/factions/the-archavists/the-archivists-overview.md', area: 'faction' },
  { path: 'sources/dm-docs/factions/the-harpers/the-harpers-overview.md', area: 'faction' },
  { path: 'sources/dm-docs/factions/the-harpers/the-harpers-overview-for-elliot.md', area: 'faction' },
  { path: 'sources/dm-docs/factions/the-knights-of-gidia/knights-of-gidia-overview.md', area: 'faction' },
  // character backstories (11)
  { path: 'sources/dm-docs/character-backstories/adun-backstory.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/berrian-marmorn.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/cruucar.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/linxes-faeyassa.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/noctis-tenebrae-backstory.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/quinton-shackleford-shack.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/reinhard-heimlick.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/torgoth-backstory.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/vane-despereaux.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/zanim-arabor.md', area: 'backstory' },
  { path: 'sources/dm-docs/character-backstories/zook-the-wizard-rock-gnome.md', area: 'backstory' },
  // worldbuilding player-safe (2)
  { path: 'sources/dm-docs/worldbuilding/campaign-2-background-information-player-info.md', area: 'worldbuilding' },
  { path: 'sources/dm-docs/worldbuilding/small-leather-pocket-book-from-pierre-beaubois.md', area: 'worldbuilding' },
  // map geography docs (player-safe content; the files live under gitignored maps/) (4)
  { path: 'sources/dm-docs/maps/dalacia/dalacia.md', area: 'region' },
  { path: 'sources/dm-docs/maps/parathia/parathia.md', area: 'region' },
  { path: 'sources/dm-docs/maps/parathia/tarlif.md', area: 'city' },
  { path: 'sources/dm-docs/maps/world-map/maena-and-alambor-overlay.md', area: 'worldmeta' },
]

// Existing canon files (so the planner maps entities to real paths instead of guessing).
const CANON_INDEX = `Existing canon/ files (map entities onto these; create new only when truly absent):
characters/: benjamin-benny, berrian, cruucar, evac, noctis, quinton, torgoth, vane, zanim, zook
npcs/: adune, baron-janis, ford, jameti-costco, king-felix, leon-janice-lj, lord-blackwood-valadon, mally-grisham, max-taldross, nardif-darksi, pierre-beaubois, princess-anabel, queen-beatrice, rasheed-soltar, trent-hightower, valinor, viola, yankee-williams, zax
locations/: avernus, blackwood-manor, carasia, corwell-keep, dalacia, evershire, gidia, goldcrest, great-rift, jazacha, kirkenwall, luzonovia, mandalonia, paratha, shadowfell, sultray, tarleaf, the-trene, vallon, vault-of-izdar
factions/: alambor-six, archivists, aum-shai, beaubois-family, canick-tribe, gidian-navy, harpers, knights-of-gidia, knights-of-theydune, pirate-trinity, shadowed-moon, the-fist, the-hive, the-kings, vithian-alliance, volstruckers, vontrice-family, widowmakers, yuan-ti, zeeven-dynasty
items/: arcane-collar, carpet-of-flying, carved-god-eyes, forged-amber, mace-of-terror, mallorys-magic-mirror, pierres-ceremonial-dagger, potentium, ring-of-x-ray-vision, rod-of-attenuation, rod-of-lordly-might, sending-stones, siren-of-the-sea-necklace, soul-leech-dagger, texair, the-sundering-book, tuning-forks, windvane, zeben-artifacts
kingdoms/: (EMPTY — new tier; create the 5 nation dossiers here)

Known spelling promotions to expect (Jon's prose wins):
- canon/locations/mandalonia.md  -> Islands of Maadolonia (Jon: "Maadolonia"/"Maadolinia")
- canon/locations/paratha.md     -> Parathia
- canon/locations/carasia.md     -> Carasian Kingdom / Carasia (verify Jon's preferred short form)
- "Gidia" stays (Jon uses Gidian Empire "Gidia").
Known SELF-conflicts to LOG (do not silently pick): Kirkenwall vs Kierkenwall vs Kierkenvall; Strathmore vs Stathmore; Wintervale vs Wintervail; Luzonovia vs Luzanovia vs Luzonivia.`

// ===========================================================================
// PHASE 1 — Extract (read-only, one agent per doc)
// ===========================================================================
phase('Extract')

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['doc', 'entities', 'spellings', 'enrichments', 'questionnaire_evidence', 'dm_only_flags', 'notes'],
  properties: {
    doc: { type: 'string' },
    entities: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['raw_name', 'canonical_guess', 'kind', 'canon_path_guess', 'is_new'],
        properties: {
          raw_name: { type: 'string' },
          canonical_guess: { type: 'string', description: 'resolved canonical name per glossary, or best display name if new' },
          kind: { type: 'string', enum: ['character', 'npc', 'location', 'city', 'region', 'kingdom', 'faction', 'item', 'god', 'event', 'other'] },
          canon_path_guess: { type: 'string', description: 'existing canon/ path it maps to, or proposed new path' },
          is_new: { type: 'boolean' },
        },
      },
    },
    spellings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name_in_doc', 'current_canon', 'relation', 'note'],
        properties: {
          name_in_doc: { type: 'string' },
          current_canon: { type: 'string', description: 'current canonical spelling + path if any, else ""' },
          relation: { type: 'string', enum: ['matches', 'promote-johns-spelling', 'self-conflict', 'new'] },
          note: { type: 'string' },
        },
      },
    },
    enrichments: {
      type: 'array',
      description: 'player-safe lore this doc contributes, grouped by the canon entity it should land in',
      items: {
        type: 'object', additionalProperties: false,
        required: ['target', 'kind', 'lore_points', 'has_visual', 'visual_passage'],
        properties: {
          target: { type: 'string', description: 'canonical entity name the lore belongs to' },
          kind: { type: 'string' },
          lore_points: { type: 'array', items: { type: 'string' }, description: 'facts-only bullets, player-safe ONLY' },
          has_visual: { type: 'boolean' },
          visual_passage: { type: 'string', description: 'condensed describable appearance/architecture/landscape/banner text, or ""' },
        },
      },
    },
    questionnaire_evidence: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['q_num', 'answer', 'evidence'],
        properties: {
          q_num: { type: 'integer' },
          answer: { type: 'string', enum: ['yes', 'no', '?'] },
          evidence: { type: 'string', description: 'one-line cited evidence from THIS doc' },
        },
      },
    },
    dm_only_flags: {
      type: 'array',
      description: 'facts in this player-safe doc that are actually DM-only secrets / meta / future / placeholder names — kept OUT of canon, routed to the DM packet',
      items: {
        type: 'object', additionalProperties: false,
        required: ['content', 'reason', 'confidence'],
        properties: {
          content: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    notes: { type: 'string' },
  },
}

const QLIST = `Questionnaire questions these docs can plausibly settle (cite from the doc): Q5 (who/what is Linxes — the linxes-faeyassa backstory answers this), Q11 Gruier=Grellier/Grier, Q12 Gold's Crest=Goldcrest, Q13 Disacka=Dalacia, Q14 Balom=Vallon (capital of Carasia + wedding venue), Q16 Zyldron vs Zildran (Linxes lives in "Zildron"/the heavens), Q17 Wintervail=Winterdale (Gidian doc has Wintervale province), Q18 Xivian/Xevin=Zeeven dynasty, Q24 Great Calamity=Sundering, Q25 Alborama=Arbor Alma, Q26 Arethus=Erathis, and any place/name merges the kingdom & city docs settle. Only answer Qs this specific doc gives evidence for.`

const extractions = await pipeline(
  DOCS,
  (d) => agent(
    `${PREAMBLE}\n\nTASK: Read ONLY this one source doc: ${d.path} (area: ${d.area}). Also read canon/glossary.md to resolve names. Do NOT write anything.\n\nProduce a structured extraction:\n1. entities: every named person/place/faction/item/god, each resolved through the glossary to its canonical name + existing canon path (or marked is_new with a proposed path/kind).\n2. spellings: for each proper name, whether Jon's spelling matches current canon, should PROMOTE over canon, is a SELF-conflict (Jon inconsistent), or is new.\n3. enrichments: the player-safe, facts-only lore this doc adds, grouped by target canon entity. Include rich describable visuals (has_visual + condensed passage) for image-gen wherever Jon's prose paints architecture/landscape/appearance/banners.\n4. questionnaire_evidence: ${QLIST}\n5. dm_only_flags: anything in here that is actually a DM-only secret / future / meta / real-world placeholder name — keep it OUT of enrichments and flag it.\n\nBe exhaustive on entities and spellings; be conservative (fail-safe) on what counts as player-safe.`,
    { label: `extract:${d.path.split('/').slice(-1)[0]}`, phase: 'Extract', schema: EXTRACT_SCHEMA }
  )
).then((rs) => rs.filter(Boolean))

log(`Extracted ${extractions.length}/${DOCS.length} docs`)

// ===========================================================================
// PHASE 2 — Plan (single synthesis agent, barrier: needs ALL extractions)
// ===========================================================================
phase('Plan')

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['renames', 'self_conflicts', 'write_orders', 'glossary_alias_adds', 'questionnaire', 'dm_packet', 'summary'],
  properties: {
    renames: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['old_path', 'new_path', 'canonical_name', 'demoted_aliases', 'reason'],
        properties: {
          old_path: { type: 'string' }, new_path: { type: 'string' },
          canonical_name: { type: 'string' },
          demoted_aliases: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
      },
    },
    self_conflicts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['entity', 'variants', 'chosen', 'where'],
        properties: {
          entity: { type: 'string' },
          variants: { type: 'array', items: { type: 'string' } },
          chosen: { type: 'string' },
          where: { type: 'string', description: 'which docs disagree' },
        },
      },
    },
    write_orders: {
      type: 'array',
      description: 'ONE per final canon target file. Dedupe: all docs touching an entity merge into one order. Keep minor entities folded into a parent dossier order rather than spawning a tiny file.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['target_path', 'kind', 'action', 'title', 'source_docs', 'lore_points', 'has_visual', 'visual_passage', 'kingdom', 'parent', 'aliases_to_add'],
        properties: {
          target_path: { type: 'string', description: 'canon/... final path' },
          kind: { type: 'string' },
          action: { type: 'string', enum: ['create', 'enrich'] },
          title: { type: 'string' },
          source_docs: { type: 'array', items: { type: 'string' } },
          lore_points: { type: 'array', items: { type: 'string' } },
          has_visual: { type: 'boolean' },
          visual_passage: { type: 'string' },
          kingdom: { type: 'string', description: 'for locations/cities, else ""' },
          parent: { type: 'string', description: 'for locations/cities, else ""' },
          aliases_to_add: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    glossary_alias_adds: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['canonical_name', 'section', 'new_aliases'],
        properties: {
          canonical_name: { type: 'string' },
          section: { type: 'string', enum: ['Player characters', 'NPCs', 'locations', 'factions', 'items', 'other'] },
          new_aliases: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    questionnaire: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['q_num', 'answer', 'evidence'],
        properties: { q_num: { type: 'integer' }, answer: { type: 'string' }, evidence: { type: 'string' } },
      },
    },
    dm_packet: {
      type: 'array',
      description: 'consolidated DM-only flags across all docs, for FOR-JON--spoiler-review.md',
      items: {
        type: 'object', additionalProperties: false,
        required: ['source', 'content', 'reason', 'confidence'],
        properties: { source: { type: 'string' }, content: { type: 'string' }, reason: { type: 'string' }, confidence: { type: 'string' } },
      },
    },
    summary: { type: 'string' },
  },
}

const plan = await agent(
  `${PREAMBLE}\n\n${CANON_INDEX}\n\nTASK: You are the synthesis/planner. Below are structured extractions from ${extractions.length} player-safe DM docs. Dedupe entities ACROSS all docs and produce one coherent plan. You may Read canon/glossary.md and any existing canon file to decide create-vs-enrich and final paths. Do NOT write files.\n\nProduce:\n- renames: spelling promotions (git mv old canon path -> Jon's canonical). Definitely the 5-nation tier: create canon/kingdoms/{gidian-empire,carasian-kingdom,luzonovian-sovereignty,islands-of-maadolonia,parathia}.md AND handle the existing locations/{mandalonia,paratha,carasia}.md — decide whether each becomes a kingdoms/ dossier (rename) with a thin locations/ stub, or stays a region. Recommend: kingdoms/ holds the nation dossier; keep a locations/ entry only if it names a distinct city/region. Be explicit and conservative; preserve git history via git mv.\n- self_conflicts: every case where Jon disagrees with himself (Kirkenwall/Kierkenwall, Strathmore/Stathmore, Wintervale/Wintervail, Luzonovia spellings, Quentin/Quinton, etc.) with the variant you chose and why.\n- write_orders: ONE per final canon file. Merge all lore for an entity into its single order. New cities (Feldbruk, Surtree, Carstone, Tarlif, Grillers) and the 5 kingdoms will be 'create'; existing dossiers 'enrich'. Set kingdom/parent for places. Carry the best visual passage.\n- glossary_alias_adds, questionnaire (dedupe Q evidence into one answer per Q), dm_packet (consolidated).\nKeep player-safety paramount: never route a DM-only fact into a write_order.`,
  { label: 'plan:synthesis', phase: 'Plan', schema: PLAN_SCHEMA }
)

log(`Plan: ${plan.write_orders.length} write-orders, ${plan.renames.length} renames, ${plan.self_conflicts.length} self-conflicts, ${plan.dm_packet.length} DM-only flags`)

// ===========================================================================
// PHASE 3 — Promote (single serial agent: renames + conflict log + glossary canonical flips)
// ===========================================================================
phase('Promote')

await agent(
  `${PREAMBLE}\n\nTASK: Execute the spelling promotions and conflict log. Work serially; you are the ONLY agent touching glossary.md right now.\n\nRENAMES (apply each): ${JSON.stringify(plan.renames, null, 2)}\nFor each rename: if old_path exists, run \`git mv <old_path> <new_path>\` (create parent dirs first; for the kingdoms tier the new file may not pre-exist — if old_path does not exist, just note it for the Write phase to create). Then in canon/glossary.md flip the canonical name to Jon's spelling and demote the old spelling into that entry's alias list. Do not delete any alias.\n\nSELF-CONFLICTS: write canon/_spelling-conflicts.md (a NEW committed file) listing each conflict: entity, the variants Jon used, which you chose as canonical, where they disagree, and a one-line ask for Jon to confirm. Format as a readable markdown table or list with a short intro.\n\nDO NOT enrich dossier bodies here (the Write phase does that). Only: renames, glossary canonical/alias for renamed entities, and the conflict log. Use Bash for git mv, Read/Edit/Write for files.\n\nSELF_CONFLICTS DATA: ${JSON.stringify(plan.self_conflicts, null, 2)}`,
  { label: 'promote:renames+conflicts', phase: 'Promote' }
)

// ===========================================================================
// PHASE 4 — Write (parallel, one agent per distinct target file)
// ===========================================================================
phase('Write')

const writes = await parallel(
  plan.write_orders.map((wo) => () => agent(
    `${PREAMBLE}\n\nTASK: ${wo.action.toUpperCase()} the single canon file ${wo.target_path} (kind: ${wo.kind}). You own ONLY this file — do not touch glossary.md, timeline, or any other file.\n\nSteps:\n1. Read the cited source doc(s): ${JSON.stringify(wo.source_docs)} (read them fully for fidelity).\n2. Read canon/glossary.md to confirm canonical name + aliases.\n3. If action=enrich, Read the existing ${wo.target_path} and PRESERVE all its existing content and episode citations; weave Jon's authoritative lore in where it extends or corrects (note corrections, don't delete played facts), and add a "## From Jon's worldbuilding docs" section for the rich detail (provinces, lineage, festivals, economy, geography, etc.). If action=create, write a full dossier in house format.\n4. Frontmatter: name, aliases (add ${JSON.stringify(wo.aliases_to_add)} plus any you find), episodes (keep existing; add none speculative). Add sources: ${JSON.stringify(wo.source_docs)}; dm_only: false; art: with has_visual_source ${wo.has_visual} and the visual passage; image: null.${wo.kingdom ? ` Add kingdom: "${wo.kingdom}".` : ''}${wo.parent ? ` Add parent: "${wo.parent}".` : ''}\n5. Facts-only, "(?)" for inference. NOTHING DM-only or spoilery — current play ~E161. If you discover a secret in the source, OMIT it (it is handled elsewhere).\n\nLORE POINTS to incorporate (player-safe, from the planner): ${JSON.stringify(wo.lore_points, null, 2)}\nVISUAL: ${wo.visual_passage || '(none)'}\nTitle: ${wo.title}`,
    { label: `write:${wo.target_path.split('/').slice(-1)[0]}`, phase: 'Write' }
  ).then(() => wo.target_path))
).then((rs) => rs.filter(Boolean))

log(`Wrote/enriched ${writes.length}/${plan.write_orders.length} dossiers`)

// ===========================================================================
// PHASE 5 — Reconcile (single serial agent: glossary aliases, timeline, questionnaire, coverage report)
// ===========================================================================
phase('Reconcile')

const report = await agent(
  `${PREAMBLE}\n\nTASK: Final reconcile. You run alone after all writes. Do these, carefully:\n\n1. GLOSSARY: apply these alias additions to canon/glossary.md (add to the right entry's aliases; never remove; keep the canonical promotions the Promote phase already made): ${JSON.stringify(plan.glossary_alias_adds, null, 2)}\n\n2. QUESTIONNAIRE: in canon/dm-questionnaire.md, fill the \`→\` line under each answered question with the answer + one-line cited evidence. Leave genuinely unresolved ones untouched/flagged. Answers: ${JSON.stringify(plan.questionnaire, null, 2)}\n\n3. TIMELINE: if canon/arcs/timeline.md needs any new kingdom/place anchors or corrections implied by the worldbuilding (e.g. founding dates 17 P.T., the Council of Reckoning / the Trine), add brief notes — but do NOT invent episode events. Keep it light and facts-only.\n\n4. DM PACKET: write canon/FOR-JON--spoiler-review.md (this path is GITIGNORED — confirm with \`git check-ignore canon/FOR-JON--spoiler-review.md\`). Include each consolidated DM-only flag: source location, the flagged content, your reason, confidence, and a hide-vs-surface ask. Data: ${JSON.stringify(plan.dm_packet, null, 2)}. Also note the real-world placeholder names (an NPC named after a real-world historical figure; Maena/Alambor overlay) and recommend in-world display names.\n\n5. COVERAGE REPORT: write canon/_phase-b1-coverage.md (committed, MUST be spoiler-free) summarizing: docs processed, files created vs enriched, kingdoms tier added, spelling promotions + self-conflicts logged, questionnaire questions answered, count of DM-only items routed to the packet (counts only, no spoiler content).

Verify before finishing: run \`git check-ignore -v canon/FOR-JON--spoiler-review.md canon/_dm-only 2>/dev/null\` and confirm the packet is ignored. Return a concise plain-text summary of everything you changed (for the human operator).`,
  { label: 'reconcile', phase: 'Reconcile' }
)

return { report, plan_summary: plan.summary, write_count: writes.length, renames: plan.renames.length, conflicts: plan.self_conflicts.length, dm_flags: plan.dm_packet.length }
