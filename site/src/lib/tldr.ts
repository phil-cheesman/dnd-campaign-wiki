/**
 * TL;DR page data — see `docs/specs/wiki-tldr.md`.
 *
 * Assembles `canon/tldr.md` (the hand-maintained state file) with everything
 * derivable from canon, so the authored file never repeats a fact the codex
 * already knows: portraits, levels, classes, dossier hrefs, arc titles and the
 * cliffhanger art plate are all looked up here.
 *
 * The other half of this module is `assertFresh()` — the build-time guard that
 * makes a stale TL;DR impossible to publish.
 */
import { getPublic } from './collections';

/** Tiers a TL;DR `slug` may point at, in resolution order. */
const LINKABLE_TIERS = [
  'characters',
  'npcs',
  'factions',
  'locations',
  'items',
  'kingdoms',
  'worldbuilding',
] as const;

export interface ResolvedPerson {
  name: string;
  line: string;
  /** Dossier href, or null when the slug is absent/unresolvable (renders as plain text). */
  href: string | null;
  /** Portrait/crest webp, or null. */
  art: string | null;
  pcs: string[];
}

export interface ResolvedPC {
  slug: string;
  name: string; // first name — the TL;DR is on casual terms with the party
  href: string;
  art: string;
  state: string;
  stateLabel: string;
  line: string;
  thread?: string | null;
  /** e.g. "Bard 15" — from the character sheet block when present. */
  classLine: string | null;
}

export interface Objective {
  text: string;
  status: 'active' | 'new' | 'blocked' | 'done';
  why?: string | null;
  pcs: string[];
}
export interface Change {
  kind: 'loss' | 'gain';
  text: string;
}
export interface JargonTerm {
  term: string;
  def: string;
}

const STATE_LABELS: Record<string, string> = {
  fine: 'Fine',
  hurt: 'Hurt',
  critical: 'Critical',
  changed: 'Changed',
  missing: 'Missing',
};

/**
 * Build a slug → {tier, name, hasArt} index across every linkable tier.
 * Built once per render; the collections are already in memory at this point.
 */
async function buildIndex() {
  const index = new Map<string, { tier: string; name: string; art: string | null }>();
  for (const tier of LINKABLE_TIERS) {
    for (const e of await getPublic(tier as any)) {
      // First tier wins: a slug colliding across tiers resolves to the earlier
      // (more people-shaped) one, matching LINKABLE_TIERS order.
      if (index.has(e.id)) continue;
      index.set(e.id, {
        tier,
        name: (e.data as any).name ?? e.id,
        art: (e.data as any).art?.image ?? null,
      });
    }
  }
  return index;
}

/** Resolve one roster row. An unresolvable slug degrades to unlinked text. */
function resolvePerson(
  row: { slug?: string | null; name: string; line: string; pcs?: string[] },
  index: Awaited<ReturnType<typeof buildIndex>>,
): ResolvedPerson {
  const hit = row.slug ? index.get(row.slug) : undefined;
  return {
    name: row.name,
    line: row.line,
    href: hit ? `/${hit.tier}/${row.slug}` : null,
    art: hit?.art ?? null,
    pcs: row.pcs ?? [],
  };
}

/**
 * BUILD-TIME STALENESS GUARD (spec §6, layer 2).
 *
 * Throws — failing the build — when `canon/tldr.md` has not been regenerated for
 * the newest published episode. Fail rather than warn is the point: a stale
 * TL;DR is invisible and misleads the exact reader least equipped to notice,
 * whereas a blocked deploy is a one-line fix.
 *
 * To unblock: run the TL;DR step from the `ingest-episode` skill (which rewrites
 * the whole file), or bump `current_episode` if the number is simply a typo.
 */
