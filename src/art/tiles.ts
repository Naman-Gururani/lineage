// Per-tile terrain painters, HD isle edition (TILE = 32). Everything is painted
// into a Raster so the same code runs in the browser (baked into chunk textures)
// and in Node (previews).
//
// House rules, from the terrain section of the art direction:
//   • no outlines — materials separate by value, never by a dark line;
//   • light from the top-left — lit steps go top/left, shade bottom/right;
//   • texture stays inside 2–3 adjacent ramp steps, so the 32px sprites that
//     stand on the ground keep the contrast budget for themselves;
//   • every material transition is a soft 2-step dither, never a hard edge;
//   • three variants per ground material so a wide field never reads as a repeat.
//
// Determinism: tile texture comes from `makeRng` seeded on the tile coordinates,
// and boundary wobble from `h2`, a pure coordinate hash. Nothing here calls
// Math.random, so the same seed always bakes the same island.
import { TILE } from '../config'
import { makeRng, type Rng } from '../core/rng'
import { T, isLand, isWater, mask4, mask8, type Grid, type Terrain } from '../world/terrain'
import { PAL } from './palette'
import { hex } from './pixel'
import { fillRect, setPx, type RGBA, type Raster } from './raster'

const S = TILE

const C = (k: keyof typeof PAL, alpha?: number): RGBA => {
  const c = hex(PAL[k])
  return alpha === undefined ? c : [c[0], c[1], c[2], alpha]
}

/** Every terrain colour is a palette key — no raw hex down here. */
const col = {
  grass2: C('grass2'),
  grass3: C('grass3'),
  grass4: C('grass4'),
  grass5: C('grass5'),
  grass6: C('grass6'),
  grass7: C('grass7'),
  sand3: C('sand3'),
  sand4: C('sand4'),
  sand5: C('sand5'),
  sand6: C('sand6'),
  sand7: C('sand7'),
  path3: C('path3'),
  path4: C('path4'),
  path5: C('path5'),
  dirt3: C('dirt3'),
  dirt4: C('dirt4'),
  dirt5: C('dirt5'),
  stone2: C('stone2'),
  stone3: C('stone3'),
  stone4: C('stone4'),
  stone5: C('stone5'),
  stone6: C('stone6'),
  stone7: C('stone7'),
  wood2: C('wood2'),
  wood3: C('wood3'),
  wood4: C('wood4'),
  wood5: C('wood5'),
  wood6: C('wood6'),
  metal2: C('metal2'),
  water: C('water4'),
  waterLight: C('water5'),
  waterDeep: C('water3'),
  foam: C('water7'),
  // translucent tints: the animated ocean tilesprite shows through the chunk raster
  deepTint: C('water2', 110),
  shallowTint: C('water6', 120),
  shallowEdge: C('water5', 130),
  riverTint: C('water5', 120),
  riverEdge: C('water3', 200),
  brookTint: C('water5', 150),
  brookDeep: C('water4', 190),
  brookShade: C('water3', 205),
  brookFoam: C('water7', 190),
}

/** Value ramp for a ground material: two steps down, base, two steps up. */
type Ramp = { deep: RGBA; dark: RGBA; base: RGBA; light: RGBA; rim: RGBA }

// Tall grass deliberately shares this ramp: a meadow patch that shifted its base
// or mottle steps would read as a darker rectangle stamped on the field. Only the
// blade density differs (and the tall-grass decor sprites that stand on it).
const R_GRASS: Ramp = { deep: col.grass2, dark: col.grass4, base: col.grass5, light: col.grass6, rim: col.grass7 }
// The plateau is one step brighter: high ground catches more sun.
const R_PLATEAU: Ramp = { deep: col.grass3, dark: col.grass5, base: col.grass6, light: col.grass7, rim: col.grass7 }
const R_SANDBANK: Ramp = { deep: col.sand3, dark: col.sand5, base: col.sand6, light: col.sand7, rim: col.sand7 }
const R_PATH: Ramp = { deep: col.dirt3, dark: col.path3, base: col.path4, light: col.path5, rim: col.path5 }

const isSandy = (t: Terrain) => t === T.SAND || t === T.DOCK
const isSea = (t: Terrain) => t === T.DEEP || t === T.WATER || t === T.SHALLOW
/** Sea or beach: the neighbours that pull a sand fringe onto a grass tile. */
const isBeachy = (t: Terrain) => isSandy(t) || isSea(t)
const isStream = (t: Terrain) => t === T.RIVER || t === T.POND

/**
 * Deterministic spatial hash → 0..1. Not an RNG: the value depends only on the
 * coordinates, so a wobbly material boundary lines up across a tile seam.
 */
function h2(a: number, b: number): number {
  let n = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)
  n = Math.imul(n ^ (n >>> 15), 0x2545f491)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

/** 50% checkerboard — the workhorse of every soft material transition. */
const dith = (x: number, y: number) => ((x + y) & 1) === 0

function tileRng(x: number, y: number) {
  return makeRng((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995)
}

/* ---------------- tile-local drawing (never bleeds into a neighbour) ---------------- */

function tpx(r: Raster, px: number, py: number, x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= S || y >= S) return
  setPx(r, px + x, py + y, c)
}

function tbox(r: Raster, px: number, py: number, x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(S, x + w)
  const y1 = Math.min(S, y + h)
  if (x1 <= x0 || y1 <= y0) return
  fillRect(r, px + x0, py + y0, x1 - x0, y1 - y0, c)
}

/* ---------------- ground materials (3 variants each) ---------------- */

export const GROUND_KINDS = ['grass', 'tallgrass', 'plateau', 'sand', 'path', 'plaza', 'dock', 'bridge', 'cliff', 'brook'] as const
export type GroundKind = (typeof GROUND_KINDS)[number]
export const GROUND_VARIANTS = 3

