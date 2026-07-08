# Alambor Wiki (site)

Astro static site that renders the repo-root `canon/` knowledge base into a public,
cross-linked, full-text-searchable wiki. The site is a **build artifact** — `canon/`
(downstream of the Google Doc pipeline) is the source of truth. Never hand-edit links
into canon prose; cross-linking is generated at build time.

## Develop

```sh
cd site
npm install
npm run dev      # http://localhost:4321  (search is disabled in dev — it needs the build step)
```

## Build

```sh
npm run build    # astro build → dist/, then pagefind indexes dist/
npm run preview  # serve dist/ locally (search works here)
```

The build also emits `dist/alias-index.json` (the shared term→entity index reused by
Pagefind and, later, the chatbot) and logs ambiguous/blocklisted/unmatched alias terms.

## How it works

- **Content collections** (`src/content.config.ts`): one `glob()` collection per `canon/`
  subdir, reading `../canon`. Option C schemas (shared `baseEntity` + per-tier extends).
  `_`-prefixed files are skipped by the glob; `dm_only: true` entities are filtered by
  `getPublic()` (`src/lib/collections.ts`). slug = filename.
- **Alias auto-linker** (`src/lib/*`, `src/plugins/remark-autolink.ts`): a build-time index
  merges every entity's `name` + `aliases[]` + `glossary.md` aliases → `{term → {slug,collection}}`.
  Normalization strips parenthetical annotations, drops cross-ref junk, and blocklists
  dangerous short/common terms. Prose is linked longest-match-first, first occurrence per
  page; ambiguous terms are left plain and logged. `[[slug]]` / `[[slug|text]]` is an
  explicit escape hatch.
- **Backlinks** (`src/lib/backlinks.ts`): "Mentioned in" is derived by scanning every page's
  prose + episode frontmatter for index terms.
- **5e SRD autolinks** (`src/data/srd-terms.json`, `src/plugins/remark-srd.ts`): a curated
  term→5e.tools list. Grow it by adding `{term,url}` pairs — no code change.
- **Search**: Pagefind, run as a postbuild step over `dist/`.

## Deploy (Vercel, static, free)

One-time setup in the Vercel dashboard (the repo must be connected):

1. New Project → import this GitHub repo.
2. **Set Root Directory to `site`** (this is the only non-default setting).
3. Framework preset auto-detects **Astro**; Build Command `npm run build`, Output `dist`.
4. Deploy → public `*.vercel.app` URL.

No adapter or serverless function is needed (pure static). A custom domain is optional (Phase 1+).
