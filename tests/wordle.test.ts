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

/** Every skill the audit approved, exactly as `content.ts` lists it. */
const SKILL_ITEMS = ZONES.find((z) => z.id === 'skills')!.content.groups!.flatMap((g) => g.items)
const wordsIn = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean)

/** Type a whole word into the current row. */
const typeWord = (s: ReturnType<typeof newGame>, word: string) => [...word].reduce(typeLetter, s)
/** Type and submit a word against a dictionary that accepts everything. */
const play = (s: ReturnType<typeof newGame>, word: string) => submit(typeWord(s, word), () => true).state

describe('wordle answers', () => {
  it('takes every answer from an approved skill, never from a list of its own', () => {
    const answers = wordleAnswers()
    expect(answers.length).toBeGreaterThan(0)
    for (const a of answers) {
      expect(a, `${a} is not five lower-case letters`).toMatch(/^[a-z]{5}$/)
      expect(SKILL_ITEMS.some((item) => wordsIn(item).includes(a)), `${a} is in no approved skill`).toBe(true)
    }
  })

  it('misses no five-letter skill word, and lists each one once', () => {
    const answers = wordleAnswers()
    const wanted = SKILL_ITEMS.flatMap(wordsIn).filter((w) => w.length === WORD_LEN)
    for (const w of wanted) expect(answers).toContain(w)
    expect(new Set(answers).size).toBe(answers.length)
  })

  it('is the stack Naman actually works on today', () => {
    // A consequence of `content.ts`, not a constant: change the skills and this
    // line is the one that tells you the puzzle changed with them.
    expect(wordleAnswers()).toEqual(['kafka', 'flink', 'redis', 'linux'])
  })

  it('cycles through the answers, one per attempt', () => {
    const a = wordleAnswers()
    expect([0, 1, 2, 3, 4, 5].map((n) => pickAnswer(n))).toEqual([a[0], a[1], a[2], a[3], a[0], a[1]])
  })

  it('lets ?word= force the answer, and ignores anything that is not a word', () => {
    expect(pickAnswer(0, 'crane')).toBe('crane')
    expect(pickAnswer(0, 'CRANE')).toBe('crane')
    expect(pickAnswer(1, null)).toBe(wordleAnswers()[1])
    expect(pickAnswer(1, '')).toBe(wordleAnswers()[1])
    expect(pickAnswer(1, 'cran')).toBe(wordleAnswers()[1])
    expect(pickAnswer(1, 'cranes')).toBe(wordleAnswers()[1])
    expect(pickAnswer(1, 'cr4ne')).toBe(wordleAnswers()[1])
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
