/** Scoped styles for the gallery island. Injected via a <style> tag in
 *  GalleryView so they ship with the client island (mirrors graph-css.ts).
 *  Colours reference the global theme tokens (--bg, --gold, …). */
export const GALLERY_CSS = `
.gal-wrap { width: 100%; min-height: calc(100vh - var(--topbar-h) - 1px); }
.gal-msg { color: var(--muted); text-align: center; padding: 4rem 1rem; font-size: 0.95rem; }

/* ===== Toolbar ===== */
.gal-toolbar {
  position: sticky;
  top: var(--topbar-h);
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem 1.2rem;
  padding: 0.85rem 2rem;
  background: var(--panel-bg);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--hairline);
}
.gal-seg { display: inline-flex; border: 1px solid var(--hairline); border-radius: 9px; overflow: hidden; }
.gal-seg button {
  border: 0; background: transparent; color: var(--muted); cursor: pointer;
  font: 600 0.78rem 'Inter', sans-serif; letter-spacing: 0.04em; padding: 0.4rem 0.95rem;
}
.gal-seg button.on { background: var(--gold); color: #fff; }

.gal-meta {
  color: var(--muted); font: 500 0.76rem 'Inter', sans-serif;
  letter-spacing: 0.02em; font-variant-numeric: tabular-nums;
}

.gal-cats { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.gal-cats .chip {
  border: 1px solid var(--hairline); background: var(--bg); color: var(--muted); cursor: pointer;
  font: 500 0.74rem 'Inter', sans-serif; padding: 0.3rem 0.7rem; border-radius: 99px;
  display: inline-flex; align-items: baseline; gap: 0.35rem;
}
.gal-cats .chip:hover { border-color: var(--gold-soft); color: var(--text); }
.gal-cats .chip.on { background: var(--gold); border-color: var(--gold); color: #fff; }
.gal-cats .chip em { font-style: normal; font-size: 0.66rem; opacity: 0.7; font-variant-numeric: tabular-nums; }

/* Phone-only category dropdown (mirror of the chips). Hidden on tablet/desktop,
   where the chips are shown instead (see the ≤640 block below). */
.gal-cats-select {
  display: none;
  font: 500 0.82rem 'Inter', sans-serif; color: var(--text);
  background: var(--bg); border: 1px solid var(--hairline); border-radius: 9px;
  padding: 0 0.7rem; min-height: 2.75rem; min-width: 9rem; cursor: pointer;
}
.gal-cats-select:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

/* ===== Browse: cascading masonry wall (CSS multi-column) ===== */
.gal-wall {
  column-width: 230px;
  column-gap: 1rem;
  padding: 1.5rem 2rem 4rem;
  max-width: 1500px;
  margin: 0 auto;
}
.gal-card {
  break-inside: avoid;
  margin: 0 0 1rem;
  position: relative;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
  cursor: zoom-in;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.gal-card:hover {
  transform: translateY(-3px);
  border-color: var(--gold-soft);
  box-shadow: 0 10px 28px -12px rgba(0,0,0,0.45);
}
.gal-card:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
/* The card clips (overflow: hidden), so a slight zoom + warm-up on hover gives the
   wall some life without nudging neighbours. figcaption sits above this and is
   unaffected (absolutely positioned). */
.gal-card img {
  display: block; width: 100%; height: auto;
  transform-origin: center;
  transition: transform 0.45s var(--ease-out, ease), filter 0.45s ease;
}
.gal-card:hover img,
.gal-card:focus-visible img {
  transform: scale(1.06);
  filter: brightness(1.04) saturate(1.05);
}
@media (prefers-reduced-motion: reduce) {
  .gal-card img { transition: none; }
  .gal-card:hover img, .gal-card:focus-visible img { transform: none; filter: none; }
}

/* Masonry stagger — cards fade+rise in sequence on first paint and whenever the
   category filter changes (the wall is keyed by category, so it remounts). The
   stagger is capped so the whole sweep stays well under the ceiling. */
@media (prefers-reduced-motion: no-preference) {
  .gal-wall .gal-card { animation: gal-rise var(--dur-state) var(--ease-out) both; }
  .gal-wall .gal-card:nth-child(1) { animation-delay: 0ms; }
  .gal-wall .gal-card:nth-child(2) { animation-delay: 30ms; }
  .gal-wall .gal-card:nth-child(3) { animation-delay: 60ms; }
  .gal-wall .gal-card:nth-child(4) { animation-delay: 90ms; }
  .gal-wall .gal-card:nth-child(5) { animation-delay: 120ms; }
  .gal-wall .gal-card:nth-child(6) { animation-delay: 150ms; }
  .gal-wall .gal-card:nth-child(7) { animation-delay: 180ms; }
  .gal-wall .gal-card:nth-child(8) { animation-delay: 210ms; }
  .gal-wall .gal-card:nth-child(n + 9) { animation-delay: 240ms; }
}
@keyframes gal-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.gal-card figcaption {
  position: absolute; left: 0; right: 0; bottom: 0;
  display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem;
  padding: 1.6rem 0.8rem 0.6rem;
  background: linear-gradient(to top, rgba(10,8,4,0.82), rgba(10,8,4,0));
  opacity: 0; transition: opacity 0.18s ease;
}
.gal-card:hover figcaption, .gal-card:focus-visible figcaption { opacity: 1; }
.gal-card-title { color: #fff; font: 600 0.9rem 'Cormorant Garamond', serif; font-size: 1.02rem; }
.gal-card-kind {
  color: var(--gold-soft); font: 600 0.58rem 'Inter', sans-serif;
  text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap;
}

/* ===== Lightbox extras ===== */
/* Grow the lightbox from the clicked thumbnail (continuity) rather than fading
   from centre. --lb-ox/--lb-oy are set per-open to the thumbnail's viewport
   centre; .yarl__container fills the viewport so they map straight to its
   transform-origin. One-shot, GPU transform/opacity; YARL's own backdrop fade
   darkens behind it. */
@media (prefers-reduced-motion: no-preference) {
  .yarl__container {
    transform-origin: var(--lb-ox, 50%) var(--lb-oy, 50%);
    animation: gal-lb-open var(--dur-panel) var(--ease-out);
  }
}
@keyframes gal-lb-open {
  from { transform: scale(0.2); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Anchored top-centre as a pill so it never sits under the prev/next nav
   arrows (mid-height, left/right) or the toolbar icons (top-right). Without
   this it renders as a flex sibling of the image and the next-arrow eats the
   click. */
.gal-lb-link {
  position: absolute; top: 0.85rem; left: 50%; transform: translateX(-50%);
  z-index: 5; pointer-events: auto;
  padding: 0.4rem 0.95rem; border-radius: 999px;
  background: rgba(20, 16, 8, 0.72); border: 1px solid rgba(232, 200, 112, 0.35);
  color: #e8c870; font: 600 0.85rem 'Inter', sans-serif; white-space: nowrap;
  backdrop-filter: blur(2px);
}
.gal-lb-link:hover { color: #fff; background: rgba(20, 16, 8, 0.9); }

@media (max-width: 1080px) {
  .gal-toolbar { padding: 0.7rem 1rem; }
  .gal-wall { padding: 1.2rem 1rem 3rem; column-width: 160px; }
}

/* Phone (≤640): swap the category chips for a compact dropdown — the full-size
   tap-target chips wrapped into several rows and crowded the small screen. The
   chips stay on iPad/tablet (>640), which Phil prefers. */
@media (max-width: 640px) {
  .gal-cats { display: none; }
  .gal-cats-select { display: inline-flex; }
}

/* Phone (≤480): grow the Artwork/Photos segment to a 44px tap target (mobile
   spec Phase 4). The category chips are a dropdown here (≤640). */
@media (max-width: 480px) {
  .gal-seg button { min-height: 2.75rem; padding: 0.4rem 1.05rem; }
}
`;
