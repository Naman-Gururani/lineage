// Word Forge — the letter wheel at Ravi's bench, as pure state.
//
// The game is a résumé in disguise: every word the ring can spell is a tool on
// Naman's actual stack, so the first thing pinned here is that the word list and
// `content.ts` can never drift apart — a skill renamed on the card would
// otherwise leave the bench spelling a tool nobody claims. After that: the
// Wordscapes rule (a ring covers every word of its round), the submit verdicts,
// the per-round hint budget, the Hire-me reveal, and the shuffle.
import { describe, expect, it } from 'vitest'
import { ZONES } from '../src/data/content'
import {
  FORGE_HINTS,
  FORGE_MISSES,
  FORGE_ROUNDS,
  MIN_WORD,
  canSpell,
  current,
  groupOf,
  hint,
  hintsLeft,
  newForge,
  pick,
  revealWord,
  roundOf,
  shuffle,
  submit,
  unpick,
  type ForgeState,
} from '../src/games/forge'

/** The approved skill strings, straight off the Workshop card. */
const SKILL_ITEMS = (ZONES.find((z) => z.id === 'skills')?.content.groups ?? []).flatMap((g) => g.items)

/**
 * Play a word the way a player does: pick the ring indices that spell it, each
 * one only once. Throws rather than silently picking nothing, so a test that
 * mistypes a word fails loudly instead of passing as a miss.
 */
function spell(s: ForgeState, word: string): ForgeState {
  const ring = roundOf(s).ring
  const used = new Set<number>(s.picked)
  let out = s
  for (const ch of word) {
    const i = ring.findIndex((l, idx) => l === ch && !used.has(idx))
    if (i < 0) throw new Error(`ring ${ring.join('')} cannot spell ${word}`)
    used.add(i)
    out = pick(out, i)
  }
  return out
}

/** Spell a word and hand it in. */
const play = (s: ForgeState, word: string) => submit(spell(s, word))

/** Finish the round the state is on, in the order its words are listed. */
function clearRound(s: ForgeState): ForgeState {
  let out = s
  for (const w of roundOf(s).words) if (!out.found.includes(w.word)) out = play(out, w.word).state
  return out
}

describe('forge — the word list is the résumé', () => {
  it('spells only skills that appear verbatim on the Workshop card', () => {
    expect(SKILL_ITEMS.length).toBeGreaterThan(0)
    const strays = FORGE_ROUNDS.flatMap((r) => r.words.map((w) => w.skill)).filter((skill) => !SKILL_ITEMS.includes(skill))
    // The drift guard: rename a skill in content.ts and this is the test that
    // says so, before a player forges a tool the card no longer lists.
    expect(strays).toEqual([])
  })

  it('files every word under the group its skill sits in', () => {
    expect(groupOf('Apache Kafka')).toBe('Streaming & Messaging')
    expect(groupOf('Java')).toBe('Languages & Frameworks')
    expect(groupOf('Docker')).toBe('State & Tooling')
    for (const r of FORGE_ROUNDS) for (const w of r.words) expect(groupOf(w.skill), w.skill).not.toBe('')
  })

  it('has no clue for a tool that is not on the card', () => {
    expect(groupOf('Anvil')).toBe('')
    expect(groupOf('')).toBe('')
  })
})

describe('forge — canSpell', () => {
  it('needs one ring letter per letter of the word', () => {
    expect(canSpell(['J', 'A', 'V'], 'JAVA')).toBe(false)
    expect(canSpell(['J', 'A', 'A', 'V'], 'JAVA')).toBe(true)
  })

  it('does not care where the letters sit in the ring', () => {
    expect(canSpell(['V', 'A', 'J', 'A'], 'JAVA')).toBe(true)
  })

  it('allows spare letters but never a missing one', () => {
    expect(canSpell(['G', 'I', 'T', 'S', 'P', 'R', 'N'], 'GIT')).toBe(true)
    expect(canSpell(['G', 'I', 'T'], 'GRIT')).toBe(false)
  })
})

