// The fair pack: the gate, the midway booths and kiosks, the food and balloon
// carts, the arcade marquee, the Hook-a-Duck bobbers and the string lights.
//
// House rules (`.superpowers/sdd/2026-09-01-naman-world-hd/art-direction.md`):
//  · palette KEYS only — every colour comes out of a ramp below, never a hex;
//  · light from the TOP-LEFT: each mass slides across 2–3 adjacent ramp steps
//    with the brightest step as a 1px rim on its top/left silhouette;
//  · no pillow shading — values slide across a form, they never ring its centre;
//  · a 1px outer outline via `withOutline`, interior detail by value steps;
//  · silhouette first: the awnings, the arch and the balloon bunch carry these
//    sprites at 100% zoom, so the fiddly bits stay subordinate to them.
//
// Why procedural rather than ASCII rows (the buildings pack's idiom): a 256px
// arch is a 256-character line, which stops being legible as art in a source
// file. The vocabulary below (`slab`, `orb`, `bar`, `stripeAwning`, `bulb`,
// `sign`) is what actually keeps one light law and one palette rotation across
// twenty sprites — the fair reads as one family because every booth is built
// from the same six calls. The small hand-drawn motifs (anvil, star, tools)
// stay as ASCII stamps, where every pixel is a decision.
//
// Palette rotation, matching `props.ts`'s `FAIR` (red → teal → gold) so these
// sit beside the existing `stall`, `bld_fair` tent and `bunting`:
//   ticket booth red · forge booth teal · flight booth gold · guestbook teal
//   food carts pink/red · balloon cart teal · arcade marquee ink + gold bulbs.
//
// Night overlays follow the buildings convention: a separate def at the same
// size and anchor carrying glow only — lit bulbs, warm window wash and soft
// haloes — faded in by `DayNight.onWarmth`.
import type { PalKey } from '../palette'
import type { SpriteDef } from '../pixel'
import { K, withOutline } from '../procedural'
import { fillRect, setPx, type Raster } from '../raster'

/* ------------------------------------------------------------------ *
 * ramps — dark → light, index 0 is the deepest step
 * ------------------------------------------------------------------ */

type Ramp = readonly PalKey[]

const INK: Ramp = ['ink1', 'ink2', 'ink3', 'ink4', 'ink5', 'ink6']
const WOOD: Ramp = ['wood1', 'wood2', 'wood3', 'wood4', 'wood5', 'wood6', 'wood7']
const STONE: Ramp = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5', 'stone6', 'stone7']
const BRICK: Ramp = ['brick1', 'brick2', 'brick3', 'brick4', 'brick5', 'brick6', 'brick7']
const METAL: Ramp = ['metal1', 'metal2', 'metal3', 'metal4', 'metal5', 'metal6']
const GLASS: Ramp = ['glass1', 'glass2', 'glass3', 'glass4', 'glass5', 'glass6']
const CREAM: Ramp = ['cream1', 'cream2', 'cream3', 'cream4', 'cream5', 'cream6']
const CANVAS: Ramp = ['roofRed1', 'roofRed2', 'roofRed3', 'roofRed4', 'roofRed5', 'roofRed6']
const SLATE: Ramp = ['roofGreen1', 'roofGreen2', 'roofGreen3', 'roofGreen4', 'roofGreen5', 'roofGreen6']
const RED: Ramp = ['red1', 'red2', 'red3', 'red4', 'red5', 'red6']
const TEAL: Ramp = ['teal1', 'teal2', 'teal3', 'teal4', 'teal5', 'teal6', 'teal7']
const GOLD: Ramp = ['yellow1', 'yellow2', 'yellow3', 'yellow4', 'yellow5', 'yellow6', 'yellow7']
const ORANGE: Ramp = ['orange1', 'orange2', 'orange3', 'orange4', 'orange5', 'orange6']
const PINK: Ramp = ['pink1', 'pink2', 'pink3', 'pink4', 'pink5', 'pink6']
const PURPLE: Ramp = ['purple1', 'purple2', 'purple3', 'purple4', 'purple5', 'purple6']
const BROWN: Ramp = ['hairBrown1', 'hairBrown2', 'hairBrown3', 'hairBrown4', 'hairBrown5', 'hairBrown6']

/** The fairground rotation the props pack already uses for bunting and balloons. */
const FAIRCOL: readonly Ramp[] = [RED, TEAL, GOLD]

/* ------------------------------------------------------------------ *
 * drawing vocabulary
 * ------------------------------------------------------------------ */

const tone = (ramp: Ramp, i: number): PalKey => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))]

const px = (r: Raster, x: number, y: number, k: PalKey): void => setPx(r, Math.round(x), Math.round(y), K(k))
const box = (r: Raster, x: number, y: number, w: number, h: number, k: PalKey): void => fillRect(r, x, y, w, h, K(k))
const hline = (r: Raster, x: number, y: number, w: number, k: PalKey): void => box(r, x, y, w, 1, k)
const vline = (r: Raster, x: number, y: number, h: number, k: PalKey): void => box(r, x, y, 1, h, k)

/** Rectangular mass lit from the top-left: rim on top/left, shade on bottom/right. */
function slab(r: Raster, x: number, y: number, w: number, h: number, ramp: Ramp, base: number): void {
  box(r, x, y, w, h, tone(ramp, base))
  hline(r, x, y, w, tone(ramp, base + 2))
  vline(r, x, y, h, tone(ramp, base + 1))
  vline(r, x + w - 1, y, h, tone(ramp, base - 2))
  hline(r, x, y + h - 1, w, tone(ramp, base - 2))
}

/** Plank seams inside a slab: a dark groove with the next board's lit edge beside it. */
function seams(r: Raster, x: number, y: number, w: number, h: number, ramp: Ramp, base: number, pitch: number): void {
  for (let sx = x + pitch; sx < x + w - 1; sx += pitch) {
    vline(r, sx, y + 1, h - 2, tone(ramp, base - 2))
    vline(r, sx + 1, y + 1, h - 2, tone(ramp, base + 1))
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

/** Thick segment; the value slides across it so round stock reads as round. */
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
  const len = Math.max(0.001, Math.hypot(x1 - x0, y1 - y0))
  const ux = (x1 - x0) / len
  const uy = (y1 - y0) / len
  const lit = -uy * -0.5 + ux * -0.86
  for (let t = 0; t <= len; t += 0.35)
    for (let o = -half; o <= half; o += 0.35)
      px(r, x0 + ux * t - uy * o, y0 + uy * t + ux * o, tone(ramp, base + (lit * o * spread) / (half || 1)))
}

/** Barycentric triangle fill — the paper plane, the pennants and the bunting darts. */
function tri(
  r: Raster,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  ramp: Ramp,
  base: number,
  spread = 0,
): void {
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
  if (Math.abs(d) < 1e-6) return
  for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++)
    for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)); x++) {
      const w0 = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / d
      const w1 = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / d
      if (w0 < -0.03 || w1 < -0.03 || w0 + w1 > 1.03) continue
      px(r, x, y, tone(ramp, base - (w0 - w1) * spread))
    }
}

