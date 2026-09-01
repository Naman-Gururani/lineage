// Interior tileset + furniture for room scenes (cottage, tower lobby, workshop,
// engine room, vault, clinic, lighthouse), drawn at 32px HD.
//
// Tiles are 32×32, carry no outline and anchor top-left so the room builder can
// lay them with setOrigin(0). Their contrast stays inside two neighbouring ramp
// steps so furniture reads on top of them. Furniture gets the standard 1px
// outline and a bottom-centre anchor (except gear_big and the tool icons, which
// anchor at their centre) and is modelled in the wood ramp's mid-lights.
//
// Light always comes from the top-left, matching env.ts / hero.ts: the top and
// left edge of a mass takes the brighter ramp step, the bottom and right edge
// the darker one. Interior detail is separated by value steps, never by outlines.
import { mirrorDef, type Legend, type SpriteDef } from '../pixel'

const D: SpriteDef[] = []

/** 32×32 room tile: no outline, anchored top-left. */
const tile = (name: string, rows: string[], legend: Legend, frames?: number): void => {
  D.push({ name, rows, legend, anchor: [0, 0], ...(frames ? { frames } : {}) })
}

/** Outlined furniture, anchored bottom-centre of one frame (override via opts). */
const furn = (name: string, rows: string[], legend: Legend, opts: Partial<SpriteDef> = {}): void => {
  const frames = opts.frames ?? 1
  const fw = rows[0].length / frames
  D.push({ name, rows, legend, outline: 'outline', anchor: [fw / 2, rows.length], ...opts })
}

/** Side-by-side frame strips → one row set. */
const join = (...frames: string[][]): string[] => frames[0].map((_, i) => frames.map((f) => f[i]).join(''))

/** Overlay `block` rows into `base` at (x, y) — for per-frame screen/flame variants. */
const splice = (base: string[], x: number, y: number, block: string[]): string[] =>
  base.map((row, i) => {
    const b = block[i - y]
    return b === undefined ? row : row.slice(0, x) + b + row.slice(x + b.length)
  })

/* --------------------------- tiny ASCII canvas -------------------------- *
 * Sprites this size are far easier to keep honest when the shapes are laid
 * down as rectangles, rims and discs than as hand-counted rows; the helpers
 * clip, so every row stays exactly `w` characters wide.
 * ----------------------------------------------------------------------- */

const grid = (w: number, h: number, ch = '.'): string[] => Array.from({ length: h }, () => ch.repeat(w))

/** Write `s` at (x, y), clipped to the canvas. */
const put = (g: string[], x: number, y: number, s: string): void => {
  if (y < 0 || y >= g.length || !s) return
  const w = g[y].length
  let str = s
  let sx = x
  if (sx < 0) {
    str = str.slice(-sx)
    sx = 0
  }
  if (sx >= w) return
  str = str.slice(0, w - sx)
  if (!str) return
  g[y] = g[y].slice(0, sx) + str + g[y].slice(sx + str.length)
}

const hline = (g: string[], x: number, y: number, w: number, ch: string): void => put(g, x, y, ch.repeat(Math.max(0, w)))

const vline = (g: string[], x: number, y: number, h: number, ch: string): void => {
  for (let i = 0; i < h; i++) put(g, x, y + i, ch)
}

const box = (g: string[], x: number, y: number, w: number, h: number, ch: string): void => {
  for (let j = 0; j < h; j++) hline(g, x, y + j, w, ch)
}

/** Rectangular mass lit from the top-left: `lit` along top+left, `shade` bottom+right. */
const slab = (g: string[], x: number, y: number, w: number, h: number, body: string, lit: string, shade: string): void => {
  box(g, x, y, w, h, body)
  hline(g, x, y, w, lit)
  vline(g, x, y, h, lit)
  hline(g, x, y + h - 1, w, shade)
  vline(g, x + w - 1, y, h, shade)
}

/** Filled ellipse — used for cloth, cushions, canopies and lamp glow. */
const disc = (g: string[], cx: number, cy: number, rx: number, ry: number, ch: string): void => {
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    const t = 1 - ((y - cy) / ry) ** 2
    if (t <= 0) continue
    const hw = rx * Math.sqrt(t)
    const x0 = Math.round(cx - hw)
    hline(g, x0, y, Math.round(cx + hw) - x0 + 1, ch)
  }
}

/** Deterministic speckle: cheap plaster / stone / pile texture without dithering. */
const speckle = (g: string[], only: string, ch: string, m: number, r: number): void => {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) if (g[y][x] === only && (x * 7 + y * 13) % m === r) put(g, x, y, ch)
}

/* ================================ floors ================================ */

const PLANKS: Legend = { p: 'wood5', L: 'wood6', d: 'wood4', s: 'wood3' }

/**
 * Horizontal boards 8px deep. The seam is a single darker line with a lit
 * lip under it, so the floor reads as timber rather than brick: everything
 * else stays inside two neighbouring ramp steps.
 */
const plankFloor = (joints: number[], grain: [number, number, number][]): string[] => {
  const g = grid(32, 32, 'p')
  for (let b = 0; b < 4; b++) {
    const y = b * 8
    hline(g, 0, y, 32, 'L')
    hline(g, 0, y + 7, 32, 'd')
    vline(g, joints[b], y + 1, 6, 'd')
  }
  for (const [x, y, n] of grain) put(g, x, y, 'd'.repeat(n))
  return g
}

tile(
  'floor_wood',
  plankFloor(
    [11, 25, 6, 19],
    [[3, 2, 4], [18, 3, 3], [26, 4, 2], [8, 10, 5], [21, 12, 3], [2, 13, 2], [14, 18, 4], [27, 19, 3], [5, 21, 2], [10, 26, 3], [22, 27, 4], [16, 28, 2]],
  ),
  PLANKS,
)

tile(
  'floor_wood_alt',
  plankFloor(
    [3, 17, 28, 13],
    [[7, 2, 3], [20, 4, 4], [12, 5, 2], [24, 9, 3], [4, 11, 4], [15, 12, 2], [9, 17, 3], [26, 18, 2], [19, 20, 4], [6, 25, 3], [17, 26, 2], [28, 27, 3]],
  ),
  PLANKS,
)

const FLAGS: Legend = { s: 'stone4', S: 'stone6', h: 'stone5', d: 'stone3', X: 'stone2' }

/** One flagstone: lit top-left rim, dark bottom-right, a couple of chips. */
const flag = (g: string[], x: number, y: number, w: number, h: number, chips: [number, number][]): void => {
  slab(g, x, y, w, h, 's', 'S', 'd')
  hline(g, x + 1, y + 1, w - 2, 'h')
  for (const [cx, cy] of chips) put(g, x + cx, y + cy, 'd')
}

tile(
  'floor_stone',
  (() => {
    const g = grid(32, 32, 'X')
    flag(g, 0, 0, 15, 15, [[4, 6], [10, 9]])
    flag(g, 16, 0, 15, 15, [[6, 3], [11, 10]])
    flag(g, 0, 16, 22, 15, [[9, 5], [17, 11]])
    flag(g, 23, 16, 8, 15, [[3, 8]])
    return g
  })(),
  FLAGS,
)

tile(
  'floor_tile',
  (() => {
    const g = grid(32, 32, 'E')
    slab(g, 0, 0, 15, 15, 'c', 'C', 'e')
    slab(g, 16, 0, 15, 15, 't', 'L', 'T')
    slab(g, 0, 16, 15, 15, 't', 'L', 'T')
    slab(g, 16, 16, 15, 15, 'c', 'C', 'e')
    return g
  })(),
  { c: 'cream5', C: 'cream6', e: 'cream4', E: 'cream3', t: 'teal5', L: 'teal6', T: 'teal3' },
)

tile(
  'floor_metal',
  (() => {
    const g = grid(32, 32, 'N')
    hline(g, 0, 0, 32, 'M')
    hline(g, 0, 16, 32, 'M')
    hline(g, 0, 15, 32, 'm')
    hline(g, 0, 31, 32, 'm')
    vline(g, 15, 0, 16, 'm')
    vline(g, 31, 16, 16, 'm')
    const stud = (x: number, y: number): void => {
      put(g, x, y, 'R')
      put(g, x - 1, y + 1, 'R')
      put(g, x, y + 1, 'M')
      put(g, x + 1, y + 1, 'm')
      put(g, x, y + 2, 'm')
    }
    for (let row = 0; row < 4; row++) for (let c = 0; c < 4; c++) stud(4 + c * 8 + (row % 2 ? 4 : 0), 3 + row * 8)
    return g
  })(),
  { N: 'metal3', M: 'metal4', R: 'metal5', m: 'metal2' },
)

tile(
  'floor_carpet',
  (() => {
    const g = grid(32, 32, 'r')
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        if (((x >> 1) + (y >> 1)) % 2 === 0) put(g, x, y, 'R')
        if ((x * 5 + y * 3) % 23 === 0) put(g, x, y, 'k')
      }
    return g
  })(),
  { r: 'red2', R: 'red3', k: 'red1' },
)

/* ================================= rugs ================================= */

const RUG: Legend = { b: 'roofRed3', B: 'roofRed2', h: 'roofRed4', P: 'cream4', C: 'cream5', y: 'yellow3' }
const MOTIF = ['...P...', '..PyP..', '.PyhyP.', 'PyhhhyP', '.PyhyP.', '..PyP..', '...P...']

/** Woven rug: pile speckle, two medallions, optional bound edges + fringe. */
const rug = (bottom: boolean, right: boolean): string[] => {
  const g = grid(32, 32, 'b')
  speckle(g, 'b', 'h', 23, 0)
  const medallions: [number, number][] = bottom || right ? [[2, 2], [12, 11]] : [[3, 3], [20, 18]]
  for (const [mx, my] of medallions) for (let i = 0; i < MOTIF.length; i++) put(g, mx, my + i, MOTIF[i])
  if (bottom) {
    box(g, 0, 22, 32, 2, 'B')
    box(g, 0, 24, 32, 3, 'P')
    for (let x = 1; x < 32; x += 4) put(g, x, 25, 'yy')
    box(g, 0, 27, 32, 2, 'B')
    for (let x = 0; x < 32; x++) vline(g, x, 29, 3, x % 4 < 2 ? 'C' : '.')
  }
  if (right) {
    box(g, 22, 0, 2, 32, 'B')
    box(g, 24, 0, 3, 32, 'P')
    for (let y = 1; y < 32; y += 4) vline(g, 25, y, 2, 'y')
    box(g, 27, 0, 2, 32, 'B')
    for (let y = 0; y < 32; y++) hline(g, 29, y, 3, y % 4 < 2 ? 'C' : '.')
    if (bottom) {
      // Mitred corner: the two bound edges meet, fringe only runs off two sides.
      box(g, 22, 22, 10, 7, 'B')
      box(g, 24, 24, 3, 3, 'P')
      for (let x = 22; x < 29; x++) vline(g, x, 29, 3, x % 4 < 2 ? 'C' : '.')
      for (let y = 29; y < 32; y++) hline(g, 29, y, 3, '.')
    }
  }
  return g
}

tile('rug_mid', rug(false, false), RUG)
tile('rug_edge', rug(true, false), RUG)
tile('rug_corner', rug(true, true), RUG)

