import { describe, expect, it } from 'vitest'
import { GROUND_KINDS, GROUND_VARIANTS, paintGround, paintTile, variantAt, type GroundKind } from '../src/art/tiles'
import { fillRect, makeRaster, pixelAt, type RGBA, type Raster } from '../src/art/raster'
import { TILE } from '../src/config'
import { makeRng } from '../src/core/rng'
import {
  HOPPABLE_TERRAIN,
  LOW_KINDS,
  T,
  T_BROOK,
  distanceField,
  floodCount,
  isLand,
  isWalkable,
  isWater,
  ledgeAt,
  makeGrid,
  mask4,
  mask8,
  setLedge,
  type LedgeDir,
  type Terrain,
} from '../src/world/terrain'

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

/* ---------------- v2.5: brook, LOW props, ledges ---------------- */

describe('brook terrain', () => {
  it('blocks walking but is listed as hoppable', () => {
    expect(T_BROOK).toBe(T.BROOK)
    expect(isWalkable(T_BROOK)).toBe(false)
    expect(HOPPABLE_TERRAIN.has(T_BROOK)).toBe(true)
  })

  it('counts as water, never as land, and leaves the sea un-hoppable', () => {
    expect(isWater(T_BROOK)).toBe(true)
    expect(isLand(T_BROOK)).toBe(false)
    expect(HOPPABLE_TERRAIN.has(T.WATER)).toBe(false)
    expect(HOPPABLE_TERRAIN.has(T.RIVER)).toBe(false)
    expect(HOPPABLE_TERRAIN.has(T.DEEP)).toBe(false)
  })

  it('keeps every terrain id that existed before at its old value', () => {
    expect([T.DEEP, T.WATER, T.SHALLOW, T.SAND, T.GRASS, T.PATH, T.CLIFF, T.PLATEAU]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect([T.RIVER, T.BRIDGE, T.DOCK, T.PLAZA, T.POND, T.TALLGRASS]).toEqual([8, 9, 10, 11, 12, 13])
  })
})

describe('low props', () => {
  it('lists exactly the prop kinds a hop can clear', () => {
    expect([...LOW_KINDS].sort()).toEqual(['barrel', 'bush', 'crate', 'fence', 'rock_s'])
  })

  it('excludes anything tall', () => {
    for (const kind of ['tree', 'pine', 'palm', 'lamp', 'bench', 'building']) expect(LOW_KINDS.has(kind)).toBe(false)
  })

  it('leaves flowerbeds out — they are non-solid, so you walk through them', () => {
    expect(LOW_KINDS.has('flowerbed')).toBe(false)
  })
})

describe('ledge layer', () => {
  const DIRS: LedgeDir[] = ['n', 'e', 's', 'w']

  it('is empty until set and roundtrips every direction', () => {
    const g = makeGrid(4, 3, T.GRASS)
    expect(ledgeAt(g, 1, 1)).toBeNull()
    for (const d of DIRS) {
      setLedge(g, 1, 1, d)
      expect(ledgeAt(g, 1, 1)).toBe(d)
    }
    expect(ledgeAt(g, 0, 0)).toBeNull()
    expect(ledgeAt(g, 3, 2)).toBeNull()
  })

  it('runs parallel to the cells and stays independent of the terrain', () => {
    const g = makeGrid(3, 3, T.GRASS)
    expect(g.ledges).toBeInstanceOf(Uint8Array)
    expect(g.ledges.length).toBe(g.cells.length)
    expect(Array.from(g.ledges).every((c) => c === 0)).toBe(true)
    setLedge(g, 2, 1, 'e')
    expect(g.get(2, 1)).toBe(T.GRASS)
    g.set(2, 1, T.CLIFF)
    expect(ledgeAt(g, 2, 1)).toBe('e')
    expect(g.ledges[1 * g.w + 2]).not.toBe(0)
  })

  it('ignores out-of-bounds reads and writes', () => {
    const g = makeGrid(2, 2, T.GRASS)
    expect(ledgeAt(g, -1, 0)).toBeNull()
    expect(ledgeAt(g, 0, 9)).toBeNull()
    expect(() => setLedge(g, 5, 5, 'n')).not.toThrow()
    expect(() => setLedge(g, -1, -1, 's')).not.toThrow()
    expect(Array.from(g.ledges).every((c) => c === 0)).toBe(true)
  })
})

/* ---------------- v2.5: 32px tile painters ---------------- */

const MARK: RGBA = [255, 0, 255, 255]

function shot(kind: GroundKind, variant: number, seed = 4242): Raster {
  const r = makeRaster(TILE, TILE)
  paintGround(r, 0, 0, kind, variant, makeRng(seed))
  return r
}

function differing(a: Raster, b: Raster): number {
  let n = 0
  for (let i = 0; i < a.data.length; i += 4)
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) n++
  return n
}

