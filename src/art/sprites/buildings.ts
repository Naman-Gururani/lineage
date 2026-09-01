// The seven landmark buildings (plus night overlays, chimney smoke and the warm
// door glow). Each façade is authored as a char grid composed by tiny drawing
// helpers, then exported as ASCII rows through the shared legend — so every
// building keeps the same 1px outline, top-left light and chunky cozy read as
// the rest of the island. Anchors sit at bottom-centre of the footprint.
import type { Legend, SpriteDef } from '../pixel'
import { K, paintDot } from '../procedural'
import { setPx } from '../raster'

/* ---------------- legends ---------------- */

// day legend (shared by all buildings)
const L: Legend = {
  k: 'ink',
  K: 'inkSoft',
  '#': 'outline',
  '0': 'white',
  '1': 'cream',
  '2': 'creamDark',
  z: 'grey',
  a: 'wall',
  A: 'wallShade',
  q: 'wallDark',
  w: 'wood',
  W: 'woodLight',
  x: 'woodDark',
  p: 'plank',
  P: 'plankDark',
  r: 'roofRed',
  R: 'roofRedDark',
  e: 'brick',
  g: 'roofGreen',
  G: 'roofGreenDark',
  o: 'orange',
  O: 'orangeDark',
  s: 'stone',
  S: 'stoneDark',
  l: 'stoneLight',
  L: 'stoneDeep',
  m: 'metal',
  M: 'metalLight',
  n: 'metalDark',
  i: 'glass',
  I: 'glassLight',
  '8': 'roofBlue',
  '9': 'roofBlueDark',
  y: 'windowNight',
  Y: 'yellow',
  V: 'yellowDark',
  d: 'red',
  D: 'redDark',
  f: 'pink',
  t: 'teal',
  T: 'tealDark',
  j: 'tealLight',
  h: 'glow',
  H: 'glowWarm',
  u: 'purple',
  U: 'purpleDark',
  b: 'blue',
  B: 'blueDark',
  N: 'navy',
  '4': 'leaf',
  '5': 'leafDark',
  '6': 'leafLight',
  '7': 'shadow',
}

// night-overlay legend: lit panes + soft rgba halos (no outline on overlays)
const NL: Legend = {
  y: 'windowNight',
  Y: 'yellow',
  H: 'glowWarm',
  t: 'teal',
  j: 'tealLight',
  h: 'glow',
  u: 'purple',
  U: 'purpleDark',
  d: 'red',
  '~': 'rgba(255,214,120,0.30)',
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
const stamp = (g: G, x: number, y: number, art: string[]): void => {
  for (let yy = 0; yy < art.length; yy++)
    for (let xx = 0; xx < art[yy].length; xx++) if (art[yy][xx] !== '.') put(g, x + xx, y + yy, art[yy][xx])
}
const disc = (g: G, cx: number, cy: number, rad: number, ch: string): void => {
  for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
    for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++)
      if (Math.hypot(xx - cx, yy - cy) <= rad + 0.4) put(g, xx, yy, ch)
}
const softDisc = (g: G, cx: number, cy: number, rad: number, ch: string): void => {
  for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
    for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++)
      if (Math.hypot(xx - cx, yy - cy) <= rad + 0.4) putSoft(g, xx, yy, ch)
}
const ring = (g: G, cx: number, cy: number, rad: number, ch: string): void => {
  for (let a = 0; a < Math.PI * 2; a += 0.04) put(g, Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad), ch)
}
const toRows = (g: G): string[] => g.c.map((r) => r.join(''))

/* ---------------- def plumbing ---------------- */

const defs: SpriteDef[] = []

/** push a building + its night overlay (same size, same anchor, no outline) */
const push = (name: string, day: G, night?: G): void => {
  defs.push({ name, rows: toRows(day), legend: L, outline: 'outline', anchor: [day.w / 2, day.h] })
  if (night) defs.push({ name: name + '_night', rows: toRows(night), legend: NL, anchor: [day.w / 2, day.h] })
}

/* ---------------- shared façade pieces ---------------- */

/** soft warm halo ring around a lit rectangle (night grids only) */
const halo = (night: G, x: number, y: number, w: number, h: number, ch = '~'): void => {
  for (let yy = y - 2; yy < y + h + 2; yy++)
    for (let xx = x - 2; xx < x + w + 2; xx++) {
      const inside = xx >= x && xx < x + w && yy >= y && yy < y + h
      if (!inside && Math.abs(xx - (x + w / 2)) / (w / 2 + 2) + Math.abs(yy - (y + h / 2)) / (h / 2 + 2) < 2) putSoft(night, xx, yy, ch)
    }
}

