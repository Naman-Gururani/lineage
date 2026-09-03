import { describe, expect, it } from 'vitest'
import { WORLD_SEED, WORLD_TH, WORLD_TW } from '../src/config'
import { makeRng } from '../src/core/rng'
import type { RasterReport, Rect } from '../src/world/blueprint'
import { BLUEPRINT, attractionSolids, boundarySolids, fenceRing, footprintContains, inRect, inShape, rasterizeBlueprint, structureSolids } from '../src/world/blueprint'
import type { Vec2 } from '../src/world/regions'
import { regionAt } from '../src/world/regions'
import { T, isLand, isWalkable } from '../src/world/terrain'

// zoom/tile/speed constants live in tests/config.test.ts

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
const at = (p: Vec2) => grid.get(Math.floor(p.x), Math.floor(p.y))
const tiles = (pass: (t: number) => boolean) => {
  const out: Vec2[] = []
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (pass(grid.get(x, y))) out.push({ x, y })
  return out
}

/** Every collectible and every tile someone stands on. */
const outdoorSpots = () => [
  ...BLUEPRINT.packetSpots.map((p, i) => ({ id: `ticket ${i}`, p })),
  ...BLUEPRINT.chestSpots.map((p, i) => ({ id: `prize box ${i}`, p })),
  ...BLUEPRINT.shellSpots.map((p, i) => ({ id: `balloon ${i}`, p })),
  ...Object.entries(BLUEPRINT.npcSpots).map(([id, p]) => ({ id: `npc ${id}`, p })),
  { id: 'spawn', p: BLUEPRINT.spawn },
  { id: 'fishing', p: BLUEPRINT.fishingSpot },
  { id: 'viewpoint', p: BLUEPRINT.viewpoint },
]
/**
 * The guide's stations. Kept apart from `outdoorSpots` for one reason: the first
 * one shares Bo's own tile on purpose — the ticket step happens where he stands
 * — so they take the ground checks but not the "no two spots on one tile" one.
 */
const guideStations = () => Object.entries(BLUEPRINT.storySpots).map(([id, p]) => ({ id: `station ${id}`, p }))
const standableSpots = () => [...outdoorSpots(), ...guideStations()]

/**
 * The park as the player meets it once the ticket is won: the fence line, the
 * gate arch's pillars (which carry that line across the arch's own footprint),
 * and everything else solid — props and structures alike. The turnstiles are
 * gone by then, so the gate is open; `sealOpening` shuts it, which is how the
 * tests prove there is no second way in.
 */
const boundary = (sealOpening: boolean) => {
  const blocked = new Uint8Array(grid.w * grid.h)
  const mark = (x: number, y: number) => {
    if (grid.inb(x, y)) blocked[y * grid.w + x] = 1
  }
  const markRect = (r: Rect) => {
    for (let y = Math.floor(r.y); y < r.y + r.h; y++) for (let x = Math.floor(r.x); x < r.x + r.w; x++) mark(x, y)
  }
  for (const f of fenceRing(BLUEPRINT)) mark(f.x, f.y)
  for (const a of BLUEPRINT.attractions) for (const r of attractionSolids(a)) markRect(r)
  // a prop or a structure must never be able to wall off a door in silence
  for (const p of BLUEPRINT.props) if (p.solid) markRect(p.solid)
  for (const r of structureSolids(BLUEPRINT, (f) => f === 'ticket')) markRect(r)
  if (sealOpening) {
    const g = BLUEPRINT.gateOpening
    for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) mark(x, y)
  }
  return blocked
}

/** Flood the walking surface — lawn, gravel and paving — around a boundary. */
const walk = (start: Vec2, blocked: Uint8Array) => {
  const seen = new Uint8Array(grid.w * grid.h)
  const can = (x: number, y: number) => {
    if (!grid.inb(x, y) || blocked[y * grid.w + x]) return false
    const t = grid.get(x, y)
    return t === T.GRASS || t === T.PATH || t === T.PLAZA
  }
  if (!can(start.x, start.y)) return seen
  const stack = [start.y * grid.w + start.x]
  seen[stack[0]] = 1
  while (stack.length) {
    const i = stack.pop()!
    const x = i % grid.w
    const y = (i - x) / grid.w
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
      if (!grid.inb(nx, ny) || seen[ny * grid.w + nx] || !can(nx, ny)) continue
      seen[ny * grid.w + nx] = 1
      stack.push(ny * grid.w + nx)
    }
  }
  return seen
}

