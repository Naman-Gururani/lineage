import { describe, expect, it } from 'vitest'
import { WORLD_SEED, WORLD_TH, WORLD_TW } from '../src/config'
import { makeRng } from '../src/core/rng'
import { BLUEPRINT, footprintContains, inShape, rasterizeBlueprint } from '../src/world/blueprint'
import { regionAt } from '../src/world/regions'
import { HOPPABLE_TERRAIN, T, T_BROOK, floodCount, floodMask, isLand, isWalkable, isWater, ledgeAt } from '../src/world/terrain'

// zoom/tile/speed constants now live in tests/config.test.ts

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

const grid = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))
/** Walkable without wading — the shallows ring the whole island. */
const dry = (t: number) => isWalkable(t as 0) && t !== T.SHALLOW
const tiles = (pass: (t: number) => boolean) => {
  const out: { x: number; y: number }[] = []
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (pass(grid.get(x, y))) out.push({ x, y })
  return out
}
/** Every outdoor spot the player is meant to stand on or walk to. */
const outdoorSpots = () => [
  ...BLUEPRINT.packetSpots.map((p, i) => ({ id: `packet ${i}`, p })),
  ...BLUEPRINT.chestSpots.map((p, i) => ({ id: `chest ${i}`, p })),
  ...BLUEPRINT.shellSpots.map((p, i) => ({ id: `shell ${i}`, p })),
  ...Object.entries(BLUEPRINT.npcSpots).map(([id, p]) => ({ id: `npc ${id}`, p })),
  { id: 'spawn', p: BLUEPRINT.spawn },
  { id: 'fishing', p: BLUEPRINT.fishingSpot },
  { id: 'viewpoint', p: BLUEPRINT.viewpoint },
]

