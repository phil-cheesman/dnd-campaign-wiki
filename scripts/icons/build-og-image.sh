#!/usr/bin/env bash
# Builds the social/iMessage share card (Open Graph image) for the site.
#
#   bash scripts/icons/build-og-image.sh
#
# Needs ImageMagick (`magick`) + the brand fonts. Fonts are fetched on demand
# into /tmp if absent. Output: site/public/og-image.png (1200x630, the size
# iMessage / Twitter / Facebook expect for a large link preview).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PUB="$ROOT/site/public"
OUT="$PUB/og-image.png"

CORM=/tmp/Cormorant.ttf
INTER=/tmp/Inter.ttf
[ -f "$CORM" ]  || curl -sL -o "$CORM"  "https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf"
[ -f "$INTER" ] || curl -sL -o "$INTER" "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"

BG="#14161d"        # codex-slate desk (matches dark theme + theme_color)
GOLD="#d8c486"      # cream-gold for the wordmark
MUTED="#8e93a6"     # muted slate for the tagline

TREE=/tmp/og-tree.png
GLOW=/tmp/og-glow.png

# White tree + purple leaves, transparent.
magick -background none "$PUB/logo.svg" -resize 380x380 "$TREE"
# Soft purple glow to seat the tree on the dark field.
magick -size 560x560 radial-gradient:'#3a1d5c'-none "$GLOW"

magick -size 1200x630 xc:"$BG" \
  \( "$GLOW" \) -gravity west -geometry +20+0 -composite \
  \( "$TREE" \) -gravity west -geometry +90+0 -composite \
  -font "$CORM"  -fill "$GOLD"  -weight 600 -pointsize 96 \
    -gravity West -annotate +500-34 'Alambor Codex' \
  -font "$INTER" -fill "$MUTED" -pointsize 32 \
    -gravity West -annotate +506+54 'Chronicle of the Alambor Six' \
  "$OUT"

echo "wrote $OUT ($(identify -format '%wx%h' "$OUT"))"
