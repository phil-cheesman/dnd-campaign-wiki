import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { remarkStripTitle } from './src/plugins/remark-strip-title.ts';
import { remarkAutolink } from './src/plugins/remark-autolink.ts';
import { remarkSrd } from './src/plugins/remark-srd.ts';
import { remarkStripArcsTable } from './src/plugins/remark-strip-arcs-table.ts';
import { remarkSectionWrap } from './src/plugins/remark-section-wrap.ts';
import { getAliasIndex, aliasIndexToJSON } from './src/lib/alias-index.ts';
import { buildAliasRedirects } from './src/lib/links.ts';

/** Emit the shared alias-index artifact and report dropped/ambiguous/unmatched terms. */
function aliasArtifact() {
  return {
    name: 'alias-artifact',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const idx = getAliasIndex();
        const json = aliasIndexToJSON(idx);
        const out = new URL('alias-index.json', dir);
        await writeFile(fileURLToPath(out), JSON.stringify(json, null, 2));
        logger.info(
          `alias index: ${json.terms.length} terms, ` +
            `${idx.ambiguous.size} ambiguous (left plain), ` +
            `${idx.unmatchedGlossary.length} glossary entries without a dossier`,
        );
        if (idx.ambiguous.size > 0) {
          logger.warn('ambiguous terms (not autolinked):');
          for (const [key, slugs] of idx.ambiguous) logger.warn(`  "${key}" → ${slugs.join(', ')}`);
        }
      },
    },
  };
}

export default defineConfig({
  site: 'https://alambor.vercel.app',
  // The dev toolbar renders clipped at fractional display scaling (e.g. 125%) and
  // obstructs the bottom of the page; we don't use it, so turn it off.
  devToolbar: { enabled: false },
  markdown: {
    remarkPlugins: [remarkStripTitle, remarkAutolink, remarkSrd, remarkStripArcsTable, remarkSectionWrap],
  },
  // Kingdoms are folded into the Locations gazetteer (clickable kingdom headings →
  // the kingdom article), so the bare Kingdoms index points at Locations. Kingdom
  // dossier pages (`/kingdoms/<slug>`) are unaffected.
  redirects: { ...buildAliasRedirects(), '/kingdoms': '/locations' },
  integrations: [react(), aliasArtifact()],
  // Pin the dev server so every agent shares one URL. strictPort makes a second
  // `astro dev` fail loudly instead of silently grabbing 4322/4323/... — that
  // surfaces "an agent started its own server" instead of hiding it.
  server: { port: 4321, host: true, strictPort: true },
  vite: {
    optimizeDeps: {
      include: [
        // Leaflet is a CJS/UMD package the dep-optimizer otherwise fails to pre-bundle
        // (dev server 504s on /.vite/deps/leaflet.js → the /map client script throws).
        'leaflet',
        // The 3D graph chain (react-force-graph-3d → three-forcegraph) does
        // `import forcelayout from 'ngraph.forcelayout'` / `import graph from
        // 'ngraph.graph'` — default imports of CJS packages. Because the 3D bundle is
        // a lazy dynamic import, Vite's startup scan misses these and serves them
        // un-pre-bundled; a raw CJS module exposes no `default` export, so the import
        // throws ("does not provide an export named 'default'"), the lazy chunk
        // rejects, and the whole graph React island crashes to a blank page. Pre-
        // bundling them lets esbuild synthesize the default export so 3D mode loads.
        'react-force-graph-3d',
        'ngraph.forcelayout',
        'ngraph.graph',
      ],
    },
  },
});