/* ============================ walls & doors ============================= */

tile(
  'wall_top',
  (() => {
    const g = grid(32, 32, 'D')
    speckle(g, 'D', 's', 29, 0)
    speckle(g, 'D', 'k', 29, 11)
    return g
  })(),
  { D: 'stone2', s: 'stone3', k: 'stone1' },
)

tile(
  'wall_face',
  (() => {
    const g = grid(32, 32, 'w')
    box(g, 0, 0, 32, 2, 'S')
    speckle(g, 'w', 's', 37, 0)
    hline(g, 0, 20, 32, 's')
    hline(g, 0, 22, 32, 's')
    hline(g, 0, 23, 32, 'S')
    box(g, 0, 24, 32, 2, 'W')
    box(g, 0, 26, 32, 4, 'o')
    box(g, 0, 30, 32, 2, 'K')
    vline(g, 10, 24, 6, 'd')
    vline(g, 25, 24, 6, 'd')
    return g
  })(),
  { w: 'wall6', s: 'wall5', S: 'wall4', W: 'wood6', o: 'wood5', d: 'wood3', K: 'wood2' },
)

tile(
  'wall_face_stone',
  (() => {
    const g = grid(32, 32, 'X')
    for (let c = 0; c < 4; c++) {
      const y = c * 8
      const off = c % 2 ? -8 : 0
      for (let i = -1; i < 3; i++) {
        const x = off + i * 16
        if (x + 15 <= 0 || x >= 32) continue
        slab(g, x, y, 15, 7, 's', 'S', 'd')
        hline(g, x + 1, y + 1, 13, 'h')
      }
    }
    speckle(g, 's', 'd', 31, 4)
    return g
  })(),
  FLAGS,
)

tile(
  'wall_face_metal',
  (() => {
    const g = grid(32, 32, 'N')
    hline(g, 0, 0, 32, 'R')
    hline(g, 0, 1, 32, 'M')
    vline(g, 15, 0, 32, 'm')
    vline(g, 16, 0, 32, 'k')
    hline(g, 0, 22, 32, 'm')
    hline(g, 0, 23, 32, 'k')
    hline(g, 0, 24, 32, 'M')
    hline(g, 0, 30, 32, 'm')
    hline(g, 0, 31, 32, 'k')
    for (const [x, y] of [[4, 5], [11, 5], [20, 5], [27, 5], [4, 18], [11, 18], [20, 18], [27, 18], [6, 27], [25, 27]]) {
      put(g, x, y, 'R')
      put(g, x, y + 1, 'm')
    }
    box(g, 20, 12, 3, 2, 't')
    put(g, 20, 12, 'T')
    return g
  })(),
  { N: 'metal3', M: 'metal4', R: 'metal5', m: 'metal2', k: 'metal1', t: 'teal4', T: 'teal6' },
)

tile(
  'door_mat',
  (() => {
    const g = grid(32, 32, 'b')
    for (let ty = 0; ty < 7; ty++)
      for (let tx = 0; tx < 7; tx++) {
        const x = 2 + tx * 4
        const y = 2 + ty * 4
        if ((tx + ty) % 2 === 0) box(g, x, y + 1, 4, 2, 'L')
        else box(g, x + 1, y, 2, 4, 'L')
      }
    box(g, 0, 0, 32, 2, 'B')
    box(g, 0, 30, 32, 2, 'B')
    box(g, 0, 0, 2, 32, 'B')
    box(g, 30, 0, 2, 32, 'B')
    hline(g, 0, 0, 32, 'l')
    vline(g, 0, 0, 32, 'l')
    return g
  })(),
  { b: 'dirt4', B: 'dirt3', l: 'dirt5', L: 'path5' },
)

tile(
  'exit_door',
  (() => {
    const g = grid(32, 32, 'k')
    speckle(g, 'k', 'i', 23, 5)
    box(g, 0, 0, 4, 32, 's')
    box(g, 28, 0, 4, 32, 'd')
    vline(g, 0, 0, 32, 'S')
    vline(g, 31, 0, 32, 'X')
    box(g, 0, 0, 32, 3, 's')
    hline(g, 0, 0, 32, 'S')
    hline(g, 0, 2, 32, 'd')
    box(g, 4, 26, 24, 2, 'y')
    box(g, 4, 28, 24, 2, 'N')
    box(g, 4, 30, 24, 2, 'G')
    return g
  })(),
  { k: 'ink2', i: 'ink3', s: 'stone4', S: 'stone6', d: 'stone3', X: 'stone2', y: 'yellow2', N: 'windowNight', G: 'glowWarm' },
)

/* =============================== windows ================================ */

/** Shared sash: 2px wood frame ring, cross muntin, sill. Panes are painted first. */
const sash = (g: string[]): void => {
  box(g, 0, 0, 32, 2, 'o')
  box(g, 0, 0, 2, 26, 'o')
  box(g, 30, 0, 2, 26, 'o')
  hline(g, 2, 1, 28, 'D')
  hline(g, 0, 0, 32, 'W')
  vline(g, 0, 0, 26, 'W')
  vline(g, 31, 0, 26, 'D')
  box(g, 15, 2, 2, 24, 'o')
  vline(g, 15, 2, 24, 'W')
  vline(g, 16, 2, 24, 'D')
  box(g, 2, 13, 28, 2, 'o')
  hline(g, 2, 13, 28, 'W')
  hline(g, 2, 14, 28, 'D')
  box(g, 0, 26, 32, 4, 'o')
  hline(g, 0, 26, 32, 'W')
  hline(g, 0, 29, 32, 'D')
  box(g, 0, 30, 32, 2, 'K')
}

tile(
  'window_day',
  (() => {
    const g = grid(32, 32, 'o')
    box(g, 2, 2, 28, 11, 'S')
    box(g, 2, 2, 28, 4, 'L')
    disc(g, 7, 6, 4, 2, 'w')
    disc(g, 22, 9, 4, 2, 'w')
    put(g, 5, 8, 'ww')
    box(g, 2, 15, 28, 11, 'G')
    for (const [x, y] of [[3, 17], [4, 18], [5, 19], [18, 16], [19, 17], [20, 18], [21, 19]]) put(g, x, y, 'w')
    box(g, 2, 23, 28, 3, 'L')
    sash(g)
    return g
  })(),
  { o: 'wood5', W: 'wood7', D: 'wood3', K: 'wood2', S: 'glass4', L: 'glass5', G: 'glassLight', w: 'cream6' },
)

tile(
  'window_night',
  (() => {
    const g = grid(32, 32, 'o')
    box(g, 2, 2, 28, 24, 'n')
    box(g, 2, 2, 28, 2, 'N')
    box(g, 2, 24, 28, 2, 'N')
    vline(g, 2, 2, 24, 'N')
    vline(g, 29, 2, 24, 'N')
    for (const [x, y] of [[6, 6], [11, 4], [20, 5], [25, 9], [8, 10], [22, 17], [27, 20], [5, 19], [13, 22], [18, 8]]) put(g, x, y, 'w')
    for (const [x, y] of [[19, 19], [20, 19], [19, 20], [24, 6], [25, 6], [7, 16], [8, 16]]) put(g, x, y, 'g')
    box(g, 4, 20, 3, 4, 'g')
    put(g, 4, 20, 'G')
    box(g, 10, 17, 4, 7, 'v')
    box(g, 11, 19, 2, 2, 'g')
    sash(g)
    return g
  })(),
  { o: 'wood5', W: 'wood7', D: 'wood3', K: 'wood2', n: 'blue1', N: 'windowNight', v: 'blue2', w: 'cream6', g: 'yellow6', G: 'glowWarm' },
)

/* Elevator shaft views: ground, rooftops, cloud deck, rooftop sun. */
const skyView = (paint: (g: string[]) => void): string[] => {
  const g = grid(28, 26, 'S')
  box(g, 0, 0, 28, 6, 'L')
  paint(g)
  return g
}

const SKY_GROUND = skyView((g) => {
  disc(g, 6, 4, 5, 2, 'w')
  disc(g, 20, 8, 4, 2, 'w')
  box(g, 0, 15, 28, 11, 'g')
  hline(g, 0, 15, 28, 'G')
  for (const x of [4, 13, 22]) {
    disc(g, x, 12, 5, 4, 't')
    disc(g, x - 1, 11, 3, 2, 'T')
    box(g, x - 1, 15, 2, 3, 'd')
  }
  for (const [x, y] of [[2, 20], [9, 22], [17, 19], [24, 23], [12, 18], [20, 24]]) put(g, x, y, 'G')
  box(g, 0, 21, 28, 2, 'p')
})

const SKY_MID = skyView((g) => {
  disc(g, 9, 3, 5, 2, 'w')
  box(g, 0, 11, 13, 15, 'c')
  vline(g, 12, 11, 15, 'v')
  box(g, 0, 8, 13, 3, 'j')
  hline(g, 0, 8, 13, 'J')
  hline(g, 0, 10, 13, 'E')
  box(g, 16, 14, 12, 12, 'c')
  vline(g, 27, 14, 12, 'v')
  box(g, 16, 11, 12, 3, 'q')
  hline(g, 16, 11, 12, 'Q')
  hline(g, 16, 13, 12, 'e')
  for (let y = 14; y < 26; y += 4) {
    for (let x = 2; x < 11; x += 4) box(g, x, y, 2, 2, 'n')
    for (let x = 18; x < 26; x += 4) box(g, x, y + 3, 2, 2, 'n')
  }
  box(g, 13, 18, 3, 8, 'v')
})

const SKY_HIGH = skyView((g) => {
  box(g, 0, 0, 28, 26, 'S')
  disc(g, 8, 6, 7, 3, 'w')
  disc(g, 6, 5, 4, 2, 'W')
  disc(g, 21, 12, 6, 3, 'w')
  disc(g, 20, 11, 3, 2, 'W')
  disc(g, 11, 20, 9, 3, 'w')
  disc(g, 9, 19, 5, 2, 'W')
  put(g, 24, 3, 'k')
  put(g, 25, 2, 'k')
  put(g, 26, 3, 'k')
})

const SKY_TOP = skyView((g) => {
  box(g, 0, 0, 28, 26, 'S')
  disc(g, 6, 5, 5, 5, 'Y')
  disc(g, 5, 4, 3, 3, 'y')
  disc(g, 18, 22, 9, 3, 'w')
  disc(g, 6, 24, 7, 2, 'w')
  for (const [x, y] of [[19, 6], [20, 5], [21, 6], [23, 9], [24, 8], [25, 9], [15, 12], [16, 11], [17, 12]]) put(g, x, y, 'k')
})

const shaftFrame = (view: string[]): string[] => {
  const g = grid(32, 32, 'N')
  hline(g, 0, 0, 32, 'R')
  hline(g, 0, 1, 32, 'M')
  vline(g, 0, 0, 32, 'R')
  vline(g, 31, 0, 32, 'm')
  for (let i = 0; i < view.length; i++) put(g, 2, 2 + i, view[i])
  box(g, 0, 28, 32, 2, 'M')
  hline(g, 0, 28, 32, 'R')
  box(g, 0, 30, 32, 2, 'm')
  return g
}

