// Prize Grab — the rules of a claw machine, with none of the cabinet.
//
// Sol's tent runs an honest machine: no slip chance, no rigged grip, no random
// mercy. The claw sweeps a triangle wave along its rail, a drop costs a token,
// and whether it comes back with a prize is decided by one comparison — how far
// the claw is from the prize's centre against a tolerance that tightens with
// every prize already won. That is the whole game, and it lives here as plain
// functions over a plain state so the same drop from the same place always ends
// the same way. No Phaser, no document, no timers: `ui/minigames/claw.ts` draws
// what these decide, and the fixed-step loop is the only thing that calls them.
//
// Positions are fractions of the cabinet's width (0 = left wall, 1 = right), so
// the rules never mention a pixel and the renderer can size the glass however it
// likes. `y` is the claw's descent: 0 at the rail, 1 on the shelf.

/** The cabinet, the purse and the difficulty curve. */
export const CLAW = {
  /** logical canvas size — the coordinate space the renderer draws in */
  W: 640,
  H: 400,
  /** where the shelf sits inside that space; prizes stand on it */
  SHELF_Y: 300,
  /** a round's purse: six presses of the button */
  TOKENS: 6,
  /** rail speed in widths per second */
  SWEEP: 0.55,
  /** and how much faster it gets after each prize goes down the chute */
  SWEEP_GAIN: 0.15,
  /** the catch window as a share of the prize's width, per prize already won */
  TOL: [0.45, 0.35, 0.28],
  /** the two long travels: down to the shelf, and back up */
  DROP_MS: 700,
  RISE_MS: 700,
  /** where the chute mouth is: the claw carries a prize here before it lets go */
  CHUTE_X: 0.08,
} as const

/**
 * The ends of the rail. The claw's arms hang wider than the cable, so it never
 * quite reaches the glass — and neither does the outermost prize.
 */
const MIN_X = 0.06
const MAX_X = 0.94

/**
 * The two short beats: the arms closing on the shelf, and opening again over the
 * chute. Only the long travels are the brief's; these are pacing, and they are
 * deliberately short enough that a miss never feels like a punishment.
 */
const GRAB_MS = 260
const RELEASE_MS = 260

/**
 * The ride to the chute, in widths per second. Twice the sweep, so a prize on
 * the way home reads as purposeful rather than as another lap of the rail.
 */
const CARRY = CLAW.SWEEP * 2

/**
 * What is on the shelf. Three of them are Naman's projects — the ids are the
 * résumé chapters they unlock — and two are plushies, there to crowd the shelf
 * and to be grabbed by mistake.
 */
export type Prize = { id: 'lineage' | 'safestride' | 'stealth' | 'plush_a' | 'plush_b'; x: number; w: number; caught: boolean; decoy: boolean }

/**
 * One grab, beat by beat: sweeping the rail, down, closing, up, across to the
 * chute, letting go — and `done` once the shelf has no projects left on it.
 */
export type Phase = 'sweep' | 'drop' | 'grab' | 'rise' | 'carry' | 'release' | 'done'

export type ClawState = {
  /** claw position along the rail, 0…1 of the cabinet width */
  x: number
  dir: 1 | -1
  /** descent, 0 at the rail and 1 on the shelf */
  y: number
  phase: Phase
  /** ms spent in the current phase */
  t: number
  tokens: number
  prizes: Prize[]
  /** what the arms are closed around right now — a plushie counts */
  holding: Prize['id'] | null
  /** projects banked so far; also the index into `CLAW.TOL` */
  caught: number
  /** current rail speed in widths per second */
  speed: number
  /**
   * The prize that just reached the chute, latched until the next drop.
   *
   * It is a signal, not a fact: the renderer reads it to open that project's
   * card and then clears it. Latched rather than one-step-lived on purpose — a
   * 60 Hz frame runs two 120 Hz steps, and a signal that expired on the next
   * step would be dropped on the floor half the time.
   */
  justCaught: Prize['id'] | null
}

/** The shelf, left to right: a project, a plushie, a project, a plushie, a project. */
function shelf(): Prize[] {
  return [
    { id: 'lineage', x: 0.22, w: 0.14, caught: false, decoy: false },
    { id: 'plush_a', x: 0.36, w: 0.08, caught: false, decoy: true },
    { id: 'safestride', x: 0.5, w: 0.14, caught: false, decoy: false },
    { id: 'plush_b', x: 0.64, w: 0.08, caught: false, decoy: true },
    { id: 'stealth', x: 0.78, w: 0.14, caught: false, decoy: false },
  ]
}

/** A fresh cabinet: full purse, full shelf, claw parked mid-rail heading right. */
export function newClaw(): ClawState {
  return {
    x: 0.5,
    dir: 1,
    y: 0,
    phase: 'sweep',
    t: 0,
    tokens: CLAW.TOKENS,
    prizes: shelf(),
    holding: null,
    caught: 0,
    speed: CLAW.SWEEP,
    justCaught: null,
  }
}

/**
 * Try again after the purse runs dry: six fresh tokens and a still cabinet, but
 * the shelf remembers. A retry that put the won projects back would ask the
 * player to win the same chapter twice, and the rail keeps the speed it earned.
 */
