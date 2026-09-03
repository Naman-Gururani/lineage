// Bo's Word Puzzle — the pure rules behind the six rows.
//
// Everything the renderer draws is decided here: which word is up, how a guess
// scores against duplicated letters, what colour each key ends up, and the two
// ways a lost board re-opens (a fresh word, or the Hire-me seventh row).
import { describe, expect, it } from 'vitest'

import { ZONES } from '../src/data/content'
import { wordSet } from '../src/data/wordlist'
import {
  MAX_HINTS,
  MAX_ROWS,
  WORD_LEN,
  backspace,
  extraRow,
  hint,
  keyStates,
  newGame,
  pickAnswer,
  scoreGuess,
  submit,
  typeLetter,
  wordleAnswers,
  type Mark,
} from '../src/games/wordle'

/** Every chip and group item, across every zone — the tech half of the pool. */
const TECH_ITEMS = ZONES.flatMap((z) => [...(z.content.chips ?? []), ...(z.content.groups ?? []).flatMap((g) => g.items)])
const wordsIn = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean)

/**
 * The résumé's running prose — titles, subs, body copy, facts and points —
 * flattened the same way `tests/content.test.ts` flattens `ZONES`, but never
 * the chips or group items: those are `TECH_ITEMS` above, not prose.
 */
const CORPUS = new Set(
  wordsIn(
    ZONES.flatMap((z) => [
      z.content.title,
      z.content.sub ?? '',
      ...(z.content.body ?? []),
      ...(z.content.points ?? []),
      ...(z.content.facts ?? []).flatMap((f) => [f.k, f.v]),
    ]).join(' '),
  ),
)

/** Type a whole word into the current row. */
const typeWord = (s: ReturnType<typeof newGame>, word: string) => [...word].reduce(typeLetter, s)
/** Type and submit a word against a dictionary that accepts everything. */
const play = (s: ReturnType<typeof newGame>, word: string) => submit(typeWord(s, word), () => true).state

/** A tiny deterministic PRNG (a linear congruential generator), so a test that
 * wants "seeded" randomness gets the same 200 picks on every run. */
