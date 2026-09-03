// Dialogue for Naman's World Fair — eleven trees, a handful of fixed lines each.
//
// The rule, enforced by `tests/dialogue-data.test.ts`: **nobody reads out a
// figure.** Every résumé fact belongs to a card (`panel: 'zone:<id>'`), where it
// can be read twice and copied; a dialogue box only gets the sentence that makes
// you want to open the card. No topic lists, no "tell me more", no talking
// scenery — three boxes a node, and out.
//
// Bo (`dockmaster`) works the ticket window and is the guide. His `entry` ladder
// reads the chapters you have *not* unlocked yet (`Cond.locked`), plus the one
// flag the fair actually gates on (`ticket`), and always points at the next
// thing, so one stallholder carries the whole story.
//
// Naman does not appear as an NPC: his voice is the cards.
import type { Emote, Line, Tree } from '../systems/Dialogue'

export const NPC_INFO: Record<string, { name: string; face: string }> = {
  mira: { name: 'Captain Mira', face: 'face_mira' },
  tomas: { name: 'Old Tomas', face: 'face_tomas' },
  pip: { name: 'Pip', face: 'face_pip' },
  ravi: { name: 'Tinker Ravi', face: 'face_ravi' },
  sol: { name: 'Operator Sol', face: 'face_sol' },
  arjun: { name: 'Arjun', face: 'face_arjun' },
  ilse: { name: 'Keeper Ilse', face: 'face_ilse' },
  professor: { name: 'Prof. Iyer', face: 'face_professor' },
  dockmaster: { name: 'Bo', face: 'face_dockmaster' },
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
/* Interior leftovers — empty, and on their way out                    */
/* ================================================================== */

/**
 * The fair has no interiors, so nothing greets you indoors any more. The table
 * survives as an empty shell only because `scenes/InteriorScene.ts` still
 * imports it; Wave 2 deletes that scene and takes both of these with it.
 * `tests/dialogue-data.test.ts` pins it empty so nothing creeps back in.
 */
export const ROOM_HOSTS: Record<string, string> = {}

/** The save flag that remembered a room had already introduced itself. */
export const greetFlag = (room: string): string => `greet_${room}`

/* ================================================================== */
/* Bo — the gate, the ticket, the guide                                */
/* ================================================================== */

/**
 * The whole story spine, expressed as an entry ladder. Bo never asks what you
 * have done; he looks at which chapter is still locked and says where to go.
 * `intro` is the arrival cutscene (WorldScene runs it directly) and is the one
 * node authored at three boxes.
 *
 * The first rung after `story_done` is the `ticket` flag rather than a chapter:
 * reading the About card at the window does not pay your way through the
 * turnstile — solving the word puzzle does.
 */
const dockmaster: Tree = (() => {
  const s = voice('dockmaster')
  return {
    id: 'dockmaster',
    entry: [
      { when: { flag: 'story_done' }, node: 'done' },
      { when: { notFlag: 'ticket' }, node: 'puzzle_again' },
      { when: { locked: 'experience' }, node: 'to_coaster' },
      // All three prizes, not just one: catching a single prize and leaving the
      // tent used to send Bo on, with two projects still up on Sol's shelf.
      { when: { locked: 'lineage' }, node: 'to_tent' },
      { when: { locked: 'safestride' }, node: 'to_tent' },
      { when: { locked: 'stealth' }, node: 'to_tent' },
      { when: { locked: 'skills' }, node: 'to_forge' },
      { node: 'to_guestbook' },
    ],
    nodes: {
      intro: {
        lines: [
          s("Welcome to Naman's World Fair. I'm Bo — I run the gate.", 'happy'),
          s("Everything in here is a chapter of Naman's résumé, and I know the way round."),
          s("Here's the man himself."),
        ],
        // The About card opens as the last line lands, not over the middle of it.
        effects: [{ setFlag: 'met_dockmaster' }, { xp: 20 }, { panel: 'zone:about' }],
        effectsAtEnd: true,
        next: 'puzzle',
      },
      puzzle: {
        lines: [s("Tickets are one word each. Five letters, six tries — crack it and you're in.", 'think')],
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
        lines: [s("It'll keep. The gate isn't going anywhere.")],
      },
      puzzle_again: {
        lines: [s("Window's still open whenever you want that ticket.")],
        choices: [
          { text: 'Try the puzzle', next: 'play' },
          { text: 'Not now', next: 'later' },
        ],
      },
      to_coaster: {
        lines: [
          s("You're in. Straight up the avenue — the Career Coaster.", 'happy'),
          s('Every hill on that thing is a year of his career. Ride it and you have the lot.'),
        ],
      },
      to_tent: {
        lines: [
          s("West side of the midway: the Prize Tent. Sol's got three prizes on that shelf."),
          s('Every one of them is something Naman built. Win them all.'),
        ],
      },
      to_forge: {
        lines: [s("East side of the midway, the Word Forge. Spell out the tools he actually works with.")],
      },
      to_guestbook: {
        lines: [s('Last stop: the guestbook booth by the exit. Leave the man a word.')],
      },
      done: {
        lines: [s("That's the whole fair. Stay as long as you like — the arcade tent never closes.", 'happy')],
      },
    },
  }
})()

/* ================================================================== */
/* The rides and the stalls — one line, pointing at the game           */
/* ================================================================== */

const professor: Tree = (() => {
  const s = voice('professor')
  return {
    id: 'professor',
    entry: [{ node: 'talk' }],
    nodes: {
      intro: {
        lines: [s('All aboard. Every hill up there is a year of his career.'), s('Ride it whenever you like.')],
      },
      talk: {
        lines: [s('Train comes back round every few minutes. Front seat if you can get it.')],
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
      talk: {
        lines: [s('Roll up, roll up! The claw is loaded — win a prize and the card is yours to keep.', 'shout')],
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
      talk: {
        lines: [s('Spell a tool at the wheel and I light it up on the board. That is the arrangement.')],
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
      talk: {
        lines: [s('Chalk Flight, my booth. Draw a line, hold your nerve, mind the gaps.')],
      },
    },
  }
})()

const mira: Tree = (() => {
  const s = voice('mira')
  return {
    id: 'mira',
    entry: [
      { when: { questDone: 'crew' }, node: 'done' },
      { node: 'offer' },
    ],
    nodes: {
      offer: {
        lines: [s('Arcade tent. My crew built the cabinet — last bean standing wins.', 'happy')],
        effects: [{ startQuest: 'crew' }],
      },
      done: {
        lines: [s("Cabinet's warm and the record's yours. Mind the floor — it still goes out from under you.")],
      },
    },
  }
})()

/* ================================================================== */
/* The three errands — the offer, the hand-over, and a word after      */
/* ================================================================== */

/**
 * Ilse keeps the guestbook booth by the exit; the Contact card is opened at the
 * booth itself, not by her. Her errand only makes sense after dark, so the offer
 * rung is guarded on `night` — by day she just points at the book.
 */
const ilse: Tree = (() => {
  const s = voice('ilse')
  return {
    id: 'ilse',
    entry: [
      { when: { questDone: 'lights' }, node: 'lit' },
      { when: { questActive: 'lights' }, node: 'waiting' },
      { when: { night: true }, node: 'offer' },
      { node: 'talk' },
    ],
    nodes: {
      talk: {
        lines: [s("Keeper Ilse. The book's open — sign it and he'll know you came by.")],
      },
      offer: {
        lines: [
          s('Dusk already, and the fair looks half asleep without its lights.', 'think'),
          s("There's a switch on the side of the ticket booth. Throw it for me?"),
        ],
        effects: [{ startQuest: 'lights' }],
      },
      waiting: {
        lines: [s('The switch is on the ticket booth, round the side. Throw it and the whole midway wakes up.')],
      },
      lit: {
        lines: [s('Every bulb burning. I had forgotten what this place looks like lit up.', 'happy')],
      },
    },
  }
})()

const tomas: Tree = (() => {
  const s = voice('tomas')
  return {
    id: 'tomas',
    entry: [
      { when: { questDone: 'ducks' }, node: 'done' },
      { when: { questActive: 'ducks', item: ['fish', 3] }, node: 'turnin' },
      { node: 'offer' },
    ],
    nodes: {
      offer: {
        lines: [
          s('Tomas. Run this pond since before they put the ducks in it.', 'think'),
          s('Take the pole. Hook three of them and we will call it a fair day.'),
        ],
        effects: [{ startQuest: 'ducks' }],
      },
      turnin: {
        lines: [
          s("Three fat ones. The cat's been circling your ankles since the second.", 'happy'),
          s('You have been adopted, I would say. Cats know.'),
        ],
        effects: [{ take: ['fish', 3] }, { advanceQuest: ['ducks', 'return', 1] }, { companion: true }],
        effectsAtEnd: true,
      },
      done: {
        lines: [s('Cat still with you? Thought so. Come and sit some time.')],
      },
    },
  }
})()

const pip: Tree = (() => {
  const s = voice('pip')
  return {
    id: 'pip',
    entry: [
      { when: { questDone: 'balloons' }, node: 'done' },
      { when: { questActive: 'balloons', item: ['shell', 5] }, node: 'turnin' },
      { node: 'offer' },
    ],
    nodes: {
      offer: {
        lines: [
          s("Hi! I'm Pip, I mind the balloon cart. Half my stock has got away over the lawns.", 'sad'),
          s('They snag in the tall grass and the bunting. Find five for me?'),
        ],
        effects: [{ startQuest: 'balloons' }],
      },
      turnin: {
        lines: [
          s('You found every single one of them!', 'shout'),
          s('I made you a hat out of the spares. Wear it always.', 'happy'),
        ],
        effects: [{ take: ['shell', 5] }, { advanceQuest: ['balloons', 'return', 1] }],
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
/* The one fixture that still has something to say                     */
/* ================================================================== */

/**
 * The turnstile, while the `ticket` flag is unset. WorldScene only offers this
 * tree when the prop is still solid, so it needs exactly one line.
 */
const gate: Tree = (() => {
  const s = object('Turnstile')
  return {
    id: 'gate',
    entry: [{ node: 'locked' }],
    nodes: {
      locked: {
        lines: [s("Ticket first. Bo's window is right there.")],
      },
    },
  }
})()

/* ================================================================== */

export const NPC_TREES: Record<string, Tree> = {
  dockmaster,
  professor,
  sol,
  ravi,
  arjun,
  mira,
  tomas,
  pip,
  ilse,
  cat,
  gate,
}

/** The whole cast, in story order — the list `tests/dialogue-data.test.ts` pins. */
export const STORY_TREE_IDS = Object.keys(NPC_TREES)
