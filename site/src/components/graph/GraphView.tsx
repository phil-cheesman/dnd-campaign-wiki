import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { forceCollide, forceX, forceY } from 'd3-force-3d';
import { track } from '@vercel/analytics';
import { useMeasure } from './useMeasure';
import { useTheme } from './useTheme';
import { GRAPH_CSS } from './graph-css';
import {
  adjacency,
  colorFor,
  dimNodeFor,
  graph3dBgFor,
  graphBgFor,
  inkFor,
  LEGEND_ORDER,
  linkEnd,
  radius,
  TYPE_META,
  type GraphData,
  type GraphLink,
  type GraphNode,
} from './graph-meta';

// force-graph touches `window` at module load, so it must never be imported on
// the server. Lazy imports keep this module SSR-safe; 3D (ThreeJS, heavy) also
// only loads when the user actually flips the toggle.
const ForceGraph2D = lazy(() => import('react-force-graph-2d'));
const ForceGraph3D = lazy(() => import('react-force-graph-3d'));

const TWO_PI = 2 * Math.PI;
const ORIGIN = { x: 0, y: 0 };

// Per-node art is painted straight onto the canvas, so each image URL is loaded
// once into an HTMLImageElement and cached module-wide (survives remounts / both
// graphs on a page). `null` marks a load failure so we don't retry it. The canvas
// runs with autoPauseRedraw off, so a freshly-decoded image is picked up on the
// next frame without us having to force a redraw.
const imgCache = new Map<string, HTMLImageElement | null>();
function nodeImage(src: string): HTMLImageElement | null {
  const hit = imgCache.get(src);
  if (hit !== undefined) return hit;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => imgCache.set(src, img);
  img.onerror = () => imgCache.set(src, null);
  img.src = src;
  imgCache.set(src, img); // placeholder; draw is gated on img.complete below
  return img;
}

// When "cluster by type" is on, each tier is pulled toward an anchor arranged
// around a ring, so same-type nodes gather into their own bubble.
const CLUSTER_R = 320;
const TYPE_ANCHOR: Record<string, { x: number; y: number }> = {};
LEGEND_ORDER.forEach((t, i) => {
  const a = (i / LEGEND_ORDER.length) * TWO_PI;
  TYPE_ANCHOR[t] = { x: Math.cos(a) * CLUSTER_R, y: Math.sin(a) * CLUSTER_R };
});

/** Custom d3 force for perpetual "floating in water" motion that survives after
 *  the simulation's energy decays. The push direction per node rotates *slowly*
 *  (coherent low-frequency motion → smooth drift, not white-noise vibration),
 *  plus a very weak pull back toward the node's anchor so the graph stays bounded
 *  even when alpha (and thus the normal centering force) has gone to zero. */
function makeDrift(strength: number, anchorFn: (n: any) => { x: number; y: number }) {
  let nodes: any[] = [];
  const force = () => {
    const t = performance.now() / 1000; // seconds
    for (const n of nodes) {
      if (n.__phase === undefined) n.__phase = Math.random() * Math.PI * 2;
      const ang = t * 0.12 + n.__phase; // ~50s per full direction sweep
      n.vx += Math.cos(ang) * strength;
      n.vy += Math.sin(ang) * strength;
      if (n.vz !== undefined) n.vz += Math.cos(ang * 0.6 + 1.3) * strength;
      if (n.x != null) {
        const a = anchorFn(n);
        n.vx += (a.x - n.x) * 0.0006;
        n.vy += (a.y - n.y) * 0.0006;
      }
    }
  };
  force.initialize = (ns: any[]) => {
    nodes = ns;
  };
  return force;
}

interface Props {
  /** CSS height for the graph container (default fills its parent). */
  height?: string;
  /** When set, show an "Open full graph" link (used on the home-page hero). */
  fullHref?: string;
  /** When set, restrict the graph to this node's depth-1 neighbourhood (the
   *  per-article mini graph). Same component/behaviour as the home hero. */
  localTo?: string;
}

