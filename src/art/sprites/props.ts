// Prop sprites at 32px HD: village fixtures, harbour props, quest items and
// speech bubbles.
//
// House rules (art-direction.md):
//  • light falls from the TOP-LEFT — every mass is modelled with 2–3 adjacent
//    steps of one palette ramp, the brightest step running as a 1px rim along
//    the top/left silhouette;
//  • no pillow shading: values slide ACROSS a form, they never ring its centre;
//  • 1px `outline` on the outer silhouette only — interior detail is value steps;
//  • hoppable furniture (crate, barrel) keeps ≤ ~20px of drawn height inside its
//    frame so the hero's hop reads as clearing it.
//
// Why so much `paint` here: at 96px a hand-typed ASCII grid is 96 characters
// wide and stops being legible as art, and the ramp vocabulary below (`slab`,
// `orb`, `bar`, `shingles`) enforces one light law across the whole pack. The
// small hand-drawn icons stay ASCII, where every pixel is a decision.
import type { PalKey } from '../palette'
import type { Legend, SpriteDef } from '../pixel'
import { K, withOutline } from '../procedural'
import { fillRect, setPx, type Raster } from '../raster'

const ascii = (name: string, rows: string[], legend: Legend, opts: Partial<SpriteDef> = {}): SpriteDef => ({
  name,
  rows,
  legend,
  outline: 'outline',
  ...opts,
})

/* ------------------------------------------------------------------ *
 * HD drawing vocabulary — ramps are dark → light, index 0 is deepest.
 * ------------------------------------------------------------------ */

type Ramp = readonly PalKey[]

const WOOD: Ramp = ['wood1', 'wood2', 'wood3', 'wood4', 'wood5', 'wood6', 'wood7']
const STONE: Ramp = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5', 'stone6', 'stone7']
const WATER: Ramp = ['water1', 'water2', 'water3', 'water4', 'water5', 'water6', 'water7']
const METAL: Ramp = ['metal1', 'metal2', 'metal3', 'metal4', 'metal5', 'metal6']
const BRASS: Ramp = ['yellow1', 'yellow2', 'yellow3', 'yellow4', 'yellow5', 'yellow6', 'yellow7']
const PLASTER: Ramp = ['wall1', 'wall2', 'wall3', 'wall4', 'wall5', 'wall6']
const CLOTH: Ramp = ['cream1', 'cream2', 'cream3', 'cream4', 'cream5', 'cream6']
const CANVAS: Ramp = ['roofRed1', 'roofRed2', 'roofRed3', 'roofRed4', 'roofRed5', 'roofRed6']
const CORK: Ramp = ['path1', 'path2', 'path3', 'path4', 'path5', 'path6']
const SLATE: Ramp = ['roofGreen1', 'roofGreen2', 'roofGreen3', 'roofGreen4', 'roofGreen5', 'roofGreen6']
const RED: Ramp = ['red1', 'red2', 'red3', 'red4', 'red5', 'red6']

/** Clamp a fractional ramp position to a palette key. */
const tone = (ramp: Ramp, i: number): PalKey => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))]

/**
 * Same, but a value landing between two steps breaks up with a sparse 2×1
 * dither instead of a hard edge. Only for LARGE flat surfaces (tower walls),
 * per the dithering rule — never on characters or hand-scale props.
 */
const toneDither = (ramp: Ramp, i: number, x: number, y: number): PalKey => {
  const lo = Math.floor(i)
  const f = i - lo
  const checker = (x + y) % 2 === 0
  return tone(ramp, f > 0.62 || (f > 0.38 && checker) ? lo + 1 : lo)
}

const px = (r: Raster, x: number, y: number, k: PalKey): void => setPx(r, x, y, K(k))
const box = (r: Raster, x: number, y: number, w: number, h: number, k: PalKey): void => fillRect(r, x, y, w, h, K(k))

/** Deterministic 0..1 hash — grain and speckle without carrying an rng around. */
const noise = (x: number, y: number, salt = 0): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453
  return n - Math.floor(n)
}

/** Rectangular slab lit from the top-left: rim, body, bottom/right shade. */
function slab(r: Raster, x: number, y: number, w: number, h: number, ramp: Ramp, base: number): void {
  box(r, x, y, w, h, tone(ramp, base))
  box(r, x, y, w, 1, tone(ramp, base + 2))
  box(r, x, y, 1, h, tone(ramp, base + 1))
  box(r, x + w - 1, y, 1, h, tone(ramp, base - 2))
  box(r, x, y + h - 1, w, 1, tone(ramp, base - 2))
}

/** Plank seams inside a slab: a dark groove with the next board's lit edge beside it. */
function seams(r: Raster, x: number, y: number, w: number, h: number, ramp: Ramp, base: number, pitch: number): void {
  for (let sx = x + pitch; sx < x + w - 1; sx += pitch) {
    box(r, sx, y + 1, 1, h - 2, tone(ramp, base - 2))
    box(r, sx + 1, y + 1, 1, h - 2, tone(ramp, base + 1))
  }
}

/** Filled ellipse whose value slides with the top-left light (never a pillow ring). */
function orb(r: Raster, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, base: number, spread = 1.8): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy > 1) continue
      px(r, x, y, tone(ramp, base + (-dx * 0.5 - dy * 0.86) * spread))
    }
}

/** Thick segment; the value slides across the bar so round stock reads as round. */
function bar(
  r: Raster,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  half: number,
  ramp: Ramp,
  base: number,
  spread = 2,
): void {
  const len = Math.hypot(x1 - x0, y1 - y0)
  const ux = (x1 - x0) / len
  const uy = (y1 - y0) / len
  const nx = -uy
  const ny = ux
  const lit = nx * -0.5 + ny * -0.86
  for (let t = 0; t <= len; t += 0.35)
    for (let o = -half; o <= half; o += 0.35) {
      const x = Math.round(x0 + ux * t + nx * o)
      const y = Math.round(y0 + uy * t + ny * o)
      px(r, x, y, tone(ramp, base + (lit * o * spread) / half))
    }
}

/** Shingled slope: half-width `hw(y)` around `cx`, courses every `pitch` rows. */
function shingles(
  r: Raster,
  cx: number,
  y0: number,
  y1: number,
  hw: (y: number) => number,
  ramp: Ramp,
  base: number,
  pitch = 5,
): void {
  for (let y = y0; y <= y1; y++) {
    const half = Math.max(1, Math.round(hw(y)))
    for (let x = cx - half; x <= cx + half; x++) {
      const n = (cx - x) / half
      const course = (y - y0) % pitch === 0
      px(r, x, y, tone(ramp, (course ? base - 1.6 : base) + n * 1.5))
    }
  }
}

/* ------------------------------------------------------------------ *
 * fountain — 96×96 × 3 frames
 * ------------------------------------------------------------------ */