/** Tiny literal motifs; `map` turns sketch chars into palette keys. */
function stamp(r: Raster, x: number, y: number, art: readonly string[], map: Record<string, PalKey>, scale = 1): void {
  for (let yy = 0; yy < art.length; yy++)
    for (let xx = 0; xx < art[yy].length; xx++) {
      const c = map[art[yy][xx]]
      if (c) box(r, x + xx * scale, y + yy * scale, scale, scale, c)
    }
}

/** Running-bond masonry: field at `base`, joints one step down, a catch-light per course. */
function bond(r: Raster, x: number, y: number, w: number, h: number, ramp: Ramp, base: number, course = 7, unit = 17): void {
  box(r, x, y, w, h, tone(ramp, base))
  for (let row = 0; row * course < h; row++) {
    const ty = y + row * course
    hline(r, x, ty, w, tone(ramp, base + 1))
    const by = ty + course - 1
    if (by < y + h) hline(r, x, by, w, tone(ramp, base - 1))
    const off = (row % 2) * Math.round(unit / 2)
    for (let jx = x + off; jx < x + w; jx += unit)
      for (let jy = ty; jy < Math.min(ty + course - 1, y + h); jy++) px(r, jx, jy, tone(ramp, base - 1))
  }
  vline(r, x, y, h, tone(ramp, base + 2))
  vline(r, x + w - 1, y, h, tone(ramp, base - 2))
}

/**
 * A striped canopy with a scalloped hem — the one shape that makes every booth
 * in this pack read as the same fair. Stripes alternate `ramps`; the value
 * slides left→right so the cloth reads as a curved sheet, not a flat fill.
 */
function stripeAwning(
  r: Raster,
  x0: number,
  x1: number,
  yTop: number,
  yHem: number,
  ramps: readonly Ramp[],
  pitch: number,
  depth = 7,
  base = 4,
): void {
  const span = Math.max(1, x1 - x0)
  for (let x = x0; x <= x1; x++) {
    const u = ((x - x0) / span) * 2 - 1
    const ramp = ramps[Math.floor((x - x0) / pitch) % ramps.length]
    const hem = yHem + Math.round(depth * Math.sin((Math.PI * ((x - x0) % pitch)) / (pitch - 1)))
    for (let y = yTop; y <= hem; y++) {
      const t = (y - yTop) / Math.max(1, hem - yTop)
      px(r, x, y, tone(ramp, base - u * 1.15 - t * 0.7))
    }
    px(r, x, yTop, tone(ramp, base + 1.6 - u * 0.6))
    px(r, x, hem, tone(ramp, base - 2))
    if ((x - x0) % pitch === 0) for (let y = yTop; y <= hem; y++) px(r, x, y, tone(ramp, base - 1.4))
  }
}

/** One carnival bulb: metal cap, gold globe, a two-pixel specular. */
function bulb(r: Raster, cx: number, cy: number, rad = 2.4): void {
  box(r, Math.round(cx) - 1, Math.round(cy - rad) - 2, 2, 2, tone(METAL, 3))
  orb(r, cx, cy, rad, rad, GOLD, 4.8, 1.5)
  px(r, cx - 1, cy - 1, 'yellow7')
  px(r, cx, cy - 1, 'yellow6')
}

/* ------------------------------------------------------------------ *
 * sign lettering — a 5x7 caps face, the only text in the world's art
 * ------------------------------------------------------------------ */

const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
}

const glyph = (ch: string): string[] => GLYPHS[ch] ?? GLYPHS[' ']

/** Rendered width of `s` at `scale`, with `gap` source pixels between glyphs. */
function measure(s: string, scale: number, gap = 1): number {
  let w = 0
  for (let i = 0; i < s.length; i++) w += (glyph(s[i])[0].length + (i ? gap : 0)) * scale
  return w
}

/**
 * Blocky sign lettering. Two passes so the drop shadow never lands on a face
 * pixel of the next glyph — that shadow is what keeps light letters readable
 * against a cream board at a distance.
 */
function text(
  r: Raster,
  x: number,
  y: number,
  s: string,
  scale: number,
  face: PalKey,
  shadow?: PalKey,
  gap = 1,
): void {
  for (const pass of shadow ? [0, 1] : [1]) {
    let cx = x
    for (let i = 0; i < s.length; i++) {
      const g = glyph(s[i])
      const gw = g[0].length
      for (let gy = 0; gy < g.length; gy++)
        for (let gx = 0; gx < gw; gx++) {
          if (g[gy][gx] !== '#') continue
          const ox = cx + gx * scale + (pass === 0 ? scale : 0)
          const oy = y + gy * scale + (pass === 0 ? scale : 0)
          box(r, ox, oy, scale, scale, pass === 0 ? shadow! : face)
        }
      cx += (gw + gap) * scale
    }
  }
}

/** Centre `s` in [x0,x1] and draw it. */
function textCentred(
  r: Raster,
  x0: number,
  x1: number,
  y: number,
  s: string,
  scale: number,
  face: PalKey,
  shadow?: PalKey,
  gap = 1,
): void {
  text(r, Math.round((x0 + x1 - measure(s, scale, gap)) / 2), y, s, scale, face, shadow, gap)
}

/** Cream board with a coloured border and a gold pinstripe — every sign in the fair. */
function signBoard(r: Raster, x: number, y: number, w: number, h: number, trim: Ramp): void {
  slab(r, x, y, w, h, CREAM, 4.4)
  box(r, x, y, w, 3, tone(trim, 4))
  box(r, x, y + h - 3, w, 3, tone(trim, 2.6))
  box(r, x, y, 3, h, tone(trim, 4.6))
  box(r, x + w - 3, y, 3, h, tone(trim, 2.4))
  hline(r, x + 3, y + 3, w - 6, tone(GOLD, 5))
  hline(r, x + 3, y + h - 4, w - 6, tone(GOLD, 3))
  vline(r, x + 3, y + 3, h - 6, tone(GOLD, 5))
  vline(r, x + w - 4, y + 3, h - 6, tone(GOLD, 3))
}

const STAR = [
  '....#....',
  '....#....',
  '...###...',
  '#########',
  '.#######.',
  '..#####..',
  '..##.##..',
  '.##...##.',
  '##.....##',
]

/* ------------------------------------------------------------------ *
 * night-overlay vocabulary — glow only, never a second copy of the art
 * ------------------------------------------------------------------ */