tile('window_sky', join(shaftFrame(SKY_GROUND), shaftFrame(SKY_MID), shaftFrame(SKY_HIGH), shaftFrame(SKY_TOP)), {
  N: 'metal3',
  M: 'metal4',
  R: 'metal5',
  m: 'metal2',
  S: 'glass4',
  L: 'glass5',
  w: 'cream6',
  W: 'cream4',
  g: 'grass5',
  G: 'grass6',
  t: 'leaf4',
  T: 'leaf5',
  d: 'wood2',
  p: 'path4',
  j: 'roofRed4',
  J: 'roofRed5',
  E: 'roofRed3',
  q: 'roofBlue4',
  Q: 'roofBlue5',
  e: 'roofBlue3',
  c: 'wall5',
  v: 'wall4',
  n: 'blue2',
  Y: 'yellow6',
  y: 'glowWarm',
  k: 'ink3',
}, 4)

/* ============================== furniture =============================== */

/** Timber in the wood ramp's mid-lights: W rim, w light, o body, u mid, D shade, K deep. */
const WOOD: Legend = { W: 'wood7', w: 'wood6', o: 'wood5', u: 'wood4', D: 'wood3', K: 'wood2' }
/** Steel: A rim, R light, M body, N mid, m shade, k deep. */
const METAL: Legend = { A: 'metal6', R: 'metal5', M: 'metal4', N: 'metal3', m: 'metal2', k: 'metal1' }
/** Linen & paper. */
const CLOTH: Legend = { C: 'cream6', c: 'cream5', e: 'cream4', E: 'cream3', h: 'cream2' }

furn(
  'bed',
  (() => {
    const g = grid(64, 80)
    slab(g, 1, 2, 62, 13, 'o', 'W', 'D')
    for (const x of [13, 25, 37, 49]) vline(g, x, 4, 9, 'D')
    for (const x of [14, 26, 38, 50]) vline(g, x, 4, 9, 'w')
    slab(g, 1, 14, 62, 62, 'u', 'w', 'K')
    slab(g, 4, 16, 56, 58, 'c', 'C', 'e')
    // two pillows with rounded ends, the right one dented where someone sat
    for (const x of [7, 33]) {
      disc(g, x + 4, 26, 5, 7, 'C')
      disc(g, x + 18, 26, 5, 7, 'C')
      box(g, x + 4, 19, 15, 14, 'C')
      hline(g, x, 32, 24, 'e')
      hline(g, x + 1, 33, 22, 'e')
    }
    put(g, 40, 25, 'eeeeeee')
    put(g, 41, 26, 'eeeee')
    // blanket: turned-down sheet cuff, two soft folds, hem at the foot
    box(g, 5, 35, 54, 37, 't')
    hline(g, 5, 35, 54, 'l')
    vline(g, 5, 35, 37, 'l')
    box(g, 5, 35, 54, 5, 'c')
    hline(g, 5, 35, 54, 'C')
    hline(g, 5, 39, 54, 'e')
    for (const x of [22, 42]) {
      vline(g, x, 40, 32, 'T')
      vline(g, x + 1, 40, 32, 'l')
    }
    hline(g, 5, 66, 54, 'T')
    box(g, 5, 67, 54, 2, 'l')
    hline(g, 5, 71, 54, 'T')
    for (const [x, y] of [[5, 71], [6, 70], [58, 71], [57, 70], [5, 35], [58, 35]]) put(g, x, y, 't')
    // a book left face-down on the covers
    slab(g, 34, 44, 17, 10, 'c', 'C', 'E')
    vline(g, 42, 44, 10, 'E')
    box(g, 34, 53, 17, 2, 'r')
    slab(g, 1, 70, 62, 7, 'o', 'W', 'D')
    hline(g, 1, 76, 62, 'K')
    box(g, 3, 77, 7, 2, 'K')
    box(g, 54, 77, 7, 2, 'K')
    return g
  })(),
  { ...WOOD, ...CLOTH, t: 'teal4', l: 'teal5', T: 'teal3', r: 'red3' },
)

/** Seven code lines that scroll one step between frames, cursor blinking. */
const screen = (lens: number[], cursor: number): string[] => {
  const g = grid(24, 15, 'k')
  lens.forEach((n, i) => hline(g, 1, i * 2 + 1, n, i % 3 === 0 ? 'G' : 'g'))
  hline(g, 1, 13, cursor, 'g')
  put(g, cursor + 1, 13, 'G')
  return g
}

const deskBase = (() => {
  const g = grid(64, 48)
  slab(g, 18, 2, 28, 21, 'N', 'R', 'm')
  box(g, 20, 4, 24, 15, 'k')
  box(g, 30, 23, 4, 3, 'N')
  vline(g, 30, 23, 3, 'R')
  slab(g, 26, 25, 12, 2, 'N', 'R', 'm')
  slab(g, 1, 27, 62, 4, 'o', 'W', 'D')
  box(g, 3, 31, 58, 13, 'u')
  slab(g, 5, 32, 22, 11, 'o', 'w', 'D')
  slab(g, 37, 32, 22, 11, 'o', 'w', 'D')
  box(g, 14, 37, 4, 2, 'y')
  box(g, 46, 37, 4, 2, 'y')
  box(g, 3, 44, 5, 3, 'K')
  box(g, 56, 44, 5, 3, 'K')
  // mug and a paper stack — the desk is in use
  slab(g, 49, 21, 7, 6, 'c', 'C', 'E')
  put(g, 56, 22, 'C')
  put(g, 56, 23, 'E')
  box(g, 50, 21, 5, 1, 'g')
  slab(g, 6, 22, 10, 5, 'C', 'C', 'E')
  hline(g, 7, 24, 7, 'e')
  return g
})()

furn(
  'desk_pc',
  join(
    splice(deskBase, 20, 4, screen([13, 8, 17, 11, 6, 15], 9)),
    splice(deskBase, 20, 4, screen([8, 17, 11, 6, 15, 10], 4)),
  ),
  { ...WOOD, ...METAL, ...CLOTH, g: 'teal4', G: 'teal6', y: 'yellow5' },
  { frames: 2 },
)

/** A run of upright books: varied widths, heights and spines, dark right edge. */
const BOOKS: [string, string][] = [
  ['r', 'R'], ['b', 'B'], ['y', 'Y'], ['t', 'T'], ['p', 'P'], ['n', 'N'], ['g', 'G'], ['c', 'C'],
]
const bookRun = (g: string[], x0: number, x1: number, base: number, tall: number, seed: number): void => {
  let x = x0
  let i = seed
  while (x + 3 <= x1) {
    const w = 3 + ((i * 7) % 3)
    if (x + w > x1) break
    const top = base - tall + ((i * 5) % 4)
    const [body, dark] = BOOKS[(i * 3 + seed) % BOOKS.length]
    box(g, x, top, w, base - top + 1, body)
    vline(g, x + w - 1, top, base - top + 1, dark)
    hline(g, x, top, w, dark)
    if (w > 3) put(g, x + 1, top + 2, dark)
    x += w
    i++
  }
}

furn(
  'bookshelf',
  (() => {
    const g = grid(64, 80)
    slab(g, 1, 1, 62, 5, 'o', 'W', 'D')
    box(g, 1, 6, 4, 71, 'u')
    vline(g, 1, 6, 71, 'w')
    box(g, 59, 6, 4, 71, 'u')
    vline(g, 62, 6, 71, 'K')
    box(g, 5, 6, 54, 71, 'K')
    bookRun(g, 6, 58, 27, 19, 1)
    slab(g, 5, 28, 54, 4, 'o', 'w', 'D')
    bookRun(g, 6, 44, 51, 17, 4)
    // a leaning book and a flat stack fill the gap on the middle shelf
    for (let i = 0; i < 16; i++) {
      const x = 48 - (i >> 2)
      box(g, x, 51 - i, 5, 1, 'b')
      put(g, x + 4, 51 - i, 'B')
    }
    box(g, 53, 48, 6, 2, 'y')
    box(g, 53, 50, 6, 2, 'n')
    slab(g, 5, 52, 54, 4, 'o', 'w', 'D')
    bookRun(g, 6, 58, 74, 16, 6)
    slab(g, 1, 75, 62, 4, 'o', 'W', 'K')
    return g
  })(),
  {
    ...WOOD,
    r: 'red4', R: 'red3', b: 'blue5', B: 'blue3', y: 'yellow5', Y: 'yellow3', t: 'teal4', T: 'teal3',
    p: 'purple4', P: 'purple3', n: 'orange4', N: 'orange3', g: 'leaf4', G: 'leaf3', c: 'cream4', C: 'cream3',
  },
)

furn(
  'table',
  (() => {
    const g = grid(64, 48)
    // pedestal first, so the cloth overlaps it
    box(g, 27, 26, 10, 14, 'u')
    vline(g, 27, 26, 14, 'w')
    vline(g, 36, 26, 14, 'K')
    slab(g, 20, 39, 24, 4, 'o', 'W', 'K')
    hline(g, 22, 43, 20, 'K')
    disc(g, 32, 20, 30, 14, 'c')
    disc(g, 32, 19, 29, 13, 'C')
    disc(g, 32, 22, 29, 12, 'c')
    disc(g, 32, 27, 24, 7, 'e')
    hline(g, 10, 33, 44, 'E')
    for (let x = 8; x < 56; x += 6) put(g, x, 32, 'EE')
    // a plate, a mug and a folded napkin
    disc(g, 24, 20, 7, 4, 'C')
    disc(g, 24, 20, 5, 2, 'e')
    slab(g, 38, 15, 7, 7, 'C', 'C', 'E')
    put(g, 45, 17, 'C')
    put(g, 45, 18, 'E')
    box(g, 39, 15, 5, 1, 't')
    slab(g, 34, 25, 10, 4, 't', 'l', 'T')
    return g
  })(),
  { ...WOOD, ...CLOTH, t: 'teal4', l: 'teal5', T: 'teal3' },
)

const chairL: SpriteDef = {
  name: 'chair_l',
  rows: (() => {
    const g = grid(32, 40)
    // crest rail, back posts and two slats
    slab(g, 3, 3, 12, 5, 'o', 'W', 'D')
    slab(g, 4, 8, 5, 20, 'o', 'W', 'D')
    slab(g, 10, 8, 4, 20, 'u', 'w', 'K')
    slab(g, 6, 12, 6, 4, 'o', 'W', 'D')
    slab(g, 6, 19, 6, 4, 'o', 'W', 'D')
    // seat + cushion
    slab(g, 3, 26, 25, 5, 'o', 'W', 'D')
    box(g, 5, 23, 21, 3, 't')
    hline(g, 5, 23, 21, 'l')
    hline(g, 5, 25, 21, 'T')
    // legs and a stretcher
    slab(g, 5, 31, 5, 7, 'u', 'w', 'K')
    slab(g, 21, 31, 5, 7, 'u', 'w', 'K')
    box(g, 10, 34, 11, 2, 'D')
    hline(g, 10, 34, 11, 'u')
    hline(g, 5, 37, 5, 'K')
    hline(g, 21, 37, 5, 'K')
    return g
  })(),
  legend: { ...WOOD, t: 'teal4', l: 'teal5', T: 'teal3' },
  outline: 'outline',
  anchor: [16, 40],
}
D.push(chairL)
D.push(mirrorDef(chairL, 'chair_r'))