const FOUNT_W = 96
const BASIN_CY = 66
const BASIN_RX = 44
const BASIN_RY = 16
const BASIN_WALL = 10

function fountainBasin(s: Raster, ox: number): void {
  const cx = ox + 48
  for (let y = BASIN_CY - BASIN_RY; y <= BASIN_CY + BASIN_RY + BASIN_WALL; y++)
    for (let x = cx - BASIN_RX; x <= cx + BASIN_RX; x++) {
      const dx = (x - cx) / BASIN_RX
      const dyTop = (y - BASIN_CY) / BASIN_RY
      const dyLow = (y - BASIN_CY - BASIN_WALL) / BASIN_RY
      const onRim = dx * dx + dyTop * dyTop <= 1
      const onWall = dx * dx + dyLow * dyLow <= 1
      if (!onRim && !onWall) continue
      if (onRim) px(s, x, y, tone(STONE, 4.2 + (-dx * 0.5 - dyTop * 0.86) * 1.7))
      else {
        const t = (y - BASIN_CY - BASIN_RY) / BASIN_WALL
        px(s, x, y, tone(STONE, 3.4 - t * 1.7 - Math.max(0, dx) * 0.9))
      }
    }
  // radial cobble joints around the rim
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 13)
    for (let k = 0.87; k <= 1.02; k += 0.07)
      px(s, Math.round(cx + Math.cos(a) * BASIN_RX * k), Math.round(BASIN_CY + Math.sin(a) * BASIN_RY * k), 'stone3')
  // pool
  orb(s, cx, BASIN_CY + 2, BASIN_RX - 8, BASIN_RY - 4, WATER, 3.4, 1.5)
}

function fountainColumn(s: Raster, ox: number): void {
  const cx = ox + 48
  // tapered shaft
  for (let y = 34; y <= 68; y++) {
    const hw = 6 + Math.round((y - 34) / 9)
    for (let x = cx - hw; x <= cx + hw; x++) px(s, x, y, tone(STONE, 4.2 + ((cx - x) / hw) * 1.6))
    if ((y - 34) % 8 === 0) for (let x = cx - hw; x <= cx + hw; x++) px(s, x, y, tone(STONE, 2.6))
  }
  // upper bowl + its water
  orb(s, cx, 31, 17, 6, STONE, 4.4, 1.4)
  box(s, cx - 17, 31, 35, 2, tone(STONE, 2.6))
  orb(s, cx, 30, 12, 3, WATER, 3.4, 1.2)
  px(s, cx - 6, 29, 'water7')
}

const JET_TOP = [16, 10, 13]

function fountainWater(s: Raster, ox: number, f: number): void {
  const cx = ox + 48
  // vertical jet
  const top = JET_TOP[f]
  for (let y = top; y <= 29; y++) {
    const hw = y > 25 ? 3 : y > 20 ? 2 : 1
    for (let x = cx - hw; x <= cx + hw; x++)
      px(s, x, y, noise(x, y, f + 1) > 0.72 ? 'water7' : x < cx ? 'water6' : 'water5')
  }
  for (const [dx, dy] of [
    [-3, 0],
    [3, 0],
    [-5, 2],
    [5, 2],
    [0, -2],
  ])
    px(s, cx + dx, top + dy, 'water7')
  // falling arcs from the bowl lip into the pool
  for (const side of [-1, 1])
    for (let t = 0; t <= 1.001; t += 0.02) {
      const x = Math.round(cx + side * (15 + t * 17))
      const y = Math.round(33 + t * 6 + t * t * 24)
      const drop = (Math.round(t * 60) + f * 5) % 5 === 0
      px(s, x, y, drop ? 'water7' : 'water5')
      px(s, x + side, y, 'water4')
    }
  // splash where the arcs land + surface ripples
  for (const side of [-1, 1]) {
    const bx = cx + side * 32
    for (let i = 0; i < 4; i++) px(s, bx + side * (i - 1), 62 + ((i + f) % 2), i % 2 ? 'water7' : 'water6')
  }
  for (let i = 0; i < 5; i++) {
    const rx = cx - 26 + ((i * 13 + f * 5) % 52)
    const ry = 62 + ((i * 3 + f) % 7)
    box(s, rx, ry, 4, 1, 'water6')
    px(s, rx + 5, ry, 'water7')
  }
  px(s, cx - 20, 60, 'water7')
  px(s, cx + 18, 70, 'water7')
}

function paintFountain(r: Raster): void {
  withOutline(r, (s) => {
    for (let f = 0; f < 3; f++) {
      const ox = f * FOUNT_W
      fountainBasin(s, ox)
      fountainColumn(s, ox)
      fountainWater(s, ox, f)
    }
  })
}

/* ------------------------------------------------------------------ *
 * windmill body — 96×160 (blade hub sits at 48,40)
 * ------------------------------------------------------------------ */