export function assertFresh(current: number, latest: number, latestTitle: string) {
  if (current === latest) return;
  const behind = latest > current;
  throw new Error(
    [
      '',
      '  ┌─ TL;DR is out of date ────────────────────────────────────────────',
      `  │  canon/tldr.md says      : E${current}`,
      `  │  latest canon episode is : E${latest}${latestTitle ? ` — ${latestTitle}` : ''}`,
      '  │',
      behind
        ? '  │  The catch-up page would ship describing a session that is no'
        : '  │  The TL;DR points at an episode that does not exist yet, so the',
      behind
        ? '  │  longer the latest one. Rewrite canon/tldr.md for the new episode'
        : '  │  number is probably a typo. Set current_episode to the real',
      behind
        ? '  │  (the TL;DR step in the ingest-episode skill), then rebuild.'
        : '  │  latest episode, then rebuild.',
      '  └───────────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

export async function getTldr() {
  const entries = await getPublic('tldr' as any);
  const doc = entries[0];
  if (!doc) throw new Error('canon/tldr.md is missing — /tldr cannot render without it.');
  const d = doc.data as any;

  // ── Freshness ───────────────────────────────────────────────────────────
  const episodes = (await getPublic('episodes')).slice().sort(
    (a: any, b: any) => (b.data.episode ?? 0) - (a.data.episode ?? 0),
  );
  const newest = episodes[0];
  const latest = (newest?.data as any)?.episode ?? 0;
  assertFresh(d.current_episode, latest, (newest?.data as any)?.title ?? '');

  // ── Derived: party cards ────────────────────────────────────────────────
  const characters = await getPublic('characters');
  const charBySlug = new Map(characters.map((c: any) => [c.id, c]));
  const party: ResolvedPC[] = d.party.flatMap((p: any) => {
    const c: any = charBySlug.get(p.slug);
    if (!c) return []; // a renamed/removed PC drops out rather than 500s the page
    const sheet = c.data.sheet ?? {};
    return [
      {
        slug: p.slug,
        name: (c.data.short_name ?? c.data.name ?? p.slug).split(/\s+/)[0],
        href: `/characters/${p.slug}`,
        art: c.data.art?.image ?? `/art/characters/${p.slug}.webp`,
        state: p.state,
        stateLabel: STATE_LABELS[p.state] ?? p.state,
        line: p.line,
        thread: p.thread,
        classLine: sheet.class ?? null,
      },
    ];
  });

  // ── Derived: rosters ────────────────────────────────────────────────────
  const index = await buildIndex();
  const roster = (rows: any): ResolvedPerson[] =>
    ((rows ?? []) as any[]).map((r) => resolvePerson(r, index));
  const rosters = {
    withUs: roster(d.with_us),
    afterUs: roster(d.after_us),
    elsewhere: roster(d.elsewhere),
  };

  // ── Derived: arc + cliffhanger art ──────────────────────────────────────
  const arcs = await getPublic('arcs');
  const arc: any = d.arc ? arcs.find((a: any) => a.id === d.arc) : undefined;
  const cliffhangerArt =
    d.cliffhanger_art ?? (newest?.data as any)?.art?.image ?? null;

  const placeHit = d.where.place_slug ? index.get(d.where.place_slug) : undefined;

  // Fields are listed explicitly rather than spread from `d`: the frontmatter is
  // typed `any` at this boundary, and a spread would erase every type below it
  // (which is exactly what /tldr consumes).
  return {
    // Exposed so callers can scope "recent episodes" to the TL;DR's own cursor
    // rather than to whatever happens to be newest on disk.
    current_episode: d.current_episode as number,
    cliffhanger: d.cliffhanger as string,
    where: d.where as {
      place: string;
      place_slug?: string | null;
      region?: string | null;
      level?: number | null;
      in_world?: string | null;
    },
    story_now: d.story_now as string,
    objectives: (d.objectives ?? []) as Objective[],
    changed: (d.changed ?? []) as Change[],
    clock: (d.clock ?? []) as string[],
    jargon: (d.jargon ?? []) as JargonTerm[],
    theories: (d.theories ?? []) as string[],
    remember: (d.remember ?? []) as string[],
    latestEpisode: {
      num: latest,
      title: (newest?.data as any)?.title ?? '',
      href: newest ? `/episodes/${newest.id}` : '/episodes',
    },
    arcInfo: arc ? { title: arc.data.title ?? arc.id, href: `/arcs/${arc.id}` } : null,
    cliffhangerArt,
    placeHref: placeHit ? `/${placeHit.tier}/${d.where.place_slug}` : null,
    party,
    rosters,
  };
}
