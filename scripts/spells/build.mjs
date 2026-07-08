#!/usr/bin/env node
/**
 * Build the spell-hovercard data manifest for the party dashboard.
 *
 * Reads every distinct spell the party knows (the `sheet.spells` block in
 * `canon/characters/*.md`) and writes a committed `site/public/spells.json`
 * that the dashboard's <SpellHovercard> lazily fetches on first hover. Each
 * record carries a concise 5e summary (range / components / casting time /
 * duration / school / level / concise description) plus a link to the full
 * official page.
 *
 * DATA SOURCE: the open D&D 5e SRD API (dnd5eapi.co, 2014 ruleset). ~61 of the
 * party's spells are in the SRD and get full structured data. The ~11 that are
 * NOT (Booming Blade, Silvery Barbs, the smites, etc.) have no open data, so
 * their card shows name + level + a link only.
 *
 * EXTERNAL LINK is chosen per spell ("both / smart"):
 *   - SRD spell      -> D&D Beyond  (free, canonical page)
 *   - non-SRD spell  -> Roll20 compendium (full text readable free, since the
 *                       D&D Beyond entry for non-SRD spells is paywalled)
 *
 * WHY a committed JSON (not fetched at build): Vercel builds have no business
 * hitting a third-party API on every deploy. We fetch locally where the network
 * is available and commit the result — zero runtime/deploy dependency. Mirrors
 * the changelog.json / session-photos.json manifest pattern.
 *
 * REGENERATE when a character learns a new spell (or after a sheet resync):
 *
 *     node scripts/spells/build.mjs
 *
 * The output is keyed by lowercased spell name, which is exactly the dashboard's
 * `data-name` badge attribute — the client just does `map.get(badge.dataset.name)`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const CHARACTERS_DIR = join(ROOT, 'canon', 'characters');
const OUT = join(ROOT, 'site', 'public', 'spells.json');

const API = 'https://www.dnd5eapi.co/api/2014';
const SUMMARY_MAX = 320; // a hovercard teaser, not the full entry

/** kebab-case a spell name the way D&D Beyond slugs it (Blindness/Deafness -> blindness-deafness). */
const kebab = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ddbUrl = (name) => `https://www.dndbeyond.com/spells/${kebab(name)}`;
const roll20Url = (name) => `https://roll20.net/compendium/dnd5e/${encodeURIComponent(name)}`;

/** Collect distinct { name, level } across every character sheet's spell block. */
function collectSpells() {
  const seen = new Map(); // lc name -> { name, level }
  for (const file of readdirSync(CHARACTERS_DIR)) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue;
    const text = readFileSync(join(CHARACTERS_DIR, file), 'utf8');
    // Match the inline-table spell lines: - { name: "X", level: N }
    const re = /-\s*\{\s*name:\s*"([^"]+)"\s*,\s*level:\s*(\d+)\s*\}/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1].trim();
      const level = Number(m[2]);
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, { name, level });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Trim a (possibly multi-paragraph) SRD description to one concise teaser. */
function summarize(desc) {
  if (!Array.isArray(desc) || !desc.length) return '';
  let s = String(desc[0]).replace(/\s+/g, ' ').trim();
  if (s.length <= SUMMARY_MAX) return s;
  // Cut at the last sentence end, else last word boundary, before the cap.
  const slice = s.slice(0, SUMMARY_MAX);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastStop > SUMMARY_MAX * 0.6) return slice.slice(0, lastStop + 1);
  return slice.replace(/\s+\S*$/, '') + '…';
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function main() {
  const spells = collectSpells();
  console.log(`Found ${spells.length} distinct spells across the party.`);

  // One index call gives us the exact SRD slug for each spell, keyed by name.
  const index = await fetchJson(`${API}/spells`);
  const srdSlugByName = new Map();
  for (const r of index.results) srdSlugByName.set(r.name.toLowerCase(), r.index);

  const out = {};
  let srd = 0;
  const gaps = [];

  for (const { name, level } of spells) {
    const key = name.toLowerCase();
    const slug = srdSlugByName.get(key);

    if (slug) {
      // SRD spell — pull the full record from the API.
      const d = await fetchJson(`${API}/spells/${slug}`);
      out[key] = {
        name: d.name,
        level: d.level,
        school: d.school?.name ?? '',
        castingTime: d.casting_time ?? '',
        range: d.range ?? '',
        components: d.components ?? [],
        material: d.material ?? '',
        duration: d.duration ?? '',
        concentration: !!d.concentration,
        ritual: !!d.ritual,
        summary: summarize(d.desc),
        href: ddbUrl(d.name),
        source: 'dndbeyond',
        srd: true,
      };
      srd++;
    } else {
      // Non-SRD — no open data; name + level + a free-to-read Roll20 link.
      out[key] = {
        name,
        level,
        srd: false,
        href: roll20Url(name),
        source: 'roll20',
      };
      gaps.push(name);
    }
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(out).length} spells -> ${OUT}`);
  console.log(`  ${srd} SRD (full card, D&D Beyond link)`);
  console.log(`  ${gaps.length} non-SRD (name + level + Roll20 link): ${gaps.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