/** Which of the three texture variants a world tile uses. Stable per coordinate. */
export function variantAt(tx: number, ty: number): number {
  return Math.min(GROUND_VARIANTS - 1, Math.floor(h2(tx * 3 + 11, ty * 7 + 5) * GROUND_VARIANTS))
}

/** Ordered 4×4 dither thresholds — the classic Bayer matrix, scaled to 0..1. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bayer = (x: number, y: number) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16

/**
 * Soft mottling: smooth 16px value noise over the WORLD grid, rendered with an
 * ordered dither so a patch fades in and out instead of ending on a cell edge.
 * Keyed to world coordinates, so the patches drift across tile seams rather than
 * repeating per tile. Sampled per 2×2 block (the noise is smooth; the dither is
 * not) to keep a full-world bake cheap.
 */
function valueField(r: Raster, px: number, py: number, ramp: Ramp, wx0: number, wy0: number): void {
  const gx0 = wx0 >> 4
  const gy0 = wy0 >> 4
  const lat: number[] = []
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) lat.push(h2(gx0 + i + 101, gy0 + j + 7))
  for (let y = 0; y < S; y += 2) {
    const cy = y >> 4
    const fy = (y & 15) / 16
    const sy = fy * fy * (3 - 2 * fy)
    for (let x = 0; x < S; x += 2) {
      const cx = x >> 4
      const fx = (x & 15) / 16
      const sx = fx * fx * (3 - 2 * fx)
      const a = lat[cy * 3 + cx]
      const b = lat[cy * 3 + cx + 1]
      const top = a + (b - a) * sx
      const c = lat[(cy + 1) * 3 + cx]
      const d = lat[(cy + 1) * 3 + cx + 1]
      const bot = c + (d - c) * sx
      const n = top + (bot - top) * sy
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          // the offsets keep a patch from ever reaching full coverage: terrain
          // texture stays a suggestion, never a second colour
          const t = bayer(wx0 + x + i, wy0 + y + j)
          if (n > 0.55 + t * 0.4) tpx(r, px, py, x + i, y + j, ramp.light)
          else if (n < 0.45 - t * 0.4) tpx(r, px, py, x + i, y + j, ramp.dark)
        }
    }
  }
}

/** Grass, tall grass and plateau: mottled turf, blades, and a hollow on v2. */
function paintTurf(r: Raster, px: number, py: number, ramp: Ramp, variant: number, rng: Rng, blades: number, wx0 = 0, wy0 = 0): void {
  fillRect(r, px, py, S, S, ramp.base)
  valueField(r, px, py, ramp, wx0, wy0)
  // blades: a short dark stem with a lit tip and a curled dark root
  const n = blades + (variant === 1 ? 5 : 0)
  for (let i = 0; i < n; i++) {
    const bx = rng.int(1, S - 2)
    const by = rng.int(4, S - 4)
    tpx(r, px, py, bx, by - 1, ramp.light)
    tpx(r, px, py, bx, by, ramp.dark)
    tpx(r, px, py, bx, by + 1, ramp.dark)
    tpx(r, px, py, bx + (rng.chance(0.5) ? 1 : -1), by + 2, ramp.deep)
  }
  if (variant === 2) {
    // a clump: blades bunched together with clover coming up through them. A
    // cluster rather than a patch of flat colour — a blotch would read as a hole.
    const cx = rng.int(7, S - 8)
    const cy = rng.int(7, S - 8)
    for (let i = 0; i < 7; i++) {
      const bx = cx + rng.int(-5, 5)
      const by = cy + rng.int(-4, 4)
      tpx(r, px, py, bx, by - 2, ramp.light)
      tpx(r, px, py, bx, by - 1, ramp.dark)
      tpx(r, px, py, bx, by, ramp.dark)
      tpx(r, px, py, bx + (rng.chance(0.5) ? 1 : -1), by + 1, ramp.deep)
    }
    for (let i = 0; i < 3; i++) tpx(r, px, py, cx + rng.int(-4, 4), cy + rng.int(-4, 2), ramp.rim)
  }
}

/** Dry beach sand: fine grain, wind ripples (v1) or half-buried pebbles (v2). */
function paintBeach(r: Raster, px: number, py: number, variant: number, rng: Rng, wx0 = 0, wy0 = 0): void {
  fillRect(r, px, py, S, S, col.sand6)
  valueField(r, px, py, R_SANDBANK, wx0, wy0)
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, S - 1)
    const y = rng.int(0, S - 1)
    tpx(r, px, py, x, y, x + y < S - 2 ? col.sand7 : col.sand5)
  }
  if (variant === 1) {
    // wind ripples: a broken trough with the crest catching light above it
    for (let y = rng.int(3, 7); y < S - 3; y += 7)
      for (let x = 0; x < S; x++) {
        const w = Math.round(Math.sin((x + y) * 0.42) * 1.5)
        if (dith(x, y)) tpx(r, px, py, x, y + w, col.sand5)
        if (dith(x + 1, y)) tpx(r, px, py, x, y + w - 1, col.sand7)
      }
  } else if (variant === 2) {
    for (let i = 0; i < 5; i++) {
      const x = rng.int(2, S - 4)
      const y = rng.int(2, S - 4)
      tbox(r, px, py, x, y, 2, 2, col.sand4)
      tpx(r, px, py, x, y, col.sand7)
    }
  }
}