const isWaterPx = (p: RGBA) => p[3] > 0 && p[2] > p[0] + 30 && p[2] > p[1]
const isSandPx = (p: RGBA) => p[3] > 0 && p[0] > p[1] && p[1] > p[2] && p[0] > 150

function tileShot(paint: (r: Raster) => void): Raster {
  const r = makeRaster(TILE, TILE)
  paint(r)
  return r
}

describe('ground painters', () => {
  it('paints at the 32px tile size', () => {
    expect(TILE).toBe(32)
    expect(GROUND_VARIANTS).toBe(3)
    expect(GROUND_KINDS.length).toBeGreaterThanOrEqual(8)
  })

  it('covers every pixel of a 32×32 tile for every ground kind', () => {
    for (const kind of GROUND_KINDS)
      for (let v = 0; v < GROUND_VARIANTS; v++) {
        const r = shot(kind, v)
        expect(r.w).toBe(32)
        expect(r.h).toBe(32)
        for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) expect(pixelAt(r, x, y)[3], `${kind} v${v} @${x},${y}`).toBeGreaterThan(0)
      }
  })

  it('never paints outside its own tile', () => {
    for (const kind of GROUND_KINDS) {
      const r = makeRaster(TILE * 3, TILE * 3)
      fillRect(r, 0, 0, r.w, r.h, MARK)
      paintGround(r, TILE, TILE, kind, 1, makeRng(11))
      for (let y = 0; y < r.h; y++)
        for (let x = 0; x < r.w; x++) {
          if (x >= TILE && x < TILE * 2 && y >= TILE && y < TILE * 2) continue
          expect(pixelAt(r, x, y), `${kind} bled to ${x},${y}`).toEqual(MARK)
        }
    }
  })

  it('gives every ground kind three visibly different variants', () => {
    for (const kind of GROUND_KINDS) {
      const shots = [0, 1, 2].map((v) => shot(kind, v))
      for (const [a, b] of [
        [0, 1],
        [0, 2],
        [1, 2],
      ])
        expect(differing(shots[a], shots[b]), `${kind} v${a} vs v${b}`).toBeGreaterThan(8)
    }
  })

  it('is deterministic: same kind, variant and seed paint the same pixels', () => {
    for (const kind of GROUND_KINDS) expect(differing(shot(kind, 2), shot(kind, 2))).toBe(0)
  })

  it('spreads variants over the grid deterministically', () => {
    const seen = new Set<number>()
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const v = variantAt(x, y)
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(GROUND_VARIANTS)
        seen.add(v)
      }
    expect(seen.size).toBe(GROUND_VARIANTS)
    expect(variantAt(7, 3)).toBe(variantAt(7, 3))
  })
})

describe('paintTile', () => {
  const LAND: Terrain[] = [T.GRASS, T.TALLGRASS, T.PLATEAU, T.SAND, T.PATH, T.PLAZA, T.DOCK, T.BRIDGE, T.CLIFF]

  it('fills the whole 32px tile for every land terrain', () => {
    for (const t of LAND) {
      const g = makeGrid(3, 3, t)
      const r = tileShot((rr) => paintTile(rr, 0, 0, g, 1, 1))
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) expect(pixelAt(r, x, y)[3], `terrain ${t} @${x},${y}`).toBeGreaterThan(0)
    }
  })

  it('autotiles a sand fringe on the beach side only', () => {
    const g = makeGrid(3, 3, T.GRASS)
    g.set(2, 1, T.SAND)
    const r = tileShot((rr) => paintTile(rr, 0, 0, g, 1, 1))
    const column = (x: number) => Array.from({ length: TILE }, (_, y) => pixelAt(r, x, y))
    expect(column(TILE - 1).some(isSandPx), 'east edge should carry the beach fringe').toBe(true)
    expect(column(0).some(isSandPx), 'west edge should stay grass').toBe(false)
  })

  it('paints the brook as a narrow channel between banks', () => {
    const g = makeGrid(5, 5, T.GRASS)
    for (let y = 1; y <= 3; y++) g.set(2, y, T_BROOK)
    const r = tileShot((rr) => paintTile(rr, 0, 0, g, 2, 2))
    const column = (x: number) => Array.from({ length: TILE }, (_, y) => pixelAt(r, x, y))
    expect(column(TILE / 2).some(isWaterPx), 'the channel should hold water').toBe(true)
    for (const x of [0, 1, 2, TILE - 3, TILE - 2, TILE - 1])
      expect(column(x).some(isWaterPx), `bank column ${x} should be dry`).toBe(false)
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) expect(pixelAt(r, x, y)[3], `brook hole @${x},${y}`).toBeGreaterThan(0)
  })
})
