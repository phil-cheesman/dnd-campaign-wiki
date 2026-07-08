/** "E09 — Beauboi Show", with (session 2) appended for -dup2 files. Untitled → just "E45". */
export function episodeLabel(slug: string, episode: number, title?: string | null): string {
  const num = `E${String(episode).padStart(2, '0')}`;
  const base = title ? `${num} — ${title}` : num;
  return slug.endsWith('-dup2') ? `${base} (session 2)` : base;
}

/** ISO date → "20 Apr 2022". */
export function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
