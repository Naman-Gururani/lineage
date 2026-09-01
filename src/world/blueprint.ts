// The designed island. Shape primitives + a seeded wobble give natural
// coastlines while every landmark, spot and road is placed on purpose.
import { WORLD_SEED, WORLD_TH, WORLD_TW } from '../config'
import { makeNoise } from '../core/noise'
import type { Rng } from '../core/rng'
import { carveRoads } from './paths'
import type { Region, Vec2 } from './regions'
import { T, T_BROOK, distanceField, isLand, isWalkable, makeGrid, setLedge, type Grid, type LedgeDir, type Terrain } from './terrain'

export type { Vec2, Region }

export type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; wobble?: number }
  | { kind: 'poly'; pts: Vec2[]; wobble?: number }

export type Rect = { x: number; y: number; w: number; h: number }

export type LandmarkId =
  | 'about'
  | 'experience'
  | 'skills'
  | 'lineage'
  | 'stealth'
  | 'safestride'
  | 'contact'
  | 'education'
  | 'warehouse'

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
  /** Set for buildings that are scenery with a door: no discovery, journal line or map label. */
  minor?: boolean
}

export type Prop = { kind: string; x: number; y: number; solid?: Rect; id?: string }

/**
 * A run of cliff-ring tiles marked as a one-way hop-down lip. `from`/`to` are
 * inclusive tile coordinates along `axis`; `box` picks which plateau.
 */
export type LedgeBand = { dir: LedgeDir; axis: 'x' | 'y'; from: number; to: number; box: Rect }

