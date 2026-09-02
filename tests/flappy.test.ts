// Chalk Flight's rules, with no board to draw them on.
//
// Everything the game decides — where a gap sits, when the bird dies, when a
// column scores, what "Hire me" actually buys — lives in `src/games/flappy.ts`
// as a pure step function, so it can be flown here a millisecond at a time and
// asserted on exactly. The renderer is tested separately, over the DOM.
import { describe, expect, it } from 'vitest'

import { BIRD_X, FLAPPY, type FlappyState, columnRects, flap, newFlappy, revive, step, won } from '../src/games/flappy'

/** The fixed simulation step every canvas game runs on: 120 Hz. */
const MS = 1000 / 120

/** Run the simulation forward, a whole step at a time, as the loop does. */
function advance(s: FlappyState, ms: number, each?: (s: FlappyState) => FlappyState): FlappyState {
  for (let i = 0; i < Math.round(ms / MS); i++) {
    if (each) s = each(s)
    s = step(s, MS)
  }
  return s
}

/** The height the bird wants to be at: the middle of the next gap ahead of it. */
function aim(s: FlappyState): number {
  const next = s.cols.find((c) => c.x + FLAPPY.COL_W >= BIRD_X - FLAPPY.R)
  return next ? next.gapY + FLAPPY.GAP / 2 : FLAPPY.H / 2
}

/**
 * A competent player: flap once the bird has sunk a little past the middle of
 * the gap it is aiming at. One flap buys about 59 px of rise, so releasing 24 px
 * low leaves the swing roughly centred on the gap. Coarse on purpose — it is a
 * stand-in for a human, not a solver, so a game it can finish is a game a human
 * can finish.
 */
const pilot = (s: FlappyState): FlappyState => (s.y > aim(s) + 24 ? flap(s) : s)

/** A column parked two pixels short of scoring — one step at 120 Hz moves 1.25. */
const aboutToScore = () => ({ x: BIRD_X - FLAPPY.COL_W + 2, gapY: 100, passed: false })

/** A started run with a hand-placed board — the fastest way to a specific rule. */
function board(over: Partial<FlappyState> = {}): FlappyState {
  return { ...newFlappy(1), started: true, cols: [], y: FLAPPY.H / 2, vy: 0, ...over }
}

describe('newFlappy', () => {
  it('opens with the bird centred, alive and waiting to be asked', () => {
    const s = newFlappy(1)
    expect(s.y).toBe(FLAPPY.H / 2)
    expect({ vy: s.vy, score: s.score, dead: s.dead, started: s.started, grace: s.grace, t: s.t }).toEqual({
      vy: 0,
      score: 0,
      dead: false,
      started: false,
      grace: 0,
      t: 0,
    })
    expect(s.speed).toBe(FLAPPY.SPEED)
  })

  it('pre-spawns three columns, the first off the right edge and the rest a spacing apart', () => {
    expect(newFlappy(1).cols.map((c) => c.x)).toEqual([FLAPPY.W + 60, FLAPPY.W + 60 + FLAPPY.SPACING, FLAPPY.W + 60 + 2 * FLAPPY.SPACING])
    expect(newFlappy(1).cols.every((c) => !c.passed)).toBe(true)
  })

  it('deals the same board for the same seed and a different one for the next', () => {
    // The retry button hands out `seed + 1`, so consecutive seeds must not be
    // the same three gaps with a different label on them.
    expect(newFlappy(7).cols.map((c) => c.gapY)).toEqual(newFlappy(7).cols.map((c) => c.gapY))
    expect(newFlappy(7).cols.map((c) => c.gapY)).not.toEqual(newFlappy(8).cols.map((c) => c.gapY))
  })

  it('keeps every gap it ever deals clear of the ceiling and the floor', () => {
    // A gap flush against either edge is unflyable: the bird cannot be at y=0.
    const min = 60
    const max = FLAPPY.FLOOR - 60 - FLAPPY.GAP
    for (let seed = 1; seed <= 40; seed++) {
      // 30 s of scrolling is a hundred-odd columns' worth of spawning.
      let s = flap(newFlappy(seed))
      const seen: number[] = []
      for (let i = 0; i < Math.round(30000 / MS); i++) {
        s = step({ ...s, dead: false, grace: FLAPPY.GRACE_MS }, MS)
        for (const c of s.cols) if (!seen.includes(c.gapY)) seen.push(c.gapY)
      }
      expect(seen.length).toBeGreaterThan(10)
      for (const gapY of seen) {
        expect(gapY, `seed ${seed} dealt ${gapY}`).toBeGreaterThanOrEqual(min)
        expect(gapY, `seed ${seed} dealt ${gapY}`).toBeLessThanOrEqual(max)
      }
    }
  })
})