/**
 * A flood that ignores the ground entirely: only hard, full-tile solids stop it.
 * That is how the park boundary behaves at runtime, where every tile of the fair
 * is walkable and only the registered solids hold the line.
 */
const floodSolids = (start: Vec2, rects: Rect[]) => {
  const blocked = new Uint8Array(grid.w * grid.h)
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (grid.inb(x, y)) blocked[y * grid.w + x] = 1
  const seen = new Uint8Array(grid.w * grid.h)
  const can = (x: number, y: number) => grid.inb(x, y) && !blocked[y * grid.w + x]
  if (!can(start.x, start.y)) return seen
  const stack = [start.y * grid.w + start.x]
  seen[stack[0]] = 1
  while (stack.length) {
    const i = stack.pop()!
    const x = i % grid.w
    const y = (i - x) / grid.w
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
      if (!can(nx, ny) || seen[ny * grid.w + nx]) continue
      seen[ny * grid.w + nx] = 1
      stack.push(ny * grid.w + nx)
    }
  }
  return seen
}

/** How many tiles strictly inside the fence a flood reached. */
const leaksInside = (seen: Uint8Array) => {
  const f = BLUEPRINT.fence
  let n = 0
  for (let y = f.y + 1; y < f.y + f.h - 1; y++) for (let x = f.x + 1; x < f.x + f.w - 1; x++) if (seen[y * grid.w + x]) n++
  return n
}

describe('BLUEPRINT rasterisation', () => {
  it('has the fairground size', () => {
    expect(grid.w).toBe(WORLD_TW)
    expect(grid.h).toBe(WORLD_TH)
    expect([WORLD_TW, WORLD_TH]).toEqual([72, 56])
  })

  it('is deterministic', () => {
    const again = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))
    expect(again.cells).toEqual(grid.cells)
    expect(again.ledges).toEqual(grid.ledges)
  })

  it('is a flat park: lawn, paving, gravel and one pond, nothing else', () => {
    const kinds = new Set<number>()
    for (let i = 0; i < grid.cells.length; i++) kinds.add(grid.cells[i])
    expect([...kinds].sort((a, b) => a - b)).toEqual([T.GRASS, T.PATH, T.PLAZA, T.POND, T.TALLGRASS].sort((a, b) => a - b))
    // no sea, no beach, no cliffs, no ledges to hop down
    expect(grid.ledges.some((c) => c !== 0)).toBe(false)
    for (const f of ['plateaus', 'ramps', 'ledges', 'docks', 'bridges'] as const) expect(BLUEPRINT[f], f).toEqual([])
    expect(BLUEPRINT.river).toEqual({ pts: [], width: 0 })
    expect(BLUEPRINT.brook).toEqual({ pts: [] })
    expect(BLUEPRINT.sandWidth).toBe(0)
  })

  it('paves the apron, the midway and the avenue', () => {
    expect(BLUEPRINT.plazas.length).toBe(3)
    for (const p of [{ x: 35, y: 54 }, { x: 30, y: 42 }, { x: 35, y: 25 }]) expect(at(p), `${p.x},${p.y}`).toBe(T.PLAZA)
    expect(tiles((t) => t === T.PLAZA).length).toBeGreaterThan(300)
    expect(tiles((t) => t === T.PATH).length).toBeGreaterThan(120)
  })

  it('digs one duck pond with a dry bank at the fishing spot', () => {
    const pond = tiles((t) => t === T.POND)
    expect(pond.length).toBeGreaterThan(20)
    const f = BLUEPRINT.fishingSpot
    expect(isWalkable(at(f))).toBe(true)
    const touching = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, -1]].some(([dx, dy]) => grid.get(f.x + dx, f.y + dy) === T.POND)
    expect(touching, 'the fishing spot is not on the pond bank').toBe(true)
  })
})

