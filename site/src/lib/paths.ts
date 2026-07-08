import { resolve } from 'node:path';

/**
 * Absolute path to the repo-root `canon/` dir. Astro always runs with cwd =
 * the project root (`site/`), and canon/ is its sibling — robust under config
 * bundling (which can rewrite import.meta.url).
 */
export const CANON_DIR = resolve(process.cwd(), '../canon');

/**
 * Every tier that gets its own per-item dossier pages (drives page generation in
 * `[collection]/[slug].astro` and the alias index). `kingdoms` lives here — kingdom
 * articles still exist — but it is intentionally absent from `NAV_TIERS` below.
 */
export const ENTITY_TIERS = [
  'characters',
  'npcs',
  // Kingdoms before Locations: a kingdom contains its locations, so it reads as
  // the parent tier in browse order (the gazetteer nests locations under kingdoms
  // for the same reason).
  'kingdoms',
  'locations',
  'factions',
  'items',
  'worldbuilding',
] as const;

export type EntityTier = (typeof ENTITY_TIERS)[number];

/**
 * Tiers that get a standalone top-level entry in the sidebar and the home "Browse"
 * grid. `kingdoms` is folded into the Locations gazetteer (clickable kingdom section
 * headers → the kingdom article), so it has dossier pages but no nav section of its
 * own; the bare `/kingdoms` index redirects to `/locations` (see astro.config.mjs).
 */
export const NAV_TIERS = ENTITY_TIERS.filter((t) => t !== 'kingdoms');

/** Singular labels for type badges / breadcrumbs ("NPC · Pirate Captain"). */
export const TIER_LABEL_SINGULAR: Record<string, string> = {
  characters: 'Character',
  npcs: 'NPC',
  locations: 'Location',
  kingdoms: 'Kingdom',
  factions: 'Faction',
  items: 'Item',
  worldbuilding: 'Lore',
  episodes: 'Episode',
  arcs: 'Arc',
};

/** Display labels for collections (singular-ish, for headings/links). */
export const TIER_LABELS: Record<string, string> = {
  characters: 'Party',
  npcs: 'NPCs',
  locations: 'Locations',
  kingdoms: 'Kingdoms',
  factions: 'Factions',
  items: 'Items',
  worldbuilding: 'Lore',
  episodes: 'Episodes',
  arcs: 'Arcs',
};