export type Blueprint = {
  land: Shape[]
  sandWidth: number
  plateaus: Shape[]
  ramps: Rect[]
  river: { pts: Vec2[]; width: number }
  /** One-tile stream from the pond to the willow coast. No bridge: you hop it. */
  brook: { pts: Vec2[] }
  ledges: LedgeBand[]
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
    E(48, 36, 35, 24, 0.16), // main body
    E(48, 59, 15, 8, 0.1), // harbor bulge (south)
    E(72, 19, 18, 12, 0.12), // whispering woods (north-east)
    E(23, 18, 17, 12, 0.1), // tower heights (north-west)
    E(49, 13, 16, 10, 0.1), // stone ridge (north)
    E(20, 50, 14, 10, 0.1), // engine works (south-west)
    E(73, 52, 15, 9, 0.08), // willow fields (south-east)
    E(88, 63, 5, 4, 0.06), // the point (lighthouse)
  ],
  sandWidth: 2,
  plateaus: [E(23, 18, 12, 8, 0.06), E(49, 10, 9, 4, 0.05)],
  // Each ramp overlaps its cliff ring so the climb is continuous.
  ramps: [R(26, 23, 4, 6), R(49, 12, 4, 5)],
  // Springs at the foot of the tower cliff, clear of the ramp above it.
  river: { pts: P(25, 29, 29, 31, 32, 36, 32, 41, 30, 46, 26, 50, 23, 55, 20, 60, 19, 65), width: 2 },
  // Dead straight on purpose: a 4-connected jog would leave two brook tiles
  // side by side on the turn row, and a 1.5-tile hop cannot clear two.
  brook: { pts: P(66, 44, 66, 48, 66, 52, 66, 56, 66, 59) },
  ledges: [
    { dir: 's', axis: 'x', from: 20, to: 27, box: R(10, 8, 28, 22) }, // tower plateau, south lip
    { dir: 'e', axis: 'y', from: 14, to: 21, box: R(10, 8, 28, 22) }, // tower plateau, east lip
    { dir: 's', axis: 'x', from: 46, to: 53, box: R(38, 4, 22, 14) }, // stone ridge, south lip
  ],
  ponds: [E(66, 43, 4, 2, 0.1)],
  plaza: E(48, 40, 8, 5, 0),
  docks: [R(47, 60, 3, 8), R(13, 53, 2, 6), R(76, 55, 2, 8), R(76, 61, 11, 2)],
  bridges: [R(29, 38, 6, 2), R(22, 52, 7, 2)],
  tallGrass: [E(40, 48, 4, 2), E(58, 34, 4, 2), E(68, 28, 3, 2), E(76, 44, 4, 2), E(36, 30, 3, 2), E(56, 50, 3, 2), E(26, 44, 3, 2), E(80, 26, 3, 2)],
  roads: [
    [V(48, 58), V(48, 45)], // harbor → plaza
    [V(48, 37), V(48, 34)], // plaza → cottage door
    [V(41, 40), V(28, 28)], // plaza → tower ramp foot
    [V(26, 24), V(23, 21)], // ramp top → tower door
    [V(55, 38), V(60, 30)], // plaza → campus door
    [V(63, 29), V(71, 20)], // campus → workshop door
    [V(45, 32), V(49, 12)], // cottage → vault (up the ridge ramp)
    [V(41, 42), V(19, 52)], // plaza → engine
    [V(55, 42), V(73, 52)], // plaza → safe stride (round the pond; the brook is a hop)
    [V(73, 52), V(76, 55)], // safe stride → boardwalk
    [V(47, 58), V(44, 58)], // harbor → warehouse
  ],
  landmarks: [
    { id: 'about', tx: 46, ty: 31, w: 5, h: 3, door: V(48, 34), sprite: 'bld_about', room: 'about' },
    { id: 'experience', tx: 20, ty: 17, w: 6, h: 4, door: V(23, 21), sprite: 'bld_experience', room: 'experience' },
    { id: 'skills', tx: 69, ty: 16, w: 5, h: 4, door: V(71, 20), sprite: 'bld_skills', room: 'skills' },
    { id: 'lineage', tx: 16, ty: 48, w: 6, h: 4, door: V(19, 52), sprite: 'bld_lineage', room: 'lineage' },
    { id: 'stealth', tx: 47, ty: 8, w: 5, h: 3, door: V(49, 11), sprite: 'bld_stealth', room: 'stealth' },
    { id: 'safestride', tx: 71, ty: 49, w: 4, h: 3, door: V(73, 52), sprite: 'bld_safestride', room: 'safestride' },
    { id: 'contact', tx: 87, ty: 61, w: 3, h: 3, door: V(88, 64), sprite: 'bld_contact', room: 'contact' },
    { id: 'education', tx: 57, ty: 26, w: 6, h: 4, door: V(60, 30), sprite: 'bld_campus', room: 'campus' },
    { id: 'warehouse', tx: 42, ty: 55, w: 4, h: 3, door: V(44, 58), sprite: 'bld_warehouse', room: 'warehouse', minor: true },
  ],
  regions: [
    { id: 'heights', name: 'Tower Heights', poly: P(0, 0, 36, 0, 36, 34, 0, 34) },
    { id: 'ridge', name: 'Stone Ridge', poly: P(36, 0, 58, 0, 58, 22, 36, 22) },
    { id: 'campus', name: 'Campus Green', poly: P(50, 22, 68, 22, 68, 34, 50, 34) },
    { id: 'woods', name: 'Whispering Woods', poly: P(58, 0, 96, 0, 96, 34, 68, 34, 68, 22, 58, 22) },
    { id: 'meadow', name: 'Sunny Meadow', poly: P(36, 22, 50, 22, 50, 34, 62, 34, 62, 47, 34, 47, 34, 34, 36, 34) },
    { id: 'engine', name: 'Engine Works', poly: P(0, 34, 34, 34, 34, 47, 38, 47, 38, 72, 0, 72) },
    { id: 'harbor', name: 'Harbor', poly: P(38, 47, 62, 47, 62, 72, 38, 72) },
    { id: 'fields', name: 'Willow Fields', poly: P(62, 34, 96, 34, 96, 47, 80, 47, 80, 72, 62, 72) },
    { id: 'point', name: 'The Point', poly: P(80, 47, 96, 47, 96, 72, 80, 72) },
  ],
  spawn: V(48, 59),
  npcSpots: {
    mira: V(47, 57),
    tomas: V(49, 61),
    pip: V(52, 57),
    lou: V(46, 41),
    sol: V(21, 54),
    devi: V(62, 31),
    arjun: V(69, 54),
    ilse: V(85, 63),
    cat: V(53, 61),
  },
  // 20 motes: three each in the harbor, meadow and woods; two in every other
  // region; one out on the Point.
  packetSpots: P(44, 62, 54, 56, 41, 53, 43, 33, 56, 46, 37, 40, 17, 20, 30, 20, 43, 14, 55, 15, 64, 12, 76, 22, 84, 12, 26, 58, 13, 46, 78, 42, 70, 57, 55, 32, 66, 26, 91, 61),
  chestSpots: P(18, 14, 52, 9, 78, 15, 16, 58, 79, 50, 65, 25),
  shellSpots: P(42, 63, 45, 65, 52, 64, 56, 62, 91, 65),
  fishingSpot: V(48, 66),
  viewpoint: V(23, 13),
  props: [
    { kind: 'fountain', x: 48, y: 40, solid: R(46.5, 39, 3, 2) },
    // Finger posts. Every arm's heading is checked against these tiles in
    // tests/signs.test.ts — move one and the bearing test tells you.
    { kind: 'sign_finger', x: 50, y: 57, id: 'harbor' },
    { kind: 'sign_finger', x: 43, y: 40, id: 'plaza_w' },
    { kind: 'sign_finger', x: 53, y: 40, id: 'plaza_e' },
    { kind: 'sign_finger', x: 62, y: 32, id: 'campus' },
    { kind: 'sign_finger', x: 30, y: 37, id: 'bridge_tower' },
    { kind: 'sign_finger', x: 26, y: 51, id: 'bridge_engine' },
    { kind: 'sign_finger', x: 48, y: 17, id: 'ridge' },
    { kind: 'sign_finger', x: 70, y: 54, id: 'willow' },
    { kind: 'windmill', x: 79, y: 11, solid: R(77.5, 9.5, 3, 2) },
    { kind: 'boat', x: 45, y: 64 },
    { kind: 'telescope', x: 23, y: 12, solid: R(22.5, 11.5, 1, 1) },
    { kind: 'well', x: 43, y: 36, solid: R(42, 35, 2, 2) },
    { kind: 'stall', x: 53, y: 44, solid: R(51.5, 43, 3, 2) },
    { kind: 'crate', x: 45, y: 61, solid: R(44.5, 60.5, 1, 1) },
    { kind: 'crate', x: 51, y: 61, solid: R(50.5, 60.5, 1, 1) },
    { kind: 'barrel', x: 15, y: 53, solid: R(14.5, 52.5, 1, 1) },
    { kind: 'barrel', x: 17, y: 55, solid: R(16.5, 54.5, 1, 1) },
    { kind: 'bell', x: 90, y: 64, solid: R(89.5, 63.5, 1, 1) },
    { kind: 'mailbox', x: 52, y: 34, solid: R(51.5, 33.5, 1, 1) },
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

/** Tiles from a to b, one orthogonal step at a time — a 4-connected staircase. */
function walkLine4(a: Vec2, b: Vec2): Vec2[] {
  const pts: Vec2[] = [{ x: a.x, y: a.y }]
  let x = a.x
  let y = a.y
  while (x !== b.x || y !== b.y) {
    if (Math.abs(b.x - x) > Math.abs(b.y - y)) x += Math.sign(b.x - x)
    else y += Math.sign(b.y - y)
    pts.push({ x, y })
  }
  return pts
}

const LEDGE_STEP: Record<LedgeDir, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }

/**
 * Mark the cliff-ring tiles named by the blueprint as one-way hop-down lips.
 * Runs on the finished grid so ramps and roads (which overwrite ring tiles)
 * are never marked, and so every landing is checked against final terrain.
 */
function markLedges(grid: Grid, bands: LedgeBand[]) {
  for (const b of bands) {
    const [dx, dy] = LEDGE_STEP[b.dir]
    for (let y = b.box.y; y < b.box.y + b.box.h; y++)
      for (let x = b.box.x; x < b.box.x + b.box.w; x++) {
        if (!grid.inb(x, y) || grid.get(x, y) !== T.CLIFF) continue
        const along = b.axis === 'x' ? x : y
        if (along < b.from || along > b.to) continue
        const above = grid.inb(x - dx, y - dy) ? grid.get(x - dx, y - dy) : T.DEEP
        if (above !== T.PLATEAU && above !== T.CLIFF) continue // nothing to step off
        const below = grid.inb(x + dx, y + dy) ? grid.get(x + dx, y + dy) : T.DEEP
        if (below === T.CLIFF || below === T.PLATEAU || !isWalkable(below)) continue
        const landing = grid.inb(x + dx * 2, y + dy * 2) ? grid.get(x + dx * 2, y + dy * 2) : T.DEEP
        if (!isWalkable(landing)) continue
        setLedge(grid, x, y, b.dir)
      }
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
  // The brook is carved here, after smoothLand: a single-tile channel would be
  // filled straight back in by the majority filter if it were cut any earlier.
  for (let i = 1; i < bp.brook.pts.length; i++)
    for (const p of walkLine4(bp.brook.pts[i - 1], bp.brook.pts[i])) {
      if (!grid.inb(p.x, p.y)) continue
      const t = grid.get(p.x, p.y)
      if (t === T.GRASS || t === T.SAND || t === T.TALLGRASS) grid.set(p.x, p.y, T_BROOK)
    }

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

  // 10. cliff lips you can drop off (one-way), on the settled grid
  markLedges(grid, bp.ledges)

  return grid
}