describe('attractions', () => {
  it('has the eight the fair is made of', () => {
    expect(BLUEPRINT.attractions.map((a) => a.id)).toEqual(['gate', 'coaster', 'prizetent', 'forge', 'flight', 'arcade', 'duckpond', 'guestbook'])
  })

  it('names them — the one place the banners and the map pins read from', () => {
    expect(Object.fromEntries(BLUEPRINT.attractions.map((a) => [a.id, a.name]))).toEqual({
      gate: 'Ticket Booth',
      coaster: 'Career Coaster',
      prizetent: 'Prize Tent',
      forge: 'Word Forge',
      flight: 'Chalk Flight',
      arcade: 'Arcade',
      duckpond: 'Duck Pond',
      guestbook: 'Guestbook',
    })
  })

  it('maps each one to the chapters it delivers', () => {
    const zones: Record<string, string[]> = {
      gate: ['about'],
      coaster: ['education', 'experience'],
      prizetent: ['lineage', 'safestride', 'stealth'],
      forge: ['skills'],
      flight: [],
      arcade: [],
      duckpond: [],
      guestbook: ['contact'],
    }
    const interacts: Record<string, string> = {
      gate: 'booth:bo',
      coaster: 'ride:coaster',
      prizetent: 'minigame:claw',
      forge: 'minigame:forge',
      flight: 'minigame:flappy',
      arcade: 'minigame:crew',
      duckpond: 'duckpond',
      guestbook: 'panel:zone:contact',
    }
    for (const a of BLUEPRINT.attractions) {
      expect(a.zones, a.id).toEqual(zones[a.id])
      expect(a.interact, a.id).toBe(interacts[a.id])
      expect(a.sprite.length, a.id).toBeGreaterThan(0)
    }
    // every zone the fair tells is delivered by exactly one attraction
    const all = BLUEPRINT.attractions.flatMap((a) => a.zones)
    expect(new Set(all).size).toBe(all.length)
  })

  it('stands every footprint on lawn or paving, never on a gravel road', () => {
    for (const a of BLUEPRINT.attractions)
      for (let y = a.ty; y < a.ty + a.h; y++)
        for (let x = a.tx; x < a.tx + a.w; x++) {
          expect(isLand(grid.get(x, y)), `${a.id} footprint ${x},${y}`).toBe(true)
          expect(grid.get(x, y), `${a.id} footprint ${x},${y} on a road`).not.toBe(T.PATH)
        }
  })

  it('keeps every door walkable, on the south face and inside the world', () => {
    for (const a of BLUEPRINT.attractions) {
      expect(isWalkable(at(a.door)), `${a.id} door`).toBe(true)
      expect(a.door.x, `${a.id} door column`).toBeGreaterThanOrEqual(a.tx)
      expect(a.door.x, `${a.id} door column`).toBeLessThan(a.tx + a.w)
      expect(a.door.y, `${a.id} door row`).toBeGreaterThanOrEqual(a.ty + a.h)
      expect(a.tx, a.id).toBeGreaterThanOrEqual(1)
      expect(a.tx + a.w, a.id).toBeLessThan(WORLD_TW)
      expect(a.door.y, a.id).toBeLessThan(WORLD_TH)
    }
  })

  it('makes only the gate arch’s pillars solid, so its middle is the way in', () => {
    const gate = BLUEPRINT.attractions.find((a) => a.id === 'gate')!
    expect(gate.solidCols).toEqual([[0, 1], [6, 7]])
    expect(attractionSolids(gate)).toEqual([{ x: 32, y: 48, w: 2, h: 4 }, { x: 38, y: 48, w: 2, h: 4 }])
    // the four tiles between the pillars are the gate opening
    for (let x = BLUEPRINT.gateOpening.x; x < BLUEPRINT.gateOpening.x + BLUEPRINT.gateOpening.w; x++)
      expect(isWalkable(grid.get(x, BLUEPRINT.gateOpening.y)), `opening ${x}`).toBe(true)
    for (const a of BLUEPRINT.attractions) if (a.id !== 'gate') expect(a.solidCols, a.id).toBeUndefined()
  })

  it('walks from the gate to every door without leaving the ground', () => {
    const g = BLUEPRINT.gateOpening
    const reach = walk({ x: g.x, y: g.y }, boundary(false))
    for (const a of BLUEPRINT.attractions) expect(reach[a.door.y * grid.w + a.door.x], `door of ${a.id}`).toBe(1)
    for (const { id, p } of standableSpots()) expect(reach[Math.floor(p.y) * grid.w + Math.floor(p.x)], `${id} at ${p.x},${p.y}`).toBe(1)
    expect(reach.reduce<number>((n, v) => n + v, 0)).toBeGreaterThan(2000)
  })
})

