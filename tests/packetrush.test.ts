import { describe, expect, it } from 'vitest'
import {
  JURISDICTIONS,
  PR,
  prEndless,
  prInit,
  prLowest,
  prRoute,
  prStep,
  prSpawnInterval,
  type Jur,
  type PrState,
} from '../src/games/packetrush'

/** Step `s` for `secs` seconds at a fixed 60 Hz tick, the way the renderer does. */
const run = (s: PrState, secs: number, dt = 1 / 60): PrState => {
  let out = s
  for (let i = 0; i < Math.round(secs / dt); i++) out = prStep(out, dt)
  return out
}

/** The lane/jurisdiction pairs of the first `n` packets a seed spawns. */
function spawns(seed: number, n: number): string[] {
  let s = prInit(seed)
  const seen: string[] = []
  for (let i = 0; i < 100_000 && seen.length < n; i++) {
    const next = prStep(s, 1 / 60)
    if (next.falling.length > s.falling.length) {
      const p = next.falling[next.falling.length - 1]
      seen.push(`${p.lane}${p.jur}`)
    }
    // never let a packet reach the floor: the run must survive long enough to spawn n
    s = next.falling.length ? prRoute(next, next.falling[0].jur) : next
  }
  return seen
}

/** A state holding exactly the packets described, nothing else in flight. */
const withPackets = (s: PrState, packets: { lane: 0 | 1 | 2; jur: Jur; y: number }[]): PrState => ({ ...s, falling: packets, spawnIn: 99 })

