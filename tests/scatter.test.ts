import { describe, expect, it } from 'vitest'
import { TILE, WORLD_SEED } from '../src/config'
import { makeRng } from '../src/core/rng'
import { BLUEPRINT, rasterizeBlueprint } from '../src/world/blueprint'
import { regionAt } from '../src/world/regions'
import { scatterDecor } from '../src/world/scatter'
import { T, isLand } from '../src/world/terrain'

describe('scatterDecor', () => {
  const grid = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))
  const decor = scatterDecor(grid, BLUEPRINT, makeRng(WORLD_SEED).fork('scatter'))
  const tileOf = (d: { x: number; y: number }) => grid.get(Math.floor(d.x / TILE), Math.floor(d.y / TILE))

  it('produces a rich, deterministic set', () => {
    expect(decor.length).toBeGreaterThan(800)
    const again = scatterDecor(grid, BLUEPRINT, makeRng(WORLD_SEED).fork('scatter'))
    expect(again).toEqual(decor)
  })

  it('never lands on water, roads, plaza, docks or bridges', () => {
    const banned = new Set<number>([T.PATH, T.PLAZA, T.DOCK, T.BRIDGE])
    for (const d of decor) {
      const t = tileOf(d)
      if (d.kind === 'lily' || d.kind === 'reed') continue
      expect(isLand(t), `${d.kind} at ${d.x},${d.y}`).toBe(true)
      if (d.kind !== 'lamp' && d.kind !== 'bench') expect(banned.has(t), `${d.kind} on ${t} at ${d.x},${d.y}`).toBe(false)
    }
  })

  it('keeps landmark footprints and doors clear', () => {
    for (const lm of BLUEPRINT.landmarks) {
      const x0 = (lm.tx - 1) * TILE
      const y0 = (lm.ty - 1) * TILE
      const x1 = (lm.tx + lm.w + 1) * TILE
      const y1 = (lm.ty + lm.h + 1) * TILE
      for (const d of decor) {
        const inside = d.x >= x0 && d.x < x1 && d.y >= y0 && d.y < y1
        expect(inside, `${d.kind} inside ${lm.id}`).toBe(false)
      }
    }
  })

  it('fills the woods with trees and the harbor with palms', () => {
    let woods = 0
    let palms = 0
    for (const d of decor) {
      const r = regionAt(BLUEPRINT.regions, d.x / TILE, d.y / TILE)
      if ((d.kind === 'tree' || d.kind === 'pine') && r?.id === 'woods') woods++
      if (d.kind === 'palm') palms++
    }
    expect(woods).toBeGreaterThan(120)
    expect(palms).toBeGreaterThan(6)
  })

  it('places exactly five quest shells', () => {
    expect(decor.filter((d) => d.kind === 'shell' && d.v === 1).length).toBe(5)
  })

  it('marks blocking props solid and soft props not', () => {
    expect(decor.filter((d) => d.kind === 'tree').every((d) => d.solid)).toBe(true)
    expect(decor.filter((d) => d.kind === 'flower').every((d) => !d.solid)).toBe(true)
  })

  it('keeps trees spaced apart', () => {
    const trees = decor.filter((d) => d.kind === 'tree' || d.kind === 'pine')
    for (let i = 0; i < trees.length; i += 7)
      for (let j = i + 1; j < trees.length; j += 7) {
        const dist = Math.hypot(trees[i].x - trees[j].x, trees[i].y - trees[j].y)
        expect(dist).toBeGreaterThanOrEqual(12)
      }
  })
})
