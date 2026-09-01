import { describe, expect, it } from 'vitest'
import { WORLD_SEED, WORLD_TH, WORLD_TW, pickZoom } from '../src/config'
import { makeRng } from '../src/core/rng'
import { BLUEPRINT, inShape, rasterizeBlueprint } from '../src/world/blueprint'
import { regionAt } from '../src/world/regions'
import { T, floodCount, floodMask, isLand, isWalkable, isWater } from '../src/world/terrain'

describe('config', () => {
  it('picks an integer zoom for the viewport', () => {
    expect(pickZoom(1920, 1080)).toBe(3)
    expect(pickZoom(2560, 1440)).toBe(4)
    expect(pickZoom(1024, 768)).toBe(2)
    expect(pickZoom(390, 844)).toBe(2)
  })
})

describe('inShape', () => {
  const flat = () => 0.5
  it('tests points against ellipses', () => {
    const e = { kind: 'ellipse' as const, cx: 10, cy: 10, rx: 5, ry: 3 }
    expect(inShape(e, 10, 10, flat)).toBe(true)
    expect(inShape(e, 14, 10, flat)).toBe(true)
    expect(inShape(e, 16, 10, flat)).toBe(false)
    expect(inShape(e, 10, 14, flat)).toBe(false)
  })
  it('tests points against polygons', () => {
    const p = { kind: 'poly' as const, pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }
    expect(inShape(p, 5, 5, flat)).toBe(true)
    expect(inShape(p, 15, 5, flat)).toBe(false)
  })
})

describe('BLUEPRINT rasterisation', () => {
  const grid = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))

  it('has the world size', () => {
    expect(grid.w).toBe(WORLD_TW)
    expect(grid.h).toBe(WORLD_TH)
  })

  it('is deterministic', () => {
    const again = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))
    expect(again.cells).toEqual(grid.cells)
  })

  it('puts every landmark footprint on land with a walkable door', () => {
    for (const lm of BLUEPRINT.landmarks) {
      for (let y = lm.ty; y < lm.ty + lm.h; y++)
        for (let x = lm.tx; x < lm.tx + lm.w; x++) expect(isLand(grid.get(x, y)), `${lm.id} footprint ${x},${y}`).toBe(true)
      expect(isWalkable(grid.get(lm.door.x, lm.door.y)), `${lm.id} door`).toBe(true)
    }
  })

  it('connects the spawn to every door, spot and landmark', () => {
    const s = BLUEPRINT.spawn
    expect(isWalkable(grid.get(s.x, s.y))).toBe(true)
    const reach = floodMask(grid, s.x, s.y, isWalkable)
    const at = (p: { x: number; y: number }) => reach[Math.floor(p.y) * grid.w + Math.floor(p.x)]
    for (const lm of BLUEPRINT.landmarks) expect(at(lm.door), `door of ${lm.id}`).toBe(1)
    for (const p of BLUEPRINT.packetSpots) expect(at(p), `packet ${p.x},${p.y}`).toBe(1)
    for (const p of BLUEPRINT.chestSpots) expect(at(p), `chest ${p.x},${p.y}`).toBe(1)
    for (const [id, p] of Object.entries(BLUEPRINT.npcSpots)) expect(at(p), `npc ${id}`).toBe(1)
    expect(at(BLUEPRINT.fishingSpot)).toBe(1)
    expect(at(BLUEPRINT.viewpoint)).toBe(1)
    expect(floodCount(grid, s.x, s.y, isWalkable)).toBeGreaterThan(6000)
  })

  it('has twenty packet spots', () => {
    expect(BLUEPRINT.packetSpots.length).toBe(20)
  })

  it('rings the coast with sand and shallows', () => {
    let sandByShallow = 0
    for (let y = 1; y < grid.h - 1; y++)
      for (let x = 1; x < grid.w - 1; x++)
        if (grid.get(x, y) === T.SAND && [grid.get(x + 1, y), grid.get(x - 1, y), grid.get(x, y + 1), grid.get(x, y - 1)].includes(T.SHALLOW))
          sandByShallow++
    expect(sandByShallow).toBeGreaterThan(100)
  })

  it('runs the river from the plateau to the sea', () => {
    let riverToSea = false
    let river = 0
    for (let y = 1; y < grid.h - 1; y++)
      for (let x = 1; x < grid.w - 1; x++) {
        if (grid.get(x, y) !== T.RIVER) continue
        river++
        for (const t of [grid.get(x + 1, y), grid.get(x - 1, y), grid.get(x, y + 1), grid.get(x, y - 1)])
          if (t === T.SHALLOW || t === T.WATER || t === T.DEEP) riverToSea = true
      }
    expect(river).toBeGreaterThan(60)
    expect(riverToSea).toBe(true)
  })

  it('crosses the river only on bridges (and has at least two)', () => {
    let bridges = 0
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (grid.get(x, y) === T.BRIDGE) bridges++
    expect(bridges).toBeGreaterThanOrEqual(4)
  })

  it('has docks touching water', () => {
    let dockByWater = 0
    for (let y = 1; y < grid.h - 1; y++)
      for (let x = 1; x < grid.w - 1; x++)
        if (grid.get(x, y) === T.DOCK && [grid.get(x + 1, y), grid.get(x - 1, y), grid.get(x, y + 1), grid.get(x, y - 1)].some(isWater))
          dockByWater++
    expect(dockByWater).toBeGreaterThan(4)
  })

  it('places every landmark inside a named region', () => {
    for (const lm of BLUEPRINT.landmarks) {
      const r = regionAt(BLUEPRINT.regions, lm.tx + lm.w / 2, lm.ty + lm.h / 2)
      expect(r, lm.id).not.toBeNull()
    }
    expect(regionAt(BLUEPRINT.regions, BLUEPRINT.spawn.x, BLUEPRINT.spawn.y)?.id).toBe('harbor')
  })
})