describe('BLUEPRINT rasterisation', () => {
  it('has the world size', () => {
    expect(grid.w).toBe(WORLD_TW)
    expect(grid.h).toBe(WORLD_TH)
  })

  it('is deterministic', () => {
    const again = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))
    expect(again.cells).toEqual(grid.cells)
    expect(again.ledges).toEqual(grid.ledges)
  })

  it('puts every landmark footprint on land with a walkable door', () => {
    for (const lm of BLUEPRINT.landmarks) {
      for (let y = lm.ty; y < lm.ty + lm.h; y++)
        for (let x = lm.tx; x < lm.tx + lm.w; x++) expect(isLand(grid.get(x, y)), `${lm.id} footprint ${x},${y}`).toBe(true)
      expect(isWalkable(grid.get(lm.door.x, lm.door.y)), `${lm.id} door`).toBe(true)
      expect(isWalkable(grid.get(lm.door.x, lm.door.y + 1)), `${lm.id} door approach`).toBe(true)
    }
  })

  it('connects the spawn to every door, spot and landmark on dry ground', () => {
    const s = BLUEPRINT.spawn
    expect(isWalkable(grid.get(s.x, s.y))).toBe(true)
    // shallows are walkable, so wading would make anything coastal "reachable":
    // the island has to hold together on dry footing alone.
    const reach = floodMask(grid, s.x, s.y, dry)
    const at = (p: { x: number; y: number }) => reach[Math.floor(p.y) * grid.w + Math.floor(p.x)]
    for (const lm of BLUEPRINT.landmarks) expect(at(lm.door), `door of ${lm.id}`).toBe(1)
    for (const { id, p } of outdoorSpots()) expect(at(p), `${id} at ${p.x},${p.y}`).toBe(1)
    expect(floodCount(grid, s.x, s.y, dry)).toBeGreaterThan(3000)
  })

  it('has twenty packet spots spread over every region', () => {
    expect(BLUEPRINT.packetSpots.length).toBe(20)
    const per = new Map<string, number>()
    for (const p of BLUEPRINT.packetSpots) {
      const r = regionAt(BLUEPRINT.regions, p.x + 0.5, p.y + 0.5)
      expect(r, `packet ${p.x},${p.y} has no region`).not.toBeNull()
      per.set(r!.id, (per.get(r!.id) ?? 0) + 1)
    }
    // 20 packets over 9 regions cannot give every region three, so the two
    // smallest (the Point, the campus lawn) carry one and two.
    for (const r of BLUEPRINT.regions) expect(per.get(r.id) ?? 0, `packets in ${r.id}`).toBeGreaterThanOrEqual(r.id === 'point' ? 1 : 2)
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
    // both bridges land on dry ground at either end
    for (const b of BLUEPRINT.bridges) {
      expect(isWalkable(grid.get(b.x, b.y)), `west end of bridge ${b.x},${b.y}`).toBe(true)
      expect(isWalkable(grid.get(b.x + b.w - 1, b.y)), `east end of bridge ${b.x},${b.y}`).toBe(true)
    }
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

describe('landmarks', () => {
  it('has nine, with the campus and the warehouse', () => {
    expect(BLUEPRINT.landmarks.map((l) => l.id).sort()).toEqual([
      'about', 'contact', 'education', 'experience', 'lineage', 'safestride', 'skills', 'stealth', 'warehouse',
    ])
  })

  it('marks only the warehouse minor', () => {
    expect(BLUEPRINT.landmarks.filter((l) => l.minor).map((l) => l.id)).toEqual(['warehouse'])
  })

  it('puts each door on the footprint’s south face', () => {
    for (const lm of BLUEPRINT.landmarks) {
      expect(lm.door.y, `${lm.id} door row`).toBe(lm.ty + lm.h)
      expect(lm.door.x, `${lm.id} door column`).toBeGreaterThanOrEqual(lm.tx)
      expect(lm.door.x, `${lm.id} door column`).toBeLessThan(lm.tx + lm.w)
      expect(lm.sprite).toMatch(/^bld_/)
      expect(lm.room.length).toBeGreaterThan(0)
    }
  })

  it('keeps every landmark inside the world', () => {
    for (const lm of BLUEPRINT.landmarks) {
      expect(lm.tx, lm.id).toBeGreaterThanOrEqual(1)
      expect(lm.ty, lm.id).toBeGreaterThanOrEqual(1)
      expect(lm.tx + lm.w, lm.id).toBeLessThan(WORLD_TW)
      expect(lm.ty + lm.h + 1, lm.id).toBeLessThan(WORLD_TH)
    }
  })
})

describe('the brook', () => {
  const brook = tiles((t) => t === T_BROOK)

  it('carves a channel of T_BROOK you cannot walk but can hop', () => {
    expect(brook.length).toBeGreaterThanOrEqual(12)
    expect(isWalkable(T_BROOK)).toBe(false)
    expect(HOPPABLE_TERRAIN.has(T_BROOK)).toBe(true)
  })

  it('is exactly one tile wide', () => {
    const isBrook = (x: number, y: number) => grid.inb(x, y) && grid.get(x, y) === T_BROOK
    for (const { x, y } of brook) {
      // no 2x2 block anywhere: that would be a two-wide channel
      expect(isBrook(x + 1, y) && isBrook(x, y + 1) && isBrook(x + 1, y + 1), `2x2 brook at ${x},${y}`).toBe(false)
      const n = [isBrook(x + 1, y), isBrook(x - 1, y), isBrook(x, y + 1), isBrook(x, y - 1)].filter(Boolean).length
      expect(n, `brook branches at ${x},${y}`).toBeLessThanOrEqual(2)
    }
  })

  it('runs unbroken from the pond to the willow coast', () => {
    const start = brook[0]
    expect(floodCount(grid, start.x, start.y, (t) => t === T_BROOK)).toBe(brook.length)
    const head = brook.reduce((a, b) => (a.y < b.y ? a : b))
    const foot = brook.reduce((a, b) => (a.y > b.y ? a : b))
    const near = (p: { x: number; y: number }, pass: (t: number) => boolean, r = 2) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (grid.inb(p.x + dx, p.y + dy) && pass(grid.get(p.x + dx, p.y + dy))) return true
      return false
    }
    expect(near(head, (t) => t === T.POND), 'brook head by the pond').toBe(true)
    expect(near(foot, (t) => t === T.SAND || t === T.SHALLOW || t === T.WATER || t === T.DEEP), 'brook foot at the coast').toBe(true)
  })

  it('never holds two brook tiles on one row', () => {
    // a 1.5-tile hop clears a single blocked tile, never a pair side by side —
    // whether a given bank is clear of scattered trees is scatter's business
    const perRow = new Map<number, number>()
    for (const { y } of brook) perRow.set(y, (perRow.get(y) ?? 0) + 1)
    for (const [y, n] of perRow) expect(n, `row ${y} holds ${n} brook tiles`).toBe(1)
  })

  it('has no bridge over it — the hop is the crossing', () => {
    for (const b of BLUEPRINT.bridges)
      for (const { x, y } of brook)
        expect(x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h, `bridge over the brook at ${x},${y}`).toBe(false)
  })
})

describe('ledges', () => {
  const marked = tiles(() => true).filter((p) => ledgeAt(grid, p.x, p.y) !== null)

  it('marks at least a dozen cliff lips', () => {
    expect(marked.length).toBeGreaterThanOrEqual(12)
  })

  it('marks only cliff tiles with somewhere to land below', () => {
    const step = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] } as const
    for (const { x, y } of marked) {
      const d = ledgeAt(grid, x, y)!
      expect(grid.get(x, y), `ledge at ${x},${y} is not a cliff`).toBe(T.CLIFF)
      const [dx, dy] = step[d]
      expect(isWalkable(grid.get(x + dx * 2, y + dy * 2)), `landing beyond ledge ${x},${y}`).toBe(true)
      expect([T.PLATEAU, T.CLIFF].includes(grid.get(x - dx, y - dy) as 6 | 7), `high ground above ledge ${x},${y}`).toBe(true)
    }
  })
})

