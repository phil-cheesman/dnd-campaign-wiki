// Node colours per tier — keyed to the Codex palette (texair purple + gold
// structure). Shared by GraphView (full page, home hero, and per-article mini graph).
export interface TypeMeta {
  label: string;
  color: string;
}

export const TYPE_META: Record<string, TypeMeta> = {
  characters: { label: 'Characters', color: '#7a3bb8' }, // texair purple — the PCs
  npcs: { label: 'NPCs', color: '#c9882f' }, // amber/gold
  locations: { label: 'Locations', color: '#3f8c6e' }, // green
  kingdoms: { label: 'Kingdoms', color: '#2f7da8' }, // blue
  factions: { label: 'Factions', color: '#b0453a' }, // red-brown
  items: { label: 'Items', color: '#a86c2f' }, // bronze
  worldbuilding: { label: 'Lore', color: '#7d7466' }, // stone
  arcs: { label: 'Arcs', color: '#9a6ad0' }, // light purple
  episodes: { label: 'Episodes', color: '#b3ad9d' }, // faint — the toggle layer
};

export const DEFAULT_COLOR = '#9a9483';
export const INK = '#23211c';
export const DARK_INK = '#e9ebf2';
export const DIM = 'rgba(140, 134, 120, 0.12)';

/** Canvas-painted values can't read CSS vars, so the graph picks them by theme. */
export function inkFor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? DARK_INK : INK;
}
export function graphBgFor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#14161d' : '#fcfbf8';
}
/** 3D scene background. Darker/more saturated than 2D for glow in dark mode; a
 *  warm parchment in light mode so the scene isn't an all-black box in daylight. */
export function graph3dBgFor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#0e0c16' : '#f4f1ea';
}
export function dimNodeFor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? 'rgba(142, 147, 166, 0.2)' : 'rgba(180, 173, 157, 0.22)';
}

/** Tiers shown in the legend, in nav order; episodes last (it's the toggle layer). */
export const LEGEND_ORDER = [
  'characters',
  'npcs',
  'locations',
  'kingdoms',
  'factions',
  'items',
  'worldbuilding',
  'arcs',
  'episodes',
];

export function colorFor(collection: string): string {
  return TYPE_META[collection]?.color ?? DEFAULT_COLOR;
}

export interface GraphNode {
  id: string;
  slug: string;
  collection: string;
  label: string;
  href: string;
  deg: number;
  summary?: string;
  image?: string;
  thumb?: string;
  // populated by the force engine at runtime
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** Node radius (2D px / 3D units) from connection count. */
export function radius(node: GraphNode): number {
  return 3 + Math.sqrt(node.deg || 0) * 1.6;
}

const linkEnd = (e: string | GraphNode): string => (typeof e === 'object' ? e.id : e);

/** Build an id → Set(neighbour ids) adjacency map. */
export function adjacency(data: GraphData): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    let s = adj.get(a);
    if (!s) adj.set(a, (s = new Set()));
    s.add(b);
  };
  for (const l of data.links) {
    const s = linkEnd(l.source);
    const t = linkEnd(l.target);
    add(s, t);
    add(t, s);
  }
  return adj;
}

export { linkEnd };
