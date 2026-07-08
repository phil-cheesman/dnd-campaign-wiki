/**
 * Geometry + palette for the ability-score "spider" (radar) chart.
 *
 * The six D&D ability scores map to a hexagonal radar — a video-game stat web.
 * Scores nominally run 1–20; we clamp the visible domain to RADAR_MIN..RADAR_MAX
 * so the party's real spread (≈6–20) fills the web instead of huddling near the
 * centre. Pure functions here, no DOM — both the Astro component and any future
 * caller share the same maths.
 */

export type Abilities = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

/** Axis order, clockwise from the top vertex. [display label, frontmatter key]. */
export const RADAR_AXES = [
  ['STR', 'str'],
  ['DEX', 'dex'],
  ['CON', 'con'],
  ['INT', 'int'],
  ['WIS', 'wis'],
  ['CHA', 'cha'],
] as const;

/** Visible domain — floor a touch below the party's low, ceil at the 5e cap. */
export const RADAR_MIN = 6;
export const RADAR_MAX = 20;

/**
 * Per-character series colours. Distinct mid-saturation hues that hold up on
 * both the cream and slate desks; gold is reserved for structure, so it's absent.
 * Unknown slugs fall back to FALLBACK_COLORS by index.
 */
export const PARTY_COLORS: Record<string, string> = {
  berrian: '#c0642e', // terracotta — paladin
  noctis: '#7a3bb8', // violet — dark tabaxi
  vane: '#2e86a8', // teal — sorcerer
  cruucar: '#b23b3b', // red — barbarian dragonborn
  torgoth: '#3d8a4f', // green — goliath cleric
  quinton: '#b08a1f', // brass — bard
};

const FALLBACK_COLORS = ['#c0642e', '#7a3bb8', '#2e86a8', '#b23b3b', '#3d8a4f', '#b08a1f'];

export const colorFor = (slug: string, i = 0): string =>
  PARTY_COLORS[slug] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];

/** A point on the unit circle for axis `i` of `n`, clockwise from straight up. */
const angleOf = (i: number, n: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

/** Vertex coordinate at fractional radius `t` (0..1) along axis `i`. */
export function vertex(cx: number, cy: number, r: number, i: number, n: number, t = 1) {
  const a = angleOf(i, n);
  return [cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t] as const;
}

const norm = (v: number) =>
  Math.max(0, Math.min(1, (v - RADAR_MIN) / (RADAR_MAX - RADAR_MIN)));

/** `points=""` string for a polygon tracing one character's six scores. */
export function abilityPolygon(ab: Abilities, cx: number, cy: number, r: number): string {
  return RADAR_AXES.map(([, key], i) => {
    const [x, y] = vertex(cx, cy, r, i, RADAR_AXES.length, norm(ab[key as keyof Abilities]));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

/** `points=""` for a concentric ring at fractional radius `t` (the web grid). */
export function ringPolygon(cx: number, cy: number, r: number, t: number): string {
  return RADAR_AXES.map((_, i) => {
    const [x, y] = vertex(cx, cy, r, i, RADAR_AXES.length, t);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
