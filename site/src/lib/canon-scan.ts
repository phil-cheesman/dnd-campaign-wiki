import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { CANON_DIR } from './paths';

export interface CanonDoc {
  /** filename without extension == slug */
  slug: string;
  collection: string;
  data: Record<string, any>;
  body: string;
}

/** List `*.md` files in a canon subdir, skipping `_`-prefixed files/dirs. */
function listMarkdown(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of entries) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) continue; // tiers are flat; ignore nested dirs
    if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

const cache = new Map<string, CanonDoc[]>();

/**
 * Read all public docs in a canon tier (frontmatter + body), excluding
 * `_`-prefixed files and any entity with `dm_only: true`. Memoized.
 */
export function scanTier(collection: string): CanonDoc[] {
  const cached = cache.get(collection);
  if (cached) return cached;

  const dir = join(CANON_DIR, collection);
  const docs: CanonDoc[] = [];
  for (const file of listMarkdown(dir)) {
    const raw = readFileSync(file, 'utf8');
    const { data, content } = matter(raw);
    if (data?.dm_only === true) continue;
    const slug = file.slice(dir.length + 1).replace(/\.md$/, '');
    docs.push({ slug, collection, data: data ?? {}, body: content });
  }
  cache.set(collection, docs);
  return docs;
}

/** Read a single top-level canon file (e.g. glossary.md, timeline.md). */
export function readCanonFile(name: string): { data: Record<string, any>; body: string } {
  const raw = readFileSync(join(CANON_DIR, name), 'utf8');
  const { data, content } = matter(raw);
  return { data: data ?? {}, body: content };
}