describe('packet rush — the run', () => {
  it('starts at the speed, lives and spawn delay the cabinet advertises', () => {
    const s = prInit(7)
    expect(s.seed).toBe(7)
    expect(s.t).toBe(0)
    expect(s.speed).toBe(0.22)
    expect(s.lives).toBe(3)
    expect(s.score).toBe(0)
    expect(s.spawnIn).toBe(1.2)
    expect(s.falling).toEqual([])
    expect(s.over).toBe(false)
    expect(s.won).toBe(false)
  })

  it('agrees with the constants the renderer draws from', () => {
    expect(PR.SPEED).toBe(0.22)
    expect(PR.LIVES).toBe(3)
    expect(PR.SPAWN).toBe(1.2)
    expect(PR.WIN).toBe(30)
    expect(PR.RAMP_EVERY).toBe(10)
    expect(PR.RAMP).toBeCloseTo(1.04, 10)
  })

  it('names three jurisdictions, each with its own glyph and colour', () => {
    expect(JURISDICTIONS.length).toBe(3)
    expect(JURISDICTIONS.map((j) => j.glyph)).toEqual(['£', '€', '$'])
    expect(new Set(JURISDICTIONS.map((j) => j.color)).size).toBe(3)
    expect(new Set(JURISDICTIONS.map((j) => j.id)).size).toBe(3)
  })

  it('leaves the state it was handed alone', () => {
    const s = withPackets(prInit(1), [{ lane: 0, jur: 0, y: 0.4 }])
    const before = JSON.stringify(s)
    prStep(s, 1 / 60)
    prRoute(s, 0)
    prRoute(s, 1)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('packet rush — falling and spawning', () => {
  it('drops every packet at the current speed', () => {
    const s = withPackets(prInit(1), [{ lane: 1, jur: 2, y: 0 }])
    const a = prStep(s, 0.5)
    expect(a.falling[0].y).toBeCloseTo(0.11, 10) // 0.22 / s
    expect(a.t).toBeCloseTo(0.5, 10)
  })

  it('costs a life when a packet reaches the floor, and drops it from the column', () => {
    const s = withPackets(prInit(1), [{ lane: 0, jur: 0, y: 0.99 }])
    const a = prStep(s, 0.5)
    expect(a.falling).toEqual([])
    expect(a.lives).toBe(2)
    expect(a.over).toBe(false)
  })

  it('ends the run — as a loss — on the third overflow', () => {
    let s = withPackets(prInit(1), [{ lane: 0, jur: 0, y: 0.99 }])
    s = prStep(s, 0.5)
    s = withPackets(s, [{ lane: 0, jur: 0, y: 0.99 }])
    s = prStep(s, 0.5)
    expect(s.lives).toBe(1)
    expect(s.over).toBe(false)
    s = withPackets(s, [{ lane: 0, jur: 0, y: 0.99 }])
    s = prStep(s, 0.5)
    expect(s.lives).toBe(0)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
  })

  it('spawns when the timer runs out, and resets the timer', () => {
    const s = prInit(3)
    const a = run(s, 1.3)
    expect(a.falling.length).toBe(1)
    expect(a.falling[0].y).toBeGreaterThan(0)
    expect(a.spawnIn).toBeGreaterThan(0)
  })

  it('spawns faster as the stream speeds up, but never below the floor', () => {
    expect(prSpawnInterval(PR.SPEED)).toBeCloseTo(PR.SPAWN, 10)
    expect(prSpawnInterval(PR.SPEED * PR.RAMP)).toBeLessThan(PR.SPAWN)
    expect(prSpawnInterval(PR.SPEED * 100)).toBe(PR.SPAWN_MIN)
  })

  it('never drops a second packet into the mouth of a lane that is still full', () => {
    let s = prInit(99)
    for (let i = 0; i < 60 * 40; i++) {
      s = prStep(s, 1 / 60)
      const mouths = s.falling.filter((p) => p.y < 0.1).map((p) => p.lane)
      expect(new Set(mouths).size).toBe(mouths.length)
      if (s.over) s = prInit(s.seed) // keep the stream running past a floor hit
    }
  })

  it('is a no-op once the run is finished', () => {
    const dead = { ...prInit(1), over: true }
    expect(prStep(dead, 1)).toBe(dead)
    expect(prRoute(dead, 0)).toBe(dead)
  })
})

describe('packet rush — determinism', () => {
  it('deals the same first ten packets for the same seed', () => {
    expect(spawns(1234, 10)).toEqual(spawns(1234, 10))
    expect(spawns(1234, 10).length).toBe(10)
  })

  it('deals a different stream for a different seed', () => {
    expect(spawns(1234, 10)).not.toEqual(spawns(4321, 10))
  })

  it('uses all three lanes and all three jurisdictions over a long run', () => {
    const s = spawns(2026, 60)
    expect(new Set(s.map((p) => p[0])).size).toBe(3)
    expect(new Set(s.map((p) => p[1])).size).toBe(3)
  })
})

describe('packet rush — routing', () => {
  it('routes the lowest packet in the column, not the newest', () => {
    const s = withPackets(prInit(1), [
      { lane: 0, jur: 0, y: 0.2 },
      { lane: 1, jur: 1, y: 0.8 },
      { lane: 2, jur: 2, y: 0.5 },
    ])
    expect(prLowest(s)?.jur).toBe(1)
    const a = prRoute(s, 1)
    expect(a.score).toBe(1)
    expect(a.falling.map((p) => p.jur)).toEqual([0, 2])
  })

  it('costs a life when the jurisdiction is wrong, and still clears the packet', () => {
    const s = withPackets(prInit(1), [{ lane: 0, jur: 0, y: 0.5 }])
    const a = prRoute(s, 2)
    expect(a.score).toBe(0)
    expect(a.lives).toBe(2)
    expect(a.falling).toEqual([])
  })

  it('ends the run on the third mis-route', () => {
    let s = withPackets(prInit(1), [{ lane: 0, jur: 0, y: 0.5 }])
    for (let i = 0; i < 3; i++) {
      s = prRoute(s, 1)
      if (i < 2) s = withPackets(s, [{ lane: 0, jur: 0, y: 0.5 }])
    }
    expect(s.lives).toBe(0)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
  })

  it('shrugs when there is nothing in the column', () => {
    const s = withPackets(prInit(1), [])
    expect(prRoute(s, 0)).toBe(s)
    expect(prLowest(s)).toBe(null)
  })
})

/** Route `n` correct packets, one at a time. */
function score(s: PrState, n: number): PrState {
  let out = s
  for (let i = 0; i < n; i++) out = prRoute(withPackets(out, [{ lane: 0, jur: 0, y: 0.5 }]), 0)
  return out
}

describe('packet rush — the ramp and the win', () => {
  it('speeds the stream up by 4% at ten and again at twenty', () => {
    const s = prInit(1)
    expect(score(s, 9).speed).toBeCloseTo(PR.SPEED, 10)
    expect(score(s, 10).speed).toBeCloseTo(PR.SPEED * 1.04, 10)
    expect(score(s, 19).speed).toBeCloseTo(PR.SPEED * 1.04, 10)
    expect(score(s, 20).speed).toBeCloseTo(PR.SPEED * 1.04 * 1.04, 10)
    expect(score(s, 29).speed).toBeCloseTo(PR.SPEED * 1.04 * 1.04, 10)
    // the thirtieth ramps as well: the endless run picks up where the win left off
    expect(score(s, 30).speed).toBeCloseTo(PR.SPEED * 1.04 ** 3, 10)
  })

  it('is won at thirty, and stops there', () => {
    const s = score(prInit(1), 30)
    expect(s.score).toBe(30)
    expect(s.won).toBe(true)
    expect(s.over).toBe(true)
    expect(prStep(s, 1)).toBe(s)
  })

  it('keeps the win banked when the player chooses to play on', () => {
    const won = score(prInit(1), 30)
    const endless = prEndless(won)
    expect(endless.won).toBe(true)
    expect(endless.over).toBe(false)
    expect(endless.score).toBe(30)
    // the ramp carries on, and a further win never re-ends the run
    const more = score(endless, 10)
    expect(more.score).toBe(40)
    expect(more.over).toBe(false)
    expect(more.speed).toBeCloseTo(PR.SPEED * 1.04 ** 4, 10)
    // …until the lives run out, which ends it as the win it already was
    let dead = more
    for (let i = 0; i < 3; i++) dead = prRoute(withPackets(dead, [{ lane: 0, jur: 0, y: 0.5 }]), 1)
    expect(dead.over).toBe(true)
    expect(dead.won).toBe(true)
  })

  it('only offers the endless run to a finished win', () => {
    const fresh = prInit(1)
    expect(prEndless(fresh)).toBe(fresh)
  })
})
