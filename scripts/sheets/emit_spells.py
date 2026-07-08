"""
Emit `sheet.spells` + `sheet.feats` into canon/characters/*.md for the Phase-C
party spellbook & feats badge wall (docs/specs/party-dashboard.md §3).

Same pattern as emit_yaml.py (skills/saves): DDB JSON for the three public
characters (Cruucar/Noctis/Vane), hand-mapped lists for the three private ones
(Berrian/Torgoth/Quinton, whose sheets are private — captured from pastes/PDF).

  spells: [{name, level}]  (cantrip = level 0; names canonical, "(Legacy)" stripped)
  feats:  [string]

Idempotent: skips any character whose frontmatter already has a `spells:` key.
Run from the repo root:  python scripts/sheets/emit_spells.py
"""
import json, re

FILES = {
    'cruucar': 'sources/character-sheets/cruucar/ddb-78231335.json',
    'noctis':  'sources/character-sheets/noctis/ddb-63485208.json',
    'vane':    'sources/character-sheets/vane/ddb-93088472.json',
}

def clean(name):
    """Canonicalise a spell/feat name: strip '(Legacy)' and trailing whitespace."""
    return re.sub(r'\s*\(Legacy\)\s*', ' ', name).strip()

def from_ddb(slug):
    """Spells + feats out of a D&D Beyond character JSON."""
    d = json.load(open(FILES[slug]))['data']
    spells = {}  # name -> level (de-dupe by name)
    for grp in (d.get('classSpells') or []):
        for s in (grp.get('spells') or []):
            de = s['definition']; spells[clean(de['name'])] = de.get('level', 0)
    for lst in (d.get('spells') or {}).values():
        for s in (lst or []):
            de = s['definition']; spells[clean(de['name'])] = de.get('level', 0)
    feats = []
    for f in (d.get('feats') or []):
        n = clean(f['definition']['name'])
        if n not in feats:
            feats.append(n)
    return [{'name': n, 'level': l} for n, l in spells.items()], feats

def lvl(level, *names):
    return [{'name': clean(n), 'level': level} for n in names]

# --- Private sheets (D&D Beyond set to private → no public JSON). Hand-mapped
#     from sources/character-sheets/{slug}/ pastes, exactly as Phase B did. ---
HAND = {}

# Berrian — Paladin 15 (sources/.../berrian/ddb-paste-2026-06-16.md). No feats in paste.
HAND['berrian'] = (
    lvl(1, 'Ensnaring Strike', 'Healing Word', 'Shield of Faith', 'Thunderous Smite')
    + lvl(2, 'Branding Smite', 'Misty Step')
    + lvl(3, 'Blinding Smite', 'Plant Growth')
    + lvl(4, 'Find Greater Steed'),
    [],
)

# Torgoth — Fighter 6 / Cleric 9 (.../torgoth/ddb-paste-2026-06-16.md). War Caster feat.
HAND['torgoth'] = (
    lvl(1, 'Healing Word', 'Detect Magic')
    + lvl(2, 'Lesser Restoration')
    + lvl(4, 'Divination')
    + lvl(5, 'Geas', 'Hallow'),
    ['War Caster'],
)

# Quinton — Bard 15 / Glamour (.../quinton/quinton.md). Source annotations
# (Doss Lute / Magical Secrets / Mantle) collapsed into one "can cast" list.
HAND['quinton'] = (
    lvl(0, 'Vicious Mockery', 'Thunderclap', 'Minor Illusion', 'Prestidigitation')
    + lvl(1, 'Healing Word', 'Thunderwave', 'Dissonant Whispers', 'Cure Wounds',
          'Command', 'Animal Friendship', 'Protection from Evil and Good')
    + lvl(2, 'Hold Person', 'Blindness/Deafness', 'Suggestion', 'Find Steed',
          'Invisibility', 'Levitate', 'Protection from Poison')
    + lvl(3, 'Fly', 'Protection from Energy')
    + lvl(4, 'Polymorph', 'Dimension Door')
    + lvl(5, 'Hold Monster', 'Greater Restoration', 'Wall of Force')
    + lvl(6, 'Eyebite', 'Heal', 'Disintegrate')
    + lvl(7, 'Teleport', 'Etherealness'),
    ['Inspiring Leader', 'Actor', 'Healer', 'Lucky'],
)

def collect():
    out = {}
    for slug in FILES:
        out[slug] = from_ddb(slug)
    out.update(HAND)
    return out

def yaml_block(spells, feats):
    spells = sorted(spells, key=lambda s: (s['level'], s['name'].lower()))
    lines = ['  spells:'] if spells else ['  spells: []']
    for s in spells:
        lines.append(f'    - {{ name: "{s["name"]}", level: {s["level"]} }}')
    feat_str = ', '.join(f'"{f}"' for f in feats)
    lines.append(f'  feats: [{feat_str}]')
    return lines

if __name__ == '__main__':
    data = collect()
    for slug, (spells, feats) in data.items():
        path = f'canon/characters/{slug}.md'
        lines = open(path).read().split('\n')
        if any(l.strip().startswith('spells:') for l in lines[:60]):
            print(f'skip {slug} (already has spells)'); continue
        out, done = [], False
        for l in lines:
            out.append(l)
            if not done and l.strip().startswith('saves_prof:'):
                out.extend(yaml_block(spells, feats)); done = True
        assert done, f'no saves_prof line in {slug}'
        open(path, 'w').write('\n'.join(out))
        print(f'inserted into {slug}: {len(spells)} spells, {len(feats)} feats')