/** Soft radial halo, max-blended so overlapping lamps never stack to white. */
function glow(r: Raster, cx: number, cy: number, rad: number, key: PalKey, peak = 150, power = 2): void {
  const c = K(key)
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue
      const d = Math.hypot(x - cx, y - cy) / rad
      if (d >= 1) continue
      const a = Math.round(peak * Math.pow(1 - d, power))
      if (a <= 3 || a <= r.data[(y * r.w + x) * 4 + 3]) continue
      setPx(r, x, y, [c[0], c[1], c[2], a])
    }
}

/** A lit bulb: hot core inside its own halo. */
function litBulb(r: Raster, cx: number, cy: number, rad = 2.4, halo = 11): void {
  glow(r, cx, cy, halo, 'glowWarm', 130)
  orb(r, cx, cy, rad, rad, GOLD, 6.4, 0.6)
  px(r, cx, cy, 'white')
}

/** Warm wash inside a rectangle (a lit window, a lit sign face). */
function litPanel(r: Raster, x: number, y: number, w: number, h: number, alpha = 170, key: PalKey = 'windowNight'): void {
  const c = K(key)
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= r.w || yy >= r.h) continue
      if (alpha <= r.data[(yy * r.w + xx) * 4 + 3]) continue
      setPx(r, xx, yy, [c[0], c[1], c[2], alpha])
    }
}

/* ================================================================== *
 * gate_arch — 256x160, anchor [128,160]
 *
 * Two brick pillars in the outer 64px columns, a cartouche sign arching
 * between them and the middle 128px clear to the ground: the world task
 * makes only the pillar columns solid, so nothing may be drawn into the
 * walk-through slot.
 * ================================================================== */

const G_CX = 127.5
/** straight underside of the sign board */
const G_BASE = 76
const G_RX = 110
const G_RY = 74
const G_X0 = 18
const G_X1 = 237

/** Top edge of the sign board at column `x` (an ellipse springing off the caps). */
function gateTop(x: number): number {
  const dx = (x - G_CX) / G_RX
  if (Math.abs(dx) >= 1) return G_BASE
  return G_BASE - G_RY * Math.sqrt(1 - dx * dx)
}

/** Bulbs marching over the arch, plus a row hanging under it between the pillars. */
function gateBulbs(): [number, number][] {
  const out: [number, number][] = []
  for (let k = 0; k < 17; k++) {
    const a = Math.PI + ((k + 0.5) / 17) * Math.PI
    out.push([G_CX + G_RX * 1.045 * Math.cos(a), G_BASE + G_RY * 1.045 * Math.sin(a)])
  }
  for (let x = 72; x <= 184; x += 16) out.push([x, 80])
  return out
}

/** One gate pillar: stone plinth, brick shaft, cream cornice. `x0` is its left column. */
function gatePillar(s: Raster, x0: number): void {
  slab(s, x0, 144, 63, 16, STONE, 3.6)
  hline(s, x0, 144, 63, tone(STONE, 5.4))
  hline(s, x0, 150, 63, tone(STONE, 2.6))
  bond(s, x0 + 6, 84, 51, 60, BRICK, 4, 7, 17)
  // cornice: cream with a canvas-red band, so the pillars read as part of the
  // sign rather than as two loose columns of brick with grey blocks on top
  slab(s, x0, 66, 63, 18, CREAM, 4.4)
  hline(s, x0, 66, 63, tone(CREAM, 6))
  box(s, x0, 72, 63, 4, tone(CANVAS, 3.6))
  hline(s, x0, 72, 63, tone(CANVAS, 4.6))
  hline(s, x0, 82, 63, tone(CREAM, 2))
  slab(s, x0 + 4, 60, 55, 7, CREAM, 5)
  hline(s, x0 + 4, 60, 55, tone(CREAM, 6))
}

/** A pennant on each cap, leaning away from the opening — drawn over the board. */
function gatePennant(s: Raster, fx: number, dir: -1 | 1, ramp: Ramp): void {
  bar(s, fx, 60, fx, 26, 1.2, WOOD, 3.6)
  orb(s, fx, 25, 2, 2, WOOD, 4.6, 1.2)
  tri(s, fx, 28, fx + dir * 22, 36, fx, 46, ramp, 4, 1.8)
  vline(s, fx, 28, 19, tone(ramp, 5.6))
}

function paintGateArch(r: Raster): void {
  withOutline(r, (s) => {
    gatePillar(s, 0)
    gatePillar(s, 193)

    // ---- the sign board: cream field, red trim, gold pinstripe ----
    for (let x = G_X0; x <= G_X1; x++) {
      const top = Math.round(gateTop(x))
      const u = (x - G_CX) / G_RX
      for (let y = top; y <= G_BASE; y++) {
        const t = (y - top) / Math.max(1, G_BASE - top)
        px(s, x, y, tone(CREAM, 4.6 - u * 0.7 - t * 0.5))
      }
      // trim follows the arc: 3px of canvas red, then a gold pinstripe
      for (let k = 0; k < 3; k++) px(s, x, top + k, tone(CANVAS, 4.4 - k * 0.5 - u * 0.6))
      px(s, x, top + 3, tone(GOLD, 5 - u * 0.6))
      for (let k = 0; k < 3; k++) px(s, x, G_BASE - k, tone(CANVAS, 3 - k * 0.4 - u * 0.6))
      px(s, x, G_BASE - 3, tone(GOLD, 3.6 - u * 0.6))
    }
    // side returns so the board reads as a solid panel, not a decal
    for (const x of [G_X0, G_X1]) vline(s, x, Math.round(gateTop(x)), G_BASE - Math.round(gateTop(x)) + 1, tone(CANVAS, x === G_X0 ? 5 : 2))

    // ---- lettering ----
    for (const sx of [104, 134]) stamp(s, sx, 11, STAR, { '#': tone(GOLD, 4.6) })
    stamp(s, 118, 8, STAR, { '#': tone(GOLD, 6) })
    textCentred(s, G_X0, G_X1, 26, "NAMAN'S WORLD", 2, tone(CANVAS, 2), tone(CANVAS, 4))
    textCentred(s, G_X0, G_X1, 46, 'FAIR', 3, tone(TEAL, 3), tone(TEAL, 5))

    for (const [bx, by] of gateBulbs()) bulb(s, bx, by, 2.6)
    gatePennant(s, 14, -1, FAIRCOL[0])
    gatePennant(s, 241, 1, FAIRCOL[1])
  })
}

