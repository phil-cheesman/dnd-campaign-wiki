#!/usr/bin/env node
/**
 * Build the wiki changelog manifest.
 *
 * Walks `git log` over the two trees that represent reader-facing change —
 * `canon/` (the dossiers/episodes/arcs) and `site/public/art/` (generated
 * artwork) — classifies each touched file per commit, and writes a committed
 * `site/src/data/changelog.json` that both surfaces read:
 *   - the homepage "Latest edits" feed (`src/lib/recent.ts`)
 *   - the `/changelog` page (`src/pages/changelog.astro`)
 *
 * WHY a committed JSON (not git-at-build): Vercel shallow-clones, which would
 * truncate history and give a thin/wrong changelog. We run git locally where
 * full history is present and commit the result — zero git dependency at
 * deploy time. Mirrors the `session-photos.json` manifest pattern.
 *
 * REGENERATE after meaningful content commits, and ALWAYS after an
 * Adventure-Log resync + `scripts/sanitize/apply_overrides.py` run (so titles
 * are public-safe before they land in a changelog row):
 *
 *     node scripts/changelog/build.mjs
 *
 * Classification (see docs/specs/wiki-changelog.md §3):
 *   new-article  canon/<tier>/<slug>.md added (A)
 *   new-art      site/public/art/<tier>/<slug>.<ext> added (A)
 *   art-redo     an existing art file modified (M)
 *   edit         canon md modified (M) with changes NOT solely in the `art:`
 *                frontmatter block (a prompt tweak alone is not a content edit)
 *   maintenance  a bulk commit (>= N files, or a chore/docs/resync/sanitize/
 *                backfill message) collapsed to one muted line
 *
 * Excluded entirely: deletions, `_*` scratch files, `dm_only: true` dossiers,
 * and anything under a quarantine path — a changelog must never surface a
 * spoiler or a pre-sanitization title.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_PATH = join(REPO_ROOT, 'site', 'src', 'data', 'changelog.json');

// gray-matter lives in the site's node_modules; resolve it from there so this
// script runs regardless of the cwd it's invoked from.
const siteRequire = createRequire(join(REPO_ROOT, 'site', 'package.json'));
const matter = siteRequire('gray-matter');

/** Bulk-commit threshold: a commit touching >= this many canon/art files is
 *  collapsed into a single "maintenance" entry instead of expanded per-entity. */
const BULK_THRESHOLD = 20;

/** Tiers that get per-entity dossier pages (mirrors src/lib/paths ENTITY_TIERS
 *  + episodes/arcs). Files outside these are ignored for per-entity events. */
const ENTITY_TIERS = new Set([
  'characters',
  'npcs',
  'kingdoms',
  'locations',
  'factions',
  'items',
  'worldbuilding',
]);
const KNOWN_TIERS = new Set([...ENTITY_TIERS, 'episodes', 'arcs']);
const IMAGE_RE = /\.(png|jpe?g|webp|avif|gif)$/i;

// ── git plumbing ────────────────────────────────────────────────────────────

const RS = '\x1e'; // record sep — one per commit
const FS = '\x1f'; // field sep within the commit header line

/** Parse `git log --name-status` into commits, newest-first. */
function readLog() {
  const out = execFileSync(
    'git',
    [
      'log',
      '--no-renames', // keep statuses to A/M/D; slugs are stable so renames ~never happen
      '--name-status',
      '--date=iso-strict',
      `--format=${RS}%H${FS}%cI${FS}%s`,
      '--',
      'canon',
      'site/public/art',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );

  const commits = [];
  for (const chunk of out.split(RS)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n');
    const [hash, iso, subject] = lines[0].split(FS);
    const files = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      files.push({ status: line[0], path: line.slice(tab + 1) });
    }
    commits.push({ hash, iso, subject, files });
  }
  return commits;
}