function paintWindmill(r: Raster): void {
  withOutline(r, (s) => {
    const cx = 48
    /** Half-width of the tapered tower at row `y`. */
    const hwAt = (y: number): number => Math.round(22 + ((y - 34) / 110) * 10)

    // ---- stone footing ----
    for (let y = 142; y <= 158; y++) {
      const hw = 36 + Math.round((y - 142) / 8)
      for (let x = cx - hw; x <= cx + hw; x++) {
        const n = (cx - x) / hw
        px(s, x, y, tone(STONE, 3.9 + n * 1.2 - (y > 156 ? 1.6 : 0)))
      }
    }
    // staggered courses read as masonry, not as a grid
    for (const y of [147, 152, 157]) box(s, cx - 37, y, 75, 1, 'stone3')
    for (let k = 0; k < 3; k++)
      for (let x = cx - 34 + (k % 2 ? 5 : 0); x <= cx + 34; x += 10) box(s, x, 143 + k * 5, 1, 4, 'stone3')
    box(s, cx - 37, 142, 75, 1, 'stone6')

    // ---- plaster tower ----
    for (let y = 34; y <= 143; y++) {
      const hw = hwAt(y)
      for (let x = cx - hw; x <= cx + hw; x++) px(s, x, y, toneDither(PLASTER, 4.1 + ((cx - x) / hw) * 1.15, x, y))
      box(s, cx + hw - 1, y, 2, 1, tone(PLASTER, 2.6))
      px(s, cx - hw, y, tone(PLASTER, 5))
      // faint render courses instead of speckle
      if (y % 12 === 0) for (let x = cx - hw + 1; x < cx + hw; x++) px(s, x, y, tone(PLASTER, 3.5 + ((cx - x) / hw) * 1.15))
    }
    // timber band course
    {
      const hw = hwAt(72) + 2
      slab(s, cx - hw, 72, hw * 2 + 1, 4, WOOD, 3)
    }

    // ---- cap: a shingled ogee dome, not a plain cone ----
    for (let y = 6; y <= 33; y++) {
      const half = Math.max(1, Math.round(31 * Math.pow((y - 5) / 29, 0.6)))
      for (let x = cx - half; x <= cx + half; x++) {
        const n = (cx - x) / half
        const course = (y - 6) % 5 === 0
        px(s, x, y, tone(WOOD, (course ? 1.8 : 3.4) + n * 1.4))
      }
    }
    slab(s, cx - 33, 32, 67, 4, WOOD, 3)
    box(s, cx - 33, 32, 67, 1, tone(WOOD, 6))
    // finial + weathervane
    box(s, cx - 1, 0, 2, 8, tone(METAL, 3))
    px(s, cx - 1, 0, tone(METAL, 5))
    box(s, cx + 1, 1, 5, 3, 'red4')
    box(s, cx + 1, 1, 5, 1, 'red5')
    box(s, cx - 6, 2, 4, 2, 'red3')

    // ---- windshaft housing + blade hub (hub centre = 48,40) ----
    slab(s, cx - 11, 32, 22, 17, WOOD, 3.4)
    seams(s, cx - 11, 32, 22, 17, WOOD, 3.4, 5)
    orb(s, cx, 40, 8, 8, WOOD, 4.2, 1.5)
    orb(s, cx, 40, 6, 6, METAL, 2.8, 1.8)
    for (const [bx, by] of [
      [-3, -3],
      [3, -3],
      [-3, 3],
      [3, 3],
    ])
      px(s, cx + bx, 40 + by, tone(METAL, 5))
    orb(s, cx, 40, 2, 2, BRASS, 3.6, 1.4)

    // ---- gallery: the miller's working balcony ----
    const gw = hwAt(106) + 8
    for (let x = cx - gw; x <= cx + gw; x += 6) box(s, x, 98, 2, 8, tone(WOOD, 4))
    slab(s, cx - gw, 96, gw * 2 + 1, 3, WOOD, 4)
    slab(s, cx - gw - 1, 105, gw * 2 + 3, 5, WOOD, 4)
    box(s, cx - gw - 1, 105, gw * 2 + 3, 1, tone(WOOD, 6))
    box(s, cx - gw + 2, 110, gw * 2 - 3, 2, tone(WOOD, 1))

    // ---- windows ----
    for (const [wx, wy, ww, wh] of [
      [cx - 6, 52, 12, 12],
      [cx - 23, 80, 11, 13],
      [cx + 13, 80, 11, 13],
    ]) {
      slab(s, wx - 2, wy - 2, ww + 4, wh + 4, WOOD, 3)
      box(s, wx, wy, ww, wh, 'glass5')
      box(s, wx, wy, ww, 1, 'glass6')
      box(s, wx, wy, 1, wh, 'glass6')
      box(s, wx + Math.floor(ww / 2), wy, 1, wh, tone(WOOD, 2))
      box(s, wx, wy + Math.floor(wh / 2), ww, 1, tone(WOOD, 2))
      box(s, wx + ww - 3, wy + wh - 4, 3, 4, 'glass3')
    }

    // ---- door ----
    for (let y = 116; y <= 143; y++) {
      const t = Math.max(0, (122 - y) / 6)
      const hw = Math.round(11 * Math.sqrt(Math.max(0, 1 - t * t)))
      if (hw < 1) continue
      box(s, cx - hw - 2, y, hw * 2 + 5, 1, tone(WOOD, 2))
      box(s, cx - hw, y, hw * 2 + 1, 1, tone(WOOD, 4))
      px(s, cx - hw, y, tone(WOOD, 6))
    }
    for (const dx of [-6, 0, 6]) box(s, cx + dx, 118, 1, 26, tone(WOOD, 2))
    box(s, cx + 6, 132, 3, 3, tone(METAL, 4))
    box(s, cx - 12, 124, 24, 2, tone(WOOD, 5))
  })
}

/* ------------------------------------------------------------------ *
 * windmill blades — 96×96 × 4 frames, procedural
 * ------------------------------------------------------------------ */

function paintWindmillBlades(r: Raster): void {
  const frames = 4
  const fw = r.w / frames
  withOutline(r, (s) => {
    for (let f = 0; f < frames; f++) {
      const cx = f * fw + fw / 2 - 0.5
      const cy0 = r.h / 2 - 0.5
      const base = (f * 22.5 * Math.PI) / 180
      for (let k = 0; k < 4; k++) {
        const ang = base + (k * Math.PI) / 2
        const dx = Math.cos(ang)
        const dy = Math.sin(ang)
        const nx = -dy
        const ny = dx
        const lit = nx * -0.5 + ny * -0.86
        // sail cloth on one side of the spar, with lattice bars
        for (let t = 14; t <= 41; t += 0.35)
          for (let o = 2; o <= 11; o += 0.35) {
            const x = Math.round(cx + dx * t + nx * o)
            const y = Math.round(cy0 + dy * t + ny * o)
            const latt = Math.round(t) % 7 === 0 || o >= 10
            px(s, x, y, latt ? tone(CLOTH, 2.6) : tone(CLOTH, 4.4 + lit * 1.1))
          }
        // spar
        bar(s, cx, cy0, cx + dx * 43, cy0 + dy * 43, 2, WOOD, 3.4, 2)
      }
      orb(s, cx, cy0, 8, 8, WOOD, 3.2, 1.6)
      orb(s, cx, cy0, 4, 4, METAL, 2.8, 1.8)
      px(s, Math.round(cx) - 2, Math.round(cy0) - 2, tone(METAL, 5))
    }
  })
}

/* ------------------------------------------------------------------ *
 * boat — 112×64, seen from above
 * ------------------------------------------------------------------ */