function paintGateArchNight(r: Raster): void {
  for (let x = G_X0 + 4; x <= G_X1 - 4; x++) {
    const top = Math.round(gateTop(x)) + 5
    if (top >= G_BASE - 5) continue
    litPanel(r, x, top, 1, G_BASE - 5 - top, 70, 'glowWarm')
  }
  textCentred(r, G_X0, G_X1, 26, "NAMAN'S WORLD", 2, 'yellow6')
  textCentred(r, G_X0, G_X1, 46, 'FAIR', 3, 'glow')
  for (const [bx, by] of gateBulbs()) litBulb(r, bx, by, 2.6, 15)
}

/* ================================================================== *
 * booth chassis — 128x112, anchor [64,108] (forge and flight)
 * ================================================================== */

const B_SIGN_Y = 2
const B_SIGN_H = 26
const B_AWN_TOP = 27
const B_AWN_HEM = 46
const B_WALL_TOP = 46
const B_COUNTER = 82
const B_GROUND = 108

function boothChassis(s: Raster, stripe: Ramp, awnBase = 4): void {
  // back wall, in the awning's shade
  slab(s, 11, B_WALL_TOP, 106, B_COUNTER - B_WALL_TOP + 4, WOOD, 3.2)
  seams(s, 11, B_WALL_TOP, 106, B_COUNTER - B_WALL_TOP + 4, WOOD, 3.2, 9)
  hline(s, 11, B_WALL_TOP, 106, tone(WOOD, 1.6))
  // counter and apron
  slab(s, 4, B_COUNTER, 120, 8, WOOD, 5)
  hline(s, 4, B_COUNTER, 120, tone(WOOD, 6.4))
  slab(s, 10, B_COUNTER + 8, 108, 14, WOOD, 3.6)
  seams(s, 10, B_COUNTER + 8, 108, 14, WOOD, 3.6, 12)
  box(s, 10, B_COUNTER + 20, 108, 2, tone(WOOD, 1.4))
  // corner posts, in front of the wall
  for (const x of [4, 115]) {
    slab(s, x, 30, 9, B_GROUND - 30, WOOD, 4)
    seams(s, x, 30, 9, B_GROUND - 30, WOOD, 4, 4)
    box(s, x, B_GROUND - 2, 9, 2, tone(WOOD, 1.4))
  }
  // awning: header rail, striped cloth, scalloped hem
  stripeAwning(s, 2, 125, B_AWN_TOP, B_AWN_HEM, [stripe, CREAM], 11, 8, awnBase)
  slab(s, 0, B_AWN_TOP - 5, 128, 6, WOOD, 4.2)
  hline(s, 0, B_AWN_TOP - 5, 128, tone(WOOD, 6))
}

/** The board above the awning, hung off two straps. */
function boothSign(s: Raster, trim: Ramp): void {
  for (const x of [30, 95]) box(s, x, B_SIGN_Y + B_SIGN_H - 2, 3, 6, tone(METAL, 3))
  signBoard(s, 12, B_SIGN_Y, 104, B_SIGN_H, trim)
}

const ANVIL = [
  '..MMMMMMMMMMMMMMMMMM....',
  '.MLLLLLLLLLLLLLLLLLMM...',
  'MMMMMMMMMMMMMMMMMMMMMM..',
  '.dddMMMMMMMMMMMMMdddd...',
  '.....ddMMMMMMMdd........',
  '.......dMMMMd...........',
  '.......dMMMMd...........',
  '.......dMMMMd...........',
  '......dMMMMMMd..........',
  '....MMMMMMMMMMM.........',
  '...MLLLLLLLLLLMM........',
  '...MMMMMMMMMMMMM........',
  '...ddddddddddddd........',
]