/** Tapered blade with a lit left edge — one frond of the potted plant. */
const blade = (g: string[], x0: number, y0: number, x1: number, y1: number, w0: number, ch: string, lit: string): void => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = Math.round(x0 + (x1 - x0) * t)
    const y = Math.round(y0 + (y1 - y0) * t)
    const w = Math.max(1, Math.round(w0 * (1 - t * 0.85)))
    hline(g, x - (w >> 1), y, w, ch)
    put(g, x - (w >> 1), y, lit)
  }
}

furn(
  'plant',
  (() => {
    const g = grid(32, 56)
    disc(g, 15, 23, 10, 8, 'g')
    disc(g, 13, 20, 6, 5, 'G')
    blade(g, 16, 34, 3, 11, 10, 'g', 'G')
    blade(g, 16, 34, 28, 14, 10, 'd', 'g')
    blade(g, 16, 34, 8, 3, 9, 'G', 'L')
    blade(g, 16, 34, 23, 5, 9, 'g', 'G')
    blade(g, 16, 34, 16, 1, 8, 'G', 'L')
    blade(g, 16, 34, 1, 21, 8, 'd', 'g')
    blade(g, 16, 34, 30, 24, 8, 'd', 'g')
    box(g, 15, 26, 2, 12, 'd')
    // terracotta pot
    slab(g, 5, 36, 22, 5, 'b', 'B', 'k')
    box(g, 7, 41, 18, 12, 'b')
    vline(g, 7, 41, 12, 'B')
    vline(g, 8, 41, 12, 'B')
    box(g, 22, 41, 3, 12, 'k')
    hline(g, 8, 52, 16, 'k')
    box(g, 9, 53, 14, 2, 'k')
    return g
  })(),
  { G: 'leaf5', L: 'leaf6', g: 'leaf4', d: 'leaf3', b: 'brick4', B: 'brick5', k: 'brick2' },
)

const FLAME_A = [
  '.....yy.....',
  '....yyyy....',
  '...yynnyy...',
  '..yynnnnyy..',
  '..ynnxxnny..',
  '.yynnxxnnyy.',
  '.ynnnxxnnny.',
  'ynnnnxxnnnny',
  'annnnnnnnnna',
  'aannnnnnnnaa',
  'raannnnnnaar',
  'rraannnnaarr',
]
const FLAME_B = [
  '......yy....',
  '.....yyyy...',
  '....yynny...',
  '...yynnnyy..',
  '..yynnxxnyy.',
  '..ynnxxxnny.',
  '.yynnxxnnnyy',
  '.ynnnxnnnnny',
  'annnnnnnnnna',
  'aannnnnnnnaa',
  'raannnnnnaar',
  'rraannnnaarr',
]

const fireBase = (() => {
  const g = grid(64, 64)
  // mantel
  slab(g, 1, 2, 62, 6, 'o', 'W', 'D')
  hline(g, 1, 7, 62, 'K')
  // stone breast, coursed
  box(g, 4, 8, 56, 52, 's')
  for (let c = 0; c < 7; c++) {
    const y = 8 + c * 8
    const off = c % 2 ? -8 : 0
    for (let i = 0; i < 5; i++) {
      const x = 4 + off + i * 16
      slab(g, Math.max(4, x), y, Math.min(15, 60 - Math.max(4, x)), 7, 's', 'S', 'd')
    }
  }
  speckle(g, 's', 'd', 31, 4)
  // firebox
  box(g, 15, 24, 34, 34, 'k')
  disc(g, 32, 24, 17, 9, 'k')
  box(g, 15, 52, 34, 6, 'i')
  hline(g, 15, 52, 34, 'k')
  // hearth
  slab(g, 2, 58, 60, 4, 'S', 'S', 'd')
  hline(g, 2, 61, 60, 'd')
  // logs
  slab(g, 19, 48, 26, 5, 'u', 'w', 'K')
  slab(g, 23, 44, 20, 5, 'D', 'u', 'K')
  put(g, 24, 46, 'K')
  put(g, 38, 50, 'K')
  return g
})()

furn(
  'fireplace',
  join(splice(fireBase, 26, 32, FLAME_A), splice(fireBase, 26, 32, FLAME_B)),
  {
    ...WOOD,
    s: 'stone4', S: 'stone5', d: 'stone3', k: 'ink1', i: 'orange1',
    y: 'yellow7', n: 'yellow5', a: 'orange4', r: 'red4', x: 'cream6',
  },
  { frames: 2 },
)

furn(
  'sofa',
  (() => {
    const g = grid(80, 48)
    // back
    slab(g, 3, 8, 74, 20, 't', 'l', 'T')
    vline(g, 39, 10, 17, 'T')
    vline(g, 40, 10, 17, 'l')
    // arms
    slab(g, 1, 12, 11, 28, 't', 'l', 'T')
    slab(g, 68, 12, 11, 28, 't', 'l', 'T')
    // seat cushions
    slab(g, 12, 26, 28, 14, 'l', 'L', 'T')
    slab(g, 40, 26, 28, 14, 'l', 'L', 'T')
    hline(g, 14, 38, 24, 'T')
    hline(g, 42, 38, 24, 'T')
    // skirt + feet
    box(g, 3, 40, 74, 4, 'T')
    hline(g, 3, 40, 74, 't')
    box(g, 6, 44, 6, 3, 'K')
    box(g, 68, 44, 6, 3, 'K')
    // a cushion tossed on the left seat, a blanket over the right arm
    slab(g, 17, 20, 16, 14, 'c', 'C', 'e')
    put(g, 22, 26, 'ee')
    slab(g, 67, 14, 12, 20, 'y', 'Y', 'j')
    vline(g, 71, 15, 18, 'j')
    vline(g, 75, 15, 18, 'j')
    put(g, 67, 14, 't')
    put(g, 78, 14, 'T')
    put(g, 67, 33, 'l')
    put(g, 78, 33, 'T')
    hline(g, 69, 34, 3, 'j')
    hline(g, 74, 34, 3, 'j')
    return g
  })(),
  { ...CLOTH, ...WOOD, t: 'teal4', l: 'teal5', L: 'teal6', T: 'teal3', y: 'yellow5', Y: 'yellow6', j: 'yellow3' },
)

furn(
  'counter',
  (() => {
    const g = grid(96, 48)
    // service bell and a stack of flyers sit on the top slab
    disc(g, 15, 8, 6, 4, 'M')
    disc(g, 13, 7, 4, 2, 'A')
    box(g, 9, 9, 13, 2, 'N')
    hline(g, 9, 10, 13, 'm')
    put(g, 15, 3, 'R')
    put(g, 15, 4, 'R')
    slab(g, 70, 4, 16, 8, 'C', 'C', 'E')
    hline(g, 72, 7, 12, 'e')
    hline(g, 72, 9, 12, 'e')
    slab(g, 0, 12, 96, 6, 'o', 'W', 'D')
    box(g, 3, 18, 90, 26, 'u')
    hline(g, 3, 18, 90, 'K')
    hline(g, 3, 19, 90, 'o')
    for (let x = 12; x < 92; x += 10) {
      vline(g, x, 19, 25, 'D')
      vline(g, x + 1, 19, 25, 'w')
    }
    box(g, 3, 43, 90, 2, 'K')
    box(g, 5, 45, 86, 2, 'K')
    return g
  })(),
  { ...WOOD, ...METAL, ...CLOTH },
)

furn(
  'reception',
  (() => {
    const g = grid(96, 64)
    // hanging sign, hand-lettered
    slab(g, 54, 2, 36, 15, 'C', 'C', 'E')
    box(g, 58, 6, 20, 2, 'k')
    box(g, 58, 10, 26, 2, 'k')
    box(g, 58, 13, 14, 1, 'k')
    box(g, 60, 17, 4, 4, 'u')
    box(g, 82, 17, 4, 4, 'u')
    vline(g, 60, 17, 4, 'w')
    vline(g, 82, 17, 4, 'w')
    // desk lamp
    disc(g, 16, 10, 9, 5, 'y')
    disc(g, 15, 9, 7, 3, 'Y')
    hline(g, 8, 14, 17, 'j')
    box(g, 15, 15, 3, 6, 'N')
    vline(g, 15, 15, 6, 'R')
    slab(g, 0, 20, 96, 6, 'o', 'W', 'D')
    box(g, 4, 26, 88, 28, 'q')
    hline(g, 4, 26, 88, 'Q')
    vline(g, 4, 26, 28, 'Q')
    vline(g, 91, 26, 28, 'e')
    hline(g, 4, 53, 88, 'e')
    for (const x of [10, 52]) {
      slab(g, x, 30, 34, 19, 'e', 'q', 'v')
      hline(g, x + 2, 32, 30, 'q')
    }
    slab(g, 2, 54, 92, 5, 'e', 'q', 'v')
    box(g, 6, 59, 84, 2, 'v')
    return g
  })(),
  {
    ...WOOD,
    ...METAL,
    C: 'cream6', E: 'cream3',
    q: 'roofBlue4', Q: 'roofBlue5', e: 'roofBlue3', v: 'roofBlue2',
    y: 'yellow6', Y: 'glowWarm', j: 'yellow3',
  },
)

/** Metal doors closed / half-open / open onto a lit cabin. */
const elevatorFrame = (doorW: number): string[] => {
  const g = grid(64, 96)
  slab(g, 1, 1, 62, 94, 'N', 'R', 'm')
  box(g, 1, 90, 62, 5, 'm')
  hline(g, 1, 89, 62, 'k')
  // cabin behind the doors
  box(g, 8, 8, 48, 80, 'c')
  box(g, 8, 8, 48, 7, 'G')
  hline(g, 8, 15, 48, 'y')
  box(g, 8, 74, 48, 14, 'e')
  hline(g, 8, 74, 48, 'h')
  hline(g, 8, 50, 48, 'N')
  hline(g, 8, 51, 48, 'm')
  box(g, 26, 30, 12, 20, 'e')
  // doors
  for (const [x, lit] of [[8, true], [56 - doorW, false]] as [number, boolean][]) {
    if (doorW <= 0) continue
    box(g, x, 8, doorW, 80, 'M')
    vline(g, x, 8, 80, lit ? 'R' : 'N')
    vline(g, x + doorW - 1, 8, 80, lit ? 'N' : 'm')
    hline(g, x, 8, doorW, 'R')
    hline(g, x, 87, doorW, 'm')
    if (doorW >= 10) {
      const wx = x + (lit ? 3 : doorW - 9)
      box(g, wx, 24, 6, 16, 'q')
      vline(g, wx, 24, 16, 'Q')
      hline(g, wx, 24, 6, 'Q')
    }
  }
  // floor indicator and call button
  box(g, 24, 3, 16, 4, 'k')
  box(g, 27, 4, 3, 2, 't')
  box(g, 34, 4, 3, 2, 'T')
  box(g, 58, 40, 3, 8, 'k')
  box(g, 58, 41, 3, 3, 't')
  return g
}

furn('elevator', join(elevatorFrame(24), elevatorFrame(14), elevatorFrame(4)), {
  ...METAL,
  c: 'cream5', e: 'cream4', h: 'cream3',
  G: 'glowWarm', y: 'yellow6',
  q: 'glass4', Q: 'glass6',
  t: 'teal5', T: 'teal2',
}, { frames: 3 })

