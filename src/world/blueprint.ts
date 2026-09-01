// The designed island. Shape primitives + a seeded wobble give natural
// coastlines while every landmark, spot and road is placed on purpose.
import { WORLD_SEED, WORLD_TH, WORLD_TW } from '../config'
import { makeNoise } from '../core/noise'
import type { Rng } from '../core/rng'
import { carveRoads } from './paths'
import type { Region, Vec2 } from './regions'
import { T, distanceField, isLand, isWalkable, makeGrid, type Grid, type Terrain } from './terrain'

export type { Vec2, Region }

export type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; wobble?: number }
  | { kind: 'poly'; pts: Vec2[]; wobble?: number }

export type Rect = { x: number; y: number; w: number; h: number }

export type LandmarkId = 'about' | 'experience' | 'skills' | 'lineage' | 'stealth' | 'safestride' | 'contact'

export type Landmark = {
  id: LandmarkId
  /** footprint (collision) in tiles — the sprite extends upward from its base */
  tx: number
  ty: number
  w: number
  h: number
  door: Vec2
  sprite: string
  room: string
}

export type Prop = { kind: string; x: number; y: number; solid?: Rect; id?: string }

export type Blueprint = {
  land: Shape[]
  sandWidth: number
  plateaus: Shape[]
  ramps: Rect[]
  river: { pts: Vec2[]; width: number }
  ponds: Shape[]
  plaza: Shape
  docks: Rect[]
  bridges: Rect[]
  tallGrass: Shape[]
  roads: [Vec2, Vec2][]
  landmarks: Landmark[]
  regions: Region[]
  spawn: Vec2
  npcSpots: Record<string, Vec2>
  packetSpots: Vec2[]
  chestSpots: Vec2[]
  shellSpots: Vec2[]
  fishingSpot: Vec2
  viewpoint: Vec2
  props: Prop[]
}

const E = (cx: number, cy: number, rx: number, ry: number, wobble = 0.1): Shape => ({ kind: 'ellipse', cx, cy, rx, ry, wobble })
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })
const V = (x: number, y: number): Vec2 => ({ x, y })
const P = (...xy: number[]): Vec2[] => {
  const out: Vec2[] = []
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] })
  return out
}

