// Graph styles live with the components (injected via a <style> tag) rather than
// in BaseLayout, so the feature is self-contained. Palette vars fall back to the
// Codex values when the host page doesn't define them.
export const GRAPH_CSS = `
/* The full-bleed graph page lays its body out as a flex column (see BaseLayout): the
   host just fills the space left under the *real* topbar. Earlier this subtracted the
   static --topbar-h estimate, which was wrong on mobile (the topbar wraps onto two
   rows) and pushed the bottom-left legend off the bottom edge. */
.graph-host { width: 100%; height: 100%; }
.graph-hero {
  position: relative; margin: 0.4rem 0 2.2rem;
  border: 1px solid var(--hairline, #e3ddcf); border-radius: 12px; overflow: hidden;
  background: var(--bg, #fcfbf8);
}
.graph-hero .gph-wrap { height: 62vh; min-height: 360px; }
.hero-note { color: var(--muted, #75705f); font-size: 0.82rem; margin: -1.6rem 0 2rem; max-width: var(--measure, 68ch); }

.gph-wrap { position: relative; width: 100%; overflow: hidden; }
.gph-wrap canvas { display: block; }
.gph-msg {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: var(--muted, #75705f); font-size: 0.9rem; pointer-events: none;
}

.gph-panel {
  position: absolute; z-index: 3; display: flex; gap: 0.4rem; align-items: center;
  background: var(--panel-bg, rgba(252, 251, 248, 0.86)); backdrop-filter: blur(6px);
  border: 1px solid var(--hairline, #e3ddcf); border-radius: 10px; padding: 0.3rem 0.4rem;
}
.gph-tl { top: 0.7rem; left: 0.7rem; }
.gph-tr { top: 0.7rem; right: 0.7rem; padding: 0.15rem; }
.gph-bl { bottom: 0.7rem; left: 0.7rem; max-width: calc(100% - 1.4rem); }

.gph-seg { display: inline-flex; border: 1px solid var(--hairline, #e3ddcf); border-radius: 8px; overflow: hidden; }
.gph-seg button {
  border: 0; background: transparent; color: var(--muted, #75705f); cursor: pointer;
  font: 600 0.72rem 'Inter', sans-serif; letter-spacing: 0.04em; padding: 0.3rem 0.6rem;
}
.gph-seg button.on { background: var(--gold, #a8842c); color: #fff; }

.gph-btn {
  border: 1px solid var(--hairline, #e3ddcf); background: var(--bg, #fcfbf8); color: var(--text, #23211c);
  cursor: pointer; font: 500 0.72rem 'Inter', sans-serif; padding: 0.32rem 0.6rem; border-radius: 8px;
}
.gph-btn:hover { border-color: var(--gold-soft, #c9b06a); text-decoration: none; }
.gph-btn.on { background: var(--gold, #a8842c); color: #fff; border-color: var(--gold, #a8842c); }
a.gph-link { color: var(--link, #6a33b0); }

.gph-tr input {
  border: 0; background: transparent; outline: none; color: var(--text, #23211c);
  font: 500 0.78rem 'Inter', sans-serif; padding: 0.3rem 0.5rem; min-width: 9rem;
}

.gph-tune {
  top: 3.5rem; left: 0.7rem; flex-direction: column; align-items: stretch; gap: 0.55rem; width: 12.5rem;
}
.gph-tune label { display: flex; flex-direction: column; gap: 0.25rem; font: 500 0.72rem 'Inter', sans-serif; color: var(--text, #23211c); }
.gph-tune label.row { flex-direction: row; align-items: center; gap: 0.45rem; }
.gph-tune label > span { display: flex; justify-content: space-between; color: var(--muted, #75705f); }
.gph-tune label > span em { font-style: normal; color: var(--text, #23211c); font-variant-numeric: tabular-nums; }
.gph-tune input[type="range"] { width: 100%; accent-color: var(--gold, #a8842c); }
.gph-tune input[type="checkbox"] { accent-color: var(--gold, #a8842c); width: 14px; height: 14px; }

.gph-legend { flex-wrap: wrap; gap: 0.15rem 0.2rem; }
.gph-leg {
  display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;
  border: 0; background: transparent; color: var(--text, #23211c);
  font: 500 0.7rem 'Inter', sans-serif; padding: 0.18rem 0.4rem; border-radius: 6px;
}
.gph-leg:hover { background: var(--surface, #f4f1ea); }
.gph-leg .dot { position: relative; width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.gph-leg.off { color: var(--faint, #b3ad9d); }
.gph-leg.off .dot { opacity: 0.3; }
/* One-shot ring pulse when a tier is toggled — a GPU (transform/opacity) ripple
   around the legend dot, so the show/hide change registers. */
.gph-leg .dot.pulse::after {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  border: 1.5px solid var(--gold, #a8842c);
  animation: leg-pulse var(--dur-state, 200ms) var(--ease-out, cubic-bezier(0.25, 1, 0.5, 1));
}
@keyframes leg-pulse {
  from { transform: scale(1); opacity: 0.8; }
  to { transform: scale(2.6); opacity: 0; }
}

/* Pinned node summary card — left/top track the node; transform floats it just
   above, centred, with a small downward pointer. */
.gph-card {
  position: absolute; z-index: 5; left: 0; top: 0;
  transform: translate(-50%, calc(-100% - 14px));
  width: 17rem; max-width: calc(100vw - 2rem);
  background: rgba(252, 251, 248, 0.97); backdrop-filter: blur(8px);
  border: 1px solid var(--hairline, #e3ddcf); border-radius: 12px;
  box-shadow: 0 6px 22px rgba(35, 33, 28, 0.16);
  padding: 0.7rem 0.8rem 0.75rem; pointer-events: auto;
  /* Grow in from the node it's pinned to (pointer sits at the bottom). The
     positioning transform stays untouched — only the standalone scale + opacity
     animate, so the card never jumps. */
  transform-origin: bottom center;
  animation: gph-card-in var(--dur-state, 200ms) var(--ease-out, cubic-bezier(0.25, 1, 0.5, 1));
}
@keyframes gph-card-in {
  from { scale: 0.9; opacity: 0; }
  to { scale: 1; opacity: 1; }
}
.gph-card::after {
  content: ''; position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%) rotate(45deg);
  width: 12px; height: 12px; background: rgba(252, 251, 248, 0.97);
  border-right: 1px solid var(--hairline, #e3ddcf); border-bottom: 1px solid var(--hairline, #e3ddcf);
}
.gph-card-x {
  position: absolute; top: 0.3rem; right: 0.4rem; border: 0; background: transparent;
  color: var(--muted, #75705f); cursor: pointer; font-size: 1.05rem; line-height: 1; padding: 0.15rem 0.3rem;
}
.gph-card-x:hover { color: var(--text, #23211c); }
/* Compact head: small square codex thumbnail beside the kind + title. */
.gph-card-head { display: flex; align-items: flex-start; gap: 0.6rem; padding-right: 0.9rem; margin-bottom: 0.45rem; }
.gph-card-thumb {
  flex: none; width: 54px; height: 54px; border-radius: 8px;
  object-fit: cover; object-position: center top;
  border: 1px solid var(--hairline, #e3ddcf); background: var(--surface, #f4f1ea);
}
.gph-card-headtext { min-width: 0; }
.gph-card-kind {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font: 600 0.64rem 'Inter', sans-serif; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--muted, #75705f); margin-bottom: 0.2rem;
}
.gph-card-kind .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.gph-card-title {
  font-family: 'Cormorant Garamond', serif; font-size: 1.18rem; line-height: 1.15;
  color: var(--text, #23211c); margin: 0;
}
/* When there's no room above the node, the card flips below it — move the pointer
   to the top edge to match. */
.gph-card--below { transform: translate(-50%, 14px); transform-origin: top center; }
.gph-card--below::after {
  top: -7px; bottom: auto;
  border: 0; border-left: 1px solid var(--hairline, #e3ddcf); border-top: 1px solid var(--hairline, #e3ddcf);
}
.gph-card-sum {
  font: 400 0.78rem/1.45 'Inter', sans-serif; color: var(--text, #23211c);
  margin: 0 0 0.55rem; opacity: 0.85;
  /* Clamp to 3 lines so a long summary can't grow the card past the short local
     graph container (which clips it). The full text lives on the linked page. */
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
}
.gph-card-link { font: 600 0.76rem 'Inter', sans-serif; color: var(--link, #6a33b0); }
.gph-card-link:hover { text-decoration: underline; }
/* Card text colours are themed (go light in dark mode), so the surface must
   darken to match — otherwise it's light text on a cream card. */
:root[data-theme='dark'] .gph-card,
:root[data-theme='dark'] .gph-card::after {
  background: rgba(28, 25, 18, 0.97);
}

/* Full-graph right slide-out sidebar — fixed to the container's right edge, so it
   never clips and never chases the node. Shows the large art at native ratio. */
.gph-side {
  position: absolute; top: 0; right: 0; bottom: 0; z-index: 6;
  width: min(22rem, 86vw);
  display: flex; flex-direction: column; overflow-x: hidden; overflow-y: auto;
  background: rgba(252, 251, 248, 0.98); backdrop-filter: blur(10px);
  border-left: 1px solid var(--hairline, #e3ddcf);
  box-shadow: -8px 0 28px rgba(35, 33, 28, 0.14);
  transform: translateX(100%);
  transition: transform var(--dur-panel, 280ms) var(--ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
  pointer-events: auto;
}
.gph-side.open { transform: translateX(0); }
.gph-side-x {
  position: absolute; top: 0.55rem; right: 0.6rem; z-index: 2;
  width: 1.8rem; height: 1.8rem; border: 0; border-radius: 50%; cursor: pointer;
  background: rgba(252, 251, 248, 0.82); color: var(--muted, #75705f);
  font-size: 1.25rem; line-height: 1; display: flex; align-items: center; justify-content: center;
}
.gph-side-x:hover { color: var(--text, #23211c); }
/* Art renders at its true ratio (full width, natural height) so the whole image
   is always visible with no letterbox bars — landscapes are short and the body
   text sits directly beneath, portraits are tall. The sidebar scrolls if a tall
   portrait + body exceeds one viewport. */
.gph-side-img {
  display: block; width: 100%; height: auto; flex: 0 0 auto;
  background: var(--surface, #f4f1ea); border-bottom: 1px solid var(--hairline, #e3ddcf);
}
.gph-side-body { flex: 0 0 auto; padding: 1rem 1.15rem 1.5rem; }
.gph-side-title {
  font-family: 'Cormorant Garamond', serif; font-size: 1.7rem; line-height: 1.12;
  color: var(--text, #23211c); margin: 0.25rem 0 0.55rem; border: 0;
}
.gph-side-title::after { display: none; }
.gph-side-sum { font: 400 0.9rem/1.55 'Inter', sans-serif; color: var(--text, #23211c); opacity: 0.85; margin: 0 0 1rem; }
.gph-side-link { font: 600 0.85rem 'Inter', sans-serif; color: var(--link, #6a33b0); }
.gph-side-link:hover { text-decoration: underline; }
:root[data-theme='dark'] .gph-side { background: rgba(20, 22, 29, 0.98); }
:root[data-theme='dark'] .gph-side-x { background: rgba(20, 22, 29, 0.82); }

.localgraph { margin: 2.4rem 0 0.5rem; }
.localgraph h2 { font-family: 'Cormorant Garamond', serif; border: 0; font-size: 1.3rem; margin: 0 0 0.2rem; }
.localgraph h2::after { display: none; }
.localgraph .lg-sub { color: var(--muted, #75705f); font-size: 0.8rem; margin: 0 0 0.6rem; }
.gph-local {
  height: 320px; width: 100%;
  border: 1px solid var(--hairline, #e3ddcf); border-radius: 10px;
  background: var(--surface, #f4f1ea); overflow: hidden;
}
.gph-local canvas { display: block; }

/* ===== Phone (≤640): keep the graph itself visible behind the chrome ===== */
@media (max-width: 640px) {
  /* The fullscreen slide-out was min(22rem, 86vw) — almost the whole screen on a
     phone. Trim it so a usable strip of the graph stays visible alongside. */
  .gph-side { width: min(20rem, 72vw); }
  /* Shrink the pinned mini-card so it fits within (and clears) the short local
     graph container instead of clipping under its bottom edge. */
  .gph-card { width: min(15rem, calc(100vw - 1.5rem)); padding: 0.6rem 0.7rem 0.65rem; }
  .gph-card-thumb { width: 44px; height: 44px; }
  .gph-card-title { font-size: 1.05rem; }
}
`;
