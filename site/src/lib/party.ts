/**
 * Derived maths for the party comparison dashboard (the /characters roster).
 *
 * The radar lives in lib/radar.ts; this file covers the *other* cross-character
 * visuals — the HP treemap, the AC/speed bar strips, the auto "party records",
 * and the collective soft-spot analysis. Pure functions, no DOM: the Astro
 * component renders whatever these return.
 */

import { type Abilities, RADAR_AXES } from './radar';

/** A spell a character can cast (cantrip = level 0). */
export type SpellRef = { name: string; level: number };

/** One character, flattened to just what the dashboard plots. */
export type PartyMember = {
  slug: string;
  name: string;
  color: string;
  abilities: Abilities;
  ac?: number | null;
  hp?: number | null;
  speed?: number | null;
  skills?: Record<string, number> | null;
  spells?: SpellRef[];
  feats?: string[];
};

/** 5e ability modifier. */
export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

/* ------------------------------------------------------------------ *
 * Skills heatmap — 18 skills as columns (grouped by ability), the six
 * PCs as rows; each cell tinted in that PC's colour by modifier size.
 * ------------------------------------------------------------------ */

export type SkillCol = { k: string; ab: string; abbr: string; full: string; groupStart: boolean };

export const SKILL_COLS: SkillCol[] = [
  ['athletics', 'STR', 'Ath', 'Athletics'],
  ['acrobatics', 'DEX', 'Acr', 'Acrobatics'],
  ['sleight-of-hand', 'DEX', 'Sl', 'Sleight of Hand'],
  ['stealth', 'DEX', 'Ste', 'Stealth'],
  ['arcana', 'INT', 'Arc', 'Arcana'],
  ['history', 'INT', 'His', 'History'],
  ['investigation', 'INT', 'Inv', 'Investigation'],
  ['nature', 'INT', 'Nat', 'Nature'],
  ['religion', 'INT', 'Rel', 'Religion'],
  ['animal-handling', 'WIS', 'AnH', 'Animal Handling'],
  ['insight', 'WIS', 'Ins', 'Insight'],
  ['medicine', 'WIS', 'Med', 'Medicine'],
  ['perception', 'WIS', 'Prc', 'Perception'],
  ['survival', 'WIS', 'Sur', 'Survival'],
  ['deception', 'CHA', 'Dec', 'Deception'],
  ['intimidation', 'CHA', 'Inti', 'Intimidation'],
  ['performance', 'CHA', 'Prf', 'Performance'],
  ['persuasion', 'CHA', 'Psu', 'Persuasion'],
].map(([k, ab, abbr, full], i, arr) => ({
  k,
  ab,
  abbr,
  full,
  groupStart: i === 0 || arr[i - 1][1] !== ab,
}));

/** Heat opacity for a skill modifier — faint at the low end, solid at the high. */
export const skillHeat = (mod: number): number =>
  Math.max(0.05, Math.min(1, (mod + 2) / 17));

/** Save modifier → radial fraction for the saves radar (Berrian's aura caps out). */
export const saveNorm = (mod: number): number =>
  Math.max(0, Math.min(1, (mod + 3) / 15));

/** "+3" / "-1" — modifier for an ability SCORE. */
export const fmtMod = (score: number): string => {
  const m = abilityMod(score);
  return m >= 0 ? `+${m}` : `${m}`;
};

/** "+3" / "-1" — sign an already-computed modifier (no recompute). */
export const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

/* ------------------------------------------------------------------ *
 * Horizontal bar strips (AC, speed) — independent per-character values.
 * Scaled from a floor a little below the party min so the spread reads;
 * a 13 and a 22 shouldn't look nearly identical.
 * ------------------------------------------------------------------ */

export type Bar = { slug: string; name: string; color: string; value: number; pct: number };

