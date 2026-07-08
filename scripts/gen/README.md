# Image-gen harness (`scripts/gen/`)

Phase-2 AI art. This dir currently holds the **smoke-test rig** — the smallest thing
that proves the API path and lets us judge style/quality on a few entities before
building the full pipeline and scaling to ~250 entities.

## Files

| file | role |
|---|---|
| `generate.py` | the harness: assemble prompt → call API → save PNG. CLI. |
| `style.py` | STYLE BLOCK candidates (A vs B) + per-type framing/size. **Replace A/B with Phil's locked wording.** |
| `smoke_entities.py` | hand-extracted `visual` attributes for the 3 smoke entities. |
| `requirements.txt` | `openai` SDK. |

Planned (after style locks): `brief.py` (vision/brief pass at scale), `prompt.py`
(assembly), wiring outputs into `art.image` frontmatter + Astro.

## Setup

```sh
python3 -m venv scripts/gen/.venv
scripts/gen/.venv/bin/pip install -r scripts/gen/requirements.txt
```

**API key:** put it in `REPO/.env` (gitignored). `generate.py` loads it automatically
and accepts either `OPENAI_API_KEY` or `OPEN_AI_API_KEY`.

```
OPENAI_API_KEY=sk-...
```

Get a key at <https://platform.openai.com> → API keys.
⚠️ **gpt-image-2 requires a verified organization** — Settings → Organization → Verify.
If you see a 403/"must be verified" error, that's the cause.

## Run

```sh
VENV=scripts/gen/.venv/bin/python

# the A-vs-B smoke set: 3 entities × 2 styles = 6 portraits
$VENV scripts/gen/generate.py --smoke-set

# one entity / one style
$VENV scripts/gen/generate.py --slug quinton --style A
$VENV scripts/gen/generate.py --slug mally-grisham --style B --quality high

# paste a ChatGPT-validated prompt verbatim (bypasses assembly)
$VENV scripts/gen/generate.py --prompt @prompt.txt --slug quinton --type portrait
```

Outputs land in `art-smoke/<slug>-<style>.png` (gitignored — experiments). Approved
final art will live at `site/public/art/<collection>/<slug>.png`.

`--quality` is `low|medium|high|auto` (default `medium`). Rough gpt-image-2 cost for a
1024×1536 portrait: low ~$0.02, medium ~$0.07, high ~$0.19. The smoke set at medium is
well under $1.
