import { getPublic } from './collections';
import { getLocationsPayload } from './locations';
import { NAV_TIERS, TIER_LABELS } from './paths';

/** One linkable entity in the sidebar. */
export interface NavItem {
  name: string;
  href: string;
  slug: string;
  count: number; // appearance count (episodes.length) — drives "critical-first" ranking
  firstEp: number; // episode of first appearance — drives chronological ordering
}

/**
 * A sub-group within a tier (e.g. "Party" / "Former members"); label omitted = flat list.
 * When `href` is set the label itself is a link (e.g. a kingdom heading in the
 * Locations rail, which clicks through to that kingdom's article) and is
 * current-marker–eligible via `slug`.
 */
export interface NavGroup {
  label?: string;
  href?: string;
  slug?: string;
  items: NavItem[];
}

/**
 * A collection in the sidebar: a flat top-level link, plus — only when it is the
 * section you're currently in — its expanded members (`groups`). The component
 * keeps non-active sections collapsed to the bare link.
 */
export interface SidebarCollection {
  tier: string;
  label: string;
  href: string;
  total: number;
  active: boolean;
  groups?: NavGroup[];
}

/** Episodes — a flat link, expanding to a ±4 window only while reading an episode. */
export interface SidebarEpisodes {
  href: string;
  total: number;
  active: boolean;
  items: NavItem[];
}

/** The whole left-rail model. The component renders this top-to-bottom. */
export interface SidebarModel {
  collections: SidebarCollection[];
  episodes: SidebarEpisodes;
  arcs: SidebarCollection;
  activeSlug?: string;
  randomHrefs: string[]; // every entity/episode href — powers the "Random page" jump
}

/** How many episodes the sidebar window shows on each side of the current one (±N). */
const EPISODE_WINDOW = 4;

export const isDeceased = (status?: string | null) =>
  !!status && /(deceas|dead|fallen|killed)/i.test(status);

/** Left the party alive (e.g. Zanim) — distinct from the dead, but still not active. */
export const isDeparted = (status?: string | null) =>
  !!status && /(depart|left|former|retired)/i.test(status);

/** No longer in the active party — dead OR departed. Drives the roster split. */
export const isFormerMember = (status?: string | null) =>
  isDeceased(status) || isDeparted(status);

const RELATION_LABELS: Record<string, string> = { ally: 'Allies', enemy: 'Enemies', neutral: 'Neutral' };

/** The sub-group label an entity belongs to (for breadcrumbs), or undefined. */
export function subgroupFor(tier: string, data: any): string | undefined {
  // Active party members sit directly under the "Party" section (no redundant
  // sub-label); the dead and departed get the one distinguishing sub-group.
  if (tier === 'characters') return isFormerMember(data.status) ? 'Former members' : undefined;
  if ((tier === 'npcs' || tier === 'factions') && data.relation) return RELATION_LABELS[data.relation];
  return undefined;
}

/**
 * Sidebar label: explicit `short_name` wins; otherwise characters collapse to their
 * first name (Quinton Shackleford → Quinton) while the article keeps the full name.
 */
function sidebarName(tier: string, data: any): string {
  const full = data.name ?? '';
  if (data.short_name) return data.short_name;
  if (tier === 'characters') return full.split(/\s+/)[0] || full;
  return full;
}

function toItem(tier: string, e: any): NavItem {
  const count = Array.isArray(e.data.episodes) ? e.data.episodes.length : 0;
  const firstEp = typeof e.data.first_episode === 'number' ? e.data.first_episode : Infinity;
  return { name: sidebarName(tier, e.data), href: `/${tier}/${e.id}`, slug: e.id, count, firstEp };
}

/** Rank by appearance count desc, then name — the "critical entities first" order. */
const byCountThenName = (a: NavItem, b: NavItem) =>
  b.count - a.count || a.name.localeCompare(b.name);

/**
 * Chronological order: earliest first appearance first, then alphabetical by the
 * (already first-name) label as the same-episode tie-breaker. Used for characters.
 */
const byFirstEpThenName = (a: NavItem, b: NavItem) =>
  a.firstEp - b.firstEp || a.name.localeCompare(b.name);

const byName = (a: NavItem, b: NavItem) => a.name.localeCompare(b.name);

/**
 * Member list for an expanded section. Each tier is grouped the way that reads
 * best in the rail: party/fallen, ally/enemy/neutral, or a flat alphabetical list.
 */
function membersFor(tier: string, entries: any[]): NavGroup[] {
  if (tier === 'characters') {
    const active = entries.filter((e) => !isFormerMember(e.data.status)).map((e) => toItem(tier, e)).sort(byFirstEpThenName);
    const former = entries.filter((e) => isFormerMember(e.data.status)).map((e) => toItem(tier, e)).sort(byFirstEpThenName);
    // Active party is the section itself (label-less flat list); the dead and
    // departed share the one sub-group worth calling out.
    return [{ items: active }, ...(former.length ? [{ label: 'Former members', items: former }] : [])];
  }
  if (tier === 'npcs' || tier === 'factions') {
    // Bucket by relation; an "Other" group catches anyone with no relation set.
    const order: (string | undefined)[] = ['ally', 'enemy', 'neutral', undefined];
    const groups: NavGroup[] = [];
    for (const rel of order) {
      const items = entries
        .filter((e) => (e.data.relation ?? undefined) === rel)
        .map((e) => toItem(tier, e))
        .sort(byCountThenName);
      if (items.length) groups.push({ label: rel ? RELATION_LABELS[rel] : 'Other', items });
    }
    return groups;
  }
  if (tier === 'arcs') {
    const items: NavItem[] = entries
      .map((a: any) => ({ name: a.data.title ?? a.id, href: `/arcs/${a.id}`, slug: a.id, count: 0, firstEp: Infinity }))
      .sort((a, b) => a.href.localeCompare(b.href, undefined, { numeric: true }));
    return [{ items }];
  }
  // items / worldbuilding — flat alphabetical. (Locations is special-cased in
  // buildSidebar via locationGroups; kingdoms is no longer a nav section.)
  return [{ items: entries.map((e) => toItem(tier, e)).sort(byName) }];
}

