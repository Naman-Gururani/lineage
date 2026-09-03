// Deterministic decoration placement for the fairground: the perimeter fence and
// its hedge, lamps and bunting along the avenue and the midway, benches by the
// fountain, flower beds on the midway verges, trees beyond the fence and on the
// picnic lawns, tufts of grass and the life around the duck pond.
// Pure: returns a list the scene turns into sprites and solids.
import { TILE } from '../config'
import type { Rng } from '../core/rng'
import { fenceRing, footprintContains, type Blueprint } from './blueprint'
import { regionAt } from './regions'
import { T, isLand, type Grid, type Terrain } from './terrain'

export type DecorKind =
  | 'tree'
  | 'pine'
  | 'palm'
  | 'bush'
  | 'flower'
  /** Mossy boulder — too tall to hop. */
  | 'rock'
  /** Small stone — solid, but low enough to clear with a hop (see LOW_KINDS). */
  | 'rock_s'
  | 'grass'
  | 'mushroom'
  | 'shell'
  | 'fence'
  | 'lamp'
  | 'bench'
  | 'lily'
  | 'reed'
  | 'stump'
  | 'log'
  | 'flowerbed'
  /** Triangle flags strung between two lamp posts — overhead, never in the way. */
  | 'bunting'

export type Decor = { kind: DecorKind; x: number; y: number; v: number; solid: boolean }

const SOLID: Record<DecorKind, boolean> = {
  tree: true,
  pine: true,
  palm: true,
  bush: true,
  flower: false,
  rock: true,
  rock_s: true,
  grass: false,
  mushroom: false,
  shell: false,
  fence: true,
  lamp: true,
  bench: true,
  lily: false,
  reed: false,
  stump: true,
  log: true,
  flowerbed: false,
  bunting: false,
}

/** Lamps stand this far apart along the avenue and the midway. */
const LAMP_STEP = 6

/** Minimum gap between two trees, in pixels. A fair is not a forest. */
const TREE_GAP = 48

/**
 * How often an eligible tile grows a tree. The belt beyond the fence is thick —
 * it is what the park is set into — while the picnic lawn inside it is planted
 * like a park: enough shade to read as a lawn, never enough to hide a stall.
 */
const TREE_CHANCE_OUT = 0.26
const TREE_CHANCE_IN = 0.22