function paintBoat(r: Raster): void {
  withOutline(r, (s) => {
    const cx = 56
    const cyy = 31
    const halfAt = (x: number): number => {
      const t = (x - cx) / 54
      const v = 1 - t * t
      return v <= 0 ? -1 : 19 * Math.pow(v, 0.6)
    }
    for (let x = 2; x < 110; x++) {
      const h = halfAt(x)
      if (h < 1.2) continue
      const y0 = Math.round(cyy - h)
      const y1 = Math.round(cyy + h)
      for (let y = y0; y <= y1; y++) {
        const up = y - y0
        const down = y1 - y
        const edge = Math.min(up, down)
        if (edge === 0) px(s, x, y, up === 0 ? tone(WOOD, 6) : tone(WOOD, 1))
        else if (edge <= 2) px(s, x, y, up <= 2 ? tone(WOOD, 5) : tone(WOOD, 2))
        else if (down <= 5) px(s, x, y, down === 5 ? 'roofBlue5' : down === 3 ? 'roofBlue3' : 'roofBlue4')
        else {
          // deck planking runs fore-and-aft
          const plank = y % 4 === 0
          px(s, x, y, tone(WOOD, plank ? 2.4 : 3.6 + (up < 8 ? 0.6 : 0)))
        }
      }
    }
    // thwart bench amidships
    slab(s, 50, Math.round(cyy - halfAt(53)) + 3, 10, Math.round(halfAt(53) * 2) - 6, WOOD, 4)
    // rolled net astern — tan rope, coarse single-lay mesh
    for (let x = 74; x <= 101; x++) {
      const h = halfAt(x) - 6
      if (h < 2) continue
      for (let y = Math.round(cyy - h); y <= Math.round(cyy + h); y++) {
        const mesh = (x + y) % 4 === 0 || (x - y) % 4 === 0
        px(s, x, y, mesh ? tone(CLOTH, 3.4) : tone(CLOTH, 1.7))
      }
    }
    // coiled rope between the bench and the net
    for (let a = 0; a < Math.PI * 2; a += 0.1)
      for (const rr of [3, 5.5])
        px(s, Math.round(67 + Math.cos(a) * rr), Math.round(cyy + Math.sin(a) * rr * 0.85), tone(CLOTH, rr > 4 ? 2.6 : 4))
    // fore-deck kit: two stowed oars (pale ash, so they read over the deck)
    for (const oy of [24, 38]) {
      orb(s, 18, oy + 1, 6, 4, CLOTH, 4, 1.4)
      box(s, 22, oy, 24, 2, tone(CLOTH, 3.4))
      box(s, 22, oy, 24, 1, tone(CLOTH, 4.6))
      box(s, 20, oy + 3, 26, 1, tone(WOOD, 1))
    }
    orb(s, 30, 31, 6, 6, METAL, 3, 1.6)
    orb(s, 30, 31, 4, 4, BRASS, 4.6, 1.4)
    px(s, 28, 29, 'cream6')
    // painted trim along the gunwale
    for (let x = 10; x < 104; x += 8) px(s, x, Math.round(cyy - halfAt(x)) + 1, tone(CLOTH, 5))
  })
}

/* ------------------------------------------------------------------ *
 * well — 56×64
 * ------------------------------------------------------------------ */

function paintWell(r: Raster): void {
  withOutline(r, (s) => {
    const cx = 28
    // ---- stone drum: a rim ellipse extruded into a cylinder ----
    const rimY = 41
    const rx = 22
    const ry = 7
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx
      const k = Math.sqrt(Math.max(0, 1 - dx * dx))
      const yTop = Math.round(rimY - ry * k)
      const yBot = Math.round(rimY + ry * k)
      const base = Math.round(55 + 5 * k)
      for (let y = yTop; y <= yBot; y++) px(s, x, y, tone(STONE, 4.6 + (-dx * 0.5 - ((y - rimY) / ry) * 0.86) * 1.5))
      for (let y = yBot + 1; y <= base; y++)
        px(s, x, y, tone(STONE, 3.9 - Math.max(0, dx) * 1.5 + Math.max(0, -dx) * 0.5 - (y > base - 3 ? 1.4 : 0)))
    }
    // masonry joints, staggered course to course
    for (const y of [50, 55]) box(s, cx - 20, y, 41, 1, 'stone2')
    for (let k = 0; k < 2; k++)
      for (let x = cx - 18 + (k % 2 ? 5 : 0); x <= cx + 18; x += 10) box(s, x, 50 + k * 5, 1, 5, 'stone2')
    // dark water down the shaft
    orb(s, cx, rimY, rx - 6, ry - 3, WATER, 1.2, 1)
    px(s, cx - 7, rimY - 2, 'water4')
    px(s, cx + 4, rimY + 1, 'water3')

    // ---- posts + roof ----
    for (const x of [5, 45]) {
      slab(s, x, 14, 6, 30, WOOD, 4)
      box(s, x, 42, 6, 2, tone(WOOD, 2))
    }
    shingles(s, cx, 1, 15, (y) => 3 + (y - 1) * 1.75, WOOD, 3.8, 4)
    slab(s, 1, 14, 54, 4, WOOD, 3)
    box(s, 1, 14, 54, 1, tone(WOOD, 6))

    // ---- winch roller, crank and bucket ----
    bar(s, 8, 23, 48, 23, 3, WOOD, 4.2, 2)
    box(s, 47, 20, 3, 7, tone(METAL, 4))
    box(s, 47, 26, 7, 2, tone(METAL, 3))
    box(s, cx - 1, 25, 2, 4, tone(CLOTH, 3))
    slab(s, cx - 7, 28, 15, 11, WOOD, 4)
    box(s, cx - 7, 30, 15, 1, tone(METAL, 4))
    box(s, cx - 7, 36, 15, 1, tone(METAL, 4))
    box(s, cx - 8, 27, 17, 1, tone(WOOD, 6))
  })
}

/* ------------------------------------------------------------------ *
 * market stall — 112×88
 * ------------------------------------------------------------------ */

function paintStall(r: Raster): void {
  withOutline(r, (s) => {
    // ---- posts ----
    for (const x of [4, 100]) {
      slab(s, x, 26, 8, 58, WOOD, 4)
      seams(s, x, 26, 8, 58, WOOD, 4, 4)
      box(s, x, 82, 8, 2, tone(WOOD, 1))
    }

    // ---- striped awning with a scalloped valance ----
    for (let x = 2; x <= 109; x++) {
      const band = Math.floor((x - 2) / 9) % 2 === 0
      const ramp = band ? CANVAS : CLOTH
      const scallop = 24 + Math.round(4 * Math.sin((Math.PI * ((x - 2) % 9)) / 8))
      for (let y = 3; y <= scallop; y++) {
        const fold = (x - 2) % 9 === 0 ? -1.4 : 0
        const droop = y > 18 ? -0.9 : 0
        px(s, x, y, tone(ramp, 3.8 + fold + droop - (y - 3) * 0.04))
      }
      px(s, x, 3, tone(ramp, 5))
    }
    slab(s, 1, 0, 110, 4, WOOD, 3)

    // ---- counter ----
    slab(s, 2, 58, 108, 6, WOOD, 5)
    box(s, 2, 58, 108, 1, tone(WOOD, 6))
    slab(s, 5, 63, 102, 19, WOOD, 3)
    seams(s, 5, 63, 102, 19, WOOD, 3, 10)
    box(s, 5, 80, 102, 2, tone(WOOD, 1))

    // ---- goods on the counter ----
    // bread basket
    slab(s, 12, 46, 26, 12, CORK, 3)
    for (let i = 0; i < 3; i++) orb(s, 18 + i * 8, 46, 5, 4, ['sand2', 'sand3', 'sand4', 'sand5', 'sand6', 'sand7'], 3.6, 1.5)
    // crate of apples
    slab(s, 44, 44, 24, 14, WOOD, 4)
    seams(s, 44, 44, 24, 14, WOOD, 4, 6)
    for (const [ax, ay] of [
      [49, 42],
      [56, 41],
      [63, 42],
      [52, 45],
      [60, 45],
    ])
      orb(s, ax, ay, 4, 3, RED, 3.4, 1.6)
    // pumpkins / citrus pile
    for (const [ox2, oy, rr] of [
      [80, 50, 7],
      [92, 48, 6],
      [86, 42, 5],
    ])
      orb(s, ox2, oy, rr, rr - 1, ['orange1', 'orange2', 'orange3', 'orange4', 'orange5', 'orange6'], 3.4, 1.6)
    box(s, 86, 36, 1, 3, tone(WOOD, 2))
    // price sign hung on the counter
    slab(s, 20, 66, 16, 11, CLOTH, 4)
    for (let i = 0; i < 3; i++) box(s, 23, 69 + i * 3, 10 - i * 2, 1, 'ink5')
  })
}