describe('the fence', () => {
  it('runs the whole perimeter with one gap — the gate', () => {
    const f = BLUEPRINT.fence
    const ring = fenceRing(BLUEPRINT)
    const perimeter = 2 * f.w + 2 * (f.h - 2)
    expect(ring.length).toBe(perimeter - BLUEPRINT.gateOpening.w)
    for (const t of ring) {
      const onEdge = t.x === f.x || t.x === f.x + f.w - 1 || t.y === f.y || t.y === f.y + f.h - 1
      expect(onEdge, `fence tile ${t.x},${t.y} is not on the boundary`).toBe(true)
      expect(inRect(BLUEPRINT.gateOpening, t.x, t.y), `fence tile ${t.x},${t.y} blocks the gate`).toBe(false)
    }
    expect(ring.filter((t) => t.v === 2).length).toBeGreaterThanOrEqual(4) // corner and end posts
    expect(new Set(ring.map((t) => `${t.x},${t.y}`)).size).toBe(ring.length)
  })

  it('encloses the park: sealed, nothing outside can reach in', () => {
    const sealed = walk({ x: 0, y: 0 }, boundary(true))
    let leaks = 0
    for (let y = BLUEPRINT.fence.y + 1; y < BLUEPRINT.fence.y + BLUEPRINT.fence.h - 1; y++)
      for (let x = BLUEPRINT.fence.x + 1; x < BLUEPRINT.fence.x + BLUEPRINT.fence.w - 1; x++) if (sealed[y * grid.w + x]) leaks++
    expect(leaks, 'the fence has a hole somewhere other than the gate').toBe(0)
    // and it really is the gate that opens it: unsealed, the outside walks in
    const open = walk({ x: 0, y: 0 }, boundary(false))
    expect(open[42 * grid.w + 30], 'the gate opening does not let you in').toBe(1)
    expect(open[Math.floor(BLUEPRINT.spawn.y) * grid.w + Math.floor(BLUEPRINT.spawn.x)]).toBe(1)
  })

  it('carries the boundary as hard, full-tile rects — the ring minus the gate', () => {
    const rects = boundarySolids(BLUEPRINT)
    expect(rects.length).toBeLessThanOrEqual(8)
    const key = (x: number, y: number) => `${x},${y}`
    const covered = new Set<string>()
    for (const r of rects) {
      expect(r.w, `empty rect at ${r.x},${r.y}`).toBeGreaterThan(0)
      expect(r.h, `empty rect at ${r.x},${r.y}`).toBeGreaterThan(0)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          // no rect overlaps another: the ring is a partition, not a pile
          expect(covered.has(key(x, y)), `two boundary rects both cover ${x},${y}`).toBe(false)
          covered.add(key(x, y))
        }
    }
    // the union is exactly the fence ring's tile set, checked both directions
    const ring = new Set(fenceRing(BLUEPRINT).map((t) => key(t.x, t.y)))
    for (const k of ring) expect(covered.has(k), `boundary misses fence tile ${k}`).toBe(true)
    for (const k of covered) expect(ring.has(k), `boundary covers ${k}, which is not a fence tile`).toBe(true)
    expect(covered.size).toBe(ring.size)
    // the gate opening stays clear: the turnstile seals it, not the ring
    const g = BLUEPRINT.gateOpening
    for (let x = g.x; x < g.x + g.w; x++) expect(covered.has(key(x, g.y)), `boundary across the gate at ${x},${g.y}`).toBe(false)
  })

  it('shuts the park at runtime: hard solids alone, no terrain, nothing walks in', () => {
    // The runtime twin of the enclosure test above. Terrain is ignored — the only
    // thing between the outside world and the fair is the boundary ring plus the
    // turnstiles standing in the gate.
    const shut = floodSolids({ x: 0, y: 0 }, [...boundarySolids(BLUEPRINT), ...structureSolids(BLUEPRINT, () => false)])
    expect(leaksInside(shut), 'something walks through the boundary solids').toBe(0)
    // and it is the turnstile that holds it: once the ticket is won, the gate opens
    const open = floodSolids({ x: 0, y: 0 }, [...boundarySolids(BLUEPRINT), ...structureSolids(BLUEPRINT, (f) => f === 'ticket')])
    expect(leaksInside(open), 'the gate does not open when the ticket flag is set').toBeGreaterThan(2000)
  })

  it('leaves the arrival apron outside and the whole park inside', () => {
    const f = BLUEPRINT.fence
    expect(BLUEPRINT.spawn.y).toBeGreaterThan(f.y + f.h - 1)
    for (const a of BLUEPRINT.attractions) {
      if (a.id === 'gate') continue // the arch straddles the fence by design
      expect(a.tx, `${a.id} west of the fence`).toBeGreaterThan(f.x)
      expect(a.ty, `${a.id} north of the fence`).toBeGreaterThan(f.y)
      expect(a.tx + a.w, `${a.id} east of the fence`).toBeLessThan(f.x + f.w)
      expect(a.ty + a.h, `${a.id} south of the fence`).toBeLessThan(f.y + f.h)
    }
  })
})