/** Rolling trace across the left screen. */
const wave = (phase: number): string[] => {
  const g = grid(38, 22, 'k')
  for (let x = 0; x < 38; x++) {
    const y = 9 + Math.round(Math.sin((x + phase) * 0.42) * 5 + Math.sin((x + phase) * 0.17) * 2)
    put(g, x, y, 'G')
    put(g, x, y + 1, 'g')
  }
  for (let x = 1; x < 38; x += 4) put(g, x, 19, 'y')
  return g
}

/** Status lamp grid on the right screen. */
const lamps = (seed: number): string[] => {
  const g = grid(38, 22, 'k')
  for (let i = 0; i < 12; i++) {
    const x = 3 + (i % 4) * 9
    const y = 3 + Math.floor(i / 4) * 6
    const s = (i * 5 + seed * 7) % 5
    box(g, x, y, 5, 3, s === 0 ? 'r' : s === 1 ? 'y' : s < 4 ? 'g' : 'm')
    hline(g, x, y, 5, s === 0 ? 'r' : s === 1 ? 'y' : s < 4 ? 'G' : 'N')
  }
  return g
}

const consoleBase = (() => {
  const g = grid(96, 64)
  slab(g, 2, 2, 92, 60, 'N', 'R', 'm')
  box(g, 4, 4, 40, 24, 'k')
  box(g, 50, 4, 40, 24, 'k')
  slab(g, 3, 29, 90, 3, 'm', 'R', 'k')
  box(g, 4, 32, 88, 24, 'M')
  hline(g, 4, 32, 88, 'R')
  // button deck
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * 10
    box(g, x, 36, 6, 4, i % 3 === 0 ? 'r' : i % 3 === 1 ? 'y' : 'g')
    hline(g, x, 36, 6, 'R')
  }
  box(g, 8, 44, 58, 8, 'm')
  for (let i = 0; i < 3; i++) box(g, 70 + i * 6, 36, 4, 16, 'm')
  // vents
  for (let y = 44; y < 52; y += 3) hline(g, 8, y, 58, 'k')
  box(g, 2, 56, 92, 6, 'm')
  hline(g, 2, 56, 92, 'N')
  for (let x = 8; x < 88; x += 12) box(g, x, 58, 6, 2, 'k')
  return g
})()

const conFrame = (phase: number, seed: number, slide: number): string[] => {
  let rows = splice(splice(consoleBase, 4, 4, wave(phase)), 50, 4, lamps(seed))
  for (let i = 0; i < 3; i++) {
    const x = 70 + i * 6
    const y = 37 + ((i * 4 + slide) % 3) * 4
    rows = splice(rows, x, y, ['AAAA', 'RRRR', 'mmmm'])
  }
  return rows
}

furn('console', join(conFrame(0, 0, 0), conFrame(4, 1, 1)), {
  ...METAL,
  g: 'teal4', G: 'teal6', r: 'red4', y: 'yellow5',
}, { frames: 2 })

furn(
  'tank',
  (() => {
    const g = grid(48, 80)
    disc(g, 24, 8, 16, 6, 'M')
    box(g, 8, 8, 32, 58, 'M')
    box(g, 9, 8, 4, 58, 'R')
    vline(g, 10, 8, 58, 'A')
    box(g, 35, 8, 5, 58, 'N')
    vline(g, 39, 8, 58, 'm')
    disc(g, 24, 8, 16, 5, 'R')
    disc(g, 23, 7, 13, 3, 'A')
    for (const y of [22, 46]) {
      box(g, 8, y, 32, 4, 'N')
      hline(g, 8, y, 32, 'R')
      hline(g, 8, y + 3, 32, 'm')
      for (let x = 11; x < 38; x += 6) put(g, x, y + 1, 'A')
    }
    // gauge
    disc(g, 22, 34, 8, 8, 'm')
    disc(g, 22, 34, 6, 6, 'C')
    for (let i = 0; i < 5; i++) put(g, 18 + i * 2, 30, 'k')
    put(g, 25, 31, 'r')
    put(g, 26, 32, 'r')
    for (let i = 0; i < 5; i++) put(g, 22 - i, 34 - i, 'k')
    // stub pipe and legs
    box(g, 20, 2, 8, 6, 'N')
    hline(g, 20, 2, 8, 'R')
    box(g, 12, 66, 8, 11, 'N')
    vline(g, 12, 66, 11, 'R')
    box(g, 28, 66, 8, 11, 'N')
    vline(g, 35, 66, 11, 'm')
    box(g, 10, 76, 12, 3, 'k')
    box(g, 26, 76, 12, 3, 'k')
    return g
  })(),
  { ...METAL, C: 'cream6', r: 'red4' },
)

furn(
  'pipe_h',
  (() => {
    const g = grid(32, 32)
    box(g, 0, 9, 32, 14, 'M')
    hline(g, 0, 9, 32, 'A')
    hline(g, 0, 10, 32, 'R')
    hline(g, 0, 11, 32, 'R')
    hline(g, 0, 19, 32, 'N')
    hline(g, 0, 20, 32, 'N')
    hline(g, 0, 21, 32, 'm')
    hline(g, 0, 22, 32, 'k')
    for (const x of [5, 22]) {
      box(g, x, 7, 5, 18, 'M')
      vline(g, x, 7, 18, 'R')
      vline(g, x + 4, 7, 18, 'm')
      hline(g, x, 7, 5, 'R')
      hline(g, x, 24, 5, 'k')
      put(g, x + 2, 9, 'A')
      put(g, x + 2, 22, 'k')
    }
    return g
  })(),
  METAL,
)

furn(
  'pipe_v',
  (() => {
    const g = grid(32, 32)
    box(g, 9, 0, 14, 32, 'M')
    vline(g, 9, 0, 32, 'A')
    vline(g, 10, 0, 32, 'R')
    vline(g, 11, 0, 32, 'R')
    vline(g, 19, 0, 32, 'N')
    vline(g, 20, 0, 32, 'N')
    vline(g, 21, 0, 32, 'm')
    vline(g, 22, 0, 32, 'k')
    for (const y of [5, 22]) {
      box(g, 7, y, 18, 5, 'M')
      hline(g, 7, y, 18, 'R')
      hline(g, 7, y + 4, 18, 'm')
      vline(g, 7, y, 5, 'R')
      vline(g, 24, y, 5, 'k')
      put(g, 9, y + 2, 'A')
      put(g, 22, y + 2, 'k')
    }
    return g
  })(),
  METAL,
)

/** Big cog: 8 teeth, four lightening holes, bolts orbit 22.5° per frame. */
const gearFrames = (): string[] => {
  const frames: string[][] = []
  for (let f = 0; f < 4; f++) {
    const rot = (f * Math.PI) / 8
    const g = grid(48, 48)
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        const dx = x - 23.5
        const dy = y - 23.5
        const r = Math.hypot(dx, dy)
        const ang = Math.atan2(dy, dx) - rot
        const sector = ang / (Math.PI / 4)
        const frac = Math.abs(sector - Math.round(sector))
        const n = (-dx * 0.55 - dy * 0.83) / Math.max(r, 0.001)
        const shade = n > 0.62 ? 'A' : n > 0.2 ? 'R' : n < -0.55 ? 'm' : 'M'
        let ch = '.'
        if (r < 4) ch = 'k'
        else if (r < 6) ch = 'm'
        else if (r < 8) ch = shade
        else if (r < 17.5) ch = shade
        else if (r < 23 && frac < 0.3) ch = shade
        // four round lightening holes turn with the cog
        for (let j = 0; j < 4; j++) {
          const a = rot + (j * Math.PI) / 2 + Math.PI / 4
          if (Math.hypot(x - (23.5 + Math.cos(a) * 12), y - (23.5 + Math.sin(a) * 12)) < 3.6) ch = '.'
        }
        put(g, x, y, ch)
      }
    for (let j = 0; j < 4; j++) {
      const a = rot + (j * Math.PI) / 2
      const bx = Math.round(23.5 + Math.cos(a) * 12)
      const by = Math.round(23.5 + Math.sin(a) * 12)
      box(g, bx - 1, by - 1, 2, 2, 'm')
      put(g, bx - 1, by - 1, 'k')
    }
    frames.push(g)
  }
  return join(...frames)
}

furn('gear_big', gearFrames(), METAL, { frames: 4, anchor: [24, 24] })

furn(
  'workbench',
  (() => {
    const g = grid(96, 56)
    // vice on the left, a mallet and a jar of bits on the right
    box(g, 6, 8, 14, 8, 'N')
    hline(g, 6, 8, 14, 'R')
    box(g, 10, 4, 6, 4, 'M')
    hline(g, 10, 4, 6, 'A')
    box(g, 20, 10, 8, 3, 'm')
    slab(g, 70, 6, 5, 12, 'u', 'w', 'K')
    slab(g, 64, 2, 17, 6, 'D', 'u', 'K')
    slab(g, 84, 8, 8, 8, 'M', 'A', 'm')
    hline(g, 85, 10, 6, 'y')
    slab(g, 0, 16, 96, 8, 'o', 'W', 'D')
    hline(g, 0, 23, 96, 'K')
    box(g, 4, 24, 88, 22, 'u')
    hline(g, 4, 24, 88, 'o')
    for (let x = 13; x < 90; x += 11) {
      vline(g, x, 25, 21, 'D')
      vline(g, x + 1, 25, 21, 'w')
    }
    // drawer with a brass pull
    slab(g, 52, 27, 34, 15, 'o', 'w', 'K')
    box(g, 64, 33, 10, 3, 'y')
    hline(g, 64, 33, 10, 'Y')
    box(g, 6, 46, 10, 8, 'u')
    vline(g, 6, 46, 8, 'w')
    box(g, 80, 46, 10, 8, 'u')
    vline(g, 89, 46, 8, 'K')
    hline(g, 6, 53, 10, 'K')
    hline(g, 80, 53, 10, 'K')
    box(g, 16, 48, 64, 3, 'D')
    hline(g, 16, 48, 64, 'u')
    return g
  })(),
  { ...WOOD, ...METAL, y: 'yellow5', Y: 'yellow6' },
)

furn(
  'toolwall',
  (() => {
    const g = grid(128, 80)
    slab(g, 0, 0, 128, 80, 'u', 'W', 'K')
    box(g, 4, 4, 120, 72, 'e')
    hline(g, 4, 4, 120, 'E')
    vline(g, 4, 4, 72, 'E')
    hline(g, 4, 75, 120, 'c')
    for (let y = 10; y < 74; y += 8)
      for (let x = 10; x < 122; x += 8) {
        box(g, x, y, 2, 2, 'h')
        hline(g, x, y + 2, 2, 'c')
      }
    for (const x of [16, 40, 64, 88, 112]) {
      for (const y of [20, 52]) {
        box(g, x - 1, y, 2, 5, 'N')
        vline(g, x - 1, y, 5, 'R')
        box(g, x - 3, y + 5, 6, 2, 'N')
        hline(g, x - 3, y + 5, 6, 'R')
      }
    }
    return g
  })(),
  { ...WOOD, ...METAL, c: 'cream4', e: 'cream3', E: 'cream4', h: 'cream2' },
)