/** Trodden earth track: grit, wheel ruts (v1) or stones pressed in (v2). */
function paintTrack(r: Raster, px: number, py: number, variant: number, rng: Rng, wx0 = 0, wy0 = 0): void {
  fillRect(r, px, py, S, S, col.path4)
  valueField(r, px, py, R_PATH, wx0, wy0)
  for (let i = 0; i < 22; i++) {
    const x = rng.int(0, S - 1)
    const y = rng.int(0, S - 1)
    tpx(r, px, py, x, y, x + y < S - 2 ? col.path5 : col.path3)
  }
  if (variant === 1) {
    // worn patches where the surface has been walked smooth. Deliberately not
    // wheel ruts: a track tile does not know which way the road runs, and streaks
    // drawn the wrong way comb across the direction of travel.
    for (let i = 0; i < 4; i++) {
      const bx = rng.int(2, S - 9)
      const by = rng.int(2, S - 7)
      const bw = rng.int(5, 7)
      const bh = rng.int(3, 5)
      for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
          const edge = x === 0 || y === 0 || x === bw - 1 || y === bh - 1
          if (edge && !dith(bx + x, by + y)) continue
          tpx(r, px, py, bx + x, by + y, col.path5)
        }
      for (let x = 0; x < bw; x++) if (dith(bx + x, by + bh)) tpx(r, px, py, bx + x, by + bh, col.path3)
    }
  } else if (variant === 2) {
    for (let i = 0; i < 4; i++) {
      const x = rng.int(3, S - 6)
      const y = rng.int(3, S - 6)
      tbox(r, px, py, x, y, 3, 2, col.stone4)
      tbox(r, px, py, x, y, 2, 1, col.stone6)
      tpx(r, px, py, x + 2, y + 1, col.stone3)
    }
  }
}

const CELL = 8

/**
 * Plaza cobbles: an 8px running bond phase-locked to the tile grid so the courses
 * continue across tiles. Which stone is lighter, cracked or worn comes from the
 * WORLD position (not the tile rng) so a stone straddling a seam matches itself.
 */
function paintCobbles(r: Raster, px: number, py: number, variant: number, wx0: number, wy0: number): void {
  fillRect(r, px, py, S, S, col.stone4) // mortar — one step under the stones, not a dark grid
  for (let cy = 0; cy < S; cy += CELL) {
    const off = (cy / CELL) & 1 ? CELL / 2 : 0
    for (let cx = -CELL; cx < S; cx += CELL) {
      const x0 = cx + off
      const roll = h2(wx0 + x0, wy0 + cy + variant * 977)
      const tone = roll < 0.22 ? col.stone4 : roll > 0.9 ? col.stone6 : col.stone5
      tbox(r, px, py, x0 + 1, cy + 1, CELL - 1, CELL - 1, tone)
      // knock the corners back to mortar so the stone reads round
      tpx(r, px, py, x0 + 1, cy + 1, col.stone4)
      tpx(r, px, py, x0 + CELL - 1, cy + 1, col.stone4)
      tpx(r, px, py, x0 + 1, cy + CELL - 1, col.stone4)
      tpx(r, px, py, x0 + CELL - 1, cy + CELL - 1, col.stone4)
      // lit top-left rim, shaded bottom-right
      for (let k = 2; k < CELL - 1; k++) {
        tpx(r, px, py, x0 + k, cy + 1, col.stone6)
        tpx(r, px, py, x0 + 1, cy + k, col.stone6)
        tpx(r, px, py, x0 + k, cy + CELL - 1, col.stone4)
        tpx(r, px, py, x0 + CELL - 1, cy + k, col.stone4)
      }
      // wear: a chip out of the surface, sited from the world hash
      const wear = h2(wx0 + x0 + 31, wy0 + cy + 17 + variant * 613)
      if (wear < 0.3) {
        const wx = x0 + 2 + Math.floor(wear * 12) % 4
        const wy = cy + 3 + Math.floor(wear * 40) % 3
        tpx(r, px, py, wx, wy, col.stone4)
        tpx(r, px, py, wx + 1, wy, col.stone4)
        tpx(r, px, py, wx, wy + 1, col.stone7)
      }
    }
  }
}

/**
 * Deck planking. `axis` is the seam direction: 'h' for boards running east-west
 * (docks), 'v' for boards laid across the span (bridges). Seams are phase-locked
 * to the 8px grid so boards line up tile to tile.
 */
function paintPlanks(r: Raster, px: number, py: number, variant: number, rng: Rng, axis: 'h' | 'v'): void {
  fillRect(r, px, py, S, S, col.wood5)
  for (let i = 0; i < S; i += CELL) {
    if (axis === 'h') {
      tbox(r, px, py, 0, i, S, 1, col.wood3)
      tbox(r, px, py, 0, i + 1, S, 1, col.wood6)
      tbox(r, px, py, 0, i + CELL - 1, S, 1, col.wood4)
    } else {
      tbox(r, px, py, i, 0, 1, S, col.wood3)
      tbox(r, px, py, i + 1, 0, 1, S, col.wood6)
      tbox(r, px, py, i + CELL - 1, 0, 1, S, col.wood4)
    }
  }
  // grain: short dashes one step either side of the board colour
  for (let i = 0; i < 14; i++) {
    const len = rng.int(3, 7)
    const c = rng.chance(0.5) ? col.wood4 : col.wood6
    const a = rng.int(2, S - 8)
    const b = rng.int(2, S - 3)
    for (let k = 0; k < len; k++) {
      if (axis === 'h') tpx(r, px, py, a + k, b, c)
      else tpx(r, px, py, b, a + k, c)
    }
  }
  if (variant === 0) {
    // a split opening along one board, lit on its upper lip
    const b = rng.int(1, 3) * CELL - 3
    const a0 = rng.int(2, S - 15)
    const len = rng.int(9, 14)
    for (let k = 0; k < len; k++) {
      const j = k * 2 > len ? 1 : 0
      if (axis === 'h') {
        tpx(r, px, py, a0 + k, b + j, col.wood3)
        tpx(r, px, py, a0 + k, b + j - 1, col.wood6)
      } else {
        tpx(r, px, py, b + j, a0 + k, col.wood3)
        tpx(r, px, py, b + j - 1, a0 + k, col.wood6)
      }
    }
  } else if (variant === 1) {
    // a knot: dark core, lit crown, grain closing around it
    const kx = rng.int(6, S - 11)
    const ky = rng.int(6, S - 11)
    tbox(r, px, py, kx, ky, 5, 4, col.wood3)
    tbox(r, px, py, kx + 1, ky + 1, 3, 2, col.wood2)
    tbox(r, px, py, kx + 1, ky, 3, 1, col.wood6)
    tbox(r, px, py, kx - 1, ky + 1, 1, 2, col.wood4)
    tbox(r, px, py, kx + 5, ky + 1, 1, 2, col.wood4)
    tpx(r, px, py, kx, ky - 1, col.wood6)
  } else {
    // a scuffed, sun-bleached board: broken runs, not a dotted line
    const b = rng.int(1, 3) * CELL - 4
    for (let k = 2; k < S - 3; k += 5) {
      const len = rng.int(2, 4)
      for (let j = 0; j < len; j++) {
        if (axis === 'h') {
          tpx(r, px, py, k + j, b, col.wood6)
          tpx(r, px, py, k + j, b + 1, col.wood4)
        } else {
          tpx(r, px, py, b, k + j, col.wood6)
          tpx(r, px, py, b + 1, k + j, col.wood4)
        }
      }
    }
  }
}

