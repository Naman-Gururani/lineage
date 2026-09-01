// Terrain grid: one byte per tile plus a parallel ledge byte, and the
// neighbourhood helpers that drive autotiling, collision and coastline shaping.
// Pure — no Phaser here.

export const T = {
  DEEP: 0,
  WATER: 1,
  SHALLOW: 2,
  SAND: 3,
  GRASS: 4,
  PATH: 5,
  CLIFF: 6,
  PLATEAU: 7,
  RIVER: 8,
  BRIDGE: 9,
  DOCK: 10,
  PLAZA: 11,
  POND: 12,
  TALLGRASS: 13,
  /** One-tile-wide inland stream. Blocks walking; a hop clears it (no bridge). */
  BROOK: 14,
} as const

export type Terrain = (typeof T)[keyof typeof T]

/** Alias for the hop/blueprint code, which talks about the brook by id. */
export const T_BROOK: Terrain = T.BROOK

/**
 * Terrain a jump can carry the player across. The sea and the two-wide river
 * stay off the list: only the brook is narrow enough to clear.
 */
export const HOPPABLE_TERRAIN: ReadonlySet<Terrain> = new Set<Terrain>([T.BROOK])

/**
 * Decor/prop kinds drawn low enough that a hop passes over them. The hop planner
 * ignores their solids on the way through but still refuses them as a landing.
 * Flowerbeds are deliberately absent: they are non-solid, walked straight
 * through, which is friendlier than making the player hop a flower patch.
 */
export const LOW_KINDS: ReadonlySet<string> = new Set(['fence', 'rock_s', 'bush', 'crate', 'barrel'])

/** Direction you fall when you walk off a ledge tile (one-way, Zelda-style). */
export type LedgeDir = 'n' | 'e' | 's' | 'w'

/** Stored as 1..4 in the ledge layer; 0 means "no ledge here". */
const LEDGE_DIRS: readonly LedgeDir[] = ['n', 'e', 's', 'w']

export type Grid = {
  w: number
  h: number
  cells: Uint8Array
  /** Parallel to `cells`: 0 = no ledge, else a `LedgeDir` code. */
  ledges: Uint8Array
  get(x: number, y: number): Terrain
  set(x: number, y: number, t: Terrain): void
  inb(x: number, y: number): boolean
}

export function makeGrid(w: number, h: number, fill: Terrain): Grid {
  const cells = new Uint8Array(w * h).fill(fill)
  const ledges = new Uint8Array(w * h)
  return {
    w,
    h,
    cells,
    ledges,
    get: (x, y) => cells[y * w + x] as Terrain,
    set: (x, y, t) => {
      cells[y * w + x] = t
    },
    inb: (x, y) => x >= 0 && y >= 0 && x < w && y < h,
  }
}

/** The ledge direction at a tile, or null where there is none (or off-grid). */
export function ledgeAt(g: Grid, tx: number, ty: number): LedgeDir | null {
  if (!g.inb(tx, ty)) return null
  const code = g.ledges[ty * g.w + tx]
  return code === 0 ? null : (LEDGE_DIRS[code - 1] ?? null)
}

/** Mark a tile as a ledge you can hop down heading `d`. Off-grid writes are ignored. */
export function setLedge(g: Grid, tx: number, ty: number, d: LedgeDir): void {
  if (!g.inb(tx, ty)) return
  g.ledges[ty * g.w + tx] = LEDGE_DIRS.indexOf(d) + 1
}

export function isWalkable(t: Terrain): boolean {
  return (
    t === T.SAND ||
    t === T.GRASS ||
    t === T.PATH ||
    t === T.PLATEAU ||
    t === T.BRIDGE ||
    t === T.DOCK ||
    t === T.PLAZA ||
    t === T.TALLGRASS ||
    t === T.SHALLOW
  )
}

export function isLand(t: Terrain): boolean {
  return !isWater(t)
}

export function isWater(t: Terrain): boolean {
  return t === T.DEEP || t === T.WATER || t === T.SHALLOW || t === T.RIVER || t === T.POND || t === T.BROOK
}