export const BLUEPRINT: Blueprint = {
  land: [
    E(80, 60, 58, 40, 0.16), // main body
    E(80, 98, 24, 12, 0.1), // harbor bulge (south)
    E(120, 32, 30, 20, 0.12), // whispering woods (north-east)
    E(38, 30, 28, 20, 0.1), // tower heights (north-west)
    E(82, 22, 26, 16, 0.1), // stone ridge (north)
    E(34, 84, 22, 16, 0.1), // engine works (south-west)
    E(122, 86, 24, 14, 0.08), // willow fields (south-east)
    E(146, 106, 8, 6, 0.06), // the point (lighthouse)
  ],
  sandWidth: 2,
  plateaus: [E(38, 30, 20, 13, 0.06), E(82, 16, 15, 7, 0.05)],
  ramps: [R(44, 40, 4, 5), R(84, 21, 4, 5)],
  river: { pts: P(43, 46, 48, 52, 53, 60, 54, 68, 50, 76, 44, 84, 38, 92, 34, 100, 31, 108), width: 3 },
  ponds: [E(108, 90, 5, 3, 0.1)],
  plaza: E(80, 66, 9, 6, 0),
  docks: [R(79, 103, 3, 11), R(140, 92, 2, 13), R(24, 91, 2, 8)],
  bridges: [R(47, 55, 7, 2), R(42, 81, 8, 2)],
  tallGrass: [E(66, 80, 5, 3), E(96, 50, 6, 3), E(112, 46, 5, 3), E(130, 76, 6, 3), E(60, 36, 5, 3), E(102, 100, 5, 2), E(36, 72, 4, 3), E(140, 44, 4, 3), E(70, 22, 5, 3), E(18, 92, 4, 3)],
  roads: [
    [V(80, 101), V(80, 73)], // harbor → plaza
    [V(80, 59), V(80, 55)], // plaza → cottage door
    [V(71, 66), V(46, 46)], // plaza → ramp foot
    [V(46, 46), V(37, 33)], // ramp → tower door
    [V(89, 66), V(121, 31)], // plaza → workshop
    [V(84, 57), V(81, 15)], // cottage → vault (via ridge ramp)
    [V(71, 66), V(27, 90)], // plaza → engine
    [V(89, 66), V(120, 85)], // plaza → safe stride
    [V(120, 85), V(146, 106)], // safe stride → lighthouse (walkway)
  ],
  landmarks: [
    { id: 'about', tx: 78, ty: 52, w: 5, h: 3, door: V(80, 55), sprite: 'bld_about', room: 'about' },
    { id: 'experience', tx: 34, ty: 29, w: 6, h: 4, door: V(37, 33), sprite: 'bld_experience', room: 'experience' },
    { id: 'skills', tx: 118, ty: 28, w: 6, h: 3, door: V(121, 31), sprite: 'bld_skills', room: 'skills' },
    { id: 'lineage', tx: 24, ty: 86, w: 7, h: 4, door: V(27, 90), sprite: 'bld_lineage', room: 'lineage' },
    { id: 'stealth', tx: 79, ty: 12, w: 5, h: 3, door: V(81, 15), sprite: 'bld_stealth', room: 'stealth' },
    { id: 'safestride', tx: 118, ty: 82, w: 5, h: 3, door: V(120, 85), sprite: 'bld_safestride', room: 'safestride' },
    { id: 'contact', tx: 145, ty: 104, w: 3, h: 2, door: V(146, 106), sprite: 'bld_contact', room: 'contact' },
  ],
  regions: [
    { id: 'harbor', name: 'Harbor', poly: P(58, 90, 102, 90, 102, 118, 58, 118) },
    { id: 'point', name: 'The Point', poly: P(134, 96, 158, 96, 158, 118, 134, 118) },
    { id: 'ridge', name: 'Stone Ridge', poly: P(60, 2, 104, 2, 104, 30, 60, 30) },
    { id: 'woods', name: 'Whispering Woods', poly: P(104, 2, 158, 2, 158, 56, 88, 56, 88, 30, 104, 30) },
    { id: 'heights', name: 'Tower Heights', poly: P(2, 2, 60, 2, 60, 48, 2, 48) },
    { id: 'engine', name: 'Engine Works', poly: P(2, 48, 58, 48, 58, 108, 2, 108) },
    { id: 'fields', name: 'Willow Fields', poly: P(100, 56, 152, 56, 152, 96, 134, 96, 134, 100, 100, 100) },
    { id: 'meadow', name: 'Sunny Meadow', poly: P(58, 30, 100, 30, 100, 90, 58, 90) },
  ],
  spawn: V(80, 100),
  npcSpots: {
    mira: V(78, 101),
    tomas: V(81, 108),
    pip: V(88, 103),
    lou: V(76, 70),
    sol: V(32, 91),
    devi: V(124, 90),
    arjun: V(126, 92),
    ilse: V(144, 108),
    cat: V(84, 106),
  },
  packetSpots: P(84, 58, 66, 70, 96, 74, 70, 96, 92, 106, 56, 80, 48, 60, 30, 40, 24, 28, 34, 80, 20, 92, 100, 20, 70, 22, 110, 40, 134, 20, 140, 44, 128, 70, 110, 96, 146, 110, 142, 80),
  chestSpots: P(22, 36, 64, 26, 146, 30, 136, 96, 16, 90),
  shellSpots: P(64, 106, 70, 108, 76, 109, 86, 109, 93, 107),
  fishingSpot: V(80, 112),
  viewpoint: V(22, 30),
  props: [
    { kind: 'fountain', x: 80, y: 66, solid: R(78.5, 65, 3, 2) },
    { kind: 'signpost', x: 82, y: 76, id: 'harbor' },
    { kind: 'signpost', x: 91, y: 64, id: 'plaza_e' },
    { kind: 'signpost', x: 69, y: 64, id: 'plaza_w' },
    { kind: 'signpost', x: 102, y: 50, id: 'woods' },
    { kind: 'signpost', x: 52, y: 50, id: 'bridge_a' },
    { kind: 'signpost', x: 52, y: 80, id: 'bridge_b' },
    { kind: 'signpost', x: 86, y: 30, id: 'ridge' },
    { kind: 'signpost', x: 132, y: 92, id: 'point' },
    { kind: 'windmill', x: 132, y: 24, solid: R(130.5, 22.5, 3, 2) },
    { kind: 'boat', x: 80, y: 117 },
    { kind: 'telescope', x: 22, y: 29, solid: R(21.5, 28.5, 1, 1) },
    { kind: 'well', x: 74, y: 58, solid: R(73, 57, 2, 2) },
    { kind: 'stall', x: 86, y: 72, solid: R(84.5, 71, 3, 2) },
    { kind: 'crate', x: 77, y: 103, solid: R(76.5, 102.5, 1, 1) },
    { kind: 'crate', x: 83, y: 103, solid: R(82.5, 102.5, 1, 1) },
    { kind: 'barrel', x: 22, y: 93, solid: R(21.5, 92.5, 1, 1) },
    { kind: 'barrel', x: 28, y: 93, solid: R(27.5, 92.5, 1, 1) },
    { kind: 'bell', x: 148, y: 107, solid: R(147.5, 106.5, 1, 1) },
    { kind: 'mailbox', x: 84, y: 55, solid: R(83.5, 54.5, 1, 1) },
  ],
}

