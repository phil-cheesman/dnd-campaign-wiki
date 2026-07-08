import { ENTITY_TIERS } from './paths';
import { scanTier } from './canon-scan';
import { getAliasIndex } from './alias-index';

/** URL path for an entity/episode/arc page. slug == filename. */
export function hrefFor(collection: string, slug: string): string {
  return `/${collection}/${slug}`;
}

const ALL_TIERS = [...ENTITY_TIERS, 'episodes', 'arcs'];

let slugMap: Map<string, string> | null = null; // slug -> collection

/** Map every public slug to its collection (for [[slug]] escape-hatch resolution). */
export function getSlugMap(): Map<string, string> {
  if (slugMap) return slugMap;
  slugMap = new Map();
  for (const collection of ALL_TIERS) {
    for (const doc of scanTier(collection)) {
      if (!slugMap.has(doc.slug)) slugMap.set(doc.slug, collection);
    }
  }
  return slugMap;
}

export function resolveSlug(slug: string): string | undefined {
  return getSlugMap().get(slug);
}

/** URL-safe slug from an arbitrary alias string. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’"`.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Static redirect map { `/collection/aliasSlug` → `/collection/realSlug` } from the
 * unambiguous alias index. Skips aliases whose slug collides with a real page or with
 * an already-claimed alias (first wins). Conservative by design.
 */
export function buildAliasRedirects(): Record<string, string> {
  const idx = getAliasIndex();
  const slugMap = getSlugMap();
  const out: Record<string, string> = {};
  const claimed = new Set<string>();

  // Iterate every ci term key (already normalized/lowercased) → target.
  for (const [key, target] of idx.ci) {
    const aSlug = slugify(key);
    if (!aSlug) continue;
    const path = `/${target.collection}/${aSlug}`;
    const real = `/${target.collection}/${target.slug}`;
    if (path === real) continue; // alias == canonical slug
    if (slugMap.get(aSlug) === target.collection) continue; // collides with a real page
    if (claimed.has(path)) continue; // first alias wins
    claimed.add(path);
    out[path] = real;
  }
  return out;
}
