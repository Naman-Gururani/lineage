// Crew Drop — the dropping floor Mira's cabinet runs, with none of the canvas.
//
// Five beans on a ten-by-seven deck. The tile under a bean starts cracking the
// moment it is stood on and drops a second or so later, whoever is still on it
// going with it, so the only way to stay up is to keep hopping onto floor
// nobody has spent yet. Holes close again a second or two later, which is what
// keeps a deck this size playable with five beans eating it; what does not come
// back is the arena's own edge, which starts biting inwards a quarter of a
// minute in and bites faster from there. Last bean standing wins.
//
// Every rule lives here as plain functions over plain data: no Phaser, no
// document, no `Math.random` — the bots' blunders, the shrinking arena and the
// Hire-me respawn all come out of the state's own seed, which is what lets the
// tests below replay a whole round and prove it ends.
import { makeRng } from '../core/rng'

export const CREW = {
  W: 10,
  H: 7,
  /** how long a tile holds once it starts cracking */
  CRACK_MS: 900,
  /**
   * How long a hole takes to close again — the deck repairs itself, and only
   * the arena's bite is permanent. Measured, not guessed: five beans spend a
   * tile roughly every six tenths of a second between them, so a hole that
   * outlives a bean's own circuit traps it in its own trail. See the sweep in
   * the task report — this is the value that puts a round in the half-minute
   * the design asks for.
   */
  REGROW_MS: 1800,
  /** one hop, tile to tile */
  MOVE_MS: 160,
  /** how often a bot picks its next hop */
  THINK_MS: 350,
  /** the arena starts closing in this late */
  SHRINK_START_MS: 15000,
  SHRINK_EVERY_MS: 2500,
  /** and closes in faster after every bite, down to the floor below */
  SHRINK_DECAY: 0.9,
  SHRINK_MIN_MS: 600,
  /** a bot's chance of a panicked hop, at the start and at the end of the ramp */
  ERR0: 0.1,
  ERR1: 0.4,
  ERR_RAMP_MS: 30000,
  BOTS: 4,
  /** how long the bots stand still after a Hire-me respawn */
  FREEZE_MS: 1000,
} as const

export type Tile = {
  /**
   * `ok` → `cracking` under a bean → `gone` when the crack runs out → `ok`
   * again once it has regrown. `void` is the shrinking arena's bite: it is
   * outside the deck now, and nothing brings it back.
   */
  state: 'ok' | 'cracking' | 'gone' | 'void'
  /**
   * The tile's own clock, read differently per state: `cracking` counts *up*
   * to `CRACK_MS`, `gone` counts *down* from `REGROW_MS` to nothing, and `ok`
   * and `void` have nothing to count.
   */
  t: number
}

export type Bean = {
  id: 'you' | 'bot0' | 'bot1' | 'bot2' | 'bot3'
  /** the tile this bean owns: where it is standing, and what it falls with */
  x: number
  y: number
  /** the tile it is hopping *to* — equal to x/y when it is standing still */
  fx: number
  fy: number
  /** ms left in the hop; the renderer interpolates the drawn position from it */
  moveT: number
  alive: boolean
  /** ms until this bot picks its next hop (unused for you — your keys decide) */
  think: number
  /** ms of Hire-me freeze left */
  frozen: number
}

export type CrewState = {
  tiles: Tile[]
  beans: Bean[]
  /** ms since the round started */
  t: number
  /** the clock the next shrink fires on */
  nextShrink: number
  /** the gap to the shrink after that — it tightens with every bite */
  shrinkEvery: number
  seed: number
  status: 'play' | 'won' | 'lost'
}

export type Dir = 'up' | 'down' | 'left' | 'right'

/** Clockwise from the top: the order ties are broken in, so a board replays. */
const DIRS: Dir[] = ['up', 'right', 'down', 'left']
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** Where the four bots are dealt — spread around you, none of them adjacent. */
const BOT_SPAWNS: [number, number][] = [
  [8, 1],
  [8, 5],
  [4, 0],
  [5, 6],
]

/**
 * A step longer than this is cut into pieces before it is simulated. The loop
 * feeds whole 120 Hz steps and never trips it; what the slicing is for is the
 * caller who asks for half a second in one go — a late frame, or a test.
 *
 * What it guarantees is that no event is stepped over: a hop advances by at
 * most one slice at a time, so it lands when it is due rather than teleporting,
 * and a crack cannot run past its expiry — the tile drops inside the lump, and
 * whoever was on it goes with it. What it does *not* promise is that one lump
 * and a stream of small steps end in identical states: the tick boundaries move
 * with the caller's milliseconds, and the seeded draws are keyed off the clock
 * those boundaries land on. Same rules, same guarantees, different dice.
 */
