// Bo's Word Puzzle — the rules of Wordle, with none of the DOM.
//
// The renderer in `ui/minigames/wordle.ts` owns the tiles, the flip and the
// keyboard; everything that decides *what* is true — the answer up next, the
// colour of every letter, when a board is lost and the two ways it re-opens —
// lives here as plain functions over a plain state. No Phaser, no document, no
// randomness: the same guesses always score the same way, which is what makes
// the whole thing testable in one file.
import { ZONES } from '../data/content'

/** Green: right letter, right place. Yellow: right letter, wrong place. Grey: not in the word. */
export type Mark = 'g' | 'y' | 'x'

export const WORD_LEN = 5
export const MAX_ROWS = 6
/** Bo will point at three letters and no more; past that he may as well type it. */
export const MAX_HINTS = 3

export type Row = { guess: string; marks: Mark[] }

export type WordleState = {
  answer: string
  rows: Row[]
  /** the half-typed row under the last submitted one */
  current: string
  /** the answer's first letters, revealed one press of 💡 at a time */
  hints: string[]
  /** six, or seven once HR has bought a row */
  maxRows: number
  status: 'play' | 'won' | 'lost'
}

/**
 * The answers come out of the résumé, not out of a word list.
 *
 * Most boards are a tool Naman actually works with; a few are a word the
 * résumé's own prose uses instead. Either way beating the puzzle is already
 * reading a chapter of it. That means this list moves whenever `content.ts`
 * moves — which is the point, and why the tests pin the derivation rather
 * than the words it happens to produce today.
 */
let answers: string[] | null = null

const FIVE = /^[a-z]{5}$/

/** "Apache Kafka" is two words and only one of them is a puzzle. */
function addFiveLetterTokens(text: string, into: Set<string>): void {
  for (const token of text.toLowerCase().split(/[^a-z]+/)) {
    if (FIVE.test(token)) into.add(token)
  }
}

/**
 * A handful of résumé words worth a board even though nobody would call them
 * a tool. Each is kept only if `resumeCorpus` actually says it — this is a
 * shortlist to check, never a second source of truth.
 */
const THEMED_WORDS = ['money', 'trust', 'event', 'batch', 'query', 'cloud', 'stack', 'graph', 'spark', 'intern', 'scale']

/**
 * Every word the résumé's running text actually says — titles, subtitles,
 * body copy, facts and points, lower-cased and split on anything that is not
 * a letter — flattened the way `tests/content.test.ts` flattens `ZONES` for
 * its own copy scan. Chips and group items are left out on purpose: those are
 * `wordleAnswers`' other half, gathered below by `addFiveLetterTokens`.
 */
function resumeCorpus(): Set<string> {
  const parts: string[] = []
  for (const { content: c } of ZONES) {
    parts.push(c.title, c.sub ?? '', ...(c.body ?? []), ...(c.points ?? []))
    for (const f of c.facts ?? []) parts.push(f.k, f.v)
  }
  const tokens = new Set<string>()
  for (const token of parts.join(' ').toLowerCase().split(/[^a-z]+/)) {
    if (token) tokens.add(token)
  }
  return tokens
}

export function wordleAnswers(): string[] {
  if (answers) return answers
  const seen = new Set<string>()
  for (const zone of ZONES) {
    for (const chip of zone.content.chips ?? []) addFiveLetterTokens(chip, seen)
    for (const group of zone.content.groups ?? []) {
      for (const item of group.items) addFiveLetterTokens(item, seen)
    }
  }
  const corpus = resumeCorpus()
  for (const word of THEMED_WORDS) {
    if (FIVE.test(word) && corpus.has(word)) seen.add(word)
  }
  answers = [...seen]
  return answers
}

/**
 * Which word is up. A uniform random pick off the whole pool — not the same
 * fixed word every fresh visitor used to get — excluding `avoid` (normally
 * whatever answer just played) so retrying never wheels straight back onto
 * the word the player just had. `attempt` is kept for callers that still
 * count rounds, but no longer drives the pick. `?word=` (undocumented) pins
 * one for a demo or a test, and is honoured only if it is really a word of
 * the right length — a truncated query string must not hand out a puzzle
 * that can never be solved.
 */
