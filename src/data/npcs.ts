// Dialogue for Lineage Isle — sixteen trees, a handful of fixed lines each.
//
// The v3 rule, enforced by `tests/dialogue-data.test.ts`: **nobody reads out a
// figure.** Every résumé fact belongs to a card (`panel: 'zone:<id>'`), where it
// can be read twice and copied; a dialogue box only gets the sentence that makes
// you want to open the card. No topic lists, no "tell me more", no talking
// scenery — three boxes a node, and out.
//
// Bo (`dockmaster`) is the guide. His `entry` ladder reads the chapters you have
// *not* unlocked yet (`Cond.locked`) and always points at the next one, so the
// same villager carries the whole story without a single quest flag of his own.
//
// Two other things live here:
//   ROOM_HOSTS  who greets you inside each interior — `intro` is the auto-greet
//               node `InteriorScene` runs on your first visit, deliberately kept
//               out of `entry` so an outdoor chat never opens with an indoor line
//   greetFlag   the save flag that remembers a room has introduced itself
import type { Emote, Line, Tree } from '../systems/Dialogue'

export const NPC_INFO: Record<string, { name: string; face: string }> = {
  mira: { name: 'Captain Mira', face: 'face_mira' },
  tomas: { name: 'Old Tomas', face: 'face_tomas' },
  pip: { name: 'Pip', face: 'face_pip' },
  ada: { name: 'Ada', face: 'face_ada' },
  ravi: { name: 'Tinker Ravi', face: 'face_ravi' },
  sol: { name: 'Operator Sol', face: 'face_sol' },
  arjun: { name: 'Arjun', face: 'face_arjun' },
  ilse: { name: 'Keeper Ilse', face: 'face_ilse' },
  professor: { name: 'Prof. Iyer', face: 'face_professor' },
  dockmaster: { name: 'Bo', face: 'face_dockmaster' },
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
/* Hosts                                                               */
/* ================================================================== */

/**
 * The voice that greets you the first time you step into an interior. The Vault
 * has no entry at all: a covered bench on a quiet ridge needs no greeter, and
 * `InteriorScene.maybeGreetHost` simply finds nothing to run.
 */
export const ROOM_HOSTS: Record<string, string> = {
  about: 'naman',
  experience: 'ada',
  skills: 'ravi',
  fair: 'sol',
  safestride: 'arjun',
  campus: 'professor',
  warehouse: 'mira',
  contact: 'ilse',
}

/** The save flag that remembers a room has already introduced itself. */
export const greetFlag = (room: string): string => `greet_${room}`

/* ================================================================== */
/* Bo — the guide                                                      */
/* ================================================================== */

/**
 * The whole story spine, expressed as an entry ladder. Bo never asks what you
 * have done; he looks at which chapter is still locked and says where to go.
 * `intro` is the arrival cutscene (WorldScene runs it directly, like a room
 * greeting) and is the one node authored at three boxes.
 */
const dockmaster: Tree = (() => {
  const s = voice('dockmaster')
  return {
    id: 'dockmaster',
    entry: [
      { when: { flag: 'story_done' }, node: 'done' },
      { when: { locked: 'experience' }, node: 'puzzle_again' },
      // All three prizes, not just the mystery box: catching one of them and
      // leaving the tent used to send Bo on to the campus, and the two projects
      // still on Sol's shelf were never mentioned again.
      { when: { locked: 'lineage' }, node: 'to_fair' },
      { when: { locked: 'safestride' }, node: 'to_fair' },
      { when: { locked: 'stealth' }, node: 'to_fair' },
      { when: { locked: 'education' }, node: 'to_campus' },
      { when: { locked: 'skills' }, node: 'to_workshop' },
      { node: 'to_lighthouse' },
    ],
    nodes: {
      intro: {
        lines: [
          s("Welcome to Lineage Isle. I'm Bo — I run the docks.", 'happy'),
          s("This whole island is Naman's résumé. Every building is a chapter, and I know the way round."),
          s("Here's the man himself."),
        ],
        // The About card opens as the last line lands, not over the middle of it.
        effects: [{ setFlag: 'met_dockmaster' }, { xp: 20 }, { panel: 'zone:about' }],
        effectsAtEnd: true,
        next: 'puzzle',
      },
      puzzle: {
        lines: [
          s("Now, a favour. I've been stuck on this word puzzle all morning — five letters, six tries.", 'think'),
          s("Crack it and I'll tell you what he actually does at the bank."),
        ],
        choices: [
          { text: "Let's solve it", next: 'play' },
          { text: 'Maybe later', next: 'later' },
        ],
      },
      play: {
        lines: [s('Five letters. Six tries. Go on.')],
        effects: [{ minigame: 'wordle' }],
        effectsAtEnd: true,
      },
      later: {
        lines: [s("It'll keep. I'm not going anywhere.")],
      },
      puzzle_again: {
        lines: [s("Puzzle's still open whenever you want it.")],
        choices: [
          { text: 'Try the puzzle', next: 'play' },
          { text: 'Not now', next: 'later' },
        ],
      },
      to_fair: {
        lines: [
          s("The lift in Barclays Tower is yours now — every floor's a year he worked there.", 'happy'),
          s("Next: west along the shore. Sol's prize tent on the fairground has his projects, three of them."),
        ],
      },
      to_campus: {
        lines: [s("North to the campus, on the green. The professor's got a flight test for you.")],
      },
      to_workshop: {
        lines: [s("Ravi's workshop is north-east, past the woods. Spell out what Naman knows.")],
      },
      to_lighthouse: {
        lines: [s('Last stop: the lighthouse on the Point, east along the fields. Send him a signal.')],
      },
      done: {
        lines: [s("That's the whole story. Explore all you like — Mira's crew has a game going in the old warehouse.", 'happy')],
      },
    },
  }
})()

/* ================================================================== */
/* Room hosts — one greeting, one line for every visit after it        */
/* ================================================================== */

const naman: Tree = (() => {
  const s = voice('naman')
  return {
    id: 'naman',
    entry: [{ node: 'talk' }],
    nodes: {
      intro: {
        lines: [s("You found my place. Bo's given you the headlines — the desk has the rest.", 'happy')],
        effects: [{ setFlag: greetFlag('about') }, { xp: 20 }],
      },
      talk: {
        lines: [s('Make yourself at home. The desk has the long version whenever you want it.')],
      },
    },
  }
})()

const ada: Tree = (() => {
  const s = voice('ada')
  return {
    id: 'ada',
    entry: [
      { when: { locked: 'experience' }, node: 'pass' },
      { node: 'lift' },
    ],
    nodes: {
      intro: {
        lines: [
          s('Barclays Tower — reception. Ada.'),
          s('The lift is the story here: every floor a year he worked in this building.'),
        ],
        effects: [{ setFlag: greetFlag('experience') }, { xp: 5 }],
      },
      pass: {
        lines: [s('The lift needs a visitor pass — Bo hands them out at the pier.')],
      },
      lift: {
        lines: [s('The lift is yours. Ground floor is reception; the top floor is today.')],
      },
    },
  }
})()

const sol: Tree = (() => {
  const s = voice('sol')
  return {
    id: 'sol',
    entry: [{ node: 'talk' }],
    nodes: {
      // Sol works the tent flap as well as the floor, so the greeting pays
      // nothing: you can meet him out on the fairground first.
      intro: {
        lines: [
          s("Roll up, roll up! Sol's Prize Tent — three prizes, and every one of them something Naman built.", 'shout'),
          s('The claw is loaded. Win one and the card is yours to keep.'),
        ],
        effects: [{ setFlag: greetFlag('fair') }],
      },
      talk: {
        lines: [s('Everything on that shelf is a project of his.')],
        choices: [
          { text: 'What are the prizes?', next: 'prizes' },
          { text: 'Maybe later', next: 'bye' },
        ],
      },
      prizes: {
        lines: [s("The big one's his day job. The small one's a college project that shipped. The mystery box is a secret.", 'wink')],
      },
      bye: {
        lines: [s("Claw's over there whenever you fancy it.")],
      },
    },
  }
})()

const professor: Tree = (() => {
  const s = voice('professor')
  return {
    id: 'professor',
    entry: [{ node: 'talk' }],
    nodes: {
      intro: {
        lines: [
          s("Naman's transcript is on the notice board — but first, my flight test."),
          s('Fly the chalkboard course and the board is yours.'),
        ],
        effects: [{ setFlag: greetFlag('campus') }, { xp: 5 }],
      },
      talk: {
        lines: [s('Office hours never close. The chalkboard course is waiting whenever you are.')],
      },
    },
  }
})()

const ravi: Tree = (() => {
  const s = voice('ravi')
  return {
    id: 'ravi',
    entry: [{ node: 'talk' }],
    nodes: {
      intro: {
        lines: [s("Every tool on these walls is something Naman actually uses. Spell them out at the bench and I'll hang them up.")],
        effects: [{ setFlag: greetFlag('skills') }, { xp: 5 }],
      },
      talk: {
        lines: [s('Bench is over there. Spell a tool, I hang it on the wall. That is the arrangement.')],
      },
    },
  }
})()

const mira: Tree = (() => {
  const s = voice('mira')
  return {
    id: 'mira',
    entry: [{ node: 'talk' }],
    nodes: {
      intro: {
        lines: [s('Welcome to the arcade. My crew built this one — last bean standing wins.', 'happy')],
        effects: [{ setFlag: greetFlag('warehouse') }, { xp: 5 }, { startQuest: 'crew' }],
      },
      talk: {
        lines: [s("Cabinet's warm. Mind the floor — it goes out from under you.")],
      },
    },
  }
})()

const arjun: Tree = (() => {
  const s = voice('arjun')
  return {
    id: 'arjun',
    entry: [{ node: 'talk' }],
    nodes: {
      // Arjun stands out in the fields too, so the greeting pays nothing.
      intro: {
        lines: [
          s('This clinic is Safe Stride — his college project.'),
          s("The full story's a prize at Sol's tent; the screen shows it once you've won it."),
        ],
        effects: [{ setFlag: greetFlag('safestride') }],
      },
      talk: {
        lines: [s('Fall detection, live map, an SOS that sends itself. My nana wears it.')],
      },
    },
  }
})()

/* ================================================================== */
/* The three errands — the offer, the hand-over, and a word after      */
/* ================================================================== */

const ilse: Tree = (() => {
  const s = voice('ilse')
  return {
    id: 'ilse',
    entry: [
      { when: { questDone: 'beacon' }, node: 'lit' },
      { node: 'offer' },
    ],
    nodes: {
      // Ilse keeps the door as well as the stairs; the lamp room gets the
      // greeting, and it pays nothing — she is met outdoors just as often.
      intro: {
        lines: [s('The last chapter. Light the lens and the island can send word to Naman himself.')],
        effects: [{ setFlag: greetFlag('contact') }],
      },
      offer: {
        lines: [
          s('Keeper Ilse. I keep the lighthouse — mostly I keep the stairs, the light has been out a while.'),
          s('Climb up and light the lens. A lit beacon says: come and say hello.'),
        ],
        effects: [{ startQuest: 'beacon' }],
      },
      lit: {
        lines: [s('Round and round, all night. I had forgotten the sound of it.', 'happy')],
      },
    },
  }
})()

const tomas: Tree = (() => {
  const s = voice('tomas')
  return {
    id: 'tomas',
    entry: [
      { when: { questDone: 'fishing' }, node: 'done' },
      { when: { questActive: 'fishing', item: ['fish', 3] }, node: 'turnin' },
      { node: 'offer' },
    ],
    nodes: {
      offer: {
        lines: [
          s('Tomas. Fished off this pier since before it was a pier.', 'think'),
          s('Take the spare rod. End of the pier, press E and wait — three fish make a supper.'),
        ],
        effects: [{ startQuest: 'fishing' }],
      },
      turnin: {
        lines: [
          s('Three fat ones. Byte has been circling your ankles since the second.', 'happy'),
          s('You have been adopted, I would say. Cats know.'),
        ],
        effects: [{ take: ['fish', 3] }, { advanceQuest: ['fishing', 'return', 1] }, { companion: true }],
        effectsAtEnd: true,
      },
      done: {
        lines: [s('Byte still with you? Thought so. Come and sit some time.')],
      },
    },
  }
})()

const pip: Tree = (() => {
  const s = voice('pip')
  return {
    id: 'pip',
    entry: [
      { when: { questDone: 'shells' }, node: 'done' },
      { when: { questActive: 'shells', item: ['shell', 5] }, node: 'turnin' },
      { node: 'offer' },
    ],
    nodes: {
      offer: {
        lines: [
          s("Hi! I'm Pip. I collect shells, but none of mine are the good ones.", 'sad'),
          s('The good ones are down the beach — shiny, sticky-out. Find five for me?'),
        ],
        effects: [{ startQuest: 'shells' }],
      },
      turnin: {
        lines: [
          s('These are the best ones anyone has ever found!', 'shout'),
          s("I made you a hat. It's mostly shells. Wear it always.", 'happy'),
        ],
        effects: [{ take: ['shell', 5] }, { advanceQuest: ['shells', 'return', 1] }],
        effectsAtEnd: true,
      },
      done: {
        lines: [s("Still got the hat? You don't have to wear the hat. Please wear the hat.", 'wink')],
      },
    },
  }
})()

const cat: Tree = (() => {
  const s = voice('cat')
  return {
    id: 'cat',
    entry: [{ node: 'meow' }],
    nodes: {
      meow: {
        lines: [s('Mrrp.')],
      },
    },
  }
})()

/* ================================================================== */
/* The four objects that still have something to say                   */
/* ================================================================== */

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

/**
 * The lamp-room lens. Lighting it is Ilse's errand; *sending a signal* is the
 * Contact chapter, and that is offered whether the beacon burns or not — the
 * one chapter the story never gates.
 */
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
        choices: [
          { text: 'Send a signal?', next: 'signal' },
          { text: 'Just watch it turn', next: 'watch' },
        ],
      },
      ready: {
        lines: [s('Cold, dark, patient. There is a lever, and the lever wants pulling.')],
        choices: [
          { text: 'Light the lens', next: 'light' },
          { text: 'Send a signal?', next: 'signal' },
        ],
      },
      dark: {
        lines: [s('A great glass lens, cold and dark. Keeper Ilse would know about lighting it.')],
        choices: [
          { text: 'Send a signal?', next: 'signal' },
          { text: 'Leave it be', next: 'watch' },
        ],
      },
      light: {
        lines: [s('You pull the lever. Somewhere below, something enormous clears its throat.')],
        effects: [{ cutscene: 'beacon' }],
        effectsAtEnd: true,
      },
      signal: {
        lines: [s('The beam swings out and takes his address with it — mail, code, and a place to say hello.')],
        effects: [{ unlockFacet: 'contact' }, { panel: 'zone:contact' }],
        effectsAtEnd: true,
      },
      watch: {
        lines: [s('The sea keeps its own time. So does the lens.')],
      },
    },
  }
})()

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
          s('Sealed. The lock wants twenty packets.'),
          s('Lost motes hide in tall grass, old chests and odd corners.'),
        ],
      },
      open: {
        lines: [
          s('Twenty of twenty. The seal clicks, and the door grinds open.'),
          s('Inside: a workbench, a covered prototype, and a note that gives nothing away.'),
        ],
        effects: [{ panel: 'zone:stealth' }],
        effectsAtEnd: true,
      },
    },
  }
})()

/* ================================================================== */

export const NPC_TREES: Record<string, Tree> = {
  dockmaster,
  naman,
  ada,
  sol,
  professor,
  ravi,
  mira,
  ilse,
  tomas,
  pip,
  arjun,
  cat,
  bed,
  lens,
  telescope,
  vault_door,
}

/** The whole cast, in story order — the list `tests/dialogue-data.test.ts` pins. */
export const STORY_TREE_IDS = Object.keys(NPC_TREES)
