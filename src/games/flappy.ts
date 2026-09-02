// Chalk Flight — the rules of Flappy Bird, with none of the chalk.
//
// The renderer in `ui/minigames/flappy.ts` owns the board, the books and the
// interpolated draw; everything that decides *what* is true — where the bird is,
// where the gaps sit, when a column scores, what kills, and what the "Hire me"
// lifeline actually buys — lives here as plain functions over a plain state.
// No Phaser, no document, no wall clock: `step` is handed a fixed slice of time
// and hands back the next state, so a whole run can be flown in a test.
import { makeRng } from '../core/rng'

export const FLAPPY = {
  W: 480,
  H: 360,
  /** Ten gaps and the notice board is yours. */
  WIN: 10,
  GRAVITY: 1500,
  FLAP: -420,
  SPEED: 150,
  /** What the scroll gains every five gaps. */
  SPEED_GAIN: 0.05,
  GAP: 130,
  SPACING: 220,
  R: 10,
  /** The chalk line the board stands on; below it is the tray, not the game. */
  FLOOR: 330,
  COL_W: 52,
  GRACE_MS: 1000,
} as const

/** The bird holds its x and the board scrolls past it — the whole of Flappy Bird. */
export const BIRD_X = FLAPPY.W * 0.3

/**
 * How close the gap's top edge may come to the ceiling, and — with the gap's own
 * height — to the floor. A gap flush against either edge is not a hard column,
 * it is an unflyable one.
 */
const EDGE = 60
const GAP_MIN = EDGE
const GAP_MAX = FLAPPY.FLOOR - EDGE - FLAPPY.GAP

/** How much board `revive` sweeps clear around the bird before letting go of it. */
const REVIVE_CLEAR = 120

export type Column = {
  /** left edge, in logical px; the column spans `COL_W` to its right */
  x: number
  /** top of the gap; the gap runs from here to `gapY + GAP` */
  gapY: number
  /** already counted — a column scores exactly once */
  passed: boolean
}

export type FlappyState = {
  y: number
  vy: number
  cols: Column[]
  score: number
  speed: number
  dead: boolean
  /** false until the first flap: the board waits, and nothing can kill you */
  started: boolean
  /** ms of invulnerability left, granted by `revive` */
  grace: number
  /**
   * The random cursor, not the run's label: every spawn deals its gap and then
   * deals the seed the *next* spawn starts from. That is what keeps `step` a
   * pure function of its argument — no `Rng` object to carry through the state,
   * no counter to keep in sync — while `newFlappy(n)` still always deals the
   * same board.
   */
  seed: number
  /** ms since the round opened; drives the idle bob and the renderer's flutter */
  t: number
}

export type Rect = { x: number; y: number; w: number; h: number }

/** One gap, and the cursor the next one is dealt from. */
function dealGap(seed: number): { gapY: number; seed: number } {
  const rng = makeRng(seed)
  return { gapY: Math.round(rng.range(GAP_MIN, GAP_MAX)), seed: rng.int(1, 0x3fffffff) }
}

/**
 * The two stacks of books a column is made of: everything above the gap and
 * everything below it, down to the floor. The renderer draws inside these and
 * the collision test kills inside these, so what you see is exactly what hits.
 */
export function columnRects(c: Column): [Rect, Rect] {
  const below = c.gapY + FLAPPY.GAP
  return [
    { x: c.x, y: 0, w: FLAPPY.COL_W, h: c.gapY },
    { x: c.x, y: below, w: FLAPPY.COL_W, h: FLAPPY.FLOOR - below },
  ]
}

/** Circle against axis-aligned box, by the nearest point on the box. */
function hits(cx: number, cy: number, r: number, b: Rect): boolean {
  const nx = Math.min(Math.max(cx, b.x), b.x + b.w)
  const ny = Math.min(Math.max(cy, b.y), b.y + b.h)
  const dx = cx - nx
  const dy = cy - ny
  // Strictly inside: a bird that grazes a corner exactly has not hit it.
  return dx * dx + dy * dy < r * r
}