describe('spots and props', () => {
  it('counts twenty lost tickets, six prize boxes and five balloons', () => {
    expect(BLUEPRINT.packetSpots.length).toBe(20)
    expect(BLUEPRINT.chestSpots.length).toBe(6)
    expect(BLUEPRINT.shellSpots.length).toBe(5)
  })

  it('names the guide’s five stations and the ten who work the fair', () => {
    expect(Object.keys(BLUEPRINT.storySpots).sort()).toEqual(['guestbook', 'prizes', 'ride', 'ticket', 'toolkit'])
    expect(Object.keys(BLUEPRINT.npcSpots).sort()).toEqual(['arjun', 'cat', 'dockmaster', 'ilse', 'mira', 'pip', 'professor', 'ravi', 'sol', 'tomas'])
  })

  it('stands every spot on ground that was already walkable — the generator rescues none', () => {
    // The generator forces designed spots walkable, so asking the finished grid
    // whether they are walkable proves nothing. Ask instead what it had to
    // force: a spot that needs rescuing is a spot the layout put in the pond.
    const report: RasterReport = { cleared: [] }
    rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED), report)
    expect(report.cleared.map((c) => `${c.x},${c.y} (terrain ${c.from})`)).toEqual([])
  })

  it('keeps every spot clear of the attractions, the props and the structures', () => {
    for (const { id, p } of standableSpots()) {
      expect(isWalkable(at(p)), `${id} at ${p.x},${p.y}`).toBe(true)
      for (const a of BLUEPRINT.attractions) expect(footprintContains(a, p.x, p.y), `${id} inside ${a.id}`).toBe(false)
      for (const pr of BLUEPRINT.props) if (pr.solid) expect(inRect(pr.solid, p.x, p.y), `${id} inside prop ${pr.kind}`).toBe(false)
      for (const s of BLUEPRINT.structures) for (const r of s.solid) expect(inRect(r, p.x, p.y), `${id} inside structure ${s.sprite}`).toBe(false)
      expect(regionAt(BLUEPRINT.regions, p.x + 0.5, p.y + 0.5), `${id} has no region`).not.toBeNull()
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

  it('spreads the lost tickets over every region of the park', () => {
    const per = new Map<string, number>()
    for (const p of BLUEPRINT.packetSpots) {
      const r = regionAt(BLUEPRINT.regions, p.x + 0.5, p.y + 0.5)
      expect(r, `ticket ${p.x},${p.y} has no region`).not.toBeNull()
      per.set(r!.id, (per.get(r!.id) ?? 0) + 1)
    }
    for (const r of BLUEPRINT.regions) expect(per.get(r.id) ?? 0, `tickets in ${r.id}`).toBeGreaterThanOrEqual(1)
  })

  it('posts six finger signs at the fair’s junctions', () => {
    const posts = BLUEPRINT.props.filter((p) => p.kind === 'sign_finger')
    expect(posts.map((p) => p.id)).toEqual(['gate', 'midway_w', 'midway_e', 'hill', 'pond', 'wheel'])
    for (const s of posts) {
      expect(isWalkable(grid.get(s.x, s.y)), `sign ${s.id} on ${s.x},${s.y}`).toBe(true)
      for (const a of BLUEPRINT.attractions) expect(footprintContains(a, s.x, s.y), `sign ${s.id} inside ${a.id}`).toBe(false)
    }
  })

  it('keeps prop collision boxes off the roads and out of the attractions', () => {
    for (const p of BLUEPRINT.props) {
      if (!p.solid) continue
      for (let y = Math.floor(p.solid.y); y < p.solid.y + p.solid.h; y++)
        for (let x = Math.floor(p.solid.x); x < p.solid.x + p.solid.w; x++) {
          expect(grid.get(x, y), `prop ${p.kind} blocks a road at ${x},${y}`).not.toBe(T.PATH)
          for (const a of BLUEPRINT.attractions) expect(footprintContains(a, x, y), `prop ${p.kind} inside ${a.id}`).toBe(false)
        }
    }
  })

  it('dresses the midway with props, and only with things a tile can centre', () => {
    const kinds = BLUEPRINT.props.map((p) => p.kind)
    for (const k of ['fountain', 'cart_food_0', 'cart_food_1', 'cart_balloons', 'board_forge', 'arcade_sign']) expect(kinds, k).toContain(k)
    // the big things are structures now: a prop is drawn at its tile's centre,
    // which cannot align a sprite whose width is an even number of tiles
    for (const k of ['ticket_booth', 'turnstile', 'ferris_wheel', 'coaster_span_0', 'coaster_span_1', 'coaster_span_2']) expect(kinds, k).not.toContain(k)
  })
})

describe('structures', () => {
  const S = BLUEPRINT.structures
  const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const box = (s: { tx: number; ty: number; w: number; h: number }): Rect => ({ x: s.tx, y: s.ty, w: s.w, h: s.h })

  it('is where the rides, the booth and the turnstiles live', () => {
    expect(S.map((s) => s.sprite)).toEqual(['coaster_span_0', 'coaster_span_1', 'coaster_span_2', 'ferris_wheel', 'ticket_booth', 'turnstile', 'turnstile'])
    expect(S.map((s) => [s.tx, s.ty, s.w, s.h])).toEqual([
      [12, 6, 16, 10],
      [28, 6, 16, 10],
      [44, 6, 16, 10],
      [55, 13, 8, 10],
      [28, 48, 3, 3],
      [34, 51, 2, 1],
      [36, 51, 2, 1],
    ])
  })

  it('stands every one inside the fence, clear of the pond and of each other', () => {
    const f = BLUEPRINT.fence
    const pond = tiles((t) => t === T.POND)
    for (const s of S) {
      if (s.gate) {
        // the turnstiles are the exception: they stand *on* the fence row, in the gap
        expect(s.ty, `${s.sprite} off the fence row`).toBe(f.y + f.h - 1)
      } else {
        expect(s.tx, `${s.sprite} west of the fence`).toBeGreaterThan(f.x)
        expect(s.ty, `${s.sprite} north of the fence`).toBeGreaterThan(f.y)
        expect(s.tx + s.w, `${s.sprite} east of the fence`).toBeLessThan(f.x + f.w)
        expect(s.ty + s.h, `${s.sprite} south of the fence`).toBeLessThan(f.y + f.h)
      }
      for (const p of pond) expect(footprintContains(s, p.x, p.y), `${s.sprite} stands in the pond`).toBe(false)
      // Never on top of something solid the player has to walk up to — with one
      // deliberate exception: the coaster station stands flush against the right
      // foot of `coaster_span_2`, sharing its bottom edge (y16 = 512 px) so the
      // parked cart sits on the platform. Task 7 draws attractions after
      // structures at equal depth, so the station reads as being in front.
      for (const a of BLUEPRINT.attractions) {
        if (a.id === 'coaster' && s.sprite === 'coaster_span_2') continue
        for (const r of attractionSolids(a)) expect(overlap(box(s), r), `${s.sprite} overlaps ${a.id}`).toBe(false)
      }
    }
    // No two structures fight over the same ground…
    for (let i = 0; i < S.length; i++)
      for (let j = i + 1; j < S.length; j++)
        for (const a of S[i].solid) for (const b of S[j].solid) expect(overlap(a, b), `${S[i].sprite} and ${S[j].sprite} claim the same ground`).toBe(false)
    // …and the only pair whose *sprites* share tiles is the coaster track passing
    // behind the wheel, which is skyline, not ground: the wheel's base row (22)
    // is south of the span's (15), so it draws in front. Pinned so a third
    // structure cannot quietly join the pile.
    const pairs: string[] = []
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) if (overlap(box(S[i]), box(S[j]))) pairs.push(`${S[i].sprite}+${S[j].sprite}`)
    expect(pairs).toEqual(['coaster_span_2+ferris_wheel'])
  })

  it('keeps every solid inside its own footprint', () => {
    for (const s of S) {
      expect(s.solid.length, `${s.sprite} has no solid`).toBeGreaterThan(0)
      for (const r of s.solid) {
        expect(r.x, `${s.sprite} solid west of its footprint`).toBeGreaterThanOrEqual(s.tx)
        expect(r.y, `${s.sprite} solid north of its footprint`).toBeGreaterThanOrEqual(s.ty)
        expect(r.x + r.w, `${s.sprite} solid east of its footprint`).toBeLessThanOrEqual(s.tx + s.w)
        expect(r.y + r.h, `${s.sprite} solid south of its footprint`).toBeLessThanOrEqual(s.ty + s.h)
      }
    }
    // The coaster is not a backdrop you walk under. Its lattice is drawn over the
    // whole footprint, so a base-row-only solid let the player round either end
    // and *into* the ride — under its own timbers, boxed in by the station and
    // the wheel. Every span stops you across all ten of its rows.
    for (const s of S.filter((x) => x.sprite.startsWith('coaster_span')))
      expect(s.solid, s.sprite).toEqual([{ x: s.tx, y: s.ty, w: s.w, h: s.h }])
    // The wheel is the exception that stays: its A-frame stands on one row and
    // the lawn behind it is meant to be walked on.
    const wheel = S.find((x) => x.sprite === 'ferris_wheel')!
    expect(wheel.solid.map((r) => r.h)).toEqual([1])
  })

  it('gates the fair with the two turnstiles, and nothing else', () => {
    const gates = S.filter((s) => s.gate)
    expect(gates.map((s) => [s.sprite, s.gate])).toEqual([['turnstile', 'ticket'], ['turnstile', 'ticket']])
    // together they cover the gate opening exactly
    const g = BLUEPRINT.gateOpening
    const covered = new Set<string>()
    for (const s of gates) for (const r of s.solid) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) covered.add(`${x},${y}`)
    const wanted = new Set<string>()
    for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) wanted.add(`${x},${y}`)
    expect([...covered].sort()).toEqual([...wanted].sort())
  })

  it('lifts the gated solids once the flag is set', () => {
    const shut = structureSolids(BLUEPRINT, () => false)
    const open = structureSolids(BLUEPRINT, (f) => f === 'ticket')
    expect(shut.length).toBe(S.flatMap((s) => s.solid).length)
    expect(shut.length - open.length).toBe(2)
    for (const r of open) expect(inRect(BLUEPRINT.gateOpening, r.x, r.y), `${r.x},${r.y} still blocks the gate`).toBe(false)
    // an unrelated flag changes nothing
    expect(structureSolids(BLUEPRINT, (f) => f === 'lights').length).toBe(shut.length)
  })
})

