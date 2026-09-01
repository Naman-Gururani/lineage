// The nine landmark buildings (plus night overlays, chimney smoke and the warm
// door glow), redrawn for the 32px HD tile. Each façade is authored as a char
// grid composed by tiny drawing helpers and exported as ASCII rows through a
// shared legend that carries ONE CHAR PER PALETTE RAMP STEP — so a wall is
// modelled with three or four adjacent values instead of one flat fill.
//
// House rules (art-direction §Non-negotiables):
//  · light from the top-left: every roof gets one strong lit plane on its left
//    third, every wall a 1px catch-light on its left return and a darker step
//    down its right return;
//  · material texture at LOW contrast — brick courses / plank seams every 4–6px
//    using neighbouring ramp steps, never a jump of three;
//  · 1px outer outline via `outline: 'outline'`; interior detail is separated by
//    value, not by lines;
//  · night overlays are separate defs at the same size and anchor, carrying only
//    lit panes and soft rgba halos.
// Anchors sit at bottom-centre of the footprint.
import type { PalKey } from '../palette'
import type { Legend, SpriteDef } from '../pixel'
import { K, paintDot } from '../procedural'
import { setPx } from '../raster'

/* ---------------- legend: one char per ramp step ---------------- */

// Char pool: printable ASCII (minus '.' and ' ', which mean transparent) then
// Latin Extended-A code points. The drawing code never spells a char literally
// — it says `WD[5]` (wood ramp, step 5) — so the pool only has to be
// collision-free, not memorable.
const POOL =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '!"#$%&\'()*+,-/:;<=>?@[]^_`{|}~' +
  Array.from({ length: 96 }, (_, i) => String.fromCharCode(0x100 + i)).join('')

const L: Legend = {}
let cursor = 0
const claim = (v: PalKey): string => {
  const ch = POOL[cursor++]
  L[ch] = v
  return ch
}
/** Reserve one char per step of `family1..familyN`; returns a 1-based lookup. */
const ramp = (family: string, n: number): string[] => {
  const out = ['']
  for (let i = 1; i <= n; i++) out.push(claim(`${family}${i}` as PalKey))
  return out
}

const IK = ramp('ink', 6)
const GY = ramp('grey', 6)
const CR = ramp('cream', 6)
const WL = ramp('wall', 6)
const WD = ramp('wood', 7)
const BK = ramp('brick', 7)
const ST = ramp('stone', 7)
const MT = ramp('metal', 6)
const GS = ramp('glass', 6)
const RR = ramp('roofRed', 6)
const RG = ramp('roofGreen', 6)
const RB = ramp('roofBlue', 6)
const LF = ramp('leaf', 6)
const YW = ramp('yellow', 7)
const TL = ramp('teal', 7)
const RE = ramp('red', 6)
const OR = ramp('orange', 6)
const PU = ramp('purple', 6)
const BU = ramp('blue', 6)
const PN = ramp('pink', 6)
const OUT = claim('outline')

// night-overlay legend: lit panes + soft rgba halos (no outline on overlays)
const NL: Legend = {
  y: 'windowNight',
  Y: 'yellow5',
  H: 'glowWarm',
  o: 'orange4',
  t: 'teal4',
  j: 'teal6',
  h: 'glow',
  u: 'purple4',
  U: 'purple3',
  d: 'red4',
  '~': 'rgba(255,214,120,0.30)',
  '-': 'rgba(255,214,120,0.15)',
  '^': 'rgba(64,220,200,0.28)',
  '*': 'rgba(170,120,255,0.30)',
}

/* ---------------- char-grid helpers ---------------- */

type G = { w: number; h: number; c: string[][] }

const grid = (w: number, h: number): G => ({ w, h, c: Array.from({ length: h }, () => Array<string>(w).fill('.')) })
const put = (g: G, x: number, y: number, ch: string): void => {
  if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.c[y][x] = ch
}
/** put only into empty cells (used for soft halos so they never cover lit panes) */
const putSoft = (g: G, x: number, y: number, ch: string): void => {
  if (x >= 0 && y >= 0 && x < g.w && y < g.h && g.c[y][x] === '.') g.c[y][x] = ch
}
const rect = (g: G, x: number, y: number, w: number, h: number, ch: string): void => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(g, xx, yy, ch)
}
const hline = (g: G, x: number, y: number, w: number, ch: string): void => rect(g, x, y, w, 1, ch)
const vline = (g: G, x: number, y: number, h: number, ch: string): void => rect(g, x, y, 1, h, ch)
/** tiny literal motifs; `map` turns the sketch chars into legend chars */
const stamp = (g: G, x: number, y: number, art: string[], map: Record<string, string>): void => {
  for (let yy = 0; yy < art.length; yy++)
    for (let xx = 0; xx < art[yy].length; xx++) {
      const c = art[yy][xx]
      if (c === '.' || !map[c]) continue
      put(g, x + xx, y + yy, map[c])
    }
}
const disc = (g: G, cx: number, cy: number, rad: number, ch: string): void => {
  for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
    for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++)
      if (Math.hypot(xx - cx, yy - cy) <= rad + 0.4) put(g, xx, yy, ch)
}
/** filled disc with a one-ramp-step AA rim (art-direction §4) */
const discAA = (g: G, cx: number, cy: number, rad: number, fill: string, edge: string): void => {
  for (let yy = Math.floor(cy - rad - 1); yy <= Math.ceil(cy + rad + 1); yy++)
    for (let xx = Math.floor(cx - rad - 1); xx <= Math.ceil(cx + rad + 1); xx++) {
      const d = Math.hypot(xx - cx, yy - cy)
      if (d <= rad - 0.7) put(g, xx, yy, fill)
      else if (d <= rad + 0.4) put(g, xx, yy, edge)
    }
}
const softDisc = (g: G, cx: number, cy: number, rad: number, ch: string): void => {
  for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
    for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++)
      if (Math.hypot(xx - cx, yy - cy) <= rad + 0.4) putSoft(g, xx, yy, ch)
}
const ring = (g: G, cx: number, cy: number, rad: number, ch: string): void => {
  for (let a = 0; a < Math.PI * 2; a += 0.02) put(g, Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad), ch)
}
/** round-headed opening: semicircular head of radius `hw` above `y0`, shaft to `y1` */
const arched = (g: G, cx: number, y0: number, y1: number, hw: number, ch: string): void => {
  for (let y = y0 - hw; y < y0; y++) {
    const dy = y0 - y
    const w = Math.round(Math.sqrt(Math.max(0, hw * hw - dy * dy)))
    hline(g, cx - w, y, w * 2 + 1, ch)
  }
  rect(g, cx - hw, y0, hw * 2 + 1, y1 - y0 + 1, ch)
}
const toRows = (g: G): string[] => g.c.map((r) => r.join(''))

/* ---------------- material texture ---------------- */

/** Running-bond masonry: field R[4], bed joints and head joints R[3], each
 *  course topped by a R[5] catch-light. Two ramp steps of contrast, no more. */
const bond = (g: G, x: number, y: number, w: number, h: number, R: string[], course = 6, unit = 14): void => {
  rect(g, x, y, w, h, R[4])
  for (let row = 0; row * course < h; row++) {
    const ty = y + row * course
    if (ty < y + h) hline(g, x, ty, w, R[5])
    const by = ty + course - 1
    if (by < y + h) hline(g, x, by, w, R[3])
    const off = (row % 2) * Math.round(unit / 2)
    for (let xx = x + off; xx < x + w; xx += unit)
      for (let yy = ty; yy < Math.min(ty + course - 1, y + h); yy++) put(g, xx, yy, R[3])
  }
}

/** Plaster/render: a flat field with broken trowel courses one step darker. */
const plaster = (g: G, x: number, y: number, w: number, h: number, R: string[], step = 7): void => {
  rect(g, x, y, w, h, R[5])
  for (let yy = y + step; yy < y + h; yy += step)
    for (let xx = x; xx < x + w; xx++) if ((xx + yy) % 3) put(g, xx, yy, R[4])
  vline(g, x, y, h, R[6])
  vline(g, x + 1, y, h, R[6])
  rect(g, x + w - 4, y, 4, h, R[4])
  vline(g, x + w - 1, y, h, R[3])
}

/** Horizontal weathered boarding (barn/warehouse siding). */
const boards = (g: G, x: number, y: number, w: number, h: number, R: string[], pitch = 7): void => {
  for (let row = 0, ty = y; ty < y + h; row++, ty += pitch) {
    const hh = Math.min(pitch, y + h - ty)
    rect(g, x, ty, w, hh, [R[4], R[5], R[4], R[3]][row % 4])
    hline(g, x, ty, w, R[5])
    if (ty + hh - 1 < y + h) hline(g, x, ty + hh - 1, w, R[2])
    for (let xx = x + ((row * 5) % 13); xx < x + w - 4; xx += 19) hline(g, xx, ty + 2, 5, R[3])
  }
}

/** Vertical plank cladding. */
const planks = (g: G, x: number, y: number, w: number, h: number, R: string[], pitch = 8): void => {
  for (let i = 0, px = x; px < x + w; i++, px += pitch) {
    const pw = Math.min(pitch, x + w - px)
    rect(g, px, y, pw, h, [R[4], R[5], R[4], R[3]][i % 4])
    vline(g, px, y, h, R[2])
    if (pw > 1) vline(g, px + 1, y, h, R[5])
  }
}

/** Tiled roof plane: one lit top-left wedge, courses every `course` rows and a
 *  sparse 2×1 dither along the ridge. `edge(y)` returns [x0,x1] for the row. */
const tileRoof = (
  g: G,
  y0: number,
  y1: number,
  edge: (y: number) => [number, number],
  R: string[],
  course = 7,
): void => {
  const span = Math.max(1, y1 - y0)
  const ridgeBand = Math.min(9, Math.round(span * 0.35))
  for (let y = y0; y <= y1; y++) {
    const [x0, x1] = edge(y)
    if (x1 < x0) continue
    const w = x1 - x0 + 1
    const t = (y - y0) / span
    const lit = Math.max(2, Math.round(w * (0.38 - 0.16 * t)))
    const dark = Math.max(2, Math.round(w * 0.12))
    const isCourse = (y - y0) % course === course - 1
    for (let x = x0; x <= x1; x++) {
      const i = x - x0
      let c = R[4]
      if (i < lit) c = R[5]
      if (i < Math.max(1, lit >> 2)) c = R[6]
      if (i > w - 1 - dark) c = R[3]
      if (isCourse && (x + y) % 5) c = i < lit ? R[4] : R[3]
      if (y - y0 < ridgeBand && i > 1 && i < w - 2 && (x * 3 + y * 5) % 11 === 0) c = i < lit ? R[5] : R[4]
      if (x === x1) c = R[2]
      put(g, x, y, c)
    }
  }
}