export function bars(
  party: PartyMember[],
  pick: (m: PartyMember) => number | null | undefined,
  unit = '',
): { rows: Bar[]; unit: string } {
  const vals = party
    .map((m) => ({ m, v: pick(m) }))
    .filter((x): x is { m: PartyMember; v: number } => typeof x.v === 'number');
  if (!vals.length) return { rows: [], unit };
  const max = Math.max(...vals.map((x) => x.v));
  const min = Math.min(...vals.map((x) => x.v));
  const floor = min - (max - min) * 0.35 - 0.5; // headroom so the smallest bar still shows
  const span = Math.max(max - floor, 1);
  const rows = vals
    .map(({ m, v }) => ({
      slug: m.slug,
      name: m.name,
      color: m.color,
      value: v,
      pct: Math.round(((v - floor) / span) * 100),
    }))
    .sort((a, b) => b.value - a.value);
  return { rows, unit };
}

/* ------------------------------------------------------------------ *
 * HP donut — arc length ∝ hit points, so the party's bulk reads as its
 * share of the ring. Compact (sits next to its own breakdown list) and
 * far shorter than a treemap. Arcs via the stroke-dasharray trick.
 * ------------------------------------------------------------------ */

export type DonutSeg = {
  slug: string;
  name: string;
  color: string;
  value: number;
  share: number; // 0..1 of party total
  dash: number; // visible arc length
  gap: number; // remainder of the circumference
  offset: number; // stroke-dashoffset placing this segment
};

export function donut(
  party: PartyMember[],
  r: number,
): { segs: DonutSeg[]; total: number } {
  const items = party
    .filter((m) => typeof m.hp === 'number' && (m.hp as number) > 0)
    .map((m) => ({ slug: m.slug, name: m.name, color: m.color, value: m.hp as number }))
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((s, it) => s + it.value, 0);
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = items.map((it) => {
    const share = total ? it.value / total : 0;
    const dash = share * C;
    const offset = -acc * C;
    acc += share;
    return { ...it, share, dash, gap: C - dash, offset };
  });
  return { segs, total };
}

/* ------------------------------------------------------------------ *
 * "Superlatives" — fun best/worst-of-the-party callouts straight off
 * the sheet: top stats AND top/bottom skills (so the Bard who can't lift
 * a chair still gets to be the smoothest talker in the room).
 * ------------------------------------------------------------------ */

export type Record_ = { key: string; icon: string; label: string; slug: string; name: string; value: string };

type RecDef = {
  key: string;
  icon: string;
  label: string;
  pick: (m: PartyMember) => number | null | undefined;
  fmt: (v: number) => string;
  min?: boolean; // pick the lowest instead of the highest
};

const skill = (m: PartyMember, k: string) => m.skills?.[k];

const REC_DEFS: RecDef[] = [
  // — Best of the party — (icon = Icon.astro line-icon name, not emoji)
  { key: 'hp', icon: 'heart', label: 'Tankiest', pick: (m) => m.hp, fmt: (v) => `${v} HP` },
  { key: 'ac', icon: 'shield', label: 'Hardest to hit', pick: (m) => m.ac, fmt: (v) => `${v} AC` },
  { key: 'speed', icon: 'zap', label: 'Fastest', pick: (m) => m.speed, fmt: (v) => `${v} ft` },
  { key: 'str', icon: 'dumbbell', label: 'Strongest', pick: (m) => m.abilities.str, fmt: (v) => `STR ${v}` },
  { key: 'persuasion', icon: 'message', label: 'Smoothest talker', pick: (m) => skill(m, 'persuasion'), fmt: (v) => `Persuasion ${signed(v)}` },
  { key: 'stealth', icon: 'eye-off', label: 'Stealthiest', pick: (m) => skill(m, 'stealth'), fmt: (v) => `Stealth ${signed(v)}` },
  { key: 'athletics', icon: 'award', label: 'Best athlete', pick: (m) => skill(m, 'athletics'), fmt: (v) => `Athletics ${signed(v)}` },
  { key: 'cha', icon: 'magnet', label: 'Most magnetic', pick: (m) => m.abilities.cha, fmt: (v) => `CHA ${v}` },
  // — Worst of the party —
  { key: 'glass', icon: 'heart-crack', label: 'Glass-jawed', pick: (m) => m.hp, fmt: (v) => `${v} HP`, min: true },
  { key: 'weakest', icon: 'feather', label: 'Weakest', pick: (m) => m.abilities.str, fmt: (v) => `STR ${v}`, min: true },
  { key: 'pokerface', icon: 'spade', label: 'Worst poker face', pick: (m) => skill(m, 'deception'), fmt: (v) => `Deception ${signed(v)}`, min: true },
];

