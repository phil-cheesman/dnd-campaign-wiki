// Build-time payload for the Locations header page — the "gazetteer" (spec §3.3).
//
// Locations are bucketed under their KINGDOM for a realm-by-realm outline, with
// an "External / Unaffiliated" bucket for anything that names no kingdom.
//
// Membership is messy and needs name resolution: a location links to its kingdom
// via a `kingdom` field that holds DISPLAY NAMES or ALIASES (e.g.
// `kingdom: "Gidian Empire"` while the kingdom's canonical name is "Gidia",
// slug `gidian-empire`) and/or a `parent` field that mixes kingdom slugs, kingdom
// names, AND province names (e.g. `parent: "Waldemar province"`). We resolve all
// three forms to a kingdom slug via each kingdom's name+aliases plus a small
// province→kingdom map (provinces are named only in the kingdom bodies, not in
// frontmatter, so the map is baked here). Anything unresolved falls to External.
import { getPublic } from './collections';

export interface GazRow {
  slug: string;
  name: string;
  href: string;
  img?: string | null;
  artType?: string;
}

export interface GazKingdom {
  slug: string;
  name: string;
  art: { image?: string | null; type?: string } | null;
  locations: GazRow[];
}

export interface GazPayload {
  kingdoms: GazKingdom[];
  external: GazRow[];
  total: number;
}

/**
 * Provinces are described only in the kingdoms' prose, never in frontmatter, so
 * the `parent: "<X> province"` → kingdom mapping is baked here from those bodies
 * (canon/kingdoms/*.md "Provinces" sections). Keys are normalized province names.
 */
const PROVINCE_TO_KINGDOM: Record<string, string> = {
  // Gidia (Gidian Empire)
  langdale: 'gidian-empire',
  wintervale: 'gidian-empire',
  strathmore: 'gidian-empire',
  // Carasian Kingdom
  champlet: 'carasian-kingdom',
  vierbonne: 'carasian-kingdom',
  vierteaux: 'carasian-kingdom',
  // Luzonovia (Luzonovian Sovereignty)
  freienstein: 'luzonovian-sovereignty',
  waldemar: 'luzonovian-sovereignty',
  vittensten: 'luzonovian-sovereignty',
  // Parathia
  sarirdir: 'parathia',
};

/**
 * Normalize a name/alias/parent token for matching: lowercase, drop a trailing
 * "province"/"kingdom"/"empire"/"sovereignty" qualifier, collapse whitespace.
 * "Waldemar province" → "waldemar"; "Gidian Empire" stays "gidian empire" (it's
 * matched as a full alias, not a province), so we only strip the trailing word
 * for the province lookup — see resolveKingdomSlug.
 */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function getLocationsPayload(): Promise<GazPayload> {
  const [locations, kingdomEntries] = await Promise.all([
    getPublic('locations'),
    getPublic('kingdoms'),
  ]);

  // name/alias (normalized) → kingdom slug, and the kingdom's own slug → slug.
  const slugByName = new Map<string, string>();
  for (const k of kingdomEntries) {
    const d = k.data as any;
    slugByName.set(k.id, k.id); // slug matches slug
    if (d.name) slugByName.set(norm(d.name), k.id);
    for (const a of d.aliases ?? []) slugByName.set(norm(a), k.id);
  }

  // Resolve a raw `kingdom`/`parent` token to a kingdom slug, or undefined.
  const resolveKingdomSlug = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    const n = norm(raw);
    // Direct hit: slug, canonical name, or any alias.
    if (slugByName.has(n)) return slugByName.get(n);
    // Province form: "<province> province" or a bare province name.
    const prov = n.replace(/\s+province$/, '');
    if (PROVINCE_TO_KINGDOM[prov]) return PROVINCE_TO_KINGDOM[prov];
    return undefined;
  };

  const toRow = (e: any): GazRow => ({
    slug: e.id,
    name: e.data.name ?? e.id,
    href: `/locations/${e.id}`,
    img: e.data.art?.image ?? null,
    artType: e.data.art?.type,
  });

  // Bucket each location: prefer the `kingdom` field, fall back to `parent`.
  const byKingdom = new Map<string, GazRow[]>();
  const external: GazRow[] = [];
  for (const loc of locations) {
    const d = loc.data as any;
    const slug = resolveKingdomSlug(d.kingdom) ?? resolveKingdomSlug(d.parent);
    const row = toRow(loc);
    if (slug) {
      if (!byKingdom.has(slug)) byKingdom.set(slug, []);
      byKingdom.get(slug)!.push(row);
    } else {
      external.push(row);
    }
  }

  const byName = (a: GazRow, b: GazRow) => a.name.localeCompare(b.name);

  // Emit every kingdom (even those with no catalogued locations yet, e.g.
  // Maadolonia), sorted by slug — which is the spec's canonical order.
  const kingdoms: GazKingdom[] = kingdomEntries
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((k) => {
      const d = k.data as any;
      return {
        slug: k.id,
        name: d.name ?? k.id,
        art: d.art ? { image: d.art.image ?? null, type: d.art.type } : null,
        locations: (byKingdom.get(k.id) ?? []).slice().sort(byName),
      };
    });

  external.sort(byName);

  return { kingdoms, external, total: locations.length };
}
