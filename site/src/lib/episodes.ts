// Build-time payload for the Episodes header page (spec §3.4 / §5).
//
// Three jobs, all derived from frontmatter at build time:
//   1. Arc membership — parse the `arcs` frontmatter `episodes` TEXT RANGES
//      (e.g. "E00–E08") into number sets, then bucket every episode under its arc.
//   2. Badges — surface combat / milestone / deaths / media flags per episode.
//   3. Indices — the option lists (characters / locations / arcs) the slicer needs,
//      plus an appearance map (episode ↔ PC slugs).
//
// Quirks handled (see CLAUDE.md): missing E06 (just a gap, no file), and the
// E108 / E126 duplicate sessions (`*-dup2` files) — both share their primary's
// episode number, so they bucket into the same arc as an extra "(session 2)" row.
import { getPublic } from './collections';
import { episodeLabel, formatDate } from './format';

export interface EpDeath {
  pc: string;
  name: string;
  kind: 'permanent' | 'revived';
}

export interface EpRow {
  slug: string;
  num: number;
  href: string;
  label: string; // "E108 — Title" / "E108 (session 2)"
  dateLabel: string;
  combat: boolean;
  milestone?: string;
  media: boolean;
  deaths: EpDeath[];
  chars: string[]; // PC slugs evidenced this episode
  charNames: string[]; // resolved display names
  locs: string[]; // location names
  thumb: string | null; // scene-plate thumbnail, when art is generated
  sceneTitle?: string; // art caption, for the thumbnail's alt text
}

export interface EpArc {
  slug: string;
  title: string;
  rows: EpRow[];
}

export interface EpisodesPayload {
  arcs: EpArc[];
  charOptions: { slug: string; name: string }[];
  locOptions: string[];
  arcOptions: { slug: string; title: string }[];
  total: number;
}

/**
 * Expand an arc range string into the inclusive set of episode numbers it covers.
 * Accepts "E00–E08" (en/em-dash or hyphen) and a bare single "E137". Returns []
 * for anything unparseable (the overview arc, blanks) so callers can skip it.
 */
export function parseRange(range?: string): number[] {
  if (!range) return [];
  const span = range.match(/E(\d+)\s*[–—-]\s*E?(\d+)/i);
  if (span) {
    const start = Number(span[1]);
    const end = Number(span[2]);
    if (end < start) return [];
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  const single = range.match(/E(\d+)/i);
  return single ? [Number(single[1])] : [];
}

export async function getEpisodesPayload(): Promise<EpisodesPayload> {
  const [episodes, arcEntries, characters] = await Promise.all([
    getPublic('episodes'),
    getPublic('arcs'),
    getPublic('characters'),
  ]);

  // slug → display name for resolving `characters[]` and `deaths[].pc`.
  const nameBySlug = new Map<string, string>();
  for (const c of characters) nameBySlug.set(c.id, (c.data as any).name ?? c.id);
  const nameOf = (slug: string) => nameBySlug.get(slug) ?? slug;

  // Story arcs only — skip the campaign-overview arc, which spans every episode
  // (E00–E161) and would otherwise greedily swallow all rows. Match it by slug,
  // not by absence of a `title` (it now has one: "Campaign Overview").
  const storyArcs = arcEntries
    .filter((a: any) => a.data.title && a.id !== '00-overview')
    .map((a: any) => ({
      slug: a.id,
      title: a.data.title as string,
      nums: new Set(parseRange(a.data.episodes)),
      order: a.id, // arc files are numerically prefixed (01-…, 02-…) → id sort = story order
    }))
    .sort((a, b) => a.order.localeCompare(b.order, undefined, { numeric: true }));

  const arcForNum = (num: number) =>
    storyArcs.find((a) => a.nums.has(num))?.slug;

  // Build a row per episode file.
  const rows: (EpRow & { arcSlug?: string })[] = episodes.map((e: any) => {
    const d = e.data;
    const num: number = d.episode;
    const chars: string[] = d.characters ?? [];
    const deaths: EpDeath[] = (d.deaths ?? []).map((x: any) => ({
      pc: x.pc,
      name: nameOf(x.pc),
      kind: x.kind,
    }));
    return {
      slug: e.id,
      num,
      href: `/episodes/${e.id}`,
      label: episodeLabel(e.id, num, d.title),
      dateLabel: formatDate(d.date),
      combat: d.combat === true,
      milestone: d.milestone || undefined,
      media: d.media === true,
      deaths,
      chars,
      charNames: chars.map(nameOf),
      locs: d.locations ?? [],
      // The committed plate is heavy (~234 KB); list rows use the small thumb
      // (scripts/gen/thumbs.py → /art/episodes/thumbs/<slug>.webp).
      thumb: d.art?.image ? `/art/episodes/thumbs/${e.id}.webp` : null,
      sceneTitle: d.art?.scene_title || undefined,
      arcSlug: arcForNum(num),
    };
  });

  // Chronological: by episode number, with the "(session 2)" dup right after its primary.
  rows.sort((a, b) => a.num - b.num || a.slug.localeCompare(b.slug));

  // Group into arcs (in story order); anything that escaped a range goes to a
  // defensive "Unsorted" bucket so it can never silently vanish.
  const byArc = new Map<string, EpRow[]>();
  const unsorted: EpRow[] = [];
  for (const r of rows) {
    const { arcSlug, ...row } = r;
    if (arcSlug) {
      if (!byArc.has(arcSlug)) byArc.set(arcSlug, []);
      byArc.get(arcSlug)!.push(row);
    } else {
      unsorted.push(row);
    }
  }

  const arcs: EpArc[] = storyArcs
    .filter((a) => byArc.has(a.slug))
    .map((a) => ({ slug: a.slug, title: a.title, rows: byArc.get(a.slug)! }));
  if (unsorted.length) arcs.push({ slug: 'unsorted', title: 'Unsorted', rows: unsorted });

  // Slicer option lists, derived from what actually appears.
  const charSlugs = new Set<string>();
  const locSet = new Set<string>();
  for (const r of rows) {
    r.chars.forEach((c) => charSlugs.add(c));
    r.locs.forEach((l) => locSet.add(l));
  }
  const charOptions = [...charSlugs]
    .map((slug) => ({ slug, name: nameOf(slug) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const locOptions = [...locSet].sort((a, b) => a.localeCompare(b));
  const arcOptions = arcs
    .filter((a) => a.slug !== 'unsorted')
    .map((a) => ({ slug: a.slug, title: a.title }));

  return { arcs, charOptions, locOptions, arcOptions, total: rows.length };
}
