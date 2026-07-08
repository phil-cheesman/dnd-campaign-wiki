import { ENTITY_TIERS } from './paths';
import { scanTier } from './canon-scan';
import { parseGlossary } from './glossary-parser';
import { nameMatchKey, normalizeAlias, termMatchMode } from './normalize';

export interface AliasTarget {
  slug: string;
  collection: string;
  display: string;
}

export interface AliasIndex {
  /** lowercase key → target (case-insensitive terms) */
  ci: Map<string, AliasTarget>;
  /** exact key → target (case-sensitive allowlisted initialisms, e.g. LJ) */
  cs: Map<string, AliasTarget>;
  /** terms dropped for ambiguity (key → list of candidate slugs) */
  ambiguous: Map<string, string[]>;
  /** glossary canonical names with no matching dossier */
  unmatchedGlossary: string[];
}

interface RawTerm {
  term: string; // normalized display term
  slug: string;
  collection: string;
  canonicalDisplay: string;
}

let cached: AliasIndex | null = null;

/**
 * Build the one global alias index: every public entity's `name` + `aliases[]`,
 * plus glossary aliases whose canonical name resolves to an existing dossier.
 * Ambiguous terms (one term → multiple distinct slugs) are dropped from the link
 * maps and recorded in `ambiguous`. Memoized.
 */
export function getAliasIndex(): AliasIndex {
  if (cached) return cached;

  const raw: RawTerm[] = [];
  // name → {slug, collection, display} for resolving glossary entries to dossiers
  const byName = new Map<string, AliasTarget>();

  // 1. Entity frontmatter (name + aliases).
  for (const collection of ENTITY_TIERS) {
    for (const doc of scanTier(collection)) {
      const display = String(doc.data.name ?? doc.slug);
      const target: AliasTarget = { slug: doc.slug, collection, display };
      // Key on the parenthetical-stripped name so glossary entries (which also
      // strip the parenthetical) resolve to this dossier — see ISSUES.md #1.
      byName.set(nameMatchKey(display), target);

      const strings = [doc.data.name, ...(doc.data.aliases ?? [])].filter(
        (x): x is string => typeof x === 'string',
      );
      for (const s of strings) {
        const norm = normalizeAlias(s);
        if (norm) raw.push({ term: norm, slug: doc.slug, collection, canonicalDisplay: display });
      }
    }
  }

  // 2. Glossary aliases, attached to whichever dossier shares the canonical name.
  const unmatchedGlossary: string[] = [];
  for (const entry of parseGlossary()) {
    const target = byName.get(nameMatchKey(entry.name));
    if (!target) {
      unmatchedGlossary.push(`${entry.name} [${entry.section}]`);
      continue;
    }
    const strings = [entry.name, ...entry.aliases];
    for (const s of strings) {
      const norm = normalizeAlias(s);
      if (norm) {
        raw.push({
          term: norm,
          slug: target.slug,
          collection: target.collection,
          canonicalDisplay: target.display,
        });
      }
    }
  }

  // 3. Resolve to match maps, detecting ambiguity per key.
  const ciCandidates = new Map<string, Set<string>>(); // key → slugs
  const csCandidates = new Map<string, Set<string>>();
  const ciTarget = new Map<string, AliasTarget>();
  const csTarget = new Map<string, AliasTarget>();

  for (const r of raw) {
    const mode = termMatchMode(r.term);
    if (!mode) continue;
    const candidates = mode.caseSensitive ? csCandidates : ciCandidates;
    const targets = mode.caseSensitive ? csTarget : ciTarget;
    const set = candidates.get(mode.key) ?? new Set<string>();
    set.add(`${r.collection}/${r.slug}`);
    candidates.set(mode.key, set);
    if (!targets.has(mode.key)) {
      targets.set(mode.key, { slug: r.slug, collection: r.collection, display: r.canonicalDisplay });
    }
  }

  const ambiguous = new Map<string, string[]>();
  const ci = new Map<string, AliasTarget>();
  const cs = new Map<string, AliasTarget>();

  for (const [key, set] of ciCandidates) {
    if (set.size > 1) ambiguous.set(key, [...set]);
    else ci.set(key, ciTarget.get(key)!);
  }
  for (const [key, set] of csCandidates) {
    if (set.size > 1) ambiguous.set(key, [...set]);
    else cs.set(key, csTarget.get(key)!);
  }

  cached = { ci, cs, ambiguous, unmatchedGlossary };
  return cached;
}

/** Serializable form for the shared artifact emitted to dist (chatbot/Pagefind reuse). */
export function aliasIndexToJSON(idx: AliasIndex) {
  return {
    generated: 'build',
    terms: [
      ...[...idx.ci.entries()].map(([key, t]) => ({ key, ...t, caseSensitive: false })),
      ...[...idx.cs.entries()].map(([key, t]) => ({ key, ...t, caseSensitive: true })),
    ],
    ambiguous: [...idx.ambiguous.entries()].map(([key, slugs]) => ({ key, slugs })),
    unmatchedGlossary: idx.unmatchedGlossary,
  };
}