describe('forge — the rounds', () => {
  it('gives every round a ring that covers every one of its words', () => {
    // The Wordscapes rule: the ring is the word set, so a player who sees the
    // letters can always get there without guessing at letters that are not on
    // the wheel.
    for (const [i, r] of FORGE_ROUNDS.entries())
      for (const w of r.words) expect(canSpell(r.ring, w.word), `round ${i + 1} cannot spell ${w.word}`).toBe(true)
  })

  it('keeps every ring inside the nine tiles the wheel can lay out', () => {
    for (const r of FORGE_ROUNDS) {
      expect(r.ring.length).toBeGreaterThanOrEqual(3)
      expect(r.ring.length).toBeLessThanOrEqual(9)
      for (const l of r.ring) expect(l).toMatch(/^[A-Z]$/)
    }
  })

  it('asks for real words: uppercase, long enough to submit, never repeated', () => {
    const words = FORGE_ROUNDS.flatMap((r) => r.words.map((w) => w.word))
    expect(words.length).toBe(new Set(words).size)
    for (const w of words) {
      expect(w).toMatch(/^[A-Z]+$/)
      expect(w.length).toBeGreaterThanOrEqual(MIN_WORD)
    }
    expect(FORGE_ROUNDS.length).toBe(5)
    for (const r of FORGE_ROUNDS) expect(r.words.length).toBeGreaterThan(0)
  })
})

describe('forge — picking letters', () => {
  it('starts on the first round with nothing picked', () => {
    const s = newForge()
    expect(s).toEqual({ round: 0, found: [], revealed: {}, misses: 0, picked: [], status: 'play' })
    expect(current(s)).toBe('')
  })

  it('appends a letter and reads the word back in pick order', () => {
    let s = newForge()
    s = pick(s, 0) // J
    s = pick(s, 1) // A
    s = pick(s, 3) // V
    s = pick(s, 2) // A
    expect(s.picked).toEqual([0, 1, 3, 2])
    expect(current(s)).toBe('JAVA')
  })

  it('never picks the same tile twice, or one that is not on the wheel', () => {
    let s = pick(newForge(), 0)
    expect(pick(s, 0).picked).toEqual([0])
    expect(pick(s, 7).picked).toEqual([0])
    expect(pick(s, -1).picked).toEqual([0])
    s = pick(s, 1.5)
    expect(s.picked).toEqual([0])
  })

  it('unpicks the last letter, and does nothing on an empty word', () => {
    const s = pick(pick(newForge(), 0), 1)
    expect(current(unpick(s))).toBe('J')
    expect(unpick(unpick(unpick(s))).picked).toEqual([])
  })

  it('leaves the state it was handed alone', () => {
    const s = newForge()
    const next = pick(s, 0)
    expect(s.picked).toEqual([])
    expect(next).not.toBe(s)
    expect(unpick(next)).not.toBe(next)
  })
})

describe('forge — submitting', () => {
  it('forges a word that is one of Naman’s tools', () => {
    const { state, result } = play(newForge(), 'JAVA')
    expect(result).toBe('found')
    expect(state.found).toEqual(['JAVA'])
    expect(state.picked).toEqual([]) // the bench clears for the next word
    expect(state.misses).toBe(0)
    expect(state.round).toBe(0) // KAFKA is still on the wall
  })

  it('says so gently when the word is already forged', () => {
    const once = play(newForge(), 'JAVA').state
    const { state, result } = play(once, 'JAVA')
    expect(result).toBe('dup')
    expect(state.found).toEqual(['JAVA'])
    expect(state.misses).toBe(0)
  })

  it('counts anything else as a miss', () => {
    const { state, result } = play(newForge(), 'JAK')
    expect(result).toBe('miss')
    expect(state.misses).toBe(1)
    expect(state.found).toEqual([])
    expect(state.picked).toEqual([])
  })

  it('counts a tool from another round as a miss, not a find', () => {
    // FLINK belongs to round two; on round one it is just letters — and the
    // round-one ring cannot even reach it.
    let s = newForge()
    s = clearRound(s) // round two, ring F L I N K U X
    const { state, result } = play(s, 'FLU')
    expect(result).toBe('miss')
    expect(state.found).toEqual(['JAVA', 'KAFKA'])
  })

  it('turns a half-spelled word away without charging a miss', () => {
    const { state, result } = submit(pick(pick(newForge(), 0), 1))
    expect(result).toBe('short')
    expect(state.misses).toBe(0)
    expect(state.picked).toEqual([])
    expect(submit(newForge()).result).toBe('short')
  })

  it('moves to the next round once every word on the wall is forged', () => {
    let s = play(newForge(), 'JAVA').state
    s = play(s, 'JAK').state // a miss on the way
    expect(s.misses).toBe(1)
    const { state, result } = play(s, 'KAFKA')
    expect(result).toBe('found')
    expect(state.round).toBe(1)
    expect(state.misses).toBe(0) // a fresh round, a fresh count
    expect(state.status).toBe('play')
    expect(roundOf(state).ring).toEqual(['F', 'L', 'I', 'N', 'K', 'U', 'X'])
    expect(state.found).toEqual(['JAVA', 'KAFKA'])
  })

  it('wins after the last round, and stops taking input', () => {
    let s = newForge()
    for (let i = 0; i < FORGE_ROUNDS.length; i++) s = clearRound(s)
    expect(s.status).toBe('won')
    expect(s.round).toBe(FORGE_ROUNDS.length)
    expect(s.found.length).toBe(FORGE_ROUNDS.flatMap((r) => r.words).length)
    // Won is won: the wheel is inert while the panel plays out the win.
    expect(pick(s, 0)).toBe(s)
    expect(submit(s).state).toBe(s)
    expect(hint(s)).toBe(s)
    expect(revealWord(s)).toBe(s)
    expect(roundOf(s)).toBe(FORGE_ROUNDS[FORGE_ROUNDS.length - 1]) // no reading off the end
  })

  it('lets a round run past the miss threshold — the gag is the panel’s call', () => {
    let s = newForge()
    for (let i = 0; i < FORGE_MISSES + 2; i++) s = play(s, 'JAK').state
    expect(s.misses).toBe(FORGE_MISSES + 2)
    expect(s.status).toBe('play')
  })
})

