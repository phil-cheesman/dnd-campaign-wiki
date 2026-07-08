import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ENTITY_TIERS } from './paths';
import { scanTier, type CanonDoc } from './canon-scan';
import { getBacklinks } from './backlinks';

/** site/public — for resolving whether a node thumbnail has been built. */
const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));

/** Map a full-art public URL (`/art/<c>/<slug>.webp`) to its node thumbnail
 *  (`/art-thumb/<c>/<slug>.webp`, built by scripts/art/build_node_thumbs.py),
 *  but only when that thumb exists on disk — otherwise the painter falls back to
 *  the full image. Keeps the graph correct even if the thumb step hasn't run. */
function thumbFor(image: string | undefined): string | undefined {
  if (!image || !image.startsWith('/art/')) return undefined;
  const url = image.replace('/art/', '/art-thumb/').replace(/\.[^.]+$/, '.webp');
  return existsSync(PUBLIC_DIR + url) ? url : undefined;
}

export interface GraphNode {
  /** `${collection}/${slug}` — unique across tiers. */
  id: string;
  slug: string;
  collection: string;
  label: string;
  href: string;
  /** number of (undirected) connections — drives node size. */
  deg: number;
  /** short plain-text lede for the graph hover/click card. */
  summary: string;
  /** codex art (public URL), when generated — shown in the click card. */
  image?: string;
  /** tiny thumbnail of `image` for painting into the node circle (perf). */
  thumb?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const ALL_TIERS = [...ENTITY_TIERS, 'episodes', 'arcs'];

/** Same display rule the backlinks list uses (episodes → "E07 — Title"). */
function labelFor(doc: CanonDoc): string {
  if (doc.collection === 'episodes') {
    const n = typeof doc.data.episode === 'number' ? doc.data.episode : doc.slug;
    const padded = typeof n === 'number' ? `E${String(n).padStart(2, '0')}` : doc.slug;
    return doc.data.title ? `${padded} — ${doc.data.title}` : padded;
  }
  return String(doc.data.name ?? doc.data.title ?? doc.slug);
}

/** Strip the inline markdown a one-line lede might carry (links, emphasis,
 *  code, a leading list/quote marker) down to plain text. */
function stripInlineMd(s: string): string {
  return s
    .replace(/^[-*>]\s+/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate to ~n chars on a word boundary, with an ellipsis. */
function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, '') + '…';
}

/** First prose paragraph of a dossier body, as a short plain-text summary.
 *  Skips headings; prefers a real sentence over a bullet/table row, but falls
 *  back to the first content line so bullet-only dossiers still get a lede. */
function summaryFor(doc: CanonDoc): string {
  const paras: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) paras.push(buf.join(' '));
    buf = [];
  };
  for (const raw of doc.body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  const prose = paras.find((p) => !/^[-*>|]/.test(p));
  return truncate(stripInlineMd(prose ?? paras[0] ?? ''), 240);
}

let cache: GraphData | null = null;

/**
 * The whole-wiki relationship graph, derived from the same mention/backlink
 * machinery that powers "Mentioned in". Nodes are every public (non-`dm_only`)
 * entity, episode and arc; links are mentions, collapsed to undirected pairs.
 * Memoized — built once per process.
 */
export function getGraphData(): GraphData {
  if (cache) return cache;

  const nodes = new Map<string, GraphNode>();
  for (const collection of ALL_TIERS) {
    for (const doc of scanTier(collection)) {
      const id = `${collection}/${doc.slug}`;
      nodes.set(id, {
        id,
        slug: doc.slug,
        collection,
        label: labelFor(doc),
        href: `/${collection}/${doc.slug}`,
        deg: 0,
        summary: summaryFor(doc),
        image: typeof doc.data.art?.image === 'string' ? doc.data.art.image : undefined,
        thumb: thumbFor(typeof doc.data.art?.image === 'string' ? doc.data.art.image : undefined),
      });
    }
  }

  // Backlinks map: target → [sources that mention it]. Collapse the directed
  // mention pairs into a unique set of undirected edges.
  const seen = new Set<string>();
  const links: GraphLink[] = [];
  for (const [targetId, sources] of getBacklinks()) {
    if (!nodes.has(targetId)) continue;
    for (const s of sources) {
      const sourceId = `${s.collection}/${s.slug}`;
      if (sourceId === targetId || !nodes.has(sourceId)) continue;
      const key = sourceId < targetId ? `${sourceId} ${targetId}` : `${targetId} ${sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: sourceId, target: targetId });
      nodes.get(sourceId)!.deg++;
      nodes.get(targetId)!.deg++;
    }
  }

  // Drop fully-disconnected nodes (deg 0): with nothing linking them they just
  // drift off into empty space and blow out the zoom-to-fit. A relationship graph
  // has no use for an island. (Currently only a few link-less episode pages.)
  cache = { nodes: [...nodes.values()].filter((n) => n.deg > 0), links };
  return cache;
}