/* ------------------------------------------------------------------ *
 * telescope — 48×64
 * ------------------------------------------------------------------ */

function paintTelescope(r: Raster): void {
  withOutline(r, (s) => {
    // tripod
    for (const lx of [8, 24, 40]) {
      bar(s, 24, 36, lx, 62, 1.6, WOOD, 3.6, 2)
      box(s, lx - 2, 61, 4, 2, tone(WOOD, 2))
    }
    bar(s, 12, 51, 36, 51, 1, WOOD, 3, 1.5)
    // mount head
    slab(s, 18, 29, 13, 10, METAL, 3)
    px(s, 19, 30, tone(METAL, 5))
    // brass tube
    bar(s, 13, 45, 40, 12, 4, BRASS, 3.6, 2.4)
    // tube bands
    bar(s, 20, 36, 23, 32, 4.5, METAL, 3, 1.6)
    bar(s, 31, 22, 34, 18, 4.5, METAL, 3, 1.6)
    // objective lens (up-right) and eyepiece (down-left)
    orb(s, 41, 11, 5, 5, METAL, 3.2, 1.6)
    orb(s, 41, 11, 3, 3, ['glass1', 'glass2', 'glass3', 'glass4', 'glass5', 'glass6'], 4.2, 1.6)
    bar(s, 11, 48, 15, 43, 2.4, METAL, 2.6, 2)
    px(s, 12, 46, tone(METAL, 5))
  })
}

/* ------------------------------------------------------------------ *
 * crate — 32×32 (drawn 20px tall: hoppable)
 * ------------------------------------------------------------------ */

function paintCrate(r: Raster): void {
  withOutline(r, (s) => {
    // lid plane
    slab(s, 2, 11, 28, 4, WOOD, 5)
    box(s, 2, 14, 28, 1, tone(WOOD, 2))
    // front face
    slab(s, 2, 15, 28, 15, WOOD, 4)
    seams(s, 2, 15, 28, 15, WOOD, 4, 7)
    // rails + corner posts
    box(s, 3, 16, 26, 2, tone(WOOD, 5))
    box(s, 3, 16, 26, 1, tone(WOOD, 6))
    box(s, 3, 26, 26, 2, tone(WOOD, 5))
    box(s, 3, 26, 26, 1, tone(WOOD, 6))
    box(s, 2, 15, 3, 15, tone(WOOD, 5))
    box(s, 2, 15, 1, 15, tone(WOOD, 6))
    box(s, 27, 15, 3, 15, tone(WOOD, 3))
    box(s, 29, 15, 1, 15, tone(WOOD, 2))
    // iron corner brackets
    for (const [bx, by] of [
      [2, 15],
      [26, 15],
      [2, 26],
      [26, 26],
    ]) {
      box(s, bx, by, 4, 1, tone(METAL, 3))
      box(s, bx === 2 ? 2 : 29, by, 1, 4, tone(METAL, 3))
    }
    // contact shade
    box(s, 2, 29, 28, 1, tone(WOOD, 1))
    box(s, 4, 30, 24, 1, tone(WOOD, 1))
  })
}

/* ------------------------------------------------------------------ *
 * barrel — 32×40
 * ------------------------------------------------------------------ */

function paintBarrel(r: Raster): void {
  withOutline(r, (s) => {
    const cx = 16
    const top = 12
    const bot = 37
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / (bot - top)
      const hw = Math.round(8 + Math.sin(Math.PI * t) * 3)
      for (let x = cx - hw; x <= cx + hw; x++) {
        const n = (cx - x) / hw
        const stave = (x - cx + 30) % 5 === 0
        px(s, x, y, tone(WOOD, (stave ? 2.4 : 4) + n * 1.6))
      }
      px(s, cx - hw, y, tone(WOOD, 6))
      px(s, cx + hw, y, tone(WOOD, 1))
    }
    // lid
    orb(s, cx, top + 1, 8, 3, WOOD, 5.2, 0.9)
    box(s, cx - 8, top + 3, 17, 1, tone(WOOD, 2))
    box(s, cx - 5, top - 1, 4, 1, tone(WOOD, 6))
    // iron hoops
    for (const [hy, hh] of [
      [17, 3],
      [30, 3],
    ]) {
      const t = (hy - top) / (bot - top)
      const hw = Math.round(8 + Math.sin(Math.PI * t) * 3)
      for (let y = hy; y < hy + hh; y++)
        for (let x = cx - hw; x <= cx + hw; x++) px(s, x, y, tone(METAL, 3 + ((cx - x) / hw) * 1.6))
      box(s, cx - hw, hy, hw * 2 + 1, 1, tone(METAL, 5))
    }
    box(s, cx - 8, bot, 17, 1, tone(WOOD, 1))
  })
}

/* ------------------------------------------------------------------ *
 * mailbox — 24×44
 * ------------------------------------------------------------------ */

function paintMailbox(r: Raster): void {
  withOutline(r, (s) => {
    // post
    slab(s, 9, 21, 6, 22, WOOD, 4)
    box(s, 8, 41, 8, 2, tone(WOOD, 2))
    // arched body
    for (let y = 5; y <= 22; y++) {
      const t = Math.max(0, (11 - y) / 6)
      const hw = Math.round(9 * Math.sqrt(Math.max(0, 1 - t * t)))
      if (hw < 1) continue
      for (let x = 12 - hw; x <= 12 + hw; x++) px(s, x, y, tone(RED, 3.4 + ((12 - x) / hw) * 1.5 - (y > 18 ? 0.7 : 0)))
      px(s, 12 - hw, y, tone(RED, 5))
    }
    // door plate + slot
    slab(s, 6, 12, 12, 8, RED, 2.8)
    box(s, 8, 15, 8, 2, 'ink2')
    box(s, 8, 15, 8, 1, tone(RED, 1))
    px(s, 16, 18, tone(METAL, 5))
    // a letter peeking out
    box(s, 9, 13, 6, 2, 'cream6')
    px(s, 9, 13, 'cream4')
    // flag
    box(s, 19, 3, 2, 12, tone(METAL, 3))
    box(s, 20, 3, 4, 6, 'yellow5')
    box(s, 20, 3, 4, 1, 'yellow6')
    box(s, 20, 8, 4, 1, 'yellow3')
  })
}

