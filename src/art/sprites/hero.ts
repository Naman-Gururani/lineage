// The player — a VISITOR to the isle, drawn HD at 32×48. Deliberately NOT
// Naman: the star NPC wears a teal coat with blue trousers and orange boots
// (see `NAMAN` in sprites/npcs.ts), so the traveller gets a coral/rust jacket,
// brown leather boots and a green canvas backpack. Only `portrait_naman` below
// keeps the teal wardrobe — that card really is Naman.
//
// Rig geometry (spec §3): frame 32×48, body ≈20px wide × 34px tall, feet on
// row 45 (2px of air under them), anchor bottom-centre [16, 46]. Light comes
// from the top-left: every silhouette run on the top/left edge carries the
// ramp's brightest step, shadows use the ramp's dark end. The 1px dark
// silhouette outline is painted by the `outline` field, never by hand.
//
// Vertical map of a rig frame:
//   y 0..11   headroom (hats, raised wrench, rod)
//   y12..y25  HEAD   (14 rows)
//   y26..y31  CHEST  (6 rows — backpack straps front, pack body back/side)
//   y32..y36  ARMS   (5 rows — swap this block to swing the arms)
//   y37..y45  LEGS   (9 rows — swap this block to step)
//   y46..y47  air under the feet (the anchor row + 1)
import { mirrorDef, type Legend, type SpriteDef } from '../pixel'

const W = 32
const H = 48

/** Place `s` with its first character at column `x`; always returns a `w`-wide row. */
const rowAt = (w: number) => (x: number, s = '') => ('.'.repeat(x) + s).padEnd(w, '.').slice(0, w)
const r32 = rowAt(W)
const r28 = rowAt(28)
const r48 = rowAt(48)

/** Run-length row builder for the long flat gradients on the hoodie: rn('c', 12, 't', 2). */
const rn = (...parts: (string | number)[]): string => {
  let s = ''
  for (let i = 0; i < parts.length; i += 2) s += String(parts[i]).repeat(Number(parts[i + 1]))
  return s
}

const L: Legend = {
  // hair — black ramp, dark → rim
  '1': 'hairBlack1',
  h: 'hairBlack2',
  H: 'hairBlack3',
  '2': 'hairBlack5',
  // skin
  d: 'skin2',
  S: 'skin3',
  s: 'skin4',
  k: 'skin5',
  K: 'skin6',
  // eyes & thread
  e: 'ink2',
  w: 'cream6',
  // jacket (coral/rust — the traveller's own colours, never Naman's teal)
  T: 'red2',
  t: 'red3',
  c: 'red4',
  C: 'red5',
  g: 'red6',
  // trousers (blue jeans)
  p: 'blue2',
  P: 'blue3',
  q: 'blue4',
  // boots (brown leather)
  b: 'wood1',
  B: 'wood2',
  o: 'wood4',
  O: 'wood6',
  // backpack (green canvas, complementary to the coral jacket)
  j: 'pine2',
  J: 'pine4',
  l: 'pine6',
  // wrench / reel
  m: 'metal2',
  M: 'metal4',
  n: 'metal5',
  N: 'metal6',
  // pack straps & fishing rod
  x: 'wood2',
  W: 'wood4',
}

const ANCHOR: [number, number] = [16, 46]

/* ------------------------------------------------------------------ *
 * heads — 14 rows each (y12..y25)
 * ------------------------------------------------------------------ */
const HEAD_DOWN = [
  r32(12, '2222HHhh'),
  r32(10, '22222HHHhhh1'),
  r32(9, '22222HHHHhhh11'),
  r32(9, '222HHHHHhhhh11'),
  r32(9, '2HHHHHhhhhh111'),
  r32(9, '2HHHhhhh111111'),
  r32(9, 'HhsssssssssS11'),
  r32(9, 'HhKkkkkkkksS11'),
  r32(9, 'h1kwekksswes11'),
  r32(9, 'h1keekkssees11'),
  r32(10, 'kkkkkSssssSS'),
  r32(10, 'kkkkkddsssSS'),
  r32(11, 'kkkkkssssS'),
  r32(13, 'SSssSS'),
]