export function pickAnswer(attempt: number, override?: string | null, rnd: () => number = Math.random, avoid?: string): string {
  if (override && /^[a-z]{5}$/i.test(override)) return override.toLowerCase()
  const list = wordleAnswers()
  const pool = list.length > 1 ? list.filter((w) => w !== avoid) : list
  return pool[Math.min(Math.floor(rnd() * pool.length), pool.length - 1)]
}

/**
 * Score a guess the way the real game does, in two passes.
 *
 * The order matters for repeated letters: greens claim their answer letter
 * first, and only what is left over can turn a later letter yellow. Score in one
 * pass instead and "allee" against "eagle" paints its first e yellow off the
 * very e that its last e is already sitting on.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const g = guess.toLowerCase()
  const a = answer.toLowerCase()
  const marks: Mark[] = new Array(g.length).fill('x')
  const left = new Map<string, number>()
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) marks[i] = 'g'
    else if (i < a.length) left.set(a[i], (left.get(a[i]) ?? 0) + 1)
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === 'g') continue
    const spare = left.get(g[i]) ?? 0
    if (spare > 0) {
      marks[i] = 'y'
      left.set(g[i], spare - 1)
    }
  }
  return marks
}

/** The keyboard's colouring: the best thing any row has said about each letter. */
export type KeyState = Record<string, Mark>

const RANK: Record<Mark, number> = { x: 0, y: 1, g: 2 }

export function keyStates(rows: Row[]): KeyState {
  const out: KeyState = {}
  for (const row of rows) {
    for (let i = 0; i < row.guess.length; i++) {
      const ch = row.guess[i]
      const mark = row.marks[i]
      if (!mark) continue
      const had = out[ch]
      // A grey never argues a green back down, whatever order the rows arrived in.
      if (!had || RANK[mark] > RANK[had]) out[ch] = mark
    }
  }
  return out
}

export function newGame(answer: string): WordleState {
  return { answer: answer.toLowerCase(), rows: [], current: '', hints: [], maxRows: MAX_ROWS, status: 'play' }
}

export function typeLetter(s: WordleState, ch: string): WordleState {
  if (s.status !== 'play' || s.current.length >= WORD_LEN || !/^[a-z]$/i.test(ch)) return s
  return { ...s, current: s.current + ch.toLowerCase() }
}

export function backspace(s: WordleState): WordleState {
  if (s.status !== 'play' || !s.current) return s
  return { ...s, current: s.current.slice(0, -1) }
}

/**
 * Try the typed row. `isWord` is the dictionary — the answer bypasses it, since
 * a word good enough to be the puzzle is good enough to type, and the renderer
 * runs lenient until the word list has finished loading.
 */
export function submit(s: WordleState, isWord: (w: string) => boolean): { state: WordleState; error?: 'short' | 'notword' } {
  if (s.status !== 'play') return { state: s }
  const guess = s.current
  if (guess.length < WORD_LEN) return { state: s, error: 'short' }
  if (guess !== s.answer && !isWord(guess)) return { state: s, error: 'notword' }
  const rows = [...s.rows, { guess, marks: scoreGuess(guess, s.answer) }]
  const status = guess === s.answer ? 'won' : rows.length >= s.maxRows ? 'lost' : 'play'
  return { state: { ...s, rows, current: '', status } }
}

/** 💡 — Bo points at the next letter he has not pointed at yet. */
export function hint(s: WordleState): WordleState {
  if (s.status !== 'play' || s.hints.length >= MAX_HINTS) return s
  return { ...s, hints: [...s.hints, s.answer[s.hints.length]] }
}

/** The seventh row "Hire me" buys: the board it was lost on, with one more try. */
export function extraRow(s: WordleState): WordleState {
  if (s.status === 'won') return s
  return { ...s, maxRows: s.maxRows + 1, status: 'play' }
}
