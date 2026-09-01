// The island cast: villagers, portraits, Byte the cat and ambient critters —
// redrawn as HD pixel art (art-direction.md).
//
// Every human shares ONE rig: a 32×48 frame, anchor [16,46], feet two rows
// above the frame bottom, and a four-frame walk (contact–down–contact–up) with
// a 2px body bob and counter-swinging arms.  Bodies are assembled from shared
// masses (skull, torso, arms, legs) so thirteen people read as one troupe; a
// character's identity comes from its colour ramps, its hair or hat, the cut of
// its garment (front + hem) and the prop in its hand.
//
// Shading is generated rather than hand-painted: `shadePass` lifts the top/left
// silhouette run of every mass to its ramp's light step and drops the
// bottom/right run to the dark step, so light always falls from the top-left
// and no mass is pillow-shaded.  The 1px dark outer outline is the renderer's
// (`outline: 'outline'`).  Nothing bakes a drop shadow — entities draw those.
//
// Legend characters are fixed across the whole rig so one template serves
// everyone:
//   s S z  skin mid / shade / rim        e w M  eye ink / highlight / mouth
//   h H D  hair mid / light / dark       k K f  hat  mid / dark / light
//   a A L  garment mid / dark / light    i I J  accent mid / dark / light
//   p q P  trousers mid / dark / light   b B N  boots mid / dark / light
//   m n g  metal / metal dark / lens     o O W  prop wood / prop dark / chalk
//   y Y    bright trim (badge, buckle)
import { mirrorDef, type Legend, type SpriteDef } from '../pixel'
import type { PalKey } from '../palette'

/* ========================== grid plumbing =========================== */

const W = 32
const H = 48
const ANCHOR: [number, number] = [16, 46]
const E = '.'.repeat(W)

type Grid = string[][]

const newGrid = (w = W, h = H): Grid => Array.from({ length: h }, () => Array<string>(w).fill('.'))
const asRows = (g: Grid): string[] => g.map((r) => r.join(''))

/** Stamp `rows` at (x,y). '.' leaves the target alone; ' ' erases it. */
function put(g: Grid, x: number, y: number, rows: readonly string[]): void {
  for (let j = 0; j < rows.length; j++) {
    const yy = y + j
    if (yy < 0 || yy >= g.length) continue
    const row = rows[j]
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '.') continue
      const xx = x + i
      if (xx < 0 || xx >= g[yy].length) continue
      g[yy][xx] = ch === ' ' ? '.' : ch
    }
  }
}

/** Horizontal run [x0..x1] inclusive. */
function run(g: Grid, x0: number, x1: number, y: number, ch: string): void {
  if (y < 0 || y >= g.length) return
  for (let x = x0; x <= x1; x++) if (x >= 0 && x < g[y].length) g[y][x] = ch
}

/** Guard: every full-width template row really is `W` wide. */
function T(rows: string[]): string[] {
  for (const r of rows) if (r.length !== W) throw new Error(`npc template row is ${r.length} wide, expected ${W}: "${r}"`)
  return rows
}

/** Mirror full-width template rows about the frame centre. */
const flip = (rows: string[]): string[] => rows.map((r) => [...r].reverse().join(''))

/**
 * Recolour the far half of a leg template so a side-on walk reads in depth:
 * anything past the centre line drops one ramp step.
 */
const farSide = (rows: string[]): string[] =>
  rows.map((r) =>
    [...r].map((c, x) => (x < 16 ? c : c === 'p' ? 'q' : c === 'b' ? 'B' : c)).join(''),
  )

/* ---- automatic top-left rim light / bottom-right shade ---- */

/** mid char → [dark, light] for every ramp the rig paints with. */
const RAMP: Record<string, [string, string]> = {
  s: ['S', 'z'],
  h: ['D', 'H'],
  a: ['A', 'L'],
  i: ['I', 'J'],
  p: ['q', 'P'],
  b: ['B', 'N'],
  k: ['K', 'f'],
}

/**
 * Only MID pixels move: hand-placed darks and lights survive untouched.
 * A mid pixel on the top or left silhouette edge becomes the light step; one on
 * the bottom or right edge becomes the dark step. Never against a neighbouring
 * mass — only against transparency — so no halos form inside the figure.
 */
function shadePass(g: Grid): void {
  const src = g.map((r) => [...r])
  const clear = (x: number, y: number): boolean =>
    x < 0 || y < 0 || y >= src.length || x >= src[y].length || src[y][x] === '.'
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const ramp = RAMP[src[y][x]]
      if (!ramp) continue
      if (clear(x, y - 1) || clear(x - 1, y)) g[y][x] = ramp[1]
      else if (clear(x, y + 1) || clear(x + 1, y)) g[y][x] = ramp[0]
    }
}

/* ============================ the rig ================================ */

const HEAD_Y = 2
const TORSO_Y = 18
const LEGS_Y = 29

/* ---- skull (front/back share a mass; the profile is its own) ---- */

const SKULL = T([
  '............ssssssss............', // 3
  '..........ssssssssssss..........', // 4
  '.........ssssssssssssss.........', // 5
  '.........ssssssssssssss.........', // 6
  '.........ssssssssssssss.........', // 7
  '.........ssssssssssssss.........', // 8
  '.........ssssssssssssss.........', // 9
  '.........ssssssssssssss.........', // 10
  '.........ssssssssssssss.........', // 11
  '.........ssssssssssssss.........', // 12
  '.........ssssssssssssss.........', // 13
  '..........ssssssssssss..........', // 14
  '...........ssssssssss...........', // 15
  '............ssssssss............', // 16
  '.............ssssss.............', // 17 — neck
])

/* ---- torso masses ---- */

const TORSO_FRONT = T([
  '..........aaaaaaaaaaaa..........', // 18
  '........aaaaaaaaaaaaaaaa........', // 19
  '........aaaaaaaaaaaaaaaa........', // 20
  '........aaaaaaaaaaaaaaaa........', // 21
  '........aaaaaaaaaaaaaaaa........', // 22
  '........aaaaaaaaaaaaaaaa........', // 23
  '........aaaaaaaaaaaaaaaa........', // 24
  '........aaaaaaaaaaaaaaaa........', // 25
  '........aaaaaaaaaaaaaaaa........', // 26
  '........aaaaaaaaaaaaaaaa........', // 27
  '........aaaaaaaaaaaaaaaa........', // 28
  '.........aaaaaaaaaaaaaa.........', // 29
  '..........aaaaaaaaaaaa..........', // 30
])

const TORSO_SIDE = T([
  '...........aaaaaaaaaa...........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '..........aaaaaaaaaaaa..........',
  '...........aaaaaaaaaa...........',
])

/** Extra shoulder for the two heavies (sol, dockmaster). */
const TORSO_BROAD_PADS = T([
  '................................',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '.......a................a.......',
  '................................',
  '................................',
])

/* ---- legs: five poses, all landing feet on row 45 ---- */

const LEGS_STAND = T([
  E, // 29
  E, // 30
  '..........pppppppppppp..........', // 31
  '..........pppppppppppp..........', // 32
  '..........pppppppppppp..........', // 33
  '..........pppppppppppp..........', // 34
  '..........ppppp..ppppp..........', // 35
  '..........ppppp..ppppp..........', // 36
  '..........ppppp..ppppp..........', // 37
  '..........ppppp..ppppp..........', // 38
  '..........ppppp..ppppp..........', // 39
  '..........ppppp..ppppp..........', // 40
  '..........ppppp..ppppp..........', // 41
  '..........ppppp..ppppp..........', // 42
  '.........bbbbbb..bbbbbb.........', // 43
  '.........bbbbbb..bbbbbb.........', // 44
  '.........bbbbbb..bbbbbb.........', // 45
])

/** Passing pose on the down beat: hips a row lower, legs closed. */
const LEGS_PASS_DN = T([
  E,
  E,
  E,
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '...........pppppppppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '..........bbbbbBBbbbbb..........',
  '..........bbbbbBBbbbbb..........',
  '..........bbbbbBBbbbbb..........',
])

/** Passing pose on the up beat: hips a row higher, legs stretched. */
const LEGS_PASS_UP = T([
  E,
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '...........pppppppppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '...........ppppqqpppp...........',
  '..........bbbbbBBbbbbb..........',
  '..........bbbbbBBbbbbb..........',
  '..........bbbbbBBbbbbb..........',
])

/** Contact: left foot planted forward, right foot lifted behind. */
const LEGS_CONTACT_A = T([
  E,
  E,
  '..........pppppppppppp..........',
  '..........pppppppppppp..........',
  '.........pppppppppppppp.........',
  '.........ppppp....ppppp.........',
  '.........ppppp....ppppp.........',
  '.........ppppp....ppppp.........',
  '.........ppppp....ppppp.........',
  '.........ppppp....ppppp.........',
  '.........ppppp....ppppp.........',
  '.........ppppp....ppppp.........',
  '.........ppppp....bbbbbb........',
  '.........ppppp....bbbbbb........',
  '........bbbbbb....bbbbbb........',
  '........bbbbbb..................',
  '........bbbbbb..................',
])
const LEGS_CONTACT_B = flip(LEGS_CONTACT_A)

type PoseKey = 'idle' | 0 | 1 | 2 | 3
const BOB: Record<string, number> = { idle: 0, 0: 0, 1: 1, 2: 0, 3: -1 }
const HAND_SWING: Record<string, [number, number]> = {
  idle: [0, 0],
  0: [-1, 1],
  1: [0, 0],
  2: [1, -1],
  3: [0, 0],
}
const ARM_SWING: Record<string, number> = { idle: 0, 0: -1, 1: 0, 2: 2, 3: 0 }

const legsFront = (pose: PoseKey): string[] =>
  pose === 'idle'
    ? LEGS_STAND
    : pose === 0
      ? LEGS_CONTACT_A
      : pose === 1
        ? LEGS_PASS_DN
        : pose === 2
          ? LEGS_CONTACT_B
          : LEGS_PASS_UP
