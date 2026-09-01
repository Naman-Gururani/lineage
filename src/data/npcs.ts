// Dialogue scripts for every villager and talkable object on Lineage Isle.
// Facts about Naman come ONLY from data/content.ts — nothing here invents any.
// The in-development product (the Vault) stays unnamed and abstract.
// Registered at startup via registerTrees(NPC_TREES, NPC_INFO).
//
// Three things live here besides the scripts:
//   ROOM_HOSTS  which villager (or voice) greets you inside each interior
//   NEARBY      the two places every host and villager can point you at
//   the helpers below, which lift facts straight off the zone cards so a
//   figure can only ever be wrong in one file.
import type { Choice, Emote, Line, Tree } from '../systems/Dialogue'
import { PROFILE, ZONES, type Zone } from './content'
import type { SignDir } from './signs'

export const NPC_INFO: Record<string, { name: string; face: string }> = {
  mira: { name: 'Captain Mira', face: 'face_mira' },
  tomas: { name: 'Old Tomas', face: 'face_tomas' },
  pip: { name: 'Pip', face: 'face_pip' },
  lou: { name: 'Baker Lou', face: 'face_lou' },
  ada: { name: 'Ada', face: 'face_ada' },
  ravi: { name: 'Tinker Ravi', face: 'face_ravi' },
  sol: { name: 'Operator Sol', face: 'face_sol' },
  devi: { name: 'Nana Devi', face: 'face_devi' },
  arjun: { name: 'Arjun', face: 'face_arjun' },
  ilse: { name: 'Keeper Ilse', face: 'face_ilse' },
  professor: { name: 'Prof. Iyer', face: 'face_professor' },
  dockmaster: { name: 'Dockmaster Bo', face: 'face_dockmaster' },
  naman: { name: 'Naman', face: 'face_naman' },
  cat: { name: 'Byte', face: 'face_cat' },
}

type Say = (text: string, emote?: Emote) => Line

/** Lines spoken by a cast member: their display name + portrait on every line. */
function voice(id: string): Say {
  const { name, face } = NPC_INFO[id]
  return (text, emote) => (emote ? { who: name, text, face, emote } : { who: name, text, face })
}

/** Lines "spoken" by an object: a plain nameplate, no portrait. */
function object(who: string): Say {
  return (text, emote) => (emote ? { who, text, emote } : { who, text })
}

/* ================================================================== */
/* Facts, lifted straight off the zone cards                           */
/* ================================================================== */

/** The zone card behind a landmark. Every fact a villager says comes from one. */
function zone(id: string): Zone {
  const z = ZONES.find((x) => x.id === id)
  if (!z) throw new Error(`npcs.ts: no zone "${id}"`)
  return z
}

/** A paragraph of a zone card's body. */
const body = (id: string, i: number): string => zone(id).content.body![i]

/** A fact value: `fact('about', 'CGPA')` → "9.63 / 10". */
const fact = (id: string, k: string): string => zone(id).content.facts!.find((f) => f.k === k)!.v

/** Just the number from the CGPA fact, for lines that say it in passing. */
const cgpa = (): string => fact('about', 'CGPA').split('/')[0].trim()

/** A skills group, read out: `group('skills', 0)` → "Java, Spring Boot, …". */
const group = (id: string, i: number): string => zone(id).content.groups![i].items.join(', ')

/** A group's heading. */
const groupLabel = (id: string, i: number): string => zone(id).content.groups![i].label

/** The chips under a zone card, read out. */
const chipList = (id: string): string => (zone(id).content.chips ?? []).join(', ')

/** A link from a zone card: `link('contact', 0)` → "Email: gururaninaman@gmail.com". */
const link = (id: string, i: number): string => {
  const l = zone(id).content.links![i]
  return `${l.label}: ${l.value}`
}

/**
 * A card headline without its leading icon. The cards use ⭐ and 🛠️ to mark a
 * role; a dialogue box has no room for either, so the words come through alone.
 */
const plain = (s: string): string => s.replace(/^[^\p{L}\p{N}]+/u, '').trim()

/* ================================================================== */
/* Hosts and directions                                                */
/* ================================================================== */

/**
 * The voice that greets you the first time you step into an interior. On that
 * first entry `InteriorScene` walks the host toward you (when they are in the
 * room) and runs their `intro` node, which sets the flag below. Rooms whose
 * host also stands outdoors — Sol, Arjun, Ilse — keep `intro` out of their
 * tree's `entry` list, so an outdoor conversation never opens with a line
 * about a room you are not standing in.
 */
export const ROOM_HOSTS: Record<string, string> = {
  about: 'naman',
  experience: 'ada',
  skills: 'ravi',
  lineage: 'sol',
  stealth: 'vault_keeper',
  safestride: 'arjun',
  campus: 'professor',
  warehouse: 'dockmaster',
  contact: 'ilse',
}

/** The save flag that remembers a room has already introduced itself. */
export const greetFlag = (room: string): string => `greet_${room}`

/** One place a villager can point at: a heading, a spoken name, a sign target. */
export type NearbyArm = {
  dir: SignDir
  /** how the villager says it out loud */
  place: string
  /** the key into `SIGN_TARGETS` that fixes where it actually is */
  target: string
}

/**
 * Who can point where. `from` is the anchor they are speaking from — a
 * landmark's door (`lm:<id>`) or a villager's own spot (`npc:<id>`) — and
 * `tests/dialogue-data.test.ts` checks every heading against the true bearing
 * with the same maths the finger posts use. A host and a signpost can never
 * disagree about which way a place lies.
 */
export const NEARBY: Record<string, { from: string; arms: NearbyArm[] }> = {
  naman: {
    from: 'lm:about',
    arms: [
      { dir: 'S', place: 'the village plaza', target: 'Village Plaza' },
      { dir: 'E', place: 'the campus', target: 'SRM Campus — Education' },
    ],
  },
  ada: {
    from: 'lm:experience',
    arms: [
      { dir: 'SE', place: 'the village plaza', target: 'Village Plaza' },
      { dir: 'S', place: 'the Engine', target: 'Engine Works' },
    ],
  },
  ravi: {
    from: 'lm:skills',
    arms: [
      { dir: 'SW', place: 'the campus', target: 'SRM Campus — Education' },
      { dir: 'NW', place: 'Whispering Woods', target: 'Whispering Woods' },
    ],
  },
  sol: {
    from: 'npc:sol',
    arms: [
      { dir: 'N', place: 'Barclays Tower', target: 'Barclays Tower — Experience' },
      { dir: 'E', place: 'the harbor', target: 'Harbor' },
    ],
  },
  vault_keeper: {
    from: 'lm:stealth',
    arms: [
      { dir: 'S', place: 'the Cottage', target: 'The Cottage — About Naman' },
      { dir: 'SE', place: 'the campus', target: 'SRM Campus — Education' },
    ],
  },
  arjun: {
    from: 'npc:arjun',
    arms: [
      { dir: 'SE', place: 'the Lighthouse', target: 'The Point — Lighthouse · Contact' },
      { dir: 'W', place: 'the harbor', target: 'Harbor' },
    ],
  },
  ilse: {
    from: 'npc:ilse',
    arms: [
      { dir: 'NW', place: 'Safe Stride', target: 'Safe Stride & The Point' },
      { dir: 'W', place: 'the harbor', target: 'Harbor' },
    ],
  },
  professor: {
    from: 'lm:education',
    arms: [
      { dir: 'NE', place: 'the Workshop', target: 'The Workshop — Skills' },
      { dir: 'SW', place: 'the village plaza', target: 'Village Plaza' },
    ],
  },
  dockmaster: {
    from: 'lm:warehouse',
    arms: [
      { dir: 'E', place: 'the harbor', target: 'Harbor' },
      { dir: 'N', place: 'the village plaza', target: 'Village Plaza' },
    ],
  },
  mira: {
    from: 'npc:mira',
    arms: [
      { dir: 'N', place: 'the village plaza', target: 'Village Plaza' },
      { dir: 'W', place: 'the warehouse', target: 'Cargo Warehouse' },
    ],
  },
  tomas: {
    from: 'npc:tomas',
    arms: [
      { dir: 'N', place: 'the village plaza', target: 'Village Plaza' },
      { dir: 'NW', place: 'the warehouse', target: 'Cargo Warehouse' },
    ],
  },
  pip: {
    from: 'npc:pip',
    arms: [
      { dir: 'W', place: 'the warehouse', target: 'Cargo Warehouse' },
      { dir: 'E', place: 'Safe Stride', target: 'Safe Stride & The Point' },
    ],
  },
  lou: {
    from: 'npc:lou',
    arms: [
      { dir: 'N', place: 'the Cottage', target: 'The Cottage — About Naman' },
      { dir: 'NE', place: 'the campus', target: 'SRM Campus — Education' },
    ],
  },
  devi: {
    from: 'npc:devi',
    arms: [
      { dir: 'NW', place: 'the campus', target: 'SRM Campus — Education' },
      { dir: 'NE', place: 'the Workshop', target: 'The Workshop — Skills' },
    ],
  },
}

