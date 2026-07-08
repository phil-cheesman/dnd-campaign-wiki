import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { CANON_DIR } from './paths.ts';
import { getPublic } from './collections';
import { parseGlossary } from './glossary-parser';
import { matchKey, nameMatchKey } from './normalize';
import { getJourney, type Plane } from './journey.ts';

/**
 * Build-time payload for the map's EXPLORE (atlas) mode.
 *
 * Where Journey mode walks the ~15 narrative stops, Explore plots EVERY place
 * the campaign knows about — pulled from three sources and de-duplicated:
 *
 *   1. canon/map/places.yaml  — the calibrated, real coordinates (+ plane).
 *   2. canon/{locations,kingdoms,factions}/*.md — dossiers (give us href + art).
 *   3. canon/glossary.md "Locations" + "Factions" sections — the long tail of
 *      named places that have no dossier yet (name + blurb only).
 *
 * Entries without a real coordinate are SCATTERED across the map at a stable
 * pseudo-random position (seeded by key, so it never jumps between builds) and
 * flagged `placed: false` — a visible "pin me down later" state to calibrate via
 * /map?calibrate. Locations are bucketed under their kingdom (mirroring the
 * Locations gazetteer); factions get their own bucket.
 */

export type AtlasKind = 'location' | 'faction';

/** A place's position on one regional map (3c). Real if calibrated, else scattered. */
export interface RegionPos {
  x: number;
  y: number;
  placed: boolean;
}

export interface AtlasEntry {
  key: string;
  name: string;
  kind: AtlasKind;
  x: number;
  y: number;
  /** true = real coordinate from places.yaml; false = scattered placeholder. */
  placed: boolean;
  /** true = the party actually travelled here (it's a journey stop). */
  visited: boolean;
  plane: Plane;
  href: string | null;
  img: string | null;
  blurb: string | null;
  group: string; // group key (kingdom slug | 'other' | 'factions')
  /** Per-region positions (3c) — keyed by region map id. Present only for regions this
   *  entry belongs to (its group matches, or it was explicitly calibrated there). */
  regions?: Record<string, RegionPos>;
}

/** A drill-in map (3c) — a regional image the world swaps to. Keyed by map id. */
export interface RegionMap {
  image: string;
  width: number;
  height: number;
  label: string;
  /** atlas group slug to cross-filter the index to (null = no kingdom group). */
  group: string | null;
  parent: string;
}

export interface AtlasGroup {
  key: string;
  name: string;
  href: string | null; // group header link (kingdom dossier), if any
  img: string | null; // group art thumbnail, if any
  entries: AtlasEntry[];
}

export interface AtlasData {
  groups: AtlasGroup[];
  total: number;
  placed: number;
  /** Regional drill-in maps (3c), keyed by map id (e.g. `gidia`). */
  regionMaps: Record<string, RegionMap>;
}

interface RawPlace {
  x: number;
  y: number;
  plane?: Plane;
  dossier?: string | null;
  /** Per-region coordinates: `on: { gidia: { x, y } }` (3c). */
  on?: Record<string, { x: number; y: number }>;
}
interface RawMap {
  image: string;
  width: number;
  height: number;
  label?: string;
  group?: string | null;
  parent?: string;
}
interface PlacesFile {
  maps: Record<string, RawMap>;
  places: Record<string, RawPlace>;
}

// Province → kingdom slug (provinces live only in kingdom prose; baked here, the
// same table the gazetteer uses — keep in sync with lib/locations.ts).
const PROVINCE_TO_KINGDOM: Record<string, string> = {
  langdale: 'gidian-empire',
  wintervale: 'gidian-empire',
  strathmore: 'gidian-empire',
  champlet: 'carasian-kingdom',
  vierbonne: 'carasian-kingdom',
  vierteaux: 'carasian-kingdom',
  freienstein: 'luzonovian-sovereignty',
  waldemar: 'luzonovian-sovereignty',
  vittensten: 'luzonovian-sovereignty',
  sarirdir: 'parathia',
};

const GROUP_OTHER = 'other';
const GROUP_FACTIONS = 'factions';