describe('forge — hints', () => {
  it('reveals the leading letters of the first unfound word', () => {
    let s = newForge()
    s = hint(s)
    expect(s.revealed).toEqual({ JAVA: 1 })
    s = hint(s)
    // The second hint goes to the word with the fewest letters showing.
    expect(s.revealed).toEqual({ JAVA: 1, KAFKA: 1 })
  })

  it('spends at most two on a round, and refills on the next one', () => {
    let s = newForge()
    expect(hintsLeft(s)).toBe(FORGE_HINTS)
    s = hint(hint(s))
    expect(hintsLeft(s)).toBe(0)
    const spent = s
    expect(hint(s)).toBe(spent) // nothing left to spend
    s = clearRound(s)
    expect(s.round).toBe(1)
    expect(hintsLeft(s)).toBe(FORGE_HINTS) // the next round starts fresh
    s = hint(s)
    expect(s.revealed.FLINK).toBe(1)
    expect(s.revealed.JAVA).toBe(1) // round one's reveals are left where they were
  })

  it('never spends a hint on a word already forged', () => {
    let s = play(newForge(), 'JAVA').state
    s = hint(s)
    expect(s.revealed).toEqual({ KAFKA: 1 })
  })

  it('never reveals more letters than the word has', () => {
    // GIT is three letters and the budget is two, so this can only be checked by
    // walking the whole list: no reveal count may pass its word's length.
    let s = newForge()
    for (let r = 0; r < FORGE_ROUNDS.length; r++) {
      s = hint(hint(s))
      for (const w of FORGE_ROUNDS[r].words) expect(s.revealed[w.word] ?? 0).toBeLessThanOrEqual(w.word.length)
      s = clearRound(s)
    }
  })

  it('does nothing once every word on the round is found', () => {
    let s = play(newForge(), 'JAVA').state
    s = play(s, 'KAFKA').state // → round two, so "every word found" needs a wall of its own
    s = play(s, 'FLINK').state
    s = play(s, 'LINUX').state
    expect(s.round).toBe(2)
    expect(hint(s).revealed.REDIS).toBe(1)
  })
})

describe('forge — the Hire-me reveal', () => {
  it('hands over a whole word', () => {
    const s = revealWord(newForge())
    expect(s.found).toEqual(['JAVA'])
    expect(s.round).toBe(0) // KAFKA still to go
  })

  it('takes the round with it when it was the last word standing', () => {
    let s = play(newForge(), 'JAVA').state
    s = revealWord(s)
    expect(s.found).toEqual(['JAVA', 'KAFKA'])
    expect(s.round).toBe(1)
    expect(s.misses).toBe(0)
  })

  it('can win the game on the last round', () => {
    let s = newForge()
    for (let i = 0; i < FORGE_ROUNDS.length - 1; i++) s = clearRound(s)
    s = play(s, 'PYTHON').state
    s = revealWord(s)
    expect(s.status).toBe('won')
    expect(s.round).toBe(FORGE_ROUNDS.length)
  })
})

describe('forge — shuffle', () => {
  const RING = FORGE_ROUNDS[4].ring

  it('rearranges the same letters and nothing else', () => {
    const out = shuffle(RING, 7)
    expect([...out].sort()).toEqual([...RING].sort())
    expect(out.length).toBe(RING.length)
  })

  it('is the same wheel for the same seed, and a different one for another', () => {
    expect(shuffle(RING, 7)).toEqual(shuffle(RING, 7))
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => shuffle(RING, n).join(''))
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('leaves the round definition untouched', () => {
    const before = [...RING]
    shuffle(RING, 3)
    expect(RING).toEqual(before)
    expect(FORGE_ROUNDS[4].ring).toEqual(before)
  })
})
