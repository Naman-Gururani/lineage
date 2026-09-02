// Crew Drop — the dropping floor, with none of the canvas.
//
// Everything the renderer draws is decided here: which tile is cracking, when it
// drops, who is standing on it when it does, where the bots hop next and how
// often they blunder. The two properties the game lives or dies by are pinned
// down at the bottom: nobody ever stands on a hole, and every seed ends.
import { describe, expect, it } from 'vitest'

import {
  CREW,
  botChoice,
  newCrew,
  revive,
  step,
  tileAt,
  timeLeft,
  tryMove,
  type Bean,
  type CrewState,
  type Dir,
  type Tile,
} from '../src/games/crew'

const DIRS: Dir[] = ['up', 'right', 'down', 'left']
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

const beanOf = (s: CrewState, id: Bean['id']): Bean => s.beans.find((b) => b.id === id)!
const you = (s: CrewState): Bean => beanOf(s, 'you')
const bots = (s: CrewState): Bean[] => s.beans.filter((b) => b.id !== 'you')
const stateOf = (s: CrewState, x: number, y: number) => tileAt(s, x, y)?.state

/** How many pristine tiles touch (x, y) — the number the greedy policies rank on. */
function okNeighbours(s: CrewState, x: number, y: number): number {
  return DIRS.filter((d) => tileAt(s, x + DELTA[d][0], y + DELTA[d][1])?.state === 'ok').length
}

/**
 * The trivial survival policy the termination guarantee is written against:
 * hop to the neighbouring intact tile with the most intact neighbours, and
 * when the deck is too busy for there to be one — which, with five beans
 * eating a seventy-tile floor, is most of the middle of a round — take the
 * youngest crack going instead. A policy that stood still the moment nothing
 * was pristine would not be a survival policy; it would be a stopwatch on the
 * crack timer, and it would prove nothing about whether rounds end.
 *
 * Deliberately written here rather than imported: a termination proof against
 * the game's own bot brain would only prove the brain agrees with itself.
 */
function bestDir(s: CrewState, b: Bean): Dir | null {
  const open = DIRS.filter((d) => {
    const st = stateOf(s, b.x + DELTA[d][0], b.y + DELTA[d][1])
    return st === 'ok' || st === 'cracking'
  })
  if (!open.length) return null
  const solid = open.filter((d) => stateOf(s, b.x + DELTA[d][0], b.y + DELTA[d][1]) === 'ok')
  const rank = (d: Dir): number => {
    const [dx, dy] = DELTA[d]
    return solid.length ? okNeighbours(s, b.x + dx, b.y + dy) : CREW.CRACK_MS - (tileAt(s, b.x + dx, b.y + dy)?.t ?? 0)
  }
  let best: Dir | null = null
  let bestN = -Infinity
  for (const d of solid.length ? solid : open) {
    const n = rank(d)
    if (n > bestN) {
      bestN = n
      best = d
    }
  }
  return best
}

type PlayOpts = {
  /** ms of simulated time to run for */
  ms: number
  /** drive `you` with the survival policy above; off = the player stands still */
  policy?: boolean
  dt?: number
  /** run after every step, for invariants that must hold at all times */
  watch?: (s: CrewState, elapsed: number) => void
}

/** Simulate the way the renderer's loop does: input, then a fixed step. */
function drive(from: CrewState, opts: PlayOpts): CrewState {
  const dt = opts.dt ?? 16
  let s = from
  let think = 0
  for (let t = 0; t < opts.ms && s.status === 'play'; t += dt) {
    think -= dt
    if (think <= 0) {
      think = CREW.THINK_MS
      const me = you(s)
      // The same nerve the bots keep: stand on the floor you have until it is
      // about to go, then take the best way off it.
      if (opts.policy && me.alive && me.moveT === 0 && timeLeft(s, me) <= CREW.THINK_MS + CREW.MOVE_MS) {
        const d = bestDir(s, me)
        if (d) s = tryMove(s, 'you', d)
      }
    }
    s = step(s, dt)
    opts.watch?.(s, t + dt)
  }
  return s
}

