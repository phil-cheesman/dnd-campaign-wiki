import { visit, SKIP } from 'unist-util-visit';
import srd from '../data/srd-terms.json';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TERMS: { term: string; url: string }[] = (srd as any).terms;
const URL_BY_KEY = new Map(TERMS.map((t) => [t.term.toLowerCase(), t.url]));
const RE =
  TERMS.length > 0
    ? new RegExp(
        `(?<![A-Za-z0-9])(${[...TERMS]
          .sort((a, b) => b.term.length - a.term.length)
          .map((t) => escapeRegex(t.term))
          .join('|')})(?![A-Za-z0-9])`,
        'gi',
      )
    : null;

function srdLink(href: string, text: string) {
  return {
    type: 'link',
    url: href,
    data: { hProperties: { className: 'srdlink', target: '_blank', rel: 'noopener noreferrer' } },
    children: [{ type: 'text', value: text }],
  } as any;
}

/** Link curated 5e SRD terms out to 5e.tools. Runs after the entity autolinker. */
export function remarkSrd() {
  return (tree: any) => {
    if (!RE) return;
    const linked = new Set<string>();
    visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent) return;
      const pt = parent.type;
      if (pt === 'link' || pt === 'linkReference' || pt === 'inlineCode' || pt === 'code' || pt === 'heading')
        return SKIP;

      const value: string = node.value;
      const matches = [...value.matchAll(RE)];
      if (matches.length === 0) return;

      const out: any[] = [];
      let pos = 0;
      for (const m of matches) {
        const key = m[1].toLowerCase();
        if (linked.has(key)) continue;
        const url = URL_BY_KEY.get(key);
        if (!url) continue;
        const start = m.index!;
        if (start < pos) continue;
        if (start > pos) out.push({ type: 'text', value: value.slice(pos, start) });
        out.push(srdLink(url, m[1]));
        linked.add(key);
        pos = start + m[0].length;
      }
      if (out.length === 0) return;
      if (pos < value.length) out.push({ type: 'text', value: value.slice(pos) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}