/** cottage window: wooden frame, sky glass, cross mullion; lit warm at night */
const cozyWindow = (day: G, night: G, x: number, y: number, w: number, h: number, frame = 'x'): void => {
  rect(day, x, y, w, h, frame)
  rect(day, x + 1, y + 1, w - 2, h - 2, 'i')
  hline(day, x + 1, y + 1, w - 2, 'I')
  vline(day, x + 1, y + 2, h - 3, 'I')
  if (w >= 9) vline(day, x + (w >> 1), y + 1, h - 2, frame)
  if (h >= 9) hline(day, x + 1, y + (h >> 1), w - 2, frame)
  hline(day, x - 1, y + h, w + 2, 'q') // sill shadow
  hline(day, x - 1, y + h + 1, w + 2, '2') // sill board
  // night: warm panes + glow heart + halo
  rect(night, x + 1, y + 1, w - 2, h - 2, 'y')
  rect(night, x + 2, y + 2, Math.max(1, w - 5), Math.max(1, h - 5), 'H')
  if (w >= 9) vline(night, x + (w >> 1), y + 1, h - 2, 'y')
  halo(night, x, y, w, h)
}

/** flower box with leaf tufts and blooms, sitting under a window */
const flowerBox = (day: G, x: number, y: number, w: number): void => {
  hline(day, x, y, w, 'w')
  hline(day, x, y + 1, w, 'x')
  for (let i = 1; i < w - 1; i++) put(day, x + i, y - 1, '4')
  for (let i = 2; i < w - 2; i += 3) put(day, x + i, y - 1, i % 2 ? 'f' : 'Y')
  for (let i = 4; i < w - 2; i += 6) put(day, x + i, y - 2, 'f')
}

/* ================ 1. The Cottage (About) — 80×80 ================ */
{
  const W = 80
  const H = 80
  const day = grid(W, H)
  const night = grid(W, H)

  // walls (x6..73, y42..78) + plaster shading, light from the left
  rect(day, 6, 42, 68, 37, 'a')
  rect(day, 70, 42, 4, 37, 'A')
  vline(day, 7, 42, 37, '1')
  // stone plinth + ground line
  hline(day, 6, 74, 68, 'l')
  rect(day, 6, 75, 68, 4, 's')
  for (let x = 8; x < 72; x += 5) put(day, x, 76 + (x % 3), 'S')
  hline(day, 6, 78, 68, 'S')
  hline(day, 6, 79, 68, '#')
  // timber corner posts
  vline(day, 6, 42, 37, 'x')
  vline(day, 73, 42, 37, 'x')

  // windows + flower boxes
  cozyWindow(day, night, 14, 50, 12, 11)
  cozyWindow(day, night, 54, 50, 12, 11)
  flowerBox(day, 13, 63, 14)
  flowerBox(day, 53, 63, 14)

  // door (centre x=40): arched wood door with warm knob
  vline(day, 33, 59, 20, 'x')
  vline(day, 47, 59, 20, 'x')
  hline(day, 34, 58, 13, 'x')
  rect(day, 34, 59, 13, 20, 'w')
  put(day, 34, 59, 'x')
  put(day, 46, 59, 'x')
  vline(day, 35, 60, 19, 'W')
  vline(day, 40, 60, 19, 'x')
  vline(day, 44, 60, 19, 'x')
  put(day, 44, 68, 'Y')
  put(day, 45, 68, 'V')
  hline(day, 34, 78, 13, 'x')
  // night: warm light seeping around the door
  hline(night, 35, 77, 11, 'y')
  halo(night, 34, 70, 13, 8)

  // heart sign over the door
  rect(day, 35, 48, 11, 8, '1')
  hline(day, 35, 48, 11, '2')
  vline(day, 35, 48, 8, '2')
  vline(day, 45, 48, 8, '2')
  hline(day, 35, 55, 11, '2')
  stamp(day, 38, 50, ['d.d', 'ddd', 'ddd', '.d.'])
  put(day, 38, 50, 'f')

  // roof: hipped red tiles, ridge y10 → eaves y40
  for (let i = 0; i <= 30; i++) {
    const y = 10 + i
    const t = i / 30
    const x0 = Math.round(30 - 28 * t)
    const x1 = Math.round(49 + 28 * t)
    hline(day, x0, y, x1 - x0 + 1, 'r')
    put(day, x0, y, 'e')
    put(day, x0 + 1, y, 'e')
    put(day, x1, y, 'R')
    put(day, x1 - 1, y, 'R')
    if (i % 4 === 3) for (let x = x0 + 2; x <= x1 - 2; x++) if ((x + i * 2) % 6 < 2) put(day, x, y, 'R')
  }
  hline(day, 29, 9, 22, 'e')
  hline(day, 2, 41, 76, 'R')
  hline(day, 6, 42, 68, 'q') // eave shadow on the wall

  // chimney (pokes through the right roof slope)
  rect(day, 56, 4, 8, 14, 's')
  vline(day, 56, 4, 14, 'l')
  vline(day, 63, 4, 14, 'S')
  rect(day, 55, 2, 10, 2, 'S')
  hline(day, 55, 2, 10, 'l')
  hline(day, 57, 4, 6, 'L')

  push('bld_about', day, night)
}

