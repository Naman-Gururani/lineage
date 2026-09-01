// Tower Climb — the scaffold on the outside of Barclays Tower. The lift is out,
// so you go up the hard way: three floors of ledges, spikes and a moving hoist.
//
// Pure physics: no DOM, no Phaser, no timers and no clock of its own. The
// renderer in src/ui/minigames/climb.ts owns the frame loop and the pixels and
// only ever calls the functions here, which means the tests can drive the exact
// same reducer at the exact same 60 Hz — and the stage-reachability test can
// prove there is a way up by *playing* each stage rather than by asserting a
// hand-written table of legal hops.
//
// Everything is measured in "climb units": the stage grid is CLIMB_TILE units a
// cell, and (x, y) is the hero's feet — centre of the body, bottom of it.
import { PROFILE } from '../data/content'

export type ClimbInput = { left: boolean; right: boolean; jump: boolean }

export type ClimbState = {
  /** feet: x is the centre of the body, y is the sole */
  x: number
  y: number
  vx: number
  vy: number
  grounded: boolean
  /** seconds of ledge-forgiveness left after walking off (see CLIMB.COYOTE) */
  coyote: number
  /** seconds a jump pressed a shade early stays queued (see CLIMB.BUFFER) */
  buffer: number
  /** falls taken across the whole climb, not just this floor */
  falls: number
  /** which floor: an index into CLIMB_STAGES */
  stage: number
  /** true on the one tick a *new* checkpoint is banked — the renderer's cue */
  atCheckpoint: boolean
  /** this floor is cleared */
  done: boolean
  /* --- three fields the brief's behaviour needs and its sketch left implicit --- */
  /**
   * Seconds since this floor began. Moving ledges are a function of it, so a
   * state without a clock could not say where they are.
   */
  t: number
  /** where a fall puts you back: the last checkpoint, or the start of the floor */
  cx: number
  cy: number
  /** out of falls: the climb is over, and it was not the roof */
  over: boolean
}

export const CLIMB = { G: 1400, JUMP_V: -420, MOVE_V: 150, COYOTE: 0.08, BUFFER: 0.1, MAX_FALLS: 3 } as const

/** One stage cell, in climb units. */
export const CLIMB_TILE = 20
/** The hero's box: half a body wide, most of a cell tall. */
export const CLIMB_BODY = { hw: 6, h: 18 } as const
/** A moving ledge: two cells wide, a third of one deep. */
export const CLIMB_PLATFORM = { w: 2 * CLIMB_TILE, h: 8 } as const

/**
 * A moving ledge. `x`/`y` are its left/top in *cells*, `range` how many cells it
 * sweeps to the right before turning round, `speed` in cells a second.
 */
export type StagePlatform = { x: number; y: number; range: number; speed: number }

/** A floor: `#` solid · `^` spikes · `C` checkpoint · `E` exit · `@` start · `.` air. */
export type StageData = { rows: string[]; platforms: StagePlatform[] }

export type Rect = { x: number; y: number; w: number; h: number }

const EPS = 1e-6

/* ------------------------------------------------------------------ */
/* the stage grid                                                      */

const glyph = (data: StageData, col: number, row: number): string => {
  if (row < 0 || row >= data.rows.length) return '.'
  const r = data.rows[row]
  return col < 0 || col >= r.length ? '.' : r[col]
}

/** Out of the sides is wall; above the top is open sky and below the floor is the void. */
const solid = (data: StageData, col: number, row: number): boolean => {
  const cols = data.rows[0]?.length ?? 0
  if (col < 0 || col >= cols) return true
  return glyph(data, col, row) === '#'
}

const stageW = (data: StageData) => (data.rows[0]?.length ?? 0) * CLIMB_TILE
const stageH = (data: StageData) => data.rows.length * CLIMB_TILE

/** Every cell the body strictly overlaps, standing with its feet at (x, y). */
function bodyCells(x: number, y: number): { c0: number; c1: number; r0: number; r1: number } {
  return {
    c0: Math.floor((x - CLIMB_BODY.hw) / CLIMB_TILE),
    c1: Math.ceil((x + CLIMB_BODY.hw) / CLIMB_TILE) - 1,
    r0: Math.floor((y - CLIMB_BODY.h) / CLIMB_TILE),
    r1: Math.ceil(y / CLIMB_TILE) - 1,
  }
}

/** The first cell under the body carrying `ch`, or null. */
function findUnder(data: StageData, x: number, y: number, ch: string): { col: number; row: number } | null {
  const { c0, c1, r0, r1 } = bodyCells(x, y)
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (glyph(data, c, r) === ch) return { col: c, row: r }
  return null
}

/** Where the `@` stands: feet centred in its cell, on top of whatever is beneath. */
export function stageStart(data: StageData): { x: number; y: number } {
  for (let r = 0; r < data.rows.length; r++) {
    const c = data.rows[r].indexOf('@')
    if (c >= 0) return { x: (c + 0.5) * CLIMB_TILE, y: (r + 1) * CLIMB_TILE }
  }
  return { x: CLIMB_TILE, y: stageH(data) - CLIMB_TILE }
}