/* ------------------------------------------------------------------ */

export function inShape(s: Shape, x: number, y: number, noise: (x: number, y: number) => number): boolean {
  const w = s.wobble ?? 0
  if (s.kind === 'ellipse') {
    const d = Math.hypot((x - s.cx) / s.rx, (y - s.cy) / s.ry)
    const threshold = w ? 1 + (noise(x, y) - 0.5) * 2 * w : 1
    return d <= threshold
  }
  // polygon (ray casting); wobble ignored for polygons
  let inside = false
  const pts = s.pts
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x
    const yi = pts[i].y
    const xj = pts[j].x
    const yj = pts[j].y
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const l2 = vx * vx + vy * vy
  let t = l2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

function polylineDist(pts: Vec2[], x: number, y: number): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const d = segDist(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)
    if (d < best) best = d
  }
  return best
}

function fillRect(grid: Grid, r: Rect, t: Terrain, only?: (cur: Terrain) => boolean) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!grid.inb(x, y)) continue
      if (only && !only(grid.get(x, y))) continue
      grid.set(x, y, t)
    }
}

function eachTile(grid: Grid, fn: (x: number, y: number, t: Terrain) => void) {
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) fn(x, y, grid.get(x, y))
}

/** Majority smoothing: removes single-tile islands and holes. */
function smoothLand(grid: Grid, passes: number) {
  for (let p = 0; p < passes; p++) {
    const src = new Uint8Array(grid.cells)
    const land = (x: number, y: number) => (grid.inb(x, y) ? src[y * grid.w + x] === T.GRASS : false)
    eachTile(grid, (x, y) => {
      let n = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && land(x + dx, y + dy)) n++
      const isL = src[y * grid.w + x] === T.GRASS
      if (isL && n < 3) grid.set(x, y, T.DEEP)
      else if (!isL && n > 5) grid.set(x, y, T.GRASS)
    })
  }
}

export function footprintContains(lm: Landmark, x: number, y: number, margin = 0): boolean {
  return x >= lm.tx - margin && x < lm.tx + lm.w + margin && y >= lm.ty - margin && y < lm.ty + lm.h + margin
}