/** Ivy: a mass clinging to a corner, ragged silhouette, holes letting the wall
 *  show through, a few tendrils climbing past the top. Lit from the top-left. */
const ivy = (g: G, x: number, y: number, w: number, h: number, seed: number): void => {
  /** one leaf cluster, shaded by its own top-left normal (never a global ramp) */
  const clump = (cx: number, cy: number, rad: number): void => {
    for (let yy = cy - rad; yy <= cy + rad; yy++)
      for (let xx = cx - rad; xx <= cx + rad; xx++) {
        if (xx < x - 3 || xx >= x + w || yy >= y + h) continue
        const m = (xx * 37 + yy * 53 + seed * 11) % 11
        if (Math.hypot(xx - cx, yy - cy) > rad - (m % 3) * 0.45) continue
        const nd = (cx - xx + (cy - yy) * 1.3) / rad
        put(g, xx, yy, nd > 0.5 ? LF[5] : nd > 0.05 ? (m < 5 ? LF[4] : LF[3]) : nd < -0.5 ? LF[2] : LF[3])
      }
  }
  // three vines climbing the corner, the leftmost reaching highest
  for (let s = 0; s < 3; s++) {
    const top = y + Math.round(h * s * 0.3) - (s === 0 ? 9 : 0)
    let vx = x + 3 + s * (w / 3.4)
    for (let yy = y + h - 1; yy >= top; yy--) {
      vx += Math.sin((yy + seed * 5 + s * 40) * 0.11) * 0.55
      const px = Math.round(vx)
      put(g, px, yy, (yy + s) % 3 ? LF[2] : LF[3])
      const n = (px * 31 + yy * 17 + seed * 97 + s * 53) % 100
      if (n < 42) clump(px + ((n % 7) - 3), yy, 3 + (n % 4))
    }
  }
  // tendrils feeling their way past the top of the mass
  for (let k = 0; k < 4; k++) {
    const tx = x + 2 + ((k * 9 + seed * 3) % Math.max(1, w - 8))
    for (let t = 0; t < 7 + ((k * 5) % 10); t++) {
      const px = tx + Math.round(Math.sin(t * 0.42 + k) * 3)
      put(g, px, y - t, t % 3 ? LF[3] : LF[5])
      if (t % 4 === 1) put(g, px + 1, y - t, LF[4])
    }
  }
}

/* ---------------- def plumbing ---------------- */

const defs: SpriteDef[] = []

/** push a building + its night overlay (same size, same anchor, no outline) */
const push = (name: string, day: G, night?: G): void => {
  defs.push({ name, rows: toRows(day), legend: L, outline: 'outline', anchor: [day.w / 2, day.h] })
  if (night) defs.push({ name: name + '_night', rows: toRows(night), legend: NL, anchor: [day.w / 2, day.h] })
}

/* ---------------- shared façade pieces ---------------- */

/** soft warm halo around a lit rectangle (night grids only) */
const halo = (night: G, x: number, y: number, w: number, h: number, ch = '~', pad = 4): void => {
  for (let yy = y - pad; yy < y + h + pad; yy++)
    for (let xx = x - pad; xx < x + w + pad; xx++) {
      if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue
      const d = Math.abs(xx - (x + w / 2)) / (w / 2 + pad) + Math.abs(yy - (y + h / 2)) / (h / 2 + pad)
      if (d < 2) putSoft(night, xx, yy, ch)
    }
}

type WinOpt = { frame?: string; shade?: string; sill?: boolean }

/** Cottage/clinic window: timber frame, sky glass with a raking reflection,
 *  cross mullion, sill board; lit warm at night. */
const cozyWindow = (day: G, night: G, x: number, y: number, w: number, h: number, o: WinOpt = {}): void => {
  const frame = o.frame ?? WD[2]
  const shade = o.shade ?? WL[3]
  rect(day, x, y, w, h, frame)
  hline(day, x, y, w, WD[3])
  rect(day, x + 2, y + 2, w - 4, h - 4, GS[3])
  rect(day, x + 2, y + 2, w - 4, Math.round((h - 4) / 2), GS[4])
  hline(day, x + 2, y + 2, w - 4, GS[6])
  vline(day, x + 2, y + 3, h - 6, GS[5])
  for (let i = 0; i < Math.min(w, h) - 7; i++) put(day, x + 3 + i, y + h - 4 - i, GS[6])
  const mx = x + (w >> 1) - 1
  const my = y + (h >> 1) - 1
  vline(day, mx, y + 1, h - 2, frame)
  vline(day, mx + 1, y + 1, h - 2, WD[3])
  hline(day, x + 1, my, w - 2, frame)
  hline(day, x + 1, my + 1, w - 2, WD[3])
  if (o.sill !== false) {
    hline(day, x - 2, y + h, w + 4, WD[3])
    hline(day, x - 2, y + h + 1, w + 4, WD[2])
    hline(day, x - 1, y + h + 2, w + 2, shade)
  }
  // night: warm panes, hot centre, mullion silhouette, halo
  rect(night, x + 2, y + 2, w - 4, h - 4, 'y')
  rect(night, x + 4, y + 4, w - 8, h - 8, 'H')
  vline(night, mx, y + 2, h - 4, 'Y')
  vline(night, mx + 1, y + 2, h - 4, 'Y')
  hline(night, x + 2, my, w - 4, 'Y')
  hline(night, x + 2, my + 1, w - 4, 'Y')
  halo(night, x, y, w, h)
}

/** Corporate glass pane: dark mullion frame, sky-to-shade gradient, horizon streak. */
const glassPane = (day: G, night: G, x: number, y: number, w: number, h: number, lit: boolean): void => {
  rect(day, x, y, w, h, MT[2])
  hline(day, x, y, w, MT[3])
  rect(day, x + 2, y + 2, w - 4, h - 4, GS[3])
  rect(day, x + 2, y + 2, w - 4, Math.round((h - 4) * 0.42), GS[4])
  hline(day, x + 2, y + 2, w - 4, GS[6])
  vline(day, x + 2, y + 3, Math.round(h * 0.35), GS[5])
  hline(day, x + 3, y + Math.round(h * 0.44), w - 6, GS[5])
  rect(day, x + 2, y + h - 6, w - 4, 4, GS[2])
  hline(day, x, y + h - 1, w, MT[1])
  if (!lit) return
  rect(night, x + 2, y + 2, w - 4, h - 4, 'y')
  rect(night, x + 4, y + 4, w - 8, h - 9, 'H')
  halo(night, x, y, w, h, '-', 3)
}

/** flower box with leaf tufts and blooms, sitting under a window */
const flowerBox = (day: G, x: number, y: number, w: number): void => {
  rect(day, x, y, w, 4, WD[4])
  hline(day, x, y, w, WD[6])
  hline(day, x, y + 3, w, WD[2])
  vline(day, x, y, 4, WD[5])
  vline(day, x + w - 1, y, 4, WD[2])
  for (let i = 1; i < w - 1; i++) {
    put(day, x + i, y - 1, i % 3 ? LF[4] : LF[3])
    if (i % 4 === 2) put(day, x + i, y - 2, LF[5])
  }
  for (let i = 2; i < w - 2; i += 5) {
    put(day, x + i, y - 2, i % 2 ? PN[5] : YW[5])
    put(day, x + i + 1, y - 2, i % 2 ? PN[4] : YW[4])
    put(day, x + i, y - 3, i % 2 ? PN[6] : YW[6])
  }
}

/** hanging lantern bracket; glows at night */
const lantern = (day: G, night: G, x: number, y: number): void => {
  hline(day, x - 2, y, 6, MT[2])
  vline(day, x + 3, y, 3, MT[2])
  rect(day, x + 1, y + 3, 5, 6, MT[2])
  rect(day, x + 2, y + 4, 3, 4, YW[5])
  put(day, x + 2, y + 4, YW[7])
  put(day, x + 1, y + 3, MT[4])
  rect(night, x + 2, y + 4, 3, 4, 'H')
  put(night, x + 1, y + 3, 'Y')
  put(night, x + 5, y + 3, 'Y')
  softDisc(night, x + 3, y + 6, 7, '~')
}