const play = (seed: number, opts: PlayOpts): CrewState => drive(newCrew(seed), opts)

/** The board with nobody to outlast: a sandbox for the rules about floor. */
function solo(seed = 1): CrewState {
  const s = newCrew(seed)
  return { ...s, beans: [you(s)] }
}

/** Rewrite one tile of a board. */
function withTile(s: CrewState, x: number, y: number, tile: Tile): CrewState {
  return { ...s, tiles: s.tiles.map((t, i) => (i === y * CREW.W + x ? tile : t)) }
}

describe('newCrew', () => {
  it('deals the crew onto an intact floor', () => {
    const s = newCrew(1)
    expect(s.tiles).toHaveLength(CREW.W * CREW.H)
    expect(s.tiles.every((t) => t.state === 'ok' && t.t === 0)).toBe(true)
    expect(s.status).toBe('play')
    expect(s.t).toBe(0)
    // The shrink is armed but silent for the first fifteen seconds.
    expect(s.nextShrink).toBe(CREW.SHRINK_START_MS)
    expect(s.shrinkEvery).toBe(CREW.SHRINK_EVERY_MS)
  })

  it('puts you at the west end and the four bots around you', () => {
    const s = newCrew(9)
    expect(s.beans).toHaveLength(CREW.BOTS + 1)
    expect([you(s).x, you(s).y]).toEqual([1, 3])
    expect(bots(s).map((b) => [b.id, b.x, b.y])).toEqual([
      ['bot0', 8, 1],
      ['bot1', 8, 5],
      ['bot2', 4, 0],
      ['bot3', 5, 6],
    ])
    // Nobody is mid-hop, everybody is standing where they are drawn.
    expect(s.beans.every((b) => b.alive && b.moveT === 0 && b.fx === b.x && b.fy === b.y)).toBe(true)
  })

  it('is a pure function of its seed', () => {
    expect(newCrew(4)).toEqual(newCrew(4))
  })
})

describe('tileAt', () => {
  it('reads the grid and refuses to fall off it', () => {
    const s = newCrew(2)
    expect(tileAt(s, 0, 0)?.state).toBe('ok')
    expect(tileAt(s, CREW.W - 1, CREW.H - 1)?.state).toBe('ok')
    for (const [x, y] of [
      [-1, 0],
      [0, -1],
      [CREW.W, 0],
      [0, CREW.H],
    ])
      expect(tileAt(s, x, y)).toBeNull()
  })
})

describe('the floor gives way wherever you stand', () => {
  it('starts cracking every tile a bean is standing on', () => {
    const s = step(newCrew(3), 16)
    for (const b of s.beans) expect(stateOf(s, b.x, b.y)).toBe('cracking')
    // and nothing else — the arena is only eaten where somebody stood.
    expect(s.tiles.filter((t) => t.state !== 'ok')).toHaveLength(s.beans.length)
  })

  it('drops the tile a crack expires under, killing whoever is still on it', () => {
    let s = newCrew(3)
    const [x, y] = [you(s).x, you(s).y]
    s = play(3, { ms: CREW.CRACK_MS - 20, dt: 10 })
    expect(you(s).alive).toBe(true)
    expect(stateOf(s, x, y)).toBe('cracking')

    s = play(3, { ms: CREW.CRACK_MS + 200, dt: 10 })
    expect(stateOf(s, x, y)).toBe('gone')
    expect(you(s).alive).toBe(false)
    expect(s.status).toBe('lost')
  })

  it('leaves a bean that keeps hopping alive well past one crack', () => {
    const s = play(3, { ms: CREW.CRACK_MS * 3, policy: true })
    expect(you(s).alive).toBe(true)
    expect(s.status).toBe('play')
  })

  it('never resets a crack somebody else already started', () => {
    let s = newCrew(3)
    // Age the tile east of you a little, then hop onto it: the timer it already
    // has must carry on, or two beans could keep a tile alive between them.
    s = tryMove(s, 'you', 'right')
    s = step(s, CREW.MOVE_MS)
    const aged = tileAt(s, 2, 3)!.t
    s = step(s, 100)
    s = tryMove(s, 'you', 'left')
    s = step(s, CREW.MOVE_MS)
    s = tryMove(s, 'you', 'right')
    s = step(s, CREW.MOVE_MS)
    expect(tileAt(s, 2, 3)!.t).toBeGreaterThan(aged + 200)
  })
})