/**
 * Cliff face. The rock is a lit mass, not a set of lines: the face brightens
 * toward the top (where the sky reaches it) and sinks into shadow at the base.
 * Strata sit on fixed rows so neighbouring cliff tiles line up, with per-tile
 * broken ends so the run never reads as a ruled line.
 */
function paintRockFace(r: Raster, px: number, py: number, variant: number, rng: Rng, wx0 = 0, wy0 = 0): void {
  fillRect(r, px, py, S, S, col.stone4)
  // vertical light gradient: sky-lit at the top, sinking into shadow at the base,
  // ramped with the ordered dither so neither end shows a band
  for (let y = 0; y < S; y++) {
    const up = Math.max(0, (10 - y) / 10)
    const down = Math.max(0, (y - 18) / 13)
    for (let x = 0; x < S; x++) {
      const t = bayer(wx0 + x, wy0 + y)
      if (up > t) tpx(r, px, py, x, y, col.stone5)
      else if (down > t) tpx(r, px, py, x, y, col.stone3)
    }
  }
  for (const y of [11, 21]) {
    const x0 = rng.int(0, 9)
    const x1 = S - rng.int(0, 9)
    tbox(r, px, py, x0, y, x1 - x0, 3, col.stone3)
    tbox(r, px, py, x0, y - 1, x1 - x0, 1, col.stone5)
    for (let x = x0; x < x1; x++) if (dith(wx0 + x, wy0 + y)) tpx(r, px, py, x, y + 3, col.stone3)
  }
  for (let i = 0; i < 10; i++) {
    const x = rng.int(0, S - 1)
    const y = rng.int(0, S - 1)
    tpx(r, px, py, x, y, x + y < S - 2 ? col.stone5 : col.stone3)
  }
  if (variant === 1) {
    // a crack running down the face
    let cx = rng.int(6, S - 7)
    for (let y = 2; y < S - 2; y++) {
      tpx(r, px, py, cx, y, col.stone2)
      tpx(r, px, py, cx + 1, y, col.stone3)
      if (rng.chance(0.3)) cx += rng.chance(0.5) ? 1 : -1
      cx = Math.max(2, Math.min(S - 4, cx))
    }
  } else if (variant === 2) {
    // an outcrop block: lit top-left faces, shadow down its right side
    const bx = rng.int(3, S - 14)
    const by = rng.int(4, S - 14)
    const bw = rng.int(9, 12)
    const bh = rng.int(7, 10)
    tbox(r, px, py, bx, by, bw, bh, col.stone4)
    tbox(r, px, py, bx, by, bw, 1, col.stone6)
    tbox(r, px, py, bx, by, 1, bh, col.stone5)
    tbox(r, px, py, bx + bw - 1, by, 1, bh, col.stone2)
    tbox(r, px, py, bx, by + bh - 1, bw, 1, col.stone2)
  } else {
    // pitting
    for (let i = 0; i < 6; i++) {
      const x = rng.int(2, S - 4)
      const y = rng.int(2, S - 4)
      tbox(r, px, py, x, y, 2, 1, col.stone3)
      tpx(r, px, py, x, y - 1, col.stone6)
    }
  }
}

/**
 * The brook: a one-tile-wide stream cut into the bank. `conn` is a mask4 of the
 * sides the water continues into (N=1 E=2 S=4 W=8); 0 falls back to north-south,
 * which is also what the standalone variant painter draws.
 */