const HEAD_UP = [
  r32(12, '2222HHhh'),
  r32(10, '22222HHHhhh1'),
  r32(9, '22222HHHHhhh11'),
  r32(9, '222HHHHHhhhh11'),
  r32(9, '2HHHHHhhhhh111'),
  r32(9, '2HHHHhhhhhh111'),
  r32(9, 'HHHHhhhhhhh111'),
  r32(9, 'HHHhhhhhhhh111'),
  r32(9, 'HHhhhhhhhhh111'),
  r32(9, 'Hhhhhhhhhhh111'),
  r32(10, 'hhhhhhh11111'),
  r32(10, 'hhhhh1111111'),
  r32(11, 'hhhh111111'),
  r32(13, 'ssSSSS'),
]

const HEAD_LEFT = [
  r32(12, '2222HHhh'),
  r32(10, '22222HHHhhh1'),
  r32(9, '22222HHHHhhh11'),
  r32(9, '222HHHHHhhhh11'),
  r32(9, '2HHHHhhhhhh111'),
  r32(9, '2HHhhhhhhh1111'),
  r32(9, 'ssssShhhhh1111'),
  r32(9, 'Kkkkkshhhh1111'),
  r32(9, 'kwekkkshhh1111'),
  r32(8, 'skeekkkshhh1111'),
  r32(9, 'kkddkkShhh111'),
  r32(9, 'kkkkkSshh111'),
  r32(10, 'kkkksShh11'),
  r32(13, 'SssSSS'),
]

/* ------------------------------------------------------------------ *
 * chests — 6 rows each (y26..y31)
 * ------------------------------------------------------------------ */
/* Backpack straps sit on columns 11-12 and 19-20 (symmetric about 15.5). */
const CHEST_DOWN = [
  r32(9, 'gCctTTTTTTttTT'), //                              collar
  r32(6, 'gg' + 'CC' + 'c' + 'xx' + rn('c', 6) + 'xx' + rn('t', 3) + 'TT'), // shoulders + strap tops
  r32(6, 'gCc' + 'cc' + 'xx' + rn('c', 6) + 'xx' + rn('t', 3) + 'TT'),
  r32(6, 'gCc' + 'cc' + 'xx' + rn('c', 6) + 'xx' + rn('t', 3) + 'TT'),
  r32(6, 'gCc' + 'cc' + 'xM' + rn('c', 6) + 'Mx' + rn('t', 3) + 'TT'), //     strap buckles
  r32(6, 'gCc' + rn('c', 2, 'T', 10, 't', 3) + 'TT'), //     pocket seam
]

/* Back view: the pack itself fills columns 11-20. */
const CHEST_UP = [
  r32(9, 'gCctTTTTTTttTT'),
  r32(6, 'gg' + 'CC' + 'c' + 'xx' + rn('c', 6) + 'xx' + rn('t', 3) + 'TT'),
  r32(6, 'gCc' + 'cc' + 'lJJJJJJJJj' + 'tt' + 'tTT'),
  r32(6, 'gCc' + 'cc' + 'ljjjjjjjjj' + 'tt' + 'tTT'), //     flap seam
  r32(6, 'gCc' + 'cc' + 'lJJJMMJJJj' + 'tt' + 'tTT'), //     buckle
  r32(6, 'gCc' + 'cc' + 'lJJJJJJJJj' + 'tt' + 'tTT'),
]

/* Side view: the pack breaks the silhouette behind the back (columns 20-24). */
const CHEST_LEFT = [
  r32(11, 'cTTTTTTTtt'),
  r32(8, 'ggC' + rn('c', 9, 't', 2, 'T', 2)),
  r32(8, 'gC' + rn('c', 10) + 'lJJJJ'),
  r32(8, 'gC' + rn('c', 10) + 'lJJJj'),
  r32(8, 'gC' + rn('c', 10) + 'lJMJj'),
  r32(8, 'gC' + rn('c', 1, 'T', 9) + 'lJJJj'), //            pocket seam + pack
]

/* ------------------------------------------------------------------ *
 * arms — 5 rows each (y32..y36). Front views raise a hand 1px to swing.
 * ------------------------------------------------------------------ */