const HAMMER = ['..dd', '.MLd', 'MMMd', 'MMMd', '.wwd', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.']
const WRENCH = ['.M.M', 'MMMM', '.MM.', '.MM.', '.MM.', '.MM.', '.MM.', 'MMMM', 'M..M', 'MMMM']
const TONGS = ['M..M', '.MM.', '.MM.', 'M..M', 'M..M', 'M..M', 'M..M', 'M..M', '.MM.', '.MM.']

function paintBoothForge(r: Raster): void {
  withOutline(r, (s) => {
    boothChassis(s, TEAL)
    // tools hung on the back wall, in silhouette
    const map = { M: tone(METAL, 3), L: tone(METAL, 5), d: tone(METAL, 1.5), w: tone(WOOD, 3) }
    hline(s, 14, 54, 38, tone(METAL, 4))
    for (const [tx, art] of [
      [16, HAMMER],
      [28, WRENCH],
      [40, TONGS],
    ] as const) {
      box(s, tx - 1, 55, 10, 22, tone(WOOD, 2))
      stamp(s, tx, 56, art, map, 2)
    }
    // letter blanks waiting to be struck — the Word Forge's stock in trade
    for (let i = 0; i < 4; i++) {
      const bx = 48 + i * 12
      slab(s, bx, 70, 11, 12, WOOD, 4.6)
      text(s, bx + 3, 73, 'WORD'[i], 1, tone(INK, 2))
    }
    // brazier on the counter: the forge glow the night overlay picks up
    slab(s, 96, 68, 18, 14, METAL, 3)
    box(s, 98, 71, 14, 6, tone(ORANGE, 3.6))
    box(s, 100, 72, 10, 3, tone(GOLD, 6))
    for (let i = 0; i < 5; i++) px(s, 99 + i * 3, 67 - (i % 2), tone(ORANGE, 5))
    // anvil sign
    boothSign(s, TEAL)
    stamp(s, 18, 8, ANVIL, { M: tone(METAL, 3), L: tone(METAL, 5), d: tone(METAL, 1.5) })
    text(s, 48, 9, 'FORGE', 2, tone(TEAL, 2), tone(TEAL, 4))
  })
}

function paintBoothForgeNight(r: Raster): void {
  litPanel(r, 16, B_SIGN_Y + 4, 96, B_SIGN_H - 8, 60, 'glowWarm')
  text(r, 48, 9, 'FORGE', 2, 'yellow6')
  glow(r, 105, 73, 28, 'orange5', 165)
  glow(r, 105, 73, 13, 'glowWarm', 210)
  box(r, 98, 71, 14, 6, 'yellow6')
  glow(r, 40, 78, 34, 'glowWarm', 105)
  for (const x of [24, 64, 104]) litBulb(r, x, B_AWN_HEM + 5, 2, 10)
}

function paintBoothFlight(r: Raster): void {
  withOutline(r, (s) => {
    boothChassis(s, GOLD, 3.4)
    // chalkboard on the back wall
    slab(s, 22, 54, 74, 24, WOOD, 3.8)
    slab(s, 26, 57, 66, 18, SLATE, 1.8)
    // chalk: a dashed flight arc with a little dart at its head
    for (let i = 0; i < 26; i++) {
      const t = i / 25
      if (i % 3 === 2) continue
      px(s, 30 + t * 54, 72 - Math.sin(t * Math.PI * 0.8) * 11, tone(CREAM, 5))
    }
    tri(s, 88, 59, 76, 62, 84, 65, CREAM, 5)
    for (let i = 0; i < 3; i++) hline(s, 30, 69 + i * 2, 16 - i * 4, tone(CREAM, 4))
    // paper darts at the counter's right end and a box of chalk at its left,
    // both standing clear of the board so neither reads as a smudge on it
    for (let i = 0; i < 2; i++) {
      const dx = 100 + i * 2
      tri(s, dx, 75 + i * 3, dx - 16, 72 + i * 3, dx - 5, 80 + i * 3, CREAM, 4.8, 1.2)
      tri(s, dx, 75 + i * 3, dx - 5, 80 + i * 3, dx - 13, 79 + i * 3, CREAM, 2.8)
    }
    slab(s, 20, 76, 15, 6, CANVAS, 4)
    for (let i = 0; i < 3; i++) box(s, 22 + i * 4, 73, 3, 4, tone(CREAM, 5.4))
    boothSign(s, GOLD)
    // a big paper dart on the sign: lit upper wing, shaded keel, one fold line
    tri(s, 108, 12, 58, 7, 86, 19, CREAM, 5.2, 1.2)
    tri(s, 108, 12, 86, 19, 62, 24, CREAM, 2.8, 1)
    bar(s, 108, 12, 86, 19, 0.6, CREAM, 6)
    text(s, 18, 9, 'FLY', 2, tone(GOLD, 2), tone(GOLD, 5))
  })
}

function paintBoothFlightNight(r: Raster): void {
  litPanel(r, 16, B_SIGN_Y + 4, 96, B_SIGN_H - 8, 60, 'glowWarm')
  text(r, 18, 9, 'FLY', 2, 'yellow6')
  glow(r, 64, 72, 40, 'glowWarm', 100)
  litPanel(r, 26, 57, 66, 18, 45, 'teal5')
  for (const x of [24, 64, 104]) litBulb(r, x, B_AWN_HEM + 5, 2, 10)
}

/* ================================================================== *
 * kiosk chassis — 96x96, anchor [48,92] (ticket booth and guestbook)
 * ================================================================== */

const K_SIGN_H = 18
const K_ROOF_TOP = 22
const K_ROOF_HEM = 44
const K_BODY_TOP = 46
const K_COUNTER = 72
const K_GROUND = 92

/** Half-width of the kiosk roof at row `y`. */
const kioskRoof = (y: number): number => 24 + (y - K_ROOF_TOP) * 0.92

function kioskChassis(s: Raster, stripe: Ramp): void {
  // body: panelled sides with a striped skirt under the counter
  slab(s, 12, K_BODY_TOP, 72, K_GROUND - K_BODY_TOP, WOOD, 3.6)
  seams(s, 12, K_BODY_TOP, 72, K_GROUND - K_BODY_TOP, WOOD, 3.6, 12)
  for (let x = 15; x < 81; x++) {
    const ramp = Math.floor((x - 15) / 8) % 2 === 0 ? stripe : CREAM
    const u = (x - 48) / 33
    for (let y = K_COUNTER + 8; y < K_GROUND; y++) px(s, x, y, tone(ramp, 3.8 - u * 1.1))
  }
  box(s, 12, K_GROUND - 2, 72, 2, tone(WOOD, 1.4))
  // counter, overhanging both sides
  slab(s, 5, K_COUNTER, 86, 8, WOOD, 5)
  hline(s, 5, K_COUNTER, 86, tone(WOOD, 6.4))
  box(s, 5, K_COUNTER + 7, 86, 1, tone(WOOD, 1.6))
  // roof: striped, flaring outward, with a scalloped valance
  for (let y = K_ROOF_TOP; y <= K_ROOF_HEM; y++) {
    const half = kioskRoof(y)
    for (let x = Math.round(48 - half); x <= Math.round(48 + half); x++) {
      const u = (x - 48) / half
      const ramp = Math.floor((x + 200) / 9) % 2 === 0 ? stripe : CREAM
      px(s, x, y, tone(ramp, 4.2 - u * 1.3 - (y - K_ROOF_TOP) * 0.02))
    }
    px(s, Math.round(48 - half), y, tone(CREAM, 5.6))
    px(s, Math.round(48 + half), y, tone(stripe, 1.8))
  }
  stripeAwning(s, Math.round(48 - kioskRoof(K_ROOF_HEM)), Math.round(48 + kioskRoof(K_ROOF_HEM)), K_ROOF_HEM, K_ROOF_HEM + 2, [stripe, CREAM], 9, 5)
  hline(s, 4, K_ROOF_TOP, 88, tone(WOOD, 4))
}

/** The kiosk's crown sign, on two little posts. */
function kioskSign(s: Raster, label: string, trim: Ramp): void {
  for (const x of [26, 66]) box(s, x, K_SIGN_H - 2, 4, 7, tone(WOOD, 3.4))
  signBoard(s, 12, 0, 72, K_SIGN_H, trim)
  textCentred(s, 12, 84, 6, label, 1, tone(trim, 2), tone(trim, 4.6), 2)
}

/** The serving window: dark interior, glass reflection, a warm lamp inside. */
function kioskWindow(s: Raster, x: number, y: number, w: number, h: number): void {
  slab(s, x - 3, y - 3, w + 6, h + 6, WOOD, 4.4)
  box(s, x, y, w, h, tone(INK, 1))
  box(s, x, y, w, Math.round(h * 0.4), tone(GLASS, 2.2))
  hline(s, x, y, w, tone(GLASS, 4))
  for (let i = 0; i < Math.min(w, h) - 4; i++) px(s, x + 2 + i, y + h - 3 - i, tone(GLASS, 4.4))
  orb(s, x + w - 9, y + 5, 4, 4, GOLD, 4.4, 1.2)
  box(s, x + w - 10, y, 3, 2, tone(METAL, 3))
}

function paintTicketBooth(r: Raster): void {
  withOutline(r, (s) => {
    kioskChassis(s, CANVAS)
    kioskWindow(s, 24, 51, 48, 16)
    // brass grille across the opening
    for (let i = 0; i < 8; i++) vline(s, 27 + i * 6, 52, 14, tone(GOLD, 3.4))
    for (let i = 0; i < 8; i++) vline(s, 28 + i * 6, 52, 14, tone(GOLD, 5))
    hline(s, 25, 58, 46, tone(GOLD, 4))
    // a fan of stubs and a counter bell, both standing on the counter top
    for (let i = 0; i < 4; i++) {
      slab(s, 6 + i * 3, 65 - i, 15, 7, CREAM, 4.8)
      hline(s, 7 + i * 3, 67 - i, 13, tone(CANVAS, 3.4))
    }
    orb(s, 80, 67, 7.5, 6, GOLD, 4.4, 1.9)
    box(s, 72, 68, 17, 4, tone(GOLD, 3.4))
    hline(s, 72, 68, 17, tone(GOLD, 5.4))
    hline(s, 72, 71, 17, tone(GOLD, 1.8))
    vline(s, 80, 57, 4, tone(METAL, 4))
    orb(s, 80, 57, 2.2, 2, METAL, 5, 1.2)
    px(s, 77, 63, tone(GOLD, 6.6))
    kioskSign(s, 'TICKETS', CANVAS)
  })
}

function paintBoothGuestbook(r: Raster): void {
  withOutline(r, (s) => {
    kioskChassis(s, TEAL)
    kioskWindow(s, 26, 51, 44, 15)
    // an open book on the counter: two ruled leaves rising to a dark spine
    tri(s, 22, 70, 47, 63, 47, 72, CREAM, 5.4)
    tri(s, 22, 70, 47, 72, 23, 74, CREAM, 3.2)
    tri(s, 72, 70, 47, 63, 47, 72, CREAM, 4.8)
    tri(s, 72, 70, 47, 72, 71, 74, CREAM, 2.8)
    vline(s, 47, 63, 11, tone(WOOD, 2))
    vline(s, 48, 63, 11, tone(WOOD, 4))
    for (let i = 0; i < 3; i++) {
      hline(s, 28 + i * 2, 67 + i * 2, 16 - i * 2, tone(INK, 4))
      hline(s, 51, 66 + i * 2, 16 - i * 2, tone(INK, 4))
    }
    hline(s, 23, 74, 48, tone(CREAM, 2))
    // a quill standing in its pot beside the book
    slab(s, 74, 66, 10, 8, TEAL, 3)
    bar(s, 79, 68, 86, 54, 1.2, WOOD, 4)
    tri(s, 86, 54, 82, 47, 88, 51, CREAM, 5.2)
    kioskSign(s, 'GUESTBOOK', TEAL)
  })
}

function paintBoothGuestbookNight(r: Raster): void {
  litPanel(r, 16, 4, 64, K_SIGN_H - 8, 60, 'glowWarm')
  textCentred(r, 12, 84, 6, 'GUESTBOOK', 1, 'yellow6', undefined, 2)
  litPanel(r, 26, 51, 44, 16, 175)
  glow(r, 48, 58, 30, 'glowWarm', 150)
  glow(r, 48, 70, 26, 'glowWarm', 95)
  for (const x of [20, 48, 76]) litBulb(r, x, K_ROOF_HEM + 4, 2, 9)
}

/* ================================================================== *
 * turnstile — 64x48, anchor [32,44]
 * ================================================================== */

function paintTurnstile(r: Raster): void {
  withOutline(r, (s) => {
    for (const x of [3, 52]) {
      slab(s, x, 18, 9, 26, METAL, 3.4)
      vline(s, x + 1, 19, 24, tone(METAL, 5))
      slab(s, x - 1, 41, 11, 3, METAL, 2.4)
      orb(s, x + 4, 17, 4.5, 3.5, METAL, 4, 1.4)
    }
    // top rail with a chevron warning band
    slab(s, 4, 20, 56, 6, METAL, 4)
    hline(s, 4, 20, 56, tone(METAL, 6))
    for (let x = 6; x < 58; x++) if (Math.floor((x + 100) / 5) % 2 === 0) vline(s, x, 21, 4, tone(CANVAS, 3.6))
    // hub and three arms, the near one swung toward the player
    orb(s, 32, 30, 7, 6, METAL, 3.6, 1.6)
    orb(s, 32, 30, 3.5, 3, GOLD, 4.4, 1.4)
    bar(s, 32, 30, 8, 34, 1.8, METAL, 3.8)
    bar(s, 32, 30, 56, 34, 1.8, METAL, 3.8)
    bar(s, 32, 30, 32, 43, 1.8, METAL, 3.4)
    for (const [ex, ey] of [
      [8, 34],
      [56, 34],
      [32, 43],
    ] as const)
      orb(s, ex, ey, 2.4, 2.4, GOLD, 4.6, 1.2)
  })
}

/* ================================================================== *
 * board_forge — 64x48, anchor [32,44]
 * ================================================================== */

function paintBoardForge(r: Raster): void {
  withOutline(r, (s) => {
    // splayed easel legs with a cross brace
    bar(s, 20, 12, 12, 43, 2, WOOD, 3.6)
    bar(s, 44, 12, 52, 43, 2, WOOD, 3)
    bar(s, 16, 34, 48, 34, 1.4, WOOD, 3.2)
    for (const x of [12, 52]) box(s, x - 2, 42, 5, 2, tone(WOOD, 1.6))
    // slate panel in a wood frame
    slab(s, 7, 3, 50, 32, WOOD, 4.4)
    seams(s, 7, 3, 50, 32, WOOD, 4.4, 16)
    slab(s, 11, 6, 42, 25, SLATE, 1.8)
    hline(s, 11, 6, 42, tone(SLATE, 3))
    // chalk: a headline rule and three word slots, one struck through
    hline(s, 14, 10, 20, tone(CREAM, 5))
    hline(s, 14, 12, 13, tone(CREAM, 3.4))
    for (let i = 0; i < 3; i++) {
      const bx = 14 + i * 12
      slab(s, bx, 17, 9, 9, SLATE, 3)
      box(s, bx + 1, 18, 7, 7, tone(SLATE, 1.4))
      if (i < 2) text(s, bx + 2, 19, 'AB'[i], 1, tone(CREAM, 5))
    }
    for (let i = 0; i < 8; i++) px(s, 14 + i * 2, 28 + (i % 2), tone(CREAM, 4))
    // a stub of chalk on the frame's ledge
    box(s, 46, 32, 6, 3, tone(CREAM, 5.4))
    box(s, 46, 34, 6, 1, tone(CREAM, 3))
  })
}

/* ================================================================== *
 * carts — cart_food_0 / cart_food_1 (64x64) and cart_balloons (64x80)
 * ================================================================== */

/** Wheels, chassis box and counter shared by all three carts. `ground` is the axle line. */
function cartBody(s: Raster, stripe: Ramp, top: number, ground: number): void {
  const axle = ground - 7
  for (const wx of [15, 48]) {
    orb(s, wx, axle, 7.5, 7.5, METAL, 3, 1.6)
    orb(s, wx, axle, 4.5, 4.5, WOOD, 4, 1.4)
    orb(s, wx, axle, 1.6, 1.6, METAL, 4.6, 1)
    for (let a = 0; a < Math.PI; a += Math.PI / 4)
      bar(s, wx - Math.cos(a) * 6.4, axle - Math.sin(a) * 6.4, wx + Math.cos(a) * 6.4, axle + Math.sin(a) * 6.4, 0.5, WOOD, 3.4)
  }
  bar(s, 12, axle, 51, axle, 1.2, METAL, 3)
  // body: striped panel with a rail top and bottom
  slab(s, 8, top + 6, 48, ground - top - 16, WOOD, 3.6)
  for (let x = 11; x < 53; x++) {
    const ramp = Math.floor((x - 11) / 7) % 2 === 0 ? stripe : CREAM
    const u = (x - 32) / 21
    for (let y = top + 9; y < ground - 13; y++) px(s, x, y, tone(ramp, 4 - u * 1.2))
  }
  slab(s, 4, top, 56, 7, WOOD, 5)
  hline(s, 4, top, 56, tone(WOOD, 6.4))
  slab(s, 8, ground - 13, 48, 4, WOOD, 3)
  // handle bar off the right end
  bar(s, 56, top + 3, 62, top + 12, 1.4, WOOD, 4)
}

/** The little parasol both food carts wear, on two thin poles. */
function cartCanopy(s: Raster, stripe: Ramp, yTop: number, yHem: number, poleTo: number): void {
  for (const x of [6, 55]) {
    box(s, x, yHem, 3, poleTo - yHem, tone(WOOD, 3.4))
    vline(s, x, yHem, poleTo - yHem, tone(WOOD, 5))
  }
  stripeAwning(s, 1, 62, yTop, yHem, [stripe, CREAM], 9, 6)
  slab(s, 0, Math.max(0, yTop - 3), 64, 4, WOOD, 4.2)
}

function paintCartFloss(r: Raster): void {
  withOutline(r, (s) => {
    cartCanopy(s, PINK, 1, 10, 30)
    cartBody(s, PINK, 28, 60)
    // three candy-floss cones standing on the counter, fluffy tops
    for (let i = 0; i < 3; i++) {
      const cx = 17 + i * 14
      tri(s, cx, 28, cx - 4, 22, cx + 4, 22, CREAM, 4.6, 1.4)
      hline(s, cx - 4, 22, 9, tone(CREAM, 6))
      orb(s, cx, 19, 5.2, 4.6, PINK, 4.4, 1.9)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        px(s, cx + Math.cos(a) * 5.4, 19 + Math.sin(a) * 4.8, tone(PINK, k % 3 ? 5.2 : 2.8))
      }
      px(s, cx - 2, 16, tone(PINK, 6))
    }
    text(s, 16, 38, 'FLOSS', 1, tone(CREAM, 6), tone(PINK, 2), 2)
  })
}