function paintBrookTile(r: Raster, px: number, py: number, variant: number, rng: Rng, conn: number, bank: Ramp, wx0: number, wy0: number): void {
  // 1. the land the stream is cut into
  paintTurf(r, px, py, bank, 0, rng, 3, wx0, wy0)

  // 2. the channel: a half-strip toward each connected side, plus the middle
  const lo = 7
  const hi = 25
  const strips: [number, number, number, number][] = [[lo, lo, hi - lo, hi - lo]]
  const c = conn === 0 ? 1 | 4 : conn
  if (c & 1) strips.push([lo, 0, hi - lo, hi])
  if (c & 4) strips.push([lo, lo, hi - lo, S - lo])
  if (c & 2) strips.push([lo, lo, S - lo, hi - lo])
  if (c & 8) strips.push([0, lo, hi, hi - lo])
  const mask = new Uint8Array(S * S)
  for (const [sx, sy, sw, sh] of strips)
    for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) mask[y * S + x] = 1
  const wet = (x: number, y: number) => mask[Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))] === 1

  // 3. the damp verge: three steps of earth down to the waterline. The bank that
  // faces the light (the east and south sides) keeps its light step; the bank the
  // light comes over drops into its own shadow.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (mask[y * S + x]) continue
      let d = 9
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= S || ny >= S || !mask[ny * S + nx]) continue
          d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)))
        }
      const shaded = wet(x + 1, y) || wet(x, y + 1)
      if (d === 1) tpx(r, px, py, x, y, shaded ? col.dirt3 : col.dirt5)
      else if (d === 2) tpx(r, px, py, x, y, col.dirt4)
      else if (d === 3 && dith(wx0 + x, wy0 + y)) tpx(r, px, py, x, y, col.dirt5)
    }

  // 4. the water: shadow under the lit (north/west) bank, sparkle on the far side
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!mask[y * S + x]) continue
      const shaded = !wet(x, y - 1) || !wet(x - 1, y)
      const far = !wet(x, y + 1) || !wet(x + 1, y)
      let c2 = col.brookTint
      if (shaded) c2 = col.brookShade
      else if (far && dith(wx0 + x, wy0 + y)) c2 = col.brookFoam
      else if (!far && h2(wx0 + x, wy0 + y) < 0.18) c2 = col.brookDeep
      tpx(r, px, py, x, y, c2)
    }

  // 5. what the stream runs over
  if (variant === 1) {
    for (let i = 0; i < 3; i++) {
      const x = rng.int(lo + 1, hi - 4)
      const y = rng.int(lo + 1, hi - 2)
      if (!mask[y * S + x]) continue
      tbox(r, px, py, x, y, 3, 1, col.brookFoam)
    }
  } else if (variant === 2) {
    const x = rng.int(lo + 2, hi - 6)
    const y = rng.int(lo + 2, hi - 5)
    if (mask[y * S + x]) {
      tbox(r, px, py, x, y, 4, 3, col.stone3)
      tbox(r, px, py, x, y, 3, 1, col.stone5)
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const x = rng.int(lo + 1, hi - 3)
      const y = rng.int(lo + 1, hi - 3)
      if (!mask[y * S + x]) continue
      tbox(r, px, py, x, y, 2, 2, col.stone4)
      tpx(r, px, py, x, y, col.stone6)
    }
  }
}

/**
 * Paint one ground material into a TILE×TILE box at (px,py) — texture only, no
 * neighbour-aware edges. `tx`/`ty` are the world tile coordinates, used where a
 * pattern must stay continuous across a tile seam.
 */
export function paintGround(r: Raster, px: number, py: number, kind: GroundKind, variant: number, rng: Rng, tx = 0, ty = 0): void {
  const wx0 = tx * S
  const wy0 = ty * S
  switch (kind) {
    case 'grass':
      paintTurf(r, px, py, R_GRASS, variant, rng, 4, wx0, wy0)
      break
    case 'tallgrass':
      paintTurf(r, px, py, R_GRASS, variant, rng, 12, wx0, wy0)
      break
    case 'plateau':
      paintTurf(r, px, py, R_PLATEAU, variant, rng, 5, wx0, wy0)
      break
    case 'sand':
      paintBeach(r, px, py, variant, rng, wx0, wy0)
      break
    case 'path':
      paintTrack(r, px, py, variant, rng, wx0, wy0)
      break
    case 'plaza':
      paintCobbles(r, px, py, variant, wx0, wy0)
      break
    case 'dock':
      paintPlanks(r, px, py, variant, rng, 'h')
      break
    case 'bridge':
      paintPlanks(r, px, py, variant, rng, 'v')
      break
    case 'cliff':
      paintRockFace(r, px, py, variant, rng, wx0, wy0)
      break
    case 'brook':
      paintBrookTile(r, px, py, variant, rng, 0, R_GRASS, wx0, wy0)
      break
  }
}

/* ---------------- autotile edges ---------------- */

type Side = 'n' | 'e' | 's' | 'w'

/** Tile-local pixel `k` steps in from `side`, `i` along it. */
function edgeXY(side: Side, i: number, k: number): [number, number] {
  if (side === 'n') return [i, k]
  if (side === 's') return [i, S - 1 - k]
  if (side === 'w') return [k, i]
  return [S - 1 - k, i]
}

/** Beach creeping onto a grass tile: sand, damp sand, dither, damp turf, turf. */
function beachFringe(r: Raster, px: number, py: number, side: Side, wx0: number, wy0: number, ramp: Ramp): void {
  const lit = side === 'n' || side === 'w'
  const horizontal = side === 'n' || side === 's'
  for (let i = 0; i < S; i++) {
    const along = horizontal ? wx0 + i : wy0 + i
    const depth = 4 + Math.floor(h2(along, horizontal ? 1 : 2) * 3)
    for (let k = 0; k <= depth + 2; k++) {
      const [x, y] = edgeXY(side, i, k)
      let c: RGBA | null = null
      if (k < depth - 1) c = col.sand6
      else if (k === depth - 1) c = col.sand5
      else if (k === depth) c = dith(wx0 + x, wy0 + y) ? col.sand5 : ramp.dark
      else if (k === depth + 1) c = ramp.dark
      else if (!lit && dith(wx0 + x, wy0 + y)) c = ramp.dark
      if (c) tpx(r, px, py, x, y, c)
    }
    if (lit && dith(along, 0)) {
      const [x, y] = edgeXY(side, i, 0)
      tpx(r, px, py, x, y, col.sand7)
    }
  }
}

/**
 * Earth bank where turf meets the river or a pond. Kept two ramp steps wide and
 * dithered on the way out — a hard dark line here reads as an outline, which
 * terrain never gets.
 */