const HAND_L = ['KKk', 'Kks', 'ksS']
const HAND_R = ['kss', 'ksS', 'sSS']
const CUFF_L = 'CTT'
const CUFF_R = 'TTT'
const GAP = '...'

/** body columns 9..22 under the arms (5 rows: pocket, hem top, hem, hip, hip) */
const BODY_DOWN = [rn('c', 2, 't', 12), rn('c', 12, 't', 2), rn('t', 10, 'T', 4), 'qqqqPPPPPPpppp', 'qqqqPPPPPPpppp']
const BODY_UP = ['cc' + 'ljjjjjjjjj' + 'tt', rn('c', 12, 't', 2), rn('t', 10, 'T', 4), 'qqqqPPPPPPpppp', 'qqqqPPPPPPpppp']

const armsFront = (body: string[], lu: boolean, ru: boolean): string[] => {
  const l = lu ? [...HAND_L, GAP, GAP] : [CUFF_L, ...HAND_L, GAP]
  const r = ru ? [...HAND_R, GAP, GAP] : [CUFF_R, ...HAND_R, GAP]
  return body.map((b, i) => r32(6, l[i] + b + r[i]))
}

/* side view: the near arm swings between three positions */
const SIDE_TORSO = rn('t', 10, 'T', 3) //                    columns 11..23 under the arm
const SIDE_PACK_END = rn('t', 9) + 'ljjj' //                 same span, pack tail on the back
const ARMS_LEFT_IDLE = [
  r32(8, 'gCc' + SIDE_PACK_END),
  r32(8, 'KKk' + SIDE_TORSO),
  r32(8, 'Kks' + SIDE_TORSO),
  r32(8, 'ksS' + 'qqqPPPPpppp'),
  r32(11, 'qqqPPPPpppp'),
]
const ARMS_LEFT_FWD = [
  r32(6, 'KKk' + 'cc' + SIDE_PACK_END),
  r32(6, 'Kks' + 'cc' + SIDE_TORSO),
  r32(6, 'ksS' + 'cc' + SIDE_TORSO),
  r32(11, 'qqqPPPPpppp'),
  r32(11, 'qqqPPPPpppp'),
]
const ARMS_LEFT_BACK = [
  r32(8, 'cc' + rn('t', 10) + 'ljjj'),
  r32(8, 'cc' + rn('t', 10, 'T', 4)),
  r32(8, 'ttKks' + rn('t', 7, 'T', 4)),
  r32(10, 'ksS' + 'PPPPppppp'),
  r32(10, 'sSS' + 'PPPPppppp'),
]

/* ------------------------------------------------------------------ *
 * legs — 9 rows each (y37..y45)
 * ------------------------------------------------------------------ */
const legsDown = (rows: string[]) => rows.map((s) => r32(9, s))

const LEGS_DOWN_IDLE = legsDown([
  'qqqqPPPPPPpppp',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  'OoooBB..oooBBB',
  'OoooBB..oooBBB',
  'bbbbbb..bbbbbb',
])
const LEGS_DOWN_A = legsDown([
  'qqqqPPPPPPpppp',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..oooBBB',
  '.qqqPP..oooBBB',
  'OoooBB..bbbbbb',
  'OoooBB........',
  'bbbbbb........',
])
const LEGS_DOWN_B = legsDown([
  'qqqqPPPPPPpppp',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  'OoooBB..PPppp.',
  'OoooBB..PPppp.',
  'bbbbbb..oooBBB',
  '........oooBBB',
  '........bbbbbb',
])
const LEGS_TUCK = legsDown([
  'qqqqPPPPPPpppp',
  'qqqPPP..PPPppp',
  '.qqPP....PPpp.',
  '.OoooB..oooBB.',
  '.OoooB..oooBB.',
  '..bbb....bbb..',
])
const LEGS_STRETCH = legsDown([
  'qqqqPPPPPPpppp',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.qqqPP..PPppp.',
  '.OoooB..oooBB.',
  '.OoooB..oooBB.',
  '..bbb....bbb..',
])

