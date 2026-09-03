// The rides pack: the Career Coaster (three spans, a station and its cart) and
// the Ferris wheel that turns on the Wheel Lawn.
//
// The coaster is drawn FRONT-FACING — you stand on the midway and look at the
// side of the structure, the way you do at a real fair — so the whole ride is a
// silhouette problem: a wooden bent-work lattice whose top edge IS the profile,
// with the rails laid over it.
//
// The profile is not authored here. `data/coaster.ts` owns COASTER_PATH, and
// these painters lay every rail, tie and support along it with a per-span x
// offset. Two things fall out for free:
//   · the three spans tile — the rail leaving span n's right edge is the same
//     polyline arriving at span n+1's left edge, so the seam cannot step;
//   · the cart cannot leave the track, because the runner drives the same array.
//
// House rules (art-direction.md):
//   · palette keys only, light from the top-left — every post carries its lit
//     step on the left column and its dark step on the right;
//   · no auto-outline on the spans, the wheel or its rim: an outline traced
//     round every strut would weld the lattice into one dark mass. They are
//     massed structure, like foliage. The station (a building) and the cart (a
//     character-scale prop) do keep the 1px silhouette outline;
//   · night overlays are separate defs at the same size and anchor, carrying
//     bulbs and soft halos only — never a repaint of the day sprite.
import type { PalKey } from '../palette'
import type { Legend, SpriteDef } from '../pixel'
import { K } from '../procedural'
import { fillRect, setPx, type Raster } from '../raster'
import { COASTER_PATH } from '../../data/coaster'

/* ------------------------------------------------------------------ *
 * shared drawing vocabulary (the props.ts idiom)
 * ------------------------------------------------------------------ */

type Ramp = readonly PalKey[]

const WOOD: Ramp = ['wood1', 'wood2', 'wood3', 'wood4', 'wood5', 'wood6', 'wood7']
const METAL: Ramp = ['metal1', 'metal2', 'metal3', 'metal4', 'metal5', 'metal6']
const STONE: Ramp = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5', 'stone6', 'stone7']
const DIRT: Ramp = ['dirt1', 'dirt2', 'dirt3', 'dirt4', 'dirt5', 'dirt6']
const CREAM: Ramp = ['cream1', 'cream2', 'cream3', 'cream4', 'cream5', 'cream6']
const RED: Ramp = ['red1', 'red2', 'red3', 'red4', 'red5', 'red6']
const TEAL: Ramp = ['teal1', 'teal2', 'teal3', 'teal4', 'teal5', 'teal6']
const BRASS: Ramp = ['yellow1', 'yellow2', 'yellow3', 'yellow4', 'yellow5', 'yellow6', 'yellow7']
/** The fairground's three-colour rotation, matching the bunting in props.ts. */
const FAIR: readonly Ramp[] = [RED, TEAL, BRASS]

const tone = (ramp: Ramp, i: number): PalKey => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))]
const px = (r: Raster, x: number, y: number, k: PalKey): void => setPx(r, Math.round(x), Math.round(y), K(k))
const box = (r: Raster, x: number, y: number, w: number, h: number, k: PalKey): void => fillRect(r, x, y, w, h, K(k))

/** Deterministic 0..1 hash — grain without carrying an rng around. */
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
function bar(r: Raster, x0: number, y0: number, x1: number, y1: number, half: number, ramp: Ramp, base: number, spread = 2): void {
  const len = Math.hypot(x1 - x0, y1 - y0)
  if (len < 0.001) return
  const ux = (x1 - x0) / len
  const uy = (y1 - y0) / len
  const nx = -uy
  const ny = ux
  const lit = nx * -0.5 + ny * -0.86
  for (let t = 0; t <= len; t += 0.35)
    for (let o = -half; o <= half; o += 0.35) px(r, x0 + ux * t + nx * o, y0 + uy * t + ny * o, tone(ramp, base + (lit * o * spread) / half))
}

/** Soft warm halo, additive-ish: only writes where nothing brighter is already lit. */
function halo(r: Raster, cx: number, cy: number, rad: number, key: PalKey, peak: number): void {
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue
      const d = Math.hypot(x - cx, y - cy) / rad
      if (d >= 1) continue
      const a = Math.round(peak * (1 - d) * (1 - d))
      if (a <= 0) continue
      const i = (y * r.w + x) * 4
      if (r.data[i + 3] >= a) continue
      const c = K(key, a)
      r.data[i] = c[0]
      r.data[i + 1] = c[1]
      r.data[i + 2] = c[2]
      r.data[i + 3] = a
    }
}

/* ------------------------------------------------------------------ *
 * the coaster spans — 512x320 each, three of them side by side
 * ------------------------------------------------------------------ */

const SPAN_W = 512
const SPAN_H = 320
const SPAN_COUNT = 3
const TOTAL_W = SPAN_W * SPAN_COUNT
/** Sprite row for a profile height (path y is 0 at the structure's foot, negative up). */
const rowOf = (y: number): number => SPAN_H + y
/** Rows of ballast the structure stands on — the world makes this tile row solid. */
const BERM = 14
const GROUND = SPAN_H - BERM

/**
 * Top of the bent-work at every absolute x: the height of the FORWARD-running
 * track above it. Only forward track carries a tower — that one rule gives the
 * loop's crown and the low return track their real-world treatment for free
 * (the crown stands clear above the lattice, the return track threads through
 * it) without a single hand-placed support.
 */
