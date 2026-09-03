// The designed fairground. Flat by construction: one rectangle of lawn inside a
// perimeter fence, paved with an apron, a midway and an avenue, dotted with
// attractions. Every attraction, spot and road is placed on purpose — there is
// no coastline to shape and no wobble to tame.
//
// Island-era fields (`plateaus`, `ramps`, `river`, `brook`, `ledges`, `docks`,
// `bridges`, `sandWidth`) survive as empty values so the scenes still compile;
// Wave 2 deletes them along with their consumers.
import { WORLD_TH, WORLD_TW } from '../config'
import { makeNoise } from '../core/noise'
import type { Rng } from '../core/rng'
import { carveRoads } from './paths'
import type { Region, Vec2 } from './regions'
import { T, isWalkable, makeGrid, type Grid, type LedgeDir, type Terrain } from './terrain'

export type { Vec2, Region }

export type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; wobble?: number }
  | { kind: 'poly'; pts: Vec2[]; wobble?: number }

export type Rect = { x: number; y: number; w: number; h: number }

/** Small, tile-centred scenery: drawn at the centre of `x,y` standing on its bottom edge. */
export type Prop = { kind: string; x: number; y: number; solid?: Rect; id?: string }

/**
 * A big built thing — a ride, a booth, a turnstile. Structures are placed by
 * *footprint*, never by a centre tile: the scene draws them with origin (0,1) at
 * px `(tx*32, (ty+h)*32)`, exactly like an attraction, so a sprite def's anchor
 * never enters into it. That is what lets an even-tile-wide sprite (a 64 px
 * turnstile, a 256 px wheel, a 512 px coaster span) land on the tile grid.
 */
export type Structure = {
  /** Sprite def name; a `${sprite}_night` def, when one exists, is the night overlay (same placement). */
  sprite: string
  /** Footprint in tiles: top-left + size. The sprite may be TALLER than h*32 (it grows upward from the bottom edge); it is never wider than w*32. */
  tx: number
  ty: number
  w: number
  h: number
  /** Hard, full-tile solids in tile coords (usually the base row or the whole footprint). */
  solid: Rect[]
  /** Optional flag name: while the flag is UNSET the structure is drawn and solid; once set it is removed (the turnstile after the ticket). */
  gate?: string
}

export type AttractionId = 'gate' | 'coaster' | 'prizetent' | 'forge' | 'flight' | 'arcade' | 'duckpond' | 'guestbook'

/**
 * A fair attraction: an outdoor structure with a footprint, a door tile you
 * interact from, and the chapters (zone ids) it delivers. Replaces the island's
 * landmarks and rooms — nothing at the fair has an interior.
 */
export type Attraction = {
  id: AttractionId
  /** Display name — the discovery banner and the map pin both read this field. */
  name: string
  tx: number
  ty: number
  w: number
  h: number
  door: Vec2
  sprite: string
  /** `booth:bo` · `ride:coaster` · `minigame:<id>` · `panel:zone:<id>` · `duckpond` */
  interact: string
  zones: string[]
  /** footprint columns (relative) that are solid — for the gate arch, whose middle is the opening */
  solidCols?: [number, number][]
}

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
  /** Island-era stream. The fair has none. */
  brook: { pts: Vec2[] }
  ledges: LedgeBand[]
  ponds: Shape[]
  /** Every paved area, in painting order: the arrival apron, the midway, the avenue. */
  plazas: Shape[]
  /** The park boundary. The fence runs along this rectangle's border tiles. */
  fence: Rect
  /** The one gap in the fence — the gate. */
  gateOpening: Rect
  docks: Rect[]
  bridges: Rect[]
  tallGrass: Shape[]
  roads: [Vec2, Vec2][]
  attractions: Attraction[]
  regions: Region[]
  spawn: Vec2
  npcSpots: Record<string, Vec2>
  /** Where the guide waits for each story step (`data/story.ts` names them). */
  storySpots: Record<string, Vec2>
  packetSpots: Vec2[]
  chestSpots: Vec2[]
  shellSpots: Vec2[]
  fishingSpot: Vec2
  viewpoint: Vec2
  props: Prop[]
  /** The rides, the booth and the turnstiles — everything placed by footprint. */
  structures: Structure[]
}

