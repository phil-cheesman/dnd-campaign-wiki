import { readCanonFile } from './canon-scan';
import { stripNameDecoration } from './normalize';

export interface GlossaryEntry {
  /** Canonical display name (without trailing parenthetical status). */
  name: string;
  /** Raw aliases as written (un-normalized). */
  aliases: string[];
  /** Section the entry was found under (## heading). */
  section: string;
  /** Short description — the dash-delimited blurb, sans the Aliases/Episodes tail. */
  desc: string;
}

/**
 * Parse `canon/glossary.md`. The file is a bulleted list grouped by `##` section
 * (Player characters / NPCs / Locations / …), NOT a table. Each bullet looks like:
 *
 *   - **Name** (status) — description. Aliases: a, b, c. Episodes: E01, E02.
 *
 * We extract the bold canonical name and the `Aliases:` clause. Episodes/desc are
 * ignored for the index.
 */
export function parseGlossary(): GlossaryEntry[] {
  const { body } = readCanonFile('glossary.md');
  const lines = body.split('\n');
  const entries: GlossaryEntry[] = [];
  let section = '';

  for (const line of lines) {
    const sec = /^##\s+(.+?)\s*$/.exec(line);
    if (sec) {
      section = sec[1];
      continue;
    }
    // Bullet starting with a bold name.
    const m = /^\s*-\s+\*\*(.+?)\*\*(.*)$/.exec(line);
    if (!m) continue;

    // Drop a trailing parenthetical status on the bold name: `Name (deceased)`.
    // Shared helper keeps this identical to the dossier-side name key.
    const name = stripNameDecoration(m[1].trim());

    const rest = m[2];
    const aliases = extractAliases(rest);
    const desc = extractDesc(rest);
    entries.push({ name, aliases, section, desc });
  }
  return entries;
}

/** Pull the comma-separated list out of an `Aliases: …` clause (ends at `Episodes:` or end). */
function extractAliases(rest: string): string[] {
  const a = /Aliases:\s*(.+?)(?:\.\s*Episodes:|\.\s*$|$)/i.exec(rest);
  if (!a) return [];
  return a[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pull a short description: the text after the bullet's em-dash, up to the
 * `Aliases:`/`Episodes:` tail. Drops any trailing parenthetical editor's note
 * (e.g. "(Jon's house name …)") and truncates to a popup-friendly length.
 */
function extractDesc(rest: string): string {
  // rest = ` (status) — desc … Aliases: … Episodes: …`  (status & dashes optional)
  const dash = rest.indexOf('—');
  let s = dash >= 0 ? rest.slice(dash + 1) : rest;
  s = s.split(/\s+Aliases:/i)[0].split(/\s+Episodes:/i)[0];
  // Drop a trailing parenthetical editorial note.
  s = s.replace(/\s*\([^)]*\)\s*\.?\s*$/g, '').trim();
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 220) s = s.slice(0, 217).replace(/[\s,;:]+\S*$/, '') + '…';
  return s;
}
