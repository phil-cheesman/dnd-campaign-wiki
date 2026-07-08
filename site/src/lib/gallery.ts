import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TIER_LABELS } from './paths';
import { getGraphData } from './graph';

export interface GalleryItem {
  /** Public URL of the image (served from /public). */
  src: string;
  /** Owning tier: characters, npcs, factions, items, … */
  collection: string;
  /** Filename stem == entity slug. */
  slug: string;
  /** Display name (from the joined dossier, else a title-cased slug). */
  label: string;
  /** Link to the entity's dossier page. */
  href: string;
  /** Short plain-text lede for the lightbox caption (may be empty). */
  summary: string;
}

export interface GalleryCategory {
  key: string;
  label: string;
  count: number;
}

export interface GalleryData {
  items: GalleryItem[];
  categories: GalleryCategory[];
}

const ART_DIR = join(process.cwd(), 'public', 'art');
const IMAGE_RE = /\.(png|jpe?g|webp|avif|gif)$/i;

/** Title-case a kebab slug as a fallback label when no dossier is matched. */
function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

let cache: GalleryData | null = null;

/**
 * Scan `public/art/<collection>/<slug>.<ext>` and join each image to its
 * dossier (label/href/summary) via the same node set the graph uses. Art
 * filenames are authored to match entity slugs, so the join is by id
 * `${collection}/${slug}`; unmatched files still appear with a derived label.
 * Memoized — built once per process.
 */
export function getGalleryData(): GalleryData {
  if (cache) return cache;

  const nodes = new Map(getGraphData().nodes.map((n) => [n.id, n]));
  const items: GalleryItem[] = [];

  let tiers: string[] = [];
  try {
    tiers = readdirSync(ART_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    // No art dir yet — return an empty gallery rather than failing the build.
    cache = { items: [], categories: [] };
    return cache;
  }

  for (const collection of tiers) {
    let files: string[] = [];
    try {
      files = readdirSync(join(ART_DIR, collection)).filter((f) => IMAGE_RE.test(f));
    } catch {
      continue;
    }
    for (const file of files.sort()) {
      const slug = file.replace(IMAGE_RE, '');
      const node = nodes.get(`${collection}/${slug}`);
      items.push({
        src: `/art/${collection}/${file}`,
        collection,
        slug,
        label: node?.label ?? titleCase(slug),
        href: node?.href ?? `/${collection}/${slug}`,
        summary: node?.summary ?? '',
      });
    }
  }

  // Categories in the order tiers were discovered, with friendly labels + counts.
  const order = ['characters', 'npcs', 'locations', 'kingdoms', 'factions', 'items', 'worldbuilding'];
  const present = [...new Set(items.map((i) => i.collection))].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  );
  const categories: GalleryCategory[] = present.map((key) => ({
    key,
    label: TIER_LABELS[key] ?? titleCase(key),
    count: items.filter((i) => i.collection === key).length,
  }));

  cache = { items, categories };
  return cache;
}