/* ================ 1. The Cottage (About) — 160×160 ================ */
{
  const W = 160
  const H = 160
  const day = grid(W, H)
  const night = grid(W, H)

  // plaster walls x12..147, y84..157
  plaster(day, 12, 84, 136, 74, WL)
  // brick plinth under the plaster
  bond(day, 12, 136, 136, 22, BK, 6, 15)
  hline(day, 12, 134, 136, WD[3]) // timber string course over the plinth
  hline(day, 12, 135, 136, WD[2])
  // stone footing + baked ground line
  bond(day, 10, 148, 140, 10, ST, 5, 17)
  hline(day, 10, 157, 140, ST[2])
  hline(day, 12, 158, 136, IK[2])
  hline(day, 14, 159, 132, OUT)

  // half-timbered corner posts + mid rail
  for (const px of [12, 142] as const) {
    rect(day, px, 84, 6, 74, WD[3])
    vline(day, px, 84, 74, WD[5])
    vline(day, px + 5, 84, 74, WD[2])
    for (let y = 90; y < 156; y += 9) hline(day, px + 1, y, 4, WD[2])
  }
  rect(day, 18, 128, 124, 5, WD[3])
  hline(day, 18, 128, 124, WD[5])
  hline(day, 18, 132, 124, WD[2])

  // windows + flower boxes
  cozyWindow(day, night, 28, 100, 24, 22)
  cozyWindow(day, night, 108, 100, 24, 22)
  flowerBox(day, 26, 126, 28)
  flowerBox(day, 106, 126, 28)

  // arched timber door (centre x=80), y116..157
  arched(day, 80, 122, 157, 15, WD[2])
  arched(day, 80, 124, 156, 13, WD[4])
  arched(day, 80, 125, 155, 11, WD[5])
  for (let x = 68; x <= 92; x += 6) vline(day, x, 112, 46, WD[3])
  vline(day, 69, 112, 46, WD[6]) // left plank catch-light
  rect(day, 64, 108, 32, 5, WD[2])
  hline(day, 64, 108, 32, WD[4])
  // iron strap hinges + a warm knob
  for (const hy of [124, 146]) {
    hline(day, 68, hy, 24, MT[2])
    hline(day, 68, hy + 1, 24, MT[3])
  }
  put(day, 88, 136, YW[5])
  put(day, 89, 136, YW[3])
  put(day, 88, 137, YW[3])
  hline(day, 66, 156, 28, WD[1])
  // stone doorstep
  rect(day, 62, 152, 36, 6, ST[4])
  hline(day, 62, 152, 36, ST[6])
  hline(day, 62, 157, 36, ST[2])
  // night: warm light seeping around the door
  hline(night, 68, 154, 24, 'y')
  hline(night, 70, 155, 20, 'H')
  halo(night, 66, 140, 28, 16)

  // heart plaque over the door
  rect(day, 70, 96, 22, 16, CR[5])
  hline(day, 70, 96, 22, CR[6])
  vline(day, 70, 96, 16, CR[6])
  hline(day, 70, 111, 22, CR[3])
  vline(day, 91, 96, 16, CR[3])
  stamp(day, 75, 99, ['.dd.dd.', 'dddddddd', 'dddddddd', '.dddddd.', '..dddd..', '...dd...'], { d: RE[4] })
  stamp(day, 76, 100, ['ff', 'f.'], { f: PN[6] })

  // hipped red-tile roof: ridge y20 → eaves y80
  const eaves = (y: number): [number, number] => {
    const t = (y - 20) / 60
    return [Math.round(60 - 56 * t), Math.round(99 + 56 * t)]
  }
  tileRoof(day, 20, 80, eaves, RR, 6)
  hline(day, 56, 18, 48, RR[3])
  hline(day, 57, 19, 46, RR[5])
  hline(day, 59, 18, 42, RR[6])
  // fascia + eave shadow on the plaster
  hline(day, 3, 81, 154, RR[3])
  hline(day, 3, 82, 154, RR[2])
  hline(day, 4, 83, 152, IK[4])
  rect(day, 12, 84, 136, 3, WL[4])
  hline(day, 12, 84, 136, WL[3])

  // brick chimney through the right slope
  bond(day, 112, 12, 16, 30, BK, 6, 9)
  vline(day, 112, 12, 30, BK[5])
  vline(day, 127, 12, 30, BK[2])
  rect(day, 108, 6, 24, 6, ST[4])
  hline(day, 108, 6, 24, ST[6])
  hline(day, 108, 11, 24, ST[2])
  rect(day, 114, 4, 12, 3, ST[3])
  hline(day, 114, 4, 12, ST[5])

  push('bld_about', day, night)
}

/* ================ 2. Barclays Tower (Experience) — 192×280 ================ */
{
  const W = 192
  const H = 280
  const day = grid(W, H)
  const night = grid(W, H)

  const cols = [30, 58, 86, 114, 142]
  const rowsY = [44, 80, 116, 152, 188]

  // limestone shaft x16..175, y32..277
  rect(day, 16, 32, 160, 246, WL[5])
  for (let y = 36; y < 278; y += 8) for (let x = 16; x < 176; x++) if ((x + y) % 4) put(day, x, y, WL[4])
  // piers between the window columns, modelled left-light / right-shade
  for (const px of [16, 50, 78, 106, 134, 162]) {
    const pw = px === 16 ? 14 : px === 162 ? 14 : 8
    rect(day, px, 32, pw, 246, WL[5])
    vline(day, px, 32, 246, WL[6])
    vline(day, px + 1, 32, 246, WL[6])
    rect(day, px + pw - 3, 32, 3, 246, WL[4])
    vline(day, px + pw - 1, 32, 246, WL[3])
  }
  vline(day, 16, 32, 246, WL[6])
  rect(day, 170, 32, 6, 246, WL[4])
  vline(day, 175, 32, 246, WL[3])
  hline(day, 16, 278, 160, IK[2])
  hline(day, 18, 279, 156, OUT)

  // parapet + rooftop plant block + navy pennant
  rect(day, 12, 24, 168, 8, WL[5])
  hline(day, 12, 24, 168, WL[6])
  hline(day, 12, 25, 168, WL[6])
  hline(day, 12, 30, 168, WL[3])
  hline(day, 12, 31, 168, WL[4])
  rect(day, 60, 12, 72, 12, WL[4])
  hline(day, 60, 12, 72, WL[6])
  rect(day, 124, 14, 8, 10, MT[3])
  vline(day, 136, 2, 22, MT[2])
  vline(day, 137, 2, 22, MT[4])
  rect(day, 138, 2, 24, 10, BU[2])
  hline(day, 138, 2, 24, BU[5])
  rect(day, 141, 5, 4, 4, CR[6])
  rect(day, 147, 5, 4, 4, CR[6])
  rect(day, 153, 5, 4, 4, GS[5])
  // corporate cyan band under the parapet
  rect(day, 16, 34, 160, 4, RB[4])
  hline(day, 16, 34, 160, RB[5])
  hline(day, 16, 37, 160, RB[2])

  // five rows × five columns of blue glass
  const litSet = new Set([0, 2, 3, 6, 9, 11, 12, 15, 17, 20, 22, 24])
  for (let ry = 0; ry < rowsY.length; ry++)
    for (let cx = 0; cx < cols.length; cx++)
      glassPane(day, night, cols[cx], rowsY[ry], 20, 24, litSet.has(ry * 5 + cx))

  // string courses between floors
  for (const fy of [72, 108, 144, 180]) {
    hline(day, 18, fy, 156, WL[6])
    hline(day, 18, fy + 1, 156, WL[4])
    hline(day, 18, fy + 2, 156, WL[3])
  }

  // stone-clad base, two storeys of it
  bond(day, 16, 216, 160, 62, ST, 8, 22)
  vline(day, 16, 216, 62, ST[6])
  rect(day, 170, 216, 6, 62, ST[3])
  hline(day, 14, 212, 164, ST[5])
  rect(day, 14, 213, 164, 3, ST[4])
  hline(day, 14, 215, 164, ST[2])

  // entrance: navy sign, metal canopy, glass double doors (centre x=96)
  rect(day, 84, 218, 58, 14, BU[2])
  hline(day, 84, 218, 58, BU[5])
  vline(day, 84, 218, 14, BU[4])
  hline(day, 84, 231, 58, BU[1])
  for (const [sx, sw] of [[90, 8], [102, 6], [112, 8], [124, 6], [132, 6]] as const) rect(day, sx, 222, sw, 5, CR[6])
  rect(day, 88, 234, 50, 7, MT[3])
  hline(day, 88, 234, 50, MT[5])
  hline(day, 88, 240, 50, MT[1])
  hline(day, 90, 241, 46, IK[3])
  rect(day, 98, 242, 30, 36, MT[2])
  rect(day, 100, 244, 26, 34, GS[3])
  rect(day, 100, 244, 26, 12, GS[4])
  hline(day, 100, 244, 26, GS[6])
  vline(day, 100, 245, 20, GS[5])
  vline(day, 112, 244, 34, MT[2])
  vline(day, 113, 244, 34, MT[3])
  put(day, 108, 262, MT[5])
  put(day, 108, 263, MT[5])
  put(day, 117, 262, MT[5])
  put(day, 117, 263, MT[5])
  rect(day, 100, 272, 26, 6, GS[2])
  // night: lobby glow + sign glow
  rect(night, 100, 244, 26, 34, 'y')
  rect(night, 104, 248, 18, 24, 'H')
  halo(night, 98, 242, 30, 36)
  rect(night, 90, 222, 52, 5, 'H')
  halo(night, 84, 218, 58, 14, '-', 5)

  // ground-floor display windows + planters
  for (const gx of [28, 136] as const) {
    rect(day, gx, 240, 28, 24, MT[2])
    rect(day, gx + 2, 242, 24, 20, GS[3])
    rect(day, gx + 2, 242, 24, 8, GS[4])
    hline(day, gx + 2, 242, 24, GS[6])
    vline(day, gx + 2, 243, 12, GS[5])
    rect(day, gx + 2, 256, 24, 6, RB[3])
    rect(night, gx + 2, 242, 24, 20, 'y')
    rect(night, gx + 6, 246, 16, 12, 'H')
    halo(night, gx, 240, 28, 24, '-', 4)
  }
  // planters
  for (const bx of [22, 132] as const) {
    rect(day, bx, 264, 34, 8, ST[4])
    hline(day, bx, 264, 34, ST[6])
    hline(day, bx, 271, 34, ST[2])
    for (let i = 2; i < 32; i++) put(day, bx + i, 263, i % 3 ? LF[4] : LF[3])
    for (let i = 4; i < 30; i += 5) put(day, bx + i, 262, LF[5])
  }
  hline(day, 16, 277, 160, ST[2])

  push('bld_experience', day, night)
}

