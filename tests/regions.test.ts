import { describe, expect, it } from 'vitest'
import { pointInPoly, regionAt } from '../src/world/regions'

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

describe('pointInPoly', () => {
  it('detects inside and outside', () => {
    expect(pointInPoly(square, 5, 5)).toBe(true)
    expect(pointInPoly(square, 15, 5)).toBe(false)
    expect(pointInPoly(square, -1, 5)).toBe(false)
  })
})

describe('regionAt', () => {
  it('returns the first region containing the point, else null', () => {
    const regions = [
      { id: 'a', name: 'A', poly: square },
      { id: 'b', name: 'B', poly: square.map((p) => ({ x: p.x + 10, y: p.y })) },
    ]
    expect(regionAt(regions, 5, 5)?.id).toBe('a')
    expect(regionAt(regions, 15, 5)?.id).toBe('b')
    expect(regionAt(regions, 25, 5)).toBeNull()
  })
})