export default function GraphView({ height = '100%', fullHref, localTo }: Props) {
  const { ref, width, height: measuredH } = useMeasure<HTMLDivElement>();
  const theme = useTheme();
  const dimNode = dimNodeFor(theme);
  const ink = inkFor(theme);
  // Veil painted over hover-dimmed nodes — darkens them heavily so the highlighted
  // neighbourhood stands out by contrast alone (the dim IS the differentiator),
  // while still leaving the art faintly readable. Stronger than the hard flat-disc
  // dim's perceived weight because it sits over the full-detail portrait.
  const veil = theme === 'dark' ? 'rgba(6,5,10,0.72)' : 'rgba(26,22,14,0.68)';
  // The full /graph page shows a right slide-out sidebar with large art; the hero
  // and the per-article mini graph keep a small floating card by the node.
  const isFull = !fullHref && !localTo;

  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  // Episodes are the toggle layer (always togglable). Their *default* depends on
  // where the graph lives: ON for the full /graph page and per-article mini graphs
  // (the episode context is the point there), but OFF on the home hero and on
  // player-character mini graphs — every PC links to nearly every episode, so it's
  // just noise that buries the real connections.
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const hideEpisodes = (!!fullHref && !localTo) || (localTo?.startsWith('characters/') ?? false);
    return new Set(hideEpisodes ? ['episodes'] : []);
  });
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Per-tier toggle counter — bumping it remounts the legend dot so its one-shot
  // pulse animation replays each time the tier is shown/hidden.
  const [pulse, setPulse] = useState<Record<string, number>>({});
  // The pinned node whose summary card is open (null = nothing pinned). We keep
  // the live node object (not just its id) so the card can track its x/y as the
  // graph drifts.
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const selectedId = selected?.id ?? null;
  const [query, setQuery] = useState('');

  // Layout / motion controls.
  // Per-article connections graphs (localTo) start more spread out so their few
  // nodes — and the always-on titles below — are easy to read.
  const [spread, setSpread] = useState(localTo ? 200 : 120); // |charge| — bigger = more spread out
  const [linkDist, setLinkDist] = useState(46);
  const [cluster, setCluster] = useState(false);
  const [alive, setAlive] = useState(true);
  const [drift, setDrift] = useState(6); // drift magnitude ×100; very subtle by default
  const [showTune, setShowTune] = useState(false);
  const [showArt, setShowArt] = useState(true); // paint entity art inside the nodes
  // Titles for every node, not just the highlight. On by default for the small
  // per-article connections graphs (readable there); off on the big full graph.
  const [alwaysLabels, setAlwaysLabels] = useState(!!localTo);

  useEffect(() => {
    let ok = true;
    fetch('/graph.json')
      .then((r) => r.json())
      .then((d: GraphData) => ok && setData(d))
      .catch(() => ok && setError(true));
    return () => {
      ok = false;
    };
  }, []);

  const allNodes = useMemo(() => data?.nodes ?? [], [data]);
  const rawLinks = useMemo(
    () => (data?.links ?? []).map((l) => ({ s: linkEnd(l.source), t: linkEnd(l.target) })),
    [data],
  );
  const adj = useMemo(() => (data ? adjacency(data) : new Map<string, Set<string>>()), [data]);

  // Mini-graph: the centre node plus its direct neighbours (null = whole graph).
  const localKeep = useMemo<Set<string> | null>(() => {
    if (!localTo) return null;
    const keep = new Set<string>([localTo]);
    for (const n of adj.get(localTo) ?? []) keep.add(n);
    return keep;
  }, [localTo, adj]);

  const visible = useMemo<GraphData>(() => {
    const nodes = allNodes.filter((n) => {
      if (localKeep && !localKeep.has(n.id)) return false; // outside the neighbourhood
      if (n.id === localTo) return true; // always keep the centre, even if its tier is toggled off
      return !hidden.has(n.collection);
    });
    const ids = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = rawLinks
      .filter((l) => ids.has(l.s) && ids.has(l.t))
      .map((l) => ({ source: l.s, target: l.t }));
    return { nodes, links };
  }, [allNodes, rawLinks, hidden, localKeep, localTo]);

  // Selection wins over hover: once a node is pinned, hovering its branches (or
  // moving the mouse away) never moves the highlight — it stays put so you can
  // inspect the neighbourhood. Hover only drives the highlight when nothing is pinned.
  const activeId = selectedId ?? hoverId;
  const hoverOnly = !!hoverId && !selectedId; // highlight is hover-driven → gentle dim
  const highlightNodes = useMemo(() => {
    if (!activeId) return null;
    const set = new Set<string>([activeId]);
    for (const n of adj.get(activeId) ?? []) set.add(n);
    return set;
  }, [activeId, adj]);

  const isLit = (id: string) => !highlightNodes || highlightNodes.has(id);
  const linkLit = (l: GraphLink) =>
    !!activeId && (linkEnd(l.source) === activeId || linkEnd(l.target) === activeId);

  // ---- Force-graph instance wiring ------------------------------------------
  // Callback ref keeps a stable identity (no re-attach churn); a ref to the
  // latest applyForces captures current slider state without re-creating it.
  const fgInstance = useRef<any>(null);
  const applyForces = (fg: any) => {
    if (!fg) return;
    fg.d3Force('charge')?.strength(-spread);
    fg.d3Force('link')?.distance(linkDist);
    fg.d3Force('collide', forceCollide((n: GraphNode) => radius(n) + 3).strength(0.85));
    const s = cluster ? 0.16 : 0.045; // centering: gentle to origin, or firm to type anchors
    const anchor = (n: GraphNode) => (cluster ? TYPE_ANCHOR[n.collection] ?? ORIGIN : ORIGIN);
    fg.d3Force('x', forceX((n: GraphNode) => anchor(n).x).strength(s));
    fg.d3Force('y', forceY((n: GraphNode) => anchor(n).y).strength(s));
    fg.d3Force('drift', alive && drift > 0 ? makeDrift(drift / 100, anchor) : null);
    fg.d3ReheatSimulation?.();
  };
  const applyRef = useRef(applyForces);
  applyRef.current = applyForces;
  const setFg = useCallback((inst: any) => {
    fgInstance.current = inst;
    applyRef.current(inst);
  }, []);

  useEffect(() => {
    applyRef.current(fgInstance.current);
  }, [spread, linkDist, cluster, alive, drift, mode, data]);

  const fitView = useCallback((ms = 500) => {
    const fg = fgInstance.current;
    if (!fg) return;
    // A few episodes have no links; they drift into open space and would drag the
    // fit out to a near-zero zoom. Frame only the connected core — but fall back to
    // all nodes when nothing is connected (e.g. an isolated entity's mini graph).
    const nodes: GraphNode[] = fg.graphData?.()?.nodes ?? [];
    const connected = new Set(nodes.filter((n) => (n.deg || 0) > 0).map((n) => n.id));
    fg.zoomToFit?.(ms, 50, connected.size ? (n: GraphNode) => connected.has(n.id) : undefined);
  }, []);

  // Keep the graph framed by re-fitting on every engine tick (so the view always
  // looks like the Fit button, even as the layout overshoots large then slowly
  // contracts), and stop once it has settled. We DON'T try to auto-detect "settled"
  // from the zoom: at the overshoot turnaround the size momentarily plateaus, which
  // fools any "stopped changing" check into releasing at the largest, clipping
  // state. Instead, fit until a time cap that outlasts the contraction — or until
  // the user interacts (below), so we never fight their own pan/zoom.
  const fitDone = useRef(false);
  const fitStart = useRef(0);
  useEffect(() => {
    fitDone.current = false; // re-arm on (re)load and 2D⇄3D switch
    fitStart.current = 0;
  }, [data, mode]);
  const onEngineTick = useCallback(() => {
    if (fitDone.current) return;
    const t = performance.now();
    if (fitStart.current === 0) fitStart.current = t;
    fitView(0);
    if (t - fitStart.current > (mode === '3d' ? 5000 : 15000)) fitDone.current = true;
  }, [fitView, mode]);

  // The user taking control (pan / zoom / clicking a node) ends auto-fit at once.
  // A real pointer/wheel event distinguishes user input from our own programmatic
  // zoomToFit (which dispatches neither), so we won't cancel ourselves.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = () => {
      fitDone.current = true;
    };
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('pointerdown', stop);
    return () => {
      el.removeEventListener('wheel', stop);
      el.removeEventListener('pointerdown', stop);
    };
  }, [ref]);

  // Don't hijack a fast page-scroll. When the cursor flies over an inline graph
  // mid-scroll, the canvas would otherwise grab the wheel and zoom out. We track
  // the last time the *page* actually scrolled (window 'scroll' fires on real
  // document movement, never on the graph's own zoom) and, if a wheel lands on
  // the graph within that cooldown, we stop the event in the capture phase before
  // d3-zoom sees it — so the page keeps scrolling. Pause ~300ms and the graph
  // becomes a deliberate zoom target again.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const COOLDOWN = 300; // ms since last page scroll that counts as "still scrolling"
    let lastScroll = 0;
    const onScroll = () => {
      lastScroll = performance.now();
    };
    const guard = (e: WheelEvent) => {
      if (performance.now() - lastScroll < COOLDOWN) {
        // Mid page-scroll: keep it native, don't let the graph zoom.
        e.stopPropagation();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', guard, { capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', guard, { capture: true });
    };
  }, [ref]);

  const focusNode = useCallback((node: GraphNode) => {
    setSelected(node);
    fgInstance.current?.zoomToFit?.(700, 140, (n: GraphNode) => n.id === node.id);
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = visible.nodes.find((n) => n.label.toLowerCase().includes(q));
    if (hit) focusNode(hit);
  };

  // Click no longer navigates — it pins a small summary card anchored to the
  // node, keeping the surrounding graph visible. The card carries the link.
  const pin = useCallback((node: GraphNode) => {
    setSelected(node);
    track('graph_node', { node: node.label, kind: node.collection });
  }, []);

  // While a card is pinned, track the node across the canvas every frame: the
  // graph keeps drifting ("alive"), and zoom/pan move it too. We write the DOM
  // position directly (no per-frame setState) to stay cheap.
  const cardRef = useRef<HTMLDivElement>(null);
  // Keeps the last pinned node around so the sidebar can show its content while
  // it slides shut (after `selected` has already gone null).
  const lastSelectedRef = useRef<GraphNode | null>(null);
  useEffect(() => {
    // Only the hero's floating card tracks the node; the full-page sidebar is fixed.
    if (!selected || isFull) return;
    let raf = 0;
    const tick = () => {
      const fg = fgInstance.current;
      const el = cardRef.current;
      if (fg?.graph2ScreenCoords && el && selected.x != null && selected.y != null) {
        const c =
          mode === '3d'
            ? fg.graph2ScreenCoords(selected.x, selected.y, selected.z ?? 0)
            : fg.graph2ScreenCoords(selected.x, selected.y);
        if (c) {
          // Clamp horizontally inside the container and flip the card below the
          // node when there isn't room above — so it never clips off the top.
          const halfW = el.offsetWidth / 2;
          const x = width ? Math.min(Math.max(c.x, halfW + 8), width - halfW - 8) : c.x;
          el.style.left = `${x}px`;
          el.style.top = `${c.y}px`;
          // Flip below the node only when there's no room above AND there is room
          // below — otherwise keep it above. The container is short (e.g. the 320px
          // local graph) and clips overflow, so a card flipped below a low node
          // would lose its link; spilling over the top is the safer fallback.
          const cardH = el.offsetHeight;
          const ch = measuredH || el.parentElement?.clientHeight || 0;
          const fitsAbove = c.y - cardH - 14 >= 8;
          const fitsBelow = !ch || c.y + cardH + 14 <= ch - 8;
          el.classList.toggle('gph-card--below', !fitsAbove && fitsBelow);
          // In 3D a node can pass behind the camera (negative/huge coords); hide
          // the card rather than letting it fly off-screen.
          el.style.visibility = c.x < -9000 ? 'hidden' : 'visible';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected, mode, isFull, width, measuredH]);

  // Esc dismisses the card.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Debounced hover — without this, sweeping the mouse re-highlights on every
  // node it grazes, which flashes the whole canvas. Wait for the cursor to rest.
  const hoverTimer = useRef<number | undefined>(undefined);
  const onHover = useCallback((n: GraphNode | null) => {
    window.clearTimeout(hoverTimer.current);
    const id = n?.id ?? null;
    hoverTimer.current = window.setTimeout(() => setHoverId(id), id ? 120 : 200);
  }, []);

  const toggleType = (t: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
    setPulse((p) => ({ ...p, [t]: (p[t] ?? 0) + 1 }));
  };

  // ---- 2D canvas painters ----------------------------------------------------
  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const isCenter = node.id === localTo;
      const r = radius(node);
      const lit = isCenter || isLit(node.id); // the mini-graph's centre stays lit
      // Two dim severities: a hover highlight darkens the rest (keeps art legible —
      // `softDim`); a pinned selection hard-dims them to flat discs. The contrast is
      // carried purely by how much the rest dims, so the veil is deliberately heavy.
      const softDim = !lit && hoverOnly;
      const color = colorFor(node.collection);
      const art = node.thumb ?? node.image; // tiny thumb for the canvas; full art is for the card

      if (lit || softDim) {
        // Art-filled treatment: clip the portrait into the circle, type colour as a
        // ring. Soft-dimmed (hover) nodes get the same art under a darkening veil so
        // they recede but stay readable. Falls back to a flat disc with no art.
        let painted = false;
        if (showArt && art) {
          const img = nodeImage(art);
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, r, 0, TWO_PI);
            ctx.clip();
            // cover-fit, TOP-aligned vertically — portraits frame the head at the
            // top, so centring crops faces; anchoring the top edge keeps heads.
            const d = r * 2;
            const s = Math.max(d / img.naturalWidth, d / img.naturalHeight);
            const w = img.naturalWidth * s;
            const h = img.naturalHeight * s;
            ctx.drawImage(img, node.x! - w / 2, node.y! - r, w, h);
            if (softDim) {
              ctx.fillStyle = veil;
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, r, 0, TWO_PI);
              ctx.fill();
            }
            ctx.restore();
            // type-coloured ring, constant ~3px on screen, inset half its width so the
            // outer edge sits on the circle. Faded hard for soft-dimmed nodes.
            ctx.lineWidth = 3 / scale;
            ctx.globalAlpha = softDim ? 0.3 : 1;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, r - 1.5 / scale, 0, TWO_PI);
            ctx.stroke();
            ctx.globalAlpha = 1;
            painted = true;
          }
        }
        if (!painted) {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, r, 0, TWO_PI);
          ctx.fillStyle = color;
          ctx.fill();
          if (softDim) {
            ctx.fillStyle = veil; // darken the colour disc to match the hover de-emphasis
            ctx.fill();
          }
        }
      } else {
        // Hard dim: a selection is pinned and this node is outside its neighbourhood.
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r, 0, TWO_PI);
        ctx.fillStyle = dimNode;
        ctx.fill();
      }
      if (node.id === activeId || isCenter) {
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = '#a8842c';
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r + 2.5 / scale + 1, 0, TWO_PI);
        ctx.stroke();
      }
      // Labels follow the highlight: the hovered/selected node and its neighbours
      // (and a mini-graph centre) always get titles. "Always show titles" adds the
      // rest — gated by zoom on the big graph (avoids clutter), unconditional on the
      // small per-article graphs (few nodes, where it's on by default).
      const labelAll = alwaysLabels && (localTo ? true : scale > 1.7);
      const showLabel = lit && (isCenter || (highlightNodes?.has(node.id) ?? false) || labelAll);
      if (showLabel) {
        const fontSize = Math.min(5, 11 / scale);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = ink;
        ctx.fillText(node.label, node.x!, node.y! + r + 1.5 / scale);
      }
    },
    [activeId, hoverOnly, highlightNodes, dimNode, veil, ink, localTo, showArt, alwaysLabels],
  );

  const paintPointer = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, radius(node) + 2, 0, TWO_PI);
    ctx.fill();
  }, []);

  if (error) {
    return (
      <div className="gph-wrap" style={{ height }}>
        <p className="gph-msg">Couldn’t load the graph data.</p>
      </div>
    );
  }

  const shared = {
    ref: setFg,
    graphData: visible,
    nodeId: 'id',
    nodeLabel: (n: GraphNode) => n.label,
    nodeVal: (n: GraphNode) => (n.deg || 0) + 1,
    onNodeClick: pin,
    onNodeHover: onHover,
    onEngineTick,
    onBackgroundClick: () => setSelected(null),
    // More velocity damping while "alive" → slow, viscous drift rather than bounce.
    d3VelocityDecay: alive ? 0.55 : 0.4,
    cooldownTicks: alive ? Infinity : 160,
    cooldownTime: alive ? Infinity : 15000,
    width: width || undefined,
    height: measuredH || undefined,
  };

  // Sidebar content survives the close animation: fall back to the last pinned node.
  if (selected) lastSelectedRef.current = selected;
  const sideNode = selected ?? lastSelectedRef.current;

  return (
    <div className="gph-wrap" ref={ref} style={{ height }}>
      <style>{GRAPH_CSS}</style>
      {!data && <p className="gph-msg">Mapping the campaign…</p>}

      {/* Controls (top-left) */}
      <div className="gph-panel gph-tl">
        <div className="gph-seg" role="group" aria-label="Dimension">
          <button className={mode === '2d' ? 'on' : ''} onClick={() => { setMode('2d'); track('graph_mode', { mode: '2d' }); }}>2D</button>
          <button className={mode === '3d' ? 'on' : ''} onClick={() => { setMode('3d'); track('graph_mode', { mode: '3d' }); }}>3D</button>
        </div>
        <button className="gph-btn" onClick={() => fitView(600)}>Fit</button>
        <button className={`gph-btn ${showTune ? 'on' : ''}`} onClick={() => setShowTune((v) => !v)}>Tune</button>
        <button className={`gph-btn ${showArt ? 'on' : ''}`} onClick={() => setShowArt((v) => !v)} title="Show entity art inside nodes">Art</button>
        {fullHref && <a className="gph-btn gph-link" href={fullHref}>Open full graph ↗</a>}
      </div>

      {/* Tune panel */}
      {showTune && (
        <div className="gph-panel gph-tune">
          <label>
            <span>Spread <em>{spread}</em></span>
            <input type="range" min={30} max={400} step={10} value={spread}
              onChange={(e) => setSpread(+e.target.value)} />
          </label>
          <label>
            <span>Link length <em>{linkDist}</em></span>
            <input type="range" min={12} max={120} step={2} value={linkDist}
              onChange={(e) => setLinkDist(+e.target.value)} />
          </label>
          <label>
            <span>Drift speed <em>{drift}</em></span>
            <input type="range" min={0} max={20} step={1} value={drift}
              onChange={(e) => setDrift(+e.target.value)} disabled={!alive} />
          </label>
          <label className="row">
            <input type="checkbox" checked={cluster} onChange={(e) => setCluster(e.target.checked)} />
            <span>Cluster by type</span>
          </label>
          <label className="row">
            <input type="checkbox" checked={alive} onChange={(e) => setAlive(e.target.checked)} />
            <span>Alive (drift)</span>
          </label>
          <label className="row">
            <input type="checkbox" checked={alwaysLabels} onChange={(e) => setAlwaysLabels(e.target.checked)} />
            <span>Always show titles</span>
          </label>
        </div>
      )}

      {/* Search (top-right) */}
      <form className="gph-panel gph-tr" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Find a node…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find a node"
        />
      </form>

      {/* Legend / type filter (bottom-left) */}
      <div className="gph-panel gph-bl gph-legend">
        {LEGEND_ORDER.map((t) => (
          <button
            key={t}
            className={`gph-leg ${hidden.has(t) ? 'off' : ''}`}
            onClick={() => toggleType(t)}
            title={hidden.has(t) ? `Show ${TYPE_META[t].label}` : `Hide ${TYPE_META[t].label}`}
          >
            <span
              key={`${t}-${pulse[t] ?? 0}`}
              className={`dot ${pulse[t] ? 'pulse' : ''}`}
              style={{ background: TYPE_META[t].color }}
            />
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Hero: compact summary card pinned to the node, positioned each frame by
          the rAF loop above (flips below the node near the top edge). */}
      {!isFull && selected && (
        <div ref={cardRef} className="gph-card" onClick={(e) => e.stopPropagation()}>
          <button className="gph-card-x" onClick={() => setSelected(null)} aria-label="Close">×</button>
          <div className="gph-card-head">
            {selected.image && (
              <img className="gph-card-thumb" src={selected.image} alt="" loading="lazy" />
            )}
            <div className="gph-card-headtext">
              <div className="gph-card-kind">
                <span className="dot" style={{ background: colorFor(selected.collection) }} />
                {TYPE_META[selected.collection]?.label ?? selected.collection}
              </div>
              <div className="gph-card-title">{selected.label}</div>
            </div>
          </div>
          {selected.summary && <p className="gph-card-sum">{selected.summary}</p>}
          <a className="gph-card-link" href={selected.href}>Open page →</a>
        </div>
      )}

      {/* Full graph: right slide-out sidebar with large native-ratio art. Kept
          mounted so it can animate; content holds through the close transition. */}
      {isFull && (
        <aside
          className={`gph-side ${selected ? 'open' : ''}`}
          onClick={(e) => e.stopPropagation()}
          aria-hidden={!selected}
        >
          {sideNode && (
            <>
              <button className="gph-side-x" onClick={() => setSelected(null)} aria-label="Close">×</button>
              {sideNode.image && <img className="gph-side-img" src={sideNode.image} alt="" />}
              <div className="gph-side-body">
                <div className="gph-card-kind">
                  <span className="dot" style={{ background: colorFor(sideNode.collection) }} />
                  {TYPE_META[sideNode.collection]?.label ?? sideNode.collection}
                </div>
                <h2 className="gph-side-title">{sideNode.label}</h2>
                {sideNode.summary && <p className="gph-side-sum">{sideNode.summary}</p>}
                <a className="gph-side-link" href={sideNode.href}>Open page →</a>
              </div>
            </>
          )}
        </aside>
      )}

      {data && mode === '2d' && (
        <Suspense fallback={<p className="gph-msg">Loading graph…</p>}>
          <ForceGraph2D
            {...shared}
            backgroundColor={graphBgFor(theme)}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={paintPointer}
            autoPauseRedraw={false}
            linkColor={(l: GraphLink) =>
              !activeId
                ? 'rgba(120,112,95,0.16)'
                : linkLit(l)
                  ? 'rgba(168,132,44,0.65)'
                  : 'rgba(120,112,95,0.04)'
            }
            linkWidth={(l: GraphLink) => (linkLit(l) ? 1.6 : 0.6)}
            linkDirectionalParticles={(l: GraphLink) => (linkLit(l) ? 2 : 0)}
            linkDirectionalParticleWidth={1.8}
            linkDirectionalParticleColor={() => 'rgba(168,132,44,0.85)'}
          />
        </Suspense>
      )}

      {data && mode === '3d' && (
        <Suspense fallback={<p className="gph-msg">Loading 3D…</p>}>
          <ForceGraph3D
            {...shared}
            backgroundColor={graph3dBgFor(theme)}
            nodeOpacity={0.95}
            nodeColor={(n: GraphNode) => (isLit(n.id) ? colorFor(n.collection) : 'rgba(120,114,100,0.35)')}
            linkColor={(l: GraphLink) =>
              // Pale links read on the dark scene; in light mode they'd vanish, so
              // fall back to the 2D-style warm-grey/gold links on the parchment bg.
              theme === 'dark'
                ? !activeId
                  ? 'rgba(200,190,170,0.18)'
                  : linkLit(l)
                    ? '#c9b06a'
                    : 'rgba(200,190,170,0.04)'
                : !activeId
                  ? 'rgba(120,112,95,0.22)'
                  : linkLit(l)
                    ? '#a8842c'
                    : 'rgba(120,112,95,0.05)'
            }
            linkWidth={(l: GraphLink) => (linkLit(l) ? 0.8 : 0.3)}
            linkDirectionalParticles={(l: GraphLink) => (linkLit(l) ? 2 : 0)}
            linkDirectionalParticleWidth={1.4}
          />
        </Suspense>
      )}
    </div>
  );
}