describe('tryMove', () => {
  it('sets the hop up and commits it when the hop lands', () => {
    let s = tryMove(newCrew(5), 'you', 'right')
    expect([you(s).x, you(s).y]).toEqual([1, 3])
    expect([you(s).fx, you(s).fy]).toEqual([2, 3])
    expect(you(s).moveT).toBe(CREW.MOVE_MS)

    s = step(s, CREW.MOVE_MS / 2)
    // Mid-hop: still owned by the tile it left, and the renderer has a fraction
    // to interpolate with rather than a jump.
    expect(you(s).moveT).toBeCloseTo(CREW.MOVE_MS / 2, 6)
    expect([you(s).x, you(s).y]).toEqual([1, 3])

    s = step(s, CREW.MOVE_MS / 2)
    expect([you(s).x, you(s).y]).toEqual([2, 3])
    expect(you(s).moveT).toBe(0)
  })

  it('ignores a second press mid-hop', () => {
    let s = tryMove(newCrew(5), 'you', 'right')
    s = step(s, 20)
    const mid = tryMove(s, 'you', 'down')
    expect(mid).toEqual(s)
  })

  it('ignores a hop off the grid', () => {
    const s = newCrew(5)
    expect(tryMove(s, 'you', 'left')).not.toEqual(s) // (1,3) → (0,3) is on the grid
    let edge = newCrew(5)
    edge = tryMove(edge, 'you', 'left')
    edge = step(edge, CREW.MOVE_MS)
    expect(tryMove(edge, 'you', 'left')).toEqual(edge)
  })

  it('ignores a hop into a hole, and into the void', () => {
    const hole = withTile(newCrew(5), 2, 3, { state: 'gone', t: CREW.REGROW_MS })
    expect(tryMove(hole, 'you', 'right')).toEqual(hole)
    // the same press one tile the other way is fine
    expect(tryMove(hole, 'you', 'left')).not.toEqual(hole)

    const bitten = withTile(newCrew(5), 2, 3, { state: 'void', t: 0 })
    expect(tryMove(bitten, 'you', 'right')).toEqual(bitten)
  })

  it('ignores a frozen bean, and an unknown one', () => {
    const s = newCrew(5)
    const frozen: CrewState = { ...s, beans: s.beans.map((b) => ({ ...b, frozen: CREW.FREEZE_MS })) }
    expect(tryMove(frozen, 'you', 'right')).toEqual(frozen)
    expect(tryMove(s, 'nobody' as Bean['id'], 'right')).toEqual(s)
  })
})