describe('flap', () => {
  it('starts the run and throws the bird upward', () => {
    const s = flap(newFlappy(1))
    expect(s.started).toBe(true)
    expect(s.vy).toBe(FLAPPY.FLAP)
    expect(s.vy).toBeLessThan(0)
    // and the bird really does rise over the next few frames
    expect(advance(s, 100).y).toBeLessThan(FLAPPY.H / 2)
  })

  it('is ignored once the round is over', () => {
    const dead = { ...newFlappy(1), dead: true, vy: 40 }
    expect(flap(dead)).toBe(dead)
  })

  it('leaves the state it was handed alone', () => {
    const s = newFlappy(1)
    flap(s)
    expect({ started: s.started, vy: s.vy }).toEqual({ started: false, vy: 0 })
  })
})

describe('step before the first flap', () => {
  it('bobs the bird on the spot and holds the board still', () => {
    const s = newFlappy(1)
    const bobbed = advance(s, 400)
    expect(bobbed.y).not.toBe(FLAPPY.H / 2)
    expect(Math.abs(bobbed.y - FLAPPY.H / 2)).toBeLessThan(12)
    expect(bobbed.vy).toBe(0)
    expect(bobbed.cols.map((c) => c.x)).toEqual(s.cols.map((c) => c.x))
    expect(bobbed.t).toBeCloseTo(400, 6)
  })

  it('cannot be lost by standing still', () => {
    expect(advance(newFlappy(1), 10000).dead).toBe(false)
    expect(advance(newFlappy(1), 10000).score).toBe(0)
  })
})