export function rasterizeBlueprint(bp: Blueprint, rng: Rng): Grid {
  const grid = makeGrid(WORLD_TW, WORLD_TH, T.DEEP)
  const noise = makeNoise(rng.fork('coast'))

  // 1. land
  eachTile(grid, (x, y) => {
    for (const s of bp.land)
      if (inShape(s, x + 0.5, y + 0.5, noise)) {
        grid.set(x, y, T.GRASS)
        break
      }
  })
  smoothLand(grid, 2)

  // 2. guarantee designed spots are land
  const force = (x: number, y: number) => {
    if (grid.inb(x, y) && !isLand(grid.get(x, y))) grid.set(x, y, T.GRASS)
  }
  for (const lm of bp.landmarks) {
    for (let y = lm.ty - 1; y <= lm.ty + lm.h; y++) for (let x = lm.tx - 1; x <= lm.tx + lm.w; x++) force(x, y)
    force(lm.door.x, lm.door.y)
    force(lm.door.x, lm.door.y + 1)
  }
  force(bp.spawn.x, bp.spawn.y)
  for (const p of [...bp.packetSpots, ...bp.chestSpots, ...Object.values(bp.npcSpots), bp.viewpoint]) force(Math.floor(p.x), Math.floor(p.y))

  // 3. beach ring (distance to sea) and shallows (distance to land)
  const toSea = distanceField(grid, (t) => t !== T.DEEP)
  eachTile(grid, (x, y, t) => {
    if (t === T.GRASS && toSea[y * grid.w + x] <= bp.sandWidth) grid.set(x, y, T.SAND)
  })
  const toLand = distanceField(grid, (t) => t === T.DEEP)
  eachTile(grid, (x, y, t) => {
    if (t !== T.DEEP) return
    const d = toLand[y * grid.w + x]
    if (d <= 2) grid.set(x, y, T.SHALLOW)
    else if (d <= 7) grid.set(x, y, T.WATER)
  })

  // 4. plateaus with cliff rings, then ramps
  for (const s of bp.plateaus) {
    eachTile(grid, (x, y, t) => {
      if ((t === T.GRASS || t === T.SAND) && inShape(s, x + 0.5, y + 0.5, noise)) grid.set(x, y, T.PLATEAU)
    })
  }
  const snapshot = new Uint8Array(grid.cells)
  eachTile(grid, (x, y, t) => {
    if (t !== T.PLATEAU) return
    // 8-connected ring so diagonal steps leave no holes in the wall
    outer: for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx
        const ny = y + dy
        if (!grid.inb(nx, ny)) continue
        if (snapshot[ny * grid.w + nx] !== T.PLATEAU) {
          grid.set(x, y, T.CLIFF)
          break outer
        }
      }
  })
  for (const r of bp.ramps) fillRect(grid, r, T.PATH, (t) => t === T.CLIFF || t === T.PLATEAU || t === T.GRASS || t === T.SAND)

  // 5. river, ponds
  const riverRng = rng.fork('river')
  const wob = new Float32Array(grid.w * grid.h)
  for (let i = 0; i < wob.length; i++) wob[i] = riverRng.next() * 0.6
  eachTile(grid, (x, y, t) => {
    if (t !== T.GRASS && t !== T.SAND && t !== T.TALLGRASS) return
    const d = polylineDist(bp.river.pts, x + 0.5, y + 0.5)
    if (d <= bp.river.width / 2 + wob[y * grid.w + x] - 0.3) grid.set(x, y, T.RIVER)
  })
  for (const s of bp.ponds)
    eachTile(grid, (x, y, t) => {
      if ((t === T.GRASS || t === T.SAND) && inShape(s, x + 0.5, y + 0.5, noise)) grid.set(x, y, T.POND)
    })

  // 6. plaza, tall grass
  eachTile(grid, (x, y, t) => {
    if ((t === T.GRASS || t === T.SAND) && inShape(bp.plaza, x + 0.5, y + 0.5, noise)) grid.set(x, y, T.PLAZA)
  })
  for (const s of bp.tallGrass)
    eachTile(grid, (x, y, t) => {
      if (t === T.GRASS && inShape(s, x + 0.5, y + 0.5, noise)) grid.set(x, y, T.TALLGRASS)
    })

  // 7. docks and bridges
  for (const r of bp.docks) fillRect(grid, r, T.DOCK)
  for (const r of bp.bridges) {
    fillRect(grid, r, T.BRIDGE, (t) => t === T.RIVER)
    fillRect(grid, r, T.PATH, (t) => t === T.GRASS || t === T.SAND || t === T.TALLGRASS)
  }

  // 8. landmark footprints stay dry and doors walkable
  for (const lm of bp.landmarks) {
    for (let y = lm.ty; y < lm.ty + lm.h; y++)
      for (let x = lm.tx; x < lm.tx + lm.w; x++) if (!isLand(grid.get(x, y)) || grid.get(x, y) === T.CLIFF) grid.set(x, y, T.GRASS)
    if (!isWalkable(grid.get(lm.door.x, lm.door.y))) grid.set(lm.door.x, lm.door.y, T.GRASS)
    if (!isWalkable(grid.get(lm.door.x, lm.door.y + 1))) grid.set(lm.door.x, lm.door.y + 1, T.GRASS)
  }
  for (const p of [...bp.packetSpots, ...bp.chestSpots, ...Object.values(bp.npcSpots), bp.viewpoint, bp.spawn]) {
    const x = Math.floor(p.x)
    const y = Math.floor(p.y)
    if (!isWalkable(grid.get(x, y))) grid.set(x, y, T.GRASS)
  }

  // 9. roads (never through buildings)
  const avoid = (x: number, y: number) => bp.landmarks.some((lm) => footprintContains(lm, x, y))
  carveRoads(grid, bp.roads, rng.fork('roads'), avoid)

  return grid
}