/* ------------------------- tool icons (24×24) -------------------------- */
// Small hangable badges: everyday objects, no real-world logos.

/** Centre a hand-drawn block inside the 24×24 icon cell. */
const iconCell = (art: string[]): string[] => {
  const g = grid(24, 24)
  const w = Math.max(...art.map((r) => r.length))
  const x0 = Math.floor((24 - w) / 2)
  const y0 = Math.floor((24 - art.length) / 2)
  art.forEach((r, i) => put(g, x0, y0 + i, r))
  return g
}

const icon = (name: string, art: string[], legend: Legend): void => furn(name, iconCell(art), legend, { anchor: [12, 12] })

icon(
  'tool_java', // coffee cup with steam
  [
    '...s...s........',
    '..s...s.........',
    '...s...s........',
    '..s...s.........',
    '................',
    '.CCCCCCCCCC.....',
    '.CwwwwwwwwC.MMM.',
    '.CwwwwwwwwCMM.MM',
    '.CwwwwwwwwCM...M',
    '.CeewwwwwwCM...M',
    '.CeeeewwwwCMM.MM',
    '.CeeeeeewwC.MMM.',
    '.CeeeeeeeeC.....',
    '..CeeeeeeC......',
    '...CCCCCC.......',
    '.hhhhhhhhhh.....',
  ],
  { s: 'grey5', C: 'cream6', w: 'cream5', e: 'cream4', h: 'cream3', M: 'grey4' },
)

icon(
  'tool_spring', // fresh leaf
  [
    '..........GGG...',
    '........GGGGGG..',
    '......GGGGdGGG..',
    '.....GGGGdGGGG..',
    '....GGGGdGGGGG..',
    '...gGGGdGGGGGg..',
    '..gggGdGGGGgg...',
    '..ggGdGGGggg....',
    '.gggdGGgggg.....',
    '.ggdGgggggg.....',
    '.gdggggggg......',
    '.dgggggg........',
    'd.gggg..........',
    'd...............',
  ],
  { G: 'leaf5', g: 'leaf4', d: 'leaf3' },
)

icon(
  'tool_python', // little snake
  [
    '..GGGG..........',
    '.GGggGGGGGGGG...',
    '.GkgggggggggGG..',
    'r.gggggggggggG..',
    '...........ggG..',
    '..GGGGGGGGGGgG..',
    '.GGggggggggggg..',
    '.Ggg............',
    '.Ggg............',
    '.GGGGGGGGGGGG...',
    '..ggggggggggG...',
    '...........gG...',
  ],
  { G: 'leaf5', g: 'leaf4', k: 'ink2', r: 'red4' },
)

icon(
  'tool_cpp', // shield with two plus marks
  [
    '.BBBBBBBBBBBB.',
    'BbbbbbbbbbbbbB',
    'BbbbwbbbbbbbbB',
    'BbbbwbbbbwbbbB',
    'BbwwwwwbbwbbbB',
    'BbbbwbbwwwwwbB',
    'BbbbwbbbbwbbbB',
    'BbbbbbbbbwbbbB',
    'BbbbbbbbbbbbbB',
    'BbbbbbbbbbbbbB',
    'BbbbbbbbbbbbbB',
    '.BbbbbbbbbbbB.',
    '..BbbbbbbbbB..',
    '...BbbbbbbB...',
    '....BbbbbB....',
    '.....BbbB.....',
    '......BB......',
  ],
  { b: 'blue5', B: 'blue3', w: 'cream6' },
)

icon(
  'tool_sql', // database cylinder
  [
    '...tttttttt...',
    '..LttttttttT..',
    '.LttttttttttT.',
    '.LttttttttttT.',
    '.TTTTTTTTTTTT.',
    '.LttttttttttT.',
    '.LttttttttttT.',
    '.TTTTTTTTTTTT.',
    '.LttttttttttT.',
    '.LttttttttttT.',
    '..TTTTTTTTTT..',
    '...TTTTTTTT...',
  ],
  { t: 'teal4', L: 'teal6', T: 'teal2' },
)

icon(
  'tool_kafka', // writer's quill
  [
    '............ww..',
    '..........wwww..',
    '.........wwwww..',
    '........wwwwww..',
    '.......wwwwwww..',
    '......wwwwwww...',
    '.....wwwwwww....',
    '....wwwwwww.....',
    '...swwwwww......',
    '..sswwwww.......',
    '..sswwww........',
    '.ssww...........',
    '.ss.............',
    'k...............',
  ],
  { w: 'cream6', s: 'grey4', k: 'ink3' },
)

icon(
  'tool_flink', // fast-forward chevrons
  [
    'n.....n.........',
    'nn....nn........',
    'nnn...nnn.......',
    'annn..annn......',
    'aannn.aannn.....',
    'aaannnaaannn....',
    'aaannnaaannn....',
    'aannn.aannn.....',
    'annn..annn......',
    'nnn...nnn.......',
    'nn....nn........',
    'n.....n.........',
  ],
  { n: 'orange4', a: 'orange5' },
)

icon(
  'tool_kstreams', // flowing stream lines
  [
    'LL...tt...tt..',
    '..ttt..ttt....',
    '..............',
    'LL...tt...tt..',
    '..ttt..ttt....',
    '..............',
    'LL...tt...tt..',
    '..ttt..ttt....',
    '..............',
    'LL...tt...tt..',
    '..ttt..ttt....',
  ],
  { t: 'teal4', L: 'teal6' },
)

icon(
  'tool_mq', // envelope
  [
    'CCCCCCCCCCCCCC',
    'CeCCCCCCCCCCeC',
    'CCeeCCCCCCee.C',
    'CCCeeeCCeee..C',
    'CCCCCeeee....C',
    'CCCCCCCCCCCCCC',
    'CeeCCCCCCCCeeC',
    'CCCeeCCCCeeCCC',
    'eeeeeeeeeeeeee',
  ],
  { C: 'cream6', e: 'cream3' },
)

icon(
  'tool_redis', // stacked slabs
  [
    '..rrrrrrrrrr..',
    '.rrrrrrrrrrrr.',
    '.RRRRRRRRRRRR.',
    '..RRRRRRRRRR..',
    '..............',
    '..rrrrrrrrrr..',
    '.rrrrrrrrrrrr.',
    '.RRRRRRRRRRRR.',
    '..RRRRRRRRRR..',
    '..............',
    '..rrrrrrrrrr..',
    '.rrrrrrrrrrrr.',
    '.RRRRRRRRRRRR.',
    '..RRRRRRRRRR..',
  ],
  { r: 'red4', R: 'red2' },
)

icon(
  'tool_dynamo', // lightning bolt
  [
    '......YYYY..',
    '.....YYYYy..',
    '....YYYYy...',
    '...YYYYy....',
    '..YYYYy.....',
    '..YYYYYYYY..',
    '...yYYYYYy..',
    '.....YYYYy..',
    '....YYYYy...',
    '...YYYy.....',
    '..YYy.......',
    '..y.........',
  ],
  { Y: 'yellow5', y: 'yellow3' },
)

icon(
  'tool_docker', // ridged shipping container
  [
    'QQQQQQQQQQQQQQ',
    'qqqqqqqqqqqqqq',
    'qQqQqQqQqQqQqq',
    'qQqQqQqQqQqQqq',
    'qQqQqQqQqQqQqq',
    'qQqQqQqQqQqQqq',
    'qQqQqQqQqQqQqq',
    'qQqQqQqQqQqQqq',
    'qQqQqQqQqQqQqq',
    'eeeeeeeeeeeeee',
  ],
  { q: 'roofBlue4', Q: 'roofBlue3', e: 'roofBlue2' },
)

icon(
  'tool_linux', // terminal with a prompt
  [
    'RRRRRRRRRRRRRR',
    'RkkkkkkkkkkkkR',
    'RkGkkkkkkkkkkR',
    'RkkGkkkkkkkkkR',
    'RkGkkkkkkkkkkR',
    'RkkkkkkkkkkkkR',
    'RkkGGGkkkkkkkR',
    'RkkkkkkkkkkkkR',
    'RkkkkkkkkkkkkR',
    'NNNNNNNNNNNNNN',
    '...mmmmmmmm...',
  ],
  { R: 'metal5', N: 'metal3', m: 'metal2', k: 'ink1', G: 'grass6' },
)

icon(
  'tool_git', // commit graph: trunk, a branch out and a merge back
  [
    '.nnn........',
    '.nnn........',
    '..s.........',
    '..s.........',
    '.nnn.sssss..',
    '.nnn.....s..',
    '..s.....nnn.',
    '..s.....nnn.',
    '..s.....ss..',
    '.nnn.ssss...',
    '.nnn........',
    '..s.........',
    '.nnn........',
    '.nnn........',
  ],
  { n: 'orange4', s: 'grey4' },
)

/* ---------------------- lighthouse, vault, clinic ---------------------- */

// A Fresnel drum: straight sides, rounded shoulders, horizontal prism rings.
const lensBase = (() => {
  const g = grid(64, 64)
  for (let y = 9; y <= 53; y++) {
    const dy = y < 15 ? 15 - y : y > 47 ? y - 47 : 0
    const inset = dy ? 6 - Math.round(Math.sqrt(Math.max(0, 36 - dy * dy))) : 0
    hline(g, 11 + inset, y, 42 - inset * 2, 'a')
    hline(g, 11 + inset, y, 3, 'L')
    hline(g, 49 - inset, y, 4, 'A')
  }
  for (let y = 14; y < 50; y += 5) {
    for (let x = 8; x < 56; x++) if (g[y][x] !== '.') put(g, x, y, 'L')
    for (let x = 8; x < 56; x++) if (g[y + 1][x] === 'a') put(g, x, y + 1, 'A')
  }
  for (const x of [9, 51]) {
    box(g, x, 9, 3, 45, 'N')
    vline(g, x, 9, 45, 'R')
    vline(g, x + 2, 9, 45, 'm')
  }
  slab(g, 10, 2, 44, 8, 'N', 'R', 'm')
  hline(g, 12, 9, 40, 'k')
  slab(g, 6, 53, 52, 8, 'N', 'R', 'm')
  hline(g, 8, 60, 48, 'k')
  return g
})()

const LENS_DIM = [
  '..dddddddd..',
  '.dyyyyyyyyd.',
  'dyyyyyyyyyyd',
  'dyyyyxxyyyyd',
  'dyyyyxxyyyyd',
  'dyyyyyyyyyyd',
  '.dyyyyyyyyd.',
  '..dddddddd..',
]
const LENS_CORE = [
  '....GGGGGGGGGG....',
  '..GGGyyyyyyyyGGG..',
  '.GGyyyyyyyyyyyyGG.',
  'GGyyyyyyxxxxyyyyGG',
  'Gyyyyyxxxxxxxxyyyy',
  'Gyyyyxxxxxxxxxxyyy',
  'Gyyyyxxxxxxxxxxyyy',
  'Gyyyyyxxxxxxxxyyyy',
  'GGyyyyyyxxxxyyyyGG',
  '.GGyyyyyyyyyyyyGG.',
  '..GGGyyyyyyyyGGG..',
  '....GGGGGGGGGG....',
]