const legsSide = (pose: PoseKey): string[] => farSide(legsFront(pose))

/* ---- faces ---- */

/** Eyes, brows, nose and mouth for the front view; drawn after the shade pass. */
function faceFront(g: Grid, y: number, smile: boolean): void {
  run(g, 11, 13, y + 9, 'D')
  run(g, 18, 20, y + 9, 'D')
  put(g, 12, y + 10, ['we', 'ee'])
  put(g, 18, y + 10, ['we', 'ee'])
  run(g, 15, 16, y + 13, 'S')
  if (smile) put(g, 14, y + 14, ['M..M', '.MM.'])
  else run(g, 15, 16, y + 15, 'M')
}

/** Left-facing profile: one eye, a nose notch on the leading edge, small mouth. */
function faceSide(g: Grid, y: number): void {
  run(g, 10, 12, y + 9, 'D')
  put(g, 11, y + 10, ['we', 'ee'])
  put(g, 8, y + 12, ['ss', 'sS'])
  run(g, 10, 11, y + 14, 'M')
}

/* ---- hair & headwear ---- */

type Shape = { y: number; down: string[]; up: string[]; left: string[] }

const CROP: Shape = {
  y: 3,
  down: T([
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hh..........hh.........',
    '.........hh..........hh.........',
    '.........h............h.........',
  ]),
  up: T([
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '..........hhhhhhhhhhhh..........',
    '...........hhhhhhhhhh...........',
    '............hhhhhhhh............',
  ]),
  left: T([
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hh...hhhhhhhhh.........',
    '.........h....hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '...............hhhhhhhh.........',
  ]),
}

const SWEPT: Shape = {
  y: 3,
  down: T([
    '..........hhhhhhhhhh............',
    '.........hhhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhh....hh.........',
    '.........hhhh........hh.........',
    '.........hh...........h.........',
  ]),
  up: CROP.up,
  left: T([
    '..........hhhhhhhhhh............',
    '.........hhhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhh.hhhhhhhh.........',
    '.........hhh...hhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '...............hhhhhhhh.........',
  ]),
}

const MESSY: Shape = {
  y: 2,
  down: T([
    '............h.hh..h.............',
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hh..........hh.........',
    '.........hh..........hh.........',
    '.........h............h.........',
  ]),
  up: T([
    '............h.hh..h.............',
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '..........hhhhhhhhhhhh..........',
    '...........hhhhhhhhhh...........',
    '............hhhhhhhh............',
  ]),
  left: T([
    '............h.hh..h.............',
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hh...hhhhhhhhh.........',
    '.........h....hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '...............hhhhhhhh.........',
  ]),
}

/**
 * Naman's hair: taller and fuller than anyone else's, parted low on the left
 * and sweeping right — the same silhouette as `portrait_naman` in the hero
 * pack, so the star reads as one person across both cards.
 */
const SWEEP: Shape = {
  y: 1,
  down: T([
    '..........hhhhhhhhh.............',
    '........hhhhhhhhhhhhh...........',
    '.......hhhhhhhhhhhhhhh..........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhh....hhhh.........',
    '.......hhhhhh......hhhh.........',
    '.......hhhh........hhh..........',
    '.......hh...........hh..........',
  ]),
  up: T([
    '..........hhhhhhhhh.............',
    '........hhhhhhhhhhhhh...........',
    '.......hhhhhhhhhhhhhhh..........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '........hhhhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhh...........',
  ]),
  left: T([
    '..........hhhhhhhhh.............',
    '........hhhhhhhhhhhhh...........',
    '.......hhhhhhhhhhhhhhh..........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhhhhhhhhhhh.........',
    '.......hhhhhhh.hhhhhhhh.........',
    '.......hhhhh...hhhhhhhh.........',
    '.......hhh.....hhhhhhhh.........',
    '.......hh......hhhhhhhh.........',
    '...............hhhhhhhh.........',
    '...............hhhhhhhh.........',
    '................hhhhhhh.........',
  ]),
}

/** Hair gathered into a bun above the crown. */
const BUN: Shape = {
  y: 0,
  down: T([
    '.............hhhhhh.............',
    '............hhhhhhhh............',
    '............hhhhhhhh............',
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhh........hhh.........',
    '.........hh..........hh.........',
    '.........hh..........hh.........',
  ]),
  up: T([
    '.............hhhhhh.............',
    '............hhhhhhhh............',
    '............hhhhhhhh............',
    '............hhhhhhhh............',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '..........hhhhhhhhhhhh..........',
    '...........hhhhhhhhhh...........',
    '............hhhhhhhh............',
  ]),
  left: T([
    '................hhhhhh..........',
    '...............hhhhhhhh.........',
    '...............hhhhhhhh.........',
    '............hhhhhhhhhh..........',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hh...hhhhhhhhh.........',
    '.........h....hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
    '..............hhhhhhhhh.........',
  ]),
}

/** Long hair that falls over the shoulders. */
const LONG: Shape = {
  y: 3,
  down: T([
    '...........hhhhhhhhhh...........',
    '.........hhhhhhhhhhhhhh.........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhh........hhhhh........',
    '........hhh..........hhh........',
    '........hhh..........hhh........',
    '.......hhhh..........hhhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '.......hhh............hhh.......',
    '........hh............hh........',
    '........hh............hh........',
  ]),
  up: T([
    '...........hhhhhhhhhh...........',
    '.........hhhhhhhhhhhhhh.........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhhhhhhhhhhhhhhh........',
    '........hhhhhhhhhhhhhhhh........',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '.......hhhhhhhhhhhhhhhhhh.......',
    '........hhhhhhhhhhhhhhhh........',
    '.........hhhhhhhhhhhhhh.........',
  ]),
  left: T([
    '...........hhhhhhhhhh...........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhhhhhhhhhhhhhh........',
    '.........hhhhhhhhhhhhhhh........',
    '.........hhhhhhhhhhhhhhh........',
    '.........hh...hhhhhhhhhh........',
    '.........h....hhhhhhhhhh........',
    '..............hhhhhhhhhh........',
    '..............hhhhhhhhhhh.......',
    '..............hhhhhhhhhhh.......',
    '...............hhhhhhhhhh.......',
    '................hhhhhhhhh.......',
    '................hhhhhhhhh.......',
    '................hhhhhhhhh.......',
    '................hhhhhhhhh.......',
    '................hhhhhhhhh.......',
    '................hhhhhhhhh.......',
    '................hhhhhhhhh.......',
    '.................hhhhhhhh.......',
    '.................hhhhhhh........',
    '.................hhhhhhh........',
  ]),
}

/* headwear — drawn over the hair */

const CAP_PEAK: Shape = {
  y: 2,
  down: T([
    '............kkkkkkkk............',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '........KKKKKKKKKKKKKKKK........',
    '.......KKKKKKKKKKKKKKKKKK.......',
  ]),
  up: T([
    '............kkkkkkkk............',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.........KKKKKKKKKKKKKK.........',
  ]),
  left: T([
    '............kkkkkkkk............',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.....KKKKKKKKKKKKKKKK...........',
    '.....KKKKKKKKKK.................',
  ]),
}

const BUCKET: Shape = {
  y: 2,
  down: T([
    '...........kkkkkkkkkk...........',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.......KKKKKKKKKKKKKKKKKK.......',
    '......KKKKKKKKKKKKKKKKKKKK......',
    '.......KKKKKKKKKKKKKKKKKK.......',
  ]),
  up: T([
    '...........kkkkkkkkkk...........',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.......KKKKKKKKKKKKKKKKKK.......',
    '......KKKKKKKKKKKKKKKKKKKK......',
    '.......KKKKKKKKKKKKKKKKKK.......',
  ]),
  left: T([
    '...........kkkkkkkkkk...........',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '......KKKKKKKKKKKKKKKKKKK.......',
    '.....KKKKKKKKKKKKKKKKKKKKK......',
    '......KKKKKKKKKKKKKKKKKKK.......',
  ]),
}

const CAP_BACK: Shape = {
  y: 2,
  down: T([
    '............kkkkkkkk............',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkfffffkkkkk.........',
    '.........KK..........KK.........',
  ]),
  up: T([
    '.......KKKKKKKKKKKKKKKKKK.......',
    '............kkkkkkkk............',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
  ]),
  left: T([
    '............kkkkkkkk............',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '...........KKKKKKKKKKKKKK.......',
    '...............KKKKKKKKKK.......',
  ]),
}

const TOQUE: Shape = {
  y: 0,
  down: T([
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '........kkkkkkkkkkkkkkkk........',
    '........kkkkkkkkkkkkkkkk........',
    '.........kkkkkkkkkkkkkk.........',
    '..........KKKKKKKKKKKK..........',
    '..........KKKKKKKKKKKK..........',
  ]),
  up: T([
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '........kkkkkkkkkkkkkkkk........',
    '........kkkkkkkkkkkkkkkk........',
    '.........kkkkkkkkkkkkkk.........',
    '..........KKKKKKKKKKKK..........',
    '..........KKKKKKKKKKKK..........',
  ]),
  left: T([
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '........kkkkkkkkkkkkkkkk........',
    '........kkkkkkkkkkkkkkkk........',
    '.........kkkkkkkkkkkkkk.........',
    '.........KKKKKKKKKKKKKK.........',
    '.........KKKKKKKKKKKKKK.........',
  ]),
}

const HARDHAT: Shape = {
  y: 2,
  down: T([
    '...........kkkkkkkkkk...........',
    '.........kkkkkffkkkkkkk.........',
    '........kkkkkkffkkkkkkkk........',
    '........kkkkkkffkkkkkkkk........',
    '.......KKKKKKKKKKKKKKKKKK.......',
  ]),
  up: T([
    '...........kkkkkkkkkk...........',
    '.........kkkkkffkkkkkkk.........',
    '........kkkkkkffkkkkkkkk........',
    '........kkkkkkffkkkkkkkk........',
    '.......KKKKKKKKKKKKKKKKKK.......',
  ]),
  left: T([
    '...........kkkkkkkkkk...........',
    '.........kkkkkkkkkkkkkk.........',
    '........kkkkkkkkkkkkkkkk........',
    '........kkkkkkkkkkkkkkkk........',
    '......KKKKKKKKKKKKKKKKKKK.......',
  ]),
}