const MAX_DT = 20

const idx = (x: number, y: number): number => y * CREW.W + x

export function tileAt(s: CrewState, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= CREW.W || y >= CREW.H) return null
  return s.tiles[idx(x, y)] ?? null
}

/** Floor a bean may stand on: a hole is a hole, and the void is not coming back. */
function enterable(t: Tile | null): boolean {
  return !!t && (t.state === 'ok' || t.state === 'cracking')
}

function bean(id: Bean['id'], x: number, y: number, think: number): Bean {
  return { id, x, y, fx: x, fy: y, moveT: 0, alive: true, think, frozen: 0 }
}

export function newCrew(seed: number): CrewState {
  const tiles: Tile[] = Array.from({ length: CREW.W * CREW.H }, () => ({ state: 'ok', t: 0 }))
  const beans: Bean[] = [
    bean('you', 1, 3, 0),
    // Staggered think clocks: four bots hopping on the same tick read as one
    // four-headed animal rather than as a crew.
    ...BOT_SPAWNS.map((p, i) => bean(`bot${i}` as Bean['id'], p[0], p[1], CREW.THINK_MS - (i * CREW.THINK_MS) / CREW.BOTS)),
  ]
  return { tiles, beans, t: 0, nextShrink: CREW.SHRINK_START_MS, shrinkEvery: CREW.SHRINK_EVERY_MS, seed, status: 'play' }
}

/**
 * Seeded randomness, derived rather than carried: the same state always draws
 * the same numbers, so a round replays from its seed without an rng handle
 * riding along in the save-shaped state.
 */
function rngAt(s: CrewState, label: string): () => number {
  return makeRng(`crew:${s.seed}:${label}:${s.t}`).next
}

/** How often a bot hops somewhere silly: one in ten at the start, four in ten by the ramp's end. */
function errorRate(t: number): number {
  const k = Math.max(0, Math.min(1, t / CREW.ERR_RAMP_MS))
  return CREW.ERR0 + (CREW.ERR1 - CREW.ERR0) * k
}

/**
 * How long the tile under a bean has left before it drops, in milliseconds —
 * `Infinity` for floor that is not counting down at all.
 */
export function timeLeft(s: CrewState, b: Bean): number {
  const t = tileAt(s, b.x, b.y)
  if (!t) return 0
  if (t.state === 'cracking') return Math.max(0, CREW.CRACK_MS - t.t)
  return t.state === 'ok' ? Infinity : 0
}

/**
 * The last moment a bean can still get off a tile: it has to notice (one think)
 * and then make the hop. Leave it later than this and the floor goes first.
 */
const NERVE_MS = CREW.THINK_MS + CREW.MOVE_MS

/** How much pristine floor touches a tile — what both greedy policies rank on. */
function okNeighbours(s: CrewState, x: number, y: number): number {
  let n = 0
  for (const d of DIRS) if (tileAt(s, x + DELTA[d][0], y + DELTA[d][1])?.state === 'ok') n++
  return n
}

/**
 * Where a bot hops next.
 *
 * Straight play is the roomiest intact neighbour — the tile with the most
 * intact neighbours of its own, which keeps a bot out of the dead ends it is
 * carving behind itself. With probability `errorRate` it panics instead and
 * takes any tile that is not a hole, cracking ones included: that is the
 * blunder that gets bots ejected, and it gets likelier as the round wears on.
 * `null` means boxed in — nothing left but to stand there and drop.
 */
export function botChoice(s: CrewState, b: Bean, rnd: () => number): Dir | null {
  const open = DIRS.filter((d) => enterable(tileAt(s, b.x + DELTA[d][0], b.y + DELTA[d][1])))
  if (open.length === 0) return null
  if (rnd() < errorRate(s.t)) return open[Math.min(open.length - 1, Math.floor(rnd() * open.length))]
  // Pristine floor first, ranked by elbow room. When there is none — and once
  // the deck is busy there often is none — the least bad crack is the youngest
  // one, since what kills a bot is landing on a tile with nothing left in it.
  const solid = open.filter((d) => tileAt(s, b.x + DELTA[d][0], b.y + DELTA[d][1])?.state === 'ok')
  const rank = (d: Dir): number => {
    const t = tileAt(s, b.x + DELTA[d][0], b.y + DELTA[d][1])
    if (!t) return -1
    return solid.length ? okNeighbours(s, b.x + DELTA[d][0], b.y + DELTA[d][1]) : CREW.CRACK_MS - t.t
  }
  const from = solid.length ? solid : open
  let best = from[0]
  let bestN = -Infinity
  for (const d of from) {
    const n = rank(d)
    if (n > bestN) {
      bestN = n
      best = d
    }
  }
  return best
}

