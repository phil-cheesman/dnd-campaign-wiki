# Alambor Wiki — Known Issues

Tracked follow-ups for the Phase 1 MVP. Newest first.

---

## #1 — Glossary aliases don't attach to dossiers whose `name` has a parenthetical

**Status:** resolved (b3e38ff → wiki-mvp) · **Severity:** medium (alias coverage gap + misleading build stat)

**Resolution**
Added `stripNameDecoration` / `nameMatchKey` in `src/lib/normalize.ts` and keyed
`byName` (and the glossary lookup) on the parenthetical-stripped name on both sides,
so `glossary-parser` and `alias-index` reduce a name to the same form. Verified:
`Adune`, `Ford`, `Mally`, `Princess Anabel`, `Nardif` now resolve to their dossiers
and gain their full glossary alias sets (e.g. Adune now links `Hadoon`,
`High Counsilor Adune`, `Morgan Wrath Tifar`, …). Unmatched count 749 → 740; the
remaining 740 is the genuine content backlog (the Note below), not false negatives.

<details><summary>Original report</summary>


**Symptom**
The build logs "749 glossary entries without a dossier", but the count is inflated.
Entities that *do* have a dossier are reported as unmatched — e.g. `Adune` is the first
"unmatched" NPC even though `canon/npcs/adune.md` exists.

**Root cause**
`src/lib/alias-index.ts` resolves a glossary entry to a dossier by matching the glossary's
canonical name against each dossier's `name` field (via `matchKey`). But the two sides
normalize differently:

- The **glossary parser** (`src/lib/glossary-parser.ts`) strips a trailing parenthetical
  from the bold name: `**Adune (Morgenrath Gafar)**` → `Adune`.
- The **dossier side** uses the raw frontmatter `name` verbatim: `Adune (Morgenrath Gafar)`.

So `byName` is keyed on `adune (morgenrath gafar)` while the glossary looks up `adune` —
no match. The dossier's *own* frontmatter aliases still feed the index (so `Adune` is
still linkable), but the entry's **glossary-only aliases never attach**, and it's wrongly
counted as unmatched.

**Affected entities**
Any dossier whose `name` carries a parenthetical/quoted clause, e.g.:
`Adune (Morgenrath Gafar)`, `Ford (Fjord)`, `Mally "Molly" Grisham, the Sparrow`,
`Benjamin "Benny"`, `Princess Anabel (Annabella / Anabelle)`, `Nardif Darksi, the Nightmare King (Nardeef)`.

**Fix (sketch)**
Normalize both sides identically when building the name-match key — strip trailing
parentheticals (and ideally the `, the X` epithet and surrounding quotes) from the
**dossier** name too before keying `byName`, mirroring `glossary-parser`. Factor the
strip into one shared helper so the two code paths can't drift again. After the fix:

- the unmatched-glossary count should drop substantially (parenthetical-name dossiers
  stop being false negatives),
- those dossiers gain their full glossary alias set in the autolink index.

**Verify**
`npm run build` → the alias-artifact log no longer lists `Adune`, `Ford`, etc. under
"glossary entries without a dossier"; `dist/alias-index.json` `unmatchedGlossary` shrinks
and the genuine gaps (entities with truly no dossier) remain.

**Note (separate, not a bug):** the *genuine* remainder of the unmatched set is the
content backlog — minor NPCs/locations/items/ships/events mentioned in play but without
their own dossier yet, plus SRD-standard deities/monsters/items that arguably should
autolink out to 5e.tools rather than get internal pages. Triage that separately from this
matching fix.
</details>