function buildEnvelope(): Float32Array {
  const env = new Float32Array(TOTAL_W).fill(SPAN_H)
  let lo = TOTAL_W
  let hi = 0
  for (let i = 1; i < COASTER_PATH.length; i++) {
    const a = COASTER_PATH[i - 1]
    const b = COASTER_PATH[i]
    if (b.x <= a.x) continue
    for (let x = Math.ceil(a.x); x <= Math.floor(b.x); x++) {
      if (x < 0 || x >= TOTAL_W) continue
      const row = rowOf(a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x))
      if (row < env[x]) env[x] = row
      if (x < lo) lo = x
      if (x > hi) hi = x
    }
  }
  // Near-vertical stretches (the loop's flanks) skip whole columns; carry the
  // last known height across them so the lattice has no slots cut through it.
  for (let x = lo + 1; x <= hi; x++) if (env[x] >= SPAN_H) env[x] = env[x - 1]
  // A short over-run past the last stop, then the structure steps down to the
  // ground. Any longer and it would read as trestle carrying no track.
  const deck = env[hi]
  for (let x = hi; x < Math.min(TOTAL_W, hi + 34); x++) env[x] = Math.min(env[x], deck)
  for (let k = 0; k < 26; k++) {
    const x = hi + 34 + k
    if (x >= TOTAL_W) break
    env[x] = Math.min(env[x], deck + ((GROUND - deck) * k) / 26)
  }
  return env
}

const ENV = buildEnvelope()

/**
 * The loop's crown — the one stretch of track that runs BACKWARDS high above
 * the foot, and therefore the one stretch the bent-work envelope leaves
 * standing clear. Steel loops are held by a column behind them and two stays
 * out to the flanks; both are derived from the path so they follow it if the
 * profile is ever re-cut.
 */
const CROWN = ((): { cx: number; eq: number; sl: { x: number; y: number }; sr: { x: number; y: number } } | null => {
  let l = Infinity
  let r = -Infinity
  let top = 0
  for (let i = 1; i < COASTER_PATH.length; i++) {
    const a = COASTER_PATH[i - 1]
    const b = COASTER_PATH[i]
    if (b.x >= a.x || b.y > -120) continue
    l = Math.min(l, a.x, b.x)
    r = Math.max(r, a.x, b.x)
    top = Math.min(top, a.y, b.y)
  }
  if (!Number.isFinite(l)) return null
  const cx = (l + r) / 2
  const eq = Math.min(ENV[Math.round(l)], ENV[Math.round(r)]) - SPAN_H
  const mid = (top + eq) / 2
  let sl = { x: l, y: eq }
  let sr = { x: r, y: eq }
  for (const p of COASTER_PATH) {
    if (p.x < l - 2 || p.x > r + 2 || p.y > eq) continue
    if (p.x < cx && Math.abs(p.y - mid) < Math.abs(sl.y - mid)) sl = p
    if (p.x > cx && Math.abs(p.y - mid) < Math.abs(sr.y - mid)) sr = p
  }
  return { cx, eq, sl, sr }
})()
const POST_PITCH = 96
const STOREY = 40

/** Is (x,y) inside the bent-work — under the profile and above the ballast?
 *  `x` arrives fractional from the brace walker, so it MUST be rounded before
 *  it indexes ENV: a typed array returns undefined for a fractional index and
 *  every comparison against it is false, which drops every off-grid sample and
 *  leaves the bracing dashed. */
const inFrame = (x: number, y: number): boolean => {
  const i = Math.round(x)
  return i >= 0 && i < TOTAL_W && y > ENV[i] + 4 && y < GROUND
}

/** The timber bent-work: ballast, posts every ~96px, ledgers and X-bracing. */
function paintStructure(s: Raster, ox: number): void {
  // ---- ballast bed the whole structure stands on (the solid base row) ----
  for (let x = 0; x < SPAN_W; x++) {
    const ax = ox + x
    const crown = GROUND + Math.round(noise(ax * 0.7, 3) * 2)
    for (let y = crown; y < SPAN_H; y++) {
      const t = (y - crown) / (SPAN_H - crown)
      const n = noise(ax, y, 1)
      px(s, x, y, tone(DIRT, 3.2 - t * 1.7 + (n > 0.8 ? 1.4 : n < 0.22 ? -0.7 : 0)))
      if (n > 0.955) px(s, x, y, tone(STONE, 4))
    }
    px(s, x, crown, tone(DIRT, 4.6))
    px(s, x, SPAN_H - 1, tone(DIRT, 1.4))
  }

  // ---- ledgers: the storey lines that run right through the structure ----
  for (let level = GROUND - 12; level > 0; level -= STOREY) {
    for (let x = 0; x < SPAN_W; x++) {
      const ax = ox + x
      if (!inFrame(ax, level)) continue
      px(s, x, level, tone(WOOD, 4.6))
      px(s, x, level + 1, tone(WOOD, 2.8))
      px(s, x, level + 2, tone(WOOD, 1.8))
    }
  }

  // ---- X-bracing, one cross per bay per storey ----
  const brace = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) * 2))
    for (let i = 0; i <= n; i++) {
      const ax = x0 + ((x1 - x0) * i) / n
      const ay = y0 + ((y1 - y0) * i) / n
      if (!inFrame(ax, ay)) continue
      px(s, ax - ox, ay, tone(WOOD, 1.9))
      px(s, ax - ox, ay + 1, tone(WOOD, 0.9))
      px(s, ax - ox - 1, ay, tone(WOOD, 2.9))
    }
  }
  // half-bays: a 48x40 cross is the proportion bent-work actually uses, and it
  // keeps the 96px bays from reading as one long empty panel
  for (let bay = 0; bay * (POST_PITCH / 2) < TOTAL_W; bay++) {
    const x0 = (bay * POST_PITCH) / 2
    const x1 = x0 + POST_PITCH / 2
    if (x1 < ox - POST_PITCH || x0 > ox + SPAN_W + POST_PITCH) continue
    for (let top = GROUND - 12; top > 0; top -= STOREY) {
      const up = top - STOREY
      brace(x0, top, x1, up)
      brace(x0, up, x1, top)
    }
  }

  // ---- posts: the bents themselves, battered so the tower reads as a tower ----
  for (let bent = 0; bent * POST_PITCH < TOTAL_W; bent++) {
    const ax = bent * POST_PITCH
    if (ax < ox - 12 || ax > ox + SPAN_W + 12) continue
    const top = Math.round(ENV[Math.min(TOTAL_W - 1, ax)])
    if (top > GROUND - 16) continue
    const x = ax - ox
    for (let y = top + 2; y < GROUND + 3; y++) {
      const t = (y - top) / Math.max(1, GROUND - top)
      const half = 1.6 + t * 1.7
      for (let o = -half; o <= half; o += 0.5) px(s, x + o, y, tone(WOOD, o < -half + 1.1 ? 4.8 : o > half - 1.1 ? 1.6 : 3.2))
      if (y % 24 === 0) for (let o = -half - 1; o <= half + 1; o += 0.5) px(s, x + o, y, tone(WOOD, 2))
    }
    // concrete footing, a little wider than the post's base half-width
    const fh = 4
    slab(s, x - fh - 2, GROUND - 1, fh * 2 + 5, 7, STONE, 4)
  }

  // ---- the loop's steel: a column behind it and two stays out to the flanks ----
  if (CROWN) {
    const cx = CROWN.cx - ox
    const eqRow = rowOf(CROWN.eq)
    bar(s, cx, eqRow, cx, GROUND + 2, 3.5, METAL, 3.6)
    bar(s, cx, eqRow + 6, CROWN.sl.x - ox, rowOf(CROWN.sl.y), 1.8, METAL, 3.2)
    bar(s, cx, eqRow + 6, CROWN.sr.x - ox, rowOf(CROWN.sr.y), 1.8, METAL, 3.2)
    bar(s, cx - 26, eqRow + 20, cx + 26, eqRow + 20, 1.4, METAL, 3)
    slab(s, cx - 9, GROUND - 1, 19, 8, STONE, 4)
  }

  // ---- a raking cross-tie under the profile so the top edge reads as built ----
  for (let x = 0; x < SPAN_W; x++) {
    const ax = ox + x
    const top = ENV[Math.min(TOTAL_W - 1, Math.max(0, ax))]
    if (top >= GROUND - 4) continue
    px(s, x, top + 3, tone(WOOD, 4.4))
    px(s, x, top + 4, tone(WOOD, 2.6))
  }
}

