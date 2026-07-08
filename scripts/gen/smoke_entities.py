"""Hand-extracted visual_attributes for the smoke-test entities.

These three are picked because each has a curated ref in refs/<slug>/ AND a rich
dossier, and they span the gallery (two PCs + one NPC). The `visual` text below is
the manual version of the Phase-2 "brief pass": reference art read for appearance,
reconciled against canon prose (canon wins on specifics — e.g. Mally's ref avatar
is a generic dark-haired pirate, but canon says short, poofy hat, blue eyes, scar).

Once the style is locked and output approved, this same `visual` text moves into
each dossier's frontmatter art.visual and is produced at scale by scripts/gen/brief.py.
"""

SMOKE = {
    "quinton": {
        "collection": "characters",
        "name": "Quinton Shackleford",
        "role": "Half-Elf Bard, the party's charming frontman",
        "type": "portrait",
        "visual": (
            "A half-elf man in his twenties with swept-back blond hair, pointed elven "
            "ears, fair skin, and a neat blond goatee and mustache. Mid-performance, "
            "expressive and charismatic. Wears a fitted blue performer's doublet with a "
            "golden-yellow cravat at the throat, brown leather trim, and a crimson-lined "
            "cape over one shoulder. A rapier at his hip; carries a lute."
        ),
    },
    "berrian": {
        "collection": "characters",
        "name": "Berrian",
        "role": "Half-Elf Paladin, lawful good",
        "type": "portrait",
        "visual": (
            "A half-elf man with long blond hair, pointed ears, sun-tanned olive skin, and "
            "a sharp, angular, weathered face with a stern, resolute expression. Lean and "
            "battle-hardened. Wears earth-toned leather-and-green armor at the collar, the "
            "look of a holy warrior on the road."
        ),
    },
    "cruucar": {
        "collection": "characters",
        "name": "Cruucar",
        "role": "Dragonborn Barbarian, front-line bruiser, ex-Widowmaker mercenary",
        "type": "portrait",
        # No ref image — pure dossier lane. Scale color inferred from his lightning
        # breath weapon (marked a guess; canon doesn't state it).
        "visual": (
            "A towering, powerfully-built dragonborn with reptilian draconic features — a "
            "scaled snout, horned brow-ridge, and a heavily muscled frame. Bronze-and-storm-"
            "blue scales (a lightning-breath lineage). A battle-scarred mercenary: fierce, "
            "intense, glowering. Wears heavy worn leather-and-iron armor; a brutal front-line "
            "warrior who carries a glaive and axes."
        ),
    },
    "ford": {
        "collection": "npcs",
        "name": "Ford (Fjord)",
        "role": "Human gunslinger from Aberdeen, ally of the party",
        "type": "portrait",
        "visual": (
            "A rakish human gunslinger with light sun-tanned skin, a sharp mustache, and a "
            "confident swagger. Wears a wide-brimmed hat with a feather tucked in the band, a "
            "deep-purple cape and coat over a golden-yellow waistcoat and white shirt, with a "
            "gun-belt of flintlock pistols. A frontier swashbuckler."
        ),
    },
    "mally-grisham": {
        "collection": "npcs",
        "name": 'Mally "Molly" Grisham, the Sparrow',
        "role": "Pirate Captain of the Fortune's Favor",
        "type": "portrait",
        "visual": (
            "A short, fast, roguish pirate captain with high cheekbones, piercing blue "
            "eyes, a scar, dark wavy hair, and light stubble. Wears a big poofy pirate hat "
            "and an ornate dark coat with gold brocade over a white ruffled shirt and a red "
            "sash. A sparrow motif. Behind him, ship rigging and a skull-and-crossbones flag "
            "against open sea."
        ),
    },
}