const LEGS_LEFT_IDLE = [
  r32(10, 'qqqPPPPppppp'),
  r32(11, 'qqPPPPPppp'),
  r32(11, 'qqPPPPPppp'),
  r32(11, 'qqPPPPPppp'),
  r32(11, 'qqPPPPPppp'),
  r32(11, 'qqPPPPPppp'),
  r32(9, 'OOoooooBBBB'),
  r32(9, 'OOoooooBBBB'),
  r32(9, 'bbbbbbbbbbb'),
]
const LEGS_LEFT_A = [
  r32(10, 'qqqPPPPppppp'),
  r32(10, 'qqqPPPPppppp'),
  r32(10, 'qqqPPPPppppp'),
  r32(9, 'qqqPP..PPppp'),
  r32(8, 'qqqPP...PPppp'),
  r32(7, 'qqqPP....PPppp'),
  r32(6, 'OOoooB....oooBB'),
  r32(6, 'OOoooB....oooBB'),
  r32(6, 'bbbbbb....bbbbb'),
]
const LEGS_LEFT_B = [
  r32(10, 'qqqPPPPppppp'),
  r32(10, 'qqqPPPPppppp'),
  r32(10, 'qqqPPPPppppp'),
  r32(9, 'pppPP..PPqqq'),
  r32(8, 'pppPP...PPqqq'),
  r32(7, 'pppPP....PPqqq'),
  r32(6, 'BBoooB....oooOO'),
  r32(6, 'BBoooB....oooOO'),
  r32(6, 'bbbbbb....bbbbb'),
]

/* ------------------------------------------------------------------ *
 * composition helpers
 * ------------------------------------------------------------------ */
const EMPTY = '.'.repeat(W)

/** Stack body blocks under `top` blank rows, padded to a full 32×48 frame. */
const frameOf = (top: number, ...blocks: string[][]): string[] => {
  const out = [...Array.from({ length: top }, () => EMPTY), ...blocks.flat()]
  while (out.length < H) out.push(EMPTY)
  return out.slice(0, H)
}
const compose = (head: string[], chest: string[], arms: string[], legs: string[]) => frameOf(12, head, chest, arms, legs)

/** Stamp `art` at (x,y); a space keeps whatever is underneath. */
const overlay = (rows: string[], x: number, y: number, art: string[]): string[] => {
  const out = [...rows]
  art.forEach((line, i) => {
    const base = out[y + i]
    if (base === undefined) return
    let s = base
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      const px = x + j
      if (ch === ' ' || px < 0 || px >= W) continue
      s = s.slice(0, px) + ch + s.slice(px + 1)
    }
    out[y + i] = s
  })
  return out
}

/** Paint single pixels (used for rods and lines). */
const dots = (rows: string[], ch: string, pts: readonly (readonly [number, number])[]): string[] => {
  const out = [...rows]
  for (const [x, y] of pts) {
    const base = out[y]
    if (base === undefined || x < 0 || x >= W) continue
    out[y] = base.slice(0, x) + ch + base.slice(x + 1)
  }
  return out
}

/* wrench — an open-end spanner; a space keeps whatever is under it (the jaw slot) */
const WRENCH_UP_R = ['NNNN', 'N  N', 'N  N', 'NMMN', ' MM ', ' MM ', ' MM ', ' Mm ']
const WRENCH_UP_L = ['NNNN', 'N  N', 'N  N', 'NMMN', ' MM ', ' MM ', ' MM ', ' mM ']
const WRENCH_SIDE_R = ['     NNN', '     N N', 'mMMMMN N', '     N N', '     NNN']
const WRENCH_SIDE_L = ['NNN     ', 'N N     ', 'N NMMMMm', 'N N     ', 'NNN     ']

