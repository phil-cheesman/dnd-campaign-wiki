---
current_episode: 167
updated: 2026-08-09
arc: 09-relic-hunt

cliffhanger: >
  You are not prisoners. You have the run of a city of a quarter-million dark
  elves, an armed escort who follows you everywhere, and an invitation: Ilharess
  — the archmage the city is named after, and a living member of the Hive — has
  been told you are here and wants to meet you.
cliffhanger_art: /art/episodes/e167.webp

where:
  place: Ilharess
  region: The Astral Sea
  level: 15
  in_world: Year 500 of this age

story_now: >
  You walked into the Ziven capital openly and they arrested you politely. Thirty
  guards took every weapon you had — including Quinton's lute — logged your names,
  and put all six of you in a clean monastic cell while two inquisitors decided
  what you were. The verdict: not prisoners. Guests, with a permanent escort. The
  Zivens are not the monsters five hundred years of propaganda promised. Their city
  is spotless, their justice is instant, they conjure tea for the accused, and the
  most powerful one you've met spent an hour asking you wistful questions about
  home. And the leadership everyone assumed died with the old world is alive: the
  Hive survived the banishment, and one of the seven wants a conversation with you.
  You are standing inside the enemy's capital, under guard, having told them most of
  the truth — while back in Alambor the lich who betrayed you is one relic away from
  opening their door for them.

party:
  - slug: berrian
    state: fine
    line: Paladin in living leaf-and-vine armour. The party's conscience and its diplomat.
    thread: Asked a Githyanki outright if Melora was here and got "Yes, we know Melora." She is real, she is close, and the God Isles ARE the gods.
  - slug: cruucar
    state: fine
    line: Dragonborn barbarian. Rages, flanks, deletes things.
    thread: Learned Bahamut — the good dragon god — has an isle out here. Everyone thinks he should go meet him.
  - slug: noctis
    state: fine
    line: Tabaxi rogue. Fastest, sneakiest, and by a wide margin the least intelligent.
    thread: The cloak he's worn since episode 25 is Ziven-made and named for Izzdar the Undying. Jon has been waiting two years for someone to notice.
  - slug: quinton
    state: fine
    line: Bard and frontman. Talks the party into and out of everything.
    thread: They confiscated his lute as a weapon. The High Examiner promised it back "in time, in time."
  - slug: torgoth
    state: fine
    line: Goliath. Lightning, water, and the biggest target on any battlefield.
    thread: Used Tongues on four caged Slaad and got interrupted. They were executed before he could try again.
  - slug: vane
    state: fine
    line: Sorcerer and shapeshifter. The one who thinks two moves ahead.
    thread: Engineered the escape that stranded everyone. Refused the inquisitor's tea. Cannot, despite rumour at the table, cast Plane Shift.

with_us:
  - name: Captain Balor Scythran and the Gatewatch
    line: >
      Your assigned escort, guide and protector — "unofficially, observers." He
      answers no questions and watches every move. You are never alone in this city.

after_us:
  - slug: adune
    name: Adune (Morgenrath Gafar)
    line: The lich who was your patron for a hundred sessions. Holds five of six gate keys. Hates every god, Betrayer and Faithful alike.
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
  - name: Ilharess
    line: Archmage of conjuration, one of the seven of the Hive, master of this city — alive, and asking to meet you. You have not met a Hive member before.
  - name: High Examiner Aethon Valise
    line: Voice of the Second Circle. Ageless, warm, unguarded, far too interested in you. Set you free and set a watch on you in the same breath.
  - name: Examiner Caleth Forel
    line: Senior Inquisitor. Violet eyes that don't blink. Told you to your face that you're hiding something, then passed you up the chain.
  - name: Ren Sark
    line: Githyanki navigator in the next cell. Wants a berth on a ship; you can introduce him to Kael'vorr. He explained the God Isles to you.
  - name: Captain Kael'vorr
    line: The Curse of the Slaad — far more famous than he let on. Broke the Slaad uprising at Tu'narath. His ship docks here sometimes.
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
  - text: Get into the library
    status: new
    why: >
      You have free run of a Ziven library older than Alambor's calendar. You want
      the Hive's hierarchy, how the Zivens feel about the gods, how to reach the God
      Isles, how to spot a colour pool, and a maintenance map of the city.
  - text: Meet Ilharess without the cover story collapsing
    status: new
    why: You told two inquisitors you looted Izzdar's vault. You are about to meet Izzdar's colleague.
  - text: Find a way home — a "colour pool"
    status: active
    why: The gate you came through was one-way and it closed. Colour pools are the only known exit, and the Ziven are the galaxy's leading experts on them.
  - text: Work out whether the Ziven are even the enemy
    status: active
    why: A week of evidence says scholars who miss home and execute Slaad without trial. You still haven't found the part that makes them monsters.
  - text: Get Berrian to Melora's God Isle
    status: active
    why: A Githyanki confirmed she is known and present, and that the isle IS the god. The only question left is which captain will take you.
    pcs: [berrian]
  - text: Have an escape route ready
    status: new
    why: Jon asked, out loud, how you would get out of the city and where you would go. That is not an idle question.
  - text: Stop Adune from opening the gate
    status: blocked
    why: You are in a different plane of existence. You cannot currently do anything about him at all.