const BEANIE: Shape = {
  y: 2,
  down: T([
    '...........kkkkkkkkkk...........',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.........KKKKKKKKKKKKKK.........',
    '.........KKKKKKKKKKKKKK.........',
  ]),
  up: T([
    '...........kkkkkkkkkk...........',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.........KKKKKKKKKKKKKK.........',
    '.........KKKKKKKKKKKKKK.........',
  ]),
  left: T([
    '...........kkkkkkkkkk...........',
    '..........kkkkkkkkkkkk..........',
    '.........kkkkkkkkkkkkkk.........',
    '.........kkkkkkkkkkkkkk.........',
    '.........KKKKKKKKKKKKKK.........',
    '.........KKKKKKKKKKKKKK.........',
  ]),
}

/* ---- garment fronts & hems ---- */

type Front = 'plain' | 'placket' | 'open' | 'apron' | 'stripe' | 'bib' | 'blouse' | 'kurta' | 'vest'
type Hem = 'none' | 'coat' | 'skirt' | 'apron' | 'kurta'

/** Chest detail in the accent ramp, relative to the torso origin. */
function frontDetail(g: Grid, ty: number, kind: Front, dir: 'down' | 'up' | 'left'): void {
  const back = dir === 'up'
  const side = dir === 'left'
  switch (kind) {
    case 'placket':
      if (back) return
      for (let r = 1; r <= 10; r++) (side ? run(g, 11, 12, ty + r, 'i') : run(g, 15, 16, ty + r, 'i'))
      break
    case 'open':
      if (back) return
      if (side) {
        for (let r = 1; r <= 10; r++) run(g, 10, 12, ty + r, 'i')
      } else {
        for (let r = 1; r <= 9; r++) run(g, 14, 17, ty + r, 'i')
        for (let r = 1; r <= 9; r++) {
          g[ty + r][13] = 'A'
          g[ty + r][18] = 'A'
        }
      }
      break
    case 'apron':
      for (let r = 1; r <= 2; r++) {
        run(g, 12, 13, ty + r, 'i')
        run(g, 18, 19, ty + r, 'i')
      }
      if (back) break
      for (let r = 3; r <= 12; r++) (side ? run(g, 10, 15, ty + r, 'i') : run(g, 11, 20, ty + r, 'i'))
      break
    case 'bib':
      for (let r = 1; r <= 2; r++) {
        run(g, 12, 13, ty + r, 'i')
        run(g, 18, 19, ty + r, 'i')
      }
      if (side) {
        for (let r = 3; r <= 12; r++) run(g, 10, 16, ty + r, 'i')
      } else if (back) {
        // dungarees from behind: a narrower back panel, straps crossing above it
        for (let r = 6; r <= 12; r++) run(g, 12, 19, ty + r, 'i')
        for (let r = 3; r <= 5; r++) {
          run(g, 12 + (r - 3), 13 + (r - 3), ty + r, 'i')
          run(g, 18 - (r - 3), 19 - (r - 3), ty + r, 'i')
        }
      } else {
        for (let r = 3; r <= 12; r++) run(g, 11, 20, ty + r, 'i')
      }
      break
    case 'stripe':
      run(g, 8, 23, ty + 4, 'i')
      run(g, 8, 23, ty + 5, 'i')
      if (!back && !side) {
        for (let r = 1; r <= 10; r++) run(g, 15, 16, ty + r, 'A')
      }
      break
    case 'blouse':
      if (back) return
      for (let r = 4; r <= 12; r++) (side ? run(g, 10, 14, ty + r, 'i') : run(g, 12, 19, ty + r, 'i'))
      break
    case 'kurta':
      run(g, 13, 18, ty, 'i')
      if (back) return
      for (let r = 1; r <= 12; r++) (side ? run(g, 10, 11, ty + r, 'i') : run(g, 15, 16, ty + r, 'i'))
      break
    case 'vest':
      run(g, 13, 18, ty, 'i')
      if (back) break
      for (let r = 1; r <= 10; r++) {
        if (side) {
          run(g, 10, 11, ty + r, 'i')
        } else {
          run(g, 8, 10, ty + r, 'i')
          run(g, 21, 23, ty + r, 'i')
        }
      }
      break
    default:
      break
  }
}

const HEM_COAT = T([
  '.........aaaaaaaaaaaaaa.........',
  '.........aaaaaaaaaaaaaa.........',
  '........aaaaaaaaaaaaaaaa........',
  '........aaaaaaaaaaaaaaaa........',
  '........AAAAAAAAAAAAAAAA........',
])
const HEM_SKIRT = T([
  '.........aaaaaaaaaaaaaa.........',
  '.........aaaaaaaaaaaaaa.........',
  '........aaaaaaaaaaaaaaaa........',
  '........aaaaaaaaaaaaaaaa........',
  '.......aaaaaaaaaaaaaaaaaa.......',
  '.......aaaaaaaaaaaaaaaaaa.......',
  '.......aaaaaaaaaaaaaaaaaa.......',
  '.......AAAAAAAAAAAAAAAAAA.......',
])
const HEM_KURTA = T([
  '.........aaaaaaaaaaaaaa.........',
  '.........aaaaaaaaaaaaaa.........',
  '.........aaaaaaaaaaaaaa.........',
  '.........aaaaaaaaaaaaaa.........',
  '.........aaaaaaaaaaaaaa.........',
  '.........aaaaaaaaaaaaaa.........',
  '.........iiiiiiiiiiiiii.........',
])
const HEM_APRON = T([
  '.........iiiiiiiiiiiiii.........',
  '.........iiiiiiiiiiiiii.........',
  '........iiiiiiiiiiiiiiii........',
  '........iiiiiiiiiiiiiiii........',
  '........iiiiiiiiiiiiiiii........',
  '........IIIIIIIIIIIIIIII........',
])

const hemRows = (h: Hem): string[] | null =>
  h === 'coat' ? HEM_COAT : h === 'skirt' ? HEM_SKIRT : h === 'kurta' ? HEM_KURTA : h === 'apron' ? HEM_APRON : null

/* ---- character description ---- */

type Ramp3 = readonly [PalKey, PalKey, PalKey]

type Cast = {
  id: string
  skin: Ramp3
  hair: Ramp3
  coat: Ramp3
  accent: Ramp3
  pants: Ramp3
  boots: Ramp3
  hat?: Ramp3
  shape: Shape
  headwear?: Shape
  front: Front
  hem: Hem
  /** rows the whole figure drops (kids sit lower in the frame) */
  top?: number
  broad?: boolean
  /** glasses, goggles, cane, rope, chalk … painted last */
  gear?: (g: Grid, dir: 'down' | 'up' | 'left', hy: number, ty: number) => void
  extra?: Legend
}

const SKIN_LIGHT: Ramp3 = ['skin3', 'skin5', 'skin6']
const SKIN_MED: Ramp3 = ['skin2', 'skin4', 'skin5']
const SKIN_DEEP: Ramp3 = ['skin1', 'skin3', 'skin4']

function legendFor(c: Cast): Legend {
  const hat = c.hat ?? c.hair
  return {
    s: c.skin[1],
    S: c.skin[0],
    z: c.skin[2],
    e: 'ink2',
    w: 'cream6',
    M: c.skin[0],
    h: c.hair[1],
    D: c.hair[0],
    H: c.hair[2],
    a: c.coat[1],
    A: c.coat[0],
    L: c.coat[2],
    i: c.accent[1],
    I: c.accent[0],
    J: c.accent[2],
    p: c.pants[1],
    q: c.pants[0],
    P: c.pants[2],
    b: c.boots[1],
    B: c.boots[0],
    N: c.boots[2],
    k: hat[1],
    K: hat[0],
    f: hat[2],
    m: 'metal4',
    n: 'metal2',
    g: 'glass5',
    o: 'wood4',
    O: 'wood2',
    W: 'cream6',
    y: 'yellow5',
    Y: 'yellow3',
    ...c.extra,
  }
}

/* ---- gear painters ---- */

/** Wire-rimmed spectacles sitting on the eye line. */
const spectacles = (g: Grid, dir: 'down' | 'up' | 'left', hy: number): void => {
  if (dir === 'up') return
  if (dir === 'left') {
    run(g, 10, 13, hy + 9, 'm')
    run(g, 10, 13, hy + 12, 'm')
    g[hy + 10][10] = 'm'
    g[hy + 11][10] = 'm'
    g[hy + 10][13] = 'm'
    g[hy + 11][13] = 'm'
    run(g, 14, 16, hy + 10, 'm')
    return
  }
  run(g, 11, 14, hy + 9, 'm')
  run(g, 11, 14, hy + 12, 'm')
  run(g, 17, 20, hy + 9, 'm')
  run(g, 17, 20, hy + 12, 'm')
  for (const x of [11, 14, 17, 20]) {
    g[hy + 10][x] = 'm'
    g[hy + 11][x] = 'm'
  }
  run(g, 15, 16, hy + 10, 'm')
  g[hy + 10][9] = 'm'
  g[hy + 10][22] = 'm'
}

/** Goggles pushed up onto the forehead. */
const goggles = (g: Grid, dir: 'down' | 'up' | 'left', hy: number): void => {
  const y = hy + 5
  run(g, 9, 22, y, 'n')
  if (dir === 'up') return
  if (dir === 'left') {
    run(g, 9, 12, y + 1, 'g')
    run(g, 9, 12, y + 2, 'n')
    return
  }
  run(g, 10, 13, y + 1, 'g')
  run(g, 18, 21, y + 1, 'g')
  run(g, 10, 13, y + 2, 'n')
  run(g, 18, 21, y + 2, 'n')
}