/** Walk the profile, calling `fn` with the point and its unit tangent/normal. */
function walkTrack(fn: (x: number, y: number, ux: number, uy: number, nx: number, ny: number, s: number) => void, step = 0.5): void {
  let travelled = 0
  for (let i = 1; i < COASTER_PATH.length; i++) {
    const a = COASTER_PATH[i - 1]
    const b = COASTER_PATH[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 0.001) continue
    const ux = (b.x - a.x) / len
    const uy = (b.y - a.y) / len
    for (let t = 0; t < len; t += step) fn(a.x + ux * t, rowOf(a.y + uy * t), ux, uy, -uy, ux, travelled + t)
    travelled += len
  }
}

/**
 * Ties, chords and a 2px running rail, laid along COASTER_PATH.
 *
 * The truss is drawn SYMMETRICALLY about the rail — a chord either side, ties
 * across both — rather than hanging off one face. A one-sided truss needs to
 * know which way is "down" for the track, and there is no continuous answer:
 * pick the perpendicular whose y is positive and it flips inside-out at the
 * loop's flanks; pick the outward normal and it lands on top of every crest.
 * A symmetric truss is what coaster track actually looks like anyway.
 */
function paintTrack(s: Raster, ox: number): void {
  // ties first, so the rails sit on top of them
  walkTrack((x, y, _ux, _uy, nx, ny, dist) => {
    if (dist % 9 > 0.5) return
    for (let o = -5; o <= 5; o += 0.5) px(s, x - ox + nx * o, y + ny * o, tone(WOOD, Math.abs(o) > 3.5 ? 2.2 : 3.6))
  })
  // the two chords the ties span between
  walkTrack((x, y, _ux, _uy, nx, ny) => {
    px(s, x - ox + nx * 5, y + ny * 5, tone(WOOD, 4.4))
    px(s, x - ox + nx * -5, y + ny * -5, tone(WOOD, 2.6))
  }, 0.34)
  // the running rail: 2px of steel, lit on its upper edge
  walkTrack((x, y, _ux, _uy, nx, ny) => {
    px(s, x - ox + nx * -1, y + ny * -1, tone(METAL, 5.4))
    px(s, x - ox, y, tone(METAL, 3.4))
    px(s, x - ox + nx, y + ny, tone(METAL, 1.6))
  }, 0.34)
}

function paintSpan(span: number): (r: Raster) => void {
  return (r: Raster) => {
    const ox = span * SPAN_W
    paintStructure(r, ox)
    paintTrack(r, ox)
  }
}

/** Bulbs strung along the rails, plus a lamp on top of each bent. */
function paintSpanNight(span: number): (r: Raster) => void {
  return (r: Raster) => {
    const ox = span * SPAN_W
    walkTrack((x, y, _ux, _uy, nx, ny, dist) => {
      if (dist % 24 > 0.5) return
      const bx = x - ox + nx * -3
      const by = y + ny * -3
      if (bx < -8 || bx > SPAN_W + 8) return
      halo(r, bx, by, 7, 'glowWarm', 92)
      box(r, Math.round(bx), Math.round(by), 2, 2, 'windowNight')
      px(r, Math.round(bx), Math.round(by), 'glowWarm')
    })
    for (let bent = 0; bent * POST_PITCH < TOTAL_W; bent++) {
      const ax = bent * POST_PITCH
      const x = ax - ox
      if (x < -6 || x > SPAN_W + 6) continue
      const top = Math.round(ENV[Math.min(TOTAL_W - 1, ax)])
      if (top > GROUND - 16) continue
      halo(r, x, top + 8, 12, 'yellow6', 74)
      box(r, x - 1, top + 7, 3, 3, 'windowNight')
    }
  }
}

/* ------------------------------------------------------------------ *
 * legend + char-grid helpers for the hand-drawn pieces
 * ------------------------------------------------------------------ */

