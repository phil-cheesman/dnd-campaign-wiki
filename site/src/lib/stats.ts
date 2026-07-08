import { getPublic } from './collections';

/**
 * "By the numbers" campaign stats for the homepage — all computed live from the
 * canon at build time, so a resync + rebuild always reflects the current world.
 * Nothing here is hand-typed; that is the whole point of the strip.
 */

// Every tier that counts as a published "entry of canon".
const ARTICLE_TIERS = [
  'characters',
  'npcs',
  'locations',
  'kingdoms',
  'factions',
  'items',
  'worldbuilding',
  'episodes',
  'arcs',
] as const;

export interface CampaignStats {
  /** total published canon entries across every tier */
  articles: number;
  /** approximate word count of canon prose (raw markdown body, frontmatter excluded) */
  words: number;
  /** sessions played = episode files (includes Session 0 / char creation) */
  sessions: number;
  /** whole-number years elapsed since the first session */
  years: number;
  /** display label rounded to the nearest half, e.g. "4½" */
  yearsLabel: string;
  firstDate: Date;
  lastDate: Date;
}

/** Round a year span to the nearest half and render it with a ½ glyph. */
function halfYearLabel(years: number): string {
  const halves = Math.round(years * 2) / 2;
  const whole = Math.floor(halves);
  const hasHalf = halves - whole >= 0.5;
  if (whole === 0) return hasHalf ? '½' : '0';
  return hasHalf ? `${whole}½` : String(whole);
}

export async function getCampaignStats(): Promise<CampaignStats> {
  const tiers = await Promise.all(ARTICLE_TIERS.map((t) => getPublic(t as any)));
  const all = tiers.flat();

  const articles = all.length;

  let words = 0;
  for (const entry of all) {
    const body = (entry as any).body as string | undefined;
    if (body) words += body.trim().split(/\s+/).filter(Boolean).length;
  }

  const episodes = await getPublic('episodes');
  const sessions = episodes.length;

  const dates = episodes
    .map((e: any) => e.data?.date as Date | undefined)
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const spanYears = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 3600 * 1000);

  return {
    articles,
    words,
    sessions,
    years: Math.floor(spanYears),
    yearsLabel: halfYearLabel(spanYears),
    firstDate,
    lastDate,
  };
}