/** Over-ear headphones: a band across the crown and a cup over each ear. */
const headphones = (g: Grid, dir: 'down' | 'up' | 'left', hy: number): void => {
  if (dir === 'left') {
    run(g, 10, 20, hy + 1, 'n')
    g[hy + 2][9] = 'n'
    put(g, 18, hy + 8, ['mmm', 'mmm', 'mmm', 'mmm'])
    return
  }
  run(g, 11, 20, hy + 1, 'n')
  g[hy + 2][10] = 'n'
  g[hy + 2][21] = 'n'
  put(g, 7, hy + 8, ['mm', 'mm', 'mm', 'mm'])
  put(g, 23, hy + 8, ['mm', 'mm', 'mm', 'mm'])
}

/** A walking cane held on the character's right. */
const cane = (g: Grid, dir: 'down' | 'up' | 'left', _hy: number, ty: number): void => {
  const x = dir === 'down' ? 4 : dir === 'up' ? 27 : 6
  const top = ty + 9
  g[top][x] = 'O'
  if (x + 1 < W) g[top][x + 1] = 'O'
  for (let y = top + 1; y <= 45; y++) g[y][x] = 'o'
}

/** A stub of chalk pinched between two fingers. */
const chalk = (g: Grid, dir: 'down' | 'up' | 'left', _hy: number, ty: number): void => {
  if (dir === 'up') return
  const x = dir === 'left' ? 6 : 3
  const y = ty + 10
  put(g, x, y, ['WW', 'WW'])
}

/** A coil of rope slung across the chest and over one shoulder. */
const rope = (g: Grid, dir: 'down' | 'up' | 'left', _hy: number, ty: number): void => {
  if (dir === 'left') {
    for (let r = 1; r <= 8; r++) run(g, 12 + Math.floor(r / 3), 13 + Math.floor(r / 3), ty + r, 'o')
    put(g, 17, ty + 9, ['ooo', 'o.o', 'ooo'])
    return
  }
  for (let r = 1; r <= 9; r++) {
    const x = dir === 'down' ? 9 + r : 22 - r
    run(g, x, x + 1, ty + r, 'o')
  }
  put(g, dir === 'down' ? 18 : 8, ty + 10, ['oooo', 'o..o', 'oooo'])
}

/* ---- frame assembly ---- */

function buildFrame(c: Cast, dir: 'down' | 'up' | 'left', pose: PoseKey): string[] {
  const g = newGrid()
  const top = c.top ?? 0
  const bob = BOB[String(pose)]
  const side = dir === 'left'

  // legs first, so a coat hem can fall over them
  const legs = (side ? legsSide(pose) : legsFront(pose)).slice(top)
  put(g, 0, LEGS_Y + top, legs)

  // torso
  const ty = TORSO_Y + top + bob
  put(g, 0, ty, side ? TORSO_SIDE : TORSO_FRONT)
  if (c.broad && !side) put(g, 0, ty, TORSO_BROAD_PADS)
  const hem = hemRows(c.hem)
  if (hem) put(g, 0, ty + 13, hem)
  frontDetail(g, ty, c.front, dir)

  // arms — sleeves in the garment, hands in skin
  const [dl, dr] = HAND_SWING[String(pose)]
  if (side) {
    const ax = 8 + ARM_SWING[String(pose)]
    for (let y = ty + 2; y <= ty + 8; y++) put(g, 20, y, ['A'])
    for (let y = ty + 2; y <= ty + 8; y++) put(g, ax, y, ['aaa'])
    put(g, ax, ty + 9, ['sss', 'sss', 'sss'])
  } else {
    const inset = c.broad ? 1 : 0
    for (const [x, dy] of [
      [5 - inset, dl],
      [24 + inset, dr],
    ] as const) {
      const handTop = ty + 9 + dy
      for (let y = ty + 2; y < handTop; y++) put(g, x, y, ['aaa'])
      put(g, x, handTop, ['sss', 'sss', 'sss'])
    }
  }

  // head
  const hy = HEAD_Y + top + bob
  put(g, 0, hy + 1, SKULL)
  if (dir !== 'up') {
    put(g, 8, hy + 10, ['s', 's', 'S'])
    put(g, 23, hy + 10, ['s', 's', 'S'])
  }
  const shape = c.shape
  put(g, 0, hy + shape.y, dir === 'down' ? shape.down : dir === 'up' ? shape.up : shape.left)
  if (c.headwear) {
    const hw = c.headwear
    put(g, 0, hy + hw.y, dir === 'down' ? hw.down : dir === 'up' ? hw.up : hw.left)
  }

  shadePass(g)

  if (dir === 'down') faceFront(g, hy, false)
  else if (dir === 'left') faceSide(g, hy)

  c.gear?.(g, dir, hy, ty)
  return asRows(g)
}

function buildRig(c: Cast): SpriteDef[] {
  const legend = legendFor(c)
  const mk = (name: string, rows: string[]): SpriteDef => ({ name, rows, legend, outline: 'outline', anchor: ANCHOR })
  const defs: SpriteDef[] = []
  for (const dir of ['down', 'up'] as const) {
    defs.push(mk(`npc_${c.id}_idle_${dir}`, buildFrame(c, dir, 'idle')))
    for (const i of [0, 1, 2, 3] as const) defs.push(mk(`npc_${c.id}_walk_${dir}_${i}`, buildFrame(c, dir, i)))
  }
  const left = [
    mk(`npc_${c.id}_idle_left`, buildFrame(c, 'left', 'idle')),
    ...([0, 1, 2, 3] as const).map((i) => mk(`npc_${c.id}_walk_left_${i}`, buildFrame(c, 'left', i))),
  ]
  defs.push(...left)
  defs.push(...left.map((d) => mirrorDef(d, d.name.replace('_left', '_right'))))
  return defs
}

/* ============================ the cast =============================== */
// Each villager owns a two-colour costume and a silhouette nobody else has.

type FaceSpec = { hair: FaceStamp[]; over?: FaceStamp[]; mouth?: 'flat' | 'smile' | 'none'; ears?: boolean }
type FaceStamp = [number, number, string[]]

const MIRA: Cast = {
  id: 'mira',
  skin: SKIN_LIGHT,
  hair: ['hairGrey3', 'hairGrey5', 'hairGrey6'],
  coat: ['blue1', 'blue2', 'blue3'],
  accent: ['yellow3', 'yellow5', 'yellow7'],
  pants: ['stone2', 'stone3', 'stone5'],
  boots: ['ink1', 'ink3', 'ink5'],
  hat: ['stone2', 'cream5', 'cream6'],
  shape: CROP,
  headwear: CAP_PEAK,
  front: 'open',
  hem: 'coat',
  gear: (g, dir, hy) => {
    if (dir !== 'up') run(g, 15, 16, hy + 4, 'y')
  },
}

const TOMAS: Cast = {
  id: 'tomas',
  skin: SKIN_LIGHT,
  hair: ['hairGrey3', 'hairGrey5', 'hairGrey6'],
  coat: ['teal2', 'teal3', 'teal4'],
  accent: ['cream3', 'cream5', 'cream6'],
  pants: ['dirt3', 'dirt4', 'dirt5'],
  boots: ['dirt2', 'dirt3', 'dirt4'],
  hat: ['grass1', 'grass2', 'grass3'],
  shape: CROP,
  headwear: BUCKET,
  front: 'vest',
  hem: 'none',
  gear: (g, dir, hy) => {
    if (dir === 'up') return
    if (dir === 'left') {
      run(g, 9, 14, hy + 13, 'h')
      run(g, 9, 15, hy + 14, 'h')
      run(g, 10, 15, hy + 15, 'h')
      run(g, 11, 15, hy + 16, 'h')
      return
    }
    run(g, 10, 21, hy + 13, 'h')
    run(g, 10, 21, hy + 14, 'h')
    run(g, 11, 20, hy + 15, 'h')
    run(g, 12, 19, hy + 16, 'h')
    run(g, 15, 16, hy + 14, 'M')
  },
}

const PIP: Cast = {
  id: 'pip',
  top: 5,
  skin: SKIN_LIGHT,
  hair: ['hairBrown2', 'hairBrown3', 'hairBrown5'],
  coat: ['red3', 'red4', 'red5'],
  accent: ['cream4', 'cream6', 'cream6'],
  pants: ['blue3', 'blue5', 'blue6'],
  boots: ['grey3', 'cream6', 'cream6'],
  hat: ['blue2', 'blue4', 'blue6'],
  shape: CROP,
  headwear: CAP_BACK,
  front: 'stripe',
  hem: 'none',
}

const LOU: Cast = {
  id: 'lou',
  skin: SKIN_LIGHT,
  hair: ['hairBrown2', 'hairBrown3', 'hairBrown5'],
  coat: ['pink3', 'pink5', 'pink6'],
  accent: ['cream4', 'cream6', 'cream6'],
  pants: ['wood2', 'wood3', 'wood5'],
  boots: ['wood1', 'wood2', 'wood4'],
  hat: ['cream4', 'cream6', 'cream6'],
  shape: CROP,
  headwear: TOQUE,
  front: 'apron',
  hem: 'apron',
}

const ADA: Cast = {
  id: 'ada',
  skin: SKIN_LIGHT,
  hair: ['hairBlack1', 'hairBlack2', 'hairBlack4'],
  coat: ['purple2', 'purple3', 'purple4'],
  accent: ['cream4', 'cream6', 'cream6'],
  pants: ['stone2', 'stone3', 'stone4'],
  boots: ['ink1', 'ink3', 'ink5'],
  shape: BUN,
  front: 'open',
  hem: 'none',
  gear: (g, dir, hy) => spectacles(g, dir, hy),
}