export function records(party: PartyMember[]): Record_[] {
  const out: Record_[] = [];
  for (const def of REC_DEFS) {
    let best: PartyMember | null = null;
    let bestV = def.min ? Infinity : -Infinity;
    for (const m of party) {
      const v = def.pick(m);
      if (typeof v !== 'number') continue;
      if (def.min ? v < bestV : v > bestV) {
        bestV = v;
        best = m;
      }
    }
    if (best && isFinite(bestV)) {
      out.push({
        key: def.key,
        icon: def.icon,
        label: def.label,
        slug: best.slug,
        name: best.name,
        value: def.fmt(bestV),
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Collective soft spots — where even the party's best is thin, and who
 * is most exposed. Ranks the six abilities by party average; the lowest
 * couple are the "we all fail these saves" weaknesses.
 * ------------------------------------------------------------------ */

export type SoftSpot = {
  key: string;
  label: string;
  avg: number;
  bestName: string;
  bestScore: number;
  exposed: { slug: string; name: string; score: number }[];
};

export function softSpots(party: PartyMember[], take = 2): SoftSpot[] {
  if (!party.length) return [];
  const spots = RADAR_AXES.map(([label, key]) => {
    const k = key as keyof Abilities;
    const scored = party.map((m) => ({ m, score: m.abilities[k] }));
    const avg = scored.reduce((s, x) => s + x.score, 0) / scored.length;
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    const exposed = scored
      .filter((x) => abilityMod(x.score) <= 0) // mod +0 or worse = a real liability
      .sort((a, b) => a.score - b.score)
      .map((x) => ({ slug: x.m.slug, name: x.m.name, score: x.score }));
    return {
      key: key as string,
      label,
      avg,
      bestName: best.m.name,
      bestScore: best.score,
      exposed,
    };
  });
  return spots.sort((a, b) => a.avg - b.avg).slice(0, take);
}

/* ------------------------------------------------------------------ *
 * Party spellbook & feats — every spell/feat as a little badge that
 * carries colour dots for the PCs who hold it. The point is *coverage*:
 * a spell four people know is redundant; a spell one person knows is a
 * single point of failure ("only Vane can Counterspell"). Spec §3.4.
 * ------------------------------------------------------------------ */

/* Quick-filter buckets. A spell can wear more than one hat (Polymorph buffs an
 * ally or debuffs a foe; Cloudkill is both damage and area-denial). Covers the
 * well-known/useful spells the party actually carries; anything unmapped just
 * has no tag and is hidden when a category filter is active. */
export const SPELL_CAT_DEFS: { key: string; label: string }[] = [
  { key: 'healing', label: 'Healing' },
  { key: 'damage', label: 'Damage' },
  { key: 'buff', label: 'Buff' },
  { key: 'debuff', label: 'Debuff' },
  { key: 'utility', label: 'Utility' },
];

export const SPELL_CATEGORIES: Record<string, string[]> = {
  // Healing
  'Healing Word': ['healing'], 'Cure Wounds': ['healing'], 'Lesser Restoration': ['healing'],
  'Greater Restoration': ['healing'], 'Heal': ['healing'], 'Mass Healing Word': ['healing'],
  'Prayer of Healing': ['healing'], 'Aura of Vitality': ['healing'], 'Revivify': ['healing'],
  // Damage
  'Fire Bolt': ['damage'], 'Shocking Grasp': ['damage'], 'Sorcerous Burst': ['damage'],
  'Booming Blade': ['damage'], 'Thunderclap': ['damage'], 'Magic Missile': ['damage'],
  'Thunderwave': ['damage'], 'Thunderous Smite': ['damage'], 'Branding Smite': ['damage'],
  'Fireball': ['damage'], 'Disintegrate': ['damage'], 'Cloudkill': ['damage', 'debuff'],
  'Vicious Mockery': ['damage', 'debuff'], 'Dissonant Whispers': ['damage', 'debuff'],
  'Blinding Smite': ['damage', 'debuff'], 'Ensnaring Strike': ['damage', 'debuff'],
  'Lightning Bolt': ['damage'], 'Spirit Guardians': ['damage', 'debuff'], 'Inflict Wounds': ['damage'],
  'Guiding Bolt': ['damage'], 'Eldritch Blast': ['damage'], 'Toll the Dead': ['damage'],
  // Buff / protection
  'Shield': ['buff'], 'Shield of Faith': ['buff'], 'Absorb Elements': ['buff'],
  'Mirror Image': ['buff'], 'Protection from Evil and Good': ['buff'], 'Protection from Poison': ['buff'],
  'Protection from Energy': ['buff'], 'Pass without Trace': ['buff'], 'Hallow': ['buff', 'utility'],
  'Bless': ['buff'], 'Haste': ['buff'], 'Stoneskin': ['buff'], 'Blur': ['buff'], 'Aid': ['buff'],
  'Silvery Barbs': ['buff', 'debuff'], 'Alter Self': ['buff', 'utility'], 'Fly': ['buff', 'utility'],
  'Darkvision': ['buff', 'utility'],
  // Debuff / control
  'Blindness/Deafness': ['debuff'], 'Hold Person': ['debuff'], 'Hold Monster': ['debuff'],
  'Dominate Person': ['debuff'], 'Dominate Monster': ['debuff'], 'Suggestion': ['debuff'],
  'Command': ['debuff'], 'Eyebite': ['debuff'], 'Geas': ['debuff'], 'Banishment': ['debuff'],
  'Slow': ['debuff'], 'Fear': ['debuff'], 'Hypnotic Pattern': ['debuff'], 'Bane': ['debuff'],
  'Counterspell': ['debuff', 'utility'], 'Dispel Magic': ['debuff', 'utility'],
  'Plant Growth': ['debuff', 'utility'], 'Wall of Force': ['debuff', 'utility'],
  'Polymorph': ['debuff', 'buff'], 'Web': ['debuff'], 'Sleep': ['debuff'],
  // Utility
  'Minor Illusion': ['utility'], 'Mage Hand': ['utility'], 'Prestidigitation': ['utility'],
  'Dancing Lights': ['utility'], 'Mending': ['utility'], 'Silent Image': ['utility'],
  'Detect Magic': ['utility'], 'Detect Thoughts': ['utility'], 'See Invisibility': ['utility'],
  'Levitate': ['utility'], 'Misty Step': ['utility'], 'Dimension Door': ['utility'],
  'Teleport': ['utility'], 'Etherealness': ['utility'], 'Arcane Gate': ['utility'],
  'Divination': ['utility'], 'Find Familiar': ['utility'], 'Find Steed': ['utility'],
  'Find Greater Steed': ['utility'], 'Seeming': ['utility'], 'Comprehend Languages': ['utility'],
  'Darkness': ['utility', 'debuff'], 'Invisibility': ['utility', 'buff'],
  'Animal Friendship': ['utility', 'debuff'], 'Silence': ['utility', 'debuff'],
};

const catsFor = (name: string): string[] => SPELL_CATEGORIES[name] ?? [];

/** A PC who holds a given spell/feat (the dot inside a badge). */
export type Holder = { slug: string; name: string; color: string };

/** One spell badge: the name + every PC who can cast it, holder-sorted. */
export type SpellBadge = { name: string; level: number; holders: Holder[]; cats: string[] };

/** Spells sharing a level, rendered as one labelled row. */
export type LevelGroup = { level: number; label: string; entries: SpellBadge[] };

/** One feat badge: the name + every PC who has it. */
export type FeatBadge = { name: string; holders: Holder[] };

export type Spellbook = {
  groups: LevelGroup[]; // spell badges grouped by level, cantrips first
  feats: FeatBadge[]; // feat badges, holder-sorted then alpha
  uniqueSpells: SpellBadge[]; // single-holder spells — the coverage gaps
  uniqueFeats: FeatBadge[]; // single-holder feats
  totalSpells: number; // distinct spell names across the party
  sharedSpells: number; // spells known by 2+ PCs
  totalFeats: number;
  cats: { key: string; label: string; count: number }[]; // quick-filter buckets present in the data
  hasSpells: boolean;
  hasFeats: boolean;
};

/** "Cantrips" / "1st" / "2nd" … — a level's row label. */
export const levelLabel = (level: number): string => {
  if (level === 0) return 'Cantrips';
  const t = level % 100;
  const s = t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][level % 10] ?? 'th';
  return `${level}${s}`;
};

/** Shared/important first: most holders, then name. */
const byCoverage = (a: { holders: Holder[]; name: string }, b: { holders: Holder[]; name: string }) =>
  b.holders.length - a.holders.length || a.name.localeCompare(b.name);

export function spellbook(party: PartyMember[]): Spellbook {
  // Holder order follows the roster (party order) so dot colours stay stable.
  const holdersFor = (slugs: Set<string>): Holder[] =>
    party.filter((m) => slugs.has(m.slug)).map((m) => ({ slug: m.slug, name: m.name, color: m.color }));

  const spellMap = new Map<string, { level: number; slugs: Set<string> }>();
  for (const m of party) {
    for (const sp of m.spells ?? []) {
      const e = spellMap.get(sp.name);
      if (e) e.slugs.add(m.slug);
      else spellMap.set(sp.name, { level: sp.level, slugs: new Set([m.slug]) });
    }
  }
  const featMap = new Map<string, Set<string>>();
  for (const m of party) {
    for (const ft of m.feats ?? []) {
      const e = featMap.get(ft);
      if (e) e.add(m.slug);
      else featMap.set(ft, new Set([m.slug]));
    }
  }

  const spellBadges: SpellBadge[] = [...spellMap.entries()].map(([name, { level, slugs }]) => ({
    name,
    level,
    holders: holdersFor(slugs),
    cats: catsFor(name),
  }));
  const feats: FeatBadge[] = [...featMap.entries()]
    .map(([name, slugs]) => ({ name, holders: holdersFor(slugs) }))
    .sort(byCoverage);

  const byLevel = new Map<number, SpellBadge[]>();
  for (const b of spellBadges) {
    const arr = byLevel.get(b.level);
    if (arr) arr.push(b);
    else byLevel.set(b.level, [b]);
  }
  const groups: LevelGroup[] = [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      label: levelLabel(level),
      entries: (byLevel.get(level) as SpellBadge[]).sort(byCoverage),
    }));

  const uniqueSpells = spellBadges
    .filter((b) => b.holders.length === 1)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const uniqueFeats = feats.filter((b) => b.holders.length === 1);

  const cats = SPELL_CAT_DEFS.map((c) => ({
    ...c,
    count: spellBadges.filter((b) => b.cats.includes(c.key)).length,
  })).filter((c) => c.count > 0);

  return {
    groups,
    feats,
    uniqueSpells,
    uniqueFeats,
    totalSpells: spellBadges.length,
    sharedSpells: spellBadges.filter((b) => b.holders.length >= 2).length,
    totalFeats: feats.length,
    cats,
    hasSpells: spellBadges.length > 0,
    hasFeats: feats.length > 0,
  };
}