/* ================ 2. Barclays Tower (Experience) — 96×140 ================ */
{
  const W = 96
  const H = 140
  const day = grid(W, H)
  const night = grid(W, H)

  // tower body x8..87, y16..138
  rect(day, 8, 16, 80, 123, 'a')
  rect(day, 84, 16, 4, 123, 'A')
  vline(day, 8, 16, 123, '0')
  vline(day, 9, 16, 123, '1')
  hline(day, 8, 139, 80, '#')

  // parapet + rooftop block + navy flag
  rect(day, 6, 12, 84, 4, 'a')
  hline(day, 6, 12, 84, '0')
  hline(day, 6, 15, 84, 'q')
  rect(day, 30, 6, 36, 6, 'A')
  hline(day, 30, 6, 36, '1')
  vline(day, 68, 1, 11, 'n')
  rect(day, 69, 1, 12, 5, 'N')
  hline(day, 69, 1, 12, 'b')
  put(day, 71, 3, '0')
  put(day, 72, 3, '0')
  put(day, 74, 3, 'i')
  // corporate cyan band under the parapet
  rect(day, 8, 17, 80, 2, '8')
  hline(day, 8, 19, 80, '9')

  // five rows × five columns of blue glass windows
  const cols = [15, 29, 43, 57, 71]
  const rowsY = [22, 40, 58, 76, 94]
  const litSet = new Set([0, 2, 3, 6, 9, 11, 12, 15, 17, 20, 22, 24])
  for (let ry = 0; ry < rowsY.length; ry++)
    for (let cx = 0; cx < cols.length; cx++) {
      const x = cols[cx]
      const y = rowsY[ry]
      rect(day, x, y, 10, 12, 'n')
      rect(day, x + 1, y + 1, 8, 10, 'i')
      rect(day, x + 1, y + 7, 8, 3, '8')
      hline(day, x + 1, y + 1, 8, 'I')
      vline(day, x + 1, y + 2, 4, 'I')
      hline(day, x + 5, y + 6, 3, '9')
      hline(day, x, y + 12, 10, 'q')
      if (litSet.has(ry * 5 + cx)) {
        rect(night, x + 1, y + 1, 8, 10, 'y')
        rect(night, x + 2, y + 2, 5, 6, 'H')
      }
    }

  // string courses between floors
  for (const fy of [36, 54, 72, 90]) hline(day, 10, fy, 76, 'A')

  // entrance: navy sign, metal canopy, glass double door (centre x=56)
  rect(day, 42, 106, 29, 7, 'N')
  vline(day, 42, 106, 7, 'b')
  hline(day, 42, 106, 29, 'b')
  for (const [sx, sw] of [[45, 4], [51, 3], [56, 4], [62, 3], [66, 3]] as const) hline(day, sx, 109, sw, '0')
  rect(day, 44, 113, 25, 4, 'n')
  hline(day, 44, 113, 25, 'M')
  hline(day, 44, 116, 25, 'k')
  hline(day, 45, 117, 23, '7')
  rect(day, 49, 117, 15, 22, 'n')
  rect(day, 50, 118, 13, 20, 'i')
  hline(day, 50, 118, 13, 'I')
  vline(day, 56, 118, 20, 'n')
  vline(day, 50, 119, 6, 'I')
  put(day, 54, 128, 'M')
  put(day, 58, 128, 'M')
  rect(day, 50, 133, 13, 5, '9')
  // night: lobby glow + sign glow
  rect(night, 50, 118, 13, 20, 'y')
  rect(night, 52, 121, 9, 12, 'H')
  halo(night, 49, 117, 15, 22)
  hline(night, 45, 109, 23, 'H')
  halo(night, 42, 106, 29, 7)

  // ground-floor display windows + planters
  for (const gx of [14, 68] as const) {
    rect(day, gx, 120, 14, 12, 'n')
    rect(day, gx + 1, 121, 12, 10, 'i')
    hline(day, gx + 1, 121, 12, 'I')
    rect(day, gx + 1, 128, 12, 3, '8')
    rect(night, gx + 1, 121, 12, 10, 'y')
  }
  // stone plinth + shrubs
  hline(day, 8, 132, 41, 'l')
  rect(day, 8, 133, 41, 6, 's')
  rect(day, 64, 133, 24, 6, 's')
  hline(day, 64, 132, 24, 'l')
  hline(day, 8, 138, 80, 'S')
  rect(day, 10, 129, 12, 3, '4')
  hline(day, 10, 128, 12, '6')
  put(day, 13, 128, '5')
  put(day, 18, 129, '5')
  rect(day, 74, 129, 12, 3, '4')
  hline(day, 74, 128, 12, '6')
  put(day, 78, 129, '5')

  push('bld_experience', day, night)
}

