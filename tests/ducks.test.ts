// The rules under test are pure: `data/ducks.ts` pulls in nothing but the `Save`
// type, so there is no scene, no DOM and no Phaser stub to keep alive here.
//
// Ported from the pier's fishing tests when the island became a fairground —
// same mechanics, same numbers, three ducks instead of three fish.
import { afterEach, describe, expect, it } from 'vitest'

import { WORLD_SEED } from '../src/config'
import { makeRng } from '../src/core/rng'
import { defaultSave } from '../src/core/save'
import { ACHIEVEMENTS } from '../src/data/achievements'
import {
  DUCK_FRAMES,
  DUCK_NAMES,
  DUCK_TABLE,
  REEL_TOLERANCE,
  biteWindow,
  castDuck,
  duckSummary,
  forcedDuck,
  landDuck,
  parseDuckFlag,
  rollDuck,
  setForcedDuck,
} from '../src/data/ducks'

afterEach(() => setForcedDuck(null))

describe('the duck table', () => {
  it('lists three ducks whose chances add up to one', () => {
    expect(DUCK_TABLE.map((d) => d.id)).toEqual(['rubber', 'spotted', 'golden'])
    expect(DUCK_TABLE.map((d) => d.p)).toEqual([0.62, 0.33, 0.05])
    expect(DUCK_TABLE.reduce((n, d) => n + d.p, 0)).toBeCloseTo(1, 10)
  })

  it('names every duck it can hook', () => {
    expect(DUCK_TABLE.map((d) => DUCK_NAMES[d.id])).toEqual(['Rubber duck', 'Spotted duck', 'Golden duck'])
  })

  it('points every duck at the sprite the fair pack paints for it', () => {
    expect(DUCK_TABLE.map((d) => DUCK_FRAMES[d.id])).toEqual(['duck_0', 'duck_1', 'duck_2'])
  })

  it('rolls down the table in order', () => {
    expect(rollDuck(0)).toBe('rubber')
    expect(rollDuck(0.61)).toBe('rubber')
    expect(rollDuck(0.63)).toBe('spotted')
    expect(rollDuck(0.94)).toBe('spotted')
    expect(rollDuck(0.96)).toBe('golden')
    expect(rollDuck(0.999999)).toBe('golden')
    expect(rollDuck(1)).toBe('golden') // a roll that lands on the edge still lands
  })

  it('hooks roughly the advertised split over a long afternoon', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 10_000; i++) {
      const id = rollDuck((i + 0.5) / 10_000)
      counts[id] = (counts[id] ?? 0) + 1
    }
    expect(counts.rubber / 10_000).toBeCloseTo(0.62, 2)
    expect(counts.spotted / 10_000).toBeCloseTo(0.33, 2)
    expect(counts.golden / 10_000).toBeCloseTo(0.05, 2)
  })
})

describe('the bite window', () => {
  it('shrinks by 0.07 s a catch, then stops shrinking', () => {
    expect(biteWindow(0)).toBeCloseTo(1.6, 10)
    expect(biteWindow(1)).toBeCloseTo(1.53, 10)
    expect(biteWindow(5)).toBeCloseTo(1.25, 10)
    expect(biteWindow(10)).toBeCloseTo(0.9, 10)
    expect(biteWindow(11)).toBeCloseTo(0.9, 10)
    expect(biteWindow(500)).toBeCloseTo(0.9, 10)
  })

  it('never drops below the floor, however the count is abused', () => {
    for (const n of [-3, 0, 9, 10, 11, 99]) expect(biteWindow(n)).toBeGreaterThanOrEqual(0.9)
    expect(biteWindow(-3)).toBeCloseTo(1.6, 10)
  })

  it('gives the hoop a little more room than it used to have', () => {
    expect(REEL_TOLERANCE).toBeCloseTo(1.15, 10)
  })
})

describe('the ?duck=gold flag', () => {
  it('reads the one value that means something', () => {
    expect(parseDuckFlag('?duck=gold')).toBe('golden')
    expect(parseDuckFlag('?st=1&duck=gold')).toBe('golden')
    expect(parseDuckFlag('?duck=rubber')).toBe(null)
    expect(parseDuckFlag('?fresh=1')).toBe(null)
    expect(parseDuckFlag('')).toBe(null)
  })

  it('forces the golden one onto every hook once set', () => {
    expect(forcedDuck()).toBe(null)
    setForcedDuck('golden')
    expect(forcedDuck()).toBe('golden')
    expect(rollDuck(0)).toBe('golden')
    expect(rollDuck(0.5)).toBe('golden')
    setForcedDuck(null)
    expect(rollDuck(0)).toBe('rubber')
  })
})

describe('hooking one', () => {
  it('counts each duck separately and keeps the running total', () => {
    const save = defaultSave()
    landDuck(save, 'rubber')
    landDuck(save, 'rubber')
    landDuck(save, 'spotted')
    expect(save.fish).toEqual({ rubber: 2, spotted: 1 })
    expect(save.stats.fishCaught).toBe(3)
  })

  it('says when the catch was the golden one', () => {
    const save = defaultSave()
    expect(landDuck(save, 'spotted')).toBe(false)
    expect(landDuck(save, 'golden')).toBe(true)
    expect(save.fish.golden).toBe(1)
  })

  it('has a badge waiting for it', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'goldfish')).toBe(true)
  })

  it('survives a save written before the tally existed', () => {
    const save = defaultSave()
    ;(save as { fish?: Record<string, number> }).fish = undefined
    landDuck(save, 'golden')
    expect(save.fish).toEqual({ golden: 1 })
  })
})

describe('one stream per hook', () => {
  it('varies ducks across catch counts', () => {
    // The shared stream gave one answer for the first cast of every save; a fork
    // per catch count gives the run a shape instead of a constant.
    //
    // Deliberately deterministic: the fork key is the catch count alone, so the
    // schedule is the same for every save. A per-save salt in `castDuck` —
    // folding a save id into the fork key alongside the catch count — would
    // restore true independent 5% odds if the design ever wants them.
    const rng = makeRng(WORLD_SEED).fork('scene')
    const ten = Array.from({ length: 10 }, (_, n) => castDuck(rng, n))
    expect(new Set(ten).size).toBeGreaterThan(1)
  })

  it('settles the same duck however far the parent stream has run on', () => {
    // A hook that misses does not re-roll the duck: the fork does not care where
    // the scene's own stream has got to, only which catch this is.
    const a = makeRng(7)
    const b = makeRng(7)
    expect(castDuck(a, 3)).toBe(castDuck(b, 3))
    a.next()
    a.range(0, 100)
    expect(castDuck(a, 3)).toBe(castDuck(b, 3))
  })

  it('still bows to the forced flag', () => {
    setForcedDuck('golden')
    expect(castDuck(makeRng(7), 0)).toBe('golden')
    expect(castDuck(makeRng(999), 4)).toBe('golden')
  })
})

describe('the journal row', () => {
  it('says so before anything has been hooked', () => {
    expect(duckSummary({})).toBe('None yet')
    expect(duckSummary(undefined as unknown as Record<string, number>)).toBe('None yet')
    expect(duckSummary({ rubber: 0 })).toBe('None yet')
  })

  it('counts the ducks hooked and lists them commonest first', () => {
    expect(duckSummary({ golden: 1, rubber: 3 })).toBe('2 / 3 — Rubber duck ×3 · Golden duck ×1')
    expect(duckSummary({ spotted: 2 })).toBe('1 / 3 — Spotted duck ×2')
  })
})