describe('botChoice', () => {
  /** A board with a hand-placed bot and whatever holes the case needs. */
  function board(holes: [number, number][], cracks: [number, number][] = [], at: [number, number] = [4, 3]): CrewState {
    const s = newCrew(1)
    const tiles = s.tiles.map((t) => ({ ...t }))
    for (const [x, y] of holes) tiles[y * CREW.W + x] = { state: 'gone', t: 0 }
    for (const [x, y] of cracks) tiles[y * CREW.W + x] = { state: 'cracking', t: 0 }
    const bot: Bean = { ...beanOf(s, 'bot0'), x: at[0], y: at[1], fx: at[0], fy: at[1] }
    return { ...s, tiles, beans: [you(s), bot] }
  }

  it('hops to the intact neighbour with the most intact neighbours', () => {
    // West of the bot the floor is eaten away, so east — which still has three
    // intact neighbours of its own — is the roomiest way out.
    const s = board([
      [3, 2],
      [3, 4],
      [2, 3],
    ])
    expect(botChoice(s, beanOf(s, 'bot0'), () => 0.99)).toBe('right')
  })

  it('takes a cracking tile rather than stand still when nothing is pristine', () => {
    const s = board(
      [
        [4, 2],
        [3, 3],
        [4, 4],
      ],
      [[5, 3]],
    )
    expect(botChoice(s, beanOf(s, 'bot0'), () => 0.99)).toBe('right')
  })

  it('never picks a hole, and gives up when it is boxed in', () => {
    const walled = board([
      [4, 2],
      [4, 4],
      [3, 3],
      [5, 3],
    ])
    expect(botChoice(walled, beanOf(walled, 'bot0'), () => 0.99)).toBeNull()
    expect(botChoice(walled, beanOf(walled, 'bot0'), () => 0)).toBeNull()
  })

  it('blunders more often as the round wears on', () => {
    // East of the bot is a dead end, west is wide open, so straight play goes west.
    const s = board([
      [6, 3],
      [5, 2],
      [5, 4],
    ])
    const bot = beanOf(s, 'bot0')
    // A roll of a quarter is above the opening error rate and below the late
    // one, so the same bot on the same board plays it straight early and
    // wanders later — the ramp, observed rather than asserted from a constant.
    expect(CREW.ERR0).toBeLessThan(0.25)
    expect(CREW.ERR1).toBeGreaterThan(0.25)
    expect(botChoice({ ...s, t: 0 }, bot, () => 0.25)).toBe('left')
    expect(botChoice({ ...s, t: CREW.ERR_RAMP_MS }, bot, () => 0.25)).toBe('right')
  })

  it('still refuses a hole when it blunders', () => {
    const s = board([
      [4, 2],
      [3, 3],
    ])
    // Every roll of the dice, the panicked pick is one of the open sides.
    for (const r of [0, 0.1, 0.5, 0.99]) {
      const d = botChoice({ ...s, t: CREW.ERR_RAMP_MS }, beanOf(s, 'bot0'), () => r * 0.4)
      expect(d === null || d === 'right' || d === 'down').toBe(true)
    }
  })
})

describe('the bots', () => {
  it('hop on their own, and never onto a hole or over the side', () => {
    for (const seed of [1, 2, 3]) {
      const touched = new Set<number>()
      const s = play(seed, {
        ms: 20000,
        policy: true,
        watch: (cur) => {
          cur.tiles.forEach((t, i) => {
            if (t.state === 'cracking') touched.add(i)
          })
          for (const b of cur.beans) {
            if (!b.alive) continue
            // The one invariant the whole game rests on: a living bean is
            // always on floor — never in a hole, never out over the void.
            expect(['ok', 'cracking']).toContain(stateOf(cur, b.x, b.y))
            expect(tileAt(cur, b.fx, b.fy)).not.toBeNull()
          }
        },
      })
      // and they really did move — a frozen board would pass the check above,
      // and holes healing behind them means counting holes no longer would
      expect(touched.size).toBeGreaterThan(20)
      // The watch above ran while the arena was biting, which is what makes
      // "never over the side" worth checking: a round that ended before the
      // first bite would never have tested it.
      expect(s.t).toBeGreaterThan(CREW.SHRINK_START_MS)
      expect(s.nextShrink).toBeGreaterThan(CREW.SHRINK_START_MS)
    }
  })
})