changed:
  - kind: loss
    text: Every weapon you carried, plus Quinton's lute and Noctis's staff — confiscated at the gate. You are unarmed in the enemy's capital.
  - kind: gain
    text: The Hive is alive. Ilharess, archmage of conjuration, rules this city and wants to meet you — and one or two other members may follow.
  - kind: gain
    text: "The god is the isle. The sundered gods slept and grew into the God Isles — so reaching Melora means reaching a place, not summoning a person."
  - kind: gain
    text: Melora is confirmed present in the Astral Sea, on a Githyanki's word. So is Tiamat.
  - kind: gain
    text: Noctis's cloak is named for Izzdar the Undying, whose vault you looted fifty sessions ago. It always was.
  - kind: gain
    text: "The Hollow Years — an unrecorded, chaotic era between the Sundering and the start of your calendar. The 500 years count from the Tree, not the fall."
  - kind: gain
    text: Adune has almost certainly never contacted the Zivens. Barely anyone has ever reached them. You are the first news from home.

clock:
  - Adune needs one more relic. It was last seen on a deck surrounded by his people. He may already have it.
  - You are logged, named, escorted and on the record. Caleth Forel already said out loud that you are hiding something.
  - Nobody has confirmed how fast time runs at home. Leaving the cells, you couldn't tell whether a day had passed.
  - Colour pools last minutes to hours and move constantly. The way home is not a fixed door.

jargon:
  - term: The Ziven
    def: Ancient dark elves who decided they were better than the gods and lost. Banished here, not killed. You are standing in their capital.
  - term: The Hive
    def: Seven super-powerful Ziven archmages, one per city. Their names are on half your loot. At least one is alive and wants to meet you.
  - term: Ilharess
    def: Both the city you're in and the Hive archmage of conjuration who rules it. Seven miles across, a quarter-million drow, a dead mile-high gate at its centre.
  - term: The Astral Sea
    def: Where you are. A purple void between worlds. No hunger, no thirst, no reliable sense of how much time has passed.
  - term: Colour pool
    def: A small unstable tear between worlds — twenty feet across, lasts minutes to hours, moves constantly. Your ride home. The Ziven call them fractured gates.
  - term: The God Isles
    def: Not islands where gods live — the gods themselves, asleep, grown into whole drifting ecosystems. Melora is one of them.
  - term: The Gatewatch
    def: Ilharess's city guard. Obsidian plate, sapphire cloaks, no faces, no answers. Captain Balor Scythran now follows you everywhere.
  - term: The Quiet Vaults
    def: The cells you were held in, cut deep into the floating mountain the city rides on. Clean beds, a library, and magical barriers.
  - term: Hall of Verity
    def: Where the Zivens question you. A black amphitheatre with one table in it, conjured chairs, conjured tea, and a slate that takes minutes by itself.
  - term: The Hollow Years
    def: The recordless, chaotic time between the Sundering and the day people started counting years again. Nobody knows how long it lasted.
  - term: The Sundering
    def: The war that ended in the Ziven's banishment and killed half the gods. Older than 500 years — the calendar starts later, at the Tree.
  - term: Githyanki
    def: Tall green-skinned natives of the Astral Sea. Rescued you, told you everything, stayed neutral. Two are in the cell next to yours.

theories:
  - The Zivens may not be villains at all. A week of evidence says grieving scholars. Then again, they executed four prisoners while you were upstairs and nobody blinked.
  - Aethon Valise was much too warm. The table thinks the friendliest man in the city is the most dangerous one in it.
  - They want to go home to deliver justice — but everyone who wronged them died five hundred years ago. Nobody has worked out who they intend to punish.
  - The dead mile-high World Gate at the centre of this city is probably missing exactly what Adune is assembling.
  - Quinton's crescent-moon coin and the Ziven crescent-moon crest are unlikely to be a coincidence.

remember:
  - You are unarmed, watched, and on file in the capital city of the people you were raised to think of as the ancient enemy.
  - They have been trying to get home for three thousand years, and you are the only ones who know the door is about to open from the other side.
  - The gods out here aren't hiding on islands. They ARE the islands. Berrian's god is one of them.
---