describe('step: gravity and the world', () => {
  it('drops an unflapped bird onto the floor and ends the round there', () => {
    // 180 px to fall at 1500 px/s² is a shade under half a second.
    const s = advance(flap(newFlappy(1)), 1500)
    expect(s.dead).toBe(true)
    expect(s.y + FLAPPY.R).toBeGreaterThan(FLAPPY.FLOOR)
  })

  it('ends the round at the ceiling too', () => {
    const s = advance(board({ y: 40, vy: -400 }), 400)
    expect(s.dead).toBe(true)
    expect(s.y - FLAPPY.R).toBeLessThan(0)
  })

  it('scrolls the columns leftward at the current speed', () => {
    // Flying is not the subject here, so the bird is handed a long lifeline.
    const s = board({ cols: [{ x: 300, gapY: 100, passed: false }], grace: 5000 })
    const after = advance(s, 1000)
    expect(after.cols[0].x).toBeCloseTo(300 - FLAPPY.SPEED, 4)
  })

  it('keeps a column coming as soon as the last one is a spacing from the edge', () => {
    const s = board({ cols: [{ x: FLAPPY.W - FLAPPY.SPACING - 1, gapY: 100, passed: false }] })
    const after = step(s, MS)
    expect(after.cols).toHaveLength(2)
    expect(after.cols[1].x).toBeCloseTo(after.cols[0].x + FLAPPY.SPACING, 4)
  })

  it('forgets a column once it is off the left edge', () => {
    const s = board({ cols: [{ x: -FLAPPY.COL_W, gapY: 100, passed: true }] })
    // one more step carries its right edge past x = 0
    expect(step(s, MS).cols.filter((c) => c.x < 0)).toHaveLength(0)
  })

  it('leaves the state it was handed alone', () => {
    const s = board({ cols: [{ x: 300, gapY: 100, passed: false }], vy: 20 })
    const before = JSON.stringify(s)
    step(s, MS)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('step: scoring', () => {
  it('scores a column once its back edge is behind the bird, and only once', () => {
    const s = board({ cols: [aboutToScore()] })
    expect(step(s, MS).score).toBe(0) // one pixel short
    const scored = advance(s, 50)
    expect(scored.score).toBe(1)
    expect(scored.cols[0].passed).toBe(true)
    // and it stays scored while it slides off the board behind the bird
    expect(advance({ ...scored, grace: 5000 }, 1200).score).toBe(1)
  })

  it('speeds the board up every five gaps', () => {
    const four = board({ score: 4, cols: [aboutToScore()] })
    const five = advance(four, 50)
    expect(five.score).toBe(5)
    expect(five.speed).toBeCloseTo(FLAPPY.SPEED * (1 + FLAPPY.SPEED_GAIN), 6)

    // ...and not on the gaps in between
    const six = advance({ ...five, cols: [aboutToScore()] }, 50)
    expect(six.score).toBe(6)
    expect(six.speed).toBe(five.speed)
  })

  it('calls it won at ten', () => {
    expect(won(board({ score: 9 }))).toBe(false)
    const tenth = advance(board({ score: 9, cols: [aboutToScore()] }), 50)
    expect(tenth.score).toBe(FLAPPY.WIN)
    expect(won(tenth)).toBe(true)
  })

  it('can be flown to the win by a plain autopilot', () => {
    // The proof that the constants add up to a playable game rather than only a
    // consistent one: a coarse "flap when you are sinking below the gap" player
    // clears ten columns without dying.
    let s = flap(newFlappy(3))
    for (let i = 0; i < Math.round(40000 / MS) && !won(s) && !s.dead; i++) s = step(pilot(s), MS)
    expect(s.dead).toBe(false)
    expect(s.score).toBeGreaterThanOrEqual(FLAPPY.WIN)
  })
})

describe('step: columns are solid', () => {
  it('ends the round against the stack below the gap', () => {
    const s = board({ cols: [{ x: BIRD_X - 14, gapY: 60, passed: false }], y: 185 })
    expect(step(s, MS).dead).toBe(true)
  })

  it('ends the round against the stack above the gap', () => {
    const s = board({ cols: [{ x: BIRD_X - 14, gapY: 120, passed: false }], y: 115 })
    expect(step(s, MS).dead).toBe(true)
  })

  it('lets the bird through the gap it was aimed at', () => {
    const s = board({ cols: [{ x: BIRD_X - 14, gapY: 100, passed: false }], y: 100 + FLAPPY.GAP / 2 })
    expect(step(s, MS).dead).toBe(false)
  })

  it('draws its books from the same rectangles it kills with', () => {
    // The renderer stacks books inside these two boxes; a hitbox that disagreed
    // with the picture is the one bug a flappy player will never forgive.
    const [top, bottom] = columnRects({ x: 200, gapY: 100, passed: false })
    expect(top).toEqual({ x: 200, y: 0, w: FLAPPY.COL_W, h: 100 })
    expect(bottom).toEqual({ x: 200, y: 100 + FLAPPY.GAP, w: FLAPPY.COL_W, h: FLAPPY.FLOOR - 100 - FLAPPY.GAP })
  })

  it('freezes the round the moment it is lost', () => {
    const dead = step(board({ cols: [{ x: BIRD_X - 14, gapY: 60, passed: false }], y: 185 }), MS)
    expect(step(dead, MS)).toBe(dead)
  })
})

describe('revive — what "Hire me" buys', () => {
  const crash = () => step(board({ score: 4, cols: [{ x: BIRD_X - 14, gapY: 60, passed: false }], y: 185 }), MS)

  it('puts the bird back in the air at the score it fell on', () => {
    const s = revive(crash())
    expect({ dead: s.dead, y: s.y, vy: s.vy, started: s.started }).toEqual({ dead: false, y: FLAPPY.H / 2, vy: 0, started: true })
    expect(s.score).toBe(4)
    expect(s.grace).toBe(FLAPPY.GRACE_MS)
  })

  it('sweeps the column it died on out of the way, and leaves the far ones alone', () => {
    const near = (s: FlappyState) => s.cols.filter((c) => Math.abs(c.x + FLAPPY.COL_W / 2 - BIRD_X) <= 120)
    expect(near(crash())).toHaveLength(1)
    const saved = revive(crash())
    expect(near(saved)).toHaveLength(0)
    // the board ahead is untouched: the lifeline clears the crash, not the game
    expect(saved.cols).toEqual(crash().cols.filter((c) => Math.abs(c.x + FLAPPY.COL_W / 2 - BIRD_X) > 120))
    expect(saved.cols.length).toBeGreaterThan(0)
  })

  it('cannot be hit while the grace second runs, and can be after it', () => {
    // The board is pinned each step: only the clock is allowed to change here.
    const pin = (s: FlappyState): FlappyState => ({ ...s, y: 185, vy: 0, cols: [{ x: BIRD_X - 14, gapY: 60, passed: false }] })
    const saved = pin(revive(crash()))
    expect(advance(saved, FLAPPY.GRACE_MS - 100, pin).dead).toBe(false)
    expect(advance(saved, FLAPPY.GRACE_MS + 100, pin).dead).toBe(true)
  })

  it('holds the bird on the board through the grace rather than letting it sink out of the world', () => {
    // Nothing can kill it for a second, so without this the bird falls 750 px
    // through the floor and the player spends their lifeline watching an empty
    // board. The floor is a floor again the moment the grace runs out.
    const s = advance(revive(crash()), FLAPPY.GRACE_MS - 50)
    expect(s.grace).toBeGreaterThan(0)
    expect(s.y).toBeLessThanOrEqual(FLAPPY.FLOOR - FLAPPY.R)
    expect(s.y).toBeGreaterThanOrEqual(FLAPPY.R)
    expect(s.dead).toBe(false)
  })

  it('is a no-op on a bird that is still flying', () => {
    const alive = board({ score: 2 })
    expect(revive(alive)).toBe(alive)
  })
})