export function newFlappy(seed = 1): FlappyState {
  const cols: Column[] = []
  let cursor = seed
  for (let i = 0; i < 3; i++) {
    const dealt = dealGap(cursor)
    cursor = dealt.seed
    cols.push({ x: FLAPPY.W + 60 + i * FLAPPY.SPACING, gapY: dealt.gapY, passed: false })
  }
  return {
    y: FLAPPY.H / 2,
    vy: 0,
    cols,
    score: 0,
    speed: FLAPPY.SPEED,
    dead: false,
    started: false,
    grace: 0,
    seed: cursor,
    t: 0,
  }
}

/** Tap. The first one also starts the board moving. */
export function flap(s: FlappyState): FlappyState {
  if (s.dead) return s
  return { ...s, started: true, vy: FLAPPY.FLAP }
}

/**
 * One fixed slice of the world.
 *
 * Order matters: the bird moves, the board scrolls and scores, and only then is
 * anything asked whether it touched. Testing collisions against last frame's
 * column positions is how a game ends up killing you a pixel after the gap.
 */
export function step(s: FlappyState, dtMs: number): FlappyState {
  if (s.dead) return s
  const dt = dtMs / 1000
  const t = s.t + dtMs

  // Before the first tap the board holds still and the bird hovers, so a player
  // reading the rule line cannot lose the round by reading it.
  if (!s.started) return { ...s, t, y: FLAPPY.H / 2 + Math.sin(t / 260) * 6 }

  let vy = s.vy + FLAPPY.GRAVITY * dt
  let y = s.y + vy * dt
  const grace = Math.max(0, s.grace - dtMs)

  // The whole board translates by one number, so the speed the gaps were dealt
  // at cannot change halfway through a step.
  const dx = s.speed * dt
  let speed = s.speed
  let score = s.score
  let seed = s.seed
  const cols: Column[] = []
  for (const c of s.cols) {
    const x = c.x - dx
    // Off the left edge and unreachable: dropping it keeps the array bounded on
    // a long run. It has always scored by now — the bird is at 0.3 of the width.
    if (x + FLAPPY.COL_W < 0) continue
    let passed = c.passed
    if (!passed && x + FLAPPY.COL_W < BIRD_X) {
      passed = true
      score++
      if (score % 5 === 0) speed *= 1 + FLAPPY.SPEED_GAIN
    }
    cols.push({ x, gapY: c.gapY, passed })
  }
  const last = cols[cols.length - 1]
  if (!last || last.x < FLAPPY.W - FLAPPY.SPACING) {
    const dealt = dealGap(seed)
    seed = dealt.seed
    cols.push({ x: (last ? last.x : FLAPPY.W) + FLAPPY.SPACING, gapY: dealt.gapY, passed: false })
  }

  let dead = false
  if (grace > 0) {
    // The lifeline second is invulnerable, and the board still holds the bird:
    // without this it simply falls out of the world and the player spends their
    // grace watching an empty chalkboard.
    if (y > FLAPPY.FLOOR - FLAPPY.R) {
      y = FLAPPY.FLOOR - FLAPPY.R
      vy = 0
    } else if (y < FLAPPY.R) {
      y = FLAPPY.R
      vy = 0
    }
  } else if (y + FLAPPY.R > FLAPPY.FLOOR || y - FLAPPY.R < 0) {
    dead = true
  } else {
    for (const c of cols) {
      const [top, bottom] = columnRects(c)
      if (hits(BIRD_X, y, FLAPPY.R, top) || hits(BIRD_X, y, FLAPPY.R, bottom)) {
        dead = true
        break
      }
    }
  }

  return { ...s, y, vy, cols, score, speed, dead, grace, seed, t }
}

/**
 * The extra life "Hire me" buys: the same run, at the same score, with the board
 * around the bird swept clear and a second of grace to get flying again. Retry
 * hands out a fresh seed instead; this one deliberately keeps the score.
 */
export function revive(s: FlappyState): FlappyState {
  if (!s.dead) return s
  return {
    ...s,
    y: FLAPPY.H / 2,
    vy: 0,
    dead: false,
    started: true,
    grace: FLAPPY.GRACE_MS,
    cols: s.cols.filter((c) => Math.abs(c.x + FLAPPY.COL_W / 2 - BIRD_X) > REVIVE_CLEAR),
  }
}

export function won(s: FlappyState): boolean {
  return s.score >= FLAPPY.WIN
}
