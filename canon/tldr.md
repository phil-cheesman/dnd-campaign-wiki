---
current_episode: 166
updated: 2026-08-06
arc: 09-relic-hunt

cliffhanger: >
  You are thirty yards above a street in Ilharess, drifting down, and forty
  armoured drow are marching up to meet you.
cliffhanger_art: /art/episodes/e166.webp

where:
  place: Ilharess
  region: The Astral Sea
  level: 15
  in_world: Year 500 of this age

story_now: >
  You escaped a losing sea battle by tearing a one-way hole in reality, and it
  dropped all six of you into the Astral Sea — a purple void between worlds with
  no up, no down, and no way home. A ship of green-skinned Githyanki fished you
  out, fed you, explained the universe, and left. Now you are floating down into
  a city of a quarter-million dark elves: the Ziven Dynasty, the ancient enemy
  everyone believed extinct, banished here by the gods three thousand years ago.
  They are not extinct. They are homesick. And back in Alambor, the lich who
  betrayed you is one relic away from opening the door they have spent three
  millennia failing to open from this side.

party:
  - slug: berrian
    state: fine
    line: Paladin in living leaf-and-vine armour. The party's conscience and second healer.
    thread: Spoke Melora's name in a cell and she answered — "Berrian. Welcome." She is somewhere out here.
  - slug: cruucar
    state: fine
    line: Barbarian. Rages, flanks, deletes things. Went down twice in the temple and lived.
    thread: Carries a serpent scimitar that beheaded a naga on its first swing. Nobody knows its full rules.
  - slug: noctis
    state: fine
    line: Tabaxi rogue. Fastest, sneakiest, and by a wide margin the least intelligent.
    thread: Lost his familiar Luna down a pit and never got her back. Currently being walked on a leash.
  - slug: quinton
    state: fine
    line: Bard and frontman. Talks the party into and out of everything.
    thread: Carries a crescent-moon coin from a mysterious old man — and the Ziven crest is a crescent moon.
  - slug: torgoth
    state: fine
    line: Goliath. Lightning, water, and the biggest target on any battlefield.
    thread: Was shot to zero and woke at 1 HP in the void. Fully rested now, but it was close.
  - slug: vane
    state: fine
    line: Sorcerer and shapeshifter. The one who thinks two moves ahead.
    thread: Engineered the escape that stranded everyone. Also lost the relic doing it.

with_us:
  - name: Nobody
    line: >
      For the first time in a long time it is just the six of you. No crew, no
      guide, no pirate, no patron.

after_us:
  - slug: adune
    name: Adune (Morgenrath Gafar)
    line: The lich who was your patron for a hundred sessions. Holds five of six gate keys. Winning.
  - slug: aum-shai
    name: Aum Shai
    line: Adune's organisation. Owns the fleet that was boarding you when you vanished.
  - name: The Merchant
    line: Purple turban, dark cloak. Was standing feet from your lost relic when the gate closed.
  - slug: trent-hightower
    name: Sir Trent Hightower
    line: Adune's second. Seven foot five. Beat all six of you once already.
  - slug: zax
    name: General Zax
    line: Aum Shai commander. Cruucar sees his smiling face when he's dying.
    pcs: [cruucar]

elsewhere:
  - name: Captain Kael'vorr
    line: Githyanki captain of the Silver Promise. Rescued you, taught you everything, sailed off. Offered to take you to a way home — you said no.
  - slug: mally-grisham
    name: Mallie Grisham
    line: Pirate ally, last seen diving into a pit. Vane still owes him a rescue.
    pcs: [vane]
  - name: Kieran
    line: The Harper spy you freed, then lost again. Still in enemy hands.
  - slug: yankee-williams
    name: Captain Yankee and the fleet
    line: Left mid-battle on a mastless ship when you disappeared. Fate unknown.

objectives:
  - text: Survive the next five minutes
    status: active
    why: Forty armed Ziven guards are walking toward your landing spot right now.
    pcs: []
  - text: Find a way home — a "colour pool"
    status: active
    why: The gate you came through was one-way and it closed. Colour pools are the only known exit, and the Ziven are the galaxy's leading experts on them.
  - text: Work out whether the Ziven are even the enemy
    status: new
    why: Everything you were ever told said they were monsters. Everything you've seen in two days says they're scholars who miss home.
  - text: Get Berrian to Melora's God Isle
    status: new
    why: She answered him by name. Dormant gods call mortals to their isles, which makes her both a possible way home and the only friendly power out here.
    pcs: [berrian]
  - text: Stop Adune from opening the gate
    status: blocked
    why: You are in a different plane of existence. You cannot currently do anything about him at all.

changed:
  - kind: loss
    text: The orb of Felnriel — the sixth gate key — left on a deck in another plane. You had it for one session.
  - kind: loss
    text: Every platinum piece you owned, plus the Bag of Holding and the walking cauldron. Destroyed outright, not dropped.
  - kind: gain
    text: The Ziven Dynasty is not extinct. It was banished, it is intact, and you are standing in it.
  - kind: gain
    text: Melora is real, is in the Astral Sea, and has spoken to Berrian directly.
  - kind: gain
    text: You know both halves of the story — that the Ziven want out, and that Adune is about to let them out. Nobody else does.

clock:
  - Adune needs one more relic. It was last seen on a deck surrounded by his people. He may already have it.
  - Nobody has confirmed how fast time runs at home. If it's faster, the war may be decided before you get back.
  - Colour pools last minutes to hours and move constantly. The way home is not a fixed door.

jargon:
  - term: The Ziven
    def: Ancient dark elves who decided they were better than the gods and lost. Banished here, not killed. Also spelled Zeeven or Zevan — same people.
  - term: The Sundering
    def: The war that ended in the Ziven's banishment, killed half the gods, and reshaped the world. About five hundred years ago. Everything traces back to it.
  - term: The Astral Sea
    def: Where you are. A purple void between worlds. No up or down; you move by thinking. No hunger, no thirst, no sleep needed.
  - term: Colour pool
    def: A small unstable tear between worlds — twenty feet across, lasts minutes to hours, moves constantly. Some lead to Alambor. This is your ride home. The Ziven call them fractured gates.
  - term: Ilharess
    def: The Ziven city you're landing in. Seven miles across, a quarter of a million drow, and a dead mile-high gate at its centre.
  - term: The Hive
    def: Seven super-powerful Ziven archmages. Their names are on half your loot. Your cover story is that you're their fans.
  - term: The six gate keys
    def: Six relics that together open a gate bringing the Ziven home. Adune has five. You lost the sixth.
  - term: Githyanki
    def: Tall green-skinned natives of the Astral Sea. Rescued you, told you everything, stayed neutral.
  - term: Vault of Izdar
    def: An evil underground temple you looted fifty sessions ago. It was a Ziven holy site — which is why your cover story works.
  - term: Lich
    def: An undead wizard who made himself immortal. Adune is one. He's twelve hundred years old.

theories:
  - The Ziven may not be villains at all. Two days of evidence says scholars who want to go home; five hundred years of propaganda says monsters.
  - The dead mile-high gate at the centre of Ilharess is probably missing exactly what Adune is assembling.
  - Berrian's voice might not be Melora. Someone at the table thinks a hostile god read his mind and used her name.
  - Quinton's crescent-moon coin and the Ziven crescent-moon crest are unlikely to be a coincidence.

remember:
  - You are stranded in another dimension with no way home and no money.
  - The ancient enemy everyone said was extinct lives here, and so far they seem reasonable.
  - You are the only people alive who know that the door they've been pushing on for 3,000 years is about to open from the other side.
---