/* ================ 3. The Workshop (Skills) — 96×72 ================ */
{
  const W = 96
  const H = 72
  const day = grid(W, H)
  const night = grid(W, H)

  // plank walls x6..89, y20..70
  rect(day, 6, 20, 84, 51, 'p')
  for (let y = 26; y < 70; y += 5) hline(day, 6, y, 84, 'P')
  rect(day, 86, 20, 4, 51, 'P')
  vline(day, 7, 22, 49, 'w')
  vline(day, 6, 20, 51, 'x')
  vline(day, 89, 20, 51, 'x')
  hline(day, 6, 70, 84, 'x')
  hline(day, 6, 71, 84, '#')

  // saltbox terracotta roof: ridge (30,6), short left slope, long right slope
  for (let y = 6; y <= 30; y++) {
    const tL = Math.min(1, (y - 6) / 14)
    const x0 = Math.round(30 - 28 * tL)
    const x1 = Math.round(30 + ((y - 6) * 63) / 24)
    if (y <= 20) hline(day, x0, y, Math.min(x1, 93) - x0 + 1, 'o')
    else hline(day, Math.round(6 + (y - 20) * 1.5), y, Math.min(x1, 93) - Math.round(6 + (y - 20) * 1.5) + 1, 'o')
    const xe = Math.min(x1, 93)
    put(day, xe, y, 'O')
    put(day, xe - 1, y, 'O')
    if (y <= 20) {
      put(day, x0, y, 'e')
      put(day, x0 + 1, y, 'e')
    }
    if (y % 4 === 1) for (let x = x0 + 2; x <= xe - 2; x++) if ((x + y * 2) % 7 < 2) put(day, x, y, 'O')
  }
  hline(day, 29, 5, 4, 'e')
  hline(day, 2, 21, 30, 'O') // left eave edge
  hline(day, 6, 22, 30, 'q')

  // metal chimney pipe through the right slope
  rect(day, 74, 8, 4, 16, 'n')
  vline(day, 74, 8, 16, 'm')
  hline(day, 73, 7, 6, 'n')
  hline(day, 72, 5, 8, 'm')
  hline(day, 72, 6, 8, 'n')
  hline(day, 74, 12, 4, 'M')
  hline(day, 74, 18, 4, 'M')

  // big double door (centre x=56) with cross bracing
  vline(day, 42, 42, 29, 'x')
  vline(day, 70, 42, 29, 'x')
  rect(day, 42, 40, 29, 2, 'x')
  rect(day, 43, 42, 27, 28, 'w')
  vline(day, 56, 42, 28, 'x')
  for (let i = 0; i < 13; i++) {
    put(day, 43 + i, 44 + i, 'W')
    put(day, 69 - i, 44 + i, 'W')
    put(day, 43 + i, 68 - i, 'x')
    put(day, 69 - i, 68 - i, 'x')
  }
  hline(day, 43, 42, 27, 'W')
  put(day, 53, 56, 'n')
  put(day, 59, 56, 'n')
  hline(day, 43, 69, 27, 'x')
  // night: forge light bursting through the door seams
  vline(night, 56, 46, 24, 'H')
  hline(night, 44, 69, 25, 'y')
  hline(night, 46, 68, 21, 'H')
  halo(night, 44, 60, 25, 10)

  // gear sign on a cream plaque above the door
  disc(day, 56, 30, 9, '2')
  disc(day, 56, 30, 8, '1')
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + 0.39
    put(day, Math.round(56 + Math.cos(a) * 7), Math.round(30 + Math.sin(a) * 7), 'n')
  }
  disc(day, 56, 30, 5.5, 'm')
  disc(day, 55, 29, 4, 'M')
  disc(day, 56, 30, 2, 'n')
  put(day, 55, 29, '1')

  // anvil on a stump + lean-to tools by the left wall
  rect(day, 14, 64, 10, 7, 'x')
  vline(day, 14, 64, 7, 'w')
  stamp(day, 10, 55, [
    '.MMMMMMMMMMMMM..',
    'nnnnnnnnnnnnnnn.',
    '.nnnnnnnnnnnnn..',
    '....nnnnnn......',
    '....nnnnnn......',
    '...nnnnnnnn.....',
    '..nnnnnnnnnn....',
  ])
  vline(day, 30, 56, 14, 'w') // hammer leaning on the wall
  rect(day, 28, 53, 6, 3, 'n')
  hline(day, 28, 53, 6, 'M')
  // window over the anvil
  cozyWindow(day, night, 12, 36, 11, 11)
  // horseshoe charm by the door
  ring(day, 80, 50, 3, 'n')
  hline(day, 78, 52, 5, '.')
  put(day, 78, 51, 'n')
  put(day, 82, 51, 'n')

  push('bld_skills', day, night)
}

