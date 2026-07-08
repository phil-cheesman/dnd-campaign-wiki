import data from '../data/session-photos.json';

export interface SessionPhoto {
  /** Lightbox-size WebP (long edge <=1600). */
  src: string;
  /** Strip-size WebP (long edge <=400). */
  thumb: string;
  /** Pixel dimensions of `src` (for layout / lightbox zoom). */
  w: number;
  h: number;
  /** Optional custom caption (empty string = none). */
  caption: string;
}

const PHOTOS = data as Record<string, SessionPhoto[]>;

/** Table photos for an episode, in capture order. Empty array if none. */
export function getEpisodePhotos(slug: string): SessionPhoto[] {
  return PHOTOS[slug] ?? [];
}