const DIR_WORD: Record<SignDir, string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
}

/** How a villager names their n-th place: `at('ravi', 0)` → "the campus". */
const at = (host: string, i: number): string => NEARBY[host].arms[i].place

/** …the same, opening a sentence. */
const At = (host: string, i: number): string => {
  const p = at(host, i)
  return p.charAt(0).toUpperCase() + p.slice(1)
}

/** Which way it lies: `way('ravi', 0)` → "south-west". */
const way = (host: string, i: number): string => DIR_WORD[NEARBY[host].arms[i].dir]

/** The three topics every host offers once they have said hello. */
const placeTopics = (): Choice[] => [
  { text: 'What is this place?', next: 'about_place' },
  { text: 'Tell me more', next: 'more' },
  { text: "What's nearby?", next: 'nearby' },
]

/* ================================================================== */
/* The harbor                                                          */
/* ================================================================== */

const mira: Tree = (() => {
  const s = voice('mira')
  return {
    id: 'mira',
    entry: [
      { when: { notFlag: 'metMira' }, node: 'welcome' },
      { when: { questDone: 'beacon' }, node: 'beam' },
      { node: 'again' },
    ],
    nodes: {
      welcome: {
        lines: [
          s("Welcome to Lineage Isle! Captain Mira, harbor master. Only passenger today, so you're my favourite.", 'happy'),
          s("Naman's expecting you. Well — he's expecting someone. Let's make it you."),
        ],
        effects: [{ setFlag: 'metMira' }, { setFlag: 'met_mira' }, { xp: 10 }],
        next: 'tutorial',
      },
      tutorial: {
        lines: [
          s('Quick drill: WASD or the arrows to walk. Hold Shift to run — the island is bigger than it looks.'),
          s('E talks, opens, reads. With nothing about, it swings — good for tall grass, less good for signposts.'),
          s("Esc is the menu. M is the map — it can ferry you back to anywhere you've already found."),
        ],
        next: 'go',
      },
      go: {
        lines: [s("The road runs up to the village plaza. Naman's Cottage sits at the top of it. Off you go.", 'happy')],
      },
      beam: {
        lines: [
          s('The beam is back! Was that you? First light on the Point in an age.', 'happy'),
          s('Ships can find the harbor again. So can everyone else — that is rather the idea.'),
        ],
        next: 'again',
      },
      again: {
        lines: [s('Back on dry land? Where to?')],
        choices: [
          { text: "Where's Naman?", next: 'cottage' },
          { text: "What's out there?", next: 'around' },
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Controls again?', next: 'tutorial' },
          { text: 'Just passing', next: 'bye' },
        ],
      },
      nearby: {
        lines: [
          s(`${At('mira', 0)} is ${way('mira', 0)} up the road — the fountain, Lou's stall, the Cottage above it.`),
          s(`${At('mira', 1)} is ${way('mira', 1)} along the green. Bo runs it, and Bo runs it loudly.`),
        ],
        next: 'again',
      },
      cottage: {
        lines: [
          s("Up the road, top of the plaza — the Cottage. He's usually at his desk. Knock; he likes visitors."),
          s('Mind Byte. The cat. It has opinions about strangers, and stronger ones about friends.', 'wink'),
        ],
        next: 'again',
      },
      around: {
        lines: [
          s('Barclays Tower is up on the Heights, north-west. The Workshop is in the Woods, north-east.'),
          s('The Engine sits south-west, where the Stream meets the sea. Safe Stride is in the Fields, south-east.'),
          s('The Vault is up on the Ridge, north. The Lighthouse is out on the Point. Signposts do the rest.'),
        ],
        next: 'again',
      },
      bye: {
        lines: [s("Fair winds. Shout if you get lost — I'll hear you from the Ridge.")],
      },
    },
  }
})()

const tomas: Tree = (() => {
  const s = voice('tomas')
  return {
    id: 'tomas',
    entry: [
      { when: { notFlag: 'met_tomas' }, node: 'hello' },
      { when: { questDone: 'fishing' }, node: 'done' },
      { when: { questActive: 'fishing', item: ['fish', 3] }, node: 'turnin' },
      { when: { questActive: 'fishing' }, node: 'reminder' },
      { node: 'offer' },
    ],
    nodes: {
      hello: {
        lines: [
          s('Mm. New face. Sit if you like — the sea does not mind.', 'think'),
          s('Tomas. Fished off this pier since before it was a pier.'),
        ],
        effects: [{ setFlag: 'met_tomas' }, { xp: 5 }],
        next: 'offer',
      },
      offer: {
        lines: [s("Tide's right and I've a spare rod. Three fish would make a supper. Fancy it?")],
        choices: [
          { text: 'Lend me the rod', next: 'accept' },
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Another time', next: 'later' },
        ],
      },
      nearby: {
        lines: [
          s(`${At('tomas', 0)} is ${way('tomas', 0)} up the road. Everything on this island starts there.`),
          s(`${At('tomas', 1)} sits ${way('tomas', 1)} along the shore. Crates. Not fish.`),
        ],
      },
      accept: {
        lines: [
          s('Good. End of the pier: press E and wait. The waiting is the point. Then the tug — that is the fish.', 'happy'),
          s('Byte will watch you. Byte always watches.'),
        ],
        effects: [{ startQuest: 'fishing' }],
      },
      later: {
        lines: [s('The sea is patient. So am I. Mostly.')],
      },
      reminder: {
        lines: [s('End of the pier. Press E, wait for the tug, press again. Three is the number.')],
      },
      turnin: {
        lines: [
          s('Three! Fat ones, too.', 'happy'),
          s("Byte has been circling your ankles since the second fish. You've been adopted, I'd say."),
          s('Go on, then. Cats know.'),
        ],
        effects: [{ take: ['fish', 3] }, { advanceQuest: ['fishing', 'return', 1] }, { companion: true }],
        effectsAtEnd: true,
      },
      done: {
        lines: [
          s('Byte still with you? Thought so. Cats know.'),
          s('Come sit some time. The sea tells its stories slow.'),
        ],
        choices: [
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Just sitting', next: 'sit' },
        ],
      },
      sit: {
        lines: [s('Good answer. Mind the rod.')],
      },
    },
  }
})()