/** 4-neighbour mask: N=1 E=2 S=4 W=8. Out of bounds counts as matching. */
export function mask4(grid: Grid, x: number, y: number, same: (t: Terrain) => boolean): number {
  const at = (px: number, py: number) => (grid.inb(px, py) ? same(grid.get(px, py)) : true)
  return (at(x, y - 1) ? 1 : 0) | (at(x + 1, y) ? 2 : 0) | (at(x, y + 1) ? 4 : 0) | (at(x - 1, y) ? 8 : 0)
}

/** 8-neighbour mask: N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128. Out of bounds counts as matching. */
export function mask8(grid: Grid, x: number, y: number, same: (t: Terrain) => boolean): number {
  const at = (px: number, py: number) => (grid.inb(px, py) ? same(grid.get(px, py)) : true)
  return (
    (at(x, y - 1) ? 1 : 0) |
    (at(x + 1, y - 1) ? 2 : 0) |
    (at(x + 1, y) ? 4 : 0) |
    (at(x + 1, y + 1) ? 8 : 0) |
    (at(x, y + 1) ? 16 : 0) |
    (at(x - 1, y + 1) ? 32 : 0) |
    (at(x - 1, y) ? 64 : 0) |
    (at(x - 1, y - 1) ? 128 : 0)
  )
}

/** Size of the 4-connected region of `pass` tiles containing (x,y). */
export function floodCount(grid: Grid, x: number, y: number, pass: (t: Terrain) => boolean): number {
  if (!grid.inb(x, y) || !pass(grid.get(x, y))) return 0
  const seen = new Uint8Array(grid.w * grid.h)
  const stack = [y * grid.w + x]
  seen[stack[0]] = 1
  let count = 0
  while (stack.length) {
    const i = stack.pop()!
    count++
    const cx = i % grid.w
    const cy = (i - cx) / grid.w
    const nb = [
      [cx, cy - 1],
      [cx + 1, cy],
      [cx, cy + 1],
      [cx - 1, cy],
    ]
    for (const [nx, ny] of nb) {
      if (!grid.inb(nx, ny)) continue
      const j = ny * grid.w + nx
      if (seen[j] || !pass(grid.get(nx, ny))) continue
      seen[j] = 1
      stack.push(j)
    }
  }
  return count
}

/** 1 for every tile reachable from (x,y) through pass tiles (4-connected). */
export function floodMask(grid: Grid, x: number, y: number, pass: (t: Terrain) => boolean): Uint8Array {
  const seen = new Uint8Array(grid.w * grid.h)
  if (!grid.inb(x, y) || !pass(grid.get(x, y))) return seen
  const stack = [y * grid.w + x]
  seen[stack[0]] = 1
  while (stack.length) {
    const i = stack.pop()!
    const cx = i % grid.w
    const cy = (i - cx) / grid.w
    const nb = [
      [cx, cy - 1],
      [cx + 1, cy],
      [cx, cy + 1],
      [cx - 1, cy],
    ]
    for (const [nx, ny] of nb) {
      if (!grid.inb(nx, ny)) continue
      const j = ny * grid.w + nx
      if (seen[j] || !pass(grid.get(nx, ny))) continue
      seen[j] = 1
      stack.push(j)
    }
  }
  return seen
}

/** BFS distance from every tile to the nearest tile failing `pass` (out of bounds counts as failing). */
export function distanceField(grid: Grid, pass: (t: Terrain) => boolean): Float32Array {
  const { w, h } = grid
  const dist = new Float32Array(w * h).fill(Infinity)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!pass(grid.get(x, y))) {
        dist[i] = 0
        queue[tail++] = i
      } else if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        dist[i] = 1
        queue[tail++] = i
      }
    }
  while (head < tail) {
    const i = queue[head++]
    const cx = i % w
    const cy = (i - cx) / w
    const d = dist[i] + 1
    const relax = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return
      const j = ny * w + nx
      if (dist[j] > d) {
        dist[j] = d
        queue[tail++] = j
      }
    }
    relax(cx, cy - 1)
    relax(cx + 1, cy)
    relax(cx, cy + 1)
    relax(cx - 1, cy)
  }
  return dist
}
