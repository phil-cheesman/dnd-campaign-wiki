/**
 * Alignment helpers — parse a "Lawful Good"-style string into the 3×3 grid axes,
 * and format the two-letter abbreviation (LG, CN, …).
 *
 * Grid axes: lawChaos rows = lawful | neutral | chaotic; goodEvil cols = good | neutral | evil.
 * "True Neutral" / "Neutral" collapse to the centre cell.
 */
export type LawChaos = 'lawful' | 'neutral' | 'chaotic';
export type GoodEvil = 'good' | 'neutral' | 'evil';

export const LAW_CHAOS: LawChaos[] = ['lawful', 'neutral', 'chaotic'];
export const GOOD_EVIL: GoodEvil[] = ['good', 'neutral', 'evil'];

export const LAW_CHAOS_LABEL: Record<LawChaos, string> = {
  lawful: 'Lawful',
  neutral: 'Neutral',
  chaotic: 'Chaotic',
};
export const GOOD_EVIL_LABEL: Record<GoodEvil, string> = {
  good: 'Good',
  neutral: 'Neutral',
  evil: 'Evil',
};

export interface AlignmentCell {
  lawChaos: LawChaos;
  goodEvil: GoodEvil;
  abbr: string; // e.g. "LG", "CN", "N"
  label: string; // normalised e.g. "Lawful Good", "True Neutral"
}

/** Parse "Lawful Good", "true neutral", "CG" → grid cell, or null if unrecognised. */
export function parseAlignment(raw: string | null | undefined): AlignmentCell | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();

  let lawChaos: LawChaos = 'neutral';
  if (s.includes('lawful')) lawChaos = 'lawful';
  else if (s.includes('chaotic')) lawChaos = 'chaotic';

  let goodEvil: GoodEvil = 'neutral';
  if (s.includes('good')) goodEvil = 'good';
  else if (s.includes('evil')) goodEvil = 'evil';

  // Bare "neutral" / "true neutral" stays centre; otherwise require a recognised axis word.
  const recognised =
    lawChaos !== 'neutral' || goodEvil !== 'neutral' || s.includes('neutral');
  if (!recognised) return null;

  const lc = LAW_CHAOS_LABEL[lawChaos];
  const ge = GOOD_EVIL_LABEL[goodEvil];
  const label = lawChaos === 'neutral' && goodEvil === 'neutral' ? 'True Neutral' : `${lc} ${ge}`;
  const abbr =
    lawChaos === 'neutral' && goodEvil === 'neutral'
      ? 'N'
      : `${lc[0].toUpperCase()}${ge[0].toUpperCase()}`;

  return { lawChaos, goodEvil, abbr, label };
}
