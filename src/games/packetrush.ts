// Packet Rush — the sorting game on the Engine floor. Sol runs the Stream hot,
// packets fall out of it tagged with a jurisdiction, and you route each one to
// the bin it belongs in before it hits the deck.
//
// Pure state: no DOM, no Phaser, no timers and no `Math.random`. The renderer in
// src/ui/minigames/packetrush.ts owns the clock and the pixels and only ever
// calls the functions here; the tests drive the very same reducer at a fixed
// tick, which is why a seed is worth having.

/** Which bin a packet belongs in — the index into `JURISDICTIONS`. */
export type Jur = 0 | 1 | 2
/** Which of the three columns a packet is falling down. Cosmetic: routing is by jurisdiction. */
export type Lane = 0 | 1 | 2

/** One packet in flight. `y` runs 0 (out of the Stream) → 1 (on the deck). */
export type Packet = { lane: Lane; jur: Jur; y: number }

export type PrState = {
  /** the live rng state: every spawn draws from it and leaves the next one behind */
  seed: number
  /** seconds since the run began */
  t: number
  /** fall speed, in `y` per second */
  speed: number
  lives: number
  score: number
  falling: Packet[]
  /** seconds until the next packet drops */
  spawnIn: number
  /** the run is finished — whichever way it went. `prStep`/`prRoute` are no-ops after this. */
  over: boolean
  /** …and it reached the target. Latched: an endless run keeps the win it earned. */
  won: boolean
}

export const PR = {
  /** starting fall speed, in `y` per second — about four and a half seconds a packet */
  SPEED: 0.22,
  LIVES: 3,
  /** seconds between packets at the starting speed */
  SPAWN: 1.2,
  /** …and however fast the Stream gets, never closer together than this */
  SPAWN_MIN: 0.42,
  /** route this many and the Engine is clean */
  WIN: 30,
  RAMP_EVERY: 10,
  RAMP: 1.04,
} as const

/** How near the top counts as "still in the mouth of the lane" (see `prStep`). */
const MOUTH = 0.14

/**
 * The three jurisdictions a payment can be classified into, which is the one
 * piece of the day job this game is actually about. Glyph and colour both carry
 * the meaning — colour alone would leave a colour-blind player guessing.
 */
export const JURISDICTIONS = [
  { id: 'gbp', glyph: '£', label: 'Sterling', color: '#5eead4' },
  { id: 'eur', glyph: '€', label: 'Euro', color: '#ffd23f' },
  { id: 'usd', glyph: '$', label: 'Dollar', color: '#9b6bf2' },
] as const

/**
 * One step of mulberry32, written as a pure function of the state so the whole
 * reducer can stay pure: the drawn value comes back alongside the next seed,
 * which the state carries. Same generator as `core/rng`, which owns the mutable
 * version everything else uses.
 */
function draw(seed: number): { v: number; seed: number } {
  const a = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return { v: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: a }
}

/**
 * Seconds between packets at a given speed: the faster the Stream runs, the
 * closer together they come, so the 4% ramp is felt as pressure and not just as
 * a slightly quicker fall. Clamped, so the endless run stays playable.
 */
export function prSpawnInterval(speed: number): number {
  return Math.max(PR.SPAWN_MIN, (PR.SPAWN * PR.SPEED) / speed)
}

export function prInit(seed: number): PrState {
  return {
    seed: seed >>> 0,
    t: 0,
    speed: PR.SPEED,
    lives: PR.LIVES,
    score: 0,
    falling: [],
    spawnIn: PR.SPAWN,
    over: false,
    won: false,
  }
}

/** The packet nearest the deck — the one a route call acts on. `null` when the column is clear. */
export function prLowest(s: PrState): Packet | null {
  let best: Packet | null = null
  for (const p of s.falling) if (!best || p.y > best.y) best = p
  return best
}

/**
 * Advance the stream by `dt` seconds: everything falls, anything that reaches
 * the deck costs a life, and the spawn timer drops one more packet when it runs
 * out. A finished run is left exactly as it was.
 */
export function prStep(s: PrState, dt: number): PrState {
  if (s.over || !(dt > 0)) return s
  let lives = s.lives
  const falling: Packet[] = []
  for (const p of s.falling) {
    const y = p.y + s.speed * dt
    if (y >= 1) lives -= 1
    else falling.push({ ...p, y })
  }
  let seed = s.seed
  let spawnIn = s.spawnIn - dt
  if (spawnIn <= 0 && lives > 0) {
    const a = draw(seed)
    const b = draw(a.seed)
    seed = b.seed
    const jur = Math.min(2, Math.floor(b.v * 3)) as Jur
    let lane = Math.min(2, Math.floor(a.v * 3)) as Lane
    // Two packets stacked at the mouth of one lane read as a single packet and
    // route as a nasty surprise, so a busy lane is stepped over — deterministic,
    // and it costs no extra draw.
    for (let i = 0; i < 3 && falling.some((p) => p.lane === lane && p.y < MOUTH); i++) lane = ((lane + 1) % 3) as Lane
    falling.push({ lane, jur, y: 0 })
    // Reset rather than accumulate: a long frame (a tab coming back) must not
    // fire a burst of packets to catch up.
    spawnIn = prSpawnInterval(s.speed)
  }
  return { ...s, t: s.t + dt, lives: Math.max(0, lives), falling, seed, spawnIn, over: lives <= 0 }
}

/**
 * Send the lowest packet to a bin. The right bin scores — and every tenth point
 * runs the Stream 4% hotter — while the wrong one costs a life. Routing an empty
 * column is not a mistake, it is a twitch: nothing happens.
 */
export function prRoute(s: PrState, jur: Jur): PrState {
  if (s.over) return s
  const target = prLowest(s)
  if (!target) return s
  const falling = s.falling.filter((p) => p !== target)
  if (target.jur !== jur) {
    const lives = s.lives - 1
    return { ...s, falling, lives: Math.max(0, lives), over: lives <= 0 }
  }
  const score = s.score + 1
  // The win latches: once earned it is never handed back, so an endless run that
  // ends badly still ends as a win.
  const reached = !s.won && score >= PR.WIN
  const won = s.won || reached
  // Every tenth packet, without exception — the thirtieth ramps too, because the
  // player may well be taking the endless run on the far side of it.
  const speed = score % PR.RAMP_EVERY === 0 ? s.speed * PR.RAMP : s.speed
  return { ...s, falling, score, speed, won, over: reached }
}

/**
 * Play on after the win: the run reopens with its score, speed and remaining
 * lives intact, chasing a high score until the lives finally run out. Anything
 * that is not a finished win is handed straight back.
 */
export function prEndless(s: PrState): PrState {
  if (!s.won || !s.over) return s
  return { ...s, over: false }
}