/**
 * Where each moving ledge is at time `t` — a triangle wave, so it travels at a
 * constant speed and turns round on the spot rather than easing.
 */
export function platformRects(data: StageData, t: number): Rect[] {
  return data.platforms.map((p) => {
    const span = p.range * CLIMB_TILE
    const rate = p.speed * CLIMB_TILE
    let dx = 0
    if (span > 0 && rate > 0) {
      const period = (2 * span) / rate
      const u = ((t % period) + period) % period
      const travelled = u * rate
      dx = travelled <= span ? travelled : 2 * span - travelled
    }
    return { x: p.x * CLIMB_TILE + dx, y: p.y * CLIMB_TILE, w: CLIMB_PLATFORM.w, h: CLIMB_PLATFORM.h }
  })
}

export function climbInit(data: StageData, stage = 0, falls = 0): ClimbState {
  const at = stageStart(data)
  return {
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    grounded: true,
    coyote: CLIMB.COYOTE,
    buffer: 0,
    falls,
    stage,
    atCheckpoint: false,
    done: false,
    t: 0,
    cx: at.x,
    cy: at.y,
    over: false,
  }
}

/* ------------------------------------------------------------------ */
/* collision                                                           */

/** Slide along the wall: push the body out of any solid column it now overlaps. */
function resolveX(data: StageData, x: number, y: number, dx: number): number {
  if (dx === 0) return x
  const rTop = Math.floor((y - CLIMB_BODY.h + EPS) / CLIMB_TILE)
  const rBot = Math.ceil((y - EPS) / CLIMB_TILE) - 1
  let out = x
  const c0 = Math.floor((x - CLIMB_BODY.hw) / CLIMB_TILE)
  const c1 = Math.ceil((x + CLIMB_BODY.hw) / CLIMB_TILE) - 1
  for (let c = c0; c <= c1; c++)
    for (let r = rTop; r <= rBot; r++)
      if (solid(data, c, r)) {
        if (dx > 0) out = Math.min(out, c * CLIMB_TILE - CLIMB_BODY.hw)
        else out = Math.max(out, (c + 1) * CLIMB_TILE + CLIMB_BODY.hw)
      }
  return out
}

type Landing = { y: number; vy: number; grounded: boolean }

/**
 * Land on the first surface the feet cross on the way down, or stop under the
 * first ceiling the head meets on the way up. Moving ledges are one-way: you
 * jump up through them and land on top, which is what makes a hoist you can
 * stand under any use at all.
 */
function resolveY(data: StageData, plats: Rect[], x: number, y0: number, y: number, vy: number): Landing {
  const c0 = Math.floor((x - CLIMB_BODY.hw + EPS) / CLIMB_TILE)
  const c1 = Math.ceil((x + CLIMB_BODY.hw - EPS) / CLIMB_TILE) - 1
  const rowHasSolid = (row: number) => {
    for (let c = c0; c <= c1; c++) if (solid(data, c, row)) return true
    return false
  }
  if (vy >= 0) {
    let landed: number | null = null
    const from = Math.floor(y0 / CLIMB_TILE)
    const to = Math.floor(y / CLIMB_TILE)
    for (let r = from; r <= to; r++) {
      const top = r * CLIMB_TILE
      if (top < y0 - EPS || top > y) continue
      if (rowHasSolid(r)) {
        landed = top
        break
      }
    }
    for (const p of plats) {
      if (p.y < y0 - EPS || p.y > y) continue
      if (x + CLIMB_BODY.hw <= p.x || x - CLIMB_BODY.hw >= p.x + p.w) continue
      landed = landed === null ? p.y : Math.min(landed, p.y)
    }
    if (landed !== null) return { y: landed, vy: 0, grounded: true }
    return { y, vy, grounded: false }
  }
  const headFrom = y0 - CLIMB_BODY.h
  const headTo = y - CLIMB_BODY.h
  for (let r = Math.floor(headFrom / CLIMB_TILE); r >= Math.floor(headTo / CLIMB_TILE); r--) {
    const bottom = (r + 1) * CLIMB_TILE
    if (bottom > headFrom + EPS || bottom < headTo) continue
    if (rowHasSolid(r)) return { y: bottom + CLIMB_BODY.h, vy: 0, grounded: false }
  }
  return { y, vy, grounded: false }
}

/* ------------------------------------------------------------------ */
/* the step                                                            */

/**
 * One tick of the climb.
 *
 * The order matters and is the usual platformer one: bookkeeping, then the two
 * axes separately, and the jump *last* — applied after the landing is resolved,
 * so a jump pressed a frame early leaves the ground the moment the feet touch it
 * rather than a frame later. `jump` is an edge, not a hold: the renderer sends
 * `true` on the tick the key goes down and `false` while it stays down, which is
 * what makes the buffer mean anything.
 */