const POOL =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + '!"#$%&\'()*+,-/:;<=>?@[]^_`{|}~'

const L: Legend = {}
let cursor = 0
const claim = (v: PalKey): string => {
  const ch = POOL[cursor++]
  L[ch] = v
  return ch
}
/** Reserve one char per step of `family1..familyN`; returns a 1-based lookup. */
const rampChars = (family: string, n: number): string[] => {
  const out = ['']
  for (let i = 1; i <= n; i++) out.push(claim(`${family}${i}` as PalKey))
  return out
}

const cWD = rampChars('wood', 7)
const cMT = rampChars('metal', 6)
const cST = rampChars('stone', 7)
const cCR = rampChars('cream', 6)
const cRE = rampChars('red', 6)
const cTL = rampChars('teal', 6)
const cYW = rampChars('yellow', 7)
const cGV = rampChars('path', 6)
const cSK = rampChars('skin', 6)
const cHR = rampChars('hairBlack', 6)
const cIK = rampChars('ink', 6)

/** night-overlay legend: lit bulbs and soft warm halos, nothing else */
const NL: Legend = {
  y: 'windowNight',
  Y: 'yellow5',
  H: 'glowWarm',
  '~': 'rgba(255,214,120,0.32)',
  '-': 'rgba(255,214,120,0.16)',
}

type G = { w: number; h: number; c: string[][] }

const grid = (w: number, h: number): G => ({ w, h, c: Array.from({ length: h }, () => Array<string>(w).fill('.')) })
const put = (g: G, x: number, y: number, ch: string): void => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi >= 0 && yi >= 0 && xi < g.w && yi < g.h) g.c[yi][xi] = ch
}
const putSoft = (g: G, x: number, y: number, ch: string): void => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi >= 0 && yi >= 0 && xi < g.w && yi < g.h && g.c[yi][xi] === '.') g.c[yi][xi] = ch
}
const rect = (g: G, x: number, y: number, w: number, h: number, ch: string): void => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(g, xx, yy, ch)
}
const hline = (g: G, x: number, y: number, w: number, ch: string): void => rect(g, x, y, w, 1, ch)
const vline = (g: G, x: number, y: number, h: number, ch: string): void => rect(g, x, y, 1, h, ch)
const disc = (g: G, cx: number, cy: number, rad: number, ch: string): void => {
  for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
    for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++)
      if (Math.hypot(xx - cx, yy - cy) <= rad + 0.35) put(g, xx, yy, ch)
}
/** Straight run between two points (Bresenham-free, sampled). */
const lineG = (g: G, x0: number, y0: number, x1: number, y1: number, ch: string): void => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) * 2))
  for (let i = 0; i <= n; i++) put(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ch)
}
/** Timber post lit on the left, shaded on the right. */
const postG = (g: G, x: number, y: number, w: number, h: number): void => {
  rect(g, x, y, w, h, cWD[4])
  vline(g, x, y, h, cWD[6])
  vline(g, x + w - 1, y, h, cWD[2])
}
/** Soft halo around a lit rectangle (night grids only). */
const haloG = (g: G, x: number, y: number, w: number, h: number, ch = '~', pad = 4): void => {
  for (let yy = y - pad; yy < y + h + pad; yy++)
    for (let xx = x - pad; xx < x + w + pad; xx++) {
      if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue
      const d = Math.abs(xx - (x + w / 2)) / (w / 2 + pad) + Math.abs(yy - (y + h / 2)) / (h / 2 + pad)
      if (d < 1.9) putSoft(g, xx, yy, ch)
    }
}
const toRows = (g: G): string[] => g.c.map((r) => r.join(''))

/* ---- a 3x5 sign face, the only lettering this pack needs ---- */

const GLYPHS: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  C: ['111', '100', '100', '100', '111'],
  E: ['111', '100', '110', '100', '111'],
  O: ['111', '101', '101', '101', '111'],
  R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  ' ': ['000', '000', '000', '000', '000'],
}

/** Paint `text` at `scale`, top-left at (x,y); returns the width it used. */
function letters(g: G, x: number, y: number, text: string, ch: string, scale = 2, shadow?: string): number {
  let cx = x
  for (const c of text.toUpperCase()) {
    const glyph = GLYPHS[c] ?? GLYPHS[' ']
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] !== '1') continue
        if (shadow) rect(g, cx + gx * scale + 1, y + gy * scale + 1, scale, scale, shadow)
      }
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++) if (glyph[gy][gx] === '1') rect(g, cx + gx * scale, y + gy * scale, scale, scale, ch)
    cx += 4 * scale
  }
  return cx - x
}

/* ------------------------------------------------------------------ *
 * coaster_station — 192x128, anchor bottom-centre
 * ------------------------------------------------------------------ */

const STA_W = 192
const STA_H = 128
const ROOF_TOP = 36
const ROOF_BOT = 54
const DECK_TOP = 96
const SIGN_Y = 0
const SIGN_H = 30