const pip: Tree = (() => {
  const s = voice('pip')
  return {
    id: 'pip',
    entry: [
      { when: { notFlag: 'met_pip' }, node: 'hello' },
      { when: { questDone: 'shells' }, node: 'done' },
      { when: { questActive: 'shells', item: ['shell', 5] }, node: 'turnin' },
      { when: { questActive: 'shells' }, node: 'reminder' },
      { node: 'offer' },
    ],
    nodes: {
      hello: {
        lines: [
          s('Hi! Hi! Are you the boat person? You ARE the boat person!', 'shout'),
          s("I'm Pip. I collect shells. I've got loads, but none of them are the good ones.", 'sad'),
        ],
        effects: [{ setFlag: 'met_pip' }, { xp: 5 }],
        next: 'offer',
      },
      offer: {
        lines: [s('Five good ones are down the beach — the shiny, sticky-out ones. Find them for me?')],
        choices: [
          { text: "I'll find them", next: 'accept' },
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Not now', next: 'later' },
        ],
      },
      nearby: {
        lines: [
          s(`${At('pip', 0)} is ${way('pip', 0)} along the front! Big doors! Bo shouts, but he is nice!`, 'shout'),
          s(`${At('pip', 1)} is ${way('pip', 1)}, past the fields. That is where the shiny ones run out.`),
        ],
      },
      accept: {
        lines: [s('YES. Five! The beach runs both ways from the dock. The good ones sparkle!', 'happy')],
        effects: [{ startQuest: 'shells' }],
      },
      later: {
        lines: [s('Okay. But the tide might take them first. Just saying.', 'sad')],
      },
      reminder: {
        lines: [s('Five shells! The sparkly ones! Along the beach! I believe in you!', 'shout')],
      },
      turnin: {
        lines: [
          s('Five! FIVE! These are the best ones anyone has ever found!', 'shout'),
          s("I made you something. It's a hat. It's mostly shells. Wear it always.", 'happy'),
        ],
        effects: [{ take: ['shell', 5] }, { advanceQuest: ['shells', 'return', 1] }],
        effectsAtEnd: true,
      },
      done: {
        lines: [s("Still got the hat? You don't have to wear the hat. Please wear the hat.", 'wink')],
        choices: [
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Bye, Pip', next: 'wave' },
        ],
      },
      wave: {
        lines: [s('Bye! Come back! Bring shells!', 'happy')],
      },
    },
  }
})()

/* ================================================================== */
/* The plaza                                                           */
/* ================================================================== */

