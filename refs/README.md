# Reference images (`refs/`)

Curated, entity-anchored reference art used as **input** to the Phase-2 AI image pipeline.

Convention: `refs/<canon-slug>/<name>.png` — e.g. `refs/quinton/avatar.png`,
`refs/quinton/heroforge.png`. The slug must match a `canon/` entity filename; the asset
inventory (`scripts/build_asset_inventory.py`) maps refs to entities by this folder name.

## How refs are used

These images are **not** uploaded to the image model (that clones pose/composition).
Instead a vision pass extracts a `visual_attributes` text block (hair/skin/clothing colors,
key features, palette) which is merged with the dossier prose + the shared STYLE BLOCK into a
pure text-to-image prompt. See memory `wiki-image-gen-workflow`.

## Why the image files are gitignored

The repo is public and some references are third-party/copyrighted art (e.g. MTG card art,
commissioned avatars). Per the repo's "binaries out, derived text in" rule, the raw inputs stay
local; only the *generated* wiki art gets committed. Force-add an individual file you own if needed:
`git add -f refs/<slug>/<file>`.

## Currently sourced (local)

quinton (avatar + heroforge), berrian, mally-grisham, evac, ford, leon-steadyfoot, zanim,
captain-mckinnon (⚠️ no canon entity yet — needs a dossier).