function paintCartPopcorn(r: Raster): void {
  withOutline(r, (s) => {
    cartCanopy(s, CANVAS, 1, 10, 30)
    cartBody(s, CANVAS, 28, 60)
    // glass popper: red frame, dark kettle, a heap of kernels behind the glass
    slab(s, 16, 15, 32, 13, CANVAS, 3.6)
    box(s, 19, 18, 26, 8, tone(INK, 2))
    hline(s, 19, 18, 26, tone(GLASS, 4.4))
    vline(s, 19, 18, 8, tone(GLASS, 4))
    for (let i = 0; i < 16; i++) {
      const kx = 21 + ((i * 5) % 22)
      const ky = 20 + ((i * 3) % 6)
      orb(s, kx, ky, 2.2, 1.9, CREAM, 5.2 - (i % 3) * 0.7, 1.3)
    }
    slab(s, 26, 12, 12, 4, METAL, 4.4)
    box(s, 30, 10, 4, 3, tone(METAL, 3))
    // two paper cones of popcorn standing on the counter
    for (const cx of [10, 54]) {
      tri(s, cx, 28, cx - 4, 21, cx + 4, 21, CANVAS, 4.4, 1.2)
      orb(s, cx, 19, 4.6, 3.2, CREAM, 5.2, 1.4)
      px(s, cx - 2, 17, tone(CREAM, 6))
    }
    text(s, 12, 38, 'POPCORN', 1, tone(CREAM, 6), tone(CANVAS, 2), 1)
  })
}