/** Title-case a kebab place key: `callum-heights` → `Callum Heights`. */
function prettify(key: string): string {
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** FNV-1a → [0,1). Stable per string, so scattered pins never jump build-to-build. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Deterministic haphazard placement inside an 8% margin. */
function scatter(seed: string): { x: number; y: number } {
  return {
    x: +(0.08 + hash01(seed) * 0.84).toFixed(3),
    y: +(0.08 + hash01(seed + '#y') * 0.84).toFixed(3),
  };
}

function read<T>(rel: string): T {
  return yaml.load(readFileSync(join(CANON_DIR, rel), 'utf8')) as T;
}

let cache: AtlasData | null = null;

export async function getAtlas(): Promise<AtlasData> {
  if (cache) return cache;

  const [locations, kingdoms, factions] = await Promise.all([
    getPublic('locations'),
    getPublic('kingdoms'),
    getPublic('factions'),
  ]);
  const placesFile = read<PlacesFile>('map/places.yaml');
  const glossary = parseGlossary();
  // Place keys the party actually travelled to (= journey stops).
  const visitedKeys = new Set(getJourney().stops.map((s) => s.place));

  // --- regional maps (3c): every `maps:` entry with a parent is a drill-in region ---
  const regionDefs = Object.entries(placesFile.maps)
    .filter(([id, m]) => m.parent && id !== 'world')
    .map(([id, m]) => ({ id, group: m.group ?? null }));

  // An entry's positions on the regions it belongs to. Membership = its atlas group
  // matches the region's `group`, OR it was explicitly calibrated there (`on.<region>`).
  // Calibrated → real coord; otherwise scattered on that region's image (calibrate later).
  const regionsFor = (
    group: string,
    on: Record<string, { x: number; y: number }>,
    seed: string,
  ): Record<string, RegionPos> | undefined => {
    const out: Record<string, RegionPos> = {};
    for (const r of regionDefs) {
      const member = (r.group && r.group === group) || on[r.id] != null;
      if (!member) continue;
      out[r.id] = on[r.id]
        ? { x: on[r.id].x, y: on[r.id].y, placed: true }
        : { ...scatter(seed + '@' + r.id), placed: false };
    }
    return Object.keys(out).length ? out : undefined;
  };

  // --- kingdom resolution (name/alias/province → slug) ---
  const kingdomSlugByName = new Map<string, string>();
  for (const k of kingdoms) {
    const d = k.data as any;
    kingdomSlugByName.set(k.id, k.id);
    if (d.name) kingdomSlugByName.set(matchKey(d.name), k.id);
    for (const a of d.aliases ?? []) kingdomSlugByName.set(matchKey(a), k.id);
  }
  const resolveKingdom = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    const n = matchKey(raw);
    if (kingdomSlugByName.has(n)) return kingdomSlugByName.get(n);
    const prov = n.replace(/\s+province$/, '');
    return PROVINCE_TO_KINGDOM[prov];
  };

  // --- real coordinates, keyed by dossier slug AND by prettified-name key ---
  type CoordRec = {
    x: number;
    y: number;
    plane: Plane;
    visited: boolean;
    on: Record<string, { x: number; y: number }>;
  };
  const coordByKey = new Map<string, CoordRec>();
  const placeKeyConsumed = new Set<string>();
  for (const [pk, p] of Object.entries(placesFile.places)) {
    const rec: CoordRec = {
      x: p.x,
      y: p.y,
      plane: p.plane ?? 'world',
      visited: visitedKeys.has(pk),
      on: p.on ?? {},
    };
    coordByKey.set('name:' + matchKey(prettify(pk)), rec);
    if (p.dossier) coordByKey.set('slug:' + p.dossier, rec);
  }
  const coordFor = (slug: string | null, name: string) => {
    if (slug && coordByKey.has('slug:' + slug)) {
      placeKeyConsumed.add('slug:' + slug);
      return coordByKey.get('slug:' + slug)!;
    }
    const nk = 'name:' + nameMatchKey(name);
    if (coordByKey.has(nk)) {
      placeKeyConsumed.add(nk);
      return coordByKey.get(nk)!;
    }
    return null;
  };

  // --- registry, de-duplicated by name/alias match key ---
  const entries: AtlasEntry[] = [];
  const keyToEntry = new Map<string, AtlasEntry>(); // every name+alias key → entry
  const kingdomKeys = new Set(kingdomSlugByName.keys()); // glossary realms map to groups, not pins

  const register = (e: AtlasEntry, aliasKeys: string[]) => {
    entries.push(e);
    for (const k of [nameMatchKey(e.name), ...aliasKeys]) {
      if (!keyToEntry.has(k)) keyToEntry.set(k, e);
    }
  };
  const seen = (name: string, aliasKeys: string[]) =>
    [nameMatchKey(name), ...aliasKeys].some((k) => keyToEntry.has(k) || kingdomKeys.has(k));

  const add = (
    name: string,
    kind: AtlasKind,
    opts: {
      slug?: string;
      href?: string | null;
      img?: string | null;
      blurb?: string | null;
      group: string;
      aliases?: string[];
    },
  ) => {
    const aliasKeys = (opts.aliases ?? []).map(matchKey);
    if (seen(name, aliasKeys)) return;
    const coord = coordFor(opts.slug ?? null, name);
    const seed = opts.slug ? 'slug:' + opts.slug : 'name:' + name;
    const pos = coord ?? scatter(seed);
    register(
      {
        key: opts.slug ?? matchKey(name).replace(/[^a-z0-9]+/g, '-'),
        name,
        kind,
        x: pos.x,
        y: pos.y,
        placed: !!coord,
        visited: coord?.visited ?? false,
        plane: coord?.plane ?? 'world',
        href: opts.href ?? null,
        img: opts.img ?? null,
        blurb: opts.blurb ?? null,
        group: opts.group,
        regions: regionsFor(opts.group, coord?.on ?? {}, seed),
      },
      aliasKeys,
    );
  };

  // 1. Location dossiers (richest: href + art + kingdom).
  for (const loc of locations) {
    const d = loc.data as any;
    add(d.name ?? loc.id, 'location', {
      slug: loc.id,
      href: `/locations/${loc.id}`,
      img: d.art?.image ?? null,
      group: resolveKingdom(d.kingdom) ?? resolveKingdom(d.parent) ?? GROUP_OTHER,
      aliases: d.aliases ?? [],
    });
  }

  // 2. Faction dossiers.
  for (const f of factions) {
    const d = f.data as any;
    add(d.name ?? f.id, 'faction', {
      slug: f.id,
      href: `/factions/${f.id}`,
      img: d.art?.image ?? null,
      group: GROUP_FACTIONS,
      aliases: d.aliases ?? [],
    });
  }

  // 3. Glossary long tail — Locations & Factions sections, no dossier.
  for (const g of glossary) {
    if (g.section === 'Locations') {
      add(g.name, 'location', {
        blurb: g.desc || null,
        group: GROUP_OTHER,
        aliases: g.aliases,
      });
    } else if (g.section === 'Factions') {
      add(g.name, 'faction', { blurb: g.desc || null, group: GROUP_FACTIONS, aliases: g.aliases });
    }
  }

  // 4. Any calibrated place not yet consumed by a dossier/glossary entry
  //    (e.g. "carasian-coast" — a real coord with no article).
  for (const [pk, p] of Object.entries(placesFile.places)) {
    const nk = 'name:' + matchKey(prettify(pk));
    const sk = p.dossier ? 'slug:' + p.dossier : null;
    if (placeKeyConsumed.has(nk) || (sk && placeKeyConsumed.has(sk))) continue;
    if (keyToEntry.has(nameMatchKey(prettify(pk)))) continue;
    register(
      {
        key: pk,
        name: prettify(pk),
        kind: 'location',
        x: p.x,
        y: p.y,
        placed: true,
        visited: visitedKeys.has(pk),
        plane: p.plane ?? 'world',
        href: p.dossier ? `/locations/${p.dossier}` : null,
        img: null,
        blurb: null,
        group: GROUP_OTHER,
        regions: regionsFor(GROUP_OTHER, p.on ?? {}, 'name:' + matchKey(prettify(pk))),
      },
      [],
    );
  }

  // --- bucket into groups (kingdoms in slug order, then Other, then Factions) ---
  const byName = (a: AtlasEntry, b: AtlasEntry) => a.name.localeCompare(b.name);
  const bucket = new Map<string, AtlasEntry[]>();
  for (const e of entries) {
    if (!bucket.has(e.group)) bucket.set(e.group, []);
    bucket.get(e.group)!.push(e);
  }

  const groups: AtlasGroup[] = [];
  for (const k of kingdoms.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const d = k.data as any;
    groups.push({
      key: k.id,
      name: d.name ?? k.id,
      href: `/kingdoms/${k.id}`,
      img: d.art?.image ?? null,
      entries: (bucket.get(k.id) ?? []).sort(byName),
    });
  }
  groups.push({
    key: GROUP_OTHER,
    name: 'Other & unplaced',
    href: '/locations',
    img: null,
    entries: (bucket.get(GROUP_OTHER) ?? []).sort(byName),
  });
  groups.push({
    key: GROUP_FACTIONS,
    name: 'Factions & orders',
    href: '/factions',
    img: null,
    entries: (bucket.get(GROUP_FACTIONS) ?? []).sort(byName),
  });

  const regionMaps: Record<string, RegionMap> = {};
  for (const [id, m] of Object.entries(placesFile.maps)) {
    if (!m.parent || id === 'world') continue;
    regionMaps[id] = {
      image: m.image,
      width: m.width,
      height: m.height,
      label: m.label ?? prettify(id),
      group: m.group ?? null,
      parent: m.parent,
    };
  }

  cache = {
    groups: groups.filter((g) => g.entries.length),
    total: entries.length,
    placed: entries.filter((e) => e.placed).length,
    regionMaps,
  };
  return cache;
}