/* ================ 3. The Workshop (Skills) — 192×144 ================ */
{
  const W = 192
  const H = 144
  const day = grid(W, H)
  const night = grid(W, H)

  // plank walls x12..179, y46..139
  planks(day, 12, 46, 168, 94, WD, 9)
  for (let y = 57; y < 139; y += 11) hline(day, 12, y, 168, WD[3])
  rect(day, 12, 46, 5, 94, WD[2])
  vline(day, 12, 46, 94, WD[5])
  rect(day, 174, 46, 6, 94, WD[2])
  // stone kick plate + baked ground line
  bond(day, 12, 126, 168, 14, ST, 6, 19)
  hline(day, 12, 125, 168, ST[6])
  hline(day, 12, 139, 168, ST[2])
  hline(day, 12, 140, 168, IK[2])
  hline(day, 14, 141, 164, IK[3])
  hline(day, 16, 142, 160, OUT)
  hline(day, 18, 143, 156, OUT)

  // saltbox terracotta roof: ridge off-centre at x=64, both eaves at y=44
  const edge = (y: number): [number, number] => [
    Math.round(64 - (y - 12) * 1.75),
    Math.round(64 + (y - 12) * 3.8125),
  ]
  tileRoof(day, 12, 44, edge, OR, 6)
  hline(day, 58, 10, 14, OR[3])
  hline(day, 59, 11, 12, OR[5])
  // eave fascia + its shadow on the planks
  hline(day, 5, 45, 184, OR[3])
  hline(day, 4, 46, 186, OR[2])
  hline(day, 5, 47, 184, IK[4])
  rect(day, 12, 48, 168, 3, WD[3])
  hline(day, 12, 48, 168, WD[2])

  // metal flue through the right slope
  rect(day, 148, 16, 9, 32, MT[2])
  vline(day, 148, 16, 32, MT[4])
  vline(day, 149, 16, 32, MT[3])
  vline(day, 156, 16, 32, MT[1])
  rect(day, 145, 13, 15, 4, MT[3])
  hline(day, 145, 13, 15, MT[5])
  rect(day, 144, 9, 17, 4, MT[2])
  hline(day, 144, 9, 17, MT[5])
  for (const cy of [24, 34]) {
    hline(day, 148, cy, 9, MT[4])
    hline(day, 148, cy + 1, 9, MT[1])
  }

  // big braced double door (centre x=112), y84..139
  rect(day, 84, 80, 57, 4, WD[2])
  hline(day, 84, 80, 57, WD[4])
  rect(day, 84, 84, 57, 56, WD[4])
  for (let x = 86; x < 140; x += 7) {
    vline(day, x, 84, 56, WD[3])
    vline(day, x + 1, 84, 56, WD[5])
  }
  vline(day, 84, 84, 56, WD[2])
  vline(day, 140, 84, 56, WD[2])
  vline(day, 111, 84, 56, WD[2])
  vline(day, 112, 84, 56, WD[1])
  vline(day, 113, 84, 56, WD[2])
  for (let i = 0; i < 25; i++) {
    put(day, 86 + i, 88 + i, WD[6])
    put(day, 87 + i, 88 + i, WD[5])
    put(day, 138 - i, 88 + i, WD[6])
    put(day, 137 - i, 88 + i, WD[5])
  }
  hline(day, 84, 84, 57, WD[6])
  hline(day, 84, 138, 57, WD[2])
  hline(day, 84, 139, 57, WD[1])
  rect(day, 105, 108, 4, 5, MT[2])
  rect(day, 116, 108, 4, 5, MT[2])
  put(day, 105, 108, MT[5])
  put(day, 116, 108, MT[5])
  // night: forge light bursting through the seams
  vline(night, 111, 92, 48, 'H')
  vline(night, 112, 92, 48, 'H')
  vline(night, 113, 92, 48, 'Y')
  hline(night, 86, 138, 53, 'y')
  hline(night, 90, 137, 45, 'H')
  halo(night, 86, 116, 53, 24)

  // gear sign on a cream plaque above the door
  discAA(day, 112, 63, 17, CR[3], CR[2])
  discAA(day, 112, 63, 15, CR[5], CR[4])
  discAA(day, 110, 61, 9, CR[6], CR[6])
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + 0.3
    const gx = Math.round(112 + Math.cos(a) * 12)
    const gy = Math.round(63 + Math.sin(a) * 12)
    rect(day, gx - 2, gy - 2, 5, 5, MT[3])
    rect(day, gx - 2, gy - 2, 5, 2, MT[5])
  }
  discAA(day, 112, 63, 10, MT[4], MT[3])
  discAA(day, 110, 61, 8, MT[5], MT[4])
  discAA(day, 112, 63, 6, CR[5], CR[4])
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + 0.4
    for (let t = 3; t <= 9; t++)
      put(day, Math.round(112 + Math.cos(a) * t), Math.round(63 + Math.sin(a) * t), t < 6 ? MT[5] : MT[4])
  }
  discAA(day, 112, 63, 3, MT[3], MT[2])
  put(day, 110, 61, MT[6])

  // anvil on a stump + hammer leaning on the wall
  rect(day, 28, 124, 20, 16, WD[2])
  vline(day, 28, 124, 16, WD[4])
  hline(day, 28, 124, 20, WD[5])
  stamp(day, 20, 106, [
    '.mmmmmmmmmmmmmmmmmmmmmmmm..',
    'MMMMMMMMMMMMMMMMMMMMMMMMMM.',
    'nnnnnnnnnnnnnnnnnnnnnnnnnn.',
    '.nnnnnnnnnnnnnnnnnnnnnnnn..',
    '...nnnnnnnnnnnnnnnnnnnn....',
    '.......nnnnnnnnnnnn........',
    '.......nnnnnnnnnnnn........',
    '.......nnnnnnnnnnnn........',
    '......nnnnnnnnnnnnnn.......',
    '.....nnnnnnnnnnnnnnnn......',
    '....nnnnnnnnnnnnnnnnnn.....',
    '....nnnnnnnnnnnnnnnnnn.....',
  ], { m: MT[5], M: MT[4], n: MT[2] })
  vline(day, 60, 108, 32, WD[4])
  vline(day, 61, 108, 32, WD[6])
  rect(day, 56, 102, 12, 6, MT[2])
  hline(day, 56, 102, 12, MT[5])
  // window over the anvil
  cozyWindow(day, night, 24, 62, 22, 22, { shade: WD[2] })
  // horseshoe charm by the door
  ring(day, 160, 100, 7, MT[2])
  ring(day, 160, 99, 7, MT[4])
  hline(day, 154, 104, 13, '.')
  rect(day, 153, 101, 3, 4, MT[2])
  rect(day, 165, 101, 3, 4, MT[2])

  push('bld_skills', day, night)
}

/* ================ 4. The Engine (Lineage) — 224×176 ================ */
{
  const W = 224
  const H = 176
  const day = grid(W, H)
  const night = grid(W, H)

  // riveted steel body x8..215, y56..174
  rect(day, 8, 56, 208, 119, MT[2])
  rect(day, 8, 56, 208, 5, MT[4])
  hline(day, 8, 56, 208, MT[5])
  hline(day, 8, 61, 208, MT[1])
  vline(day, 8, 56, 119, MT[4])
  vline(day, 9, 56, 119, MT[3])
  rect(day, 209, 56, 7, 119, MT[1])
  // alternating bay faces so the seams read as separate steel panels
  for (const [bx, bw, up] of [[10, 30, 1], [41, 31, 0], [73, 63, 1], [137, 31, 0], [169, 31, 1]] as const) {
    if (!up) continue
    rect(day, bx, 62, bw, 111, MT[3])
    vline(day, bx, 62, 111, MT[4])
  }
  for (let y = 66; y < 174; y += 6) for (let x = 10; x < 209; x++) if ((x * 5 + y) % 7 < 2) put(day, x, y, MT[2])
  hline(day, 8, 173, 208, MT[1])
  hline(day, 10, 174, 204, IK[2])
  hline(day, 12, 175, 200, OUT)
  // panel seams + rivets
  for (const sx of [40, 72, 136, 168, 200]) {
    vline(day, sx, 60, 113, MT[1])
    vline(day, sx + 1, 60, 113, MT[4])
  }
  for (const sx of [24, 56, 88, 120, 152, 184]) for (const sy of [64, 96, 128, 160]) {
    rect(day, sx, sy, 2, 2, MT[5])
    put(day, sx + 1, sy + 1, MT[1])
  }

  // parapet
  rect(day, 4, 48, 216, 8, MT[3])
  hline(day, 4, 48, 216, MT[5])
  hline(day, 4, 49, 216, MT[5])
  hline(day, 4, 54, 216, MT[1])
  hline(day, 4, 55, 216, MT[1])

  // twin chimney stacks with warning tips
  for (const cx of [28, 172] as const) {
    rect(day, cx, 12, 24, 36, MT[2])
    rect(day, cx, 12, 5, 36, MT[4])
    vline(day, cx, 12, 36, MT[5])
    rect(day, cx + 20, 12, 4, 36, MT[1])
    rect(day, cx - 2, 8, 28, 6, MT[3])
    hline(day, cx - 2, 8, 28, MT[5])
    hline(day, cx - 2, 13, 28, MT[1])
    for (const by of [22, 34]) {
      rect(day, cx + 1, by, 22, 3, MT[3])
      hline(day, cx + 1, by, 22, MT[5])
      hline(day, cx + 1, by + 2, 22, MT[1])
    }
  }
  for (const lx of [38, 182] as const) {
    rect(day, lx, 4, 3, 4, RE[4])
    put(day, lx, 4, RE[5])
    rect(night, lx, 4, 3, 4, 'd')
    softDisc(night, lx + 1, 5, 6, '*')
  }

  // big horizontal pipe run + flanges, and a vertical riser on the right
  rect(day, 8, 68, 208, 9, MT[3])
  hline(day, 8, 68, 208, MT[5])
  hline(day, 8, 69, 208, MT[5])
  hline(day, 8, 75, 208, MT[1])
  hline(day, 8, 76, 208, MT[1])
  hline(day, 8, 77, 208, IK[4])
  for (const fx of [28, 80, 144, 192]) {
    rect(day, fx, 66, 8, 13, MT[2])
    hline(day, fx, 66, 8, MT[5])
    vline(day, fx, 66, 13, MT[4])
    hline(day, fx, 78, 8, MT[1])
  }
  rect(day, 196, 78, 9, 95, MT[3])
  vline(day, 196, 78, 95, MT[5])
  vline(day, 197, 78, 95, MT[4])
  rect(day, 203, 78, 2, 95, MT[1])
  vline(day, 195, 78, 95, MT[1])
  for (const jy of [104, 140]) {
    rect(day, 194, jy, 13, 6, MT[2])
    hline(day, 194, jy, 13, MT[5])
    hline(day, 194, jy + 5, 13, MT[1])
  }

  // the glowing teal core (centre 112,114)
  discAA(day, 112, 114, 26, MT[1], MT[2])
  ring(day, 112, 114, 24, MT[4])
  ring(day, 112, 114, 23, MT[3])
  ring(day, 112, 114, 22, MT[1])
  discAA(day, 112, 114, 20, TL[3], TL[2])
  discAA(day, 111, 113, 16, TL[4], TL[3])
  discAA(day, 108, 110, 9, TL[5], TL[4])
  discAA(day, 106, 108, 5, TL[6], TL[5])
  discAA(day, 105, 107, 2.6, TL[7], TL[6])
  // the far edge falls into shade rather than ringing the centre
  for (let k = 0; k < 44; k++) {
    const a = 0.15 + (k * 1.4) / 44
    put(day, Math.round(112 + Math.cos(a) * 17), Math.round(114 + Math.sin(a) * 17), TL[2])
    put(day, Math.round(112 + Math.cos(a) * 16), Math.round(114 + Math.sin(a) * 16), TL[3])
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + 0.2
    const bx = Math.round(112 + Math.cos(a) * 24)
    const by = Math.round(114 + Math.sin(a) * 24)
    rect(day, bx - 1, by - 1, 3, 3, MT[1])
    put(day, bx - 1, by - 1, MT[5])
  }
  // night: the core blazes
  discAA(night, 112, 114, 19, 't', 't')
  discAA(night, 112, 114, 12, 'j', 'j')
  discAA(night, 110, 112, 5, 'h', 'j')
  softDisc(night, 112, 114, 31, '^')

  // louvred vent grilles either side of the core
  for (const vx of [30, 148] as const) {
    rect(day, vx, 92, 46, 34, MT[1])
    rect(day, vx + 2, 94, 42, 30, MT[2])
    for (let y = 95; y < 123; y += 4) {
      hline(day, vx + 2, y, 42, MT[4])
      hline(day, vx + 2, y + 1, 42, MT[1])
    }
    hline(day, vx, 92, 46, MT[5])
    vline(day, vx, 92, 34, MT[4])
    hline(day, vx, 125, 46, MT[1])
  }

  // gauge dial + indicator lights
  discAA(day, 52, 132, 8, MT[5], MT[4])
  discAA(day, 52, 132, 6, MT[1], MT[2])
  vline(day, 52, 127, 6, MT[6])
  put(day, 54, 129, RE[4])
  put(day, 55, 129, RE[4])
  for (const [ix, iy, c, nc] of [[160, 132, TL[6], 'j'], [170, 132, YW[5], 'Y'], [180, 132, RE[4], 'd']] as const) {
    rect(day, ix, iy, 4, 4, c)
    put(day, ix, iy, CR[6])
    rect(day, ix - 1, iy - 1, 6, 1, MT[1])
    rect(night, ix, iy, 4, 4, nc)
  }
  softDisc(night, 170, 133, 9, '^')

  // sliding blast door (centre x=112) under the core
  rect(day, 86, 136, 52, 38, MT[1])
  for (let x = 88; x <= 136; x++) put(day, x, 137, x % 8 < 4 ? YW[4] : IK[2])
  rect(day, 90, 140, 44, 34, MT[3])
  vline(day, 90, 140, 34, MT[5])
  vline(day, 91, 140, 34, MT[4])
  hline(day, 90, 140, 44, MT[5])
  rect(day, 131, 140, 3, 34, MT[1])
  for (const gy of [148, 158, 168]) {
    hline(day, 90, gy, 44, MT[1])
    hline(day, 90, gy + 1, 44, MT[4])
  }
  vline(day, 111, 140, 34, MT[1])
  vline(day, 112, 140, 34, MT[2])
  rect(day, 126, 144, 4, 4, TL[6])
  put(day, 126, 144, CR[6])
  rect(day, 109, 132, 6, 4, YW[5])
  put(day, 109, 132, YW[7])
  rect(night, 126, 144, 4, 4, 'j')
  rect(night, 109, 132, 6, 4, 'Y')
  hline(night, 92, 172, 40, 'y')
  hline(night, 96, 171, 32, 'H')
  halo(night, 90, 154, 44, 20)

  push('bld_lineage', day, night)
}