/* ================ 4. The Engine (Lineage) — 112×88 ================ */
{
  const W = 112
  const H = 88
  const day = grid(W, H)
  const night = grid(W, H)

  // steel body x4..107, y28..86 — bevelled riveted panels, lit cornice
  rect(day, 4, 28, 104, 59, 'n')
  rect(day, 4, 28, 104, 3, 'm')
  hline(day, 4, 31, 104, 'L')
  vline(day, 4, 28, 59, 'm')
  vline(day, 5, 28, 59, 'm')
  rect(day, 104, 28, 4, 59, 'L')
  hline(day, 4, 86, 104, 'L')
  hline(day, 4, 87, 104, '#')
  // panel seams + rivets
  for (const sx of [20, 36, 68, 84, 100]) {
    vline(day, sx, 30, 56, 'L')
    vline(day, sx + 1, 30, 56, 'm')
  }
  for (const sx of [12, 28, 44, 60, 76, 92]) for (const sy of [31, 47, 63, 79]) put(day, sx, sy, 'M')

  // parapet
  rect(day, 2, 24, 108, 4, 'm')
  hline(day, 2, 24, 108, 'M')
  hline(day, 2, 27, 108, 'L')

  // twin chimney stacks with warning tips
  for (const cx of [14, 86] as const) {
    rect(day, cx, 6, 12, 18, 'n')
    vline(day, cx, 6, 18, 'm')
    vline(day, cx + 11, 6, 18, 'L')
    rect(day, cx - 1, 4, 14, 3, 'L')
    hline(day, cx - 1, 4, 14, 'M')
    hline(day, cx + 1, 10, 10, 'm')
    hline(day, cx + 1, 16, 10, 'm')
  }
  vline(day, 19, 2, 2, 'd')
  vline(day, 91, 2, 2, 'd')
  put(night, 19, 2, 'd')
  put(night, 91, 2, 'd')
  softDisc(night, 19, 2, 3, '*')

  // big horizontal pipe run + flanges, and a vertical pipe on the right
  rect(day, 4, 34, 104, 4, 'm')
  hline(day, 4, 34, 104, 'M')
  hline(day, 4, 37, 104, 'L')
  for (const fx of [14, 40, 72, 96]) {
    rect(day, fx, 33, 4, 6, 'n')
    hline(day, fx, 33, 4, 'M')
  }
  hline(day, 4, 38, 104, 'L') // drop shadow under the pipe run
  vline(day, 98, 38, 48, 'L')
  rect(day, 99, 38, 4, 48, 'm')
  vline(day, 99, 38, 48, 'M')
  vline(day, 102, 38, 48, 'L')
  rect(day, 98, 56, 6, 3, 'n')
  hline(day, 98, 56, 6, 'M')

  // the glowing teal core (centre 56,57)
  disc(day, 56, 57, 12.5, 'L')
  ring(day, 56, 57, 12, 'M')
  ring(day, 56, 57, 11, 'm')
  disc(day, 56, 57, 10, 'T')
  disc(day, 56, 57, 7.5, 't')
  disc(day, 54, 55, 4, 'j')
  disc(day, 55, 56, 2, 'h')
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    put(day, Math.round(56 + Math.cos(a) * 12), Math.round(57 + Math.sin(a) * 12), 'L')
  }
  // night: the core blazes
  disc(night, 56, 57, 9.5, 't')
  disc(night, 56, 57, 6, 'j')
  disc(night, 55, 56, 2.5, 'h')
  softDisc(night, 56, 57, 15, '^')

  // gauge dial + indicator lights
  ring(day, 26, 66, 3, 'M')
  disc(day, 26, 66, 2, 'n')
  put(day, 27, 65, 'd')
  for (const [ix, iy, ch] of [[80, 66, 'j'], [84, 66, 'Y'], [88, 66, 'd']] as const) {
    put(day, ix, iy, ch)
    put(night, ix, iy, ch === 'Y' ? 'Y' : ch)
  }
  softDisc(night, 84, 66, 4, '^')

  // sliding door (centre x=56) under the core
  rect(day, 47, 71, 19, 15, 'L')
  for (let x = 48; x <= 64; x++) put(day, x, 71, x % 4 < 2 ? 'Y' : 'k')
  rect(day, 49, 73, 15, 13, 'm')
  vline(day, 49, 73, 13, 'M')
  hline(day, 49, 73, 15, 'M')
  hline(day, 49, 77, 15, 'n')
  hline(day, 49, 81, 15, 'n')
  vline(day, 56, 73, 13, 'L')
  put(day, 61, 74, 'j')
  put(day, 56, 70, 'Y')
  put(night, 61, 74, 'j')
  put(night, 56, 70, 'Y')
  hline(night, 50, 85, 13, 'y')
  halo(night, 49, 78, 15, 8)

  push('bld_lineage', day, night)
}