describe('roads', () => {
  it('connects every road end to the walking surface without crossing the fence', () => {
    const g = BLUEPRINT.gateOpening
    const reach = walk({ x: g.x, y: g.y }, boundary(false))
    const paved = new Set<number>([T.PATH, T.PLAZA])
    for (const [a, b] of BLUEPRINT.roads)
      for (const p of [a, b]) {
        expect(isWalkable(grid.get(p.x, p.y)), `road end ${p.x},${p.y} walkable`).toBe(true)
        expect(reach[p.y * grid.w + p.x], `road end ${p.x},${p.y} reachable`).toBe(1)
        let near = false
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (grid.inb(p.x + dx, p.y + dy) && paved.has(grid.get(p.x + dx, p.y + dy))) near = true
        expect(near, `road end ${p.x},${p.y} has no paving within 2 tiles`).toBe(true)
      }
  })

  it('never lays gravel on the fence line', () => {
    for (const t of fenceRing(BLUEPRINT)) expect(grid.get(t.x, t.y), `road through the fence at ${t.x},${t.y}`).not.toBe(T.PATH)
  })
})

describe('regions', () => {
  it('names the eight parts of the fair', () => {
    expect(BLUEPRINT.regions.map((r) => r.id)).toEqual(['pond', 'wheel', 'hill', 'midway', 'west', 'east', 'apron', 'picnic'])
    const names = Object.fromEntries(BLUEPRINT.regions.map((r) => [r.id, r.name]))
    expect(names).toEqual({
      apron: 'The Gate',
      midway: 'The Midway',
      west: 'Prize Row',
      east: 'Game Row',
      hill: 'Coaster Hill',
      pond: 'Duck Pond',
      wheel: 'Wheel Lawn',
      picnic: 'Picnic Lawn',
    })
  })

  it('covers every attraction door with the right region', () => {
    const home: Record<string, string> = {
      gate: 'apron',
      coaster: 'hill',
      prizetent: 'west',
      forge: 'midway',
      flight: 'west',
      arcade: 'east',
      duckpond: 'pond',
      guestbook: 'apron',
    }
    for (const a of BLUEPRINT.attractions) expect(regionAt(BLUEPRINT.regions, a.door.x + 0.5, a.door.y + 0.5)?.id, `door of ${a.id}`).toBe(home[a.id])
  })

  it('draws each box round the thing it names, and leaves the rest to the picnic lawn', () => {
    const where = (x: number, y: number) => regionAt(BLUEPRINT.regions, x + 0.5, y + 0.5)?.id
    // Coaster Hill is the ride and its station — rows 4..23 — not the whole
    // northern half of the map, which is what it used to swallow.
    expect(where(35, 10), 'under the track').toBe('hill')
    expect(where(52, 17), 'the professor, beside the station').toBe('hill')
    expect(where(35, 22), 'the hill finger post').toBe('hill')
    expect(where(11, 26), 'the water').toBe('pond')
    expect(where(16, 31), 'Tomas at the pond').toBe('pond')
    expect(where(35, 42), 'the fountain').toBe('midway')
    // What is left over is the picnic lawn: the band between the coaster and the
    // midway, and the strip north of the wheel. It is the only region inside the
    // fence where `scatter` plants a tree, so its size is the tree budget.
    for (const [x, y] of [[26, 28], [40, 30], [22, 26], [64, 10]]) expect(where(x, y), `${x},${y}`).toBe('picnic')
    expect(where(35, 36), 'the lawn north of the midway is not the midway').toBe('picnic')
    const area = new Map<string, number>()
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) area.set(where(x, y)!, (area.get(where(x, y)!) ?? 0) + 1)
    for (const [id, n] of area) expect(n, `${id} covers too much of the fair`).toBeLessThan(1100)
    expect(area.get('picnic')!, 'the picnic lawn has to be big enough to plant').toBeGreaterThan(800)
  })

  it('covers every tile of the world', () => {
    let uncovered = 0
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (!regionAt(BLUEPRINT.regions, x + 0.5, y + 0.5)) uncovered++
    expect(uncovered).toBe(0)
  })
})