function paintCartBalloons(r: Raster): void {
  withOutline(r, (s) => {
    cartBody(s, TEAL, 44, 76)
    // cleat on the counter, then the strings, then the balloons over them
    slab(s, 28, 40, 8, 5, WOOD, 4)
    const bunch: [number, number, number][] = [
      [12, 20, 0],
      [30, 10, 1],
      [50, 19, 2],
      [20, 32, 2],
      [42, 31, 0],
      [32, 24, 1],
      [8, 34, 1],
      [55, 33, 0],
    ]
    for (const [bx, by] of bunch) {
      const n = 42 - by
      for (let i = 0; i <= n; i++) {
        const t = i / n
        px(s, bx + (32 - bx) * t + Math.sin(t * Math.PI) * (bx < 32 ? -2 : 2), by + 9 + (42 - by - 9) * t, i % 5 === 0 ? tone(CREAM, 5) : tone(CREAM, 3))
      }
    }
    for (const [bx, by, c] of bunch) {
      const ramp = FAIRCOL[c]
      orb(s, bx, by, 7, 8, ramp, 3.6, 2.1)
      for (let i = 0; i < 3; i++) {
        const half = Math.max(0, 2 - i)
        for (let dx = -half; dx <= half; dx++) px(s, bx + dx, by + 8 + i, tone(ramp, 3 - dx * 0.4))
      }
      px(s, bx - 3, by - 4, tone(ramp, 5.6))
      px(s, bx - 2, by - 4, tone(ramp, 5))
      px(s, bx - 3, by - 3, tone(ramp, 5))
    }
  })
}

/* ================================================================== *
 * arcade_sign — 96x32, anchor [48,28]
 * ================================================================== */

function paintArcadeSign(r: Raster): void {
  withOutline(r, (s) => {
    slab(s, 0, 0, 96, 28, METAL, 3.4)
    hline(s, 0, 0, 96, tone(METAL, 6))
    box(s, 5, 5, 86, 18, tone(INK, 2))
    hline(s, 5, 5, 86, tone(INK, 1))
    // a violet wash behind the letters so the marquee reads as lit, not painted
    for (let x = 7; x < 89; x++)
      for (let y = 7; y < 21; y++) if ((x + y) % 3 === 0) px(s, x, y, tone(PURPLE, 1.6))
    textCentred(s, 5, 91, 8, 'ARCADE', 2, tone(GOLD, 6), tone(RED, 2))
    for (let x = 6; x < 94; x += 8) {
      bulb(s, x, 2.5, 1.8)
      bulb(s, x, 25.5, 1.8)
    }
    for (const y of [2.5, 25.5]) for (let x = 6; x < 94; x += 8) px(s, x - 1, y - 1, 'yellow7')
  })
}