// Lit frame: the whole prism stack goes warm, then the core is spliced in.
const lensBright = (() => {
  const warm: Record<string, string> = { a: 'y', L: 'G', A: 'd' }
  const rows = lensBase.map((r) => r.split('').map((c) => warm[c] ?? c).join(''))
  return splice(rows, 23, 25, LENS_CORE)
})()

furn('lens', join(splice(lensBase, 26, 27, LENS_DIM), lensBright), {
  ...METAL,
  a: 'glass4', L: 'glass6', A: 'glass5',
  y: 'yellow5', d: 'yellow3', x: 'cream6', G: 'glowWarm',
}, { frames: 2 })

furn(
  'stairs',
  (() => {
    const g = grid(64, 64)
    const steps: [number, number, number][] = [
      [1, 34, 55], [6, 34, 47], [13, 32, 39], [20, 30, 31], [27, 26, 23], [33, 24, 15],
    ]
    for (const [x, w, top] of steps) {
      hline(g, x, top, w, 'S')
      box(g, x, top + 1, w, 4, 's')
      vline(g, x, top, 5, 'S')
      hline(g, x + 1, top + 1, w - 2, 'h')
      box(g, x, top + 5, w, 3, 'd')
      hline(g, x, top + 7, w, 'X')
    }
    speckle(g, 's', 'd', 37, 4)
    return g
  })(),
  FLAGS,
)

const mapBase = (() => {
  const g = grid(64, 48)
  slab(g, 1, 1, 62, 46, 'N', 'R', 'm')
  box(g, 4, 4, 56, 38, 'n')
  for (let x = 8; x < 60; x += 10) vline(g, x, 5, 36, 'v')
  for (let y = 8; y < 42; y += 9) hline(g, 5, y, 54, 'v')
  disc(g, 30, 23, 21, 13, 's')
  disc(g, 30, 22, 18, 11, 'g')
  disc(g, 26, 20, 7, 4, 'G')
  disc(g, 44, 30, 5, 3, 's')
  hline(g, 4, 43, 56, 'k')
  box(g, 6, 44, 8, 2, 'm')
  return g
})()

furn(
  'mapscreen',
  join(splice(mapBase, 40, 16, ['rr', 'rr']), splice(mapBase, 40, 16, ['gg', 'gg'])),
  { ...METAL, n: 'blue1', v: 'blue2', s: 'sand5', g: 'grass4', G: 'grass6', r: 'red4' },
  { frames: 2 },
)

furn(
  'sos_button',
  (() => {
    const g = grid(32, 32)
    slab(g, 1, 1, 30, 26, 'N', 'R', 'm')
    disc(g, 16, 14, 11, 10, 'q')
    disc(g, 16, 14, 10, 9, 'r')
    disc(g, 13, 11, 5, 4, 'p')
    disc(g, 12, 10, 2, 2, 'C')
    hline(g, 6, 22, 20, 'q')
    box(g, 1, 27, 30, 3, 'm')
    for (let x = 2; x < 30; x += 4) box(g, x, 27, 2, 3, 'y')
    return g
  })(),
  { ...METAL, r: 'red4', q: 'red2', p: 'red5', C: 'cream6', y: 'yellow3' },
)

const crateBase = (() => {
  const g = grid(80, 64)
  for (let y = 6; y < 14; y++) {
    const inset = 8 - (y - 6)
    hline(g, 4 + inset, y, 72 - inset * 2, 'p')
    hline(g, 4 + inset, y, 4, 'P')
  }
  hline(g, 12, 6, 56, 'P')
  box(g, 4, 14, 72, 44, 'p')
  hline(g, 4, 14, 72, 'P')
  vline(g, 4, 14, 44, 'P')
  vline(g, 5, 14, 44, 'P')
  box(g, 70, 14, 6, 44, 'k')
  // folds fanning down from the crate's corners
  for (let i = 0; i < 44; i++) {
    put(g, 20 - (i >> 2), 14 + i, 'k')
    put(g, 21 - (i >> 2), 14 + i, 'P')
    put(g, 56 + (i >> 2), 14 + i, 'k')
    put(g, 55 + (i >> 2), 14 + i, 'P')
  }
  // scalloped hem
  box(g, 4, 55, 72, 3, 'k')
  for (let x = 4; x < 76; x += 6) hline(g, x, 58, 3, 'k')
  return g
})()

const CRATE_TAG = [
  '.....e.....',
  '....e......',
  '.CCCCCCCCC.',
  '.CEEEEEEEC.',
  '.CEECCCEEC.',
  '.CEEEECCEC.',
  '.CEEECCEEC.',
  '.CEEEEEEEC.',
  '.CEEECEEEC.',
  '.CCCCCCCCC.',
]

furn('crate_covered', splice(crateBase, 58, 30, CRATE_TAG), {
  p: 'purple4', P: 'purple5', k: 'purple2', C: 'cream5', E: 'cream2', e: 'cream4',
})

furn(
  'poster_a', // stream diagram pinned to the wall
  (() => {
    const g = grid(32, 40)
    slab(g, 1, 1, 30, 38, 'C', 'C', 'E')
    vline(g, 5, 6, 24, 'k')
    hline(g, 5, 29, 22, 'k')
    let y = 27
    for (let x = 7; x < 27; x++) {
      if (x % 3 === 0 && y > 9) y--
      put(g, x, y, 't')
      put(g, x, y - 1, 'T')
    }
    box(g, 24, 8, 3, 3, 'r')
    box(g, 6, 33, 12, 2, 'E')
    box(g, 6, 36, 18, 2, 'E')
    box(g, 8, 3, 16, 2, 'k')
    for (const x of [3, 28]) {
      box(g, x, 2, 2, 2, 'm')
      put(g, x, 2, 'R')
    }
    put(g, 30, 37, '.')
    put(g, 29, 38, '.')
    put(g, 30, 38, '.')
    put(g, 28, 38, 'E')
    put(g, 29, 37, 'E')
    return g
  })(),
  { ...METAL, C: 'cream6', E: 'cream3', k: 'ink3', t: 'teal4', T: 'teal6', r: 'red4' },
)

furn(
  'poster_b', // island map with a red X
  (() => {
    const g = grid(32, 40)
    slab(g, 1, 1, 30, 38, 'C', 'C', 'E')
    box(g, 3, 5, 26, 30, 'b')
    for (let y = 7; y < 34; y += 4) hline(g, 4, y, 24, 'B')
    disc(g, 14, 18, 9, 8, 's')
    disc(g, 14, 17, 7, 6, 'g')
    disc(g, 12, 15, 3, 2, 'G')
    box(g, 21, 25, 2, 2, 'r')
    box(g, 23, 27, 2, 2, 'r')
    box(g, 23, 25, 2, 2, 'r')
    box(g, 21, 27, 2, 2, 'r')
    box(g, 8, 3, 16, 1, 'k')
    for (const x of [3, 28]) {
      box(g, x, 2, 2, 2, 'm')
      put(g, x, 2, 'R')
    }
    return g
  })(),
  { ...METAL, C: 'cream6', E: 'cream3', k: 'ink3', b: 'glass4', B: 'glass5', s: 'sand5', g: 'grass4', G: 'grass6', r: 'red4' },
)

furn(
  'lamp_table',
  (() => {
    const g = grid(24, 40)
    for (let y = 4; y < 15; y++) {
      const hw = 3 + (y - 4)
      hline(g, 12 - hw, y, hw * 2, 'y')
      hline(g, 12 - hw, y, 2, 'Y')
    }
    hline(g, 2, 15, 20, 'j')
    hline(g, 3, 16, 18, 'G')
    box(g, 11, 16, 3, 16, 'N')
    vline(g, 11, 16, 16, 'R')
    slab(g, 6, 32, 13, 4, 'N', 'R', 'm')
    box(g, 5, 36, 15, 2, 'k')
    return g
  })(),
  { ...METAL, y: 'yellow5', Y: 'yellow6', j: 'yellow3', G: 'glowWarm' },
)

furn(
  'kettle',
  (() => {
    const g = grid(24, 24)
    // spout, then the body over it, then lid and handle
    for (let i = 0; i < 6; i++) {
      hline(g, 2 + i, 11 - i, 6, 'M')
      put(g, 2 + i, 11 - i, 'R')
      put(g, 7 + i, 12 - i, 'N')
    }
    disc(g, 13, 15, 8, 6, 'M')
    box(g, 5, 12, 16, 5, 'M')
    disc(g, 10, 12, 5, 3, 'R')
    disc(g, 9, 11, 2, 1, 'A')
    for (let y = 12; y < 21; y++) hline(g, 19 - Math.max(0, y - 17), y, 3, 'N')
    vline(g, 20, 13, 5, 'm')
    box(g, 8, 8, 11, 4, 'N')
    hline(g, 8, 8, 11, 'R')
    box(g, 11, 5, 5, 3, 'N')
    hline(g, 11, 5, 5, 'A')
    for (let i = 0; i <= 12; i++) {
      const y = 8 - Math.round(Math.sin((i / 12) * Math.PI) * 5)
      put(g, 6 + i, y, 'R')
      put(g, 6 + i, y + 1, 'm')
    }
    hline(g, 7, 20, 12, 'm')
    hline(g, 8, 21, 10, 'k')
    return g
  })(),
  METAL,
)

furn(
  'frame_photo',
  (() => {
    const g = grid(24, 24)
    slab(g, 1, 1, 22, 22, 'o', 'W', 'K')
    box(g, 4, 4, 16, 16, 'S')
    box(g, 4, 13, 16, 7, 'g')
    hline(g, 4, 13, 16, 'G')
    disc(g, 8, 6, 3, 2, 'C')
    box(g, 8, 10, 3, 5, 't')
    put(g, 8, 8, 'ss')
    put(g, 8, 9, 'ss')
    box(g, 13, 11, 3, 4, 'p')
    put(g, 13, 9, 'ss')
    put(g, 13, 10, 'ss')
    return g
  })(),
  { ...WOOD, S: 'glass4', C: 'cream6', g: 'grass4', G: 'grass6', s: 'skin5', t: 'teal4', p: 'purple4' },
)

furn(
  'whiteboard',
  (() => {
    const g = grid(80, 56)
    slab(g, 2, 1, 76, 41, 'N', 'A', 'm')
    box(g, 5, 4, 70, 35, 'C')
    hline(g, 5, 4, 70, 'W')
    // a boxes-and-arrows sketch, plus a red circle someone drew round the answer
    for (const [x, y] of [[10, 9], [34, 9], [58, 9]]) {
      box(g, x, y, 14, 10, 'C')
      hline(g, x, y, 14, 't')
      hline(g, x, y + 9, 14, 't')
      vline(g, x, y, 10, 't')
      vline(g, x + 13, y, 10, 't')
      hline(g, x + 3, y + 4, 8, 'e')
    }
    for (const x of [25, 49]) {
      hline(g, x, 14, 8, 'k')
      put(g, x + 6, 13, 'k')
      put(g, x + 6, 15, 'k')
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      put(g, Math.round(41 + Math.cos(a) * 13), Math.round(29 + Math.sin(a) * 7), 'r')
    }
    hline(g, 12, 26, 16, 'k')
    hline(g, 12, 30, 11, 'k')
    hline(g, 12, 34, 14, 'k')
    for (let x = 56; x < 72; x += 5) box(g, x, 26, 3, 9, 'G')
    slab(g, 4, 42, 72, 4, 'N', 'R', 'm')
    box(g, 12, 43, 9, 2, 'r')
    box(g, 26, 43, 9, 2, 't')
    box(g, 14, 46, 6, 8, 'm')
    box(g, 60, 46, 6, 8, 'm')
    hline(g, 12, 54, 10, 'k')
    hline(g, 58, 54, 10, 'k')
    return g
  })(),
  { ...METAL, C: 'cream6', W: 'white', e: 'cream3', k: 'ink3', t: 'teal4', r: 'red4', G: 'leaf4' },
)