function buildStation(): { day: G; night: G } {
  const day = grid(STA_W, STA_H)
  const night = grid(STA_W, STA_H)

  // ---- gravel apron ----
  for (let y = 118; y < STA_H; y++)
    for (let x = 0; x < STA_W; x++) {
      const t = (y - 118) / (STA_H - 118)
      const n = noise(x, y, 5)
      put(day, x, y, cGV[Math.max(1, Math.min(6, Math.round(4 - t * 1.6 + (n > 0.75 ? 1 : n < 0.22 ? -1 : 0))))])
    }

  // ---- under-deck: stone piers between timber cross-braces ----
  for (let x = 8; x < STA_W - 8; x += 34) {
    rect(day, x, DECK_TOP + 8, 10, 118 - DECK_TOP - 8, cST[4])
    vline(day, x, DECK_TOP + 8, 118 - DECK_TOP - 8, cST[6])
    vline(day, x + 9, DECK_TOP + 8, 118 - DECK_TOP - 8, cST[2])
    if (x + 34 < STA_W - 8) {
      lineG(day, x + 10, 116, x + 34, DECK_TOP + 9, cWD[3])
      lineG(day, x + 10, DECK_TOP + 9, x + 34, 116, cWD[3])
    }
  }

  // ---- the deck ----
  rect(day, 4, DECK_TOP, STA_W - 8, 8, cWD[4])
  hline(day, 4, DECK_TOP, STA_W - 8, cWD[6])
  for (let x = 6; x < STA_W - 6; x += 9) vline(day, x, DECK_TOP + 1, 6, cWD[3])
  rect(day, 2, DECK_TOP + 8, STA_W - 4, 4, cWD[3])
  hline(day, 2, DECK_TOP + 11, STA_W - 4, cWD[1])
  // the yellow safety line every platform has
  for (let x = 8; x < STA_W - 8; x += 4) hline(day, x, DECK_TOP + 1, 2, cYW[4])

  // ---- back wall boarding, seen through the open bay ----
  rect(day, 16, ROOF_BOT + 2, STA_W - 32, DECK_TOP - ROOF_BOT - 2, cWD[3])
  for (let y = ROOF_BOT + 2; y < DECK_TOP; y += 6) hline(day, 16, y, STA_W - 32, cWD[2])
  for (let y = ROOF_BOT + 3; y < DECK_TOP; y += 6) hline(day, 16, y, STA_W - 32, cWD[4])
  // the track slot the train stands in
  rect(day, 16, DECK_TOP - 12, STA_W - 32, 10, cIK[3])
  for (let x = 20; x < STA_W - 20; x += 8) vline(day, x, DECK_TOP - 11, 8, cWD[2])
  hline(day, 16, DECK_TOP - 4, STA_W - 32, cMT[4])
  hline(day, 16, DECK_TOP - 5, STA_W - 32, cMT[2])

  // ---- roof posts ----
  for (const x of [8, 44, 78, 110, 144, 178]) postG(day, x, ROOF_BOT, 5, DECK_TOP - ROOF_BOT)

  // ---- canopy: a striped fairground roof with a scalloped valance ----
  for (let y = ROOF_TOP; y < ROOF_BOT; y++) {
    const inset = Math.round((y - ROOF_TOP) * 0.15)
    for (let x = 2 + inset; x < STA_W - 2 - inset; x++) {
      const stripe = Math.floor(x / 12) % 2 === 0
      const t = (y - ROOF_TOP) / (ROOF_BOT - ROOF_TOP)
      put(day, x, y, stripe ? cRE[Math.round(4 - t * 1.2)] : cCR[Math.round(5 - t * 1.2)])
    }
  }
  hline(day, 2, ROOF_TOP, STA_W - 4, cCR[6])
  rect(day, 2, ROOF_BOT - 2, STA_W - 4, 2, cWD[2])
  // valance scallops
  for (let x = 2; x < STA_W - 2; x += 8) {
    disc(day, x + 4, ROOF_BOT, 4, Math.floor(x / 8) % 2 === 0 ? cRE[3] : cCR[4])
    put(day, x + 3, ROOF_BOT + 1, cCR[6])
  }
  hline(day, 2, ROOF_BOT + 4, STA_W - 4, cWD[1])

  // ---- the sign: CAREER COASTER ----
  const text = 'CAREER COASTER'
  const width = text.length * 8
  const sx = Math.round((STA_W - width) / 2)
  rect(day, sx - 8, SIGN_Y, width + 16, SIGN_H, cWD[3])
  hline(day, sx - 8, SIGN_Y, width + 16, cWD[6])
  rect(day, sx - 5, SIGN_Y + 3, width + 10, SIGN_H - 6, cIK[3])
  letters(day, sx, SIGN_Y + 8, text, cYW[6], 2, cYW[2])
  // bulbs round the board
  for (let x = sx - 7; x < sx + width + 8; x += 7) {
    put(day, x, SIGN_Y + 1, cCR[5])
    put(day, x, SIGN_Y + SIGN_H - 2, cCR[5])
  }
  // sign legs down to the canopy
  postG(day, sx + 4, SIGN_Y + SIGN_H, 4, ROOF_TOP - SIGN_Y - SIGN_H + 2)
  postG(day, sx + width - 8, SIGN_Y + SIGN_H, 4, ROOF_TOP - SIGN_Y - SIGN_H + 2)

  // ---- queue rail, standing on the apron in front of the platform ----
  for (const x of [12, 36, 60]) {
    vline(day, x, 100, 22, cMT[3])
    vline(day, x - 1, 100, 22, cMT[5])
    disc(day, x, 99, 2, cMT[5])
    put(day, x - 1, 98, cMT[6])
  }
  for (const y of [104, 113]) {
    hline(day, 11, y, 51, cMT[5])
    hline(day, 11, y + 1, 51, cMT[3])
    hline(day, 11, y + 2, 51, cMT[1])
  }

  /* ---------------- night ---------------- */
  // the sign lit, letter by letter
  letters(night, sx, SIGN_Y + 8, text, 'y', 2)
  haloG(night, sx - 6, SIGN_Y + 4, width + 12, SIGN_H - 8, '~', 6)
  for (let x = sx - 7; x < sx + width + 8; x += 7) {
    put(night, x, SIGN_Y + 1, 'H')
    put(night, x, SIGN_Y + SIGN_H - 2, 'H')
    haloG(night, x, SIGN_Y + 1, 1, 1, '-', 3)
    haloG(night, x, SIGN_Y + SIGN_H - 2, 1, 1, '-', 3)
  }
  // valance bulbs
  for (let x = 4; x < STA_W - 4; x += 8) {
    put(night, x, ROOF_BOT + 2, 'Y')
    put(night, x + 1, ROOF_BOT + 2, 'Y')
    haloG(night, x, ROOF_BOT + 2, 2, 1, '-', 4)
  }
  // warm light spilling under the roof onto the platform
  for (let y = ROOF_BOT + 4; y < DECK_TOP; y++)
    for (let x = 18; x < STA_W - 18; x++) if ((x + y) % 2 === 0) putSoft(night, x, y, '-')
  rect(night, 16, DECK_TOP - 12, STA_W - 32, 3, '~')

  return { day, night }
}

