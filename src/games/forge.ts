// Word Forge — the letter wheel at Ravi's bench, with none of the DOM.
//
// The renderer in `ui/minigames/forge.ts` owns the ring, the drag trail and the
// slots; everything that decides *what* is true — which words a round accepts,
// what a submission was worth, how much a hint may give away, when the wall is
// finished — lives here as plain functions over a plain state.
//
// The one thing worth saying twice: this file is a résumé in disguise. Every
// word the wheel can spell is a tool Naman actually works with, and every
// `skill` below is the *exact* string the Workshop card lists. Spelling KAFKA is
// how the player reads that line of the CV, so the two can never be allowed to
// drift — `tests/forge.test.ts` fails the moment they do.
import { makeRng } from '../core/rng'
import { ZONES } from '../data/content'

/** One playable word and the skill it stands for, verbatim from `content.ts`. */
export type ForgeWord = { word: string; skill: string }

/** A wheel and the words it was cut for. */
export type ForgeRound = { ring: string[]; words: ForgeWord[] }

/** Shorter than this is a slip of the finger, not a guess: it costs nothing. */
export const MIN_WORD = 3

/** How much of a round Ravi will give away — two letters, then you are on your own. */
export const FORGE_HINTS = 2

/** Wrong words in one round before the bench offers a way out. */
export const FORGE_MISSES = 6

/**
 * The five wheels.
 *
 * Wordscapes' rule holds on every one of them: the ring carries a letter for
 * each letter of each word, so a player looking at the tiles can always get
 * there — no word needs a letter that is not on the wheel. The rings are
 * deliberately tight (spare letters are the puzzle) and never longer than the
 * nine tiles the ring can lay out and still be tappable on a phone.
 */
export const FORGE_ROUNDS: ForgeRound[] = [
  {
    ring: ['J', 'A', 'A', 'V', 'K', 'K', 'F'],
    words: [
      { word: 'JAVA', skill: 'Java' },
      { word: 'KAFKA', skill: 'Apache Kafka' },
    ],
  },
  {
    ring: ['F', 'L', 'I', 'N', 'K', 'U', 'X'],
    words: [
      { word: 'FLINK', skill: 'Apache Flink' },
      { word: 'LINUX', skill: 'Linux' },
    ],
  },
  {
    ring: ['R', 'E', 'D', 'I', 'S', 'O', 'C', 'K'],
    words: [
      { word: 'REDIS', skill: 'Redis' },
      { word: 'DOCKER', skill: 'Docker' },
    ],
  },
  {
    ring: ['G', 'I', 'T', 'S', 'P', 'R', 'N'],
    words: [
      { word: 'GIT', skill: 'Git' },
      { word: 'SPRING', skill: 'Spring Boot' },
    ],
  },
  {
    ring: ['P', 'Y', 'T', 'H', 'O', 'N', 'S', 'Q', 'L'],
    words: [
      { word: 'PYTHON', skill: 'Python' },
      { word: 'SQL', skill: 'SQL' },
    ],
  },
]

/**
 * Can this ring reach this word? Multiset containment: a doubled letter needs
 * two tiles, which is why round one carries two As and two Ks.
 */
export function canSpell(ring: string[], word: string): boolean {
  const left = new Map<string, number>()
  for (const l of ring) left.set(l, (left.get(l) ?? 0) + 1)
  for (const ch of word) {
    const n = left.get(ch) ?? 0
    if (n <= 0) return false
    left.set(ch, n - 1)
  }
  return true
}

/**
 * The clue a slot shows: the Workshop group the skill is filed under. An empty
 * string for anything the card does not list — the bench has nothing to say
 * about a tool Naman does not claim.
 */
export function groupOf(skill: string): string {
  if (!skill) return ''
  for (const zone of ZONES) {
    if (zone.id !== 'skills') continue
    for (const group of zone.content.groups ?? []) {
      if (group.items.includes(skill)) return group.label
    }
  }
  return ''
}

export type ForgeState = {
  round: number
  /** every word forged so far, across all rounds */
  found: string[]
  /** leading letters given away per word, by 💡 */
  revealed: Record<string, number>
  /** wrong words on *this* round; the round advance wipes it */
  misses: number
  /** ring indices in the order they were dragged or tapped */
  picked: number[]
  status: 'play' | 'won'
}

export type ForgeResult = 'found' | 'dup' | 'miss' | 'short'

export function newForge(): ForgeState {
  return { round: 0, found: [], revealed: {}, misses: 0, picked: [], status: 'play' }
}