/* ================ 5. The Vault (????) — 80×56 ================ */
{
  const W = 80
  const H = 56
  const day = grid(W, H)
  const night = grid(W, H)

  // cliff face with a chunky, stepped top edge
  const steps: [number, number, number][] = [
    [1, 12, 8],
    [12, 24, 5],
    [24, 36, 7],
    [36, 48, 4],
    [48, 60, 6],
    [60, 70, 3],
    [70, 79, 7],
  ]
  for (const [x0, x1, top] of steps) {
    for (let x = x0; x < x1; x++) vline(day, x, top, 55 - top, 's')
    hline(day, x0, top, x1 - x0, 'l')
    hline(day, x0, top + 1, x1 - x0, 'l')
  }
  rect(day, 76, 10, 3, 45, 'S')
  hline(day, 1, 54, 78, 'S')
  hline(day, 1, 55, 78, '#')
  // rocky texture: cracks and shaded facets
  for (let y = 10; y < 52; y += 1)
    for (let x = 2; x < 78; x++) {
      const v = (x * 13 + y * 7) % 41
      if (v === 0) put(day, x, y, 'S')
      if (v === 1 && x % 2) put(day, x, y, 'l')
    }
  stamp(day, 6, 16, ['S..', '.S.', '.S.', '..S'])
  stamp(day, 66, 22, ['.S', 'S.', 'S.'])
  hline(day, 14, 30, 4, 'S')
  hline(day, 60, 40, 5, 'S')

  // sealed gate: arched stone frame, ink shadow ring, deep slab
  const arch: [number, number][] = [
    [36, 16],
    [33, 17],
    [31, 18],
    [30, 19],
    [29, 20],
    [28, 21],
  ]
  for (const [x0, y] of arch) hline(day, x0, y, (40 - x0) * 2 + 1, 'S')
  rect(day, 27, 22, 27, 33, 'S')
  for (const [x0, y] of arch.slice(2)) hline(day, x0 + 2, y + 2, (40 - x0) * 2 - 3, 'k')
  rect(day, 29, 24, 23, 31, 'k')
  rect(day, 31, 26, 19, 29, 'L')
  hline(day, 27, 54, 27, 'S')
  hline(day, 27, 55, 27, '#')
  // block joints on the frame
  for (const [jx, jy] of [[28, 30], [52, 30], [28, 40], [52, 40], [28, 48], [52, 48], [33, 19], [47, 19]] as const) put(day, jx, jy, 'l')
  // chiselled seams on the slab
  hline(day, 32, 32, 7, 'k')
  hline(day, 42, 32, 7, 'k')
  hline(day, 34, 40, 13, 'k')
  vline(day, 40, 26, 4, 'k')

  // purple sigil (centre 40,35)
  ring(day, 40, 35, 6, 'u')
  vline(day, 40, 31, 9, 'u')
  hline(day, 36, 35, 9, 'u')
  put(day, 37, 32, 'U')
  put(day, 43, 32, 'U')
  put(day, 37, 38, 'U')
  put(day, 43, 38, 'U')
  put(day, 40, 31, 'U')
  put(day, 40, 39, 'U')
  put(day, 36, 35, 'U')
  put(day, 44, 35, 'U')
  put(day, 40, 35, 'f')
  // night: the sigil wakes up
  ring(night, 40, 35, 6, 'u')
  vline(night, 40, 31, 9, 'h')
  hline(night, 36, 35, 9, 'h')
  put(night, 40, 35, 'h')
  softDisc(night, 40, 35, 10, '*')

  // caution stripes across the base of the gate
  for (let y = 50; y <= 53; y++)
    for (let x = 31; x <= 49; x++) put(day, x, y, ((x - y) % 8 + 8) % 8 < 4 ? 'Y' : 'k')
  hline(day, 31, 49, 19, 'V')

  // bolted warning plate on the rock
  rect(day, 10, 38, 9, 8, 'Y')
  hline(day, 10, 38, 9, 'V')
  vline(day, 10, 38, 8, 'V')
  hline(day, 10, 45, 9, 'V')
  vline(day, 18, 38, 8, 'V')
  vline(day, 14, 40, 3, 'k')
  put(day, 14, 44, 'k')
  // hanging chain on the right
  for (let y = 20; y < 32; y++) put(day, 63, y, y % 2 ? 'm' : 'n')
  put(day, 62, 31, 'n')

  push('bld_stealth', day, night)
}