/* ================ 5. The Vault (????) — 160×112 ================ */
{
  const W = 160
  const H = 112
  const day = grid(W, H)
  const night = grid(W, H)

  // A rocky outcrop, not a row of blocks: a massif that swells toward the
  // middle (where the gate is cut) with a jagged crest, shaded as big flat
  // facets rather than per-column shading.
  const topY = (x: number): number => {
    const t = (x - 80) / 78
    const noise = Math.sin(x * 0.053) * 5 + Math.sin(x * 0.137 + 1.7) * 2.5 + Math.sin(x * 0.31 + 0.4) * 1.4
    const ledge = [6, -2, 3, -4, 1, 5, -3][Math.min(6, Math.floor(x / 23))]
    return Math.max(4, Math.min(46, Math.round(6 + 18 * t * t + noise + ledge)))
  }
  /** which flat facet a pixel belongs to — two crossed banding fields */
  const facet = (x: number, y: number): number => {
    const a = Math.floor((x * 0.9 + y * 1.7 + Math.sin(x * 0.07) * 16) / 27)
    const b = Math.floor((x * 1.5 - y * 0.9 + Math.sin(y * 0.11) * 13) / 33)
    return (((a * 5 + b * 3) % 7) + 7) % 7
  }
  const tones = [ST[5], ST[4], ST[4], ST[3], ST[4], ST[5], ST[3]]
  for (let x = 2; x < 158; x++) {
    const ty = topY(x)
    for (let y = ty; y < 108; y++) {
      let c = tones[facet(x, y)]
      if (y < ty + 3) c = ST[6]
      else if (y < ty + 6) c = ST[5]
      if (y > 100) c = ST[3]
      else if (y > 90 && (x + y * 3) % 6 < (y - 89) / 2.6) c = ST[3]
      put(day, x, y, c)
    }
    // cracks where facets meet, each catching light on its upper-left lip
    for (let y = ty + 6; y < 106; y++) {
      if (facet(x, y) !== facet(x + 1, y)) {
        put(day, x + 1, y, ST[2])
        put(day, x, y, ST[5])
      }
      if (facet(x, y) !== facet(x, y + 1) && (x + y) % 3) {
        put(day, x, y + 1, ST[2])
        put(day, x, y, ST[5])
      }
    }
  }
  // grit: a sparse scatter of chips and pits, one ramp step either way
  for (let x = 4; x < 156; x++)
    for (let y = topY(x) + 4; y < 104; y++) {
      const v = (x * 13 + y * 7) % 53
      if (v === 0) put(day, x, y, ST[3])
      if (v === 1 && x % 2) put(day, x, y, ST[6])
    }
  for (const [ex, lit] of [[2, 1], [3, 1], [155, 0], [156, 0], [157, 0]] as const)
    for (let y = topY(ex) + 1; y < 106; y++) put(day, ex, y, lit ? (ex === 2 ? ST[6] : ST[5]) : ex === 157 ? ST[2] : ST[3])
  hline(day, 2, 106, 156, ST[2])
  hline(day, 2, 107, 156, IK[2])
  hline(day, 4, 108, 152, IK[3])
  hline(day, 6, 109, 148, OUT)
  hline(day, 8, 110, 144, OUT)
  hline(day, 12, 111, 136, OUT)

  // sealed gate: thick arched stone frame, ink reveal, deep slab
  arched(day, 80, 44, 110, 30, ST[5])
  arched(day, 80, 44, 110, 28, ST[4])
  arched(day, 80, 45, 110, 25, ST[3])
  arched(day, 80, 46, 110, 22, IK[2])
  arched(day, 80, 48, 110, 20, ST[2])
  arched(day, 80, 50, 110, 18, ST[1])
  // frame quoins down both jambs
  for (const jy of [54, 70, 86, 102])
    for (const jx of [54, 106] as const) {
      rect(day, jx - 3, jy - 3, 7, 7, ST[4])
      hline(day, jx - 3, jy - 3, 7, ST[6])
      vline(day, jx - 3, jy - 3, 7, ST[5])
      hline(day, jx - 3, jy + 3, 7, ST[2])
    }
  // chiselled seams on the slab
  hline(day, 64, 64, 14, IK[1])
  hline(day, 84, 64, 14, IK[1])
  hline(day, 68, 84, 26, IK[1])
  vline(day, 80, 52, 8, IK[1])
  hline(day, 64, 65, 14, ST[2])
  hline(day, 84, 65, 14, ST[2])
  hline(day, 68, 85, 26, ST[2])

  // purple sigil (centre 80,70)
  ring(day, 80, 70, 13, PU[4])
  ring(day, 80, 70, 12, PU[3])
  vline(day, 80, 62, 17, PU[4])
  vline(day, 79, 62, 17, PU[3])
  hline(day, 72, 70, 17, PU[4])
  hline(day, 72, 69, 17, PU[3])
  for (const [px, py] of [[74, 64], [86, 64], [74, 76], [86, 76]] as const) {
    rect(day, px, py, 3, 3, PU[5])
    put(day, px, py, PU[6])
  }
  discAA(day, 80, 70, 3, PN[5], PU[5])
  // night: the sigil wakes up
  ring(night, 80, 70, 13, 'u')
  ring(night, 80, 70, 12, 'U')
  vline(night, 79, 62, 17, 'h')
  vline(night, 80, 62, 17, 'h')
  hline(night, 72, 69, 17, 'h')
  hline(night, 72, 70, 17, 'h')
  discAA(night, 80, 70, 3, 'h', 'u')
  softDisc(night, 80, 70, 22, '*')

  // caution stripes across the base of the gate
  for (let y = 98; y <= 105; y++)
    for (let x = 62; x <= 98; x++) put(day, x, y, (((x - y) % 16) + 16) % 16 < 8 ? YW[4] : IK[2])
  hline(day, 62, 96, 37, YW[3])
  hline(day, 62, 97, 37, YW[5])

  // bolted warning plate on the rock
  rect(day, 20, 76, 18, 16, YW[4])
  hline(day, 20, 76, 18, YW[6])
  vline(day, 20, 76, 16, YW[5])
  hline(day, 20, 91, 18, YW[2])
  vline(day, 37, 76, 16, YW[2])
  rect(day, 28, 79, 3, 7, IK[2])
  rect(day, 28, 88, 3, 2, IK[2])
  // hanging chain on the right
  for (let y = 40; y < 66; y++) {
    put(day, 126, y, y % 4 < 2 ? MT[4] : MT[2])
    put(day, 127, y, y % 4 < 2 ? MT[2] : MT[3])
  }
  rect(day, 124, 64, 5, 4, MT[2])
  put(day, 124, 64, MT[5])

  push('bld_stealth', day, night)
}

