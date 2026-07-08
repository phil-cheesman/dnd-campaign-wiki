import { visit, SKIP } from 'unist-util-visit';
import { getMatcher } from '../lib/match-terms';
import { getAliasIndex } from '../lib/alias-index';
import { hrefFor, resolveSlug } from '../lib/links';

/** Derive `collection/slug` from a canon file path (.../canon/<collection>/<slug>.md). */
function idFromPath(path: string | undefined): { collection: string; slug: string } | null {
  if (!path) return null;
  const m = /\/canon\/([^/]+)\/([^/]+)\.md$/.exec(path.replace(/\\/g, '/'));
  if (!m) return null;
  return { collection: m[1], slug: m[2] };
}

interface Hit {
  start: number;
  end: number;
  text: string;
  href: string;
  targetKey: string; // collection/slug
}

function link(href: string, text: string) {
  return {
    type: 'link',
    url: href,
    data: { hProperties: { className: 'wikilink' } },
    children: [{ type: 'text', value: text }],
  } as any;
}

/**
 * Auto-link canon entity names/aliases in prose.
 * - longest-match-first, case-insensitive (+ case-sensitive allowlist e.g. LJ)
 * - first occurrence of each target per page
 * - skips self-links, code, existing links, headings
 * - `[[slug]]` / `[[slug|text]]` explicit escape hatch
 */
export function remarkAutolink() {
  return (tree: any, file: any) => {
    const self = idFromPath(file?.path ?? file?.history?.[0]);
    const selfKey = self ? `${self.collection}/${self.slug}` : '';
    const matcher = getMatcher();
    const idx = getAliasIndex();
    const linked = new Set<string>(); // target keys already linked on this page

    visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent) return;
      const pt = parent.type;
      if (pt === 'link' || pt === 'linkReference' || pt === 'inlineCode' || pt === 'code' || pt === 'heading')
        return SKIP;

      const value: string = node.value;
      const hits: Hit[] = [];

      // 0. Explicit [[slug]] / [[slug|text]] escape hatch.
      for (const m of value.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
        const slug = m[1].trim();
        const collection = resolveSlug(slug);
        if (!collection) continue;
        hits.push({
          start: m.index!,
          end: m.index! + m[0].length,
          text: (m[2] ?? slug).trim(),
          href: hrefFor(collection, slug),
          targetKey: `${collection}/${slug}`,
        });
      }

      // 1. Case-insensitive alias matches.
      if (matcher.ci) {
        for (const m of value.matchAll(matcher.ci)) {
          const t = matcher.resolve(m[1], false);
          if (t) hits.push({ start: m.index!, end: m.index! + m[0].length, text: m[1], href: hrefFor(t.collection, t.slug), targetKey: `${t.collection}/${t.slug}` });
        }
      }
      // 2. Case-sensitive allowlisted initialisms (LJ, BW).
      if (matcher.cs) {
        for (const m of value.matchAll(matcher.cs)) {
          const t = matcher.resolve(m[1], true);
          if (t) hits.push({ start: m.index!, end: m.index! + m[0].length, text: m[1], href: hrefFor(t.collection, t.slug), targetKey: `${t.collection}/${t.slug}` });
        }
      }

      if (hits.length === 0) return;

      // Resolve overlaps: earliest start wins, then longest; drop self & already-linked.
      hits.sort((a, b) => a.start - b.start || b.end - a.end);
      const chosen: Hit[] = [];
      let cursor = -1;
      for (const h of hits) {
        if (h.start < cursor) continue; // overlaps a chosen hit
        if (h.targetKey === selfKey) continue; // no self-links
        if (linked.has(h.targetKey)) continue; // first occurrence per page only
        chosen.push(h);
        linked.add(h.targetKey);
        cursor = h.end;
      }
      if (chosen.length === 0) return;

      const out: any[] = [];
      let pos = 0;
      for (const h of chosen) {
        if (h.start > pos) out.push({ type: 'text', value: value.slice(pos, h.start) });
        out.push(link(h.href, h.text));
        pos = h.end;
      }
      if (pos < value.length) out.push({ type: 'text', value: value.slice(pos) });

      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });

    // Touch idx so ambiguous/unmatched logging side-channel stays referenced.
    void idx;
  };
}