const RAVI: Cast = {
  id: 'ravi',
  skin: SKIN_MED,
  hair: ['hairBlack1', 'hairBlack2', 'hairBlack4'],
  coat: ['cream3', 'cream5', 'cream6'],
  accent: ['wood2', 'wood3', 'wood5'],
  pants: ['wood2', 'wood3', 'wood5'],
  boots: ['stone2', 'stone3', 'stone4'],
  shape: MESSY,
  front: 'bib',
  hem: 'none',
  gear: (g, dir, hy, ty) => {
    goggles(g, dir, hy)
    if (dir !== 'left') {
      g[ty + 4][12] = 'y'
      g[ty + 4][19] = 'y'
    }
  },
}

const SOL: Cast = {
  id: 'sol',
  skin: SKIN_MED,
  hair: ['hairBlack1', 'hairBlack2', 'hairBlack4'],
  coat: ['orange2', 'orange4', 'orange5'],
  accent: ['grey6', 'cream6', 'cream6'],
  pants: ['stone2', 'stone3', 'stone4'],
  boots: ['wood1', 'wood2', 'wood4'],
  hat: ['yellow3', 'yellow5', 'yellow7'],
  shape: CROP,
  headwear: HARDHAT,
  front: 'stripe',
  hem: 'none',
  broad: true,
}

const DEVI: Cast = {
  id: 'devi',
  skin: SKIN_MED,
  hair: ['hairGrey2', 'hairGrey4', 'hairGrey6'],
  coat: ['pink1', 'pink3', 'pink4'],
  accent: ['cream3', 'cream5', 'cream6'],
  pants: ['cream2', 'cream3', 'cream4'],
  boots: ['wood2', 'wood3', 'wood5'],
  shape: BUN,
  front: 'blouse',
  hem: 'skirt',
  gear: cane,
}

const ARJUN: Cast = {
  id: 'arjun',
  skin: SKIN_MED,
  hair: ['hairBrown1', 'hairBrown3', 'hairBrown5'],
  coat: ['grey2', 'grey3', 'grey5'],
  accent: ['cream4', 'cream6', 'cream6'],
  pants: ['blue3', 'blue4', 'blue6'],
  boots: ['grey3', 'cream6', 'cream6'],
  shape: SWEPT,
  front: 'placket',
  hem: 'none',
  gear: (g, dir, hy, ty) => {
    headphones(g, dir, hy)
    // hood bunched behind the neck
    if (dir === 'down') {
      run(g, 11, 20, ty, 'A')
      run(g, 12, 19, ty + 1, 'A')
    } else if (dir === 'up') {
      run(g, 11, 20, ty, 'A')
      run(g, 10, 21, ty + 1, 'A')
      run(g, 11, 20, ty + 2, 'A')
    } else {
      run(g, 15, 20, ty, 'A')
      run(g, 16, 21, ty + 1, 'A')
    }
  },
}

const ILSE: Cast = {
  id: 'ilse',
  skin: SKIN_LIGHT,
  hair: ['hairRed2', 'hairRed3', 'hairRed4'],
  coat: ['yellow2', 'yellow4', 'yellow6'],
  accent: ['yellow1', 'yellow3', 'yellow5'],
  pants: ['blue1', 'blue2', 'blue3'],
  boots: ['ink1', 'ink3', 'ink5'],
  shape: LONG,
  front: 'placket',
  hem: 'coat',
}

const NAMAN: Cast = {
  id: 'naman',
  skin: SKIN_LIGHT,
  hair: ['hairBlack1', 'hairBlack3', 'hairBlack6'],
  coat: ['teal3', 'teal4', 'teal6'],
  accent: ['cream4', 'cream6', 'cream6'],
  pants: ['blue1', 'blue2', 'blue3'],
  boots: ['orange2', 'orange4', 'orange5'],
  shape: SWEEP,
  front: 'open',
  hem: 'none',
}

const PROFESSOR: Cast = {
  id: 'professor',
  skin: SKIN_DEEP,
  hair: ['hairGrey2', 'hairGrey4', 'hairGrey6'],
  coat: ['pine2', 'pine4', 'pine6'],
  accent: ['cream3', 'cream5', 'cream6'],
  pants: ['cream2', 'cream3', 'cream4'],
  boots: ['wood1', 'wood2', 'wood4'],
  shape: CROP,
  front: 'kurta',
  hem: 'kurta',
  gear: (g, dir, hy, ty) => {
    // clipped salt-and-pepper beard, then wire spectacles, then the chalk
    if (dir === 'down') {
      run(g, 11, 20, hy + 14, 'h')
      run(g, 12, 19, hy + 15, 'h')
      run(g, 15, 16, hy + 15, 'M')
    } else if (dir === 'left') {
      run(g, 9, 14, hy + 14, 'h')
      run(g, 10, 15, hy + 15, 'h')
    }
    spectacles(g, dir, hy)
    chalk(g, dir, hy, ty)
  },
}

const DOCKMASTER: Cast = {
  id: 'dockmaster',
  skin: SKIN_MED,
  hair: ['hairBrown1', 'hairBrown2', 'hairBrown4'],
  coat: ['brick2', 'brick4', 'brick5'],
  accent: ['cream3', 'cream5', 'cream6'],
  pants: ['blue1', 'blue2', 'blue3'],
  boots: ['wood1', 'wood2', 'wood4'],
  hat: ['blue1', 'blue3', 'blue5'],
  shape: CROP,
  headwear: BEANIE,
  front: 'placket',
  hem: 'none',
  broad: true,
  gear: (g, dir, hy, ty) => {
    if (dir !== 'up') {
      // heavy stubble jaw
      run(g, 11, 20, hy + 14, 'D')
      run(g, 12, 19, hy + 15, 'D')
      if (dir === 'down') run(g, 15, 16, hy + 15, 'M')
    }
    rope(g, dir, hy, ty)
  },
  extra: { o: 'sand4', O: 'sand2' },
}

const CAST: Cast[] = [MIRA, TOMAS, PIP, LOU, ADA, RAVI, SOL, DEVI, ARJUN, ILSE, NAMAN, PROFESSOR, DOCKMASTER]

/* ===================== portraits (32×32 bust cards) ===================== */
// Shared bust template (chest, neck, skull, features) plus per-character hair,
// hat and accessory stamps. Lit from the top-left by the same `shadePass`, then
// outlined, dropped on a warm corner vignette and framed.

const FACE = 32

const FACE_BODY = [
  '..........cccccccccccc..........',
  '........cccccciiiicccccc........',
  '......cccccccciiiicccccccc......',
  '.....ccccccccciiiiccccccccc.....',
  '....cccccccccciiiicccccccccc....',
  '....cccccccccciiiicccccccccc....',
  '....cccccccccciiiicccccccccc....',
  '....cccccccccciiiicccccccccc....',
]
const FACE_NECK = ['ssssss', 'SSSSSS', 'ssssss', 'ssssss', 'ssssss']
const FACE_HEAD = [
  '.....ssssss.....',
  '...ssssssssss...',
  '..ssssssssssss..',
  '.ssssssssssssss.',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  '.ssssssssssssss.',
  '..ssssssssssss..',
  '...ssssssssss...',
  '.....ssssss.....',
]
const EAR_L = ['ss', 'sS', 'sS']
const EAR_R = ['Ss', 'Ss', 'Ss']
const EYE = ['we', 'ee']

function face(name: string, legend: Legend, spec: FaceSpec): SpriteDef {
  const g = newGrid(FACE, FACE)
  put(g, 0, 24, FACE_BODY)
  put(g, 13, 20, FACE_NECK)
  put(g, 8, 4, FACE_HEAD)
  if (spec.ears !== false) {
    put(g, 6, 12, EAR_L)
    put(g, 24, 12, EAR_R)
  }
  for (const [x, y, rows] of spec.hair) put(g, x, y, rows)

  shadePass(g)

  run(g, 10, 12, 11, 'D')
  run(g, 19, 21, 11, 'D')
  put(g, 11, 13, EYE)
  put(g, 19, 13, EYE)
  run(g, 15, 16, 16, 'S')
  const mouth = spec.mouth ?? 'flat'
  if (mouth === 'flat') run(g, 14, 17, 18, 'M')
  if (mouth === 'smile') put(g, 13, 17, ['M....M', '.MMMM.'])
  for (const [x, y, rows] of spec.over ?? []) put(g, x, y, rows)

  // outline the bust, drop a warm corner vignette behind it, frame the card
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < FACE && y < FACE && g[y][x] !== '.'
  const o = g.map((r) => [...r])
  for (let y = 0; y < FACE; y++)
    for (let x = 0; x < FACE; x++)
      if (g[y][x] === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) o[y][x] = '#'
  for (let y = 0; y < FACE; y++)
    for (let x = 0; x < FACE; x++) {
      if (o[y][x] !== '.') continue
      const d = Math.hypot(x - 15.5, y - 15.5)
      o[y][x] = d > 19 ? '=' : d > 15 ? '-' : '_'
    }
  for (let i = 0; i < FACE; i++) {
    o[0][i] = '#'
    o[FACE - 1][i] = '#'
    o[i][0] = '#'
    o[i][FACE - 1] = '#'
  }
  return { name, rows: o.map((r) => r.join('')), legend, anchor: [16, 32] }
}

/** Portrait legend: the rig ramps plus the card's coat/inner/ground keys. */
function faceLegend(c: Pick<Cast, 'skin' | 'hair' | 'coat' | 'accent' | 'hat' | 'extra'>): Legend {
  const hat = c.hat ?? c.hair
  return {
    s: c.skin[1],
    S: c.skin[0],
    z: c.skin[2],
    e: 'ink2',
    w: 'cream6',
    M: c.skin[0],
    h: c.hair[1],
    D: c.hair[0],
    H: c.hair[2],
    k: hat[1],
    K: hat[0],
    f: hat[2],
    c: c.coat[1],
    a: c.coat[1],
    A: c.coat[0],
    L: c.coat[2],
    i: c.accent[1],
    I: c.accent[0],
    J: c.accent[2],
    m: 'metal4',
    n: 'metal2',
    g: 'glass5',
    y: 'yellow5',
    Y: 'yellow3',
    o: 'wood4',
    O: 'wood2',
    W: 'cream6',
    '#': 'outline',
    _: 'wall5',
    '-': 'wall4',
    '=': 'wall3',
    ...c.extra,
  }
}

