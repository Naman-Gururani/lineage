// The rules under test are pure: `data/fish.ts` pulls in nothing but the `Save`
// type, so there is no scene, no DOM and no Phaser stub to keep alive here.
import { afterEach, describe, expect, it } from 'vitest'

import { WORLD_SEED } from '../src/config'
import { makeRng } from '../src/core/rng'
import { defaultSave } from '../src/core/save'
import { ACHIEVEMENTS } from '../src/data/achievements'
import {
  FISH_NAMES,
  FISH_TABLE,
  REEL_TOLERANCE,
  biteWindow,
  castSpecies,
  fishSummary,
  forcedFish,
  landFish,
  parseFishFlag,
  rollFish,
  setForcedFish,
} from '../src/data/fish'

afterEach(() => setForcedFish(null))

describe('the fish table', () => {
  it('lists three species whose chances add up to one', () => {
    expect(FISH_TABLE.map((f) => f.id)).toEqual(['sardine', 'parrot', 'golden'])
    expect(FISH_TABLE.map((f) => f.p)).toEqual([0.62, 0.33, 0.05])
    expect(FISH_TABLE.reduce((n, f) => n + f.p, 0)).toBeCloseTo(1, 10)
  })

  it('names every species it can land', () => {
    for (const f of FISH_TABLE) expect(FISH_NAMES[f.id]).toBeTruthy()
  })

  it('rolls down the table in order', () => {
    expect(rollFish(0)).toBe('sardine')
    expect(rollFish(0.61)).toBe('sardine')
    expect(rollFish(0.63)).toBe('parrot')
    expect(rollFish(0.94)).toBe('parrot')
    expect(rollFish(0.96)).toBe('golden')
    expect(rollFish(0.999999)).toBe('golden')
    expect(rollFish(1)).toBe('golden') // a roll that lands on the edge still lands
  })

  it('lands roughly the advertised split over a long afternoon', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 10_000; i++) {
      const id = rollFish((i + 0.5) / 10_000)
      counts[id] = (counts[id] ?? 0) + 1
    }
    expect(counts.sardine / 10_000).toBeCloseTo(0.62, 2)
    expect(counts.parrot / 10_000).toBeCloseTo(0.33, 2)
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

  it('gives the net a little more room than it used to have', () => {
    expect(REEL_TOLERANCE).toBeCloseTo(1.15, 10)
  })
})

describe('the ?fish=gold flag', () => {
  it('reads the one value that means something', () => {
    expect(parseFishFlag('?fish=gold')).toBe('golden')
    expect(parseFishFlag('?st=1&fish=gold')).toBe('golden')
    expect(parseFishFlag('?fish=sardine')).toBe(null)
    expect(parseFishFlag('?fresh=1')).toBe(null)
    expect(parseFishFlag('')).toBe(null)
  })

  it('forces the golden one out of every cast once set', () => {
    expect(forcedFish()).toBe(null)
    setForcedFish('golden')
    expect(forcedFish()).toBe('golden')
    expect(rollFish(0)).toBe('golden')
    expect(rollFish(0.5)).toBe('golden')
    setForcedFish(null)
    expect(rollFish(0)).toBe('sardine')
  })
})

describe('landing one', () => {
  it('counts each species separately and keeps the running total', () => {
    const save = defaultSave()
    landFish(save, 'sardine')
    landFish(save, 'sardine')
    landFish(save, 'parrot')
    expect(save.fish).toEqual({ sardine: 2, parrot: 1 })
    expect(save.stats.fishCaught).toBe(3)
  })

  it('says when the catch was the golden one', () => {
    const save = defaultSave()
    expect(landFish(save, 'parrot')).toBe(false)
    expect(landFish(save, 'golden')).toBe(true)
    expect(save.fish.golden).toBe(1)
  })

  it('has a badge waiting for it', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'goldfish')).toBe(true)
  })

  it('survives a save written before the tally existed', () => {
    const save = defaultSave()
    ;(save as { fish?: Record<string, number> }).fish = undefined
    landFish(save, 'golden')
    expect(save.fish).toEqual({ golden: 1 })
  })
})

describe('one stream per cast', () => {
  it('varies species across catch counts', () => {
    // The shared stream gave one answer for the first cast of every save; a fork
    // per catch count gives the run a shape instead of a constant.
    //
    // Deliberately deterministic: the fork key is the catch count alone, so the
    // schedule is the same for every save (cast #4 is golden for everyone). A
    // per-save salt in `castSpecies` — folding a save id into the fork key
    // alongside the catch count — would restore true independent 5% odds if the
    // design ever wants them.
    const rng = makeRng(WORLD_SEED).fork('scene')
    const ten = Array.from({ length: 10 }, (_, n) => castSpecies(rng, n))
    expect(new Set(ten).size).toBeGreaterThan(1)
  })

  it('settles the same fish however far the parent stream has run on', () => {
    // A cast that misses does not re-roll the fish: the fork does not care where
    // the scene's own stream has got to, only which catch this is.
    const a = makeRng(7)
    const b = makeRng(7)
    expect(castSpecies(a, 3)).toBe(castSpecies(b, 3))
    a.next()
    a.range(0, 100)
    expect(castSpecies(a, 3)).toBe(castSpecies(b, 3))
  })

  it('still bows to the forced flag', () => {
    setForcedFish('golden')
    expect(castSpecies(makeRng(7), 0)).toBe('golden')
    expect(castSpecies(makeRng(999), 4)).toBe('golden')
  })
})

describe('the journal row', () => {
  it('says so before anything has bitten', () => {
    expect(fishSummary({})).toBe('None yet')
    expect(fishSummary(undefined as unknown as Record<string, number>)).toBe('None yet')
    expect(fishSummary({ sardine: 0 })).toBe('None yet')
  })

  it('counts the species landed and lists them commonest first', () => {
    expect(fishSummary({ golden: 1, sardine: 3 })).toBe('2 / 3 — Sardine ×3 · Goldfish ×1')
    expect(fishSummary({ parrot: 2 })).toBe('1 / 3 — Parrotfish ×2')
  })
})