/* ------------------------------------------------------------------ *
 * coaster_cart_0 / _1 — 48x32, the hero riding
 * ------------------------------------------------------------------ */

const CART_W = 48
const CART_H = 32
/** Wheels rest on this row; the sprite anchor sits here so the cart rides the rail. */
const RAIL_ROW = 28

function buildCart(frame: 0 | 1): G {
  const g = grid(CART_W, CART_H)
  const blown = frame === 1

  // ---- wheels: two bogies, spokes turned a step on frame 1 ----
  for (const wx of [14, 34]) {
    disc(g, wx, RAIL_ROW - 3, 3.6, cMT[2])
    disc(g, wx, RAIL_ROW - 3, 2.4, cMT[4])
    put(g, wx - 1, RAIL_ROW - 4, cMT[6])
    const a0 = blown ? Math.PI / 4 : 0
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2
      lineG(g, wx, RAIL_ROW - 3, wx + Math.cos(a) * 3, RAIL_ROW - 3 + Math.sin(a) * 3, cMT[1])
    }
    put(g, wx, RAIL_ROW - 3, cMT[5])
  }
  rect(g, 10, RAIL_ROW - 8, 28, 4, cMT[3])
  hline(g, 10, RAIL_ROW - 8, 28, cMT[5])
  hline(g, 10, RAIL_ROW - 5, 28, cMT[1])

  // ---- body: a teal bathtub car with a gold flash, nose to the right ----
  for (let y = 13; y <= 21; y++) {
    const t = (y - 13) / 8
    const x0 = 6 + Math.round(t * 2)
    const x1 = 42 - Math.round(t * t * 3)
    const nose = y > 17 ? Math.round((y - 17) * 1.1) : 0
    rect(g, x0, y, x1 - x0 + 1 - nose, 1, cTL[Math.round(4 - t * 1.3)])
    put(g, x0, y, cTL[5])
  }
  hline(g, 6, 13, 36, cTL[6])
  // gold flash and cream stripe
  hline(g, 8, 17, 32, cCR[5])
  hline(g, 8, 18, 32, cYW[4])
  for (let x = 36; x <= 42; x++) put(g, x, 15, cYW[5])
  // the nose cone
  for (let y = 14; y <= 20; y++) {
    const w = Math.round(3 - Math.abs(y - 17) * 0.4)
    for (let k = 0; k <= w; k++) put(g, 42 + k, y, cTL[Math.max(1, 3 - k)])
  }
  hline(g, 6, 21, 36, cTL[1])

  // ---- seats: two backs, the rear one empty ----
  rect(g, 9, 8, 8, 6, cIK[4])
  hline(g, 9, 8, 8, cIK[6])
  rect(g, 22, 8, 8, 6, cIK[4])
  hline(g, 22, 8, 8, cIK[6])

  // ---- the hero, front seat ----
  const hx = 31
  disc(g, hx, 9, 4, cSK[5])
  rect(g, hx - 4, 5, 9, 4, cHR[2])
  put(g, hx - 4, 5, cHR[4])
  put(g, hx + 4, 6, cHR[1])
  disc(g, hx - 3, 8, 1.4, cHR[2])
  hline(g, hx - 2, 7, 6, cHR[3]) // fringe over the brow
  put(g, hx + 2, 9, cIK[2]) // eye
  put(g, hx + 2, 10, cIK[3])
  put(g, hx + 4, 10, cSK[3]) // nose shade
  put(g, hx + 1, 12, cSK[3])
  put(g, hx - 2, 8, cSK[6])
  // hair streaming backwards on the second frame
  if (blown) for (let k = 0; k < 6; k++) put(g, hx - 5 - k, 5 + Math.round(Math.sin(k * 0.9) * 1.4), cHR[Math.max(1, 3 - (k % 2))])
  // coral shirt
  rect(g, hx - 4, 12, 9, 4, cRE[4])
  hline(g, hx - 4, 12, 9, cRE[5])
  put(g, hx + 4, 15, cRE[2])
  // arms: on the bar, or thrown up
  if (blown) {
    for (let k = 0; k < 6; k++) {
      put(g, hx - 5, 12 - k, cRE[3])
      put(g, hx + 5, 12 - k, cRE[3])
    }
    disc(g, hx - 5, 5, 1.3, cSK[5])
    disc(g, hx + 5, 5, 1.3, cSK[5])
  } else {
    rect(g, hx - 5, 13, 3, 3, cRE[3])
    rect(g, hx + 3, 13, 3, 3, cRE[3])
    put(g, hx - 5, 15, cSK[4])
    put(g, hx + 5, 15, cSK[4])
  }
  // lap bar
  hline(g, hx - 6, 14, 13, cMT[5])
  hline(g, hx - 6, 15, 13, cMT[2])
  vline(g, hx - 6, 14, 3, cMT[3])
  vline(g, hx + 6, 14, 3, cMT[3])

  return g
}

/* ------------------------------------------------------------------ *
 * ferris_wheel — 256x320 base, hub at (128,128); the rim is its own def
 * ------------------------------------------------------------------ */

const FW_W = 256
const FW_H = 320
const HUB_X = 128
const HUB_Y = 128

