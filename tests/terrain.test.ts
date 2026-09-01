import { describe, expect, it } from 'vitest'
import { T, distanceField, floodCount, isLand, isWalkable, makeGrid, mask4, mask8 } from '../src/world/terrain'

describe('terrain predicates', () => {
  it('classifies walkable and land tiles', () => {
    expect(isWalkable(T.SAND)).toBe(true)
    expect(isWalkable(T.SHALLOW)).toBe(true)
    expect(isWalkable(T.WATER)).toBe(false)
    expect(isWalkable(T.CLIFF)).toBe(false)
    expect(isLand(T.SHALLOW)).toBe(false)
    expect(isLand(T.GRASS)).toBe(true)
  })
})

describe('grid', () => {
  it('stores and reads cells with bounds checks', () => {
    const g = makeGrid(4, 3, T.WATER)
    g.set(1, 2, T.GRASS)
    expect(g.get(1, 2)).toBe(T.GRASS)
    expect(g.get(0, 0)).toBe(T.WATER)
    expect(g.inb(3, 2)).toBe(true)
    expect(g.inb(4, 2)).toBe(false)
  })
})

describe('masks', () => {
  const isGrass = (t: number) => t === T.GRASS
  it('mask4 is 0 for an isolated tile and sets N when the north neighbour matches', () => {
    const g = makeGrid(3, 3, T.WATER)
    g.set(1, 1, T.GRASS)
    expect(mask4(g, 1, 1, isGrass)).toBe(0)
    g.set(1, 0, T.GRASS)
    expect(mask4(g, 1, 1, isGrass)).toBe(1)
    g.set(2, 1, T.GRASS)
    expect(mask4(g, 1, 1, isGrass)).toBe(3)
  })

  it('mask8 treats out-of-bounds as matching', () => {
    const g = makeGrid(3, 3, T.GRASS)
    expect(mask8(g, 0, 0, isGrass)).toBe(255)
    g.set(1, 1, T.WATER)
    expect(mask8(g, 0, 0, isGrass)).toBe(255 - 8) // SE bit cleared
  })
})

describe('flood and distance', () => {
  it('floodCount counts the connected region', () => {
    const g = makeGrid(5, 5, T.WATER)
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) g.set(x, y, T.GRASS)
    expect(floodCount(g, 2, 2, isLand)).toBe(9)
    expect(floodCount(g, 0, 0, isLand)).toBe(0)
  })

  it('distanceField measures steps to the nearest non-passing tile', () => {
    const g = makeGrid(7, 7, T.WATER)
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) g.set(x, y, T.GRASS)
    const d = distanceField(g, isLand)
    expect(d[3 * 7 + 3]).toBe(3)
    expect(d[1 * 7 + 1]).toBe(1)
    expect(d[0]).toBe(0)
  })
})