/**
 * The wheel currently on the bench. A won game reads the last round rather than
 * off the end of the list: the panel keeps drawing the finished wall for the
 * beat between the last word and the close.
 */
export function roundOf(s: ForgeState): ForgeRound {
  return FORGE_ROUNDS[Math.min(s.round, FORGE_ROUNDS.length - 1)]
}

/** Add a tile to the word being spelled. Each tile is worth exactly one letter. */
export function pick(s: ForgeState, ringIndex: number): ForgeState {
  if (s.status !== 'play') return s
  if (!Number.isInteger(ringIndex) || ringIndex < 0 || ringIndex >= roundOf(s).ring.length) return s
  if (s.picked.includes(ringIndex)) return s
  return { ...s, picked: [...s.picked, ringIndex] }
}

/** Take the last letter back. */
export function unpick(s: ForgeState): ForgeState {
  if (s.status !== 'play' || s.picked.length === 0) return s
  return { ...s, picked: s.picked.slice(0, -1) }
}

/** The word as it stands, read in the order the tiles were picked. */
export function current(s: ForgeState): string {
  const ring = roundOf(s).ring
  return s.picked.map((i) => ring[i] ?? '').join('')
}

/**
 * Every word on the wall forged → the next wheel, with the miss count wiped. A
 * round the player fought through does not follow them to the next one.
 */
function advance(s: ForgeState): ForgeState {
  if (!roundOf(s).words.every((w) => s.found.includes(w.word))) return s
  const round = s.round + 1
  return { ...s, round, misses: 0, picked: [], status: round >= FORGE_ROUNDS.length ? 'won' : 'play' }
}

/**
 * Hand the word in. The bench clears either way — a rejected word is not left
 * sitting there for the player to un-pick letter by letter.
 *
 * Only the round's own words count. There is no dictionary and there does not
 * need to be one: the whole point is that the answers are Naman's tools, so
 * anything else is "not one of Naman's tools" whether it is a word or not.
 */
export function submit(s: ForgeState): { state: ForgeState; result: ForgeResult } {
  if (s.status !== 'play') return { state: s, result: 'short' }
  const word = current(s)
  const cleared = { ...s, picked: [] }
  // Two letters is a mis-drag, not an attempt; charging a miss for it would
  // spend the round's patience on the player's touchscreen.
  if (word.length < MIN_WORD) return { state: cleared, result: 'short' }
  if (!roundOf(s).words.some((w) => w.word === word)) return { state: { ...cleared, misses: s.misses + 1 }, result: 'miss' }
  if (s.found.includes(word)) return { state: cleared, result: 'dup' }
  return { state: advance({ ...cleared, found: [...s.found, word] }), result: 'found' }
}

/** How many 💡 the round has left. Each round starts the budget over. */
export function hintsLeft(s: ForgeState): number {
  if (s.status !== 'play') return 0
  const spent = roundOf(s).words.reduce((n, w) => n + (s.revealed[w.word] ?? 0), 0)
  return Math.max(0, FORGE_HINTS - spent)
}

/**
 * 💡 — one more leading letter, on the slot that is showing the least. Spread
 * over the wall rather than spent on one word, so two hints open two doors a
 * crack instead of one door halfway.
 */
export function hint(s: ForgeState): ForgeState {
  if (s.status !== 'play' || hintsLeft(s) <= 0) return s
  let best: ForgeWord | null = null
  let bestN = Number.POSITIVE_INFINITY
  for (const w of roundOf(s).words) {
    if (s.found.includes(w.word)) continue
    const n = s.revealed[w.word] ?? 0
    if (n >= w.word.length) continue // never spell the word out
    if (n < bestN) {
      best = w
      bestN = n
    }
  }
  if (!best) return s
  return { ...s, revealed: { ...s.revealed, [best.word]: bestN + 1 } }
}

/**
 * What "🤝 Hire me" buys at this bench: a whole word, forged for you — and the
 * round with it, if it was the last one standing.
 */
export function revealWord(s: ForgeState): ForgeState {
  if (s.status !== 'play') return s
  const next = roundOf(s).words.find((w) => !s.found.includes(w.word))
  if (!next) return s
  return advance({ ...s, found: [...s.found, next.word], picked: [] })
}

/**
 * Re-lay the same tiles in a new order. Seeded, so a wheel is reproducible, and
 * copied first — `FORGE_ROUNDS` is the definition and must survive being played.
 */
export function shuffle(ring: string[], seed: number): string[] {
  return makeRng(seed).shuffle([...ring])
}