const lou: Tree = (() => {
  const s = voice('lou')
  return {
    id: 'lou',
    entry: [
      { when: { notFlag: 'met_lou' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      hello: {
        lines: [s('Morning! Or whatever it is. Lou — baker, and the news, if you want it.', 'happy')],
        effects: [{ setFlag: 'met_lou' }, { xp: 5 }],
        next: 'hub',
      },
      again: {
        lines: [s('Back for a bun, or back for the news?')],
        next: 'hub',
      },
      hub: {
        lines: [s("What'll it be?")],
        choices: [
          { text: 'Any gossip?', next: 'gossip' },
          { text: 'Anything about the Vault?', next: 'vault', when: { discovered: 'stealth' } },
          { text: "What's fresh?", next: 'fresh' },
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Just browsing', next: 'bye' },
        ],
      },
      nearby: {
        lines: [
          s(`${At('lou', 0)} is ${way('lou', 0)} of the fountain, top of the road. That is the man himself.`),
          s(`${At('lou', 1)} is ${way('lou', 1)} — the signpost on the east side of the plaza says so too.`),
        ],
        next: 'hub',
      },
      gossip: {
        lines: [
          s("Pip wants shells, Tomas wants company, and the cat wants Tomas's fish. Everyone wants something."),
          s("Ravi has lost a gear again. Sol keeps a drawer of them at the Engine. Draw your own conclusions.", 'wink'),
          s("And there's a telescope on the Heights, out past the tower. You didn't hear that from me."),
        ],
        next: 'hub',
      },
      vault: {
        lines: [
          s('The sealed door on the Ridge? It counts packets — the little motes that fall out of the Stream.'),
          s('Twenty, all told. They turn up in tall grass and old chests. Swing at everything, that is my policy.'),
        ],
        next: 'hub',
      },
      fresh: {
        lines: [
          s("Buns. Loaves. And a 'stream cake' — it's a swiss roll, but don't tell Naman that.", 'wink'),
          s('Rumours come free with every bun. Sometimes without.'),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s('Mind how you go. The Cottage is up the road, if you are after the man himself.')],
      },
    },
  }
})()

/* ================================================================== */
/* Barclays Tower                                                      */
/* ================================================================== */

const ada: Tree = (() => {
  const s = voice('ada')
  return {
    id: 'ada',
    entry: [
      { when: { notFlag: 'met_ada' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      // The lobby greeting, run once by InteriorScene when you first walk in.
      intro: {
        lines: [
          s(`Welcome to the Tower — this building is Naman's job at ${PROFILE.company}.`, 'happy'),
          s('The elevator is the trick: every floor is a chapter of his career. Top floor is today.'),
          s('Ask me for the guided version anytime.'),
        ],
        effects: [{ setFlag: greetFlag('experience') }, { setFlag: 'met_ada' }, { xp: 5 }],
        next: 'hub',
      },
      hello: {
        lines: [
          s('Good day. Barclays Tower reception — Ada. The lift is the only way up, and the floors tell the story.'),
          s('Please do not touch the plant.'),
        ],
        effects: [{ setFlag: 'met_ada' }, { xp: 5 }],
        next: 'hub',
      },
      again: {
        lines: [s('Back again. The lift is where you left it.')],
        next: 'hub',
      },
      hub: {
        lines: [s('How can I help?')],
        choices: [
          { text: "What's on each floor?", next: 'floors' },
          { text: 'What does he do here?', next: 'work' },
          ...placeTopics(),
          { text: 'Thanks', next: 'bye' },
        ],
      },
      about_place: {
        lines: [
          s(`The Tower is the ${zone('experience').label} chapter. Every floor is a post; the lift is the timeline.`),
          s(`Ground floor is reception — me. Top floor is now: ${PROFILE.role} at ${PROFILE.company}.`),
        ],
        next: 'hub',
      },
      more: {
        lines: [
          s(`Top of the lift: ${plain(body('experience', 0))}.`),
          s(`Before that: ${plain(body('experience', 2))}.`),
          s(`And the roof holds the stack: ${chipList('experience')}.`),
        ],
        next: 'hub',
      },
      nearby: {
        lines: [
          s(`Down the ramp and ${way('ada', 0)}: ${at('ada', 0)}. The post at the upper bridge points you back.`),
          s(`${At('ada', 1)} is ${way('ada', 1)} of us, down where the Stream meets the sea.`),
        ],
        next: 'hub',
      },
      floors: {
        lines: [
          s('Floor one: the 2023 summer internship. DevOps — process exceptions into an analyst portal, in real time.'),
          s('Floor two: Software Development Engineer, August 2024 to now. The Stream starts on that floor.'),
          s('The roof: the stack. Flink, Kafka, Kafka Streams, Redis, DynamoDB, IBM MQ. Mind the wind.'),
        ],
        next: 'hub',
      },
      work: {
        lines: [
          s('He takes the raw streams — Kafka, IBM MQ — and makes events trustworthy. Tokenised, classified, mapped.'),
          s("Then the lineage engine: every payment's full path, stitched hop by hop. Around 750 million records a day."),
          s('The intern summer: Python and KornShell over Teradata, behind an OAuth 2.0 API. Eight hours to real time.'),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s('The lift is to your left. Ground floor is where you are. It usually is.')],
      },
    },
  }
})()

/* ================================================================== */
/* The Workshop and the Engine                                         */
/* ================================================================== */

const ravi: Tree = (() => {
  const s = voice('ravi')
  return {
    id: 'ravi',
    entry: [
      { when: { notFlag: 'met_ravi' }, node: 'hello' },
      { when: { questDone: 'gear' }, node: 'done' },
      { when: { questActive: 'gear', item: ['gear', 1] }, node: 'turnin' },
      { when: { questActive: 'gear' }, node: 'reminder' },
      { node: 'offer' },
    ],
    nodes: {
      // Run once by InteriorScene the first time you push the Workshop door.
      intro: {
        lines: [
          s('Careful with the pegboards — every tool up there is something Naman actually uses.'),
          s('Three walls: languages, streaming, state & tooling. No decorative tools. I checked.', 'think'),
        ],
        effects: [{ setFlag: greetFlag('skills') }, { setFlag: 'met_ravi' }, { xp: 5 }],
        next: 'topics',
      },
      hello: {
        lines: [
          s('Careful — every tool on that wall has a place, and every place has a label. Ravi. I keep the Workshop.'),
          s("Languages on the left, streaming in the middle, state and tooling on the right. Naman's kit, sorted."),
        ],
        effects: [{ setFlag: 'met_ravi' }, { xp: 5 }],
        next: 'offer',
      },
      topics: {
        lines: [s('Anything else, while the glue sets?')],
        choices: [...placeTopics(), { text: 'Back to the bench', next: 'bench' }],
      },
      about_place: {
        lines: [
          s(`This is the ${zone('skills').label} chapter. Three pegboards, and every tool on them is one he uses.`),
          s(`Left to right: ${groupLabel('skills', 0)}, ${groupLabel('skills', 1)}, ${groupLabel('skills', 2)}.`),
        ],
        next: 'topics',
      },
      more: {
        lines: [
          s(`${groupLabel('skills', 0)}: ${group('skills', 0)}.`),
          s(`${groupLabel('skills', 1)}: ${group('skills', 1)}.`),
          s(`${groupLabel('skills', 2)}: ${group('skills', 2)}.`),
          s('And the method, clamped to the bench: spec first, then the AI turns intent into reviewable code.'),
        ],
        next: 'topics',
      },
      nearby: {
        lines: [
          s(`${At('ravi', 0)} is ${way('ravi', 0)}, down the fork. Prof. Iyer keeps the study hall there.`),
          s(`${At('ravi', 1)} start ${way('ravi', 1)}, right outside. Mind the roots.`),
        ],
        next: 'topics',
      },
      bench: {
        lines: [s('Right. Do not touch the third pegboard. It is load-bearing, somehow.')],
      },
      offer: {
        lines: [
          s("Now — the windmill has dropped a gear, and I've none spare. Sol at the Engine Works keeps a drawer of them."),
          s("Fetch me one? South-west, over the lower bridge. There's something for your head in it."),
        ],
        choices: [
          { text: "I'll find one", next: 'accept' },
          { text: 'Tell me about the Workshop', next: 'topics' },
          { text: 'Maybe later', next: 'later' },
        ],
      },
      accept: {
        lines: [s("Splendid. Tell Sol it's for the windmill, not the Engine. Sol is particular about the Engine.", 'happy')],
        effects: [{ startQuest: 'gear' }],
      },
      later: {
        lines: [s('The windmill can wait. It is very good at waiting. Round and round, except not.', 'think')],
        next: 'topics',
      },
      reminder: {
        lines: [s("Sol, at the Engine Works. South-west, past the lower bridge. Say it's for the windmill.")],
        next: 'topics',
      },
      turnin: {
        lines: [
          s("That's the one! Once it's in, you'll hear the windmill all the way from the plaza.", 'happy'),
          s('Hard hat, as promised. Safety first, spec second, code a distant third.'),
        ],
        effects: [{ take: ['gear', 1] }, { advanceQuest: ['gear', 'return', 1] }],
        effectsAtEnd: true,
      },
      done: {
        lines: [
          s('The windmill turns, the hat fits. All is well.', 'happy'),
          s('You know how he works? Spec first — a precise written spec is the contract.'),
          s('Then the AI turns that intent into correct, reviewable code. Tidy. Like a good bench.'),
        ],
        next: 'topics',
      },
    },
  }
})()

const sol: Tree = (() => {
  const s = voice('sol')
  return {
    id: 'sol',
    entry: [
      { when: { notFlag: 'met_sol' }, node: 'hello' },
      { when: { questActive: 'gear', notFlag: 'gotGear' }, node: 'gear' },
      { when: { packets: 20 }, node: 'all' },
      { when: { packets: 10 }, node: 'half' },
      { node: 'some' },
    ],
    nodes: {
      // Sol also stands outside the Engine, so this greeting stays out of the
      // entry list: it belongs to the hall, and InteriorScene runs it there.
      // It pays nothing — `hello` below is the one meeting reward, and the gear
      // errand sends you to Sol on the Engine road long before you open a door.
      intro: {
        lines: [
          s("You're standing inside Naman's biggest build — a payment lineage engine, rendered as a machine."),
          s("Real thing runs at Barclays: ~750 million records a day, every payment's full path reconstructed hop by hop."),
          s('The console shows it live. Ask me for the deep dive if you like plumbing.'),
        ],
        effects: [{ setFlag: greetFlag('lineage') }],
        next: 'hub',
      },
      hello: {
        lines: [
          s("Mind the pipes — they're warm. Sol. I keep the Engine fed, and the Engine keeps the Stream honest."),
          s('Every mote out there came from one place and goes to one place. The Engine stitches those links into a path.'),
        ],
        effects: [{ setFlag: 'met_sol' }, { xp: 5 }],
        next: 'hub',
      },
      gear: {
        lines: [
          s("Ravi's windmill again? Here — a spare gear. Cleaned it myself, so don't drop it in the Stream."),
          s("Tell Ravi the Engine's gears are the Engine's. This one is the last freebie.", 'wink'),
        ],
        effects: [{ give: ['gear', 1] }, { setFlag: 'gotGear' }, { advanceQuest: ['gear', 'gear', 1] }],
        next: 'hub',
      },
      all: {
        lines: [
          s('Twenty of twenty! Every lost mote home. The Stream runs clean, end to end.', 'happy'),
          s('Go and look at the Ridge. That door has been waiting for you.'),
        ],
        next: 'hub',
      },
      half: {
        lines: [s('Half the lost motes are back already. Fewer gaps in the path — the Stream looks healthier.', 'happy')],
        next: 'hub',
      },
      some: {
        lines: [s('Motes keep falling out of the Stream. They hide — tall grass, old chests, odd corners.', 'think')],
        next: 'hub',
      },
      hub: {
        lines: [s('Anything else?')],
        choices: [
          { text: 'Ravi sent me for a gear', next: 'gear', when: { questActive: 'gear', notFlag: 'gotGear' } },
          { text: 'What is the Stream?', next: 'stream' },
          { text: "What's a lost packet?", next: 'lost' },
          ...placeTopics(),
          { text: "That's all", next: 'bye' },
        ],
      },
      about_place: {
        lines: [
          s(`This hall is one project, built big enough to walk through: ${zone('lineage').content.title}.`),
          s(`In production at ${zone('lineage').content.sub}. The console on the wall shows a live path.`),
        ],
        next: 'hub',
      },
      more: {
        lines: [
          s('It reconstructs the complete lineage of every payment — every system it touched, in order.'),
          s('Each hop guarantees exactly one upstream and one downstream; the Engine stitches those links end to end.'),
          s('Continuously, at ~750 million records a day.'),
          s(`Under the floor: ${chipList('lineage')}.`),
        ],
        next: 'hub',
      },
      nearby: {
        lines: [
          s(`${At('sol', 0)} stands ${way('sol', 0)} of here, up on the Heights.`),
          s(`${At('sol', 1)} is ${way('sol', 1)}, over the lower bridge — the plaza is on the way.`),
        ],
        next: 'hub',
      },
      stream: {
        lines: [
          s("Naman's real-time streams. Events come off Kafka and IBM MQ and get made trustworthy before they move on."),
          s('The Engine is his lineage engine: the full path of every payment across decoupled systems.'),
          s('Each hop: one upstream, one downstream. About 750 million records a day, stitched into paths.'),
        ],
        next: 'hub',
      },
      lost: {
        lines: [
          s("A packet is a mote that fell out of the Stream. A gap in a path. The Engine can't stitch what isn't there."),
          s("Twenty are out there. Bring them all home and the Ridge door unseals. Don't ask me how it knows. It knows."),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s('Mind the pipes on the way out. Still warm.')],
      },
    },
  }
})()

/* ================================================================== */
/* Willow Fields                                                       */
/* ================================================================== */

const devi: Tree = (() => {
  const s = voice('devi')
  return {
    id: 'devi',
    entry: [
      { when: { notFlag: 'met_devi' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      hello: {
        lines: [s("Oh, hello dear. Come in out of the wind. I'm Devi — everyone says Nana, so you may as well.", 'happy')],
        effects: [{ setFlag: 'met_devi' }, { xp: 5 }],
        next: 'hub',
      },
      again: {
        lines: [s('Hello again, dear. Arjun is about somewhere, worrying beautifully.')],
        next: 'hub',
      },
      hub: {
        lines: [s('Was there something?')],
        choices: [
          { text: "What's on your wrist?", next: 'tracker' },
          { text: 'Are you alright out here?', next: 'alright' },
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Take care, Nana', next: 'bye' },
        ],
      },
      nearby: {
        lines: [
          s(`${At('devi', 0)} gate is just ${way('devi', 0)} of my bench, dear. I sit here for the noise.`),
          s(`${At('devi', 1)} is ${way('devi', 1)}, up through the trees. Ravi shouts if you touch anything.`, 'wink'),
        ],
        next: 'hub',
      },
      tracker: {
        lines: [
          s('This? Safe Stride. It knows where I am, and it knows if I fall — something about an accelerometer.'),
          s('If I go down, it sends the SOS itself and shows Arjun where to run. On a little live map.'),
          s("I've tested it once. On purpose. Don't tell him.", 'wink'),
        ],
        next: 'hub',
      },
      alright: {
        lines: [
          s('Quite alright. I have the garden, the pond, and a grandson who visits twice as often as he used to.'),
          s('Naman built it for people like me. Sensors, tracking, a button that shouts for you. Clever lad.', 'happy'),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s("Go carefully, dear. And tell Arjun I haven't fallen over. Today.", 'wink')],
      },
    },
  }
})()

const arjun: Tree = (() => {
  const s = voice('arjun')
  return {
    id: 'arjun',
    entry: [
      { when: { notFlag: 'met_arjun' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      // Arjun is out in the fields too, so this one belongs to the unit alone —
      // and pays nothing: `hello` below is his single meeting reward.
      intro: {
        lines: [
          s('Safe Stride — Naman built this for elders: fall detection, live location, one-press SOS.'),
          s("The map on the wall is real. Try the SOS drill — it's a demo, nobody panics."),
        ],
        effects: [{ setFlag: greetFlag('safestride') }],
        next: 'topics',
      },
      hello: {
        lines: [
          s("You've met Nana? Good. Arjun. I didn't build any of it — I just worry less now."),
          s('Fall detection, live map, an SOS that sends itself. I used to ring her every hour. Now I just visit.'),
        ],
        effects: [{ setFlag: 'met_arjun' }, { xp: 5 }],
        next: 'topics',
      },
      again: {
        lines: [
          s('She showed you the button, didn\'t she. She loves the button.', 'think'),
          s('The SOS goes to emergency services first, then to me. In that order. The right order.'),
        ],
        next: 'topics',
      },
      topics: {
        lines: [s('Anything you want to know?')],
        choices: [...placeTopics(), { text: 'Take care', next: 'care' }],
      },
      about_place: {
        lines: [
          s(`This unit is ${zone('safestride').content.title} — ${zone('safestride').content.sub}.`),
          s('Shipped, and Nana wears it. That is the whole product review.'),
        ],
        next: 'topics',
      },
      more: {
        lines: [
          s('Real-time location tracking, plus accelerometer-based fall detection.'),
          s('If she goes down it fires the SOS itself: emergency services first, then me, on a live map.'),
          s(`Built from ${chipList('safestride')}.`),
          s(`The source is public: ${zone('safestride').content.links![0].value}.`),
        ],
        next: 'topics',
      },
      nearby: {
        lines: [
          s(`${At('arjun', 0)} is ${way('arjun', 0)} from the door, out past the brook.`),
          s(`${At('arjun', 1)} is ${way('arjun', 1)} — follow the fields road back the way you came.`),
        ],
        next: 'topics',
      },
      care: {
        lines: [s('You too. And if you see her out by the pond, wave. She likes being waved at.')],
      },
    },
  }
})()

/* ================================================================== */
/* The Point                                                           */
/* ================================================================== */

const ilse: Tree = (() => {
  const s = voice('ilse')
  return {
    id: 'ilse',
    entry: [
      { when: { notFlag: 'met_ilse' }, node: 'hello' },
      { when: { questDone: 'beacon' }, node: 'proud' },
      { when: { questActive: 'beacon' }, node: 'active' },
      { node: 'offer' },
    ],
    nodes: {
      // Ilse keeps the door as well as the stairs, so the lamp-room greeting
      // stays out of the entry list and belongs to the room. It pays nothing:
      // `hello`, down at the door, is her one meeting reward.
      intro: {
        lines: [
          s('The last chapter. Light the lens and the island sends word to Naman himself.'),
          s('Email, GitHub, LinkedIn — the beam carries all three.'),
        ],
        effects: [{ setFlag: greetFlag('contact') }],
        next: 'topics',
      },
      hello: {
        lines: [s('Keeper Ilse. I keep the lighthouse. Technically I keep the stairs — the light has been out a while.')],
        effects: [{ setFlag: 'met_ilse' }, { xp: 5 }],
        next: 'offer',
      },
      offer: {
        lines: [
          s('The lens is up top, cold as a fish. Climb up and light it, and the whole sea can find this island again.'),
          s("Naman's out there somewhere too. A lit beacon says: come and say hello."),
        ],
        choices: [
          { text: "I'll light it", next: 'accept' },
          { text: 'Tell me about the Point', next: 'topics' },
          { text: 'Later', next: 'later' },
        ],
      },
      accept: {
        lines: [s("Good. Stairs inside, lens at the top — press E at the glass. Don't fall. The paperwork is unbearable.")],
        effects: [{ startQuest: 'beacon' }],
      },
      later: {
        lines: [s('Suit yourself. The dark is not going anywhere. That is rather the problem with it.', 'think')],
        next: 'topics',
      },
      active: {
        lines: [s('Lens is up top. Stairs are inside. Press E at the glass. I counted the steps once: too many.')],
        next: 'topics',
      },
      proud: {
        lines: [
          s('Look at it go. Round and round, all night. I had forgotten the sound of it.', 'happy'),
          s('Anyone who wants to reach Naman knows where to look now. That is the whole trick of a lighthouse.'),
          s("Keeper. That's what they'll call you. I'll allow it.", 'wink'),
        ],
        next: 'topics',
      },
      topics: {
        lines: [s('Was there something else?')],
        choices: [
          ...placeTopics(),
          { text: 'About the beacon', next: 'offer', when: { questNotStarted: 'beacon' } },
          { text: 'Mind the stairs', next: 'part' },
        ],
      },
      about_place: {
        lines: [
          s(`The Point is the ${zone('contact').label} chapter. ${zone('contact').content.title} is the last stop on the island.`),
          s('Light the lens and he has a way to be reached. That is the whole of it.'),
        ],
        next: 'topics',
      },
      more: {
        lines: [
          s(`${link('contact', 0)}.`),
          s(`${link('contact', 1)}. ${link('contact', 2)}.`),
          s('The beam carries all three. Whichever you pick, it lands in the same place.'),
        ],
        next: 'topics',
      },
      nearby: {
        lines: [
          s(`${At('ilse', 0)} is ${way('ilse', 0)} along the shore road — Arjun keeps it.`),
          s(`${At('ilse', 1)} is ${way('ilse', 1)}, the long way back. Mira will be glad to see you.`),
        ],
        next: 'topics',
      },
      part: {
        lines: [s('I always do. Sixty-odd of them, and every one at a different height.')],
      },
    },
  }
})()

/* ================================================================== */
/* Naman, at his desk in the Cottage                                   */
/* ================================================================== */

const naman: Tree = (() => {
  const s = voice('naman')
  return {
    id: 'naman',
    entry: [
      { when: { notFlag: 'metNaman' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      // The doorway welcome, run once by InteriorScene on your first visit.
      intro: {
        lines: [
          s('Oh hey — you made it! Welcome to my corner of the island.', 'happy'),
          s("This cottage is the 'about me' chapter. Poke the bookshelf, the photo, the PC — everything answers."),
          s(`And if you want the short version: I'm ${PROFILE.role} at ${PROFILE.company}. The rest of the island is the long version.`),
        ],
        effects: [{ setFlag: greetFlag('about') }, { setFlag: 'metNaman' }, { setFlag: 'met_naman' }, { xp: 20 }],
        next: 'menu',
      },
      hello: {
        lines: [
          s('Oh — hello! You made it. Mira said the boat had someone aboard.', 'happy'),
          s("I'm Naman. This is my desk, and that is Byte, pretending not to notice you."),
        ],
        effects: [{ setFlag: 'metNaman' }, { setFlag: 'met_naman' }, { xp: 20 }],
        next: 'menu',
      },
      again: {
        lines: [s("Welcome back. The kettle's on. In theory.", 'happy')],
        next: 'menu',
      },
      // Naman's menu is already six deep, so his three place topics nest one
      // level below "Where am I?" rather than crowding the choice list.
      menu: {
        lines: [s('What would you like to know?')],
        choices: [
          { text: 'Who are you?', next: 'who' },
          { text: 'What do you work on?', next: 'work' },
          { text: 'How do you work?', next: 'how' },
          { text: 'What is this place?', next: 'about_place' },
          { text: 'Show me your notes', next: 'notes' },
          { text: 'Just saying hi', next: 'hi' },
          { text: 'See you around', next: 'bye' },
        ],
      },
      about_place: {
        lines: [
          s(`The Cottage is the ${zone('about').label} chapter — one room for the person, before the island explains the work.`),
          s(`Desk, shelf, photo, fire. ${zone('about').content.sub} is the whole nameplate.`),
        ],
        choices: [
          { text: 'Tell me more', next: 'more' },
          { text: "What's nearby?", next: 'nearby' },
          { text: 'Back', next: 'menu' },
        ],
      },
      more: {
        lines: [
          s(body('about', 0).split('. ')[0] + '.'),
          s(`${fact('about', 'Now')}, since ${fact('about', 'Since')}. ${fact('about', 'Education')}, CGPA ${cgpa()}.`),
          s('The long version is the island: the Tower for the work, the Workshop for the tools, the Engine for the build.'),
        ],
        next: 'menu',
      },
      nearby: {
        lines: [
          s(`Out the door and ${way('naman', 0)} is ${at('naman', 0)} — the fountain, Lou's stall, the signposts.`),
          s(`${At('naman', 1)} is ${way('naman', 1)}, over the meadow. Prof. Iyer keeps the notice board there.`),
        ],
        next: 'menu',
      },
      who: {
        lines: [
          s(`${PROFILE.name} — ${PROFILE.role} at ${PROFILE.company}, since ${fact('about', 'Since')}.`),
          s(`Before that: B.Tech in Computer Science at SRM IST, ${fact('education', 'Years')}. CGPA ${cgpa()}. I checked twice.`, 'wink'),
          s('I like the unglamorous backbone — pipelines, guarantees, the lineage that lets a number be believed.'),
        ],
        next: 'menu',
      },
      work: {
        lines: [
          s('Real-time streams. Events arrive off Apache Kafka and IBM MQ, and I make them worth trusting.'),
          s('The big one is a payment lineage engine — the full path of every payment across decoupled systems.'),
          s('Each hop: one upstream, one downstream. Stitched into whole stories, 750 million records a day.'),
        ],
        next: 'menu',
      },
      how: {
        lines: [
          s('Spec first. A precise written spec is the contract.', 'think'),
          s('Then AI is the force-multiplier — it turns intent into correct, reviewable implementation.'),
          s('Ravi keeps the whole tool wall at the Workshop, if you want the inventory.'),
        ],
        next: 'menu',
      },
      notes: {
        lines: [s('Here — the short version. I keep it pinned above the desk.')],
        effects: [{ panel: 'zone:about' }],
        effectsAtEnd: true,
      },
      hi: {
        lines: [
          s("Hi! Thanks for coming all the way up. Most visitors get waylaid by Lou's buns.", 'happy'),
          s("Poke around. The island is small, but it hides things. Byte knows where. Byte won't say."),
        ],
        next: 'menu',
      },
      bye: {
        lines: [s('See you around. If you ever need me, the Lighthouse knows how to reach me.', 'wink')],
      },
    },
  }
})()

/* ================================================================== */
/* SRM Campus — the study hall                                         */
/* ================================================================== */

const professor: Tree = (() => {
  const s = voice('professor')
  return {
    id: 'professor',
    entry: [{ node: 'topics' }],
    nodes: {
      intro: {
        lines: [
          s(`Welcome to the campus — ${zone('education').content.title}, four years of it.`, 'happy'),
          s(`Computer Science & Engineering, 2020 to 2024, CGPA ${cgpa()}. I keep the notice board honest.`),
          s('The chalkboard puzzle is my office hours. Solve all five and earn the cap.'),
        ],
        effects: [{ setFlag: greetFlag('campus') }, { setFlag: 'met_professor' }, { xp: 5 }],
        next: 'topics',
      },
      topics: {
        lines: [s('Office hours are always open. What can I answer?')],
        choices: [...placeTopics(), { text: 'Nothing, thanks', next: 'dismissed' }],
      },
      about_place: {
        lines: [
          s(`This is the ${zone('education').label} chapter — ${zone('education').content.title}.`),
          s(`${zone('education').content.sub}. The notice board carries the rest.`),
        ],
        next: 'topics',
      },
      more: {
        lines: [
          s(`Degree: ${fact('education', 'Degree')}. Years: ${fact('education', 'Years')}. CGPA: ${fact('education', 'CGPA')}.`),
          s(body('education', 0)),
          s('He turned up to the systems courses the way other students turn up to a hobby. Because it was one.'),
        ],
        next: 'topics',
      },
      nearby: {
        lines: [
          s(`${At('professor', 0)} is ${way('professor', 0)} of the gate, up through the trees. Ravi keeps it.`),
          s(`${At('professor', 1)} is ${way('professor', 1)}, down the road. The post at the gate agrees with me.`),
        ],
        next: 'topics',
      },
      dismissed: {
        lines: [s('Off you go. Mind the chalk dust — it gets everywhere, including the notice board.')],
      },
    },
  }
})()

/* ================================================================== */
/* The harbor warehouse                                                */
/* ================================================================== */

const dockmaster: Tree = (() => {
  const s = voice('dockmaster')
  return {
    id: 'dockmaster',
    entry: [{ node: 'topics' }],
    nodes: {
      intro: {
        lines: [
          s("Mind the crates! Actually — go ahead, push the crates. It's a whole thing.", 'shout'),
          s("Six shipping puzzles. Clear them and the captain's cap is yours."),
        ],
        effects: [{ setFlag: greetFlag('warehouse') }, { setFlag: 'met_dockmaster' }, { xp: 5 }],
        next: 'topics',
      },
      topics: {
        lines: [s('Well? Manifest is not going to read itself.')],
        choices: [...placeTopics(), { text: 'Back to work', next: 'shove_off' }],
      },
      about_place: {
        lines: [
          s('The warehouse is not a chapter — it is the loading bay. Cargo in, cargo out, puzzles in between.'),
          s('The chapters are the buildings with cards on them. This one just has crates.'),
        ],
        next: 'topics',
      },
      more: {
        lines: [
          s('Six shipping puzzles, stacked easy to awful. Push crates onto the marks; you cannot pull.'),
          s("Clear all six and the captain's cap is yours. I have worn it. It suits nobody."),
          s('Undo is there if you jam yourself in. Reset is there for when undo is not enough.'),
        ],
        next: 'topics',
      },
      nearby: {
        lines: [
          s(`${At('dockmaster', 0)} is ${way('dockmaster', 0)} out the door — the pier, the boats, Mira.`),
          s(`${At('dockmaster', 1)} is ${way('dockmaster', 1)} up the road. The finger post on the green says the same.`),
        ],
        next: 'topics',
      },
      shove_off: {
        lines: [s('Right you are. Mind the crates. I mean it this time.')],
      },
    },
  }
})()

/* ================================================================== */
/* The Vault — a covered bench and whoever is minding it               */
/* ================================================================== */

const vault_keeper: Tree = (() => {
  const s = object('Vault Keeper')
  return {
    id: 'vault_keeper',
    entry: [{ node: 'topics' }],
    nodes: {
      intro: {
        lines: [
          s('This one stays covered. A product Naman is building on his own — AI spec-driven from day one.'),
          s("Even I don't know what's under the sheet. Twenty packets might loosen the lock."),
        ],
        effects: [{ setFlag: greetFlag('stealth') }, { xp: 5 }],
        next: 'topics',
      },
      topics: {
        lines: [s('Well? Ask, and I will tell you what little I am allowed.')],
        choices: [...placeTopics(), { text: 'Leave it covered', next: 'leave' }],
      },
      about_place: {
        lines: [
          s(`Under the sheet: ${zone('stealth').content.title}. ${zone('stealth').content.sub}.`),
          s('Every other building here is finished work. This is the room where the next thing gets made.'),
        ],
        next: 'topics',
      },
      more: {
        lines: [
          s('Designed and built outside of work. AI spec-driven from day one — the spec first, then the code.'),
          s('In active development. Details under wraps for now.'),
          s('That is the whole briefing. I would tell you the name if I had been told it.'),
        ],
        next: 'topics',
      },
      nearby: {
        lines: [
          s(`${At('vault_keeper', 0)} is ${way('vault_keeper', 0)} of the ridge — down the ramp, past the signpost.`),
          s(`${At('vault_keeper', 1)} lies ${way('vault_keeper', 1)}, across the meadow.`),
        ],
        next: 'topics',
      },
      leave: {
        lines: [s('Wise. The sheet stays on, and the ridge stays quiet.')],
      },
    },
  }
})()

const cat: Tree = (() => {
  const s = voice('cat')
  return {
    id: 'cat',
    entry: [
      { when: { notFlag: 'met_cat' }, node: 'first' },
      { when: { night: true }, node: 'night' },
      { when: { questDone: 'fishing' }, node: 'friend' },
      { node: 'meow' },
    ],
    nodes: {
      first: {
        lines: [s('Mrow?'), s('(Byte looks at you. Byte looks away. You have been assessed.)')],
        effects: [{ setFlag: 'met_cat' }, { xp: 5 }],
      },
      night: {
        lines: [s('Mrrp... (Byte is a loaf. One eye opens, then shuts. Business hours are over.)')],
      },
      friend: {
        lines: [s("Prrrrp. (Byte winds round your ankles. You are the fish person now. It's official.)", 'happy')],
      },
      meow: {
        lines: [s('Meow. (Byte regards you. It could yet go either way.)')],
      },
    },
  }
})()

/* ================================================================== */
/* Objects — the Cottage                                               */
/* ================================================================== */

const bookshelf: Tree = (() => {
  const s = object('Bookshelf')
  return {
    id: 'bookshelf',
    entry: [{ node: 'read' }],
    nodes: {
      read: {
        lines: [
          s(`Textbooks, mostly. A B.Tech in Computer Science — SRM IST, ${fact('education', 'Years')}.`),
          s(`One spine reads 'CGPA ${fact('about', 'CGPA')}'. Somebody underlined it. Twice.`),
          s("A row of notebooks, each one a spec. Not one of them says 'TODO'."),
        ],
      },
    },
  }
})()

const bed: Tree = (() => {
  const s = object('Bed')
  return {
    id: 'bed',
    entry: [{ node: 'ask' }],
    nodes: {
      ask: {
        lines: [s('The bed looks extremely sleepable. Sleep?')],
        choices: [
          { text: 'Sleep till morning', next: 'morning' },
          { text: 'Nap till night', next: 'night' },
          { text: 'Never mind', next: 'no' },
        ],
      },
      morning: {
        lines: [s('You sleep. Morning arrives, as it does. Gulls, mostly.')],
        effects: [{ sleep: 'morning' }],
        effectsAtEnd: true,
      },
      night: {
        lines: [s('You doze off. When you wake, the lamps are on and the fireflies are out.')],
        effects: [{ sleep: 'night' }],
        effectsAtEnd: true,
      },
      no: {
        lines: [s('Not tired. Fair. The island is not going anywhere.')],
      },
    },
  }
})()

const photo: Tree = (() => {
  const s = object('Photo')
  return {
    id: 'photo',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('A framed photo: the harbor at dusk, the beacon lit. Somebody was happy with this one.')],
      },
    },
  }
})()

const fireplace: Tree = (() => {
  const s = object('Fireplace')
  return {
    id: 'fireplace',
    entry: [{ node: 'warm' }],
    nodes: {
      warm: {
        lines: [s('The fire pops and settles. The warmth reaches exactly as far as the desk chair.')],
      },
    },
  }
})()

const kettle: Tree = (() => {
  const s = object('Kettle')
  return {
    id: 'kettle',
    entry: [{ node: 'tea' }],
    nodes: {
      tea: {
        lines: [s("Just off the boil. It has been 'just off the boil' all day. Schrödinger's tea.")],
      },
    },
  }
})()

/* ================================================================== */
/* Objects — the Workshop                                              */
/* ================================================================== */

const workbench: Tree = (() => {
  const s = object('Workbench')
  return {
    id: 'workbench',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('A written spec lies clamped flat where the vice should be. The contract comes first; the sawdust later.')],
      },
    },
  }
})()

const whiteboard: Tree = (() => {
  const s = object('Whiteboard')
  return {
    id: 'whiteboard',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('Boxes and arrows. Every arrow has exactly one start and one end. Someone was very firm about it.')],
      },
    },
  }
})()

/* ================================================================== */
/* Objects — Safe Stride, the Lighthouse, the Vault                    */
/* ================================================================== */

const sos: Tree = (() => {
  const s = object('SOS Button')
  return {
    id: 'sos',
    entry: [{ node: 'read' }],
    nodes: {
      read: {
        lines: [
          s("A big red button behind glass. Safe Stride's SOS — it fires on its own when a fall is detected."),
          s('An accelerometer feels the fall; the app calls emergency services and pins the spot on a live map.'),
          s("Best left unpressed. It's wired to people who would come running."),
        ],
      },
    },
  }
})()

const lens: Tree = (() => {
  const s = object('The Lens')
  return {
    id: 'lens',
    entry: [
      { when: { questDone: 'beacon' }, node: 'lit' },
      { when: { questActive: 'beacon' }, node: 'ready' },
      { node: 'dark' },
    ],
    nodes: {
      lit: {
        lines: [s('The lens hums, warm as a kettle. The beam swings out over the sea, round and round.')],
      },
      ready: {
        lines: [s('The great lens. Cold, dark, patient. There is a lever, and the lever wants pulling.')],
        choices: [
          { text: 'Light the lens', next: 'light' },
          { text: 'Not yet', next: 'wait' },
        ],
      },
      light: {
        lines: [s('You pull the lever. Somewhere below, something enormous clears its throat.')],
        effects: [{ cutscene: 'beacon' }],
        effectsAtEnd: true,
      },
      wait: {
        lines: [s('The lens waits. It has had practice.')],
      },
      dark: {
        lines: [s('A great glass lens, cold and dark. Keeper Ilse, down at the door, would know about lighting it.')],
      },
    },
  }
})()

const vault_door: Tree = (() => {
  const s = object('Vault Door')
  return {
    id: 'vault_door',
    entry: [
      { when: { packets: 20 }, node: 'open' },
      { node: 'sealed' },
    ],
    nodes: {
      sealed: {
        lines: [
          s('A door in the cliff, sealed tight. The seal reads: packets recovered. It wants all twenty.'),
          s('Lost motes hide in tall grass, old chests and odd corners. Sol, at the Engine, keeps count.'),
        ],
      },
      open: {
        lines: [
          s('Twenty of twenty. The seal clicks. The door grinds open.'),
          s("Inside: a workbench, a covered prototype, and a note — 'details under wraps for now'."),
        ],
        effects: [{ panel: 'zone:stealth' }],
        effectsAtEnd: true,
      },
    },
  }
})()

/* ================================================================== */
/* Objects — out on the island                                         */
/* ================================================================== */

const telescope: Tree = (() => {
  const s = object('Telescope')
  return {
    id: 'telescope',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [
          s('The whole island, edge to edge. The Stream glitters all the way down to the sea.'),
          s('You can see the Lighthouse from here. On a clear day, the Lighthouse can see you.'),
        ],
        effects: [{ achievement: 'summit' }],
      },
    },
  }
})()