/* fishing rod + line */
const ROD_CAST = [
  [2, 16], [3, 17], [3, 18], [4, 19], [4, 20], [5, 21], [5, 22], [6, 23],
  [6, 24], [7, 25], [7, 26], [8, 27], [8, 28], [9, 29], [9, 30], [10, 31], [10, 32], [10, 33],
] as const
const LINE_CAST = [[1, 17], [1, 18], [1, 19], [1, 20], [1, 21], [1, 22], [1, 23], [1, 24]] as const
const GRIP = [[10, 34], [11, 33], [11, 34]] as const
const ROD_REEL = [
  [1, 28], [2, 28], [3, 29], [4, 29], [5, 30], [6, 30], [7, 31], [8, 31], [9, 32], [10, 32], [10, 33],
] as const
const LINE_REEL = [[0, 29], [0, 30], [0, 31], [0, 32], [0, 33], [0, 34]] as const
const REEL = [[11, 33], [12, 33], [11, 34], [12, 34]] as const

/* ------------------------------------------------------------------ *
 * portrait_naman — 48×48 bust for the welcome card
 * ------------------------------------------------------------------ */
const PORTRAIT_L: Legend = {
  // dusk backdrop, bright at the top-left, one warm step into the corners
  A: 'ink6',
  a: 'ink5',
  V: 'ink4',
  v: 'ink3',
  // hair, lifted a step so it reads against the indigo
  '1': 'hairBlack2',
  h: 'hairBlack3',
  H: 'hairBlack4',
  '2': 'hairBlack6',
  d: 'skin2',
  S: 'skin3',
  s: 'skin4',
  k: 'skin5',
  K: 'skin6',
  e: 'ink1',
  w: 'cream6',
  T: 'teal2',
  t: 'teal3',
  c: 'teal4',
  C: 'teal5',
  g: 'teal6',
}

const PORTRAIT_BG = (() => {
  const out: string[] = []
  for (let y = 0; y < 48; y++) {
    let s = ''
    for (let x = 0; x < 48; x++) {
      if (Math.min(x, 47 - x) + Math.min(y, 47 - y) < 3) {
        s += '.'
        continue
      }
      const d = Math.hypot((x - 15) / 34, (y - 12) / 36)
      s += d < 0.45 ? 'A' : d < 0.72 ? 'a' : d < 0.98 ? 'V' : 'v'
    }
    out.push(s)
  }
  return out
})()

const PORTRAIT_BUST: [number, string][] = [
  [19, 'HHHHHHHHHH'],
  [16, '2222HHHHHHHHhhhh'],
  [15, '22222HHHHHHHHhhhhh'],
  [14, '222222HHHHHHHHhhhhhh'],
  [13, '2222222HHHHHHHHhhhhhh1'],
  [13, '222222HHHHHHHHhhhhhh11'],
  [13, '2222HHHHHHHHHhhhhhhh11'],
  [13, '222HHHHHHHHHHhhhhhhh11'],
  [13, '22HHHHHHHHHhhhhhhhh111'],
  [13, '2HHHHHhhhhhhhhhhhh1111'],
  [13, 'HhssssssssssssssssSS11'],
  [13, 'HhKkkkkkkkkkkkkkssS11'],
  [13, 'HhkkhhhhhkkkkhhhhhsS11'],
  [13, 'HhkkkkkkkkkkkkkksssS11'],
  [13, 'HhkkkweekkkkkkweessS11'],
  [13, 'HhkkkeeekkkkkkeeessS11'],
  [13, 'HhkkkssskkkkkksssssS11'],
  [14, 'hkkkkkkkkkkkkkkkssS1'],
  [14, 'hkkkkkkkssSSkkkkssS1'],
  [14, 'hkkkkkkkkSSkkkkkssS1'],
  [15, 'kkkkkkkkkkksssSS11'],
  [15, 'kkkkkdkkkkkkdsssS1'],
  [15, 'kkkkkkddddddssssS1'],
  [16, 'kkkkkkkkkkssssS1'],
  [17, 'kkkkkkkkssssS1'],
  [18, 'kkkkkkssssSS'],
  [19, 'kkkkssssSS'],
  [20, 'SSSSSSSS'],
  [20, 'skkkkksS'],
  [20, 'skkkkksS'],
  [19, 'sskkkkkksS'],
  [12, 'gCccttTTTTTTTTTTTTttttTT'],
  [8, 'ggCCccccccTTTTTTTTTTTTttttTTTTTT'],
  [6, 'ggCCccccccccccTTTTTTTTccccttttTTTTTT'],
  [5, 'ggCCcccccccccccccTTTTccccccttttttTTTTT'],
  [4, 'ggCCccccccccccccccccccttttttttTTTTTTTT'],
  [4, 'ggCCccccccccccccccccccttttttttTTTTTTTT'],
  [4, 'ggCCcccccccccccccwccccwcttttttttTTTTTTTT'],
  [4, 'ggCCcccccccccccccwccccwcttttttttTTTTTTTT'],
  [4, 'ggCCcccccccccccccwccccwcttttttttTTTTTTTT'],
  [4, 'ggCCccccccccccccccccccccttttttttTTTTTTTT'],
  [4, 'ggCCccccccccccccccccccccttttttttTTTTTTTT'],
  [4, 'ggCCccccccccccccccccccccttttttttTTTTTTTT'],
  [4, 'ggCCccccccccccccccccccccttttttttTTTTTTTT'],
]

