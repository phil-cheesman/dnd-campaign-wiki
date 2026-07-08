import { contentEvents, tierLabel, type ChangeType } from './changelog';

export interface RecentEntry {
  name: string;
  tier: string;
  tierLabel: string;
  href: string;
  date: string; // ISO
  type: ChangeType; // what changed (new-article | new-art | art-redo | edit)
  isNew: boolean; // brand-new article or art (vs. an edit)
  art?: string; // thumbnail URL for new-art / art-redo rows
}

/**
 * "Latest edits" feed: newest reader-facing changes across the codex, read from
 * the committed changelog manifest (`scripts/changelog/build.mjs`). Maintenance
 * (bulk resync/sanitize) rows are already excluded by `contentEvents()`, so they
 * never appear in the homepage pulse. Newest-first.
 */
export function getRecent(limit = 8): RecentEntry[] {
  return contentEvents()
    .slice(0, limit)
    .map((e) => ({
      name: e.name ?? '',
      tier: e.tier ?? '',
      tierLabel: tierLabel(e.tier),
      href: e.href ?? '#',
      date: e.iso,
      type: e.type,
      isNew: e.type === 'new-article' || e.type === 'new-art',
      art: e.art,
    }));
}

/** "3 days ago" / "today" relative to build time. */
export function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
}