/**
 * Locations rail — mirrors the gazetteer: one group per kingdom (its label links to
 * the kingdom's article and carries the current-marker), its child locations beneath,
 * then an "External / Unaffiliated" catch-all. Reuses the same bucketing as the
 * Locations header page so the sidebar and the page never disagree.
 */
async function locationGroups(): Promise<NavGroup[]> {
  const { kingdoms, external } = await getLocationsPayload();
  const toLoc = (l: { name: string; href: string; slug: string }): NavItem => ({
    name: l.name,
    href: l.href,
    slug: l.slug,
    count: 0,
    firstEp: Infinity,
  });
  const groups: NavGroup[] = kingdoms.map((k) => ({
    label: k.name,
    href: `/kingdoms/${k.slug}`,
    slug: k.slug,
    items: k.locations.map(toLoc),
  }));
  if (external.length) groups.push({ label: 'External / Unaffiliated', items: external.map(toLoc) });
  return groups;
}

const epLeaf = (e: any): NavItem => ({
  name: `E${String(e.data.episode).padStart(2, '0')}${e.id.endsWith('-dup2') ? ' (s2)' : ''}`,
  href: `/episodes/${e.id}`,
  slug: e.id,
  count: e.data.episode ?? 0,
  firstEp: e.data.episode ?? Infinity,
});

/**
 * Build the sidebar model for the current page. Only the active section carries its
 * expanded members; everything else is a bare flat link. Episodes is always a window.
 */
export async function buildSidebar(pathname: string): Promise<SidebarModel> {
  const raw = activeFromPath(pathname);
  // Kingdoms is folded into Locations: reading a kingdom article lights up (and
  // expands) the Locations section, with the kingdom heading carrying the marker.
  const activeTier = raw.tier === 'kingdoms' ? 'locations' : raw.tier;
  const activeSlug = raw.slug;
  const randomHrefs: string[] = [];

  // The active section expands its members — on the header/index page as well as on
  // a detail page within it (so you can browse the roster from either).
  const collections: SidebarCollection[] = [];
  for (const tier of NAV_TIERS) {
    const entries = await getPublic(tier as any);
    for (const e of entries) randomHrefs.push(`/${tier}/${e.id}`);
    const active = tier === activeTier;
    collections.push({
      tier,
      label: TIER_LABELS[tier] ?? tier,
      href: `/${tier}`,
      total: entries.length,
      active,
      groups: active ? (tier === 'locations' ? await locationGroups() : membersFor(tier, entries)) : undefined,
    });
  }
  // Kingdoms aren't a nav section, but their articles are still reachable via Random.
  for (const k of await getPublic('kingdoms')) randomHrefs.push(`/kingdoms/${k.id}`);

  // Episodes — a tight window shown only within the Episodes section: ±4 around the
  // current episode on a detail page, or the most recent ~9 on the /episodes header.
  // Elsewhere it stays a flat link (the full list lives on the page + the bottom pager).
  const eps = (await getPublic('episodes'))
    .slice()
    .sort((a: any, b: any) => (a.data.episode ?? 0) - (b.data.episode ?? 0) || a.id.localeCompare(b.id));
  for (const e of eps) randomHrefs.push(`/episodes/${e.id}`);
  let epItems: NavItem[] = [];
  if (activeTier === 'episodes') {
    const idx = activeSlug ? eps.findIndex((e: any) => e.id === activeSlug) : -1;
    epItems =
      idx >= 0
        ? eps.slice(Math.max(0, idx - EPISODE_WINDOW), idx + EPISODE_WINDOW + 1).map(epLeaf)
        : eps.slice(-(EPISODE_WINDOW * 2 + 1)).map(epLeaf);
  }
  const episodes: SidebarEpisodes = {
    href: '/episodes',
    total: eps.length,
    active: activeTier === 'episodes',
    items: epItems,
  };

  // Arcs — a flat link that expands to its chapters whenever the Arcs section is active.
  const arcEntries = await getPublic('arcs');
  const arcs: SidebarCollection = {
    tier: 'arcs',
    label: TIER_LABELS.arcs,
    href: '/arcs',
    total: arcEntries.length,
    active: activeTier === 'arcs',
    groups: activeTier === 'arcs' ? membersFor('arcs', arcEntries) : undefined,
  };

  return { collections, episodes, arcs, activeSlug, randomHrefs };
}

/** Parse `Astro.url.pathname` → { tier, slug }. `/characters/vane` → both; `/` → none. */
export function activeFromPath(pathname: string): { tier?: string; slug?: string } {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return {};
  return { tier: parts[0], slug: parts[1] };
}