const E = (cx: number, cy: number, rx: number, ry: number, wobble = 0.1): Shape => ({ kind: 'ellipse', cx, cy, rx, ry, wobble })
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })
const V = (x: number, y: number): Vec2 => ({ x, y })
const P = (...xy: number[]): Vec2[] => {
  const out: Vec2[] = []
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] })
  return out
}
/**
 * A tile rectangle as a polygon. `inShape` samples tile centres, so the corners
 * sit on the tile *boundaries*: `RP(24, 38, 24, 9)` covers tiles x24..47, y38..46.
 */
const RP = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'poly', pts: P(x, y, x + w, y, x + w, y + h, x, y + h) })

export const BLUEPRINT: Blueprint = {
  // One rectangle of ground, no wobble: the fair is flat and there is no sea.
  land: [RP(0, 0, WORLD_TW, WORLD_TH)],
  sandWidth: 0,
  plateaus: [],
  ramps: [],
  river: { pts: [], width: 0 },
  brook: { pts: [] },
  ledges: [],
  // The duck pond. Centred on tile centres so its rim lands on whole tiles and
  // the fishing spot at (11,29) stays dry with pond water one step north.
  ponds: [E(11.5, 26.5, 4, 2.5, 0.1)],
  plazas: [
    RP(30, 52, 12, 4), // arrival apron, outside the gate
    RP(24, 38, 24, 9), // the midway
    RP(34, 20, 4, 32), // the avenue: gate → midway → coaster hill
  ],
  fence: R(3, 4, 66, 48), // border tiles x3..68, y4..51
  gateOpening: R(34, 51, 4, 1),
  docks: [],
  bridges: [],
  // Six patches of long grass on the lawns. The one that used to sit at (50,30)
  // moved west: the wheel-lawn road was carved straight through six of its
  // tiles, and a gravel path bisecting a meadow reads as a mistake.
  tallGrass: [E(8, 20, 3, 2), E(20, 25, 3, 2), E(64, 12, 3, 2), E(46, 26, 3, 2), E(8, 45, 2, 2), E(64, 44, 3, 2)],
  roads: [
    [V(37, 21), V(50, 17)], // avenue head → coaster station door
    [V(24, 38), V(15, 31)], // midway → duck pond
    [V(24, 40), V(21, 40)], // midway → prize tent
    // (the forge needs no road: its door opens straight onto the midway paving)
    [V(24, 44), V(14, 46)], // midway → chalk flight
    [V(47, 43), V(54, 45)], // midway → arcade (leaves the paving north of the food cart)
    [V(47, 45), V(57, 49)], // midway → guestbook
    [V(48, 42), V(58, 26)], // midway → wheel lawn
  ],
  attractions: [
    // The gate arch straddles the fence: only its two pillar pairs are solid, so
    // the four tiles between them are the way in.
    { id: 'gate', name: 'Ticket Booth', tx: 32, ty: 48, w: 8, h: 4, door: V(35, 53), sprite: 'gate_arch', interact: 'booth:bo', zones: ['about'], solidCols: [[0, 1], [6, 7]] },
    // The station stands flush with the coaster's right foot: its bottom edge is
    // y16 = 512 px, the same as `coaster_span_2`'s, so the parked cart sits on
    // the platform instead of floating above it. That means the two footprints
    // overlap on purpose — the station is in front of the span.
    { id: 'coaster', name: 'Career Coaster', tx: 48, ty: 12, w: 6, h: 4, door: V(50, 16), sprite: 'coaster_station', interact: 'ride:coaster', zones: ['education', 'experience'] },
    { id: 'prizetent', name: 'Prize Tent', tx: 18, ty: 36, w: 6, h: 4, door: V(21, 40), sprite: 'bld_fair', interact: 'minigame:claw', zones: ['lineage', 'safestride', 'stealth'] },
    { id: 'forge', name: 'Word Forge', tx: 44, ty: 36, w: 4, h: 4, door: V(46, 40), sprite: 'booth_forge', interact: 'minigame:forge', zones: ['skills'] },
    { id: 'flight', name: 'Chalk Flight', tx: 12, ty: 42, w: 4, h: 4, door: V(14, 46), sprite: 'booth_flight', interact: 'minigame:flappy', zones: [] },
    { id: 'arcade', name: 'Arcade', tx: 52, ty: 42, w: 4, h: 3, door: V(54, 45), sprite: 'bld_warehouse', interact: 'minigame:crew', zones: [] },
    { id: 'duckpond', name: 'Duck Pond', tx: 14, ty: 29, w: 3, h: 2, door: V(15, 31), sprite: 'stall', interact: 'duckpond', zones: [] },
    { id: 'guestbook', name: 'Guestbook', tx: 56, ty: 46, w: 3, h: 3, door: V(57, 49), sprite: 'booth_guestbook', interact: 'panel:zone:contact', zones: ['contact'] },
  ],
  // Read in order: the first polygon that contains a point wins, and the picnic
  // lawn is the whole map, so every tile lands in a named region.
  //
  // Each box is drawn as tightly as the thing it names: the coaster hill is the
  // ride and its station (rows 4..23), the pond is the water's own corner. What
  // is left over — the wide band between the coaster and the midway, the lawn
  // east of the wheel, the corners behind the booths — is the picnic lawn, and
  // that is deliberate: the picnic lawn is the only region inside the fence
  // where `scatter` plants trees.
  regions: [
    { id: 'pond', name: 'Duck Pond', poly: P(0, 0, 20, 0, 20, 32, 0, 32) },
    { id: 'wheel', name: 'Wheel Lawn', poly: P(54, 16, 72, 16, 72, 38, 54, 38) },
    { id: 'hill', name: 'Coaster Hill', poly: P(12, 4, 61, 4, 61, 24, 12, 24) },
    { id: 'midway', name: 'The Midway', poly: P(24, 38, 48, 38, 48, 47, 24, 47) },
    { id: 'west', name: 'Prize Row', poly: P(0, 32, 24, 32, 24, 48, 0, 48) },
    { id: 'east', name: 'Game Row', poly: P(48, 32, 72, 32, 72, 48, 48, 48) },
    { id: 'apron', name: 'The Gate', poly: P(18, 47, 61, 47, 61, 56, 18, 56) },
    { id: 'picnic', name: 'Picnic Lawn', poly: P(0, 0, 72, 0, 72, 56, 0, 56) },
  ],
  spawn: V(35, 54),
  npcSpots: {
    dockmaster: V(31, 52), // Bo, outside the gate at the booth window
    sol: V(22, 41),
    ravi: V(47, 41),
    arjun: V(15, 47),
    mira: V(55, 46),
    tomas: V(16, 31),
    pip: V(40, 45),
    ilse: V(58, 50),
    cat: V(26, 28), // asleep on the picnic lawn, between the coaster and the midway
    professor: V(52, 17),
  },
  // Bo walks the story with you: one station per step, each within sight of the
  // attraction that step is asking you to visit. `ticket` shares Bo's own tile
  // because that is where the first step happens.
  storySpots: {
    ticket: V(31, 52),
    ride: V(53, 18),
    prizes: V(23, 41),
    toolkit: V(48, 41),
    guestbook: V(59, 50),
  },
  // 20 lost tickets, spread across every region of the park.
  packetSpots: P(
    20, 18, 30, 26, 42, 18, 46, 30, 22, 30, // coaster hill
    6, 22, 10, 32, // duck pond
    64, 20, 58, 34, // wheel lawn
    28, 40, 36, 45, 44, 34, // the midway
    8, 36, 20, 44, 10, 40, // prize row
    50, 36, 62, 40, // game row (62,40 is lawn; 62,42 stood in the tall grass)
    24, 49, 46, 49, // the gate
    61, 49, // picnic lawn
  ),
  // Prize boxes in the corners of the park.
  chestSpots: P(6, 17, 65, 17, 6, 49, 65, 49, 5, 36, 66, 30),
  // Stray balloons on the picnic and wheel lawns.
  shellSpots: P(8, 48, 14, 49, 63, 48, 60, 26, 66, 36),
  fishingSpot: V(11, 29),
  viewpoint: V(44, 22),
  props: [
    // --- the midway ---
    { kind: 'fountain', x: 35, y: 42, solid: R(34, 41, 3, 2) },
    { kind: 'cart_food_0', x: 26, y: 44, solid: R(25.5, 44, 2, 1) },
    { kind: 'cart_food_1', x: 46, y: 44, solid: R(45.5, 44, 2, 1) },
    { kind: 'cart_balloons', x: 40, y: 44, solid: R(39.5, 44, 2, 1) },
    { kind: 'board_forge', x: 49, y: 38, id: 'forgeboard', solid: R(48.5, 38, 2, 1) },
    { kind: 'arcade_sign', x: 54, y: 41 },
    // --- finger posts ---
    // Every arm's heading is checked against these tiles in tests/signs.test.ts —
    // move one and the bearing test tells you.
    { kind: 'sign_finger', x: 35, y: 47, id: 'gate' },
    { kind: 'sign_finger', x: 25, y: 41, id: 'midway_w' },
    { kind: 'sign_finger', x: 46, y: 41, id: 'midway_e' },
    { kind: 'sign_finger', x: 35, y: 22, id: 'hill' },
    { kind: 'sign_finger', x: 16, y: 32, id: 'pond' },
    { kind: 'sign_finger', x: 54, y: 30, id: 'wheel' },
  ],
  // Placed by footprint, drawn from the bottom edge — see `Structure`. Every one
  // of these is wider than a tile and most are even-tile-wide, which is exactly
  // why they are not props: a centre tile cannot align them.
  structures: [
    // The coaster's three spans, 512×320 apiece: rows 6..15, solid the whole way
    // through. Matches `COASTER_ORIGIN`.
    //
    // They used to stop you on the base row alone, on the theory that the rest is
    // sky you walk under. It is not: the lattice is drawn over rows 6..14, so
    // anyone who walked round either end stood *inside* the ride, drawn under its
    // own timbers and boxed in by the station and the wheel. The whole footprint
    // is the ride, and you go round it.
    { sprite: 'coaster_span_0', tx: 12, ty: 6, w: 16, h: 10, solid: [R(12, 6, 16, 10)] },
    { sprite: 'coaster_span_1', tx: 28, ty: 6, w: 16, h: 10, solid: [R(28, 6, 16, 10)] },
    { sprite: 'coaster_span_2', tx: 44, ty: 6, w: 16, h: 10, solid: [R(44, 6, 16, 10)] },
    // 256×320: rows 13..22, base row solid so the lawn behind it stays walkable.
    { sprite: 'ferris_wheel', tx: 55, ty: 13, w: 8, h: 10, solid: [R(55, 22, 8, 1)] },
    // Bo's booth beside the gate — small, but solid the whole way through.
    { sprite: 'ticket_booth', tx: 28, ty: 48, w: 3, h: 3, solid: [R(28, 48, 3, 3)] },
    // The two turnstiles fill the gate opening, which is why `boundarySolids`
    // leaves it clear: winning the ticket removes them, and that is the way in.
    // 64×48 — two tiles wide, one and a half tall, so it overhangs upward.
    { sprite: 'turnstile', tx: 34, ty: 51, w: 2, h: 1, solid: [R(34, 51, 2, 1)], gate: 'ticket' },
    { sprite: 'turnstile', tx: 36, ty: 51, w: 2, h: 1, solid: [R(36, 51, 2, 1)], gate: 'ticket' },
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

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
}

/** A tile of the boundary fence: `v` is 0 for a horizontal run, 1 vertical, 2 a post. */
export type FenceTile = { x: number; y: number; v: number }

/**
 * Every perimeter tile of `bp.fence` except the gate opening, walked as four
 * runs. A tile whose neighbour along the run is missing becomes a post, so the
 * fence reads as carpentry rather than a dotted line. Shared by the scatter
 * (which turns these into solid decor, passing `skip` for the tiles the gate
 * arch covers) and the tests (which check the park is closed).
 */
export function fenceRing(bp: Blueprint, skip?: (x: number, y: number) => boolean): FenceTile[] {
  const f = bp.fence
  const x0 = f.x
  const x1 = f.x + f.w - 1
  const y0 = f.y
  const y1 = f.y + f.h - 1
  const gone = (x: number, y: number) => inRect(bp.gateOpening, x, y) || (!!skip && skip(x, y))
  const out: FenceTile[] = []
  /** `v` is the run's orientation; `dx`,`dy` step along it. */
  const run = (pts: Vec2[], v: 0 | 1, dx: number, dy: number) => {
    for (const p of pts) {
      if (gone(p.x, p.y)) continue
      const end = gone(p.x - dx, p.y - dy) || gone(p.x + dx, p.y + dy)
      const corner = (p.x === x0 || p.x === x1) && (p.y === y0 || p.y === y1)
      out.push({ x: p.x, y: p.y, v: corner || end ? 2 : v })
    }
  }
  const row = (y: number): Vec2[] => Array.from({ length: x1 - x0 + 1 }, (_, i) => V(x0 + i, y))
  const col = (x: number): Vec2[] => Array.from({ length: y1 - y0 - 1 }, (_, i) => V(x, y0 + 1 + i))
  run(row(y0), 0, 1, 0)
  run(row(y1), 0, 1, 0)
  run(col(x0), 1, 0, 1)
  run(col(x1), 1, 0, 1)
  return out
}

/**
 * Hard, full-tile solids for the park boundary: the fence ring minus the gate
 * opening, as a handful of rectangles (the four sides, the bottom one split
 * around the gate). Task 7 registers these like attraction footprints — never
 * hop-able — which is what actually keeps the fair enclosed. The `fence` decor
 * the scatter emits along the same line stays low and hop-able: it is the
 * carpentry, not the wall.
 *
 * The gate opening is left clear on purpose: the turnstiles seal it until the
 * `ticket` flag is set (see `structureSolids`).
 */
export function boundarySolids(bp: Blueprint): Rect[] {
  const f = bp.fence
  const x0 = f.x
  const x1 = f.x + f.w - 1
  const y0 = f.y
  const y1 = f.y + f.h - 1
  const g = bp.gateOpening
  const out: Rect[] = []
  /** One side, minus the slice of it the gate opening takes out (if any). */
  const side = (from: number, to: number, at: number, horizontal: boolean) => {
    const lo = horizontal ? g.x : g.y
    const hi = (horizontal ? g.x + g.w : g.y + g.h) - 1
    const across = horizontal ? at >= g.y && at < g.y + g.h : at >= g.x && at < g.x + g.w
    const a = Math.max(from, lo)
    const b = Math.min(to, hi)
    const gap = across && a <= b ? [a, b] : null
    const push = (s: number, e: number) => {
      if (s > e) return
      out.push(horizontal ? { x: s, y: at, w: e - s + 1, h: 1 } : { x: at, y: s, w: 1, h: e - s + 1 })
    }
    if (!gap) return push(from, to)
    push(from, gap[0] - 1)
    push(gap[1] + 1, to)
  }
  side(x0, x1, y0, true) // north
  side(x0, x1, y1, true) // south — the gate splits this one
  side(y0 + 1, y1 - 1, x0, false) // west, between the corners the rows already own
  side(y0 + 1, y1 - 1, x1, false) // east
  return out
}

/**
 * The blocking rectangles of every structure that is still standing: a `gate`
 * structure disappears once its flag is set (the turnstiles, after the ticket).
 */
export function structureSolids(bp: Blueprint, flags: (flag: string) => boolean): Rect[] {
  return bp.structures.filter((s) => !s.gate || !flags(s.gate)).flatMap((s) => s.solid)
}

/** The blocking rectangles of an attraction: the whole footprint, or just its solid columns. */
export function attractionSolids(a: Attraction): Rect[] {
  if (!a.solidCols || !a.solidCols.length) return [{ x: a.tx, y: a.ty, w: a.w, h: a.h }]
  return a.solidCols.map(([c0, c1]) => ({ x: a.tx + c0, y: a.ty, w: c1 - c0 + 1, h: a.h }))
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

/** True when (x,y) falls inside a footprint, optionally with a margin of tiles around it. */
export function footprintContains(lm: { tx: number; ty: number; w: number; h: number }, x: number, y: number, margin = 0): boolean {
  return x >= lm.tx - margin && x < lm.tx + lm.w + margin && y >= lm.ty - margin && y < lm.ty + lm.h + margin
}

/** Every tile a person is meant to stand on — the ground under these is forced walkable. */
function designedSpots(bp: Blueprint): Vec2[] {
  return [
    ...bp.packetSpots,
    ...bp.chestSpots,
    ...bp.shellSpots,
    ...Object.values(bp.npcSpots),
    ...Object.values(bp.storySpots),
    ...bp.attractions.map((a) => a.door),
    bp.fishingSpot,
    bp.viewpoint,
    bp.spawn,
  ]
}

/**
 * What the generator had to force. `cleared` lists the designed spots whose
 * ground was not already walkable — a healthy blueprint clears nothing, and
 * `tests/blueprint.test.ts` holds it to that, because a spot the generator
 * rescues is a spot the layout put somewhere wrong.
 */
export type RasterReport = { cleared: { x: number; y: number; from: Terrain }[] }

export function rasterizeBlueprint(bp: Blueprint, rng: Rng, report?: RasterReport): Grid {
  // 1. lawn everywhere — the fair is one flat field, no sea and no coastline
  const grid = makeGrid(WORLD_TW, WORLD_TH, T.GRASS)
  const noise = makeNoise(rng.fork('lawn'))

  // 2. the duck pond
  for (const s of bp.ponds)
    eachTile(grid, (x, y, t) => {
      if (t === T.GRASS && inShape(s, x + 0.5, y + 0.5, noise)) grid.set(x, y, T.POND)
    })

  // 3. paving: the apron outside the gate, the midway, the avenue
  for (const s of bp.plazas)
    eachTile(grid, (x, y, t) => {
      if (t === T.GRASS && inShape(s, x + 0.5, y + 0.5, noise)) grid.set(x, y, T.PLAZA)
    })

  // 4. tall grass on the lawns
  for (const s of bp.tallGrass)
    eachTile(grid, (x, y, t) => {
      if (t === T.GRASS && inShape(s, x + 0.5, y + 0.5, noise)) grid.set(x, y, T.TALLGRASS)
    })

  // 5. attraction footprints stay lawn or paving — a stall never stands in water.
  //    The predicate reads inverted but is right: `fillRect` paints only where it
  //    is true, so "not grass and not paving" means *leave lawn and paving alone*
  //    and turn everything else (pond, tall grass) under the footprint into lawn.
  for (const a of bp.attractions)
    fillRect(grid, { x: a.tx, y: a.ty, w: a.w, h: a.h }, T.GRASS, (t) => t !== T.GRASS && t !== T.PLAZA)

  // 6. doors and designed spots are plain walkable ground (tall grass would hide
  //    a pickup and a pond would drown it). Nothing should need this — every
  //    clear is recorded so the tests can insist the count stays zero.
  const clear = (p: Vec2) => {
    const x = Math.floor(p.x)
    const y = Math.floor(p.y)
    if (!grid.inb(x, y)) return
    const t = grid.get(x, y)
    if (t === T.GRASS || t === T.PLAZA || t === T.PATH) return
    report?.cleared.push({ x, y, from: t })
    grid.set(x, y, T.GRASS)
  }
  for (const p of designedSpots(bp)) clear(p)

  // 7. gravel paths. Roads never cut through an attraction, a structure, a
  //    prop's collision box or the fence — the gate is the only way in or out.
  const blocked = new Uint8Array(grid.w * grid.h)
  const block = (x: number, y: number) => {
    if (grid.inb(x, y)) blocked[y * grid.w + x] = 1
  }
  for (const a of bp.attractions) for (let y = a.ty; y < a.ty + a.h; y++) for (let x = a.tx; x < a.tx + a.w; x++) block(x, y)
  const blockRect = (r: Rect) => {
    for (let y = Math.floor(r.y); y < r.y + r.h; y++) for (let x = Math.floor(r.x); x < r.x + r.w; x++) block(x, y)
  }
  for (const p of bp.props) if (p.solid) blockRect(p.solid)
  for (const s of bp.structures) for (const r of s.solid) blockRect(r)
  for (const t of fenceRing(bp)) block(t.x, t.y)
  carveRoads(grid, bp.roads, rng.fork('roads'), (x, y) => blocked[y * grid.w + x] === 1)

  // 8. the roads are laid; make sure nothing they crossed left a spot unusable
  for (const p of designedSpots(bp)) {
    const x = Math.floor(p.x)
    const y = Math.floor(p.y)
    if (!grid.inb(x, y) || isWalkable(grid.get(x, y))) continue
    report?.cleared.push({ x, y, from: grid.get(x, y) })
    grid.set(x, y, T.GRASS)
  }

  return grid
}