function riverBank(r: Raster, px: number, py: number, side: Side, wx0: number, wy0: number): void {
  const horizontal = side === 'n' || side === 's'
  // a tile whose south or east side meets the water sits on the water's north or
  // west bank, so its cut slopes away from the light and darkens
  const shaded = side === 's' || side === 'e'
  for (let i = 0; i < S; i++) {
    const along = horizontal ? wx0 + i : wy0 + i
    const depth = 2 + Math.floor(h2(along, horizontal ? 5 : 6) * 2)
    for (let k = 0; k <= depth; k++) {
      const [x, y] = edgeXY(side, i, k)
      const lip = shaded && dith(wx0 + x, wy0 + y) ? col.dirt3 : col.dirt4
      const c = k === 0 ? lip : k < depth ? col.dirt5 : dith(wx0 + x, wy0 + y) ? col.dirt5 : null
      if (c) tpx(r, px, py, x, y, c)
    }
  }
}

/** Wet sand where the beach meets water. */
function wetBand(r: Raster, px: number, py: number, side: Side, wx0: number, wy0: number): void {
  const horizontal = side === 'n' || side === 's'
  for (let i = 0; i < S; i++) {
    const along = horizontal ? wx0 + i : wy0 + i
    const depth = 4 + Math.floor(h2(along, horizontal ? 3 : 4) * 3)
    for (let k = 0; k <= depth + 1; k++) {
      const [x, y] = edgeXY(side, i, k)
      let c: RGBA | null = null
      if (k === 0) c = col.sand3
      else if (k < depth - 1) c = col.sand4
      else if (k === depth - 1) c = dith(wx0 + x, wy0 + y) ? col.sand4 : col.sand5
      else if (k === depth) c = col.sand5
      else if (dith(wx0 + x, wy0 + y)) c = col.sand5
      if (c) tpx(r, px, py, x, y, c)
    }
  }
}

/** The neighbouring ground creeping over the edge of a track, over a trodden rim. */
function trackEdge(r: Raster, px: number, py: number, side: Side, wx0: number, wy0: number, into: RGBA, intoDark: RGBA): void {
  const lit = side === 'n' || side === 'w'
  const horizontal = side === 'n' || side === 's'
  for (let i = 0; i < S; i++) {
    const along = horizontal ? wx0 + i : wy0 + i
    const depth = 2 + Math.floor(h2(along, horizontal ? 7 : 8) * 3)
    for (let k = 0; k <= depth + 1; k++) {
      const [x, y] = edgeXY(side, i, k)
      let c: RGBA | null = null
      if (k < depth - 1) c = dith(wx0 + x, wy0 + y + 1) ? into : intoDark
      else if (k === depth - 1) c = dith(wx0 + x, wy0 + y) ? into : col.path3
      else if (k === depth) c = col.path3
      else if (!lit && dith(wx0 + x, wy0 + y)) c = col.path3
      if (c) tpx(r, px, py, x, y, c)
    }
  }
}

/* ---------------- the tile painter ---------------- */

