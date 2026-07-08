import { getAliasIndex, type AliasTarget } from './alias-index';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Boundaries that treat letters/digits as word chars (so apostrophes/spaces inside terms are fine). */
function boundedAlternation(keys: string[]): RegExp | null {
  if (keys.length === 0) return null;
  // longest-first so multi-word / longer terms win over their prefixes
  const sorted = [...keys].sort((a, b) => b.length - a.length).map(escapeRegex);
  return new RegExp(`(?<![A-Za-z0-9])(${sorted.join('|')})(?![A-Za-z0-9])`, 'g');
}

export interface CompiledMatcher {
  ci: RegExp | null;
  cs: RegExp | null;
  resolve(matchedText: string, caseSensitive: boolean): AliasTarget | undefined;
}

let compiled: CompiledMatcher | null = null;

export function getMatcher(): CompiledMatcher {
  if (compiled) return compiled;
  const idx = getAliasIndex();
  const ciRe = boundedAlternation([...idx.ci.keys()]);
  const csRe = boundedAlternation([...idx.cs.keys()]);
  compiled = {
    ci: ciRe ? new RegExp(ciRe.source, 'gi') : null,
    cs: csRe, // case-sensitive: no i flag
    resolve(matchedText, caseSensitive) {
      if (caseSensitive) return idx.cs.get(matchedText);
      return idx.ci.get(matchedText.toLowerCase().replace(/\s+/g, ' ').trim());
    },
  };
  return compiled;
}

/** Resolve a single display name (e.g. an episode's location/npc entry) to a target, if any. */
export function resolveTerm(name: string): AliasTarget | undefined {
  const idx = getAliasIndex();
  const stripped = name.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  return (
    idx.ci.get(stripped.toLowerCase().replace(/\s+/g, ' ').trim()) ?? idx.cs.get(stripped)
  );
}

/**
 * Find every distinct target slug mentioned in `text` (used for backlinks).
 * Returns a set of `collection/slug` keys.
 */
export function findMentions(text: string): Set<string> {
  const m = getMatcher();
  const found = new Set<string>();
  if (m.ci) {
    for (const match of text.matchAll(m.ci)) {
      const t = m.resolve(match[1], false);
      if (t) found.add(`${t.collection}/${t.slug}`);
    }
  }
  if (m.cs) {
    for (const match of text.matchAll(m.cs)) {
      const t = m.resolve(match[1], true);
      if (t) found.add(`${t.collection}/${t.slug}`);
    }
  }
  return found;
}
