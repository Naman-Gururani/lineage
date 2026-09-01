// Roads: A* over the tile grid with a curviness bias, painted as PATH.
import { makeNoise } from '../core/noise'
import type { Rng } from '../core/rng'
import type { Vec2 } from './regions'
import { T, isWalkable, type Grid, type Terrain } from './terrain'

export type Cost = (t: Terrain, x: number, y: number) => number

/** Per-tile road cost; `noise` in [0,1) adds gentle curviness. Infinity = impassable. */
export function roadCost(t: Terrain, noise: number): number {
  switch (t) {
    case T.PATH:
    case T.PLAZA:
      return 1 + noise * 0.2
    case T.GRASS:
    case T.TALLGRASS:
    case T.PLATEAU:
      return 1.6 + noise * 0.8
    case T.SAND:
      return 2.2 + noise * 0.8
    case T.BRIDGE:
    case T.DOCK:
      return 8
    default:
      return Infinity
  }
}

class Heap {
  private a: { i: number; f: number }[] = []
  get size() {
    return this.a.length
  }
  push(i: number, f: number) {
    const a = this.a
    a.push({ i, f })
    let k = a.length - 1
    while (k > 0) {
      const p = (k - 1) >> 1
      if (a[p].f <= a[k].f) break
      const t = a[p]
      a[p] = a[k]
      a[k] = t
      k = p
    }
  }
  pop(): number {
    const a = this.a
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let k = 0
      for (;;) {
        const l = 2 * k + 1
        const r = l + 1
        let m = k
        if (l < a.length && a[l].f < a[m].f) m = l
        if (r < a.length && a[r].f < a[m].f) m = r
        if (m === k) break
        const t = a[m]
        a[m] = a[k]
        a[k] = t
        k = m
      }
    }
    return top.i
  }
}

export function astar(grid: Grid, a: Vec2, b: Vec2, cost: Cost): Vec2[] | null {
  const { w, h } = grid
  const ax = Math.floor(a.x)
  const ay = Math.floor(a.y)
  const bx = Math.floor(b.x)
  const by = Math.floor(b.y)
  if (!grid.inb(ax, ay) || !grid.inb(bx, by)) return null
  const start = ay * w + ax
  const goal = by * w + bx
  const g = new Float64Array(w * h).fill(Infinity)
  const came = new Int32Array(w * h).fill(-1)
  const closed = new Uint8Array(w * h)
  const open = new Heap()
  g[start] = 0
  open.push(start, Math.abs(ax - bx) + Math.abs(ay - by))
  while (open.size) {
    const i = open.pop()
    if (closed[i]) continue
    closed[i] = 1
    if (i === goal) {
      const path: Vec2[] = []
      for (let c = goal; c !== -1; c = came[c]) path.push({ x: c % w, y: Math.floor(c / w) })
      return path.reverse()
    }
    const cx = i % w
    const cy = (i - cx) / w
    const step = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return
      const j = ny * w + nx
      if (closed[j]) return
      const c = cost(grid.get(nx, ny), nx, ny)
      if (!isFinite(c)) return
      const ng = g[i] + c
      if (ng < g[j]) {
        g[j] = ng
        came[j] = i
        open.push(j, ng + Math.abs(nx - bx) + Math.abs(ny - by))
      }
    }
    step(cx, cy - 1)
    step(cx + 1, cy)
    step(cx, cy + 1)
    step(cx - 1, cy)
  }
  return null
}

const KEEP = new Set<number>([T.BRIDGE, T.DOCK, T.PLAZA])
const SOFT = new Set<number>([T.GRASS, T.SAND, T.TALLGRASS, T.PLATEAU])

/** Carve every road as a 2-wide dirt path. Roads reuse each other and cross water only on bridges/docks. */
export function carveRoads(grid: Grid, roads: [Vec2, Vec2][], rng: Rng, avoid?: (x: number, y: number) => boolean): void {
  const field = makeNoise(rng, 5)
  const noise = new Float32Array(grid.w * grid.h)
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) noise[y * grid.w + x] = field(x, y) * 2.4
  const cost: Cost = (t, x, y) => {
    if (avoid && avoid(x, y)) return Infinity
    if (!isWalkable(t)) return Infinity
    return roadCost(t, noise[y * grid.w + x])
  }
  for (const [a, b] of roads) {
    const path = astar(grid, a, b, cost)
    if (!path) continue
    for (const p of path) {
      const t = grid.get(p.x, p.y)
      if (!KEEP.has(t)) grid.set(p.x, p.y, T.PATH)
      // paint a 2×2 block so diagonals become smooth bands
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]] as const) {
        const nx = p.x + dx
        const ny = p.y + dy
        if (grid.inb(nx, ny) && SOFT.has(grid.get(nx, ny)) && !(avoid && avoid(nx, ny))) grid.set(nx, ny, T.PATH)
      }
    }
  }
}