export function paintTile(r: Raster, px: number, py: number, grid: Grid, x: number, y: number): void {
  const t = grid.get(x, y)
  const rng = tileRng(x, y)
  const v = variantAt(x, y)
  const wx0 = x * S
  const wy0 = y * S
  const nb = (dx: number, dy: number): Terrain => (grid.inb(x + dx, y + dy) ? grid.get(x + dx, y + dy) : T.DEEP)

  switch (t) {
    case T.GRASS:
    case T.TALLGRASS:
    case T.PLATEAU: {
      const ramp = t === T.PLATEAU ? R_PLATEAU : R_GRASS
      paintGround(r, px, py, t === T.PLATEAU ? 'plateau' : t === T.TALLGRASS ? 'tallgrass' : 'grass', v, rng, x, y)
      // beach fringe — mask8 bit set means "not beachy that way"
      const m = mask8(grid, x, y, (n) => !isBeachy(n))
      if (!(m & 1)) beachFringe(r, px, py, 'n', wx0, wy0, ramp)
      if (!(m & 4)) beachFringe(r, px, py, 'e', wx0, wy0, ramp)
      if (!(m & 16)) beachFringe(r, px, py, 's', wx0, wy0, ramp)
      if (!(m & 64)) beachFringe(r, px, py, 'w', wx0, wy0, ramp)
      // diagonal-only neighbours get a soft corner of sand
      const nub = (cx: number, cy: number) => {
        for (let k = 0; k < 3; k++)
          for (let j = 0; j < 3; j++) {
            if (k + j > 3) continue
            tpx(r, px, py, cx === 0 ? j : S - 1 - j, cy === 0 ? k : S - 1 - k, k + j === 3 ? col.sand5 : col.sand6)
          }
      }
      if (m & 1 && m & 4 && !(m & 2)) nub(1, 0)
      if (m & 4 && m & 16 && !(m & 8)) nub(1, 1)
      if (m & 16 && m & 64 && !(m & 32)) nub(0, 1)
      if (m & 64 && m & 1 && !(m & 128)) nub(0, 0)
      // river and pond banks
      if (isStream(nb(0, -1))) riverBank(r, px, py, 'n', wx0, wy0)
      if (isStream(nb(1, 0))) riverBank(r, px, py, 'e', wx0, wy0)
      if (isStream(nb(0, 1))) riverBank(r, px, py, 's', wx0, wy0)
      if (isStream(nb(-1, 0))) riverBank(r, px, py, 'w', wx0, wy0)
      break
    }
    case T.SAND: {
      paintGround(r, px, py, 'sand', v, rng, x, y)
      const m = mask4(grid, x, y, (n) => !isSea(n) && !isStream(n))
      if (!(m & 1)) wetBand(r, px, py, 'n', wx0, wy0)
      if (!(m & 2)) wetBand(r, px, py, 'e', wx0, wy0)
      if (!(m & 4)) wetBand(r, px, py, 's', wx0, wy0)
      if (!(m & 8)) wetBand(r, px, py, 'w', wx0, wy0)
      break
    }
    case T.PATH: {
      paintGround(r, px, py, 'path', v, rng, x, y)
      const m = mask8(grid, x, y, (n) => n === T.PATH || n === T.PLAZA || n === T.BRIDGE || n === T.DOCK)
      const into = (dx: number, dy: number): [RGBA, RGBA] => {
        const n = nb(dx, dy)
        if (isSandy(n)) return [col.sand6, col.sand5]
        if (n === T.PLATEAU) return [R_PLATEAU.base, R_PLATEAU.dark]
        if (isWater(n)) return [col.dirt4, col.dirt3]
        return [R_GRASS.base, R_GRASS.dark]
      }
      if (!(m & 1)) trackEdge(r, px, py, 'n', wx0, wy0, ...into(0, -1))
      if (!(m & 4)) trackEdge(r, px, py, 'e', wx0, wy0, ...into(1, 0))
      if (!(m & 16)) trackEdge(r, px, py, 's', wx0, wy0, ...into(0, 1))
      if (!(m & 64)) trackEdge(r, px, py, 'w', wx0, wy0, ...into(-1, 0))
      break
    }
    case T.PLAZA: {
      paintGround(r, px, py, 'plaza', v, rng, x, y)
      // kerb: lit on the north and west, shaded on the south and east
      const m = mask4(grid, x, y, (n) => n === T.PLAZA || n === T.PATH)
      if (!(m & 1)) {
        tbox(r, px, py, 0, 0, S, 1, col.stone6)
        tbox(r, px, py, 0, 1, S, 1, col.stone4)
      }
      if (!(m & 8)) {
        tbox(r, px, py, 0, 0, 1, S, col.stone6)
        tbox(r, px, py, 1, 0, 1, S, col.stone4)
      }
      // the shaded kerb stays a value step, never a black rule: an outline here
      // would fight every sprite standing on the plaza
      if (!(m & 4)) {
        tbox(r, px, py, 0, S - 2, S, 1, col.stone4)
        tbox(r, px, py, 0, S - 1, S, 1, col.stone3)
      }
      if (!(m & 2)) {
        tbox(r, px, py, S - 2, 0, 1, S, col.stone4)
        tbox(r, px, py, S - 1, 0, 1, S, col.stone3)
      }
      break
    }
    case T.DOCK: {
      paintGround(r, px, py, 'dock', v, rng, x, y)
      // iron studs, phase-locked to the plank grid
      for (let i = 4; i < S; i += CELL) {
        tpx(r, px, py, 4, i, col.metal2)
        tpx(r, px, py, S - 5, i, col.metal2)
      }
      const m = mask4(grid, x, y, (n) => n === T.DOCK || isLand(n))
      if (!(m & 8)) tbox(r, px, py, 0, 0, 3, S, col.wood2)
      if (!(m & 2)) tbox(r, px, py, S - 3, 0, 3, S, col.wood2)
      if (!(m & 4)) tbox(r, px, py, 0, S - 3, S, 3, col.wood2)
      if (!(m & 1)) tbox(r, px, py, 0, 0, S, 2, col.wood6)
      break
    }
    case T.BRIDGE: {
      paintGround(r, px, py, 'bridge', v, rng, x, y)
      const m = mask4(grid, x, y, (n) => !isWater(n))
      if (!(m & 1)) {
        tbox(r, px, py, 0, 0, S, 5, col.wood2)
        tbox(r, px, py, 0, 0, S, 2, col.wood6)
        tbox(r, px, py, 0, 5, S, 1, col.wood3)
      }
      if (!(m & 4)) {
        tbox(r, px, py, 0, S - 5, S, 5, col.wood2)
        tbox(r, px, py, 0, S - 2, S, 2, col.wood3)
        tbox(r, px, py, 0, S - 5, S, 1, col.wood6)
      }
      break
    }
    case T.CLIFF: {
      paintGround(r, px, py, 'cliff', v, rng, x, y)
      const up = nb(0, -1)
      const down = nb(0, 1)
      if (up === T.PLATEAU || up === T.CLIFF) {
        // we are the front face: the lip above catches the light
        tbox(r, px, py, 0, 0, S, 2, col.stone6)
        for (let i = 0; i < S; i++) if (dith(wx0 + i, wy0 + 2)) tpx(r, px, py, i, 2, col.stone5)
      } else {
        // we are the back face: the high ground runs over the top
        tbox(r, px, py, 0, 0, S, 3, R_PLATEAU.base)
        for (let i = 0; i < S; i++) {
          tpx(r, px, py, i, 3, dith(wx0 + i, wy0 + 3) ? R_PLATEAU.dark : col.stone5)
          if (dith(wx0 + i, 0)) tpx(r, px, py, i, 0, R_PLATEAU.light)
        }
      }
      if (down !== T.CLIFF && down !== T.PLATEAU) {
        tbox(r, px, py, 0, S - 5, S, 3, col.stone3)
        tbox(r, px, py, 0, S - 2, S, 2, col.stone2)
      }
      // light from the top-left: the west edge is lit, the east edge falls away
      if (nb(-1, 0) !== T.CLIFF && nb(-1, 0) !== T.PLATEAU) {
        tbox(r, px, py, 0, 3, 1, S - 3, col.stone5)
        tbox(r, px, py, 1, 3, 1, S - 3, col.stone4)
      }
      if (nb(1, 0) !== T.CLIFF && nb(1, 0) !== T.PLATEAU) {
        tbox(r, px, py, S - 2, 3, 1, S - 3, col.stone3)
        tbox(r, px, py, S - 1, 3, 1, S - 3, col.stone2)
      }
      break
    }
    case T.BROOK: {
      const conn = mask4(grid, x, y, (n) => isWater(n))
      const sandy = isSandy(nb(-1, 0)) || isSandy(nb(1, 0)) || isSandy(nb(0, -1)) || isSandy(nb(0, 1))
      paintBrookTile(r, px, py, v, rng, conn, sandy ? R_SANDBANK : R_GRASS, wx0, wy0)
      break
    }
    case T.RIVER:
    case T.POND: {
      fillRect(r, px, py, S, S, col.riverTint)
      const m = mask4(grid, x, y, (n) => isWater(n))
      // the north and west banks throw their shadow onto the water; the far side
      // catches the light instead, so the water never gets a full dark outline
      const shadowEdge = (side: Side) => {
        for (let i = 0; i < S; i++)
          for (let k = 0; k < 3; k++) {
            const [ex, ey] = edgeXY(side, i, k)
            if (k < 2 || dith(wx0 + ex, wy0 + ey)) tpx(r, px, py, ex, ey, col.riverEdge)
          }
      }
      const litEdge = (side: Side) => {
        for (let i = 0; i < S; i++)
          for (let k = 0; k < 2; k++) {
            const [ex, ey] = edgeXY(side, i, k)
            if (k === 0 || dith(wx0 + ex, wy0 + ey)) tpx(r, px, py, ex, ey, col.brookFoam)
          }
      }
      if (!(m & 1)) shadowEdge('n')
      if (!(m & 8)) shadowEdge('w')
      if (!(m & 4)) litEdge('s')
      if (!(m & 2)) litEdge('e')
      for (let i = 0; i < 5; i++) {
        const rx = rng.int(2, S - 6)
        const ry = rng.int(2, S - 3)
        tbox(r, px, py, rx, ry, rng.int(2, 4), 1, col.brookFoam)
      }
      break
    }
    case T.SHALLOW: {
      fillRect(r, px, py, S, S, col.shallowTint)
      // soften the step into open water with a 2-step dither
      const m = mask4(grid, x, y, (n) => n !== T.WATER && n !== T.DEEP)
      const band = (side: Side) => {
        for (let i = 0; i < S; i++)
          for (let k = 0; k < 5; k++) {
            const [ex, ey] = edgeXY(side, i, k)
            if (k < 3 || dith(wx0 + ex, wy0 + ey)) tpx(r, px, py, ex, ey, col.shallowEdge)
          }
      }
      if (!(m & 1)) band('n')
      if (!(m & 2)) band('e')
      if (!(m & 4)) band('s')
      if (!(m & 8)) band('w')
      break
    }
    case T.DEEP: {
      fillRect(r, px, py, S, S, col.deepTint)
      // dither the step up into open water so the depth change is not a straight line
      const m = mask4(grid, x, y, (n) => n === T.DEEP)
      const fade = (side: Side) => {
        for (let i = 0; i < S; i++)
          for (let k = 0; k < 6; k++) {
            const [ex, ey] = edgeXY(side, i, k)
            if (k < 3 || dith(wx0 + ex, wy0 + ey)) tpx(r, px, py, ex, ey, [0, 0, 0, 0])
          }
      }
      if (!(m & 1)) fade('n')
      if (!(m & 2)) fade('e')
      if (!(m & 4)) fade('s')
      if (!(m & 8)) fade('w')
      break
    }
    default:
      break
  }
}

