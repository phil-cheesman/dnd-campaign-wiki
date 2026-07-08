// Builds the favicon + home-screen app icons from the site logo.
//
//   node scripts/icons/build-app-icons.mjs   (run from anywhere; uses absolute paths)
//
// Source of truth: site/public/logo.svg (white-bark body + purple-fruit flecks).
// Outputs into site/public/:
//   favicon.svg              — adaptive tab icon (purple body in light chrome, white in dark)
//   apple-touch-icon.png     — iOS "Add to Home Screen" (180, logo on solid square)
//   icon-192.png / icon-512.png        — Android/PWA standard icons
//   icon-maskable-512.png    — Android adaptive-icon (extra padding for the safe zone)
// Re-run after any change to logo.svg.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// sharp is installed in the Astro site, not at repo root.
const sharp = createRequire(join(ROOT, 'site', 'package.json'))('sharp');
const PUB = join(ROOT, 'site', 'public');
const svg = readFileSync(join(PUB, 'logo.svg'));

// Branded backdrop for the home-screen tiles — the dark "codex desk" so the
// white logo body pops and the purple flecks stay legible.
const BG = '#14161d';
const LIGHT_BODY = '#5a2da0'; // body colour when the OS/browser is in light mode

// --- 1. Adaptive favicon.svg --------------------------------------------------
// Only the single big white path is the "body"; the 170 purple flecks read on
// both light and dark chrome, so leave them. Flip the body via a media query.
const style =
  `<style>.body-fill{fill:${LIGHT_BODY}}` +
  `@media (prefers-color-scheme:dark){.body-fill{fill:#fff}}</style>`;
let fav = svg.toString();
fav = fav.replace(/(<svg[^>]*>)/, `$1${style}`);
fav = fav.replace('fill="#ffffff"', 'class="body-fill"');
writeFileSync(join(PUB, 'favicon.svg'), fav);

// --- 2. Raster home-screen icons ---------------------------------------------
async function tile({ size, pad, out, bg = BG }) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const off = Math.round((size - inner) / 2);
  const png = await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, left: off, top: off }])
    .png()
    .toBuffer();
  writeFileSync(join(PUB, out), png);
  console.log('wrote', out, `${size}x${size}`);
}

await tile({ size: 180, pad: 0.14, out: 'apple-touch-icon.png' });
await tile({ size: 192, pad: 0.12, out: 'icon-192.png' });
await tile({ size: 512, pad: 0.12, out: 'icon-512.png' });
await tile({ size: 512, pad: 0.2, out: 'icon-maskable-512.png' });
console.log('wrote favicon.svg');
