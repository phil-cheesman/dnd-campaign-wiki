"""Style blocks + per-type framing for the Phase-2 AI image pipeline.

The STYLE BLOCK is the API preamble constant — the wording that makes the whole
gallery cohere. We're iterating candidates A/B/C before locking one. Per-type framing
(aspect/composition) is fixed and shared by all.

Iteration log
-------------
smoke-1: first A (semi-painterly) + B (inked-codex). Findings: A drifted photoreal &
         oversaturated; B was gorgeous engraving but baked TEXT/labels/borders all over.
smoke-2: A → painted-illustration + muted/desaturated (less photoreal). B → hard no-text
         negatives so it's a clean inked bust. C → new dark/grungy dark-fantasy candidate.
         Global NO_TEXT clause now appended to every style (see assemble()).
"""

STYLE_VERSION = "B-v1"  # bump when the locked style wording changes
LOCKED = "B"            # ✅ Phil locked Style B (inked codex) 2026-06-15 — most on-brand
                        #    for the "Alambor Codex"; clean busts after the no-text fix.

# --- Candidate A: semi-painterly, muted (Phil's favored direction) -----------
STYLE_A = (
    "Semi-painterly digital fantasy illustration with visible hand-painted brushwork — "
    "a painting, NOT a photograph and NOT photoreal. Muted, slightly desaturated earthy "
    "palette, restrained color, soft natural lighting. Cohesive tabletop-RPG sourcebook "
    "art. No anime, no cartoon. Plain, uncluttered background."
)

# --- Candidate B: inked codex / engraving (NO text this time) -----------------
STYLE_B = (
    "Antique pen-and-ink engraving illustration: fine cross-hatched linework, a limited "
    "sepia-and-gold wash over aged-parchment tone, high contrast, hand-drawn manuscript "
    "feel. An ILLUSTRATION ONLY — just the inked figure on plain parchment, with no "
    "decorative elements around it. Not photoreal, no anime, no cartoon."
)

# --- Candidate C: dark & grungy dark-fantasy (new) ---------------------------
STYLE_C = (
    "Dark, moody dark-fantasy illustration with low-key chiaroscuro lighting and a single "
    "dramatic rim light. Desaturated grimdark palette — cold greys, deep shadow, muted "
    "earth tones. Gritty painterly texture, somber weathered atmosphere, cinematic. "
    "Not photoreal, no anime, no cartoon. Murky, simple background."
)

STYLES = {"A": STYLE_A, "B": STYLE_B, "C": STYLE_C}

# Appended to EVERY assembled prompt. gpt-image-2 has no separate negative-prompt param,
# so we state negatives inline. Kills the text/borders B produced in smoke-1.
NO_TEXT = (
    "Absolutely no text, words, letters, numbers, labels, captions, titles, signatures, "
    "watermarks, logos, borders, or frames anywhere in the image."
)

# --- Per-type framing (fixed, shared by every style) -------------------------
FRAMING = {
    "portrait": (  # bust 3:4
        "Head-and-shoulders character portrait, bust framing, subject centered and "
        "facing the viewer, eye-level, shallow depth of field."
    ),
    "landscape": (  # 16:9
        "Sweeping establishing landscape, wide cinematic vista, no people in frame, "
        "strong sense of scale and place."
    ),
    "crest": (  # 1:1
        "Centered heraldic emblem / crest on a plain field, symmetrical, iconographic, "
        "flat insignia design, no background scenery."
    ),
    "object": (  # 1:1
        "Single object studio render, centered on a plain neutral background, "
        "three-quarter view, museum-catalog presentation, no hands, no people."
    ),
    "scene": (  # 3:2 narrative illustration — episode reference / header art
        "Narrative scene illustration depicting a single dramatic moment from the "
        "story. Dynamic cinematic composition with a clear focal point, figures and "
        "environment shown in action, strong staging, depth, and atmosphere. "
        "Wide storybook plate framing."
    ),
}

SIZE = {
    "portrait": "1024x1536",   # ~3:4
    "landscape": "1536x1024",  # ~16:9 (closest gpt-image-2 offers)
    "crest": "1024x1024",      # 1:1
    "object": "1024x1024",     # 1:1
    "scene": "1536x1024",      # ~3:2 (closest gpt-image-2 offers) — episode plate
}