/* ================ 6. Safe Stride Clinic — 80×72 ================ */
{
  const W = 80
  const H = 72
  const day = grid(W, H)
  const night = grid(W, H)

  // white walls x6..73, y30..70
  rect(day, 6, 30, 68, 41, '0')
  rect(day, 70, 30, 4, 41, '1')
  // wainscot band
  hline(day, 6, 63, 68, '2')
  rect(day, 6, 64, 68, 7, '1')
  hline(day, 6, 70, 68, '2')
  hline(day, 6, 71, 68, '#')

  // windows with green shutters + a flower box
  cozyWindow(day, night, 12, 38, 12, 12, '2')
  cozyWindow(day, night, 56, 38, 12, 12, '2')
  for (const sx of [10, 24, 54, 68] as const) {
    vline(day, sx, 38, 12, 'g')
    vline(day, sx + 1, 38, 12, 'G')
  }
  flowerBox(day, 11, 52, 14)

  // door (centre x=40): white door with glass + pink heart
  vline(day, 33, 51, 20, '2')
  vline(day, 47, 51, 20, '2')
  hline(day, 33, 50, 15, '2')
  rect(day, 34, 51, 13, 20, '0')
  vline(day, 34, 51, 20, '1')
  vline(day, 46, 51, 20, '2')
  rect(day, 36, 53, 9, 8, 'i')
  hline(day, 36, 53, 9, 'I')
  stamp(day, 38, 55, ['f.f', 'fff', '.f.'])
  hline(day, 35, 67, 11, 'z')
  hline(day, 35, 68, 11, 'z')
  put(day, 44, 62, 'n')
  hline(day, 34, 70, 13, '2')
  rect(night, 36, 53, 9, 8, 'y')
  hline(night, 37, 55, 7, 'H')
  halo(night, 36, 53, 9, 8)

  // access ramp left of the door, with a thin handrail
  for (let i = 0; i < 14; i++) {
    const x = 33 - i
    const top = 64 + (i >> 2)
    vline(day, x, top, 70 - top, 's')
    put(day, x, top, 'l')
  }
  hline(day, 20, 62, 3, 'm')
  hline(day, 23, 61, 4, 'm')
  hline(day, 27, 60, 4, 'm')
  hline(day, 31, 59, 3, 'm')
  vline(day, 20, 62, 6, 'n')
  vline(day, 27, 60, 7, 'n')
  vline(day, 33, 59, 6, 'n')

  // bench beside the door
  hline(day, 54, 60, 17, 'W')
  hline(day, 54, 61, 17, 'w')
  hline(day, 54, 64, 17, 'W')
  hline(day, 54, 65, 17, 'w')
  hline(day, 54, 66, 17, 'x')
  vline(day, 55, 67, 4, 'x')
  vline(day, 69, 67, 4, 'x')

  // green hipped roof, ridge y6 → eaves y28
  for (let i = 0; i <= 22; i++) {
    const y = 6 + i
    const t = i / 22
    const x0 = Math.round(32 - 30 * t)
    const x1 = Math.round(47 + 30 * t)
    hline(day, x0, y, x1 - x0 + 1, 'g')
    put(day, x0, y, '6')
    put(day, x0 + 1, y, '6')
    put(day, x1, y, 'G')
    put(day, x1 - 1, y, 'G')
    if (i % 4 === 2) for (let x = x0 + 2; x <= x1 - 2; x++) if ((x + i * 2) % 6 < 2) put(day, x, y, 'G')
  }
  hline(day, 31, 5, 18, '6')
  hline(day, 2, 29, 76, 'G')
  hline(day, 6, 30, 68, '2')

  // white cross plaque on the roof front
  disc(day, 40, 17, 7, '2')
  disc(day, 40, 17, 6, '0')
  rect(day, 38, 12, 5, 11, 'g')
  rect(day, 35, 15, 11, 5, 'g')
  hline(day, 38, 12, 5, '6')
  vline(day, 35, 15, 5, '6')
  put(night, 40, 17, 'h')

  push('bld_safestride', day, night)
}

