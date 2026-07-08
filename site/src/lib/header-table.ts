// Build-time payload for the sortable TABLE view on the NPCs & Items header pages
// (spec: docs/specs/wiki-header-tables.md §3, §5). Every column derives from data
// that already exists in frontmatter + the backlink graph — no new authoring.
//
//   - NPCs: 8 columns (Name, Role, Allegiance, Status, Debut arc, Episodes,
//           Last seen, References).
//   - Items: 6 columns (Name, Type, Debut arc, Episodes, Last seen, References).
//
// The card (gallery) view is built separately in [collection]/index.astro; this
// file owns only the analyze-it table.
import { getPublic } from './collections';
import { getBacklinks } from './backlinks';
import { parseRange } from './episodes';

/** Parse an episode token ("E144" / "E108-dup2") → its number (144 / 108). */
export function epNum(e: string): number {
  const m = String(e).match(/E?(\d+)/i);
  return m ? Number(m[1]) : NaN;
}

export interface DebutArc {
  slug: string;
  title: string;
  order: number; // arc file ordinal — chronological sort key for the column
}

export interface TableRow {
  href: string;
  title: string;
  img: string | null;
  artType?: string;
  role: string | null;
  allegiance?: 'ally' | 'enemy' | 'neutral';
  status?: string | null;
  debutArc: DebutArc | null;
  episodes: number; // session appearances — episodes[] length
  lastSeen: number | null; // max episode number — drives the default sort
  refs: number; // all backlinks (includes episodes)
}

/** A sortable column descriptor consumed by EntityTableBody.astro. */
export interface ColumnDef {
  key: 'name' | 'role' | 'allegiance' | 'status' | 'debutArc' | 'episodes' | 'lastSeen' | 'refs';
  label: string;
  /** Drives client-side comparison + which `data-sort-*` attr the cell carries. */
  sort: 'text' | 'num' | 'arc' | 'allegiance' | 'status';
  /** Hidden ≤480px (spec §6 — lowest-value columns on a phone). */
  mobileHide?: boolean;
}

export interface TablePayload {
  columns: ColumnDef[];
  rows: TableRow[];
}

const NPC_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', sort: 'text' },
  { key: 'role', label: 'Role', sort: 'text' },
  { key: 'allegiance', label: 'Allegiance', sort: 'allegiance' },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'debutArc', label: 'Debut arc', sort: 'arc', mobileHide: true },
  { key: 'episodes', label: 'Episodes', sort: 'num' },
  { key: 'lastSeen', label: 'Last seen', sort: 'num' },
  { key: 'refs', label: 'References', sort: 'num', mobileHide: true },
];

const ITEM_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', sort: 'text' },
  { key: 'role', label: 'Type', sort: 'text' },
  { key: 'debutArc', label: 'Debut arc', sort: 'arc', mobileHide: true },
  { key: 'episodes', label: 'Episodes', sort: 'num' },
  { key: 'lastSeen', label: 'Last seen', sort: 'num' },
  { key: 'refs', label: 'References', sort: 'num', mobileHide: true },
];

/**
 * Build the arc lookup: parse each story arc's `episodes:` text range once into a
 * {slug, title, start, end, order} record, ordered by the numeric file prefix
 * (01-… , 02-…) so `order` sorts the Debut-arc column chronologically.
 */
async function buildArcs() {
  const arcEntries = await getPublic('arcs');
  return arcEntries
    .filter((a: any) => a.data.title && a.id !== '00-overview') // skip the campaign-overview arc (spans everything)
    .map((a: any) => {
      const nums = parseRange(a.data.episodes);
      return {
        slug: a.id,
        title: a.data.title as string,
        start: nums.length ? nums[0] : Infinity,
        end: nums.length ? nums[nums.length - 1] : -Infinity,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }))
    .map((a, i) => ({ ...a, order: i }));
}

export async function getTablePayload(collection: 'npcs' | 'items'): Promise<TablePayload> {
  const [entries, arcs] = await Promise.all([getPublic(collection as any), buildArcs()]);
  const backlinks = getBacklinks();

  /** Earliest episode → the arc whose range contains it. */
  const debutArcFor = (eps: string[]): DebutArc | null => {
    const nums = eps.map(epNum).filter((n) => !Number.isNaN(n));
    if (!nums.length) return null;
    const first = Math.min(...nums);
    const arc = arcs.find((a) => first >= a.start && first <= a.end);
    return arc ? { slug: arc.slug, title: arc.title, order: arc.order } : null;
  };

  const rows: TableRow[] = entries.map((e: any) => {
    const d = e.data;
    const eps: string[] = Array.isArray(d.episodes) ? d.episodes : [];
    const nums = eps.map(epNum).filter((n) => !Number.isNaN(n));
    return {
      href: `/${collection}/${e.id}`,
      title: d.name ?? e.id,
      img: d.art?.image ?? null,
      artType: d.art?.type,
      role: d.role ?? null,
      allegiance: collection === 'npcs' ? d.relation ?? undefined : undefined,
      status: collection === 'npcs' ? d.status ?? null : undefined,
      debutArc: debutArcFor(eps),
      episodes: eps.length,
      lastSeen: nums.length ? Math.max(...nums) : null,
      refs: backlinks.get(`${collection}/${e.id}`)?.length ?? 0,
    };
  });

  // Default sort: Last seen descending = "most recently referenced". Server-rendered
  // in this order so the table is correct before the client sort script runs.
  rows.sort((a, b) => (b.lastSeen ?? -1) - (a.lastSeen ?? -1) || a.title.localeCompare(b.title));

  return { columns: collection === 'npcs' ? NPC_COLUMNS : ITEM_COLUMNS, rows };
}
