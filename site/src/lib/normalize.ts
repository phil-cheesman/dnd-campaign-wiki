/**
 * Alias-string normalization for the auto-linker index.
 *
 * The canon aliases (frontmatter + glossary) carry annotations and cross-ref
 * junk baked into the strings — e.g. `Anthony (cover alias)`, `Molly (texair cart)`,
 * `Janette? (no — see Jeanette)`, `Alec / Roger (cover alias)`. We strip the
 * harmless annotations, drop the cross-ref/uncertain ones entirely, and suppress
 * dangerous short/common terms that would mislink.
 */

/** Min length for a case-insensitive autolink term. Shorter must be allowlisted. */
export const MIN_TERM_LENGTH = 4;

/**
 * Terms suppressed from case-insensitive autolinking — single letters, common
 * English words, and first-name fragments that collide with prose.
 */
export const BLOCKLIST = new Set(
  [
    'q', 'bo', 'max', 'ben', 'molly', 'steve', 'mally', 'tor', 'nox', 'sven',
    'ford', 'able', 'bear', 'sane', 'leon', 'elias', 'janis', 'janice', 'felix',
    'the queen', 'the king', 'the princess', 'the baron', 'the mother', 'the witch',
    'the merchant', 'the foreigner', 'the marque', 'the easterner', 'the bear',
    'mother', 'witch', 'queen', 'king', 'princess', 'baron', 'prince', 'captain',
    'pierre', 'viola', 'elias', 'atwell',
  ].map((s) => s.toLowerCase()),
);

/**
 * Short but distinctive terms allowed through despite MIN_TERM_LENGTH, matched
 * CASE-SENSITIVELY (uppercase initialisms) to avoid prose collisions.
 */
export const SHORT_ALLOWLIST_CASE_SENSITIVE = new Set(['LJ', 'BW']);

/** Build the lowercase match key for a term. */
export function matchKey(term: string): string {
  return term.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Strip a trailing parenthetical clause from an entity's canonical name, e.g.
 * `Adune (Morgenrath Tifar)` → `Adune`, `Ford (Fjord)` → `Ford`.
 *
 * Shared by the glossary parser and the alias index so both sides reduce a name
 * to the SAME form before matching — otherwise a dossier named
 * `Adune (Morgenrath Tifar)` never matches its glossary entry `Adune`, and the
 * entry's glossary-only aliases silently fail to attach (see ISSUES.md #1).
 */
export function stripNameDecoration(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

/** Match key for an entity *name*, ignoring a trailing parenthetical clause. */
export function nameMatchKey(name: string): string {
  return matchKey(stripNameDecoration(name));
}

/**
 * Normalize one raw alias/name string into a clean display term, or null if the
 * string is a cross-ref / uncertain annotation that should not be a term at all.
 */
export function normalizeAlias(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;

  // Strip surrounding quotes.
  s = s.replace(/^["'`]+|["'`]+$/g, '').trim();

  // Cross-ref / uncertain markers → drop the whole alias.
  // e.g. `Janette? (no — see Jeanette)`, `(E24 letter contact, likely same)`.
  if (/[?]/.test(s)) return null;
  if (/\bsee\b|\blikely\b|\bno —|\bsame\b|→/i.test(s)) return null;

  // Slash cross-ref forms like `Alec / Roger` — ambiguous pair, drop.
  if (/\s\/\s/.test(s)) return null;

  // Strip a trailing parenthetical annotation: `Anthony (cover alias)` → `Anthony`.
  s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim();

  // Drop if anything questionable survives (stray punctuation-only, empty).
  if (!s || !/[a-z]/i.test(s)) return null;

  return s;
}

/**
 * Decide whether a normalized term is safe to autolink, and how it should match.
 * Returns the match descriptor or null if the term is suppressed.
 */
export function termMatchMode(
  term: string,
): { key: string; caseSensitive: boolean } | null {
  if (SHORT_ALLOWLIST_CASE_SENSITIVE.has(term)) {
    return { key: term, caseSensitive: true };
  }
  const key = matchKey(term);
  if (key.length < MIN_TERM_LENGTH) return null;
  if (BLOCKLIST.has(key)) return null;
  return { key, caseSensitive: false };
}
