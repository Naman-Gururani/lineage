import { describe, expect, it } from 'vitest'
import { makeRng } from '../src/core/rng'
import { astar, carveRoads, roadCost } from '../src/world/paths'
import { T, isWalkable, makeGrid, type Terrain } from '../src/world/terrain'

const walk = (t: Terrain) => (isWalkable(t) ? 1 : Infinity)

describe('astar', () => {
  it('finds a 4-connected path across open grass', () => {
    const g = makeGrid(10, 10, T.GRASS)
    const p = astar(g, { x: 0, y: 0 }, { x: 9, y: 9 }, walk)
    expect(p).not.toBeNull()
    expect(p![0]).toEqual({ x: 0, y: 0 })
    expect(p![p!.length - 1]).toEqual({ x: 9, y: 9 })
    for (let i = 1; i < p!.length; i++) {
      const d = Math.abs(p![i].x - p![i - 1].x) + Math.abs(p![i].y - p![i - 1].y)
      expect(d).toBe(1)
    }
    expect(p!.length).toBe(19)
  })

  it('returns null when the goal is cut off', () => {
    const g = makeGrid(10, 10, T.GRASS)
    for (let y = 0; y < 10; y++) g.set(5, y, T.WATER)
    expect(astar(g, { x: 0, y: 0 }, { x: 9, y: 9 }, walk)).toBeNull()
  })

  it('prefers cheaper tiles', () => {
    const g = makeGrid(5, 3, T.SAND)
    for (let x = 0; x < 5; x++) g.set(x, 0, T.PATH)
    const p = astar(g, { x: 0, y: 1 }, { x: 4, y: 1 }, (t) => roadCost(t, 0))
    expect(p!.some((n) => n.y === 0)).toBe(true)
  })
})

describe('carveRoads', () => {
  it('paints PATH from end to end without touching docks or bridges', () => {
    const g = makeGrid(12, 6, T.GRASS)
    for (let y = 0; y < 6; y++) g.set(6, y, T.RIVER)
    g.set(6, 2, T.BRIDGE)
    g.set(6, 3, T.BRIDGE)
    g.set(11, 5, T.DOCK)
    carveRoads(g, [[{ x: 0, y: 2 }, { x: 11, y: 2 }]], makeRng(1))
    expect(g.get(0, 2)).toBe(T.PATH)
    expect(g.get(11, 2)).toBe(T.PATH)
    expect(g.get(6, 2)).toBe(T.BRIDGE)
    expect(g.get(6, 3)).toBe(T.BRIDGE)
    expect(g.get(11, 5)).toBe(T.DOCK)
    let path = 0
    for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) if (g.get(x, y) === T.PATH) path++
    expect(path).toBeGreaterThanOrEqual(11)
  })
})