/* ------------------------------------------------------------------ *
 * bell — 40×56
 * ------------------------------------------------------------------ */

function paintBell(r: Raster): void {
  withOutline(r, (s) => {
    // frame
    for (const x of [2, 31]) {
      slab(s, x, 11, 7, 44, WOOD, 4)
      box(s, x, 53, 7, 2, tone(WOOD, 1))
    }
    slab(s, 1, 4, 38, 8, WOOD, 4)
    box(s, 1, 4, 38, 1, tone(WOOD, 6))
    box(s, 1, 7, 38, 2, tone(WOOD, 3))
    // knee braces
    bar(s, 9, 16, 15, 12, 1.4, WOOD, 3.4, 1.6)
    bar(s, 31, 16, 25, 12, 1.4, WOOD, 3.4, 1.6)
    // wooden headstock the bell swings from
    slab(s, 14, 10, 12, 6, WOOD, 4)
    box(s, 18, 11, 4, 5, tone(METAL, 3))
    // bell: narrow crown, concave waist, fast flare at the lip
    for (let y = 16; y <= 40; y++) {
      const t = (y - 16) / 24
      const hw = Math.round(4 + 12 * Math.pow(t, 2.2))
      for (let x = 20 - hw; x <= 20 + hw; x++) px(s, x, y, tone(BRASS, 3.4 + ((20 - x) / hw) * 1.9))
      px(s, 20 - hw, y, tone(BRASS, 6))
    }
    // lip band + clapper
    box(s, 4, 40, 33, 3, tone(BRASS, 2.2))
    box(s, 4, 40, 33, 1, tone(BRASS, 5))
    box(s, 19, 43, 3, 4, tone(METAL, 2))
    orb(s, 20, 47, 3, 3, METAL, 3, 1.6)
    // pull rope
    box(s, 33, 20, 2, 30, tone(CLOTH, 3))
    px(s, 33, 20, tone(CLOTH, 5))
    orb(s, 34, 50, 3, 4, CLOTH, 3.4, 1.4)
  })
}

/* ------------------------------------------------------------------ *
 * NEW — finger post, chalkboard, notice board
 * ------------------------------------------------------------------ */

/** One pointed sign board with painted lettering, tip at `dir`. */
function fingerArm(s: Raster, x0: number, y0: number, len: number, h: number, dir: 1 | -1, rise: number): void {
  for (let i = 0; i < len; i++) {
    const x = x0 + dir * i
    const y = y0 + Math.round((i / len) * rise)
    const t = i / len
    const taper = t > 0.72 ? Math.round((t - 0.72) * h * 2.1) : 0
    const top = y + taper
    const hh = h - taper * 2
    if (hh < 1) continue
    box(s, x, top, 1, hh, tone(CLOTH, 4))
    px(s, x, top, tone(CLOTH, 5))
    px(s, x, top + 1, tone(CLOTH, 5))
    px(s, x, top + hh - 1, tone(WOOD, 2))
  }
  // lettering: two dashed lines that stop short of the point
  for (const ly of [3, 6]) {
    for (let i = 2; i < len * 0.72; i++) {
      if (i % 5 === 4) continue
      const x = x0 + dir * i
      const y = y0 + Math.round((i / len) * rise) + ly
      px(s, x, y, 'ink5')
    }
  }
}

function paintSignFinger(r: Raster): void {
  withOutline(r, (s) => {
    // post
    slab(s, 16, 11, 8, 45, WOOD, 4)
    box(s, 19, 12, 1, 43, tone(WOOD, 2))
    box(s, 20, 12, 1, 43, tone(WOOD, 5))
    box(s, 16, 54, 8, 2, tone(WOOD, 1))
    // finial cap
    for (let y = 5; y <= 11; y++) {
      const hw = Math.round((y - 4) * 0.85)
      for (let x = 20 - hw; x <= 20 + hw; x++) px(s, x, y, tone(WOOD, 4.2 + ((20 - x) / Math.max(1, hw)) * 1.5))
    }
    box(s, 14, 11, 12, 2, tone(WOOD, 5))
    box(s, 14, 11, 12, 1, tone(WOOD, 6))
    // three arms, each tilted a little for charm
    fingerArm(s, 23, 15, 16, 10, 1, -2)
    fingerArm(s, 17, 28, 16, 10, -1, 2)
    fingerArm(s, 23, 40, 15, 10, 1, 1)
  })
}

function paintChalkboard(r: Raster): void {
  withOutline(r, (s) => {
    // legs (A-frame) drawn first so the board sits over them
    bar(s, 12, 28, 5, 39, 1.6, WOOD, 3.4, 2)
    bar(s, 44, 28, 51, 39, 1.6, WOOD, 3.4, 2)
    bar(s, 8, 35, 48, 35, 1.2, WOOD, 3, 1.5)
    // frame + slate face
    slab(s, 1, 1, 54, 30, WOOD, 4)
    box(s, 4, 4, 48, 22, tone(SLATE, 1))
    box(s, 4, 4, 48, 1, tone(SLATE, 2.4))
    box(s, 4, 4, 1, 22, tone(SLATE, 2))
    box(s, 51, 4, 1, 22, tone(SLATE, 0))
    box(s, 4, 25, 48, 1, tone(SLATE, 0))
    // faint chalk scribbles — low contrast, never louder than the silhouette
    for (const [ly, lx, lw] of [
      [8, 8, 26],
      [12, 8, 34],
      [16, 8, 20],
      [20, 8, 30],
    ])
      for (let i = 0; i < lw; i++) if (noise(lx + i, ly, 7) > 0.35) px(s, lx + i, ly, 'cream3')
    // a chalk diagram in the corner
    for (let i = 0; i < 9; i++) px(s, 36 + i, 20 - Math.round(Math.sin(i * 0.7) * 3), 'cream4')
    // chalk tray with a stick and a duster
    slab(s, 3, 27, 50, 4, WOOD, 5)
    box(s, 8, 28, 7, 2, 'cream6')
    slab(s, 38, 28, 9, 3, CLOTH, 3)
  })
}

