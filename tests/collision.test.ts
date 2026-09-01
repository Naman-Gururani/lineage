import { describe, expect, it } from 'vitest'
import { moveAndSlide, overlaps } from '../src/world/collision'

const free = () => false

describe('overlaps', () => {
  it('detects box/solid intersection with half-open edges', () => {
    const box = { x: 10, y: 10, hw: 4, hh: 3 }
    expect(overlaps(box, { x: 12, y: 12, w: 10, h: 10 })).toBe(true)
    expect(overlaps(box, { x: 14, y: 0, w: 10, h: 100 })).toBe(false)
    expect(overlaps(box, { x: 13, y: 0, w: 10, h: 100 })).toBe(true)
  })
})

describe('moveAndSlide', () => {
  it('applies the full delta when nothing blocks', () => {
    const r = moveAndSlide({ x: 10, y: 10, hw: 4, hh: 3 }, 5, -2, free, [])
    expect(r).toEqual({ x: 15, y: 8, hitX: false, hitY: false })
  })

  it('stops at a wall on x and keeps sliding on y', () => {
    const wall = { x: 20, y: 0, w: 10, h: 100 }
    const r = moveAndSlide({ x: 10, y: 10, hw: 4, hh: 3 }, 10, 5, free, [wall])
    expect(r.x).toBe(16)
    expect(r.hitX).toBe(true)
    expect(r.y).toBe(15)
    expect(r.hitY).toBe(false)
  })

  it('is blocked by the terrain predicate', () => {
    const blocked = (_px: number, py: number) => py > 100
    const r = moveAndSlide({ x: 50, y: 98, hw: 4, hh: 2 }, 0, 5, blocked, [])
    expect(r.y).toBe(98)
    expect(r.hitY).toBe(true)
  })

  it('nudges sideways to slip through a doorway', () => {
    const left = { x: 0, y: 10, w: 20, h: 20 }
    const right = { x: 29, y: 10, w: 20, h: 20 }
    const r = moveAndSlide({ x: 26, y: 5, hw: 4, hh: 2 }, 0, 5, free, [left, right])
    expect(r.y).toBe(10)
    expect(r.x).toBeLessThan(26)
    expect(r.hitY).toBe(false)
  })

  it('handles sub-pixel deltas without drifting', () => {
    const r = moveAndSlide({ x: 10, y: 10, hw: 4, hh: 3 }, 0.4, 0.3, free, [])
    expect(r.x).toBeCloseTo(10.4)
    expect(r.y).toBeCloseTo(10.3)
  })
})