const PORTRAIT_ROWS = (() => {
  const out = [...PORTRAIT_BG]
  PORTRAIT_BUST.forEach(([x, s], i) => {
    const y = 4 + i
    const base = out[y]
    out[y] = r48(0, base.slice(0, x) + s + base.slice(x + s.length))
  })
  return out
})()

/* ------------------------------------------------------------------ *
 * pack
 * ------------------------------------------------------------------ */
export const HERO_DEFS: SpriteDef[] = (() => {
  const defs: SpriteDef[] = []
  const rig = (name: string, rows: string[]) => defs.push({ name, rows, legend: L, outline: 'outline', anchor: ANCHOR })

  /* ---- facing down ---- */
  const downIdle = compose(HEAD_DOWN, CHEST_DOWN, armsFront(BODY_DOWN, false, false), LEGS_DOWN_IDLE)
  rig('hero_idle_down', downIdle)
  rig('hero_walk_down_0', compose(HEAD_DOWN, CHEST_DOWN, armsFront(BODY_DOWN, true, false), LEGS_DOWN_A))
  rig('hero_walk_down_1', downIdle)
  rig('hero_walk_down_2', compose(HEAD_DOWN, CHEST_DOWN, armsFront(BODY_DOWN, false, true), LEGS_DOWN_B))
  rig('hero_walk_down_3', downIdle)
  rig(
    'hero_swing_down_0',
    overlay(compose(HEAD_DOWN, CHEST_DOWN, armsFront(BODY_DOWN, false, true), LEGS_DOWN_IDLE), 23, 24, WRENCH_UP_R),
  )
  rig('hero_swing_down_1', overlay(downIdle, 24, 32, WRENCH_SIDE_R))

  /* ---- facing up ---- */
  const upIdle = compose(HEAD_UP, CHEST_UP, armsFront(BODY_UP, false, false), LEGS_DOWN_IDLE)
  rig('hero_idle_up', upIdle)
  rig('hero_walk_up_0', compose(HEAD_UP, CHEST_UP, armsFront(BODY_UP, true, false), LEGS_DOWN_A))
  rig('hero_walk_up_1', upIdle)
  rig('hero_walk_up_2', compose(HEAD_UP, CHEST_UP, armsFront(BODY_UP, false, true), LEGS_DOWN_B))
  rig('hero_walk_up_3', upIdle)
  rig('hero_swing_up_0', overlay(compose(HEAD_UP, CHEST_UP, armsFront(BODY_UP, true, false), LEGS_DOWN_IDLE), 5, 24, WRENCH_UP_L))
  rig('hero_swing_up_1', overlay(upIdle, 0, 32, WRENCH_SIDE_L))

  /* ---- facing left (right is mirrored) ---- */
  const mirrored: SpriteDef[] = []
  const rigLeft = (name: string, rows: string[]) => {
    const d: SpriteDef = { name, rows, legend: L, outline: 'outline', anchor: ANCHOR }
    defs.push(d)
    mirrored.push(d)
  }
  const leftIdle = compose(HEAD_LEFT, CHEST_LEFT, ARMS_LEFT_IDLE, LEGS_LEFT_IDLE)
  rigLeft('hero_idle_left', leftIdle)
  rigLeft('hero_walk_left_0', compose(HEAD_LEFT, CHEST_LEFT, ARMS_LEFT_FWD, LEGS_LEFT_A))
  rigLeft('hero_walk_left_1', leftIdle)
  rigLeft('hero_walk_left_2', compose(HEAD_LEFT, CHEST_LEFT, ARMS_LEFT_BACK, LEGS_LEFT_B))
  rigLeft('hero_walk_left_3', leftIdle)
  rigLeft('hero_swing_left_0', overlay(compose(HEAD_LEFT, CHEST_LEFT, ARMS_LEFT_FWD, LEGS_LEFT_IDLE), 5, 24, WRENCH_UP_L))
  rigLeft('hero_swing_left_1', overlay(leftIdle, 0, 32, WRENCH_SIDE_L))
  for (const d of mirrored) defs.push(mirrorDef(d, d.name.replace('_left', '_right')))

  /* ---- airborne pair: tuck then stretch ---- */
  rig('hero_hop_0', frameOf(8, HEAD_DOWN, CHEST_DOWN, armsFront(BODY_DOWN, true, true), LEGS_TUCK))
  rig('hero_hop_1', frameOf(6, HEAD_DOWN, CHEST_DOWN, armsFront(BODY_DOWN, true, true), LEGS_STRETCH))

  /* ---- fishing (side view, rod out over the water) ---- */
  rig('hero_fish_cast', dots(dots(dots(leftIdle, 'W', ROD_CAST), 'x', GRIP), 'w', LINE_CAST))
  rig('hero_fish_reel', dots(dots(dots(leftIdle, 'W', ROD_REEL), 'w', LINE_REEL), 'M', REEL))

  /* ---- welcome-card portrait ---- */
  defs.push({ name: 'portrait_naman', rows: PORTRAIT_ROWS, legend: PORTRAIT_L, outline: 'outline', anchor: [24, 48] })

  /* ---- hats ----
   * 28×20, anchored bottom-centre. Player.ts pins the hat image 19px above the
   * feet, so the frame's transparent skirt does the positioning: frame row r
   * lands on rig row r+7, i.e. the art (rows 3..11) sits on rig rows 10..18 —
   * right on the hairline of the 32×48 head. */
  const hat = (name: string, rows: string[], legend: Legend) =>
    defs.push({ name, rows, legend, outline: 'outline', anchor: [14, 20] })
  const hatRows = (art: [number, string][], top: number) => {
    const out: string[] = []
    for (let i = 0; i < 20; i++) out.push(r28(0))
    art.forEach(([x, s], i) => (out[top + i] = r28(x, s)))
    return out
  }

  hat(
    'hat_hardhat',
    hatRows(
      [
        [11, 'llyyyy'],
        [9, 'llyyyyyyyy'],
        [8, 'llyyyyyyyyyy'],
        [8, 'lyyyyyyyyyYY'],
        [7, 'lyyyyyyyyyyYYY'],
        [7, 'lyyyyyyyyyyYYY'],
        [6, 'lyyyyyyyyyyyYYYY'],
        [4, 'llyyyyyyyyyyyyyyYYYY'],
        [4, 'YYYYYYYYYYYYYYYYdddd'],
      ],
      3,
    ),
    { y: 'yellow5', Y: 'yellow3', l: 'yellow6', d: 'yellow2' },
  )

  hat(
    'hat_seashell',
    hatRows(
      [
        [12, 'CCpp'],
        [10, 'CCppccPP'],
        [8, 'CCppccppccPP'],
        [7, 'CcppccppccppPP'],
        [6, 'CcppccppccppccPP'],
        [5, 'CcppccppccppccppPP'],
        [4, 'CcppccppccppccppccPP'],
        [4, 'dddddddddddddddddddd'],
      ],
      4,
    ),
    { p: 'pink5', P: 'pink3', c: 'cream5', C: 'cream6', d: 'pink2' },
  )

  hat(
    'hat_catears',
    hatRows(
      [
        [5, '..K............k..'],
        [5, '.KKK..........kkk.'],
        [5, 'KKppK........kPPPk'],
        [5, 'KKppK........kPPPk'],
        [5, 'KKppK........kPPPk'],
        [5, 'KKkkk........kkkkk'],
        [6, 'KKkkkkkkkkkkkkkk'],
        [6, 'Kkkkkkkkkkkkkkbb'],
        [6, 'bbbbbbbbbbbbbbbb'],
      ],
      2,
    ),
    { k: 'hairBlack2', K: 'hairBlack4', p: 'pink5', P: 'pink3', b: 'hairBlack1' },
  )

  hat(
    'hat_crown',
    hatRows(
      [
        [5, 'l...g...g...g...G.'],
        [5, 'll..gg..gg..gg..gG'],
        [5, 'llgggggggggggggggG'],
        [5, 'lgggrrggrrggrrgggG'],
        [5, 'lggggggggggggggggG'],
        [5, 'lggggggggggggggggG'],
        [5, 'GGGGGGGGGGGGGGGGGG'],
        [5, 'bbbbbbbbbbbbbbbbbb'],
      ],
      4,
    ),
    { g: 'yellow5', G: 'yellow3', l: 'yellow7', r: 'red4', b: 'yellow2' },
  )

  hat(
    'hat_goggles',
    hatRows(
      [
        [4, '.MMMMMM......MMMMMM.'],
        [4, '.MGGGGM.bbbb.MggggM.'],
        [4, '.MGGggM.bbbb.MggggM.'],
        [4, '.MggggM.bbbb.MggggM.'],
        [4, '.mMMMMm.wbbb.mMMMMm.'],
        [4, '..mmmm........mmmm..'],
      ],
      6,
    ),
    { m: 'metal3', M: 'metal5', b: 'wood2', w: 'wood4', g: 'glass4', G: 'glass6' },
  )

  hat(
    'hat_captain',
    hatRows(
      [
        [9, 'wwwwwwwwww'],
        [7, 'wwwwwwwwwwwwww'],
        [6, 'wwwwwwwwwwwwwwWW'],
        [6, 'WWWWWWWWWWWWWWWW'],
        [5, 'nnnnnnnyyyynnnnnnn'],
        [5, 'nnnnnnnyYYynnnnnnn'],
        [4, 'llnnnnnnnnnnnnnnnnnn'],
        [4, 'dddddddddddddddddddd'],
      ],
      4,
    ),
    { n: 'blue2', l: 'blue6', w: 'cream6', W: 'cream4', y: 'yellow5', Y: 'yellow3', d: 'ink2' },
  )

  hat(
    'hat_grad',
    hatRows(
      [
        [13, 'yy'],
        [2, 'lkkkkkkkkkkkkkkkkkkkkdd'],
        [2, 'kddddddddddddddddddddddd'],
        [6, 'lKKKKKKKKKKKKKKd..y'],
        [6, 'lKKKKKKKKKKKKKKd..y'],
        [6, 'lKKKKKKKKKKKKKKd..y'],
        [6, 'lkkkkkkkkkkkkkkd.yyy'],
        [6, 'dddddddddddddddd.YYY'],
      ],
      4,
    ),
    { d: 'ink2', k: 'ink4', K: 'ink5', l: 'ink6', y: 'yellow5', Y: 'yellow3' },
  )

  /* ---- ground shadow (entities draw this; nothing is baked into a frame) ---- */
  defs.push({
    name: 'shadow',
    rows: [
      r32(9, 'ssssssssssssss'),
      r32(6, 'sSSSSSSSSSSSSSSSSSSs'),
      r32(4, 'sSSSSSSSSSSSSSSSSSSSSSSs'),
      r32(3, 'sSSSSSSSSSSSSSSSSSSSSSSSSs'),
      r32(3, 'sSSSSSSSSSSSSSSSSSSSSSSSSs'),
      r32(4, 'sSSSSSSSSSSSSSSSSSSSSSSs'),
      r32(6, 'sSSSSSSSSSSSSSSSSSSs'),
      r32(9, 'ssssssssssssss'),
    ],
    legend: { s: 'shadowSoft', S: 'shadow' },
    anchor: [16, 4],
  })

  return defs
})()
