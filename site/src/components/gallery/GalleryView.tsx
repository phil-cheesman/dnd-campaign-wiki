import { useEffect, useMemo, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import { track } from '@vercel/analytics';
import { GALLERY_CSS } from './gallery-css';

// Fisher–Yates — returns a new, jumbled array; leaves the input untouched.
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface GalleryItem {
  src: string;
  collection: string;
  slug: string;
  label: string;
  href: string;
  summary: string;
}
interface GalleryCategory {
  key: string;
  label: string;
  count: number;
}
interface GalleryData {
  items: GalleryItem[];
  categories: GalleryCategory[];
}

interface PhotoItem {
  src: string;
  thumb: string;
  w: number;
  h: number;
  caption: string;
  episode: string;
  label: string;
  href: string;
}
interface PhotoData {
  items: PhotoItem[];
  count: number;
  sessions: number;
}

type Source = 'art' | 'photos';

export default function GalleryView() {
  const [source, setSource] = useState<Source>('art');
  const [data, setData] = useState<GalleryData | null>(null);
  const [photos, setPhotos] = useState<PhotoData | null>(null);
  const [error, setError] = useState(false);
  const [cat, setCat] = useState<string>('all');
  const [index, setIndex] = useState(-1); // lightbox: -1 = closed
  // Where the lightbox should grow from — the centre of the clicked thumbnail,
  // in viewport px (the .yarl__container covers the viewport, so these map 1:1
  // to its transform-origin). Defaults to centre for keyboard/other opens.
  const [origin, setOrigin] = useState<{ x: string; y: string }>({ x: '50%', y: '50%' });

  const openAt = (n: number, el: HTMLElement | null) => {
    if (el) {
      const r = el.getBoundingClientRect();
      setOrigin({ x: `${r.left + r.width / 2}px`, y: `${r.top + r.height / 2}px` });
    }
    setIndex(n);
    track('gallery_open', { source, title: slides[n]?.title ?? '' });
  };

  // Artwork loads up front (default source); photos load lazily on first switch.
  useEffect(() => {
    let ok = true;
    fetch('/gallery.json')
      .then((r) => r.json())
      .then((d: GalleryData) => ok && setData(d))
      .catch(() => ok && setError(true));
    return () => {
      ok = false;
    };
  }, []);

  useEffect(() => {
    if (source !== 'photos' || photos) return;
    let ok = true;
    fetch('/gallery-photos.json')
      .then((r) => r.json())
      .then((d: PhotoData) => ok && setPhotos(d))
      .catch(() => ok && setError(true));
    return () => {
      ok = false;
    };
  }, [source, photos]);

  // Switching source closes any open lightbox so the index can't bleed across lists.
  function switchSource(next: Source) {
    setSource(next);
    setIndex(-1);
    track('gallery_source', { source: next });
  }

  // Jumble the artwork once per visit so the wall doesn't open on the same few
  // pieces every time. Re-shuffles only when fresh data arrives (a new mount),
  // so the order stays stable across category switches and lightbox indexing.
  const shuffled = useMemo(() => shuffle(data?.items ?? []), [data]);

  const artItems = useMemo(
    () => shuffled.filter((i) => cat === 'all' || i.collection === cat),
    [shuffled, cat],
  );
  const photoItems = photos?.items ?? [];

  // Lightbox slides for the active source.
  const artSlides = useMemo(
    () => artItems.map((i) => ({ src: i.src, title: i.label, description: i.summary, href: i.href })),
    [artItems],
  );
  const photoSlides = useMemo(
    () =>
      photoItems.map((p) => ({
        src: p.src,
        width: p.w,
        height: p.h,
        title: p.label,
        description: p.caption || undefined,
        href: p.href,
      })),
    [photoItems],
  );
  const slides = source === 'art' ? artSlides : photoSlides;

  if (error) {
    return (
      <div className="gal-wrap">
        <p className="gal-msg">Couldn’t load the gallery.</p>
      </div>
    );
  }

  return (
    <div className="gal-wrap" data-source={source}>
      <style>{GALLERY_CSS}</style>

      {/* Toolbar: source switch + (artwork-only) category filter */}
      <div className="gal-toolbar">
        <div className="gal-seg" role="group" aria-label="Gallery source">
          <button className={source === 'art' ? 'on' : ''} onClick={() => switchSource('art')}>
            Artwork
          </button>
          <button className={source === 'photos' ? 'on' : ''} onClick={() => switchSource('photos')}>
            Photos
          </button>
        </div>

        {source === 'art' && (
          <>
            {/* iPad+ : tappable chips (kept — Phil likes them on the tablet). */}
            <div className="gal-cats">
              <button className={cat === 'all' ? 'chip on' : 'chip'} onClick={() => setCat('all')}>
                All <em>{data?.items.length ?? 0}</em>
              </button>
              {(data?.categories ?? []).map((c) => (
                <button
                  key={c.key}
                  className={cat === c.key ? 'chip on' : 'chip'}
                  onClick={() => setCat(c.key)}
                >
                  {c.label} <em>{c.count}</em>
                </button>
              ))}
            </div>
            {/* Phone (≤640): the same filter as a compact dropdown — full-size chips
                ate too much of the small screen. Drives the same `cat` state. */}
            <select
              className="gal-cats-select"
              aria-label="Filter artwork by category"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="all">All ({data?.items.length ?? 0})</option>
              {(data?.categories ?? []).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.count})
                </option>
              ))}
            </select>
          </>
        )}

        {source === 'photos' && photos && (
          <span className="gal-meta">
            {photos.count} photos · {photos.sessions} sessions
          </span>
        )}
      </div>

      {/* ===== Artwork ===== */}
      {source === 'art' && !data && <p className="gal-msg">Unrolling the canvases…</p>}
      {source === 'art' && data && artItems.length === 0 && (
        <p className="gal-msg">No artwork in this category yet.</p>
      )}

      {source === 'art' && data && artItems.length > 0 && (
        <div className="gal-wall" key={`art-${cat}`}>
          {artItems.map((i, n) => (
            <figure
              key={i.src}
              className="gal-card"
              onClick={(e) => openAt(n, e.currentTarget)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openAt(n, e.currentTarget)}
            >
              <img src={i.src} alt={i.label} loading="lazy" />
              <figcaption>
                <span className="gal-card-title">{i.label}</span>
                <span className="gal-card-kind">{i.collection}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* ===== Photos: chronological wall ===== */}
      {source === 'photos' && !photos && <p className="gal-msg">Developing the photos…</p>}
      {source === 'photos' && photos && photoItems.length === 0 && (
        <p className="gal-msg">No session photos yet.</p>
      )}
      {source === 'photos' && photos && photoItems.length > 0 && (
        <div className="gal-wall" key="photos">
          {photoItems.map((p, n) => (
            <figure
              key={p.src}
              className="gal-card"
              onClick={(e) => openAt(n, e.currentTarget)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openAt(n, e.currentTarget)}
            >
              <img
                src={p.thumb}
                alt={p.caption || p.label}
                loading="lazy"
                width={p.w}
                height={p.h}
                style={{ aspectRatio: `${p.w} / ${p.h}` }}
              />
              <figcaption>
                <span className="gal-card-title">{p.caption}</span>
                <span className="gal-card-kind">{p.label.split(' — ')[0]}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Lightbox (artwork browse / photos) */}
      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={index < 0 ? 0 : index}
        slides={slides}
        plugins={[Zoom, Fullscreen, Captions, Thumbnails]}
        captions={{ descriptionTextAlign: 'center' }}
        thumbnails={{ width: 96, height: 64, border: 0, gap: 8 }}
        zoom={{ maxZoomPixelRatio: 3 }}
        render={{
          slideFooter: ({ slide }) =>
            (slide as any).href ? (
              <a className="gal-lb-link" href={(slide as any).href}>
                {source === 'photos' ? 'Open episode →' : 'Open page →'}
              </a>
            ) : null,
        }}
        styles={{
          root: {
            '--yarl__color_backdrop': 'rgba(12, 10, 6, 0.92)',
            '--lb-ox': origin.x,
            '--lb-oy': origin.y,
          } as any,
        }}
      />
    </div>
  );
}