/* ================ 6. Safe Stride Clinic — 160×144 ================ */
{
  const W = 160
  const H = 144
  const day = grid(W, H)
  const night = grid(W, H)

  // white render walls x12..147, y60..141
  plaster(day, 12, 60, 136, 82, CR, 8)
  // grey wainscot skirt — the clinic's only cool value, keeps the white honest
  hline(day, 12, 122, 136, CR[3])
  rect(day, 12, 123, 136, 17, GY[5])
  hline(day, 12, 123, 136, GY[6])
  hline(day, 12, 124, 136, GY[6])
  for (let y = 128; y < 139; y += 5) hline(day, 12, y, 136, GY[4])
  hline(day, 12, 139, 136, GY[2])
  hline(day, 12, 140, 136, IK[2])
  hline(day, 14, 141, 132, IK[3])
  hline(day, 16, 142, 128, OUT)
  hline(day, 18, 143, 124, OUT)

  // windows with green shutters + a flower box
  cozyWindow(day, night, 26, 76, 24, 24, { frame: CR[3], shade: CR[3] })
  cozyWindow(day, night, 110, 76, 24, 24, { frame: CR[3], shade: CR[3] })
  for (const sx of [20, 50, 104, 134] as const) {
    rect(day, sx, 76, 6, 24, RG[4])
    vline(day, sx, 76, 24, RG[5])
    vline(day, sx + 5, 76, 24, RG[2])
    for (let y = 79; y < 99; y += 4) hline(day, sx + 1, y, 4, RG[3])
  }
  flowerBox(day, 24, 104, 28)

  // door (centre x=80): white door with a glass light and a pink heart
  rect(day, 64, 100, 33, 42, CR[3])
  rect(day, 66, 102, 29, 40, CR[6])
  vline(day, 66, 102, 40, CR[6])
  rect(day, 92, 102, 3, 40, CR[4])
  hline(day, 66, 102, 29, CR[6])
  rect(day, 71, 106, 19, 18, GS[4])
  rect(day, 71, 106, 19, 8, GS[5])
  hline(day, 71, 106, 19, GS[6])
  vline(day, 71, 107, 12, GS[6])
  stamp(day, 75, 112, ['.ff.ff.', 'fffffff', '.fffff.', '..fff..', '...f...'], { f: PN[5] })
  stamp(day, 76, 113, ['ff', 'f.'], { f: PN[6] })
  rect(day, 70, 132, 22, 5, GY[5])
  hline(day, 70, 132, 22, GY[6])
  hline(day, 70, 136, 22, GY[3])
  rect(day, 88, 122, 3, 4, MT[3])
  hline(day, 64, 140, 33, CR[2])
  rect(night, 71, 106, 19, 18, 'y')
  rect(night, 74, 109, 13, 12, 'H')
  halo(night, 71, 106, 19, 18)
  lantern(day, night, 100, 100)

  // access ramp left of the door: a stone wedge with a two-bar handrail
  const rampTop = (x: number): number => 124 + Math.floor((63 - x) / 3)
  for (let x = 34; x <= 63; x++) {
    const top = rampTop(x)
    rect(day, x, top, 1, 140 - top, ST[4])
    put(day, x, top, ST[6])
    put(day, x, top + 1, ST[5])
    if ((63 - x) % 6 === 0) vline(day, x, top + 2, 137 - top, ST[3])
  }
  hline(day, 34, 138, 30, ST[3])
  hline(day, 34, 139, 30, ST[2])
  for (let x = 34; x <= 63; x++) {
    const top = rampTop(x)
    put(day, x, top - 16, MT[5])
    put(day, x, top - 15, MT[3])
    put(day, x, top - 9, MT[4])
    put(day, x, top - 8, MT[2])
  }
  for (const px of [36, 48, 60] as const) {
    const top = rampTop(px)
    rect(day, px, top - 16, 3, 17, MT[3])
    vline(day, px, top - 16, 17, MT[5])
    vline(day, px + 2, top - 16, 17, MT[1])
  }

  // bench beside the door
  rect(day, 106, 118, 36, 4, WD[5])
  hline(day, 106, 118, 36, WD[6])
  hline(day, 106, 121, 36, WD[2])
  rect(day, 106, 126, 36, 5, WD[5])
  hline(day, 106, 126, 36, WD[6])
  hline(day, 106, 130, 36, WD[2])
  for (const bx of [108, 138] as const) {
    rect(day, bx, 131, 3, 9, WD[3])
    vline(day, bx, 131, 9, WD[5])
  }

  // green hipped roof, ridge y12 → eaves y58
  const edge = (y: number): [number, number] => {
    const t = (y - 12) / 46
    return [Math.round(64 - 60 * t), Math.round(95 + 60 * t)]
  }
  tileRoof(day, 12, 58, edge, RG, 6)
  hline(day, 60, 10, 40, RG[3])
  hline(day, 61, 11, 38, RG[5])
  hline(day, 64, 10, 32, RG[6])
  hline(day, 3, 59, 154, RG[3])
  hline(day, 3, 60, 154, RG[2])
  hline(day, 4, 61, 152, IK[4])
  rect(day, 12, 62, 136, 4, CR[3])
  hline(day, 12, 62, 136, CR[2])

  // white cross plaque on the roof front
  discAA(day, 80, 34, 15, CR[4], CR[3])
  discAA(day, 80, 34, 13, CR[6], CR[5])
  discAA(day, 78, 32, 8, CR[6], CR[6])
  rect(day, 75, 25, 11, 19, RG[4])
  rect(day, 70, 30, 21, 9, RG[4])
  hline(day, 75, 25, 11, RG[6])
  hline(day, 70, 30, 21, RG[5])
  vline(day, 70, 30, 9, RG[6])
  vline(day, 75, 25, 5, RG[6])
  rect(day, 84, 32, 2, 12, RG[2])
  rect(day, 86, 32, 5, 5, RG[2])
  put(night, 80, 34, 'h')
  softDisc(night, 80, 34, 8, '-')

  push('bld_safestride', day, night)
}

/* ================ 7. The Lighthouse (Contact) — 96×240 ================ */
{
  const W = 96
  const H = 240
  const day = grid(W, H)
  const night = grid(W, H)

  const half = (y: number): number => 20 + 12 * ((y - 80) / 156)
  // tapered white tower, y80..236
  for (let y = 80; y <= 236; y++) {
    const hw = half(y)
    const x0 = Math.round(48 - hw)
    const x1 = 95 - x0
    hline(day, x0, y, x1 - x0 + 1, CR[5])
    vline(day, x0, y, 1, CR[6])
    vline(day, x0 + 1, y, 1, CR[6])
    rect(day, x1 - 5, y, 5, 1, CR[4])
    rect(day, x1 - 1, y, 2, 1, CR[3])
    if (y % 9 === 0) for (let x = x0 + 2; x < x1 - 4; x++) if ((x + y) % 3) put(day, x, y, CR[4])
  }
  // red bands (follow the taper), lit on the left, shaded on the right
  for (const [b0, b1] of [[100, 120], [148, 168]] as const)
    for (let y: number = b0; y <= b1; y++) {
      const hw = half(y)
      const x0 = Math.round(48 - hw)
      const x1 = 95 - x0
      hline(day, x0, y, x1 - x0 + 1, RE[4])
      vline(day, x0, y, 1, RE[5])
      vline(day, x0 + 1, y, 1, RE[5])
      rect(day, x1 - 5, y, 5, 1, RE[3])
      rect(day, x1 - 1, y, 2, 1, RE[2])
      if (y === b0) hline(day, x0, y, x1 - x0 + 1, RE[5])
      if (y === b1) hline(day, x0, y, x1 - x0 + 1, RE[2])
      if (y % 7 === 0) for (let x = x0 + 3; x < x1 - 5; x++) if ((x + y) % 4 === 0) put(day, x, y, RE[3])
    }
  // stone skirt + ground line
  bond(day, 12, 224, 72, 13, ST, 6, 18)
  hline(day, 12, 223, 72, ST[6])
  hline(day, 12, 236, 72, ST[2])
  hline(day, 14, 237, 68, IK[2])
  hline(day, 16, 238, 64, OUT)
  hline(day, 18, 239, 60, OUT)

  // porthole window
  ring(day, 48, 184, 7.5, MT[2])
  ring(day, 48, 184, 6.5, MT[4])
  discAA(day, 48, 184, 5, GS[4], GS[3])
  discAA(day, 46, 182, 2.4, GS[6], GS[5])
  discAA(night, 48, 184, 5, 'y', 'y')
  discAA(night, 47, 183, 2.4, 'H', 'H')
  halo(night, 43, 179, 11, 11)

  // arched door (centre x=48)
  arched(day, 48, 208, 236, 14, WD[2])
  arched(day, 48, 210, 235, 12, WD[4])
  arched(day, 48, 211, 234, 10, WD[5])
  for (let x = 38; x <= 58; x += 5) vline(day, x, 198, 39, WD[3])
  vline(day, 39, 198, 39, WD[6])
  hline(day, 34, 231, 28, MT[2])
  put(day, 56, 220, YW[5])
  put(day, 57, 220, YW[3])
  hline(day, 36, 235, 25, WD[1])
  hline(night, 38, 234, 21, 'y')
  hline(night, 40, 233, 17, 'H')
  halo(night, 36, 220, 25, 16)

  // gallery deck + rail
  rect(day, 20, 76, 56, 7, MT[2])
  hline(day, 20, 76, 56, MT[5])
  hline(day, 20, 77, 56, MT[4])
  hline(day, 20, 82, 56, MT[1])
  hline(day, 20, 62, 56, MT[3])
  hline(day, 20, 63, 56, MT[1])
  for (const px of [20, 30, 40, 54, 64, 74]) {
    vline(day, px, 64, 12, MT[2])
    vline(day, px + 1, 64, 12, MT[4])
  }

  // lamp room: glass cage with the great lamp
  rect(day, 30, 32, 36, 30, GS[3])
  rect(day, 30, 32, 36, 12, GS[4])
  hline(day, 30, 32, 36, GS[6])
  vline(day, 30, 32, 30, MT[2])
  vline(day, 31, 33, 28, GS[6])
  vline(day, 65, 32, 30, MT[2])
  for (const mx of [38, 46, 57]) {
    vline(day, mx, 32, 30, MT[2])
    vline(day, mx + 1, 32, 30, MT[3])
  }
  hline(day, 30, 61, 36, MT[1])
  rect(day, 40, 40, 16, 16, YW[5])
  rect(day, 41, 41, 14, 14, YW[6])
  rect(day, 42, 42, 8, 8, YW[7])
  rect(day, 40, 54, 16, 2, YW[3])
  rect(day, 54, 40, 2, 16, YW[3])
  hline(day, 28, 30, 40, MT[2])
  hline(day, 28, 31, 40, MT[1])
  // lamp-room night glow (the only night light, per the keeper's rules)
  rect(night, 32, 34, 32, 26, 'y')
  rect(night, 37, 38, 22, 20, 'H')
  rect(night, 43, 43, 10, 10, 'h')
  softDisc(night, 48, 47, 27, '~')

  // red dome + finial
  const dome: [number, number, number][] = [
    [29, 28, 67], [28, 29, 66], [27, 30, 65], [26, 31, 64], [25, 32, 63],
    [24, 33, 62], [23, 35, 60], [22, 37, 58], [21, 39, 56], [20, 41, 54],
    [19, 43, 52], [18, 45, 50],
  ]
  for (const [dy, dx0, dx1] of dome) {
    hline(day, dx0, dy, dx1 - dx0 + 1, RE[4])
    hline(day, dx0, dy, Math.max(2, Math.round((dx1 - dx0) * 0.3)), RE[5])
    put(day, dx0, dy, RE[5])
    put(day, dx1, dy, RE[2])
    put(day, dx1 - 1, dy, RE[3])
  }
  hline(day, 44, 17, 8, RE[3])
  rect(day, 44, 12, 8, 5, MT[2])
  hline(day, 44, 12, 8, MT[5])
  rect(day, 46, 4, 4, 8, MT[2])
  vline(day, 46, 4, 8, MT[4])
  discAA(day, 48, 3, 2.4, MT[5], MT[3])

  push('bld_contact', day, night)
}