/* ================ 7. The Lighthouse (Contact) — 48×120 ================ */
{
  const W = 48
  const H = 120
  const day = grid(W, H)
  const night = grid(W, H)

  // tapered white tower, y40..118 (half-width 10 → 16)
  for (let y = 40; y <= 118; y++) {
    const t = (y - 40) / 78
    const hw = 10 + 6 * t
    const x0 = Math.round(24 - hw)
    const x1 = 47 - x0
    hline(day, x0, y, x1 - x0 + 1, '0')
    put(day, x0, y, '0')
    rect(day, x1 - 2, y, 2, 1, '1')
    put(day, x1, y, 'z')
  }
  // red bands (follow the taper)
  for (const [b0, b1] of [[50, 60], [74, 84]] as const)
    for (let y: number = b0; y <= b1; y++) {
      const t = (y - 40) / 78
      const hw = 10 + 6 * t
      const x0 = Math.round(24 - hw)
      const x1 = 47 - x0
      hline(day, x0, y, x1 - x0 + 1, y === b1 ? 'D' : 'd')
      if (y !== b1) rect(day, x1 - 2, y, 2, 1, 'D')
    }
  // stone skirt + ground line
  hline(day, 6, 112, 36, 'l')
  rect(day, 6, 113, 36, 6, 's')
  put(day, 10, 115, 'S')
  put(day, 20, 116, 'S')
  put(day, 30, 115, 'S')
  put(day, 38, 116, 'S')
  hline(day, 6, 118, 36, 'S')
  hline(day, 6, 119, 36, '#')

  // porthole window
  ring(day, 24, 92, 3.2, 'n')
  disc(day, 24, 92, 2.2, 'i')
  put(day, 23, 91, 'I')
  disc(night, 24, 92, 2.2, 'y')

  // arched door (centre x=24)
  vline(day, 17, 101, 18, 'x')
  vline(day, 31, 101, 18, 'x')
  hline(day, 18, 100, 13, 'x')
  rect(day, 18, 101, 13, 17, 'w')
  put(day, 18, 101, 'x')
  put(day, 30, 101, 'x')
  vline(day, 19, 102, 16, 'W')
  vline(day, 24, 102, 16, 'x')
  put(day, 28, 110, 'Y')
  hline(day, 18, 117, 13, 'x')
  hline(night, 19, 116, 11, 'y')
  halo(night, 18, 110, 13, 8)

  // gallery deck + rail
  rect(day, 10, 38, 28, 3, 'n')
  hline(day, 10, 38, 28, 'm')
  hline(day, 10, 41, 28, 'L')
  hline(day, 10, 31, 28, 'm')
  for (const px of [10, 15, 20, 27, 32, 37]) vline(day, px, 32, 6, 'n')

  // lamp room: glass cage with the great lamp
  rect(day, 15, 16, 18, 15, 'i')
  hline(day, 15, 16, 18, 'I')
  vline(day, 15, 16, 15, 'n')
  vline(day, 32, 16, 15, 'n')
  vline(day, 16, 17, 13, 'I')
  hline(day, 15, 30, 18, 'n')
  rect(day, 20, 20, 8, 8, 'Y')
  rect(day, 21, 21, 6, 6, 'H')
  rect(day, 23, 22, 2, 3, '0')
  hline(day, 20, 27, 8, 'V')
  vline(day, 27, 20, 8, 'V')
  hline(day, 14, 15, 20, 'n')
  // lamp-room night glow (the only night light, per the keeper's rules)
  rect(night, 16, 17, 16, 13, 'y')
  rect(night, 19, 19, 10, 10, 'H')
  rect(night, 22, 21, 4, 5, 'h')
  softDisc(night, 24, 23, 13, '~')

  // red dome + finial
  for (const [dy, dx0, dx1] of [[14, 14, 33], [13, 15, 32], [12, 16, 31], [11, 18, 29], [10, 20, 27], [9, 22, 25]] as const) {
    hline(day, dx0, dy, dx1 - dx0 + 1, 'd')
    put(day, dx1, dy, 'D')
    put(day, dx1 - 1, dy, 'D')
  }
  hline(day, 22, 8, 4, 'D')
  rect(day, 22, 4, 4, 2, 'n')
  vline(day, 23, 2, 2, 'n')
  put(day, 23, 6, 'M')
  put(day, 24, 6, 'M')
  vline(day, 23, 7, 2, 'n')
  vline(day, 24, 7, 2, 'n')

  push('bld_contact', day, night)
}

/* ================ particles ================ */

defs.push({
  name: 'smoke',
  w: 8,
  h: 8,
  legend: {},
  paint: (r) => {
    paintDot(r, K('stoneLight', 210))
    for (let y = 1; y < 5; y++)
      for (let x = 1; x < 5; x++) if (Math.hypot(x - 3, y - 3) < 2.2) setPx(r, x, y, [232, 236, 244, 225])
  },
  anchor: [4, 4],
})

defs.push({
  name: 'door_light',
  w: 24,
  h: 12,
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
  anchor: [12, 6],
})

export const BUILDING_DEFS: SpriteDef[] = defs