export function climbStep(s: ClimbState, inp: ClimbInput, dt: number, data: StageData): ClimbState {
  if (s.done || s.over || !(dt > 0)) return s
  const t = s.t + dt
  let coyote = s.grounded ? CLIMB.COYOTE : Math.max(0, s.coyote - dt)
  let buffer = inp.jump ? CLIMB.BUFFER : Math.max(0, s.buffer - dt)
  const vx = CLIMB.MOVE_V * ((inp.right ? 1 : 0) - (inp.left ? 1 : 0))

  // a ledge under your feet takes you with it
  const was = platformRects(data, s.t)
  const now = platformRects(data, t)
  let x = s.x
  if (s.grounded)
    for (let i = 0; i < was.length; i++) {
      const p = was[i]
      if (Math.abs(p.y - s.y) > 1) continue
      if (s.x + CLIMB_BODY.hw <= p.x || s.x - CLIMB_BODY.hw >= p.x + p.w) continue
      x += now[i].x - p.x
      break
    }

  const carried = x - s.x
  const moved = vx * dt
  x = resolveX(data, x + moved, s.y, moved + carried)
  let vy = s.vy + CLIMB.G * dt
  const land = resolveY(data, now, x, s.y, s.y + vy * dt, vy)
  let y = land.y
  let grounded = land.grounded
  vy = land.vy

  if (buffer > 0 && (grounded || coyote > 0)) {
    vy = CLIMB.JUMP_V
    grounded = false
    coyote = 0
    buffer = 0
  }

  // spikes, or straight out of the bottom of the world
  const hurt = !!findUnder(data, x, y, '^') || y - CLIMB_BODY.h > stageH(data)
  if (hurt) {
    const falls = s.falls + 1
    if (falls >= CLIMB.MAX_FALLS) return { ...s, t, falls, vx: 0, vy: 0, over: true, atCheckpoint: false }
    return { ...s, t, falls, x: s.cx, y: s.cy, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, atCheckpoint: false }
  }

  let { cx, cy } = s
  let atCheckpoint = false
  const flag = findUnder(data, x, y, 'C')
  if (flag) {
    const fx = (flag.col + 0.5) * CLIMB_TILE
    const fy = (flag.row + 1) * CLIMB_TILE
    if (fx !== cx || fy !== cy) {
      cx = fx
      cy = fy
      atCheckpoint = true
    }
  }

  const done = !!findUnder(data, x, y, 'E')
  return { ...s, t, x, y, vx, vy, grounded, coyote, buffer, cx, cy, atCheckpoint, done }
}

/* ------------------------------------------------------------------ */
/* the tower                                                           */

/**
 * What each floor is standing in for. The middle line reads its employer from
 * `content.ts` so the tower can never claim a job the About page has moved on
 * from; the numbers on either side are pinned by the stage test.
 */
export const CLIMB_CAPTIONS = ['2023 — DevOps Intern', `2024 — SDE, ${PROFILE.company}`, 'The Lineage Engine — 750M records/day']

/**
 * The three floors, 24 × 14 cells each.
 *
 * Floor 1 is the shape the design drew, verbatim, and is the worked example the
 * other two are cut to: a staircase of two-cell hops (the jump clears just under
 * three cells, so two is the honest step), spikes only where a greedy line would
 * take you, and one hoist doing the work no static ledge could — the long run
 * back left across the top, which nothing in the drawn rows spans.
 */
export const CLIMB_STAGES: StageData[] = [
  {
    rows: [
      '........................',
      '.E......................',
      '####....................',
      '....................^^..',
      '............########.C..',
      '........................',
      '......###....^^.........',
      '..C........####.........',
      '####....................',
      '........................',
      '.....########...........',
      '........................',
      '@...........###.........',
      '########################',
    ],
    platforms: [
      // the long haul back to the exit ledge, and a perch under the high flag
      { x: 5, y: 2, range: 7, speed: 4 },
      { x: 20, y: 5, range: 2, speed: 1.6 },
    ],
  },
  {
    rows: [
      '........................',
      '.........E..............',
      '........####............',
      '........................',
      '....................C...',
      '..................###...',
      '..............C..^^.....',
      '.............####.......',
      '....^^..................',
      '.........###............',
      '...............^^.......',
      '....###.................',
      '.@......^^..............',
      '########################',
    ],
    platforms: [{ x: 12, y: 3, range: 7, speed: 4 }],
  },
  {
    rows: [
      '........................',
      '........................',
      '.............E..........',
      '............####........',
      '..^^....................',
      '........................',
      '..............C.........',
      '.............####.......',
      '.........C..............',
      '........####............',
      '...............^^.......',
      '...####.................',
      '.@.......^^.............',
      '########################',
    ],
    platforms: [{ x: 15, y: 5, range: 4, speed: 3 }],
  },
]