function paintFerrisBase(r: Raster): void {
  // ---- concrete pad ----
  for (let y = 296; y < FW_H; y++)
    for (let x = 14; x < FW_W - 14; x++) {
      const t = (y - 296) / (FW_H - 296)
      const n = noise(x, y, 9)
      px(r, x, y, tone(STONE, 4.4 - t * 1.8 + (n > 0.78 ? 0.8 : 0)))
    }
  box(r, 14, 296, FW_W - 28, 1, tone(STONE, 6))
  box(r, 14, FW_H - 1, FW_W - 28, 1, tone(STONE, 1.6))

  // ---- the back pair of the A-frame, one value darker so depth reads ----
  bar(r, 74, 300, HUB_X - 3, HUB_Y + 6, 3.5, METAL, 2.2)
  bar(r, 182, 300, HUB_X + 3, HUB_Y + 6, 3.5, METAL, 2.2)
  // ---- the front pair ----
  bar(r, 40, 302, HUB_X - 8, HUB_Y + 8, 4.5, METAL, 4)
  bar(r, 216, 302, HUB_X + 8, HUB_Y + 8, 4.5, METAL, 4)

  // ---- lacing between the legs ----
  for (let k = 1; k <= 5; k++) {
    const t = k / 6
    const yA = 302 - t * (302 - HUB_Y - 8)
    const lx = 40 + t * (HUB_X - 8 - 40)
    const rx = 216 - t * (216 - HUB_X - 8)
    bar(r, lx, yA, rx, yA, 1.2, METAL, 3)
    if (k < 5) {
      const t2 = (k + 1) / 6
      const yB = 302 - t2 * (302 - HUB_Y - 8)
      const lx2 = 40 + t2 * (HUB_X - 8 - 40)
      const rx2 = 216 - t2 * (216 - HUB_X - 8)
      bar(r, lx, yA, rx2, yB, 1, METAL, 2.6)
      bar(r, rx, yA, lx2, yB, 1, METAL, 2.6)
    }
  }

  // ---- footings ----
  for (const fx of [40, 74, 182, 216]) {
    slab(r, fx - 11, 292, 22, 12, STONE, 4)
    box(r, fx - 11, 292, 22, 1, tone(STONE, 6))
  }

  // ---- the operator's booth, tucked under the left leg ----
  slab(r, 22, 250, 62, 52, WOOD, 4)
  for (let x = 24; x < 82; x += 8) box(r, x, 252, 1, 48, tone(WOOD, 2))
  slab(r, 28, 260, 28, 24, WOOD, 2.6)
  box(r, 30, 262, 24, 20, 'glass5')
  box(r, 30, 262, 24, 1, 'glass6')
  box(r, 30, 262, 1, 20, 'glass6')
  box(r, 48, 276, 6, 6, 'glass3')
  // striped awning
  for (let x = 18; x < 90; x++) box(r, x, 244, 1, 7, Math.floor((x - 18) / 9) % 2 === 0 ? 'red4' : 'cream5')
  box(r, 18, 244, 72, 1, 'cream6')
  box(r, 18, 250, 72, 1, tone(WOOD, 2))
  // a step up to the door
  slab(r, 60, 288, 22, 14, WOOD, 3)

  // ---- hub: the axle the rim turns on ----
  orb(r, HUB_X, HUB_Y, 22, 22, METAL, 3.4, 1.6)
  orb(r, HUB_X, HUB_Y, 15, 15, METAL, 2.4, 1.8)
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) px(r, HUB_X + Math.cos(a) * 18, HUB_Y + Math.sin(a) * 18, tone(METAL, 5))
  orb(r, HUB_X, HUB_Y, 7, 7, BRASS, 3.6, 1.5)
  px(r, HUB_X - 3, HUB_Y - 3, 'yellow7')
  // the A-frame's collar
  bar(r, HUB_X - 24, HUB_Y + 16, HUB_X + 24, HUB_Y + 16, 3, METAL, 4)
}

function paintFerrisNight(r: Raster): void {
  // bulbs racing up both legs
  for (let k = 0; k <= 12; k++) {
    const t = k / 12
    for (const [x0, x1] of [
      [40, HUB_X - 8],
      [216, HUB_X + 8],
    ]) {
      const x = x0 + (x1 - x0) * t
      const y = 302 - t * (302 - HUB_Y - 8)
      halo(r, x, y, 9, 'glowWarm', 92)
      box(r, Math.round(x) - 1, Math.round(y) - 1, 2, 2, 'windowNight')
    }
  }
  // the hub ring
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const x = HUB_X + Math.cos(a) * 19
    const y = HUB_Y + Math.sin(a) * 19
    halo(r, x, y, 8, 'teal6', 96)
    box(r, Math.round(x) - 1, Math.round(y) - 1, 2, 2, 'tealLight')
  }
  halo(r, HUB_X, HUB_Y, 26, 'glowWarm', 70)
  // the booth window and its awning bulbs
  halo(r, 42, 272, 22, 'yellow6', 130)
  box(r, 30, 262, 24, 20, 'windowNight')
  for (let x = 22; x < 88; x += 9) {
    box(r, x, 251, 2, 2, 'windowNight')
    halo(r, x + 1, 252, 7, 'glowWarm', 86)
  }
}

/* ------------------------------------------------------------------ *
 * ferris_rim_0..3 — 224x224, the wheel itself, four rotations
 * ------------------------------------------------------------------ */

const RIM_W = 224
const RIM_C = 112
const RIM_R = 104
const RIM_INNER = 92
const CAR_R = 84
const CARS = 8

