// The two landmark buildings still standing after the fair rewrite — the
// Warehouse (Arcade) and Sol's Prize Tent — plus night overlays, chimney
// smoke and the warm door glow, redrawn for the 32px HD tile. Each façade
// is authored as a char
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
const CR = ramp('cream', 6)
const WD = ramp('wood', 7)
const ST = ramp('stone', 7)
const MT = ramp('metal', 6)
const RR = ramp('roofRed', 6)
const RB = ramp('roofBlue', 6)
const YW = ramp('yellow', 7)
const TL = ramp('teal', 7)
const OR = ramp('orange', 6)
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

/* ================ 1. The Warehouse (Harbour) — 128×120 ================ */
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

/* ================ 2. Sol's Prize Tent (Fairground) — 192×128 ================ */
/*
 * Replaces the Engine landmark on its 6×4-tile plot, so the sprite is pinned to
 * the plot exactly (no roof overhang): the world puts the door on footprint
 * column 3, which is x 96..127 — hence the entrance axis at DX = 112 while the
 * canvas cone stays centred on CX = 96. The two axes are reconciled by hanging
 * the prize sign and the flap-tied entrance off the tent's right of centre, the
 * way a real marquee's porch sits wherever the midway path meets it.
 */
{
  const W = 192
  const H = 128
  const day = grid(W, H)
  const night = grid(W, H)

  const CX = 96 // canvas axis (the pole)
  const DX = 112 // doorway axis = centre of footprint column 3
  const APEX = 10 // top row of the canvas cone
  const EAVE = 56 // row the cone stops and the valance hangs from
  const HEM = 127 // ground line
  const WALL_HW = 81 // the wall is set 11px inside the eave, so the roof reads as an overhang

  /** clamp a fractional position onto a 1-based ramp array */
  const step = (R: string[], i: number): string => R[Math.max(1, Math.min(R.length - 1, Math.round(i)))]
  /** canvas profile: near-straight cone with the skirt flaring out at the eave */
  const roofHW = (y: number): number => 3 + 89 * Math.pow(Math.max(0, (y - APEX) / (EAVE - APEX)), 1.25)
  /** which stripe a roof pixel falls in — the wedges converge on the peak */
  const roofBand = (u: number, hw: number): string[] => (hw < 9 ? RR : Math.floor((u + 1) * 7) % 2 === 0 ? RR : CR)

  // ---- canvas cone: 14 stripes radiating from the peak, lit on the left flank ----
  for (let y = APEX; y <= EAVE; y++) {
    const hw = roofHW(y)
    const t = (y - APEX) / (EAVE - APEX)
    const x0 = Math.round(CX - hw)
    const x1 = Math.round(CX + hw)
    for (let x = x0; x <= x1; x++) {
      const u = (x - CX) / hw
      const R = roofBand(u, hw)
      // sparse 2×1 dither near the ridge only (art-direction §4)
      const d = t < 0.42 && (x * 3 + y * 5) % 11 === 0 ? 0.6 : 0
      put(day, x, y, step(R, 4 - u * 1.3 - t * 0.35 + d))
    }
    // 2-step AA: brightest run on the lit edge, darkest on the shaded one
    for (let k = 0; k < 2; k++) {
      const xa = x0 + k
      const xb = x1 - k
      if (xa <= x1) put(day, xa, y, step(roofBand((xa - CX) / hw, hw), 6 - k))
      if (xb >= x0) put(day, xb, y, step(roofBand((xb - CX) / hw, hw), 2 + k))
    }
    // seam where each stripe meets the next, one step down — texture, not a line
    if (hw >= 12)
      for (let b = 1; b < 14; b++) {
        const sx = Math.round(CX + (b / 7 - 1) * hw)
        put(day, sx, y, step(roofBand((sx - CX) / hw, hw), 4 - ((sx - CX) / hw) * 1.3 - 1.1))
      }
  }

  // ---- king pole + pennant streaming off the peak ----
  vline(day, CX, 1, APEX + 2, WD[3])
  vline(day, CX - 1, 1, APEX + 2, WD[5])
  put(day, CX - 1, 0, WD[6])
  put(day, CX, 0, WD[4])
  for (let i = 0; i < 17; i++) {
    const fh = Math.max(1, 8 - Math.round(i * 0.45))
    const fy = 1 + Math.round(Math.sin(i * 0.34) * 1.7)
    for (let k = 0; k < fh; k++) put(day, CX + 1 + i, fy + k, k === 0 ? TL[6] : k < fh - 1 ? TL[4] : TL[3])
  }
  discAA(day, CX - 0.5, APEX + 2, 3.4, RR[4], RR[2])
  put(day, CX - 2, APEX + 1, RR[6])

  // ---- tent wall: a cylinder of vertical stripes, narrowing toward the edges ----
  for (let x = CX - WALL_HW; x <= CX + WALL_HW; x++) {
    const u = (x - CX) / WALL_HW
    const phi = Math.asin(Math.max(-1, Math.min(1, u)))
    const R = Math.floor((phi / Math.PI + 0.5) * 13) % 2 === 0 ? CR : RR
    for (let y = EAVE + 6; y <= HEM; y++) put(day, x, y, step(R, 4 - u * 1.25 - (y - EAVE) * 0.011))
    // rim on the left return, shade down the right one
    if (u < -0.97) vline(day, x, EAVE + 6, HEM - EAVE - 5, step(R, 6))
    if (u > 0.97) vline(day, x, EAVE + 6, HEM - EAVE - 5, step(R, 2))
  }
  // hem: a rope-weighted skirt, one step down, grounded by a dark base line
  for (let x = CX - WALL_HW; x <= CX + WALL_HW; x++) {
    const u = (x - CX) / WALL_HW
    const R = Math.floor((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 13) % 2 === 0 ? CR : RR
    const wob = Math.round(Math.sin(x * 0.19) * 1.2)
    for (let y = HEM - 5 + wob; y <= HEM; y++) put(day, x, y, step(R, 3 - u * 1.1))
    put(day, x, HEM - 5 + wob, step(R, 5 - u))
  }
  hline(day, CX - WALL_HW + 2, HEM, WALL_HW * 2 - 3, OUT)

  // ---- guy ropes pegged out beyond the skirt ----
  for (const dir of [-1, 1] as const) {
    const ex = CX + dir * (WALL_HW + 4)
    const px = CX + dir * (WALL_HW + 10)
    for (let i = 0; i <= 58; i++) {
      const rx = Math.round(ex + ((px - ex) * i) / 58)
      const ry = EAVE + 6 + i
      put(day, rx, ry, i % 4 === 0 ? CR[5] : CR[3])
    }
    rect(day, px - 1, HEM - 9, 3, 9, WD[3])
    vline(day, px - 1, HEM - 9, 9, WD[5])
    put(day, px + 1, HEM - 9, WD[2])
  }

  // ---- scalloped valance hanging off the eave, with a bulb at every nadir ----
  const SC = 16
  const scallopBottom = (x: number): number => EAVE + 1 + 4 + Math.round(7 * Math.sin((Math.PI * ((x - 4) % SC)) / SC))
  for (let x = 4; x <= 188; x++) {
    const u = (x - CX) / 92
    const R = Math.floor((x - 4) / SC) % 2 === 0 ? CR : RR
    const b = scallopBottom(x)
    for (let y = EAVE + 1; y <= b; y++) put(day, x, y, step(R, 4 - u * 1.5 - (y - EAVE) * 0.06))
    hline(day, x, EAVE + 1, 1, step(R, 6 - u * 0.8))
    put(day, x, b, step(R, 2))
  }
  hline(day, 4, EAVE, 185, RR[2])
  const BULBS: number[] = []
  for (let bx = 12; bx <= 180; bx += SC) if (bx < 88 || bx > 136) BULBS.push(bx)
  for (const bx of BULBS) {
    const by = scallopBottom(bx) + 1
    put(day, bx, by, MT[3])
    discAA(day, bx, by + 3, 2.4, YW[4], YW[2])
    put(day, bx - 1, by + 2, YW[6])
    softDisc(night, bx, by + 3, 6, '~')
    discAA(night, bx, by + 3, 2.4, 'H', 'Y')
  }

  // ---- prize sign, hung off the valance above the entrance ----
  const SX = 92
  const SY = 68
  const SW = 41
  const SH = 18
  for (const cx of [SX + 3, SX + SW - 4]) {
    vline(day, cx, EAVE + 4, SY - EAVE - 3, MT[3])
    put(day, cx, EAVE + 5, MT[5])
  }
  rect(day, SX, SY, SW, SH, CR[4])
  hline(day, SX, SY, SW, CR[6])
  vline(day, SX, SY, SH, CR[5])
  hline(day, SX, SY + SH - 1, SW, CR[2])
  vline(day, SX + SW - 1, SY, SH, CR[3])
  rect(day, SX + 3, SY + 3, SW - 6, SH - 6, RR[2])
  hline(day, SX + 3, SY + 3, SW - 6, RR[3])
  hline(day, SX + 3, SY + SH - 4, SW - 6, RR[1])
  const STAR = [
    '......L......',
    '.....LLL.....',
    '.....LSS.....',
    'LLLLLLSSSSSSS',
    '.LLLLLSSSSSS.',
    '..LLLLSSSSS..',
    '...LLLSSSS...',
    '...LLLSSSS...',
    '..LLL...SSS..',
    '..LL.....SS..',
    '.LL.......SS.',
  ]
  stamp(day, DX - 6, SY + 3, STAR, { L: YW[6], S: YW[4] })
  for (const sx of [SX + 5, SX + SW - 11]) {
    stamp(day, sx, SY + 7, ['.L.', 'LSL', '.S.'], { L: YW[5], S: YW[3] })
    put(day, sx + 1, SY + 7, YW[7])
  }
  rect(night, SX + 3, SY + 3, SW - 6, SH - 6, 'o')
  stamp(night, DX - 6, SY + 3, STAR, { L: 'H', S: 'Y' })
  for (const sx of [SX + 5, SX + SW - 11]) stamp(night, sx, SY + 7, ['.L.', 'LSL', '.S.'], { L: 'H', S: 'Y' })
  halo(night, SX, SY, SW, SH, '~', 5)

  // ---- entrance: cream surround, dark opening, flaps tied back ----
  arched(day, DX, 104, HEM, 18, CR[4])
  arched(day, DX, 103, HEM, 16, CR[6])
  arched(day, DX, 105, HEM, 15, CR[3])
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (k * Math.PI) / 16
    const vx = Math.round(DX + Math.cos(a) * 17)
    const vy = Math.round(104 + Math.sin(a) * 17)
    put(day, vx, vy, k < 8 ? CR[6] : CR[3])
  }
  arched(day, DX, 106, HEM, 15, IK[3])
  arched(day, DX, 107, HEM, 13, IK[2])
  // lamplight inside falling on the sawdust floor — keeps the doorway off pure black
  for (let y = 119; y <= HEM; y++) hline(day, DX - 12 + (y - 119), y, 25 - (y - 119) * 2, y > 123 ? OR[2] : IK[1])
  // canvas flaps gathered back against the jambs, roped at waist height
  for (const dir of [-1, 1] as const) {
    const fx = DX + dir * 13
    for (let y = 94; y <= HEM; y++) {
      const bulge = 2.2 * Math.sin(((y - 94) / (HEM - 94)) * Math.PI)
      const half = 2 + Math.round(bulge)
      for (let k = -half; k <= half; k++) {
        const x = fx + k
        const nd = (x - fx + dir * 0.8) / (half + 0.01)
        put(day, x, y, step(CR, 4 - nd * 1.7 - 0.2))
      }
      // vertical folds, one step down, so the cloth reads gathered not tubular
      put(day, fx - dir * (half - 1), y, step(CR, 3))
    }
    rect(day, fx - 5, 110, 11, 3, WD[3])
    hline(day, fx - 5, 110, 11, WD[5])
    put(day, fx + dir * 6, 111, WD[2])
  }
  lantern(day, night, 80, 92)
  lantern(day, night, 138, 92)
  arched(night, DX, 108, HEM, 12, 'y')
  arched(night, DX, 116, HEM, 8, 'H')
  halo(night, DX - 12, 96, 25, 32, '~', 6)
  hline(night, DX - 12, HEM, 25, 'H')
  softDisc(night, DX, HEM, 17, '~')

  push('bld_fair', day, night)
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