/* ================ 8. The Campus (Education) — 192×160 ================ */
{
  const W = 192
  const H = 160
  const day = grid(W, H)
  const night = grid(W, H)

  // slate hipped roof, ridge y36 → eaves y49
  const edge = (y: number): [number, number] => {
    const t = (y - 36) / 13
    return [Math.round(30 - 24 * t), Math.round(161 + 24 * t)]
  }
  tileRoof(day, 36, 49, edge, RB, 5)
  hline(day, 28, 34, 136, RB[3])
  hline(day, 29, 35, 134, RB[5])
  // chimneys
  for (const cx of [40, 148] as const) {
    bond(day, cx, 20, 12, 18, BK, 5, 7)
    vline(day, cx, 20, 18, BK[5])
    vline(day, cx + 11, 20, 18, BK[2])
    rect(day, cx - 2, 16, 16, 5, ST[4])
    hline(day, cx - 2, 16, 16, ST[6])
    hline(day, cx - 2, 20, 16, ST[2])
  }
  // eaves fascia + stone cornice over the brick
  hline(day, 6, 50, 180, RB[2])
  hline(day, 7, 51, 178, IK[4])
  rect(day, 10, 50, 172, 6, ST[4])
  hline(day, 10, 50, 172, ST[6])
  hline(day, 10, 51, 172, ST[5])
  hline(day, 10, 55, 172, ST[2])

  // warm brick body x14..177, y56..157
  bond(day, 14, 56, 164, 102, BK, 6, 15)
  vline(day, 14, 56, 102, BK[5])
  vline(day, 15, 56, 102, BK[6])
  rect(day, 172, 56, 6, 102, BK[3])
  vline(day, 177, 56, 102, BK[2])
  // stone quoins at both corners
  for (const qx of [14, 168] as const)
    for (let y = 56; y < 142; y += 16) {
      rect(day, qx, y, 10, 8, ST[4])
      hline(day, qx, y, 10, ST[6])
      hline(day, qx, y + 7, 10, ST[2])
    }
  // stone water table + footing
  bond(day, 12, 140, 168, 18, ST, 8, 22)
  hline(day, 12, 138, 168, ST[6])
  hline(day, 12, 139, 168, ST[5])
  hline(day, 12, 157, 168, ST[2])
  hline(day, 14, 158, 164, IK[2])
  hline(day, 16, 159, 160, OUT)

  // projecting central bay (catches the light), x=66..125
  rect(day, 66, 50, 60, 108, BK[5])
  bond(day, 68, 56, 56, 84, BK, 6, 13)
  vline(day, 66, 56, 84, BK[4])
  vline(day, 67, 56, 84, BK[5])
  rect(day, 124, 56, 3, 84, BK[3])
  vline(day, 127, 56, 84, BK[3])
  rect(day, 68, 140, 56, 18, ST[4])
  bond(day, 68, 140, 56, 18, ST, 8, 20)
  rect(day, 64, 50, 64, 6, ST[4])
  hline(day, 64, 50, 64, ST[6])
  hline(day, 64, 55, 64, ST[2])

  // central pediment with the clock, apex (96,10)
  for (let y = 10; y <= 48; y++) {
    const spread = Math.round((y - 10) * 0.82)
    const x0 = 96 - spread - 2
    const x1 = 96 + spread + 2
    hline(day, x0, y, x1 - x0 + 1, BK[4])
    hline(day, x0, y, Math.max(2, Math.round((x1 - x0) * 0.3)), BK[5])
    if ((y - 10) % 6 === 5) hline(day, x0 + 2, y, x1 - x0 - 3, BK[3])
    // raking stone cornice on both slopes
    rect(day, x0, y, 5, 1, ST[4])
    put(day, x0, y, ST[6])
    put(day, x0 + 1, y, ST[5])
    rect(day, x1 - 4, y, 5, 1, ST[3])
    put(day, x1, y, ST[2])
  }
  rect(day, 62, 44, 68, 6, ST[4])
  hline(day, 62, 44, 68, ST[6])
  hline(day, 62, 45, 68, ST[5])
  hline(day, 62, 49, 68, ST[2])
  // clock face
  discAA(day, 96, 30, 13, ST[5], ST[4])
  discAA(day, 96, 30, 11, CR[5], CR[4])
  discAA(day, 94, 28, 6, CR[6], CR[6])
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6
    put(day, Math.round(96 + Math.sin(a) * 9), Math.round(30 - Math.cos(a) * 9), IK[3])
  }
  vline(day, 96, 23, 8, IK[2])
  hline(day, 96, 30, 7, IK[2])
  put(day, 96, 30, IK[1])
  rect(night, 92, 26, 9, 9, 'H')
  discAA(night, 96, 30, 10, 'y', 'y')
  vline(night, 96, 23, 8, 'o')
  hline(night, 96, 30, 7, 'o')
  softDisc(night, 96, 30, 17, '~')
  // finial above the apex
  rect(day, 94, 2, 4, 9, ST[4])
  vline(day, 94, 2, 9, ST[6])
  vline(day, 97, 2, 9, ST[2])
  discAA(day, 95.5, 1, 2.4, ST[5], ST[3])

  // three arched window bays, upper floor
  for (const cx of [40, 96, 152] as const) {
    arched(day, cx, 76, 100, 14, ST[4])
    arched(day, cx, 78, 99, 12, ST[2])
    arched(day, cx, 79, 98, 11, GS[3])
    arched(day, cx, 79, 88, 11, GS[4])
    hline(day, cx - 11, 79, 23, GS[6])
    vline(day, cx - 10, 80, 18, GS[5])
    vline(day, cx, 68, 31, ST[4])
    vline(day, cx + 1, 68, 31, ST[3])
    hline(day, cx - 11, 88, 23, ST[4])
    hline(day, cx - 11, 89, 23, ST[3])
    // keystone + sill
    rect(day, cx - 2, 62, 5, 5, ST[5])
    hline(day, cx - 2, 62, 5, ST[6])
    rect(day, cx - 15, 99, 31, 4, ST[4])
    hline(day, cx - 15, 99, 31, ST[6])
    hline(day, cx - 15, 102, 31, ST[2])
    // night
    arched(night, cx, 79, 98, 11, 'y')
    arched(night, cx, 82, 95, 8, 'H')
    vline(night, cx, 70, 29, 'Y')
    hline(night, cx - 10, 88, 21, 'Y')
    halo(night, cx - 11, 68, 23, 31, '~', 5)
  }

  // two lower windows flanking the entrance
  for (const cx of [40, 152] as const) {
    rect(day, cx - 12, 110, 25, 24, ST[4])
    rect(day, cx - 10, 112, 21, 20, ST[2])
    rect(day, cx - 10, 112, 21, 20, GS[3])
    rect(day, cx - 10, 112, 21, 8, GS[4])
    hline(day, cx - 10, 112, 21, GS[6])
    vline(day, cx - 10, 113, 12, GS[5])
    vline(day, cx, 112, 20, ST[4])
    hline(day, cx - 10, 121, 21, ST[4])
    rect(day, cx - 14, 133, 29, 4, ST[4])
    hline(day, cx - 14, 133, 29, ST[6])
    hline(day, cx - 14, 136, 29, ST[2])
    rect(night, cx - 10, 112, 21, 20, 'y')
    rect(night, cx - 7, 115, 15, 14, 'H')
    vline(night, cx, 112, 20, 'Y')
    halo(night, cx - 10, 112, 21, 20)
  }

  // arched entrance, bottom-centre
  arched(day, 96, 118, 157, 20, ST[5])
  hline(day, 76, 118, 41, ST[6])
  arched(day, 96, 120, 157, 17, ST[3])
  arched(day, 96, 121, 157, 15, WD[3])
  arched(day, 96, 122, 156, 14, WD[4])
  for (let x = 83; x <= 109; x += 5) vline(day, x, 108, 50, WD[2])
  vline(day, 83, 108, 50, WD[6])
  // voussoirs stepping round the head, lit on the left half
  for (let k = 0; k <= 14; k++) {
    const a = Math.PI + (k * Math.PI) / 14
    const vx = Math.round(96 + Math.cos(a) * 19)
    const vy = Math.round(118 + Math.sin(a) * 19)
    rect(day, vx - 1, vy - 1, 3, 3, k < 7 ? ST[6] : ST[4])
  }
  // keystone astride the crown
  rect(day, 92, 94, 9, 10, ST[5])
  hline(day, 92, 94, 9, ST[6])
  vline(day, 92, 94, 10, ST[6])
  vline(day, 100, 94, 10, ST[3])
  hline(day, 92, 103, 9, ST[2])
  // double doors + fanlight
  arched(day, 96, 120, 128, 13, WD[4])
  rect(day, 84, 121, 25, 8, GS[4])
  hline(day, 84, 121, 25, GS[6])
  vline(day, 96, 121, 8, WD[2])
  vline(day, 95, 130, 28, WD[2])
  vline(day, 96, 130, 28, WD[1])
  vline(day, 97, 130, 28, WD[2])
  rect(day, 91, 142, 3, 4, YW[4])
  rect(day, 98, 142, 3, 4, YW[4])
  // steps
  for (let i = 0; i < 3; i++) {
    rect(day, 72 - i * 3, 152 + i * 2, 48 + i * 6, 2, ST[5])
    hline(day, 72 - i * 3, 152 + i * 2, 48 + i * 6, ST[6])
    hline(day, 72 - i * 3, 153 + i * 2, 48 + i * 6, ST[3])
  }
  rect(night, 84, 121, 25, 8, 'y')
  rect(night, 87, 123, 19, 4, 'H')
  hline(night, 84, 156, 25, 'y')
  hline(night, 86, 155, 21, 'H')
  halo(night, 82, 130, 29, 28)
  lantern(day, night, 70, 116)
  lantern(day, night, 116, 116)

  // ivy climbing the left corner
  ivy(day, 14, 92, 30, 66, 3)
  ivy(day, 16, 120, 22, 38, 7)

  push('bld_campus', day, night)
}