function paintNoticeboard(r: Raster): void {
  withOutline(r, (s) => {
    // legs
    slab(s, 8, 26, 5, 13, WOOD, 3.4)
    slab(s, 35, 26, 5, 13, WOOD, 3.4)
    box(s, 8, 37, 5, 2, tone(WOOD, 1))
    box(s, 35, 37, 5, 2, tone(WOOD, 1))
    // frame
    slab(s, 1, 1, 46, 28, WOOD, 4)
    // cork face
    for (let y = 4; y <= 25; y++)
      for (let x = 4; x <= 43; x++) {
        const n = noise(x, y, 11)
        px(s, x, y, tone(CORK, 3.2 + (n > 0.86 ? 1.1 : n < 0.14 ? -1.1 : 0)))
      }
    box(s, 4, 4, 40, 1, tone(CORK, 4.4))
    box(s, 4, 4, 1, 22, tone(CORK, 4.2))
    box(s, 43, 4, 1, 22, tone(CORK, 2))
    box(s, 4, 25, 40, 1, tone(CORK, 2))
    // pinned papers, each with a 1px cast shade and a coloured pin
    for (const [pxx, pyy, pw, ph, pin] of [
      [7, 7, 14, 11, 'red4'],
      [24, 6, 15, 9, 'teal4'],
      [9, 20, 12, 4, 'blue5'],
      [26, 17, 14, 8, 'yellow5'],
    ] as [number, number, number, number, PalKey][]) {
      box(s, pxx + 1, pyy + 1, pw, ph, tone(CORK, 1.4))
      box(s, pxx, pyy, pw, ph, 'cream6')
      box(s, pxx, pyy, pw, 1, 'cream5')
      for (let i = 2; i < ph - 1; i += 2) box(s, pxx + 2, pyy + i, pw - 4 - (i % 4), 1, 'ink5')
      px(s, pxx + Math.floor(pw / 2), pyy, pin)
      px(s, pxx + Math.floor(pw / 2) + 1, pyy, pin)
    }
    // a little roof lip
    box(s, 0, 0, 48, 2, tone(WOOD, 5))
    box(s, 1, 0, 46, 1, tone(WOOD, 6))
  })
}

/* ------------------------------------------------------------------ *
 * items — small hand-drawn icons, anchored at their centre
 * ------------------------------------------------------------------ */

const GEAR_ROWS = [
  '.........LMMMmm.........',
  '.........LMMMmm.........',
  '.........LMMMmm.........',
  '.........LMMMmm.........',
  '.....LLLLLMMMmmmnnn.....',
  '....LLMMMMMMMMmmmmnn....',
  '...LMMMMMMMMMMmmmmmnn...',
  '..LMMMMMMMMMMMMmmmmmnn..',
  'LLMMMMMMaaaaaaaammmmmmnn',
  'LMMMMMMMaa....aammmmmmnn',
  'LMMMMMMMa......ammmmmmnn',
  'LMMMMMMMa......ammmmmmnn',
  'LMMMMMMMa......ammmmmmnn',
  'LMMMMMMMa......ammmmmmnn',
  'LMMMMMMMaa....aammmmmmnn',
  'LLMMMMMMaaaaaaaammmmmmnn',
  '..LMMMMMMMMMMMMmmmmmnn..',
  '...LMMMMMMMMMMmmmmmnn...',
  '....LLMMMMMMMMmmmmnn....',
  '.....LLLLLMMMmmmnnn.....',
  '.........LMMMmm.........',
  '.........LMMMmm.........',
  '.........LMMMmm.........',
  '.........LMMmmm.........',
]

const FISH_ROWS = [
  '............................',
  '........ooo...............o.',
  '.......ooooo............ooo.',
  '.....BBBBBBBBBBBBBb....oooo.',
  '...Bbbbbbbbbbbbbbbbb..ooooo.',
  '..Bbbbbbbbbbbbbbbbbbboooooo.',
  '.BbWkbbbbbbbbbbbbbbbboooooo.',
  '.BbWkbbbbbbbbbbbbbbbboOoooo.',
  '.bbbbbbbbbbbbbbbbbbbbOOOOOO.',
  '..nhhhhhhhhhhhhhhhhhnOOOOOO.',
  '...nhhhhhhhhhhhhhhhn..OOOOO.',
  '.....nnnnnnnnnnnnnn....OOOO.',
  '........OOOOO...........OOO.',
  '.........OOO..............O.',
  '............................',
  '............................',
]

const SHELL_ROWS = [
  '....................',
  '....................',
  '....PP.PP.PP.PP.....',
  '..cPPcPPcPPcPPcPPp..',
  '..cPPcPPcPPcPPcPPp..',
  '..cPPcPPcPPcPPcPPp..',
  '...cPPcPPcPPcPPPp...',
  '...cPPcPPcPPcPPPp...',
  '....cPPcPPcPPcPp....',
  '....cPPcPPcPPcPp....',
  '.....cPPcPPcPPp.....',
  '.....cPPcPPcPPp.....',
  '......cPPcPPcp......',
  '.......cPPcPp.......',
  '........cPPp........',
  '.........pp.........',
  '.........pp.........',
  '....................',
  '....................',
  '....................',
]

const BOBBER_ROWS = [
  '....aa......',
  '....ab......',
  '...RRRRRR...',
  '..RRRRRRRR..',
  '.RRRRRRRRRR.',
  '.RRrrrrrrrr.',
  'RRRrrrrrrrrr',
  'RRrrrrrrrrrr',
  'WWWWWWWWWWWW',
  'WWWwwwwwwwww',
  '.WWwwwwwwww.',
  '.WWwwwwwwww.',
  '..Wwwwwwww..',
  '...wwwwww...',
  '....wwww....',
  '............',
]

const ROD_TIP_ROWS = ['......53', '.....553', '....553.', '...553..', '..553...', '.553....', '553.....', '53......']

/* ------------------------------------------------------------------ *
 * speech bubbles — procedural shell, hand-placed glyphs
 * ------------------------------------------------------------------ */

/** Rounded white bubble with a tail at the lower-left; `glyph` paints inside it. */
const bubble =
  (w: number, h: number, glyph: (s: Raster) => void) =>
  (r: Raster): void =>
    withOutline(r, (s) => {
      const bh = h - 9
      const cut = (y: number): number => (y === 0 || y === bh - 1 ? 4 : y === 1 || y === bh - 2 ? 2 : y < 3 || y > bh - 4 ? 1 : 0)
      for (let y = 0; y < bh; y++) {
        const c = cut(y)
        box(s, c, y, w - c * 2, 1, 'cream6')
      }
      // volume: ONE soft step hugging the bottom-right inside edge
      for (let y = 1; y < bh; y++) {
        const c = cut(y)
        if (y >= bh - 2) box(s, c + 1, y, w - c * 2 - 1, 1, 'cream5')
        else px(s, w - c - 2, y, 'cream5')
      }
      // tail
      for (let i = 0; i < 6; i++) box(s, 7 + Math.floor(i / 2), bh - 1 + i, Math.max(1, 5 - i), 1, 'cream6')
      glyph(s)
    })