/** Start a hop, if this bean is in any position to make one. */
function startMove(beans: Bean[], i: number, s: CrewState, d: Dir): void {
  const b = beans[i]
  if (!b.alive || b.moveT > 0 || b.frozen > 0) return
  const nx = b.x + DELTA[d][0]
  const ny = b.y + DELTA[d][1]
  if (!enterable(tileAt(s, nx, ny))) return
  beans[i] = { ...b, fx: nx, fy: ny, moveT: CREW.MOVE_MS }
}

/**
 * A press: sets the hop up, or is quietly dropped. Mid-hop, off the grid, into
 * a hole, frozen or dead all mean the same thing to a player — nothing happens
 * — and the renderer holds the press for a moment rather than replaying it.
 */
export function tryMove(s: CrewState, id: Bean['id'], d: Dir): CrewState {
  if (s.status !== 'play') return s
  const i = s.beans.findIndex((b) => b.id === id)
  if (i < 0) return s
  const beans = s.beans.slice()
  startMove(beans, i, s, d)
  return beans[i] === s.beans[i] ? s : { ...s, beans }
}

/**
 * What the arena eats next: the outside edge of the deck — the grid's own rim,
 * and the lip of everything already eaten. Holes are fair game (they grow back
 * otherwise); the void itself is finished with.
 */
function shrinkCandidates(s: CrewState): number[] {
  const rim: number[] = []
  const inner: number[] = []
  for (let y = 0; y < CREW.H; y++) {
    for (let x = 0; x < CREW.W; x++) {
      const i = idx(x, y)
      if (s.tiles[i].state === 'void') continue
      const edge = x === 0 || y === 0 || x === CREW.W - 1 || y === CREW.H - 1
      const beside = DIRS.some((d) => tileAt(s, x + DELTA[d][0], y + DELTA[d][1])?.state === 'void')
      if (edge || beside) rim.push(i)
      else inner.push(i)
    }
  }
  // Nothing on the edge? Then the deck is one tile wide and anything will do.
  return rim.length ? rim : inner
}