const rackBase = (() => {
  const g = grid(48, 80)
  slab(g, 1, 1, 46, 76, 'N', 'R', 'm')
  box(g, 4, 4, 40, 70, 'k')
  for (let u = 0; u < 6; u++) {
    const y = 5 + u * 11
    slab(g, 5, y, 38, 10, 'M', 'R', 'm')
    box(g, 7, y + 2, 13, 6, 'k')
    for (let i = 0; i < 6; i++) vline(g, 8 + i * 2, y + 2, 6, 'N')
    box(g, 33, y + 2, 8, 6, 'm')
    hline(g, 33, y + 2, 8, 'N')
  }
  box(g, 2, 71, 44, 5, 'm')
  hline(g, 2, 71, 44, 'N')
  box(g, 4, 77, 6, 2, 'k')
  box(g, 38, 77, 6, 2, 'k')
  return g
})()

const LED_ROWS: [number, string][] = [[0, 'gkrkg'], [1, 'gkgkr'], [2, 'rkgkg'], [3, 'gkgkg'], [4, 'kkgkr'], [5, 'gkrkk']]
const rackLeds = (shift: number): string[] =>
  LED_ROWS.reduce((rows, [u, pat]) => {
    const s = pat.slice(shift % 5) + pat.slice(0, shift % 5)
    return splice(rows, 23, 9 + u * 11, [s.split('').join('')])
  }, rackBase)

furn('server_rack', join(rackLeds(0), rackLeds(2)), { ...METAL, g: 'teal5', r: 'red4' }, { frames: 2 })

furn(
  'cabinet',
  (() => {
    const g = grid(48, 64)
    slab(g, 1, 1, 46, 6, 'o', 'W', 'D')
    box(g, 3, 7, 42, 50, 'u')
    hline(g, 3, 7, 42, 'K')
    for (const x of [4, 24]) {
      slab(g, x, 9, 20, 46, 'o', 'w', 'D')
      slab(g, x + 3, 13, 14, 17, 'u', 'D', 'w')
      slab(g, x + 3, 34, 14, 17, 'u', 'D', 'w')
    }
    box(g, 21, 28, 2, 5, 'y')
    box(g, 25, 28, 2, 5, 'y')
    hline(g, 21, 28, 2, 'Y')
    hline(g, 25, 28, 2, 'Y')
    box(g, 2, 57, 44, 3, 'D')
    hline(g, 2, 57, 44, 'u')
    box(g, 4, 60, 8, 2, 'K')
    box(g, 36, 60, 8, 2, 'K')
    return g
  })(),
  { ...WOOD, y: 'yellow5', Y: 'yellow6' },
)

/* ------------------- campus set (lecture hall, library) ----------------- */

furn(
  'int_desk', // school desk with its bench, seen from the front-left
  (() => {
    const g = grid(64, 48)
    // bench behind
    slab(g, 8, 20, 48, 4, 'o', 'W', 'D')
    box(g, 12, 24, 4, 12, 'u')
    vline(g, 12, 24, 12, 'w')
    box(g, 48, 24, 4, 12, 'u')
    vline(g, 51, 24, 12, 'K')
    // desk top: a slight slope, with a pencil groove and a lifted lid edge
    slab(g, 2, 10, 60, 7, 'o', 'W', 'D')
    hline(g, 4, 12, 56, 'w')
    hline(g, 6, 15, 52, 'D')
    box(g, 4, 17, 56, 3, 'u')
    hline(g, 4, 19, 56, 'K')
    // legs
    box(g, 6, 20, 5, 24, 'N')
    vline(g, 6, 20, 24, 'R')
    box(g, 53, 20, 5, 24, 'N')
    vline(g, 57, 20, 24, 'm')
    box(g, 11, 30, 42, 3, 'N')
    hline(g, 11, 30, 42, 'R')
    hline(g, 4, 44, 9, 'k')
    hline(g, 51, 44, 9, 'k')
    // an open notebook and a pencil left on top
    slab(g, 18, 4, 28, 7, 'C', 'C', 'E')
    vline(g, 31, 4, 7, 'E')
    hline(g, 21, 7, 8, 'e')
    hline(g, 34, 7, 8, 'e')
    box(g, 48, 8, 10, 2, 'y')
    put(g, 47, 8, 'j')
    put(g, 47, 9, 'j')
    return g
  })(),
  { ...WOOD, ...METAL, ...CLOTH, y: 'yellow5', j: 'yellow3' },
)

furn(
  'int_lectern',
  (() => {
    const g = grid(32, 56)
    // sloped reading desk with an open book on it
    for (let i = 0; i < 8; i++) {
      hline(g, 2 + i, 6 + i, 28 - i, 'o')
      put(g, 2 + i, 6 + i, 'W')
    }
    hline(g, 2, 14, 28, 'D')
    box(g, 2, 15, 28, 3, 'u')
    hline(g, 2, 17, 28, 'K')
    slab(g, 9, 17, 5, 4, 'C', 'C', 'E')
    box(g, 7, 2, 18, 5, 'C')
    hline(g, 7, 2, 18, 'W')
    vline(g, 15, 2, 5, 'E')
    hline(g, 8, 5, 6, 'e')
    hline(g, 17, 4, 6, 'e')
    // column and base
    box(g, 11, 18, 10, 30, 'o')
    vline(g, 11, 18, 30, 'W')
    vline(g, 12, 18, 30, 'w')
    vline(g, 20, 18, 30, 'K')
    box(g, 9, 30, 14, 3, 'D')
    hline(g, 9, 30, 14, 'w')
    slab(g, 4, 48, 24, 5, 'o', 'W', 'K')
    box(g, 6, 53, 20, 2, 'K')
    return g
  })(),
  { ...WOOD, ...CLOTH },
)

furn(
  'int_bookrow', // a packed run of shelving, two tiers deep
  (() => {
    const g = grid(96, 64)
    slab(g, 1, 1, 94, 4, 'o', 'W', 'D')
    box(g, 1, 5, 4, 56, 'u')
    vline(g, 1, 5, 56, 'w')
    box(g, 91, 5, 4, 56, 'u')
    vline(g, 94, 5, 56, 'K')
    box(g, 5, 5, 86, 56, 'K')
    bookRun(g, 6, 90, 28, 20, 2)
    slab(g, 5, 29, 86, 3, 'o', 'w', 'D')
    bookRun(g, 6, 66, 57, 21, 5)
    // a gap where somebody pulled a volume out, and a flat stack beside it
    box(g, 67, 36, 9, 22, 'K')
    for (let i = 0; i < 12; i++) {
      const x = 79 - (i >> 2)
      box(g, x, 57 - i, 6, 1, 'p')
      put(g, x + 5, 57 - i, 'P')
    }
    box(g, 82, 52, 8, 2, 't')
    box(g, 82, 54, 8, 2, 'y')
    box(g, 82, 56, 8, 2, 'r')
    slab(g, 1, 58, 94, 5, 'o', 'W', 'K')
    return g
  })(),
  {
    ...WOOD,
    r: 'red4', R: 'red3', b: 'blue5', B: 'blue3', y: 'yellow5', Y: 'yellow3', t: 'teal4', T: 'teal3',
    p: 'purple4', P: 'purple3', n: 'orange4', N: 'orange3', g: 'leaf4', G: 'leaf3', c: 'cream4', C: 'cream3',
  },
)

/* ------------------------- warehouse / dock set ------------------------- */

/** One slatted crate: boards, corner posts and a stencil mark. */
const crate = (g: string[], x: number, y: number, w: number, h: number, mark: boolean): void => {
  slab(g, x, y, w, h, 'o', 'W', 'K')
  for (let i = y + 4; i < y + h - 2; i += 5) {
    hline(g, x + 1, i, w - 2, 'D')
    hline(g, x + 1, i + 1, w - 2, 'w')
  }
  vline(g, x + 3, y, h, 'D')
  vline(g, x + w - 4, y, h, 'D')
  hline(g, x, y + h - 1, w, 'K')
  if (mark) {
    box(g, x + 7, y + 6, 3, 6, 'k')
    box(g, x + 11, y + 6, 3, 6, 'k')
    box(g, x + 7, y + 8, 7, 2, 'k')
  }
}

furn(
  'int_cratestack',
  (() => {
    const g = grid(48, 64)
    crate(g, 2, 30, 44, 34, true)
    crate(g, 6, 2, 34, 28, false)
    box(g, 12, 8, 22, 3, 'K')
    hline(g, 12, 8, 22, 'D')
    return g
  })(),
  { ...WOOD, k: 'ink3' },
)

furn(
  'int_pallet',
  (() => {
    const g = grid(64, 32)
    // deck boards
    for (let i = 0; i < 5; i++) {
      const y = 8 + i * 4
      slab(g, 1, y, 62, 3, 'o', 'W', 'D')
    }
    // bearers and blocks
    for (const x of [2, 29, 55]) {
      box(g, x, 8, 7, 20, 'u')
      vline(g, x, 8, 20, 'w')
      vline(g, x + 6, 8, 20, 'K')
      hline(g, x, 27, 7, 'K')
    }
    box(g, 1, 28, 62, 2, 'K')
    // a sack resting on the deck
    disc(g, 20, 5, 11, 5, 'c')
    disc(g, 17, 3, 7, 3, 'C')
    hline(g, 12, 8, 17, 'e')
    box(g, 17, 0, 6, 3, 'e')
    hline(g, 17, 0, 6, 'c')
    return g
  })(),
  { ...WOOD, ...CLOTH },
)

furn(
  'int_ropecoil',
  (() => {
    const g = grid(40, 24)
    for (let i = 0; i < 4; i++) {
      const rx = 17 - i * 4
      const ry = 9 - i * 2
      disc(g, 19, 14, rx, ry, i % 2 ? 'p' : 'P')
      disc(g, 19, 13, rx - 1, ry - 1, i % 2 ? 'P' : 'p')
    }
    disc(g, 19, 13, 3, 2, 'k')
    // twist marks around the outer coil, and a loose end trailing off right
    for (let a = 0; a < 14; a++) {
      const th = (a / 14) * Math.PI * 2
      put(g, Math.round(19 + Math.cos(th) * 15), Math.round(14 + Math.sin(th) * 7), 'l')
    }
    for (let i = 0; i < 12; i++) {
      const x = 28 + i
      const y = 20 - Math.round(Math.sin(i / 3) * 2)
      put(g, x, y, 'p')
      put(g, x, y + 1, 'P')
    }
    return g
  })(),
  { p: 'path4', P: 'path3', l: 'path5', k: 'path2' },
)

export const INTERIOR_DEFS: SpriteDef[] = D