const fountain: Tree = (() => {
  const s = object('Fountain')
  return {
    id: 'fountain',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [
          s('Coins shine on the bottom. Somebody wished for exactly-once delivery.'),
          s('The water goes round and round and never loses a drop. Sol would approve.'),
        ],
      },
    },
  }
})()

const well: Tree = (() => {
  const s = object('Well')
  return {
    id: 'well',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('Deep. You drop a pebble and count to four. Nothing yet.'), s("A note on the bucket: 'NOT a data lake.'")],
      },
    },
  }
})()

const stall: Tree = (() => {
  const s = object("Lou's Stall")
  return {
    id: 'stall',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [
          s("Buns, loaves, and a tray of something golden. A chalkboard: 'Rumours free with every bun.'"),
          s('Lou is watching you not buy a bun.'),
        ],
      },
    },
  }
})()

const boat: Tree = (() => {
  const s = object('Boat')
  return {
    id: 'boat',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('The boat that brought you here. It bobs. It waits.'), s('It is not leaving without you. That is the contract.')],
      },
    },
  }
})()

const mailbox: Tree = (() => {
  const s = object('Mailbox')
  return {
    id: 'mailbox',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('No new mail. The Stream delivers faster anyway.')],
      },
    },
  }
})()

const bell: Tree = (() => {
  const s = object('Bell')
  return {
    id: 'bell',
    entry: [{ node: 'ring' }],
    nodes: {
      ring: {
        lines: [s('CLANG.'), s('The gulls file a formal complaint.')],
        effects: [{ sfx: 'bell' }],
      },
    },
  }
})()

/* ================================================================== */

export const NPC_TREES: Record<string, Tree> = {
  mira,
  tomas,
  pip,
  lou,
  ada,
  ravi,
  sol,
  devi,
  arjun,
  ilse,
  professor,
  dockmaster,
  naman,
  cat,
  vault_keeper,
  bookshelf,
  bed,
  photo,
  fireplace,
  kettle,
  workbench,
  whiteboard,
  sos,
  lens,
  vault_door,
  telescope,
  fountain,
  well,
  stall,
  boat,
  mailbox,
  bell,
}
