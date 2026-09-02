// Deterministic decoration placement: trees, flowers, rocks, lamps, fences…
// Pure: returns a list the scene turns into sprites and solids.
import { TILE } from '../config'
import type { Rng } from '../core/rng'
import { footprintContains, type Blueprint } from './blueprint'
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
}

const TREE_DENSITY: Record<string, number> = {
  woods: 0.5,
  heights: 0.14,
  ridge: 0.12,
  meadow: 0.045,
  fields: 0.08,
  engine: 0.06,
  harbor: 0.02,
  point: 0.06,
  campus: 0.03, // a mown lawn, not a wood
}

export function scatterDecor(grid: Grid, bp: Blueprint, rng: Rng): Decor[] {
  const out: Decor[] = []
  const { w, h } = grid
  const banned = new Uint8Array(w * h)
  const ban = (x: number, y: number) => {
    if (grid.inb(x, y)) banned[y * w + x] = 1
  }
  const banRadius = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x - cx, y - cy) <= r) ban(x, y)
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = grid.get(x, y)
      if (!isLand(t) || t === T.PATH || t === T.PLAZA || t === T.DOCK || t === T.BRIDGE || t === T.CLIFF) banned[y * w + x] = 1
    }
  for (const lm of bp.landmarks) {
    for (let y = lm.ty - 1; y <= lm.ty + lm.h; y++) for (let x = lm.tx - 1; x <= lm.tx + lm.w; x++) ban(x, y)
    ban(lm.door.x, lm.door.y + 1)
    ban(lm.door.x, lm.door.y + 2)
  }
  banRadius(bp.spawn.x, bp.spawn.y, 3)
  // Villagers and the guide both stand on their spots: a boulder or a tree
  // scattered onto one would strand whoever the world puts there.
  for (const p of [...Object.values(bp.npcSpots), ...Object.values(bp.storySpots)]) banRadius(p.x, p.y, 2)
  for (const p of bp.packetSpots) banRadius(p.x, p.y, 1.2)
  for (const p of bp.chestSpots) banRadius(p.x, p.y, 1.2)
  for (const p of bp.shellSpots) banRadius(p.x, p.y, 1)
  banRadius(bp.fishingSpot.x, bp.fishingSpot.y, 1)
  banRadius(bp.viewpoint.x, bp.viewpoint.y, 2)
  for (const r of bp.ramps) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) ban(x, y)
  for (const r of bp.bridges) for (let y = r.y - 2; y <= r.y + r.h + 1; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) ban(x, y)
  for (const p of bp.props) {
    banRadius(p.x, p.y, 1.5)
    if (p.solid) for (let y = Math.floor(p.solid.y); y < p.solid.y + p.solid.h; y++) for (let x = Math.floor(p.solid.x); x < p.solid.x + p.solid.w; x++) ban(x, y)
  }
  // road margin: tiles next to roads stay clear so roads read as roads
  const roadNear = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (grid.get(x, y) === T.PATH)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (grid.inb(x + dx, y + dy)) roadNear[(y + dy) * w + x + dx] = 1

  const free = (x: number, y: number) => grid.inb(x, y) && !banned[y * w + x]
  const region = (x: number, y: number) => regionAt(bp.regions, x + 0.5, y + 0.5)?.id ?? 'meadow'
  const nearSand = (x: number, y: number) => {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (grid.inb(x + dx, y + dy) && grid.get(x + dx, y + dy) === T.SAND) return true
    return false
  }
  const px = (x: number, jitter = 0.35) => (x + 0.5 + rng.range(-jitter, jitter)) * TILE

  // spatial hash for tree spacing
  const cell = 16
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
  const addTree = (kind: DecorKind, x: number, y: number) => {
    const k = treeKey(x, y)
    if (!treeHash.has(k)) treeHash.set(k, [])
    treeHash.get(k)!.push({ x, y })
    out.push({ kind, x, y, v: rng.int(0, 1), solid: true })
  }

  // --- trees ---
  const order: number[] = []
  for (let i = 0; i < w * h; i++) order.push(i)
  rng.shuffle(order)
  for (const i of order) {
    const x = i % w
    const y = (i - x) / w
    if (!free(x, y) || roadNear[i]) continue
    const t = grid.get(x, y)
    if (t !== T.GRASS && t !== T.PLATEAU && t !== T.SAND) continue
    const r = region(x, y)
    let density = TREE_DENSITY[r] ?? 0.04
    if (t === T.SAND) density = nearSand(x, y) && (r === 'harbor' || r === 'point' || r === 'fields') ? 0.12 : 0.02
    if (!rng.chance(density)) continue
    const wx = px(x)
    const wy = px(y)
    if (!treeFits(wx, wy, 18)) continue
    let kind: DecorKind = 'tree'
    if (t === T.SAND || (r === 'harbor' && nearSand(x, y))) kind = 'palm'
    else if (r === 'heights' || r === 'ridge' || r === 'point') kind = rng.chance(0.75) ? 'pine' : 'tree'
    else if (r === 'woods') kind = rng.chance(0.4) ? 'pine' : 'tree'
    addTree(kind, wx, wy)
  }

  // --- small props ---
  for (const i of order) {
    const x = i % w
    const y = (i - x) / w
    if (!free(x, y)) continue
    const t = grid.get(x, y)
    const r = region(x, y)
    if (t === T.GRASS || t === T.PLATEAU) {
      const roll = rng.next()
      const wx = px(x)
      const wy = px(y)
      if (roll < 0.012 && treeFits(wx, wy, 14)) out.push({ kind: 'bush', x: wx, y: wy, v: rng.int(0, 1), solid: true })
      else if (roll < 0.012 + (r === 'heights' || r === 'ridge' ? 0.03 : 0.008) && treeFits(wx, wy, 12)) {
        // Two stones: the small one (rock_0) is low enough to hop, the mossy
        // boulder (rock_1) is not — the kind is what the hop planner reads.
        const big = rng.chance(0.4)
        out.push({ kind: big ? 'rock' : 'rock_s', x: wx, y: wy, v: big ? 1 : 0, solid: true })
      }
      else if (roll < 0.03 && r === 'woods') out.push({ kind: 'mushroom', x: wx, y: wy, v: rng.int(0, 1), solid: false })
      else if (roll < 0.033 && (r === 'woods' || r === 'fields') && treeFits(wx, wy, 14))
        out.push({ kind: rng.chance(0.5) ? 'stump' : 'log', x: wx, y: wy, v: 0, solid: true })
    } else if (t === T.SAND && r === 'harbor' && rng.chance(0.03)) {
      out.push({ kind: 'shell', x: px(x), y: px(y), v: 0, solid: false })
    }
  }

  // --- tall grass ---
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (grid.get(x, y) === T.TALLGRASS) out.push({ kind: 'grass', x: (x + 0.5) * TILE, y: (y + 0.95) * TILE, v: rng.int(0, 1), solid: false })

  // --- flowers: clusters in the meadow and fields ---
  let clusters = 0
  let tries = 0
  while (clusters < 70 && tries < 4000) {
    tries++
    const x = rng.int(2, w - 3)
    const y = rng.int(2, h - 3)
    if (!free(x, y) || grid.get(x, y) !== T.GRASS) continue
    const r = region(x, y)
    if (r !== 'meadow' && r !== 'fields' && r !== 'harbor' && r !== 'engine') continue
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

  // --- quest shells (exactly five) ---
  for (const s of bp.shellSpots) {
    let best: { x: number; y: number } | null = null
    for (let r = 0; r <= 3 && !best; r++)
      for (let dy = -r; dy <= r && !best; dy++)
        for (let dx = -r; dx <= r && !best; dx++) {
          const x = s.x + dx
          const y = s.y + dy
          if (grid.inb(x, y) && isLand(grid.get(x, y)) && grid.get(x, y) !== T.PATH && grid.get(x, y) !== T.CLIFF) best = { x, y }
        }
    if (best) out.push({ kind: 'shell', x: (best.x + 0.5) * TILE, y: (best.y + 0.6) * TILE, v: 1, solid: false })
  }

  // --- lamps: plaza ring + along roads ---
  const plaza = bp.plaza
  if (plaza.kind === 'ellipse') {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8
      const x = Math.round(plaza.cx + Math.cos(a) * (plaza.rx - 1.5))
      const y = Math.round(plaza.cy + Math.sin(a) * (plaza.ry - 1.2))
      if (grid.inb(x, y) && grid.get(x, y) === T.PLAZA) out.push({ kind: 'lamp', x: (x + 0.5) * TILE, y: (y + 0.95) * TILE, v: 0, solid: true })
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      const x = Math.round(plaza.cx + Math.cos(a) * (plaza.rx - 3))
      const y = Math.round(plaza.cy + Math.sin(a) * (plaza.ry - 2.2))
      if (grid.inb(x, y) && grid.get(x, y) === T.PLAZA && Math.hypot(x - plaza.cx, y - plaza.cy) > 2.5)
        out.push({ kind: 'bench', x: (x + 0.5) * TILE, y: (y + 0.95) * TILE, v: k % 2, solid: true })
    }
  }
  const lamps: { x: number; y: number }[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (grid.get(x, y) !== T.PATH) continue
      if (lamps.some((l) => Math.hypot(l.x - x, l.y - y) < 11)) continue
      const side = grid.inb(x + 2, y) && free(x + 2, y) && grid.get(x + 2, y) === T.GRASS ? x + 2 : grid.inb(x - 1, y) && free(x - 1, y) && grid.get(x - 1, y) === T.GRASS ? x - 1 : -1
      if (side < 0) continue
      lamps.push({ x, y })
      banned[y * w + side] = 1
      out.push({ kind: 'lamp', x: (side + 0.5) * TILE, y: (y + 0.95) * TILE, v: 0, solid: true })
    }

  // --- fences around the cottage and clinic gardens ---
  for (const id of ['about', 'safestride'] as const) {
    const lm = bp.landmarks.find((l) => l.id === id)!
    const x0 = lm.tx - 2
    const x1 = lm.tx + lm.w + 1
    const y0 = lm.ty - 2
    const y1 = lm.ty + lm.h + 1
    const put = (x: number, y: number, v: number) => {
      if (!grid.inb(x, y)) return
      const t = grid.get(x, y)
      if (t === T.PATH || !isLand(t) || t === T.CLIFF || t === T.PLAZA || t === T.DOCK) return
      if (footprintContains(lm, x, y, 1)) return
      out.push({ kind: 'fence', x: (x + 0.5) * TILE, y: (y + 0.95) * TILE, v, solid: true })
    }
    for (let x = x0; x <= x1; x++) {
      put(x, y0, x === x0 || x === x1 ? 2 : 0)
      if (Math.abs(x - lm.door.x) > 1) put(x, y1, x === x0 || x === x1 ? 2 : 0)
    }
    for (let y = y0 + 1; y < y1; y++) {
      put(x0, y, 1)
      put(x1, y, 1)
    }
  }

  // --- pond life ---
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const t = grid.get(x, y)
      if (t === T.POND) {
        if (rng.chance(0.3)) out.push({ kind: 'lily', x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, v: rng.int(0, 1), solid: false })
      } else if (t === T.GRASS && free(x, y)) {
        const byPond = [grid.get(x + 1, y), grid.get(x - 1, y), grid.get(x, y + 1), grid.get(x, y - 1)].includes(T.POND as Terrain)
        if (byPond && rng.chance(0.55)) out.push({ kind: 'reed', x: (x + 0.5) * TILE, y: (y + 0.95) * TILE, v: rng.int(0, 1), solid: false })
      }
    }

  // --- flower beds by the cottage and clinic ---
  for (const id of ['about', 'safestride'] as const) {
    const lm = bp.landmarks.find((l) => l.id === id)!
    for (const dx of [-2, lm.w + 1]) {
      const x = lm.tx + dx
      const y = lm.ty + lm.h + 1
      if (grid.inb(x, y) && grid.get(x, y) === T.GRASS && !bp.landmarks.some((o) => footprintContains(o, x, y, 1)))
        out.push({ kind: 'flowerbed', x: (x + 0.5) * TILE, y: (y + 0.95) * TILE, v: 0, solid: false })
    }
  }

  for (const d of out) d.solid = SOLID[d.kind]
  return out
}