/** One gondola, always hanging straight down however far the wheel has turned. */
function gondola(r: Raster, x: number, y: number, i: number): void {
  const ramp = FAIR[i % FAIR.length]
  const style = i % 3
  // hanger
  bar(r, x, y, x, y + 6, 1.2, METAL, 4)
  px(r, x, y, tone(METAL, 6))
  // canopy — three shapes so the wheel never looks like a stamp repeated
  if (style === 0) for (let k = 0; k < 5; k++) box(r, x - 9 + k, y + 6 - k, 19 - 2 * k, 1, tone(ramp, 4 - k * 0.4))
  else if (style === 1) {
    box(r, x - 10, y + 3, 21, 4, tone(ramp, 4))
    box(r, x - 10, y + 3, 21, 1, tone(ramp, 5.4))
  } else
    for (let k = -10; k <= 10; k += 4) {
      box(r, x + k, y + 4, 4, 3, tone(ramp, 4))
      px(r, x + k, y + 4, tone(ramp, 5.4))
    }
  // the tub
  for (let yy = 0; yy < 13; yy++) {
    const t = yy / 12
    const half = Math.round(9 - t * t * 3)
    for (let xx = -half; xx <= half; xx++) px(r, x + xx, y + 7 + yy, tone(ramp, 3.6 - t * 1.1 + (xx < -half + 2 ? 1.4 : xx > half - 2 ? -1 : 0)))
  }
  box(r, x - 9, y + 8, 19, 1, tone(ramp, 5.2))
  box(r, x - 7, y + 12, 15, 1, tone(CREAM, 4))
  box(r, x - 9, y + 19, 19, 1, tone(ramp, 1.6))
}

function paintRim(step: number): (r: Raster) => void {
  const rot = (step * 22.5 * Math.PI) / 180
  return (r: Raster) => {
    // ---- the rim: two hoops laced together ----
    for (let a = 0; a < Math.PI * 2; a += 0.0035) {
      const c = Math.cos(a)
      const s = Math.sin(a)
      const lit = -c * 0.5 - s * 0.86
      for (let k = 0; k < 3; k++) {
        px(r, RIM_C + c * (RIM_R - k), RIM_C + s * (RIM_R - k), tone(METAL, 3.6 + lit * 1.5 - k * 0.4))
        px(r, RIM_C + c * (RIM_INNER + k), RIM_C + s * (RIM_INNER + k), tone(METAL, 3.2 + lit * 1.3 - k * 0.4))
      }
    }
    // lacing between the hoops, turning with the wheel
    for (let k = 0; k < 48; k++) {
      const a = rot + (k * Math.PI * 2) / 48
      const b = rot + ((k + 1) * Math.PI * 2) / 48
      bar(r, RIM_C + Math.cos(a) * RIM_INNER, RIM_C + Math.sin(a) * RIM_INNER, RIM_C + Math.cos(b) * RIM_R, RIM_C + Math.sin(b) * RIM_R, 0.6, METAL, 2.8)
    }

    // ---- spokes: alternating heavy/light, so a 45 degree turn never repeats ----
    for (let k = 0; k < CARS; k++) {
      const a = rot + (k * Math.PI * 2) / CARS
      const ex = RIM_C + Math.cos(a) * RIM_INNER
      const ey = RIM_C + Math.sin(a) * RIM_INNER
      const heavy = k % 2 === 0
      bar(r, RIM_C + Math.cos(a) * 14, RIM_C + Math.sin(a) * 14, ex, ey, heavy ? 1.8 : 0.9, METAL, heavy ? 4 : 3)
      if (heavy) {
        // a mid-span cross-tie only on the heavy spokes
        const mx = RIM_C + Math.cos(a) * 52
        const my = RIM_C + Math.sin(a) * 52
        bar(r, mx - Math.sin(a) * 7, my + Math.cos(a) * 7, mx + Math.sin(a) * 7, my - Math.cos(a) * 7, 1, METAL, 4.6)
      }
      // a tension cable between neighbouring spokes
      const b = rot + ((k + 1) * Math.PI * 2) / CARS
      bar(r, RIM_C + Math.cos(a) * 20, RIM_C + Math.sin(a) * 20, RIM_C + Math.cos(b) * RIM_INNER, RIM_C + Math.sin(b) * RIM_INNER, 0.5, METAL, 2.6)
    }

    // ---- hub ----
    orb(r, RIM_C, RIM_C, 16, 16, METAL, 3.6, 1.6)
    orb(r, RIM_C, RIM_C, 9, 9, BRASS, 3.6, 1.5)
    px(r, RIM_C - 4, RIM_C - 4, 'yellow7')

    // ---- gondolas, hanging from the rim ----
    for (let k = 0; k < CARS; k++) {
      const a = rot + (k * Math.PI * 2) / CARS
      gondola(r, Math.round(RIM_C + Math.cos(a) * CAR_R), Math.round(RIM_C + Math.sin(a) * CAR_R), k)
    }
  }
}

/* ------------------------------------------------------------------ *
 * defs
 * ------------------------------------------------------------------ */

const defs: SpriteDef[] = []

for (let i = 0; i < SPAN_COUNT; i++) {
  defs.push({ name: `coaster_span_${i}`, w: SPAN_W, h: SPAN_H, legend: {}, paint: paintSpan(i), anchor: [0, SPAN_H] })
  defs.push({ name: `coaster_span_${i}_night`, w: SPAN_W, h: SPAN_H, legend: {}, paint: paintSpanNight(i), anchor: [0, SPAN_H] })
}

const station = buildStation()
defs.push({ name: 'coaster_station', rows: toRows(station.day), legend: L, outline: 'outline', anchor: [STA_W / 2, STA_H] })
defs.push({ name: 'coaster_station_night', rows: toRows(station.night), legend: NL, anchor: [STA_W / 2, STA_H] })

for (const f of [0, 1] as const)
  defs.push({ name: `coaster_cart_${f}`, rows: toRows(buildCart(f)), legend: L, outline: 'outline', anchor: [CART_W / 2, RAIL_ROW] })

defs.push({ name: 'ferris_wheel', w: FW_W, h: FW_H, legend: {}, paint: paintFerrisBase, anchor: [FW_W / 2, FW_H] })
defs.push({ name: 'ferris_wheel_night', w: FW_W, h: FW_H, legend: {}, paint: paintFerrisNight, anchor: [FW_W / 2, FW_H] })

for (let i = 0; i < 4; i++)
  defs.push({ name: `ferris_rim_${i}`, w: RIM_W, h: RIM_W, legend: {}, paint: paintRim(i), anchor: [RIM_C, RIM_C] })

export const RIDE_DEFS: SpriteDef[] = defs
