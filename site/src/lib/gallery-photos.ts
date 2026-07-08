import photos from '../data/session-photos.json';
import { getPublic } from './collections';
import { episodeLabel } from './format';

export interface PhotoGalleryItem {
  /** Lightbox-size WebP. */
  src: string;
  /** Strip-size WebP. */
  thumb: string;
  w: number;
  h: number;
  caption: string;
  /** Owning episode slug. */
  episode: string;
  /** "E91 — Title" (short "E91" if untitled). */
  label: string;
  /** Link to the episode page. */
  href: string;
}

export interface PhotoGalleryData {
  items: PhotoGalleryItem[];
  count: number;
  sessions: number;
}

type RawPhoto = { src: string; thumb: string; w: number; h: number; caption: string };
const DATA = photos as Record<string, RawPhoto[]>;

/**
 * Flatten the episode-keyed session-photo index into one chronological list
 * (oldest session first), joining each episode's label + page link. Used by
 * the gallery island's "Photos" source.
 */
export async function getPhotoGalleryData(): Promise<PhotoGalleryData> {
  const eps = await getPublic('episodes');
  const meta = new Map(
    eps.map((e: any) => [e.id, { num: e.data.episode ?? 0, title: e.data.title as string | null }]),
  );

  const slugs = Object.keys(DATA).sort((a, b) => {
    const na = meta.get(a)?.num ?? 0;
    const nb = meta.get(b)?.num ?? 0;
    return na - nb || a.localeCompare(b);
  });

  const items: PhotoGalleryItem[] = [];
  for (const slug of slugs) {
    const m = meta.get(slug);
    const label = m ? episodeLabel(slug, m.num, m.title) : slug;
    for (const p of DATA[slug]) {
      items.push({ ...p, episode: slug, label, href: `/episodes/${slug}` });
    }
  }
  return { items, count: items.length, sessions: slugs.length };
}
