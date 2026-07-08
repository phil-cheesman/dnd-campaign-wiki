# Map (Phase 3) — open issues & next-session brief

> **⚠️ SUPERSEDED — the single source of truth is now `docs/map-feature.md`.** This file
> is kept only as a historical scratch log. Read `docs/map-feature.md` first.

> **UPDATE 2026-06-15 — all four open issues below are RESOLVED and the 3b timeline
> scrubber is built.** What shipped:
> - **#2 coords** — recalibrated `canon/map/places.yaml` against a normalised grid;
>   labeled cities are confident, ~11 unlabeled towns/sea-stops/portals are `# approx`
>   (still worth a `?calibrate` polish — those are the rough ones).
> - **#4 contrast** — route/markers/playhead recolored gold → texair-purple `#6a33b0`.
> - **#3 parchment** — procedural `site/public/textures/parchment.png` (committed) under
>   the desk gradients + `fitBounds` padding 70→120.
> - **#1 perf** — `image` now a 2048px `world-display.jpg` (644KB vs 6.5MB) + Leaflet
>   zoom tuning; full-res `world.jpg` kept as deep-zoom reserve.
> - **3b** — `.timeline` band (arc bands + per-stop ticks + draggable playhead) ported
>   from `design/wireframes/09-map-timeline.html`, driving shared stop/episode state.
>
> Remaining: image hosting for deploy (both map jpgs gitignored), 3c city drill-down,
> 3d episode `primary_location` backfill. Original issue notes preserved below.

---

Status as of 2026-06-15. The `/map` route (Phase 3a) is built and working: Leaflet
`CRS.Simple` over Jon's full-res world map (4096×3072), deduped location markers,
route legs, party marker, story card with real links, prev/next/play. Data is
canon-owned (`canon/journey.yaml` + `canon/map/places.yaml`, joined by
`site/src/lib/journey.ts`). What follows is everything still to do before/while
building the timeline scrubber (3b).

---

## Open issues

### #1 — Zoom is sluggish (perf) · severity: medium
Lines now stay synced with the map on zoom (the `transition: all` geometry bug is
fixed), but **zoom/scroll itself is laggy** — there's a delay on each wheel step.
Likely cause: Leaflet is re-scaling one large 6.5 MB `imageOverlay` on every zoom
step, plus `zoomSnap: 0.25` multiplies the number of steps.
Candidate fixes (next session):
- Tile the world map (`gdal2tiles` / `leaflet` tile layer) so only visible tiles
  render — best long-term fix, scales to the 18 MB city maps too.
- Or serve a downscaled display image (~2048px) and reserve the 4096 only for deep zoom.
- Or coarsen `zoomSnap`/`wheelPxPerZoomLevel`, enable `zoomAnimation` tuning, set
  `updateWhenZooming: false` / `preferCanvas`.
- Decide once and apply to both the world map and (future) city maps.

### #2 — Marker coordinates are way off · severity: high
The city/stop pins don't sit on their real locations — they're rough eyeball seeds
in `canon/map/places.yaml`. Now that the sharper 4096 map is in, **pin them properly**
via `/map?calibrate` (click a place → it copies normalised `x,y` to paste back).
~17 places to fix. Aspect is unchanged from the old crop, so the file structure is fine;
just the values need correcting.

### #3 — Parchment "table" surround isn't visibly rendering · severity: medium
The cartographer's-desk treatment (CSS gradients on `.leaflet-container` +
map-sheet shadow + `fitBounds` padding) doesn't show outside the map for Phil.
To investigate: confirm it survived a hard refresh; check whether the fitted image
fills the container (so no surround is visible); the CSS-gradient parchment may also
be too subtle. Likely needs a real paper/desk texture (small tiling asset or
generated) rather than pure CSS, and/or more `fitBounds` padding so the sheet is
clearly inset on the desk.

### #4 — Low contrast: gold route on a yellow/green map · severity: high
Gold lines/markers wash out against the map's green-and-tan landmass. Pick a direction:
- **(a) Restyle the map** — sepia/monochrome tone, or a Tolkien "black pen on aged
  paper" treatment — so colored journey elements pop. (Could be a CSS filter on the
  overlay as a quick test, or an AI-restyled map as the real artifact.)
- **(b) Restyle the lines/markers** — switch the route + pins to a high-contrast
  **dark red** or **dark purple** (purple = the site's texair `--link`, on-brand).
- Cheapest first step: try option (b) (one CSS change) and/or a sepia `filter` on
  `.leaflet-image-layer` to compare, then decide.

---

## Carried-over decisions (not yet settled)
- **Image hosting for deploy.** DM maps are gitignored (copyright + binaries-out on a
  public repo); `site/public/maps/world.jpg` is local-only, so the deployed Vercel
  site won't have it. Decide: external CDN/blob vs. an AI-restyled map as the published
  artifact. (Ties into #4 if we go the AI-restyle route.)
- **City drill-down (3c)** assets are ready: full-res city maps live in
  `sources/dm-docs/maps/` (Kirkenwall 18 MB, Goldcrest, Grillers, Tarlif, Carasia,
  Shadowfell, Surtree, Dalacia…). Wire `places.yaml` `city_map` → a child MapDoc.
- **3d episode precision.** No episode has `primary_location` yet (`locations:` is a
  grab-bag); backfill it for finer playhead positioning between stops.

---

## Next-session kickoff prompt

> Continue Phase 3 of the Alambor map (`/map`). Read `design/map-phase3-open-issues.md`
> for context. Before the timeline scrubber (3b), clear the open issues in priority
> order: (1) fix marker coordinates via `?calibrate` — they're all off; (2) fix
> contrast — gold journey lines vanish on the green/tan map, so either restyle the map
> sepia/Tolkien-mono or switch the lines+markers to dark red / texair-purple (try the
> line recolor first, it's one change); (3) make the parchment "table" surround
> actually render (probably needs a real paper texture + more fitBounds inset);
> (4) fix zoom sluggishness (the 6.5 MB single imageOverlay re-scales every step —
> consider tiling or a downscaled display image). Then start 3b: the timeline scrubber
> band (port from `design/wireframes/09-map-timeline.html`) driving the playhead +
> marker state, reading the same `canon/journey.yaml` data. The map serves locally on
> Phil's dev server; the map image is gitignored (local-only).