describe('step', () => {
  it('replays identically for one seed and diverges between seeds', () => {
    expect(play(11, { ms: 4000, policy: true })).toEqual(play(11, { ms: 4000, policy: true }))
    expect(play(11, { ms: 4000, policy: true })).not.toEqual(play(12, { ms: 4000, policy: true }))
  })

  it('ignores a dead clock and a finished round', () => {
    const s = newCrew(6)
    expect(step(s, 0)).toEqual(s)
    expect(step(s, -5)).toEqual(s)
    const over: CrewState = { ...s, status: 'lost' }
    expect(step(over, 100)).toEqual(over)
  })

  it('lands a hop when it is due, however big the lump of time handed over', () => {
    // A whole half-second in one call must not let the hop teleport: the bean
    // arrives one MOVE_MS in, and the tile it lands on has been cracking for
    // the rest of the lump. Simulate the lump whole and the crack would read
    // zero, because the landing would have happened at the end of it.
    for (const lump of [300, 700]) {
      let s = tryMove(solo(4), 'you', 'right')
      s = step(s, lump)
      expect([you(s).x, you(s).y]).toEqual([2, 3])
      expect(you(s).moveT).toBe(0)
      expect(tileAt(s, 2, 3)!.t).toBeCloseTo(lump - CREW.MOVE_MS, 6)
    }
  })

  it('never steps over a crack expiring inside the lump', () => {
    const bare = (): CrewState => ({ ...newCrew(4), beans: [] })
    const cracked = (): CrewState => withTile(bare(), 4, 4, { state: 'cracking', t: CREW.CRACK_MS - 200 })
    // The tile is due to drop two tenths in. One second later it is a hole that
    // has already begun growing back; five seconds later it is floor again.
    const soon = step(cracked(), 1000)
    expect(stateOf(soon, 4, 4)).toBe('gone')
    expect(tileAt(soon, 4, 4)!.t).toBeCloseTo(CREW.REGROW_MS - 800, 6)
    expect(stateOf(step(cracked(), 5000), 4, 4)).toBe('ok')
  })

  it('takes whoever was standing on a tile that drops inside the lump', () => {
    // The same guarantee from the bean's side: a lump long enough to contain
    // the crack must contain the fall, not skip past it.
    const s = step(solo(4), CREW.CRACK_MS + 100)
    expect(you(s).alive).toBe(false)
    expect(s.status).toBe('lost')
  })

  it('calls it a win once the last bot has fallen and a loss when you do', () => {
    const s = newCrew(1)
    const wiped: CrewState = { ...s, beans: s.beans.map((b) => (b.id === 'you' ? b : { ...b, alive: false })) }
    expect(step(wiped, 16).status).toBe('won')
    const dead: CrewState = { ...s, beans: s.beans.map((b) => (b.id === 'you' ? { ...b, alive: false } : b)) }
    expect(step(dead, 16).status).toBe('lost')
  })
})

describe('the floor grows back', () => {
  /** An empty floor: with nobody standing on it, the only clock is the tile's own. */
  const bare = (seed: number): CrewState => ({ ...newCrew(seed), beans: [] })

  function run(s: CrewState, ms: number): CrewState {
    for (let t = 0; t < ms; t += 16) s = step(s, 16)
    return s
  }

  it('closes a hole once it has had its five seconds', () => {
    const s = run(withTile(bare(1), 4, 4, { state: 'gone', t: CREW.REGROW_MS }), CREW.REGROW_MS - 200)
    expect(stateOf(s, 4, 4)).toBe('gone')
    // A hole counts *down*: what is left of its clock is how long until the
    // deck is whole again, which is what the renderer fades back in on.
    expect(tileAt(s, 4, 4)!.t).toBeLessThan(300)
    expect(stateOf(run(s, 400), 4, 4)).toBe('ok')
  })

  it('turns a crack into a hole with a full regrow ahead of it', () => {
    const s = run(withTile(bare(1), 4, 4, { state: 'cracking', t: 0 }), CREW.CRACK_MS + 50)
    expect(stateOf(s, 4, 4)).toBe('gone')
    expect(tileAt(s, 4, 4)!.t).toBeGreaterThan(CREW.REGROW_MS - 200)
  })

  it('lets you hop onto the tile you could not, once it is back', () => {
    let s = withTile(solo(1), 2, 3, { state: 'gone', t: 120 })
    expect(tryMove(s, 'you', 'right')).toEqual(s)
    s = step(s, 200)
    expect(stateOf(s, 2, 3)).toBe('ok')
    s = tryMove(s, 'you', 'right')
    s = step(s, CREW.MOVE_MS)
    expect([you(s).x, you(s).y]).toEqual([2, 3])
  })
})