const makeRnd = (seed: number): (() => number) => {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

describe('wordle answers', () => {
  it('takes every answer from a tech item or the résumé prose, never from a list of its own', () => {
    const answers = wordleAnswers()
    expect(answers.length).toBeGreaterThanOrEqual(8)
    for (const a of answers) {
      expect(a, `${a} is not five lower-case letters`).toMatch(/^[a-z]{5}$/)
      const fromTech = TECH_ITEMS.some((item) => wordsIn(item).includes(a))
      expect(fromTech || CORPUS.has(a), `${a} is neither a tech item nor a word the résumé actually says`).toBe(true)
    }
  })

  it('misses no five-letter tech item, and lists each answer once', () => {
    const answers = wordleAnswers()
    const wanted = TECH_ITEMS.flatMap(wordsIn).filter((w) => w.length === WORD_LEN)
    for (const w of wanted) expect(answers).toContain(w)
    expect(new Set(answers).size).toBe(answers.length)
  })

  it('still has the four tools it always had', () => {
    const answers = wordleAnswers()
    for (const w of ['kafka', 'flink', 'redis', 'linux']) expect(answers).toContain(w)
  })

  it('is the résumé Naman actually has today, tools and prose alike', () => {
    // A consequence of `content.ts`, not a constant: change the résumé and this
    // line is the one that tells you the puzzle changed with it. Sorted, because
    // the order tokens are discovered in is an implementation detail, not a rule.
    expect([...wordleAnswers()].sort()).toEqual(['event', 'flink', 'kafka', 'linux', 'money', 'redis', 'scale', 'stack', 'trust'])
  })
})

describe('pickAnswer', () => {
  it('lets ?word= force the answer, case-insensitively, whatever rnd or avoid say', () => {
    const zero = () => 0
    expect(pickAnswer(0, 'crane')).toBe('crane')
    expect(pickAnswer(0, 'CRANE')).toBe('crane')
    expect(pickAnswer(0, 'crane', zero, 'crane')).toBe('crane')
  })

  it('falls back to the pool on anything that is not really a five-letter word', () => {
    const zero = () => 0 // lands on the (filtered) pool's first word every time
    const first = wordleAnswers()[0]
    for (const bad of [null, undefined, '', 'cran', 'cranes', 'cr4ne'] as (string | null | undefined)[]) {
      expect(pickAnswer(0, bad, zero)).toBe(first)
    }
  })

  it('stays inside the pool on a real pick', () => {
    const pool = wordleAnswers()
    for (let i = 0; i < 50; i++) expect(pool).toContain(pickAnswer(i))
  })

  it('never returns avoid across 200 picks with a seeded rnd, and covers more than one word', () => {
    const pool = wordleAnswers()
    const avoid = pool[0]
    const rnd = makeRnd(1)
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const picked = pickAnswer(i, null, rnd, avoid)
      expect(picked).not.toBe(avoid)
      seen.add(picked)
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('scoreGuess', () => {
  it('paints a solved row green', () => {
    expect(scoreGuess('kafka', 'kafka')).toEqual<Mark[]>(['g', 'g', 'g', 'g', 'g'])
  })

  it('hands a repeated letter to the green position first', () => {
    // flink has one n, and only the fourth guess letter sits on it.
    expect(scoreGuess('nnnnn', 'flink')).toEqual<Mark[]>(['x', 'x', 'x', 'g', 'x'])
  })

  it('spends each answer letter once, left to right', () => {
    // allee vs eagle: the last e is green, which uses up one of eagle's two es;
    // the first e in allee then takes the other, and the second l finds nothing.
    expect(scoreGuess('allee', 'eagle')).toEqual<Mark[]>(['y', 'y', 'x', 'y', 'g'])
    // sense vs redis: e is green in place, so the trailing e has none left; the
    // first s takes the only s and the second goes grey.
    expect(scoreGuess('sense', 'redis')).toEqual<Mark[]>(['y', 'g', 'x', 'x', 'x'])
  })

  it('greys a guess that shares nothing with the answer', () => {
    expect(scoreGuess('mopsy', 'flink')).toEqual<Mark[]>(['x', 'x', 'x', 'x', 'x'])
  })
})

describe('keyStates', () => {
  it('keeps the best news about a letter, whichever row it arrived in', () => {
    const yellowFirst = keyStates([
      { guess: 'aback', marks: ['y', 'x', 'x', 'x', 'g'] },
      { guess: 'kafka', marks: ['g', 'g', 'x', 'x', 'y'] },
    ])
    expect(yellowFirst.a).toBe('g')
    expect(yellowFirst.k).toBe('g')
    expect(yellowFirst.b).toBe('x')
    // …and a later grey never argues a letter back down.
    const greenFirst = keyStates([
      { guess: 'kafka', marks: ['g', 'g', 'x', 'x', 'y'] },
      { guess: 'aback', marks: ['y', 'x', 'x', 'x', 'g'] },
    ])
    expect(greenFirst.a).toBe('g')
    expect(greenFirst.c).toBe('x')
  })

  it('says nothing about letters nobody has guessed', () => {
    expect(keyStates([]).q).toBeUndefined()
  })
})

describe('typing', () => {
  it('fills the row up to five letters and no further', () => {
    const s = typeWord(newGame('kafka'), 'kafkas')
    expect(s.current).toBe('kafka')
    expect(s.current.length).toBe(WORD_LEN)
  })

  it('takes letters in any case and ignores everything else', () => {
    // the space, the hyphen and the digit are dropped; K, a and f are not.
    expect(typeWord(newGame('kafka'), 'K a-4f').current).toBe('kaf')
  })

  it('rubs out the last letter, and does nothing on an empty row', () => {
    expect(backspace(typeWord(newGame('kafka'), 'kaf')).current).toBe('ka')
    expect(backspace(newGame('kafka')).current).toBe('')
  })

  it('leaves a finished board alone', () => {
    const won = play(newGame('kafka'), 'kafka')
    expect(won.status).toBe('won')
    expect(typeLetter(won, 'a').current).toBe('')
    expect(backspace(won)).toBe(won)
  })
})

describe('submit', () => {
  const dict = (w: string) => ['crane', 'slate', 'sense'].includes(w)

  it('refuses a short row without spending it', () => {
    const s = typeWord(newGame('kafka'), 'cran')
    const out = submit(s, dict)
    expect(out.error).toBe('short')
    expect(out.state).toBe(s)
    expect(out.state.rows).toHaveLength(0)
  })

  it('refuses a word the dictionary has never heard of', () => {
    const s = typeWord(newGame('kafka'), 'zzzzz')
    const out = submit(s, dict)
    expect(out.error).toBe('notword')
    expect(out.state.rows).toHaveLength(0)
    expect(out.state.current).toBe('zzzzz')
  })

  it('always takes the answer, whatever the dictionary thinks of it', () => {
    expect(dict('kafka')).toBe(false)
    const out = submit(typeWord(newGame('kafka'), 'kafka'), dict)
    expect(out.error).toBeUndefined()
    expect(out.state.status).toBe('won')
  })

  it('scores an accepted guess into a row and clears the line', () => {
    const out = submit(typeWord(newGame('kafka'), 'crane'), dict)
    expect(out.error).toBeUndefined()
    expect(out.state.current).toBe('')
    expect(out.state.rows).toEqual([{ guess: 'crane', marks: scoreGuess('crane', 'kafka') }])
    expect(out.state.status).toBe('play')
  })

  it('loses on the sixth wrong row', () => {
    let s = newGame('kafka')
    for (let i = 0; i < MAX_ROWS; i++) {
      expect(s.status).toBe('play')
      s = play(s, 'crane')
    }
    expect(s.rows).toHaveLength(MAX_ROWS)
    expect(s.status).toBe('lost')
    expect(submit(typeWord(s, 'kafka'), dict).state.rows).toHaveLength(MAX_ROWS)
  })
})

describe('hints', () => {
  it('reveals the answer left to right, and stops after three', () => {
    let s = newGame('kafka')
    expect(s.hints).toEqual([])
    s = hint(s)
    expect(s.hints).toEqual(['k'])
    s = hint(s)
    expect(s.hints).toEqual(['k', 'a'])
    s = hint(s)
    expect(s.hints).toEqual(['k', 'a', 'f'])
    expect(s.hints).toHaveLength(MAX_HINTS)
    const spent = hint(s)
    expect(spent.hints).toEqual(['k', 'a', 'f'])
    expect(spent).toBe(s)
  })

  it('has nothing left to give once the board is finished', () => {
    const won = play(newGame('kafka'), 'kafka')
    expect(hint(won)).toBe(won)
  })
})

describe('the Hire-me row', () => {
  it('re-opens a lost board with one more try', () => {
    let s = newGame('kafka')
    for (let i = 0; i < MAX_ROWS; i++) s = play(s, 'crane')
    expect(s.status).toBe('lost')

    const extra = extraRow(s)
    expect(extra.maxRows).toBe(MAX_ROWS + 1)
    expect(extra.status).toBe('play')
    expect(extra.rows).toEqual(s.rows)

    const rescued = play(extra, 'kafka')
    expect(rescued.status).toBe('won')
    expect(rescued.rows).toHaveLength(MAX_ROWS + 1)
  })

  it('closes again on the row it bought', () => {
    let s = newGame('kafka')
    for (let i = 0; i < MAX_ROWS; i++) s = play(s, 'crane')
    s = play(extraRow(s), 'slate')
    expect(s.status).toBe('lost')
  })

  it('never re-opens a board that was won', () => {
    const won = play(newGame('kafka'), 'kafka')
    expect(extraRow(won)).toBe(won)
  })
})

describe('the guess dictionary', () => {
  it('is the whole allowed-guess list, and every answer is in it', () => {
    const words = wordSet()
    expect(words.size).toBeGreaterThanOrEqual(14850)
    for (const w of words) {
      if (!/^[a-z]{5}$/.test(w)) throw new Error(`dictionary entry is not a five-letter word: ${JSON.stringify(w)}`)
    }
    for (const a of wordleAnswers()) expect(words.has(a), `${a} is not a legal guess`).toBe(true)
  })
})