describe('roads', () => {
  it('connects every road end to the path network', () => {
    const reach = floodMask(grid, BLUEPRINT.spawn.x, BLUEPRINT.spawn.y, dry)
    const paved = new Set<number>([T.PATH, T.PLAZA, T.DOCK, T.BRIDGE])
    for (const [a, b] of BLUEPRINT.roads)
      for (const p of [a, b]) {
        expect(isWalkable(grid.get(p.x, p.y)), `road end ${p.x},${p.y} walkable`).toBe(true)
        expect(reach[p.y * grid.w + p.x], `road end ${p.x},${p.y} reachable`).toBe(1)
        let near = false
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (grid.inb(p.x + dx, p.y + dy) && paved.has(grid.get(p.x + dx, p.y + dy))) near = true
        expect(near, `road end ${p.x},${p.y} has no paving within 2 tiles`).toBe(true)
      }
  })

  it('paves a real network', () => {
    expect(tiles((t) => t === T.PATH).length).toBeGreaterThan(300)
  })
})

describe('spots and props', () => {
  it('stands every outdoor spot on walkable ground, clear of buildings', () => {
    for (const { id, p } of outdoorSpots()) {
      expect(isWalkable(grid.get(Math.floor(p.x), Math.floor(p.y))), `${id} at ${p.x},${p.y}`).toBe(true)
      for (const lm of BLUEPRINT.landmarks) expect(footprintContains(lm, p.x, p.y), `${id} inside ${lm.id}`).toBe(false)
      for (const pr of BLUEPRINT.props)
        if (pr.solid) expect(p.x >= pr.solid.x && p.x < pr.solid.x + pr.solid.w && p.y >= pr.solid.y && p.y < pr.solid.y + pr.solid.h, `${id} inside prop ${pr.kind}`).toBe(false)
    }
  })

  it('never puts two spots on the same tile', () => {
    const seen = new Map<string, string>()
    for (const { id, p } of outdoorSpots()) {
      const key = `${Math.floor(p.x)},${Math.floor(p.y)}`
      expect(seen.has(key), `${id} shares ${key} with ${seen.get(key)}`).toBe(false)
      seen.set(key, id)
    }
  })

  it('counts six chests and five shells', () => {
    expect(BLUEPRINT.chestSpots.length).toBe(6)
    expect(BLUEPRINT.shellSpots.length).toBe(5)
  })

  it('puts the spawn on the pier head and the fishing spot on the pier', () => {
    expect(grid.get(BLUEPRINT.fishingSpot.x, BLUEPRINT.fishingSpot.y)).toBe(T.DOCK)
    let dockNear = false
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (grid.get(BLUEPRINT.spawn.x + dx, BLUEPRINT.spawn.y + dy) === T.DOCK) dockNear = true
    expect(dockNear, 'spawn is not by the pier').toBe(true)
  })

  it('keeps prop collision boxes off the roads', () => {
    for (const p of BLUEPRINT.props) {
      if (!p.solid) continue
      for (let y = Math.floor(p.solid.y); y < p.solid.y + p.solid.h; y++)
        for (let x = Math.floor(p.solid.x); x < p.solid.x + p.solid.w; x++)
          expect(grid.get(x, y), `prop ${p.kind} blocks a road at ${x},${y}`).not.toBe(T.PATH)
    }
  })
})

describe('regions', () => {
  it('names nine, including the campus green', () => {
    expect(BLUEPRINT.regions.length).toBe(9)
    expect(BLUEPRINT.regions.map((r) => r.id).sort()).toEqual(['campus', 'engine', 'fields', 'harbor', 'heights', 'meadow', 'point', 'ridge', 'woods'])
    const campus = BLUEPRINT.regions.find((r) => r.id === 'campus')!
    expect(campus.name).toBe('Campus Green')
    expect(regionAt(BLUEPRINT.regions, 58.5, 28.5)?.id).toBe('campus')
  })

  it('covers every landmark door with the right region', () => {
    const home: Record<string, string> = {
      about: 'meadow',
      experience: 'heights',
      skills: 'woods',
      lineage: 'engine',
      stealth: 'ridge',
      safestride: 'fields',
      contact: 'point',
      education: 'campus',
      warehouse: 'harbor',
    }
    for (const lm of BLUEPRINT.landmarks) expect(regionAt(BLUEPRINT.regions, lm.door.x + 0.5, lm.door.y + 0.5)?.id, `door of ${lm.id}`).toBe(home[lm.id])
  })

  it('covers the whole island', () => {
    let uncovered = 0
    for (let y = 0; y < grid.h; y++)
      for (let x = 0; x < grid.w; x++) if (isLand(grid.get(x, y)) && !regionAt(BLUEPRINT.regions, x + 0.5, y + 0.5)) uncovered++
    expect(uncovered).toBe(0)
  })
})