export function newRound(prev: ClawState): ClawState {
  const fresh = newClaw()
  return {
    ...fresh,
    prizes: fresh.prizes.map((p) => ({ ...p, caught: prev.prizes.some((q) => q.id === p.id && q.caught) })),
    caught: prev.caught,
    speed: prev.speed,
  }
}

/** Hand over more tokens — the whole purse on a retry, two on a lifeline. */
export function refill(s: ClawState, n: number): ClawState {
  return { ...s, tokens: s.tokens + Math.max(0, n) }
}

/** Every project down the chute; the plushies never counted. */
export function allCaught(s: ClawState): boolean {
  return s.prizes.every((p) => p.decoy || p.caught)
}

/** The catch window for the next prize, in shares of that prize's width. */
function tolerance(caught: number): number {
  const i = Math.max(0, Math.min(caught, CLAW.TOL.length - 1))
  return CLAW.TOL[i]
}

/**
 * What the arms would close on, right now.
 *
 * The nearest prize still on the shelf, and only if the claw is inside its
 * window. Plushies are in the running — they are small, so the window is small,
 * but grabbing one is exactly the mistake the shelf is arranged to invite.
 */
export function catchTarget(s: ClawState): Prize | null {
  let best: Prize | null = null
  let bestD = Infinity
  for (const p of s.prizes) {
    if (p.caught) continue
    const d = Math.abs(s.x - p.x)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  if (!best) return null
  return bestD <= best.w * tolerance(s.caught) ? best : null
}

/**
 * Press the button. One token, one drop — and only while the claw is sweeping,
 * so a second press mid-grab is free rather than silently expensive.
 */
export function drop(s: ClawState): ClawState {
  if (s.phase !== 'sweep' || s.tokens <= 0) return s
  return { ...s, tokens: s.tokens - 1, phase: 'drop', t: 0, y: 0, justCaught: null }
}

/** Reflect off both ends of the rail until the claw is back on it. */
function bounce(x: number, dir: 1 | -1): { x: number; dir: 1 | -1 } {
  let nx = x
  let nd = dir
  // A loop, not an `if`: a monstrous frame delta could overshoot the far wall
  // too, and a claw that escaped the cabinet would sweep off into the fascia.
  for (let i = 0; i < 8 && (nx < MIN_X || nx > MAX_X); i++) {
    if (nx > MAX_X) {
      nx = MAX_X - (nx - MAX_X)
      nd = -1
    } else {
      nx = MIN_X + (MIN_X - nx)
      nd = 1
    }
  }
  return { x: Math.max(MIN_X, Math.min(MAX_X, nx)), dir: nd }
}

/**
 * One fixed step of the machine.
 *
 * Pure: the state handed in is never touched, and the same state and delta
 * always produce the same result — which is what lets the renderer interpolate
 * between two of them and lets the tests replay a whole round.
 */
export function step(s: ClawState, dtMs: number): ClawState {
  // `!(dt > 0)` also catches NaN, which would otherwise smear across the state.
  const dt = !(dtMs > 0) ? 0 : dtMs
  if (dt === 0 || s.phase === 'done') return s

  if (s.phase === 'sweep') {
    const moved = bounce(s.x + s.dir * s.speed * (dt / 1000), s.dir)
    return { ...s, x: moved.x, dir: moved.dir }
  }

  const t = s.t + dt

  if (s.phase === 'drop') {
    if (t < CLAW.DROP_MS) return { ...s, t, y: t / CLAW.DROP_MS }
    // Bottom of the travel: the arms close on whatever is under them. A plushie
    // is picked up just as happily as a project — that is the joke.
    const hit = catchTarget({ ...s, y: 1 })
    return { ...s, t: 0, y: 1, phase: 'grab', holding: hit ? hit.id : null }
  }

  if (s.phase === 'grab') {
    return t < GRAB_MS ? { ...s, t } : { ...s, t: 0, phase: 'rise' }
  }

  if (s.phase === 'rise') {
    if (t < CLAW.RISE_MS) return { ...s, t, y: 1 - t / CLAW.RISE_MS }
    const held = s.prizes.find((p) => p.id === s.holding)
    // A plushie slips out at the top and flops back onto the shelf; only a
    // project is worth carrying across.
    if (!held || held.decoy) return { ...s, t: 0, y: 0, phase: 'sweep', holding: null }
    return { ...s, t: 0, y: 0, phase: 'carry' }
  }

  if (s.phase === 'carry') {
    const x = s.x - CARRY * (dt / 1000)
    if (x > CLAW.CHUTE_X) return { ...s, t, x }
    return { ...s, t: 0, x: CLAW.CHUTE_X, phase: 'release' }
  }

  // 'release': the arms open over the chute and the prize is banked — once.
  if (t < RELEASE_MS) return { ...s, t }
  const prizes = s.prizes.map((p) => (p.id === s.holding ? { ...p, caught: true } : p))
  const caught = s.caught + 1
  const banked: ClawState = {
    ...s,
    prizes,
    caught,
    holding: null,
    justCaught: s.holding,
    // Every prize makes the next one harder to line up, and the rail faster.
    speed: s.speed * (1 + CLAW.SWEEP_GAIN),
    t: 0,
    // Setting off from the chute means setting off rightwards.
    dir: 1,
    phase: 'sweep',
  }
  return allCaught(banked) ? { ...banked, phase: 'done' } : banked
}