/* ================ 9. The Warehouse (Harbour) — 128×120 ================ */
{
  const W = 128
  const H = 120
  const day = grid(W, H)
  const night = grid(W, H)

  const slope = (y: number): [number, number] => [
    Math.round(64 - (y - 10) * 1.476),
    Math.round(63 + (y - 10) * 1.476),
  ]

  // gable end: weathered plank wall inside a shingled roof band
  for (let y = 10; y <= 53; y++) {
    const [xl, xr] = slope(y)
    if (xr < xl) continue
    hline(day, xl, y, xr - xl + 1, WD[3])
  }
  // gable planks (inside the barge boards)
  for (let y = 18; y <= 53; y++) {
    const [xl, xr] = slope(y)
    const a = xl + 11
    const b = xr - 11
    if (b < a) continue
    for (let x = a; x <= b; x++) {
      const i = Math.floor((x - 8) / 8)
      let c = [WD[4], WD[5], WD[4], WD[3]][i % 4]
      if ((x - 8) % 8 === 0) c = WD[2]
      if ((x - 8) % 8 === 1) c = WD[5]
      if (y % 11 === 4) c = WD[3]
      put(day, x, y, c)
    }
  }
  // barge boards, lit on the left slope, shaded on the right
  for (let y = 10; y <= 53; y++) {
    const [xl, xr] = slope(y)
    for (let k = 0; k < 11; k++) {
      if (xl + k <= xr) put(day, xl + k, y, k < 2 ? RB[5] : k < 5 ? RB[4] : RB[3])
      if (xr - k >= xl) put(day, xr - k, y, k < 2 ? RB[2] : k < 5 ? RB[3] : RB[4])
    }
    // sparse ridge dither on the roof band
    if (y < 26) {
      const [a, b] = slope(y)
      for (let x = a + 2; x <= b - 2; x += 2) if ((x * 3 + y * 5) % 11 < 2) put(day, x, y, x < 64 ? RB[6] : RB[4])
    }
  }
  // ridge cap + apex block
  rect(day, 58, 6, 12, 6, RB[3])
  hline(day, 58, 6, 12, RB[5])
  hline(day, 58, 11, 12, RB[1])

  // eaves overhang + fascia
  rect(day, 0, 54, 128, 5, RB[3])
  hline(day, 0, 54, 128, RB[5])
  hline(day, 0, 58, 128, RB[1])
  hline(day, 2, 59, 124, IK[4])

  // horizontal weatherboard walls x6..121, y59..117
  boards(day, 6, 59, 116, 59, WD, 7)
  rect(day, 6, 59, 4, 59, WD[2])
  vline(day, 6, 59, 59, WD[5])
  rect(day, 117, 59, 5, 59, WD[2])
  // concrete kick plate
  bond(day, 6, 108, 116, 10, ST, 5, 16)
  hline(day, 6, 107, 116, ST[6])
  hline(day, 6, 117, 116, ST[2])
  hline(day, 8, 118, 112, IK[2])
  hline(day, 10, 119, 108, OUT)

  // corner posts
  for (const px of [10, 112] as const) {
    rect(day, px, 59, 5, 59, WD[3])
    vline(day, px, 59, 59, WD[5])
    vline(day, px + 4, 59, 59, WD[2])
  }

  // sliding door on a steel rail (centre x=64)
  rect(day, 30, 62, 68, 5, MT[2])
  hline(day, 30, 62, 68, MT[5])
  hline(day, 30, 66, 68, MT[1])
  rect(day, 34, 67, 60, 50, WD[4])
  for (let x = 34; x < 94; x += 8) {
    vline(day, x, 67, 50, WD[2])
    vline(day, x + 1, 67, 50, WD[5])
  }
  hline(day, 34, 67, 60, WD[6])
  hline(day, 34, 116, 60, WD[1])
  vline(day, 93, 67, 50, WD[2])
  // X brace + rails
  for (let i = 0; i < 48; i++) {
    put(day, 35 + i, 68 + i, WD[6])
    put(day, 36 + i, 68 + i, WD[5])
    put(day, 92 - i, 68 + i, WD[3])
    put(day, 91 - i, 68 + i, WD[5])
  }
  for (const ry of [70, 112]) {
    hline(day, 34, ry, 60, WD[3])
    hline(day, 34, ry + 1, 60, WD[5])
  }
  // hangers + handle
  for (const hx of [44, 82] as const) {
    rect(day, hx, 64, 4, 6, MT[3])
    hline(day, hx, 64, 4, MT[5])
    rect(day, hx, 68, 4, 2, MT[1])
  }
  rect(day, 86, 88, 3, 9, MT[2])
  put(day, 86, 88, MT[5])
  // night: lamp over the door + light leaking under it
  lantern(day, night, 62, 56)
  hline(night, 36, 115, 56, 'y')
  hline(night, 40, 114, 48, 'H')
  halo(night, 36, 96, 56, 20)

  // louvred hay vent in the gable
  rect(day, 52, 26, 24, 20, WD[2])
  rect(day, 54, 28, 20, 16, IK[3])
  for (let y = 29; y < 44; y += 3) {
    hline(day, 54, y, 20, WD[3])
    hline(day, 54, y + 1, 20, WD[2])
  }
  hline(day, 52, 26, 24, WD[5])
  rect(night, 55, 29, 18, 14, 'y')
  rect(night, 58, 32, 12, 8, 'H')
  halo(night, 54, 28, 20, 16, '-', 4)

  // hoist beam, pulley and rope
  rect(day, 60, 46, 26, 5, WD[3])
  hline(day, 60, 46, 26, WD[6])
  hline(day, 60, 50, 26, WD[1])
  rect(day, 58, 44, 5, 9, WD[2])
  discAA(day, 84, 54, 5, MT[3], MT[2])
  discAA(day, 83, 53, 2.4, MT[5], MT[4])
  put(day, 84, 54, MT[1])
  vline(day, 84, 58, 22, CR[3])
  vline(day, 85, 58, 22, WD[3])
  stamp(day, 82, 80, ['.mm.', 'm..m', 'm...', '.mm.'], { m: MT[3] })

  // coiled rope hanging from a peg on the right-hand wall
  rect(day, 100, 70, 7, 4, MT[2])
  hline(day, 100, 70, 7, MT[5])
  vline(day, 103, 73, 5, CR[3])
  vline(day, 104, 73, 5, CR[2])
  for (let k = 0; k < 3; k++) {
    const rx = 10 - k * 3
    const ry = 13 - k * 4
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const px = Math.round(103 + Math.cos(a) * rx)
      const py = Math.round(89 + Math.sin(a) * ry)
      put(day, px, py + 1, CR[2])
      put(day, px, py, Math.cos(a) < -0.15 ? CR[5] : CR[3])
    }
  }

  // crate stack by the left wall, edged dark so it reads off the boarding
  for (const [bx, by, bw, bh] of [[15, 94, 18, 20], [17, 78, 15, 16]] as const) {
    rect(day, bx, by, bw, bh, WD[1])
    rect(day, bx + 1, by + 1, bw - 2, bh - 2, WD[5])
    vline(day, bx + 1, by + 1, bh - 2, WD[6])
    rect(day, bx + bw - 4, by + 1, 3, bh - 2, WD[3])
    for (let i = 1; i < bh - 1; i++) {
      put(day, bx + 1 + Math.round(((i - 1) * (bw - 3)) / (bh - 3)), by + i, WD[6])
      put(day, bx + bw - 2 - Math.round(((i - 1) * (bw - 3)) / (bh - 3)), by + i, WD[3])
    }
    hline(day, bx + 1, by + (bh >> 1), bw - 2, WD[2])
    hline(day, bx + 1, by + (bh >> 1) + 1, bw - 2, WD[6])
  }

  push('bld_warehouse', day, night)
}

/* ================ particles ================ */

defs.push({
  name: 'smoke',
  w: 16,
  h: 16,
  legend: {},
  paint: (r) => {
    paintDot(r, K('stoneLight', 200))
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++) {
        const d = Math.hypot(x - 7.5, y - 8)
        if (d < 4.6) setPx(r, x, y, [232, 236, 244, 225])
        if (d < 3.1 && x + y < 16) setPx(r, x, y, [250, 251, 255, 235])
      }
  },
  anchor: [8, 8],
})

defs.push({
  name: 'door_light',
  w: 48,
  h: 24,
  legend: {},
  paint: (r) => {
    const cx = (r.w - 1) / 2
    const cy = (r.h - 1) / 2
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const d = Math.hypot((x - cx) / (r.w / 2), (y - cy) / (r.h / 2))
        if (d >= 1) continue
        const a = Math.pow(1 - d, 1.7)
        setPx(r, x, y, [255, 208, 130, Math.round(235 * a)])
      }
  },
  anchor: [24, 12],
})

export const BUILDING_DEFS: SpriteDef[] = defs
