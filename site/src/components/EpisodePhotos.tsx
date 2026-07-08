import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import type { SessionPhoto } from '../lib/session-photos';

const CSS = `
.ep-photos { margin: 0; }
.ep-photos-strip {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0.6rem;
}
.ep-photos-strip button {
  padding: 0; border: 1px solid var(--rule, #d8cdb5); border-radius: 4px;
  background: none; cursor: zoom-in; overflow: hidden; line-height: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12); transition: transform .12s ease, box-shadow .12s ease;
}
.ep-photos-strip button:hover {
  transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.22);
}
.ep-photos-strip img { height: 120px; width: auto; display: block; }
.ep-photos-strip button { height: 120px; }
`;

export default function EpisodePhotos({ photos }: { photos: SessionPhoto[] }) {
  const [index, setIndex] = useState(-1);
  if (!photos?.length) return null;

  const slides = photos.map((p) => ({
    src: p.src,
    width: p.w,
    height: p.h,
    description: p.caption || undefined,
  }));

  return (
    <div className="ep-photos">
      <style>{CSS}</style>
      <div className="ep-photos-strip">
        {photos.map((p, n) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setIndex(n)}
            aria-label={p.caption || `Open photo ${n + 1}`}
            style={{ width: Math.round((120 * p.w) / p.h) }}
          >
            <img
              src={p.thumb}
              alt={p.caption || ''}
              loading="lazy"
              width={Math.round((120 * p.w) / p.h)}
              height={120}
              style={{ aspectRatio: `${p.w} / ${p.h}` }}
            />
          </button>
        ))}
      </div>
      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={index < 0 ? 0 : index}
        slides={slides}
        plugins={[Zoom, Fullscreen, Captions]}
        captions={{ descriptionTextAlign: 'center' }}
        zoom={{ maxZoomPixelRatio: 3 }}
        styles={{ root: { '--yarl__color_backdrop': 'rgba(12, 10, 6, 0.92)' } as any }}
      />
    </div>
  );
}