/* ================================================================== *
 * duck_0..2 — 16x16, anchor [8,8] (Hook-a-Duck bobbers)
 * ================================================================== */

/** One bobber. `body` shades the duck; `mark` optionally speckles it. */
function paintDuck(r: Raster, body: Ramp, mark?: Ramp, gilt = false): void {
  const lift = gilt ? 0.9 : 0
  withOutline(r, (s) => {
    orb(s, 8, 10, 5.6, 4, body, 4.2 + lift, gilt ? 2.6 : 1.9)
    tri(s, 3, 6, 3, 11, 8, 9, body, 3.4 + lift)
    orb(s, 11, 5.5, 3.2, 3.2, body, 4.6 + lift, gilt ? 2.2 : 1.6)
    box(s, 9, 6, 4, 4, tone(body, 4.4 + lift))
    if (mark)
      for (const [mx, my] of [
        [6, 9],
        [9, 12],
        [4, 11],
        [11, 10],
      ] as const)
        orb(s, mx, my, 1.6, 1.3, mark, 3.4, 1)
    // bill, eye, water line. The prize duck is cast in one metal — gold bill,
    // a hard specular and a deep shadow under the belly — so it never reads as
    // the plain rubber one with a hat on.
    const billRamp = gilt ? GOLD : ORANGE
    box(s, 13, 5, 3, 2, tone(billRamp, gilt ? 5.6 : 4.4))
    px(s, 15, 6, tone(billRamp, gilt ? 3.4 : 2.6))
    px(s, 13, 4, tone(billRamp, 6))
    px(s, 11, 4, 'ink2')
    px(s, 10, 3, 'white')
    hline(s, 4, 13, 9, tone(body, gilt ? 1.6 : 2.4))
    if (gilt) {
      // crown, top-left rim run and two sparkles
      for (const cx of [9, 11, 13]) px(s, cx, 1, tone(GOLD, 6))
      hline(s, 9, 2, 5, tone(GOLD, 5))
      for (const [rx, ry] of [
        [9, 3],
        [10, 3],
        [4, 8],
        [5, 7],
        [6, 7],
      ] as const)
        px(s, rx, ry, 'yellow7')
      px(s, 7, 9, 'white')
      px(s, 12, 11, tone(GOLD, 1.4))
      px(s, 11, 12, tone(GOLD, 1.4))
    }
  })
}

/* ================================================================== *
 * stringlight — 32x48, anchor [16,44]
 * ================================================================== */

/** The rope's sag: highest at the post, dipping toward both frame edges. */
const ropeY = (x: number): number => 11 + Math.round(9 * Math.pow((x - 16) / 16, 2))
const LIGHT_BULBS = [1, 6, 11, 21, 26, 31]

function paintStringlight(r: Raster): void {
  withOutline(r, (s) => {
    slab(s, 13, 12, 6, 32, WOOD, 4)
    seams(s, 13, 12, 6, 32, WOOD, 4, 3)
    slab(s, 10, 40, 12, 4, STONE, 3.4)
    slab(s, 11, 8, 10, 5, WOOD, 4.6)
    orb(s, 16, 7, 2.4, 2.4, METAL, 4.2, 1.2)
    for (let x = 0; x < 32; x++) {
      const y = ropeY(x)
      px(s, x, y, tone(CREAM, 4))
      px(s, x, y + 1, tone(CREAM, 2))
    }
    for (const x of LIGHT_BULBS) {
      const y = ropeY(x) + 2
      vline(s, x, y, 2, tone(METAL, 3))
      orb(s, x, y + 4, 2.4, 2.8, GOLD, 4.6, 1.6)
      px(s, x - 1, y + 3, 'yellow7')
    }
  })
}

function paintStringlightNight(r: Raster): void {
  for (const x of LIGHT_BULBS) litBulb(r, x, ropeY(x) + 6, 2.4, 13)
  glow(r, 16, 40, 15, 'glowWarm', 70)
}

/* ------------------------------------------------------------------ *
 * defs
 * ------------------------------------------------------------------ */

export const FAIR_DEFS: SpriteDef[] = [
  { name: 'gate_arch', w: 256, h: 160, legend: {}, paint: paintGateArch, anchor: [128, 160] },
  { name: 'gate_arch_night', w: 256, h: 160, legend: {}, paint: paintGateArchNight, anchor: [128, 160] },
  { name: 'ticket_booth', w: 96, h: 96, legend: {}, paint: paintTicketBooth, anchor: [48, 92] },
  { name: 'turnstile', w: 64, h: 48, legend: {}, paint: paintTurnstile, anchor: [32, 44] },
  { name: 'booth_forge', w: 128, h: 112, legend: {}, paint: paintBoothForge, anchor: [64, 108] },
  { name: 'booth_forge_night', w: 128, h: 112, legend: {}, paint: paintBoothForgeNight, anchor: [64, 108] },
  { name: 'board_forge', w: 64, h: 48, legend: {}, paint: paintBoardForge, anchor: [32, 44] },
  { name: 'booth_flight', w: 128, h: 112, legend: {}, paint: paintBoothFlight, anchor: [64, 108] },
  { name: 'booth_flight_night', w: 128, h: 112, legend: {}, paint: paintBoothFlightNight, anchor: [64, 108] },
  { name: 'booth_guestbook', w: 96, h: 96, legend: {}, paint: paintBoothGuestbook, anchor: [48, 92] },
  { name: 'booth_guestbook_night', w: 96, h: 96, legend: {}, paint: paintBoothGuestbookNight, anchor: [48, 92] },
  { name: 'cart_food_0', w: 64, h: 64, legend: {}, paint: paintCartFloss, anchor: [32, 60] },
  { name: 'cart_food_1', w: 64, h: 64, legend: {}, paint: paintCartPopcorn, anchor: [32, 60] },
  { name: 'cart_balloons', w: 64, h: 80, legend: {}, paint: paintCartBalloons, anchor: [32, 76] },
  { name: 'arcade_sign', w: 96, h: 32, legend: {}, paint: paintArcadeSign, anchor: [48, 28] },
  { name: 'duck_0', w: 16, h: 16, legend: {}, paint: (r) => paintDuck(r, GOLD), anchor: [8, 8] },
  { name: 'duck_1', w: 16, h: 16, legend: {}, paint: (r) => paintDuck(r, CREAM, BROWN), anchor: [8, 8] },
  { name: 'duck_2', w: 16, h: 16, legend: {}, paint: (r) => paintDuck(r, GOLD, undefined, true), anchor: [8, 8] },
  { name: 'stringlight', w: 32, h: 48, legend: {}, paint: paintStringlight, anchor: [16, 44] },
  { name: 'stringlight_night', w: 32, h: 48, legend: {}, paint: paintStringlightNight, anchor: [16, 44] },
]