/** Content of a path at a given revision, or null if absent (e.g. root commit). */
function showAt(rev, path) {
  try {
    return execFileSync('git', ['show', `${rev}:${path}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

// ── path + name resolution ──────────────────────────────────────────────────

/** canon/<tier>/<slug>.md → {tier, slug}; null if not a publishable entity file. */
function parseCanon(path) {
  const m = /^canon\/([^/]+)\/([^/]+)\.md$/.exec(path);
  if (!m) return null;
  const [, tier, slug] = m;
  if (!KNOWN_TIERS.has(tier)) return null;
  if (slug.startsWith('_')) return null; // scratch files
  return { tier, slug };
}

/** site/public/art/<tier>/<file> → {tier, slug, art}; null if not an art image. */
function parseArt(path) {
  const m = /^site\/public\/art\/([^/]+)\/([^/]+)$/.exec(path);
  if (!m) return null;
  const [, tier, file] = m;
  if (!ENTITY_TIERS.has(tier)) return null;
  if (!IMAGE_RE.test(file)) return null;
  return { tier, slug: file.replace(IMAGE_RE, ''), art: `/art/${tier}/${file}` };
}

function titleCase(slug) {
  return slug
    .replace(/^\d+-/, '') // arcs like "03-red-wedding"
    .split('-')
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

const nameCache = new Map();
/**
 * Resolve the public display name + dm_only flag for an entity from its CURRENT
 * (working-tree) dossier — same source the dossier page renders, so titles are
 * the sanitized/public ones. Returns null if the file is gone or dm_only.
 */
function resolveEntity(tier, slug) {
  const key = `${tier}/${slug}`;
  if (nameCache.has(key)) return nameCache.get(key);

  const file = join(REPO_ROOT, 'canon', tier, `${slug}.md`);
  let result = null;
  if (existsSync(file)) {
    try {
      const { data, content } = matter(readFileSync(file, 'utf8'));
      if (data?.dm_only === true) {
        result = null; // never surface a DM-only entity
      } else {
        let name;
        if (tier === 'episodes') {
          name = episodeLabel(slug, data.episode, data.title);
        } else if (tier === 'arcs') {
          const h1 = /^#\s+(.+)$/m.exec(content);
          name = data.title ?? data.name ?? (h1 ? h1[1].trim() : titleCase(slug));
        } else {
          name = data.name ?? data.title ?? titleCase(slug);
        }
        result = { name, href: `/${tier}/${slug}` };
      }
    } catch {
      result = null;
    }
  }
  nameCache.set(key, result);
  return result;
}

/** Mirrors src/lib/format.ts episodeLabel. */
function episodeLabel(slug, episode, title) {
  const num = `E${String(episode).padStart(2, '0')}`;
  const base = title ? `${num} — ${title}` : num;
  return slug.endsWith('-dup2') ? `${base} (session 2)` : base;
}

// ── art-block diff heuristic ────────────────────────────────────────────────

/**
 * Remove the `art:` top-level frontmatter block (the line plus its indented
 * children) so two frontmatters can be compared ignoring art-prompt churn.
 */
function stripArtBlock(fm) {
  if (!fm) return '';
  const lines = fm.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^art\s*:/.test(lines[i])) {
      i++;
      // consume indented children + interleaved blank lines until the next top-level key
      while (i < lines.length && (/^\s+\S/.test(lines[i]) || lines[i].trim() === '')) i++;
      i--; // re-examine the stopping line on the next outer iteration
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

/**
 * For a modified canon md: true when the ONLY change is inside the `art:`
 * frontmatter block (a prompt/visual tweak). Such a change is not a
 * reader-facing content edit and is suppressed unless an image file in the
 * same commit makes it a real new-art/art-redo event.
 */
function isArtBlockOnlyChange(hash, path) {
  const before = showAt(`${hash}^`, path);
  const after = showAt(hash, path);
  if (before == null || after == null) return false;
  if (before === after) return false;

  const b = matter(before);
  const a = matter(after);
  const bodyChanged = b.content.trim() !== a.content.trim();
  const fmChanged = stripArtBlock(b.matter) !== stripArtBlock(a.matter);
  return !bodyChanged && !fmChanged;
}

// ── classification ──────────────────────────────────────────────────────────

const PREFIX_SUPPRESS =
  /^(chore|docs|style)\b/i; /* conventional-commit noise prefixes */
const KEYWORD_SUPPRESS = /\b(resync|re-?sync|sanitiz(?:e|ed|ation)|backfill)\b/i;

function isMaintenanceCommit(subject, bulkCount) {
  if (bulkCount >= BULK_THRESHOLD) return true;
  if (PREFIX_SUPPRESS.test(subject) || KEYWORD_SUPPRESS.test(subject)) return true;
  return false;
}

/** Strip a leading `type(scope):` so the maintenance line reads cleanly. */
function cleanSummary(subject) {
  const m = /^[a-z]+(?:\([^)]*\))?:\s*(.+)$/i.exec(subject);
  const s = (m ? m[1] : subject).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function build() {
  const commits = readLog();
  const events = [];

  for (const { hash, iso, subject, files } of commits) {
    const date = iso.slice(0, 10);
    const short = hash.slice(0, 7);

    // Bulk count = every canon md + every art image the commit touched (incl.
    // dm_only/excluded — a resync hits those too, so they must count toward the
    // flood detection even though they never become individual events).
    const bulkCount = files.filter(
      (f) => /^canon\/.+\.md$/.test(f.path) || parseArt(f.path),
    ).length;

    if (isMaintenanceCommit(subject, bulkCount)) {
      if (bulkCount > 0) {
        events.push({
          date,
          iso,
          type: 'maintenance',
          summary: cleanSummary(subject),
          fileCount: bulkCount,
          commit: short,
        });
      }
      continue;
    }

    // Per-entity expansion. Collect art-file events first; they win the dedup
    // against an accompanying art-block-only frontmatter touch.
    const artKeys = new Set();
    const commitEvents = [];

    for (const f of files) {
      const art = parseArt(f.path);
      if (!art || (f.status !== 'A' && f.status !== 'M')) continue;
      const ent = resolveEntity(art.tier, art.slug);
      if (!ent) continue;
      artKeys.add(`${art.tier}/${art.slug}`);
      commitEvents.push({
        date,
        iso,
        type: f.status === 'A' ? 'new-art' : 'art-redo',
        tier: art.tier,
        slug: art.slug,
        name: ent.name,
        href: ent.href,
        art: art.art,
        commit: short,
      });
    }

    for (const f of files) {
      const canon = parseCanon(f.path);
      if (!canon) continue;
      if (f.status === 'D') continue; // deletions never surface
      const key = `${canon.tier}/${canon.slug}`;
      if (f.status === 'M') {
        // Art-block-only churn: skip — the image event (if any) already covers it.
        if (isArtBlockOnlyChange(hash, f.path)) continue;
      }
      if (artKeys.has(key)) continue; // image event already represents this entity
      const ent = resolveEntity(canon.tier, canon.slug);
      if (!ent) continue;
      commitEvents.push({
        date,
        iso,
        type: f.status === 'A' ? 'new-article' : 'edit',
        tier: canon.tier,
        slug: canon.slug,
        name: ent.name,
        href: ent.href,
        commit: short,
      });
    }

    events.push(...commitEvents);
  }

  // Newest-first (git log already is, but be explicit for downstream slicing).
  events.sort((x, y) => y.iso.localeCompare(x.iso));

  const manifest = { generatedAt: new Date().toISOString(), events };
  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n');

  // ── summary to stderr ──
  const counts = events.reduce((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  const summary = Object.entries(counts)
    .map(([t, n]) => `${t}=${n}`)
    .join('  ');
  process.stderr.write(
    `changelog: ${events.length} events from ${commits.length} commits  [${summary}]\n` +
      `wrote ${OUT_PATH.replace(REPO_ROOT + '/', '')}\n`,
  );
}

build();