describe('the shrinking arena', () => {
  const bare = (seed: number): CrewState => ({ ...newCrew(seed), beans: [] })

  function run(s: CrewState, ms: number): CrewState {
    for (let t = 0; t < ms; t += 16) s = step(s, 16)
    return s
  }

  const voids = (s: CrewState) => s.tiles.filter((t) => t.state === 'void').length
  const onRim = (i: number) => i % CREW.W === 0 || i % CREW.W === CREW.W - 1 || i < CREW.W || i >= CREW.W * (CREW.H - 1)

  it('leaves the floor alone for the first fifteen seconds', () => {
    const s = run(bare(2), CREW.SHRINK_START_MS - 100)
    expect(s.tiles.every((t) => t.state === 'ok')).toBe(true)
    expect(s.nextShrink).toBe(CREW.SHRINK_START_MS)
  })

  it('then takes a bite out of the rim, for good', () => {
    let s = run(bare(2), CREW.SHRINK_START_MS + 100)
    expect(voids(s)).toBe(1)
    expect(onRim(s.tiles.findIndex((t) => t.state === 'void'))).toBe(true)
    // A bite is not a hole: three regrows later, it has not grown back.
    const bitten = s.tiles.findIndex((t) => t.state === 'void')
    s = run(s, CREW.REGROW_MS * 3)
    expect(s.tiles[bitten].state).toBe('void')
  })

  it('quickens after every bite, down to a floor of its own', () => {
    let s = run(bare(2), CREW.SHRINK_START_MS + 100)
    expect(s.shrinkEvery).toBeCloseTo(CREW.SHRINK_EVERY_MS * CREW.SHRINK_DECAY, 6)
    expect(s.nextShrink).toBeCloseTo(CREW.SHRINK_START_MS + s.shrinkEvery, 6)

    const gap = s.shrinkEvery
    s = run(s, gap + 100)
    expect(voids(s)).toBe(2)
    expect(s.shrinkEvery).toBeLessThan(gap)

    // and it never gets quicker than SHRINK_MIN_MS, however long the round runs
    s = run(s, 45000)
    expect(s.shrinkEvery).toBe(CREW.SHRINK_MIN_MS)
    expect(voids(s)).toBeGreaterThan(30)
  })

  it('eats inwards from the edge rather than punching holes in the middle', () => {
    const s = run(bare(2), 60000)
    s.tiles.forEach((t, i) => {
      if (t.state !== 'void') return
      const x = i % CREW.W
      const y = Math.floor(i / CREW.W)
      const beside = DIRS.some((d) => tileAt(s, x + DELTA[d][0], y + DELTA[d][1])?.state === 'void')
      expect(onRim(i) || beside).toBe(true)
    })
    // by a minute in, most of the deck has gone over the side
    expect(voids(s)).toBeGreaterThan(CREW.W * CREW.H * 0.4)
  })

  it('cracks the tile a bean has claimed instead of voiding it', () => {
    // A deck down to two tiles: the one the bean stands on, and the one it is
    // in the air towards. Both are on the edge, and neither may be bitten.
    let cracked = 0
    for (let seed = 1; seed <= 8; seed++) {
      const base = solo(seed)
      const tiles = base.tiles.map(() => ({ state: 'void' as const, t: 0 }))
      const board: CrewState = {
        ...base,
        tiles: tiles.map((t, i) => (i === 0 ? { state: 'cracking' as const, t: 100 } : i === 1 ? { state: 'ok' as const, t: 0 } : t)),
        beans: [{ ...you(base), x: 0, y: 0, fx: 1, fy: 0, moveT: CREW.MOVE_MS }],
        t: CREW.SHRINK_START_MS - 10,
      }
      const after = step(board, 20)
      expect(after.nextShrink).toBeGreaterThan(CREW.SHRINK_START_MS) // a bite really was taken
      expect(after.tiles.filter((t) => t.state === 'void').length).toBe(CREW.W * CREW.H - 2)
      if (after.tiles[1].state === 'cracking') cracked++
    }
    // and where the bite lands on the pristine one, it arrives as a warning
    expect(cracked).toBeGreaterThan(0)
  })

  it('picks the tile from the seed, not from the wall clock', () => {
    const a = run(bare(21), CREW.SHRINK_START_MS + 100)
    const b = run(bare(21), CREW.SHRINK_START_MS + 100)
    const c = run(bare(22), CREW.SHRINK_START_MS + 100)
    expect(a.tiles).toEqual(b.tiles)
    expect(a.tiles).not.toEqual(c.tiles)
  })
})

