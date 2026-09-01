import { describe, expect, it } from 'vitest'
import { TILE } from '../src/config'
import { HOP_ARC, HOP_HH, HOP_HW, HOP_TIME, boxBlocked, planHop } from '../src/world/hop'

const clear = () => false
/** Blocks every sample point whose x falls inside [a, b]. */
const band = (a: number, b: number) => (x: number) => x >= a && x <= b

const PX = 100
const PY = 100

describe('hop constants', () => {
  it('takes 0.38s ground to ground', () => {
    expect(HOP_TIME).toBe(0.38)
  })

  it('peaks at 0.6 of a tile', () => {
    expect(HOP_ARC).toBeCloseTo(0.6 * TILE)
  })

  it('samples the player box', () => {
    expect(HOP_HW).toBe(5)
    expect(HOP_HH).toBe(3)
  })
})

describe('boxBlocked', () => {
  it('is clear when nothing is hit', () => {
    expect(boxBlocked(PX, PY, clear)).toBe(false)
  })

  it('catches an obstacle touching any edge of the box', () => {
    expect(boxBlocked(PX, PY, band(PX + HOP_HW - 1, PX + 40))).toBe(true)
    expect(boxBlocked(PX, PY, band(PX + HOP_HW + 1, PX + 40))).toBe(false)
  })

  it('catches an obstacle sitting inside the box', () => {
    expect(boxBlocked(PX, PY, (x) => x === PX)).toBe(true)
  })
})

describe('planHop', () => {
  it('hops in place when standing still', () => {
    const plan = planHop(PX, PY, 1, 0, false, clear, clear)
    expect(plan).toEqual({ lx: PX, ly: PY, dist: 0 })
  })

  it('hops in place with no facing to speak of', () => {
    expect(planHop(PX, PY, 0, 0, true, clear, clear).dist).toBe(0)
  })

  it('carries a tile and a half over clear ground', () => {
    const plan = planHop(PX, PY, 1, 0, true, clear, clear)
    expect(plan.dist).toBe(1.5)
    expect(plan.lx).toBeCloseTo(PX + 1.5 * TILE)
    expect(plan.ly).toBeCloseTo(PY)
  })

  it('hops along the facing, not the axes', () => {
    const up = planHop(PX, PY, 0, -1, true, clear, clear)
    expect(up.ly).toBeCloseTo(PY - 1.5 * TILE)
    const diag = planHop(PX, PY, 1, 1, true, clear, clear)
    expect(Math.hypot(diag.lx - PX, diag.ly - PY)).toBeCloseTo(1.5 * TILE)
  })

  it('shortens to a full tile when the long landing is taken', () => {
    // the 1.5 landing box spans 143..153; the 1.0 box spans 127..137
    const taken = band(PX + 40, PX + 200)
    const plan = planHop(PX, PY, 1, 0, true, clear, taken)
    expect(plan.dist).toBe(1)
    expect(plan.lx).toBeCloseTo(PX + TILE)
  })

  it('falls back to half a tile, then to standing still', () => {
    expect(planHop(PX, PY, 1, 0, true, clear, band(PX + 22, PX + 200)).dist).toBe(0.5)
    expect(planHop(PX, PY, 1, 0, true, clear, () => true).dist).toBe(0)
    expect(planHop(PX, PY, 1, 0, true, clear, () => true)).toEqual({ lx: PX, ly: PY, dist: 0 })
  })

  it('flies over a low obstacle on the way through', () => {
    const low = band(PX + 10, PX + 25) // a fence between take-off and landing
    const plan = planHop(PX, PY, 1, 0, true, clear, low)
    expect(plan.dist).toBe(1.5)
  })

  it('refuses to land on a low obstacle', () => {
    // low all the way from midway to past the long landing, but clear at 1.0
    const low = (x: number) => x >= PX + 40
    const plan = planHop(PX, PY, 1, 0, true, clear, low)
    expect(plan.dist).toBe(1)
  })

  it('refuses a landing with a hard solid on it, even when nothing else objects', () => {
    // only the hard predicate reports it: 1.5 can only be rejected by the path check
    const onLanding = band(PX + 40, PX + 60) // covers the 1.5 landing box only
    const plan = planHop(PX, PY, 1, 0, true, onLanding, clear)
    expect(plan.dist).toBe(1)
  })

  it('will not hop through a hard obstacle in the way', () => {
    const wall = band(PX + 10, PX + 25)
    // clear ground beyond the wall, but the wall itself is hard: no crossing
    expect(planHop(PX, PY, 1, 0, true, wall, wall).dist).toBe(0)
  })

  it('ignores low solids when judging the flight path only', () => {
    // hard says clear everywhere, any blocks midway: the hop still commits
    const plan = planHop(PX, PY, 1, 0, true, clear, band(PX + 12, PX + 20))
    expect(plan.dist).toBe(1.5)
    expect(plan.lx).toBeCloseTo(PX + 1.5 * TILE)
  })
})