const PINK: Ramp = ['pink1', 'pink2', 'pink3', 'pink4', 'pink5', 'pink6']

const EXCL_GLYPH = (s: Raster): void => {
  box(s, 10, 4, 4, 9, 'yellow5')
  box(s, 10, 4, 2, 9, 'yellow6')
  box(s, 10, 11, 4, 2, 'yellow3')
  box(s, 10, 14, 4, 3, 'yellow5')
  box(s, 10, 14, 2, 2, 'yellow6')
}

const QUEST_GLYPH = (s: Raster): void => {
  for (const [gx, gy, gw, gh] of [
    [8, 3, 9, 3],
    [14, 4, 3, 5],
    [11, 8, 4, 4],
    [10, 11, 4, 3],
    [6, 5, 3, 3],
  ])
    box(s, gx, gy, gw, gh, 'teal4')
  box(s, 8, 3, 9, 1, 'teal6')
  box(s, 10, 15, 4, 3, 'teal4')
  box(s, 10, 15, 2, 1, 'teal6')
}

const DOTS_GLYPH = (s: Raster): void => {
  for (const gx of [5, 12, 19] as const) {
    box(s, gx, 5, 5, 5, 'ink5')
    box(s, gx, 5, 3, 2, 'ink6')
  }
}

const HEART_GLYPH = (s: Raster): void => {
  orb(s, 8, 6, 5, 4, PINK, 4.2, 1.4)
  orb(s, 16, 6, 5, 4, PINK, 3.6, 1.4)
  for (let y = 6; y <= 13; y++) {
    const hw = Math.max(1, Math.round(9 - (y - 6) * 1.15))
    for (let x = 12 - hw; x <= 12 + hw; x++) px(s, x, y, tone(PINK, 4.2 + ((12 - x) / hw) * 1.1 - (y - 6) * 0.12))
  }
  box(s, 6, 4, 3, 2, 'cream6')
}

const ZZZ_GLYPH = (s: Raster): void => {
  const zed = (x: number, y: number, w: number, h: number, k: PalKey): void => {
    box(s, x, y, w, 2, k)
    box(s, x, y + h - 2, w, 2, k)
    for (let i = 0; i < h - 3; i++) box(s, x + w - 2 - Math.round((i * (w - 2)) / (h - 4)), y + 1 + i, 2, 1, k)
  }
  zed(4, 6, 8, 8, 'blue5')
  zed(14, 3, 6, 5, 'blue6')
  box(s, 4, 6, 8, 1, 'blue6')
}

/* ------------------------------------------------------------------ *
 * the pack
 * ------------------------------------------------------------------ */

export const PROP_DEFS: SpriteDef[] = [
  { name: 'fountain', w: 288, h: 96, frames: 3, legend: {}, paint: paintFountain, anchor: [48, 88] },
  { name: 'windmill', w: 96, h: 160, legend: {}, paint: paintWindmill, anchor: [48, 158] },
  { name: 'windmill_blades', w: 384, h: 96, frames: 4, legend: {}, paint: paintWindmillBlades, anchor: [48, 48] },
  { name: 'boat', w: 112, h: 64, legend: {}, paint: paintBoat, anchor: [56, 52] },
  { name: 'well', w: 56, h: 64, legend: {}, paint: paintWell, anchor: [28, 60] },
  { name: 'stall', w: 112, h: 88, legend: {}, paint: paintStall, anchor: [56, 84] },
  { name: 'crate', w: 32, h: 32, legend: {}, paint: paintCrate, anchor: [16, 31] },
  { name: 'barrel', w: 32, h: 40, legend: {}, paint: paintBarrel, anchor: [16, 39] },
  { name: 'telescope', w: 48, h: 64, legend: {}, paint: paintTelescope, anchor: [24, 62] },
  { name: 'mailbox', w: 24, h: 44, legend: {}, paint: paintMailbox, anchor: [12, 43] },
  { name: 'bell', w: 40, h: 56, legend: {}, paint: paintBell, anchor: [20, 55] },
  { name: 'sign_finger', w: 40, h: 56, legend: {}, paint: paintSignFinger, anchor: [20, 56] },
  { name: 'prop_chalkboard', w: 56, h: 40, legend: {}, paint: paintChalkboard, anchor: [28, 40] },
  { name: 'prop_noticeboard', w: 48, h: 40, legend: {}, paint: paintNoticeboard, anchor: [24, 40] },
  ascii(
    'item_gear',
    GEAR_ROWS,
    { L: 'metal6', M: 'metal5', m: 'metal4', n: 'metal3', a: 'metal2' },
    { anchor: [12, 12] },
  ),
  ascii(
    'item_fish',
    FISH_ROWS,
    { B: 'blue6', b: 'blue5', n: 'blue3', h: 'water6', o: 'orange4', O: 'orange3', W: 'cream6', k: 'ink2' },
    { anchor: [14, 8] },
  ),
  ascii('item_shell', SHELL_ROWS, { p: 'pink4', P: 'pink5', c: 'cream5' }, { anchor: [10, 10] }),
  ascii(
    'bobber',
    BOBBER_ROWS,
    { a: 'metal4', b: 'metal2', R: 'red4', r: 'red3', W: 'cream6', w: 'cream4' },
    { anchor: [6, 8] },
  ),
  ascii('rod_tip', ROD_TIP_ROWS, { '5': 'wood5', '3': 'wood3' }, { outline: undefined, anchor: [4, 4] }),
  { name: 'bubble_excl', w: 24, h: 28, legend: {}, paint: bubble(24, 28, EXCL_GLYPH) },
  { name: 'bubble_quest', w: 24, h: 28, legend: {}, paint: bubble(24, 28, QUEST_GLYPH) },
  { name: 'bubble_dots', w: 28, h: 24, legend: {}, paint: bubble(28, 24, DOTS_GLYPH) },
  { name: 'bubble_heart', w: 24, h: 24, legend: {}, paint: bubble(24, 24, HEART_GLYPH) },
  { name: 'bubble_zzz', w: 24, h: 24, legend: {}, paint: bubble(24, 24, ZZZ_GLYPH) },
  {
    name: 'firework',
    w: 12,
    h: 12,
    legend: {},
    paint: (r) => {
      const cx = (r.w - 1) / 2
      const cyy = (r.h - 1) / 2
      for (let y = 0; y < r.h; y++)
        for (let x = 0; x < r.w; x++) {
          const d = Math.hypot(x - cx, y - cyy) / (r.w / 2)
          if (d <= 1) setPx(r, x, y, d < 0.45 ? [255, 250, 224, 255] : [255, 236, 160, d > 0.85 ? 130 : 255])
        }
    },
    anchor: [6, 6],
  },
]