describe('revive — the Hire-me lifeline', () => {
  const lose = (seed: number) => play(seed, { ms: CREW.CRACK_MS + 300, dt: 10 })

  it('puts you back on an intact tile and re-opens the round', () => {
    const dead = lose(3)
    expect(dead.status).toBe('lost')
    const s = revive(dead)
    expect(s.status).toBe('play')
    expect(you(s).alive).toBe(true)
    expect(you(s).moveT).toBe(0)
    expect([you(s).fx, you(s).fy]).toEqual([you(s).x, you(s).y])
    expect(stateOf(s, you(s).x, you(s).y)).toBe('ok')
  })

  it('freezes the bots where they stand for a second', () => {
    const s = revive(lose(3))
    expect(bots(s).every((b) => b.frozen === CREW.FREEZE_MS)).toBe(true)
    // They see out the hop they were already in and start no other, and the
    // floor waits with them: a second of freeze against a seven-tenths crack
    // would otherwise drop all four of them and hand the round over.
    const held = drive(s, {
      ms: CREW.FREEZE_MS - 40,
      policy: true,
      watch: (cur, elapsed) => {
        for (const b of bots(cur)) {
          expect(b.alive).toBe(true)
          if (elapsed > CREW.MOVE_MS) expect(b.moveT).toBe(0)
        }
      },
    })
    expect(bots(held).every((b) => b.frozen > 0)).toBe(true)
    const where = bots(held).map((b) => [b.x, b.y])

    // and once the second is up, they are off again
    const thawed = drive(held, { ms: CREW.THINK_MS + CREW.MOVE_MS + 100, policy: true })
    expect(bots(thawed).every((b) => b.frozen === 0)).toBe(true)
    expect(bots(thawed).map((b) => [b.x, b.y])).not.toEqual(where)
  })

  it('picks the tile from the seed', () => {
    const dead = lose(3)
    expect(revive(dead)).toEqual(revive(dead))
  })

  it('shrugs when there is no floor left to stand on', () => {
    const dead = lose(3)
    const bare: CrewState = { ...dead, tiles: dead.tiles.map(() => ({ state: 'gone' as const, t: 0 })) }
    expect(revive(bare)).toEqual(bare)
  })
})

describe('every round ends', () => {
  it('finishes inside ninety seconds for the first twenty seeds, played straight', () => {
    const ends: number[] = []
    for (let seed = 1; seed <= 20; seed++) {
      const s = play(seed, { ms: 90000, policy: true })
      expect(s.status).not.toBe('play')
      ends.push(s.t)
    }
    // The deck grows back, so attrition alone would let a careful bean hop for
    // ever: what guarantees an ending is the arena's own edge, quickening as it
    // eats. Ninety seconds is the guarantee; the shape of a round is the median.
    expect(Math.max(...ends)).toBeLessThan(90000)
    // Not a wall of instant losses either — and the floor is set where it can
    // actually catch the failure this is guarding: with the deck healing too
    // slowly for the crew it feeds, beans wall themselves in with their own
    // trail and every round is over inside five seconds. No seed may end before
    // the arena has even started closing in.
    expect(Math.min(...ends)).toBeGreaterThan(CREW.SHRINK_START_MS)
    const median = [...ends].sort((a, b) => a - b)[Math.floor(ends.length / 2)]
    expect(median).toBeGreaterThan(CREW.SHRINK_START_MS)
  })
})