/* ---- portrait hair / hat stamps ---- */

const P_CROP: FaceStamp = [6, 2, [
  '......hhhhhhhh......',
  '....hhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhh..........hhhhh.',
  '.hh............hhhh.',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const P_SWEPT: FaceStamp = [6, 2, [
  '.....hhhhhhhhhh.....',
  '...hhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhh.....',
  '.hhhhhhhhh..........',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const P_SWEEP: FaceStamp = [5, 1, [
  '.....hhhhhhhhhhhh.....',
  '...HHhhhhhhhhhhhhDD...',
  '..HHHhhhhhhhhhhhhhDD..',
  '.HHHhhhhhhhhhhhhhhhDD.',
  'HHHHhhhhhhhhhhhhhhhhDD',
  'HHHHhhhhhhhhhhhhhhhhDD',
  'HHHHhhhhhhhhhhhhhhhhDD',
  'HHHHhhhhhhhhhhhhhhhhDD',
  'HHHHhhhhhhhhhh...hhhDD',
  'HHHHhhhhhhhh.....hhhDD',
  'HHHhhhhhhh.......hhhDD',
  'HHhhhhh..........hhhDD',
  'Hhhh..............hhDD',
  'Hh................hhDD',
  'H..................hDD',
]]
const P_MESSY: FaceStamp = [6, 1, [
  '...h..hh...hh..h....',
  '..hhhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hh..............hh.',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const P_BUN: FaceStamp = [6, 0, [
  '.......hhhhhh.......',
  '......hhhhhhhh......',
  '......hhhhhhhh......',
  '....hhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhh..........hhhh.',
  '.hhh............hhh.',
  '.hh..............hh.',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const P_LONG: FaceStamp = [5, 2, [
  '........hhhhhh........',
  '.....hhhhhhhhhhhh.....',
  '....hhhhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhhhh...',
  '...hhhhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhhhh..',
  '..hhhh..........hhhh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hhhh..........hhhh..',
  '..hhhh..........hhhh..',
  '..hhhh..........hhhh..',
]]

const P_CAP_PEAK: FaceStamp = [5, 1, [
  '......kkkkkkkkkk......',
  '....kkkkkkkkkkkkkk....',
  '...kkkkkkkkkkkkkkkk...',
  '...kkkkkkkyykkkkkkk...',
  '..KKKKKKKKKKKKKKKKKK..',
  '.KKKKKKKKKKKKKKKKKKKK.',
]]
const P_BUCKET: FaceStamp = [4, 1, [
  '........kkkkkkkk........',
  '......kkkkkkkkkkkk......',
  '......kkkkkkkkkkkk......',
  '.....kkkkkkkkkkkkkk.....',
  '..KKKKKKKKKKKKKKKKKKKK..',
  'KKKKKKKKKKKKKKKKKKKKKKKK',
]]
const P_CAP_BACK: FaceStamp = [5, 2, [
  '.......kkkkkkkk.......',
  '.....kkkkkkkkkkkk.....',
  '....kkkkkkkkkkkkkk....',
  '....kkkkffffffkkkkk...',
  '...KKKKKKKKKKKKKKKK...',
  '..KKK............KKK..',
]]
const P_TOQUE: FaceStamp = [5, 0, [
  '.....kkkkkkkkkkkk.....',
  '...kkkkkkkkkkkkkkkk...',
  '..kkkkkkkkkkkkkkkkkk..',
  '..kkkkkkkkkkkkkkkkkk..',
  '...kkkkkkkkkkkkkkkk...',
  '...KKKKKKKKKKKKKKKK...',
  '...KKKKKKKKKKKKKKKK...',
]]
const P_HARDHAT: FaceStamp = [5, 1, [
  '.......kkkkkkkk.......',
  '.....kkkkkffkkkkkk....',
  '....kkkkkkffkkkkkkk...',
  '....kkkkkkffkkkkkkk...',
  '...kkkkkkkkkkkkkkkk...',
  '.KKKKKKKKKKKKKKKKKKKK.',
]]
const P_BEANIE: FaceStamp = [5, 2, [
  '.....kkkkkkkkkkkk.....',
  '...kkkkkkkkkkkkkkkk...',
  '..kkkkkkkkkkkkkkkkkk..',
  '..kkkkkkkkkkkkkkkkkk..',
  '..KKKKKKKKKKKKKKKKKK..',
  '..KKKKKKKKKKKKKKKKKK..',
]]
const P_HAIRLINE: FaceStamp = [8, 7, ['hhhhhhhhhhhhhhhh', 'hhhh........hhhh', 'hh............hh']]
const P_BEARD_GREY: FaceStamp = [8, 13, [
  'hh............hh',
  'hhh..........hhh',
  'hhh..........hhh',
  'hhhh........hhhh',
  'hhhhhhhhhhhhhhhh',
  'hhhhhMMMMMMhhhhh',
  'hhhhhhhhhhhhhhhh',
  '.hhhhhhhhhhhhhh.',
  '..hhhhhhhhhhhh..',
  '....hhhhhhhh....',
]]
const P_BEARD_TRIM: FaceStamp = [8, 16, [
  'hh............hh',
  'hhhh........hhhh',
  'hhhhhhhhhhhhhhhh',
  '.hhhhhhhhhhhhhh.',
  '..hhhhhhhhhhhh..',
]]
const P_GLASSES: FaceStamp = [7, 12, [
  '.mmmmm....mmmmm.',
  'mm...mmmmmm...mm',
  'm.....m..m.....m',
  'mmmmmm....mmmmmm',
]]
const P_GOGGLES: FaceStamp = [7, 8, [
  '.nnnnnnnnnnnnnnnn.',
  '..nggggn..nggggn..',
  '..nnnnnn..nnnnnn..',
]]
const P_HEADPHONES: FaceStamp[] = [
  [5, 2, ['......nnnnnnnnnn......', '....nn..........nn....', '...n..............n...']],
  [5, 11, [
    'mmm................mmm',
    'mmm................mmm',
    'mmm................mmm',
    'mmm................mmm',
    '.mm................mm.',
  ]],
]
const P_HOOD: FaceStamp[] = [
  [7, 22, ['AAAA..........AAAA', 'AAAAA........AAAAA', 'AAAAAA......AAAAAA', 'AAAAAA......AAAAAA']],
  [13, 26, ['J', 'J', 'J', 'J']],
  [18, 26, ['J', 'J', 'J', 'J']],
]
/** Green canvas backpack straps coming over both shoulders, buckles at chest. */
const P_PACK_STRAPS: FaceStamp[] = [
  [10, 24, ['lvv', 'lvv', 'lvv', 'mmm', 'VVV', 'lvv', 'lvv']],
  [19, 24, ['lvv', 'lvv', 'lvv', 'mmm', 'VVV', 'lvv', 'lvv']],
]
const P_COLLAR_I: FaceStamp = [12, 26, ['iiiiiiii', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii']]
const P_SCARF: FaceStamp = [6, 24, ['iiiiiiiiiiiiiiiiiiii', 'iiiiiiiiiiiiiiiiiiii']]
const P_ROPE: FaceStamp = [4, 25, [
  'oo......................',
  '.ooo..................oo',
  '...ooo..............ooo.',
  '.....ooo..........ooo...',
  '.......ooooooooooo......',
]]

/* ---- the portraits ---- */

/**
 * The player's own portrait. The traveller is deliberately NOT Naman: the hero
 * pack dresses them in a coral/rust jacket with a green canvas backpack, while
 * Naman keeps the teal coat. This card mirrors that jacket ramp step for step —
 *   A (dark)  = red2  = hero.ts `T`   (hood and deep planes)
 *   a (mid)   = red4  = hero.ts `c`   (the jacket body)
 *   L (light) = red6  = hero.ts `g`   (top-left silhouette rim)
 * — plus cream6 drawstrings (hero.ts `w`) and the pine canvas of the pack
 * straps (hero.ts `j`/`J`/`l`). The oversized hood and flat cropped fringe stay
 * as this card's own identity.
 */
const HERO: Pick<Cast, 'skin' | 'hair' | 'coat' | 'accent' | 'extra'> = {
  skin: SKIN_LIGHT,
  hair: ['hairBlack1', 'hairBlack2', 'hairBlack4'],
  coat: ['red2', 'red4', 'red6'],
  accent: ['cream4', 'cream6', 'cream6'],
  extra: { v: 'pine4', V: 'pine2', l: 'pine6' },
}

const FACE_OF: Record<string, FaceSpec> = {
  mira: { hair: [P_HAIRLINE, P_CAP_PEAK], over: [[12, 26, ['y']], [19, 26, ['y']], [12, 28, ['y']], [19, 28, ['y']]] },
  tomas: { hair: [P_BEARD_GREY, P_BUCKET], mouth: 'none' },
  pip: { hair: [P_HAIRLINE, P_CAP_BACK], over: [P_SCARF, [11, 16, ['S']], [20, 16, ['S']]], mouth: 'smile' },
  lou: { hair: [P_HAIRLINE, P_TOQUE], over: [P_COLLAR_I, [9, 16, ['ii']], [21, 16, ['ii']]], mouth: 'smile' },
  ada: { hair: [P_BUN], over: [P_GLASSES, P_COLLAR_I] },
  ravi: { hair: [P_MESSY], over: [P_GOGGLES, P_COLLAR_I] },
  sol: { hair: [P_HAIRLINE, P_HARDHAT], over: [P_SCARF] },
  devi: { hair: [P_BUN], over: [[15, 26, ['yy']], [10, 15, ['SS']], [20, 15, ['SS']]] },
  arjun: { hair: [P_SWEPT, ...P_HOOD], over: [...P_HEADPHONES] },
  ilse: { hair: [P_LONG], over: [[8, 24, ['AAAAA......AAAAA', '.AAA........AAA.']]], ears: false },
  naman: { hair: [P_SWEEP], over: [P_COLLAR_I] },
  professor: { hair: [P_CROP, P_BEARD_TRIM], over: [P_GLASSES, P_COLLAR_I] },
  dockmaster: { hair: [P_HAIRLINE, P_BEANIE, P_BEARD_TRIM], over: [P_ROPE] },
}

const FACE_DEFS: SpriteDef[] = (() => {
  const defs: SpriteDef[] = []
  for (const c of CAST) defs.push(face(`face_${c.id}`, faceLegend(c), FACE_OF[c.id]))
  defs.push(face('face_naman_happy', faceLegend(NAMAN), { ...FACE_OF.naman, mouth: 'smile' }))
  const heroSpec: FaceSpec = { hair: [P_CROP, ...P_HOOD], over: [...P_PACK_STRAPS] }
  defs.push(face('face_hero', faceLegend(HERO), heroSpec))
  defs.push(face('face_hero_happy', faceLegend(HERO), { ...heroSpec, mouth: 'smile' }))
  // Byte: a grey cat with green eyes — same card, an entirely different head
  defs.push({
    name: 'face_cat',
    anchor: [16, 32],
    legend: {
      c: 'stone4',
      C: 'stone2',
      L: 'stone6',
      w: 'cream6',
      W: 'cream4',
      e: 'ink2',
      G: 'grass4',
      g: 'grass6',
      P: 'pink5',
      t: 'teal4',
      T: 'teal2',
      '#': 'outline',
      _: 'wall5',
      '-': 'wall4',
      '=': 'wall3',
    },
    rows: catPortrait(),
  })
  return defs
})()

/** Byte's bust card: ears, mask, green eyes, teal collar, warm vignette. */
function catPortrait(): string[] {
  const g = newGrid(FACE, FACE)
  put(g, 0, 24, [
    '..........cccccccccccc..........',
    '........cccccwwwwwwcccccc.......',
    '......cccccwwwwwwwwwwcccccc.....',
    '.....cccccwwwwwwwwwwwwccccccc...',
    '....cccccwwwwwwwwwwwwwwcccccc...',
    '....ccccwwwwwwwwwwwwwwwwccccc...',
    '....ccccwwwwwwwwwwwwwwwwccccc...',
    '....ccccwwwwwwwwwwwwwwwwccccc...',
  ])
  put(g, 5, 2, [
    'cc..................cc',
    'ccc................ccc',
    'cccc..............cccc',
    'cPcc..............ccPc',
    'cPccc............cccPc',
    'cccccccccccccccccccccc',
  ])
  put(g, 5, 8, [
    'cccccccccccccccccccccc',
    'cccccccccccccccccccccc',
    'cccccccccccccccccccccc',
    'cccccccccccccccccccccc',
    'cccccccccccccccccccccc',
    'cccccccccccccccccccccc',
    'cccccccccccccccccccccc',
    '.cccccccccccccccccccc.',
    '..cccccccccccccccccc..',
    '....cccccccccccccc....',
  ])
  shadePass(g)
  // eyes: green almonds with an ink slit pupil and a white catch-light
  put(g, 9, 13, ['GGGG', 'GGGG'])
  put(g, 19, 13, ['GGGG', 'GGGG'])
  put(g, 10, 13, ['ge', 'ge'])
  put(g, 20, 13, ['ge', 'ge'])
  put(g, 11, 13, ['w'])
  put(g, 21, 13, ['w'])
  // muzzle
  put(g, 13, 17, ['WWWWWW', 'WPPPPW', 'WWWWWW'])
  put(g, 15, 18, ['PP'])
  put(g, 15, 20, ['ee'])
  put(g, 12, 20, ['ww', '.w'])
  put(g, 18, 20, ['ww', 'w.'])
  // collar
  put(g, 8, 23, ['tttttttttttttttt'])
  put(g, 8, 24, ['TTTTTTTTTTTTTTTT'])
  put(g, 15, 25, ['tt', 'tt'])
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < FACE && y < FACE && g[y][x] !== '.'
  const o = g.map((r) => [...r])
  for (let y = 0; y < FACE; y++)
    for (let x = 0; x < FACE; x++)
      if (g[y][x] === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) o[y][x] = '#'
  for (let y = 0; y < FACE; y++)
    for (let x = 0; x < FACE; x++) {
      if (o[y][x] !== '.') continue
      const d = Math.hypot(x - 15.5, y - 15.5)
      o[y][x] = d > 19 ? '=' : d > 15 ? '-' : '_'
    }
  for (let i = 0; i < FACE; i++) {
    o[0][i] = '#'
    o[FACE - 1][i] = '#'
    o[i][0] = '#'
    o[i][FACE - 1] = '#'
  }
  return o.map((r) => r.join(''))
}

/* ================== Byte the cat — 32×28, feet on row 26 ================ */
// Big head, small body: the classic top-down cat read. Green eyes, teal collar,
// white bib and socks, and a tail that curls up behind her.

const CAT_LEGEND: Legend = {
  c: 'stone4',
  C: 'stone2',
  L: 'stone6',
  w: 'cream6',
  W: 'cream4',
  e: 'ink2',
  G: 'grass4',
  P: 'pink5',
  t: 'teal4',
  T: 'teal2',
}
const CAT_W = 32
const CAT_H = 28
const CAT_ANCHOR: [number, number] = [16, 27]
const catDef = (name: string, rows: string[]): SpriteDef => ({
  name,
  rows,
  legend: CAT_LEGEND,
  outline: 'outline',
  anchor: CAT_ANCHOR,
})

const CAT_RAMP: Record<string, [string, string]> = { c: ['C', 'L'] }
function catShade(g: Grid): void {
  const src = g.map((r) => [...r])
  const clear = (x: number, y: number): boolean =>
    x < 0 || y < 0 || y >= src.length || x >= src[y].length || src[y][x] === '.'
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const ramp = CAT_RAMP[src[y][x]]
      if (!ramp) continue
      if (clear(x, y - 1) || clear(x - 1, y)) g[y][x] = ramp[1]
      else if (clear(x, y + 1) || clear(x + 1, y)) g[y][x] = ramp[0]
    }
}

/** Tail: an S-curve rising off the hip at (x,y). */
const catTail =
  (x: number, y: number) =>
  (g: Grid): void => {
    put(g, x, y, ['cc'])
    put(g, x + 1, y - 2, ['cc', 'cc'])
    put(g, x + 2, y - 5, ['cc', 'cc', 'cc'])
    put(g, x + 1, y - 7, ['ccc'])
    put(g, x - 1, y - 8, ['ccc'])
  }

/** Head + body for one facing; `paws` supplies rows 23..26. */
function catFrame(top: string[], paws: string[], tail: (g: Grid) => void): string[] {
  const g = newGrid(CAT_W, CAT_H)
  tail(g)
  put(g, 0, 0, top)
  put(g, 0, 23, paws)
  catShade(g)
  return asRows(g)
}

const CAT_DOWN = T([
  '.......c................c.......',
  '.......cc..............cc.......',
  '.......ccc............ccc.......',
  '.......cPcc..........ccPc.......',
  '.......cPccc........cccPc.......',
  '.......cccccccccccccccccc.......',
  '.......cccccccccccccccccc.......',
  '.......cccccccccccccccccc.......',
  '.......cccGGccccccccGGccc.......',
  '.......cccGecccccccceGccc.......',
  '.......ccccccccPPcccccccc.......',
  '.......cccccwwwwwwwwccccc.......',
  '.......cccccwwwwwwwwccccc.......',
  '........cccccccccccccccc........',
  '.........tttttttttttttt.........',
  '.........TTTTTTTTTTTTTT.........',
  '..........wwwwwwwwwwww..........',
  '..........cwwwwwwwwwwc..........',
  '..........ccwwwwwwwwcc..........',
  '..........cccwwwwwwccc..........',
  '..........cccccccccccc..........',
  '..........cccccccccccc..........',
  '..........cccccccccccc..........',
])
const CAT_UP = T([
  '.......c................c.......',
  '.......cc..............cc.......',
  '.......ccc............ccc.......',
  '.......cCcc..........ccCc.......',
  '.......cCccc........cccCc.......',
  '.......cccccccccccccccccc.......',
  '.......cccccccccccccccccc.......',
  '.......cccccccccccccccccc.......',
  '.......cccCCcccccccCCcccc.......',
  '.......cccccccccccccccccc.......',
  '.......cccccccccccccccccc.......',
  '.......cccccccccccccccccc.......',
  '.......cccccccccccccccccc.......',
  '........cccccccccccccccc........',
  '.........TTTTTTTTTTTTTT.........',
  '.........tttttttttttttt.........',
  '..........cccccccccccc..........',
  '..........cCCcccccCCcc..........',
  '..........cccccccccccc..........',
  '..........cCCcccccCCcc..........',
  '..........cccccccccccc..........',
  '..........cccccccccccc..........',
  '..........cccccccccccc..........',
])
const CAT_LEFT = T([
  '.....c.........c................',
  '.....cc.......cc................',
  '.....ccc.....ccc................',
  '.....cPcc...ccPc................',
  '.....cPcccccccPc................',
  '....cccccccccccc................',
  '....cccccccccccc................',
  '...ccccccccccccc................',
  '...GGccccccccccc................',
  '...Geccccccccccc................',
  '..PPcccccccccccc................',
  '..wwwccccccccccc................',
  '..wwwccccccccccc................',
  '...cccccccccccccc...............',
  '...tttcccccccccccccc............',
  '...TTTcccccccccccccccc..........',
  '.....wwwwwcccccccccccccc........',
  '.....wwwccccccccccccccc.........',
  '.....ccccccccccccccccccc........',
  '.....ccccccccccccccccccc........',
  '.....ccccccccccccccccccc........',
  '.....ccccccccccccccccccc........',
  '.....ccccccccccccccccccc........',
])

const PAWS_FRONT_IDLE = T([
  '..........cccccccccccc..........',
  '..........ccc......ccc..........',
  '..........ccc......ccc..........',
  '.........wwww......wwww.........',
])
const PAWS_FRONT_A = T([
  '.........ccccccccccccc..........',
  '.........ccc........ccc.........',
  '........ccc.........ccc.........',
  '.......wwww.........wwww........',
])
const PAWS_FRONT_B = T([
  '..........ccccccccccccc.........',
  '.........ccc........ccc.........',
  '.........ccc.........ccc........',
  '........wwww.........wwww.......',
])
const PAWS_SIDE_IDLE = T([
  '.....ccccccccccccccccccc........',
  '.....ccc..........cccc..........',
  '.....ccc..........cccc..........',
  '....wwww..........wwww..........',
])
const PAWS_SIDE_A = T([
  '.....ccccccccccccccccccc........',
  '....ccc...........cccc..........',
  '...ccc.............cccc.........',
  '...www.............wwww.........',
])
const PAWS_SIDE_B = T([
  '.....ccccccccccccccccccc........',
  '......ccc.........cccc..........',
  '......ccc..........cccc.........',
  '.....www...........wwww.........',
])
const PAWS_SIT = T([
  '..........cccccccccccc..........',
  '.........cccccccccccccc.........',
  '.........cccccccccccccc.........',
  '.........wwww......wwww.........',
])

const TAIL_FRONT = catTail(22, 20)
const TAIL_SIDE = catTail(23, 19)

const CAT_DEFS: SpriteDef[] = (() => {
  const defs: SpriteDef[] = []
  defs.push(catDef('cat_idle_down', catFrame(CAT_DOWN, PAWS_FRONT_IDLE, TAIL_FRONT)))
  defs.push(catDef('cat_walk_down_0', catFrame(CAT_DOWN, PAWS_FRONT_A, TAIL_FRONT)))
  defs.push(catDef('cat_walk_down_1', catFrame(CAT_DOWN, PAWS_FRONT_B, TAIL_FRONT)))
  defs.push(catDef('cat_idle_up', catFrame(CAT_UP, PAWS_FRONT_IDLE, TAIL_FRONT)))
  defs.push(catDef('cat_walk_up_0', catFrame(CAT_UP, PAWS_FRONT_A, TAIL_FRONT)))
  defs.push(catDef('cat_walk_up_1', catFrame(CAT_UP, PAWS_FRONT_B, TAIL_FRONT)))
  const left = [
    catDef('cat_idle_left', catFrame(CAT_LEFT, PAWS_SIDE_IDLE, TAIL_SIDE)),
    catDef('cat_walk_left_0', catFrame(CAT_LEFT, PAWS_SIDE_A, TAIL_SIDE)),
    catDef('cat_walk_left_1', catFrame(CAT_LEFT, PAWS_SIDE_B, TAIL_SIDE)),
  ]
  defs.push(...left)
  defs.push(...left.map((d) => mirrorDef(d, d.name.replace('_left', '_right'))))
  defs.push(catDef('cat_sit', catFrame(CAT_DOWN, PAWS_SIT, TAIL_FRONT)))
  return defs
})()

/* ==================== ambient critters (frame strips) ==================== */
// Rows hold `frames` frames side by side; every frame keeps a 1px margin so the
// auto outline never bleeds across a frame boundary.

/** Lay equal-height frames side by side, checking every frame is `w` wide. */
function strip(w: number, ...frames: string[][]): string[] {
  const h = frames[0].length
  for (const f of frames) {
    if (f.length !== h) throw new Error('critter frames differ in height')
    for (const r of f) if (r.length !== w) throw new Error(`critter row is ${r.length} wide, expected ${w}: "${r}"`)
  }
  return Array.from({ length: h }, (_, y) => frames.map((f) => f[y]).join(''))
}

const B16 = '.'.repeat(16)
const BUTTERFLY_OPEN = [
  B16,
  '..oo........oo..',
  '.ooooo....ooooo.',
  '.oooooOkkOooooo.',
  '.oooooOkkOooooo.',
  '..oooOOkkOOooo..',
  '...ooO.kk.Ooo...',
  '....O..kk..O....',
  '.......kk.......',
  B16,
  B16,
  B16,
  B16,
  B16,
  B16,
  B16,
]
const BUTTERFLY_SHUT = [
  B16,
  '......oo........',
  '.....oooo.......',
  '.....oOOo.......',
  '.....okko.......',
  '.....okko.......',
  '......kk........',
  '......kk........',
  '......kk........',
  B16,
  B16,
  B16,
  B16,
  B16,
  B16,
  B16,
]

const B24 = '.'.repeat(24)
const CRAB_BODY = [
  B24,
  '..k..................k..',
  '..kk................kk..',
  '.lrrk..............krrl.',
  '.rrrk..............krrr.',
  '..rrr..lllllllll..rrr...',
  '...rr.lllllllllll.rr....',
  '.....lrrwrrrrwrrl.......',
  '.....rrrkrrrrkrrr.......',
  '.....rrrrrrrrrrrr.......',
  '.....rRRrrrrrrRRr.......',
  '......RRRRRRRRRR........',
]
const CRAB_A = [...CRAB_BODY, '......R..R..R..R........', '.....R..R....R..R.......', B24, B24]
const CRAB_B = [...CRAB_BODY, '......R..R..R..R........', '......R...R..R...R......', B24, B24]

const B32 = '.'.repeat(32)
const GULL_UP = [
  B32,
  B32,
  '.....ww...............ww........',
  '.....www.............www........',
  '......www...........www.........',
  '.......www.........www..........',
  '........wwww.....wwww...........',
  '.........wwwwwwwwwww............',
  '..bkwwwwwwwwwwwwwwwww...........',
  '..bwwwwwwwwwwwwwwwwWWgg.........',
  '...WWwwwwwwwwwwwWWWgg...........',
  '......WWWWWWWWWW................',
  B32,
  B32,
  B32,
  B32,
  B32,
  B32,
  B32,
  B32,
]
const GULL_DOWN = [
  B32,
  B32,
  B32,
  B32,
  B32,
  B32,
  '.........wwwwwwwwwww............',
  '..bkwwwwwwwwwwwwwwwww...........',
  '..bwwwwwwwwwwwwwwwwWWgg.........',
  '...WWwwwwwwwwwwwWWWgg...........',
  '.......wwww.....wwww............',
  '......www.........www...........',
  '.....www...........www..........',
  '.....www.............www........',
  '.....ww...............ww........',
  B32,
  B32,
  B32,
  B32,
  B32,
]

const FISH_RISE = [
  B24,
  B24,
  B24,
  '................lbb.....',
  '...............lbbbb....',
  '..............lbbbbbk...',
  '.............bbbbbbb....',
  '............bbbbbbw.....',
  '..........Bbbbbbw.......',
  '.........Bbbbbw.........',
  '.......BBbbbww..........',
  '......BBBbw.............',
  '.....BBBB...............',
  '.....BB.................',
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
]
const FISH_APEX = [
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  '..BB..........llll......',
  '..BBB.......llbbbbbl....',
  '..BBBB....lbbbbbbbbbbl..',
  '..BBBBBBBBbbbbbbbbkbbb..',
  '..BBBBBBBBbbbbwwwbbbbb..',
  '..BBBB....Bbbbbbbbbbb...',
  '..BBB.......BBbbbbbb....',
  '..BB..........BBBB......',
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
]
const FISH_FALL = [
  B24,
  B24,
  B24,
  '.....BB.................',
  '.....BBBB...............',
  '......BBBbl.............',
  '.......BBbbbll..........',
  '.........Bbbbbl.........',
  '..........Bbbbbbl.......',
  '............bbbbbbw.....',
  '.............bbbbbbw....',
  '..............bbbbbwk...',
  '...............wwbbb....',
  '................wbb.....',
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
  B24,
]

const CRITTER_DEFS: SpriteDef[] = [
  // butterflies: frame 0 wings open, frame 1 folded
  {
    name: 'butterfly',
    frames: 2,
    anchor: [8, 8],
    legend: { o: 'orange4', O: 'orange2', k: 'ink2' },
    rows: strip(16, BUTTERFLY_OPEN, BUTTERFLY_SHUT),
  },
  {
    name: 'butterfly_blue',
    frames: 2,
    anchor: [8, 8],
    legend: { o: 'blue5', O: 'blue3', k: 'ink2' },
    rows: strip(16, BUTTERFLY_OPEN, BUTTERFLY_SHUT),
  },
  // gull gliding left; frame 0 wings up, frame 1 wings down
  {
    name: 'gull',
    frames: 2,
    anchor: [16, 12],
    outline: 'outline',
    legend: { w: 'cream6', W: 'cream4', g: 'grey4', k: 'ink2', b: 'orange4' },
    rows: strip(32, GULL_UP, GULL_DOWN),
  },
  // crab scuttling; legs alternate between the two frames
  {
    name: 'crab',
    frames: 2,
    anchor: [12, 14],
    outline: 'outline',
    legend: { r: 'roofRed4', R: 'roofRed2', l: 'roofRed5', k: 'ink2', w: 'cream6' },
    rows: strip(24, CRAB_A, CRAB_B),
  },
  // a small blue fish arcing out of the water: rising, apex, falling
  {
    name: 'fish_jump',
    frames: 3,
    anchor: [12, 16],
    outline: 'outline',
    legend: { b: 'blue5', B: 'blue3', l: 'blue6', w: 'cream6', k: 'ink2' },
    rows: strip(24, FISH_RISE, FISH_APEX, FISH_FALL),
  },
]

/* ============================== the pack ================================ */

export const NPC_DEFS: SpriteDef[] = [...CAST.flatMap(buildRig), ...FACE_DEFS, ...CAT_DEFS, ...CRITTER_DEFS]
