import { ENTITY_TIERS } from './paths';
import { scanTier, type CanonDoc } from './canon-scan';
import { findMentions } from './match-terms';

export interface BacklinkSource {
  collection: string;
  slug: string;
  label: string;
}

const ALL_TIERS = [...ENTITY_TIERS, 'episodes', 'arcs'];

function labelFor(doc: CanonDoc): string {
  if (doc.collection === 'episodes') {
    const n = typeof doc.data.episode === 'number' ? doc.data.episode : doc.slug;
    const padded = typeof n === 'number' ? `E${String(n).padStart(2, '0')}` : doc.slug;
    return doc.data.title ? `${padded} — ${doc.data.title}` : padded;
  }
  return String(doc.data.name ?? doc.data.title ?? doc.slug);
}

let cache: Map<string, BacklinkSource[]> | null = null;

/** target `collection/slug` → list of pages that mention it ("Mentioned in"). */
export function getBacklinks(): Map<string, BacklinkSource[]> {
  if (cache) return cache;
  const map = new Map<string, BacklinkSource[]>();

  for (const collection of ALL_TIERS) {
    for (const doc of scanTier(collection)) {
      const selfKey = `${collection}/${doc.slug}`;
      const source: BacklinkSource = { collection, slug: doc.slug, label: labelFor(doc) };

      // Scan body prose…
      const mentions = findMentions(doc.body);
      // …plus episode frontmatter references (locations[]/npcs[] are display names).
      if (collection === 'episodes') {
        const refs = [
          ...(Array.isArray(doc.data.locations) ? doc.data.locations : []),
          ...(Array.isArray(doc.data.npcs) ? doc.data.npcs : []),
        ].filter((x) => typeof x === 'string');
        for (const key of findMentions(refs.join('\n'))) mentions.add(key);
      }

      for (const targetKey of mentions) {
        if (targetKey === selfKey) continue;
        const list = map.get(targetKey) ?? [];
        if (!list.some((s) => s.collection === source.collection && s.slug === source.slug)) {
          list.push(source);
        }
        map.set(targetKey, list);
      }
    }
  }

  // Stable ordering: episodes by number, then entities alphabetically.
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.collection === 'episodes' && b.collection === 'episodes') {
        return a.slug.localeCompare(b.slug, undefined, { numeric: true });
      }
      if (a.collection !== b.collection) return a.collection.localeCompare(b.collection);
      return a.label.localeCompare(b.label);
    });
  }

  cache = map;
  return cache;
}

export function backlinksFor(collection: string, slug: string): BacklinkSource[] {
  return getBacklinks().get(`${collection}/${slug}`) ?? [];
}