/** One indivisible slice of time. */
function tick(s: CrewState, dt: number): CrewState {
  const tiles = s.tiles.map((t) => ({ ...t }))
  const beans = s.beans.map((b) => ({ ...b }))
  const next: CrewState = { ...s, tiles, beans, t: s.t + dt }

  // 1. The floor ages, except under a bean the Hire-me lifeline has frozen.
  //    A one-second freeze over a crack shorter than it would drop all four
  //    bots where they stood and hand the round over: the pause has to hold the
  //    floor still too, or it is an execution rather than a breather.
  const held = new Set(beans.filter((b) => b.alive && b.frozen > 0).map((b) => idx(b.x, b.y)))
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]
    if (t.state === 'ok' || t.state === 'void' || held.has(i)) continue
    if (t.state === 'cracking') {
      t.t += dt
      if (t.t >= CREW.CRACK_MS) {
        // A crack that runs out is a hole, and the hole starts counting its way
        // back: the deck repairs itself, and only the arena's bite is forever.
        t.state = 'gone'
        t.t = CREW.REGROW_MS
      }
      continue
    }
    t.t -= dt
    if (t.t <= 0) {
      t.state = 'ok'
      t.t = 0
    }
  }

  // 2. Hops land. A bean owns the tile it left until it does.
  for (const b of beans) {
    if (b.frozen > 0) b.frozen = Math.max(0, b.frozen - dt)
    if (!b.alive || b.moveT <= 0) continue
    b.moveT = Math.max(0, b.moveT - dt)
    if (b.moveT === 0) {
      b.x = b.fx
      b.y = b.fy
    }
  }

  // 3. Anyone over a hole goes down it — including a bean that has just landed
  //    on floor that dropped while it was in the air.
  for (const b of beans) {
    if (!b.alive) continue
    if (enterable(tileAt(next, b.x, b.y))) continue
    b.alive = false
    b.moveT = 0
    b.fx = b.x
    b.fy = b.y
  }

  // 4. The floor gives way wherever a bean is standing — at the spawn, and on
  //    every landing after it. A crack already running is left alone, or two
  //    beans could keep a tile alive by taking turns on it.
  for (const b of beans) {
    if (!b.alive || b.frozen > 0) continue
    const t = tiles[idx(b.x, b.y)]
    if (t && t.state === 'ok') {
      t.state = 'cracking'
      t.t = 0
    }
  }

  // 5. The bots think, on their own clocks.
  for (let i = 0; i < beans.length; i++) {
    const b = beans[i]
    if (b.id === 'you' || !b.alive) continue
    b.think -= dt
    if (b.think > 0) continue
    b.think = CREW.THINK_MS
    if (b.frozen > 0 || b.moveT > 0) continue
    // Hold your nerve. A bot that hopped on every think would spend a fresh
    // tile every third of a second, and five beans doing that eat a
    // seventy-tile deck faster than it can grow back — the whole crew would be
    // standing on holes inside five seconds. So a bot stays put until its own
    // floor is about to go, which is also how the game reads: nobody moves
    // until they have to, and then everybody does.
    if (timeLeft(next, b) > NERVE_MS) continue
    const d = botChoice(next, b, rngAt(next, `bot:${b.id}`))
    if (d) startMove(beans, i, next, d)
  }

  // 6. The arena closes in, late in the round and faster every time. A bite out
  //    of the tile somebody is standing on — or hopping onto — would be a death
  //    nobody could have played around, so an occupied target is only cracked:
  //    fair warning, and the bean has to move.
  const claimed = new Set<number>()
  for (const b of beans) {
    if (!b.alive) continue
    claimed.add(idx(b.x, b.y))
    claimed.add(idx(b.fx, b.fy))
  }
  while (next.t >= next.nextShrink) {
    const options = shrinkCandidates(next)
    if (options.length) {
      const pick = options[Math.min(options.length - 1, Math.floor(rngAt(next, `shrink:${next.nextShrink}`)() * options.length))]
      if (!claimed.has(pick)) tiles[pick] = { state: 'void', t: 0 }
      else if (tiles[pick].state === 'ok') tiles[pick] = { state: 'cracking', t: 0 }
    }
    next.shrinkEvery = Math.max(CREW.SHRINK_MIN_MS, next.shrinkEvery * CREW.SHRINK_DECAY)
    next.nextShrink += next.shrinkEvery
  }

  // 7. Who is left. Falling in loses the round outright, even on the tick that
  //    took the last bot with you — the gag, and the lifeline, are the point.
  const you = beans.find((b) => b.id === 'you')
  const rivals = beans.filter((b) => b.id !== 'you')
  if (you && !you.alive) next.status = 'lost'
  else if (rivals.length > 0 && rivals.every((b) => !b.alive)) next.status = 'won'
  return next
}

/**
 * Advance the round. Anything longer than one slice is cut into slices, so the
 * answer does not depend on how the caller's frames happened to land.
 */
export function step(s: CrewState, dtMs: number): CrewState {
  if (s.status !== 'play' || !(dtMs > 0)) return s
  let out = s
  let left = dtMs
  while (left > 0) {
    const dt = Math.min(left, MAX_DT)
    out = tick(out, dt)
    left -= dt
    if (out.status !== 'play') break
  }
  return out
}

/**
 * The Hire-me lifeline: you are dropped back onto intact floor and the bots
 * stand still for a second while you get your bearings. The floor waits with
 * them: a freeze longer than a crack would otherwise drop all four where they
 * stood and hand you the round, so a frozen bean's tile neither ages nor starts
 * cracking (see `tick`). A breather, not an execution.
 */
export function revive(s: CrewState): CrewState {
  const i = s.beans.findIndex((b) => b.id === 'you')
  if (i < 0) return s
  const spots: number[] = []
  for (let j = 0; j < s.tiles.length; j++) if (s.tiles[j].state === 'ok') spots.push(j)
  if (spots.length === 0) return s
  const rnd = rngAt(s, 'revive')
  const pick = spots[Math.min(spots.length - 1, Math.floor(rnd() * spots.length))]
  const x = pick % CREW.W
  const y = Math.floor(pick / CREW.W)
  const beans = s.beans.map((b) =>
    b.id === 'you' ? { ...b, x, y, fx: x, fy: y, moveT: 0, alive: true } : { ...b, frozen: CREW.FREEZE_MS },
  )
  return { ...s, beans, status: 'play' }
}