export function scatterDecor(grid: Grid, bp: Blueprint, rng: Rng): Decor[] {
  const out: Decor[] = []
  const { w, h } = grid
  // Two masks. `reserved` is what the fair has already spoken for — spots,
  // props, doors, the fence — and nothing may ever land on it. `banned` adds the
  // ground the fair is walked on; the street furniture that belongs on paving
  // (lamps, benches, bunting) checks only `reserved`.
  const reserved = new Uint8Array(w * h)
  const banned = new Uint8Array(w * h)
  const ban = (x: number, y: number) => {
    if (grid.inb(x, y)) reserved[y * w + x] = banned[y * w + x] = 1
  }
  const banRadius = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x - cx, y - cy) <= r) ban(x, y)
  }
  for (const a of bp.attractions) {
    for (let y = a.ty - 1; y <= a.ty + a.h; y++) for (let x = a.tx - 1; x <= a.tx + a.w; x++) ban(x, y)
    ban(a.door.x, a.door.y)
    ban(a.door.x, a.door.y + 1)
  }
  banRadius(bp.spawn.x, bp.spawn.y, 3)
  // Villagers and the guide both stand on their spots: a bench or a tree
  // scattered onto one would strand whoever the world puts there.
  for (const p of [...Object.values(bp.npcSpots), ...Object.values(bp.storySpots)]) banRadius(p.x, p.y, 2)
  for (const p of bp.packetSpots) banRadius(p.x, p.y, 1.2)
  for (const p of bp.chestSpots) banRadius(p.x, p.y, 1.2)
  for (const p of bp.shellSpots) banRadius(p.x, p.y, 1.2)
  banRadius(bp.fishingSpot.x, bp.fishingSpot.y, 1.5)
  banRadius(bp.viewpoint.x, bp.viewpoint.y, 2)
  for (const p of bp.props) {
    banRadius(p.x, p.y, 1.5)
    if (p.solid) for (let y = Math.floor(p.solid.y); y < p.solid.y + p.solid.h; y++) for (let x = Math.floor(p.solid.x); x < p.solid.x + p.solid.w; x++) ban(x, y)
  }
  // Structures own their whole footprint, not just the row that stops you: the
  // coaster's spans and the wheel are drawn over everything under them, so a
  // tuft of grass there is a tuft nobody will ever see.
  for (const s of bp.structures) for (let y = s.ty; y < s.ty + s.h; y++) for (let x = s.tx; x < s.tx + s.w; x++) ban(x, y)

  // Nothing green is scattered on water, paving or a road: those are the places
  // the fair is walked, and clutter on them reads as litter.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = grid.get(x, y)
      if (!isLand(t) || t === T.PATH || t === T.PLAZA || t === T.DOCK || t === T.BRIDGE || t === T.CLIFF) banned[y * w + x] = 1
    }

  const free = (x: number, y: number) => grid.inb(x, y) && !banned[y * w + x]
  const open = (x: number, y: number) => grid.inb(x, y) && !reserved[y * w + x]
  const region = (x: number, y: number) => regionAt(bp.regions, x + 0.5, y + 0.5)?.id ?? 'picnic'
  const outside = (x: number, y: number) => x < bp.fence.x || y < bp.fence.y || x >= bp.fence.x + bp.fence.w || y >= bp.fence.y + bp.fence.h
  const px = (x: number, jitter = 0.35) => (x + 0.5 + rng.range(-jitter, jitter)) * TILE
  /** Tile-centred x; decor stands on the bottom edge of its tile. */
  const cx = (x: number) => (x + 0.5) * TILE
  const cy = (y: number) => (y + 0.95) * TILE

  // --- the perimeter fence: the park's edge, and the reason the gate matters ---
  // Emitted whatever the ground is, and only skipped where the gate arch's own
  // pillars carry the line. Ban its tiles so nothing else lands on them.
  const covered = (x: number, y: number) => bp.attractions.some((a) => footprintContains(a, x, y))
  for (const f of fenceRing(bp, covered)) {
    out.push({ kind: 'fence', x: cx(f.x), y: cy(f.y), v: f.v, solid: true })
    ban(f.x, f.y)
  }

  // --- hedges: one ring of bushes just outside the fence, lawn only, so the
  //     paved apron in front of the gate stays clear ---
  const f = bp.fence
  const hedge: [number, number][] = []
  for (let x = f.x - 1; x <= f.x + f.w; x++) {
    hedge.push([x, f.y - 1], [x, f.y + f.h])
  }
  for (let y = f.y; y < f.y + f.h; y++) {
    hedge.push([f.x - 1, y], [f.x + f.w, y])
  }
  for (const [x, y] of hedge) {
    if (!free(x, y) || grid.get(x, y) !== T.GRASS) continue
    out.push({ kind: 'bush', x: cx(x), y: cy(y), v: rng.int(0, 1), solid: true })
    ban(x, y)
  }

  // --- lamps down the avenue and round the midway, with bunting strung between ---
  const lampAt = (x: number, y: number): boolean => {
    if (!open(x, y)) return false
    const t = grid.get(x, y)
    // A post on a gravel road would stand in the middle of the traffic; the
    // paving is wide enough to carry one.
    if (t !== T.GRASS && t !== T.PLAZA && t !== T.TALLGRASS) return false
    out.push({ kind: 'lamp', x: cx(x), y: cy(y), v: 0, solid: true })
    ban(x, y)
    return true
  }
  const av = bp.plazas[2]
  const mid = bp.plazas[1]
  const avX = av.kind === 'poly' ? [av.pts[0].x - 1, av.pts[1].x] : []
  const avY0 = av.kind === 'poly' ? av.pts[0].y : 0
  const avY1 = av.kind === 'poly' ? av.pts[2].y : 0
  for (const x of avX) for (let y = avY0 + 1; y < avY1 - 2; y += LAMP_STEP) lampAt(x, y)
  const midX0 = mid.kind === 'poly' ? mid.pts[0].x : 0
  const midX1 = mid.kind === 'poly' ? mid.pts[1].x : 0
  const midY0 = mid.kind === 'poly' ? mid.pts[0].y : 0
  const midY1 = mid.kind === 'poly' ? mid.pts[2].y : 0
  for (const y of [midY0, midY1 - 1]) {
    const row: number[] = []
    for (let x = midX0 + 1; x < midX1 - 1; x += LAMP_STEP) if (lampAt(x, y)) row.push(x)
    // Bunting hangs at the midpoint of each pair of neighbouring posts.
    for (let i = 1; i < row.length; i++) {
      const bx = (row[i - 1] + row[i]) / 2
      out.push({ kind: 'bunting', x: (bx + 0.5) * TILE, y: cy(y), v: i % 2, solid: false })
    }
  }

  // --- benches: four of them, facing the fountain across the midway ---
  const fountain = bp.props.find((p) => p.kind === 'fountain')
  if (fountain)
    for (const [dx, dy] of [[-3, -2], [-3, 0], [4, -2], [4, 0]] as const) {
      const x = Math.round(fountain.x + dx)
      const y = Math.round(fountain.y + dy)
      if (!open(x, y) || grid.get(x, y) === T.PATH) continue
      out.push({ kind: 'bench', x: cx(x), y: cy(y), v: dx < 0 ? 0 : 1, solid: true })
      ban(x, y)
    }

  // --- flower beds along the midway's two long verges ---
  for (const y of [midY0 - 1, midY1]) {
    for (let x = midX0 + 1; x < midX1 - 1; x += 2) {
      if (!free(x, y) || grid.get(x, y) !== T.GRASS) continue
      out.push({ kind: 'flowerbed', x: cx(x), y: cy(y), v: 0, solid: false })
      ban(x, y)
    }
  }

  // --- trees: the belt beyond the fence, and the picnic lawns inside it ---
  // Never within two tiles of paving or of an attraction: the fair has to stay
  // walkable, and a tree in the middle of a stall's approach reads as a bug.
  const nearPaved = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = grid.get(x, y)
      const near = t === T.PATH || t === T.PLAZA || bp.attractions.some((a) => footprintContains(a, x, y))
      if (!near) continue
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (grid.inb(x + dx, y + dy)) nearPaved[(y + dy) * w + x + dx] = 1
    }
  // The hash cell has to be at least the spacing radius, or the 3×3 lookup
  // below misses neighbours that are close enough to matter.
  const cell = TREE_GAP
  const treeHash = new Map<number, { x: number; y: number }[]>()
  const treeKey = (x: number, y: number) => Math.floor(y / cell) * 4096 + Math.floor(x / cell)
  const treeFits = (x: number, y: number, min: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const list = treeHash.get(treeKey(x + dx * cell, y + dy * cell))
        if (!list) continue
        for (const p of list) if (Math.hypot(p.x - x, p.y - y) < min) return false
      }
    return true
  }
  const order: number[] = []
  for (let i = 0; i < w * h; i++) order.push(i)
  rng.shuffle(order)
  for (const i of order) {
    const x = i % w
    const y = (i - x) / w
    if (!free(x, y) || nearPaved[i]) continue
    const t = grid.get(x, y)
    if (t !== T.GRASS && t !== T.TALLGRASS) continue
    const out2 = outside(x, y)
    if (!out2 && region(x, y) !== 'picnic') continue
    if (!rng.chance(out2 ? TREE_CHANCE_OUT : TREE_CHANCE_IN)) continue
    const wx = px(x)
    const wy = px(y)
    if (!treeFits(wx, wy, TREE_GAP)) continue
    const k = treeKey(wx, wy)
    if (!treeHash.has(k)) treeHash.set(k, [])
    treeHash.get(k)!.push({ x: wx, y: wy })
    out.push({ kind: 'tree', x: wx, y: wy, v: rng.int(0, 1), solid: true })
    ban(x, y)
  }

  // --- tall grass ---
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (grid.get(x, y) === T.TALLGRASS && open(x, y)) out.push({ kind: 'grass', x: cx(x), y: cy(y), v: rng.int(0, 1), solid: false })

  // --- tufts on the open lawns ---
  for (const i of order) {
    const x = i % w
    const y = (i - x) / w
    if (!free(x, y) || grid.get(x, y) !== T.GRASS) continue
    if (rng.chance(0.035)) out.push({ kind: 'grass', x: px(x, 0.3), y: cy(y), v: rng.int(0, 1), solid: false })
  }

  // --- flowers: clusters on the lawns, thickest around the midway ---
  let clusters = 0
  let tries = 0
  while (clusters < 60 && tries < 4000) {
    tries++
    const x = rng.int(2, w - 3)
    const y = rng.int(2, h - 3)
    if (!free(x, y) || grid.get(x, y) !== T.GRASS || outside(x, y)) continue
    const n = rng.int(3, 7)
    for (let k = 0; k < n; k++) {
      const fx = x + rng.range(-1.2, 1.2)
      const fy = y + rng.range(-0.9, 0.9)
      const tx = Math.floor(fx)
      const ty = Math.floor(fy)
      if (!free(tx, ty) || grid.get(tx, ty) !== T.GRASS) continue
      out.push({ kind: 'flower', x: (tx + 0.5 + rng.range(-0.35, 0.35)) * TILE, y: (ty + 0.5 + rng.range(-0.3, 0.3)) * TILE, v: rng.int(0, 3), solid: false })
    }
    clusters++
  }

  // --- pond life ---
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const t = grid.get(x, y)
      if (t === T.POND) {
        if (rng.chance(0.3)) out.push({ kind: 'lily', x: cx(x), y: (y + 0.5) * TILE, v: rng.int(0, 1), solid: false })
      } else if (t === T.GRASS && free(x, y)) {
        const byPond = [grid.get(x + 1, y), grid.get(x - 1, y), grid.get(x, y + 1), grid.get(x, y - 1)].includes(T.POND as Terrain)
        if (byPond && rng.chance(0.55)) out.push({ kind: 'reed', x: cx(x), y: cy(y), v: rng.int(0, 1), solid: false })
      }
    }

  for (const d of out) d.solid = SOLID[d.kind]
  return out
}