/** 64×64 seamless animated ocean tile (4 frames). Renderer-tuned size: leave as is. */
export function paintWaterFrame(r: Raster, ox: number, oy: number, frame: number): void {
  fillRect(r, ox, oy, 64, 64, col.water)
  const rng = makeRng(991)
  for (let i = 0; i < 26; i++) {
    const x0 = rng.int(0, 63)
    const y0 = rng.int(0, 63)
    const len = rng.int(3, 8)
    const dark = rng.chance(0.35)
    const phase = (frame + (i % 4)) % 4
    const dy = phase === 1 ? 1 : phase === 3 ? -1 : 0
    for (let k = 0; k < len; k++) {
      const x = (x0 + k + frame * 2) % 64
      const y = (y0 + dy + 64) % 64
      setPx(r, ox + x, oy + y, dark ? col.waterDeep : col.waterLight)
    }
    if (!dark && phase === 2) setPx(r, ox + ((x0 + frame * 2) % 64), oy + ((y0 + 63) % 64), col.foam)
  }
}

/** 16×16 foam edge (north side) animated over 4 frames. Renderer-tuned size. */
export function paintFoamFrame(r: Raster, ox: number, oy: number, frame: number): void {
  for (let x = 0; x < 16; x++) {
    const wave = Math.round(Math.sin((x / 16) * Math.PI * 2 + frame * (Math.PI / 2)) * 1.2)
    const y = 2 + wave
    setPx(r, ox + x, oy + y, col.foam)
    if ((x + frame) % 3 === 0) setPx(r, ox + x, oy + y + 1, [232, 248, 255, 140])
    if ((x + frame) % 5 === 0) setPx(r, ox + x, oy + y - 1, [232, 248, 255, 120])
  }
}

/** Minimap: a few px per tile, terrain colours. */
export function terrainColor(t: Terrain): RGBA {
  switch (t) {
    case T.DEEP:
      return col.waterDeep
    case T.WATER:
      return col.water
    case T.SHALLOW:
      return C('shallow')
    case T.SAND:
      return col.sand6
    case T.GRASS:
    case T.TALLGRASS:
      return col.grass5
    case T.PLATEAU:
      return R_PLATEAU.base
    case T.PATH:
      return col.path4
    case T.CLIFF:
      return col.stone4
    case T.RIVER:
    case T.POND:
    case T.BROOK:
      return col.waterLight
    case T.BRIDGE:
    case T.DOCK:
      return col.wood5
    case T.PLAZA:
      return col.stone5
    default:
      return col.grass5
  }
}
