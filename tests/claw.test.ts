// Prize Grab — the claw machine's rules, with none of the cabinet.
//
// Everything a player can argue with lives here: where the claw may travel, what
// a drop costs, what counts as a catch and how much harder each one gets. The
// renderer only draws what these functions decide, so a regression in the feel
// of the game shows up as a failure in this file, not as a screenshot nobody
// took. No randomness anywhere: the same drop from the same place always ends
// the same way, which is the only fair version of a claw machine.
import { describe, expect, it } from 'vitest'
import { CLAW, type ClawState, type Prize, allCaught, catchTarget, drop, newClaw, newRound, refill, step } from '../src/games/claw'

/** One 120 Hz simulation step — the rate the renderer's loop feeds in. */
const MS = 1000 / 120

/** Advance `ms` of simulation in whole fixed steps, exactly as the loop does. */
function run(s: ClawState, ms: number): ClawState {
  let out = s
  for (let i = 0; i < Math.round(ms / MS); i++) out = step(out, MS)
  return out
}

/** Step until `pred` holds (or the cap runs out) — the state at that moment. */
function until(s: ClawState, pred: (x: ClawState) => boolean, capMs = 8000): ClawState {
  let out = s
  for (let i = 0; i < Math.round(capMs / MS) && !pred(out); i++) out = step(out, MS)
  return out
}

/** Park the claw at `x` and drop: the whole grab cycle, back to rest. */
function dropAt(s: ClawState, x: number): ClawState {
  const parked: ClawState = { ...s, x }
  const falling = drop(parked)
  expect(falling).not.toBe(parked) // a refused drop would make the rest meaningless
  return until(falling, (t) => t.phase === 'sweep' || t.phase === 'done')
}

const byId = (s: ClawState, id: Prize['id']): Prize => s.prizes.find((p) => p.id === id)!

describe('claw constants', () => {
  it('holds the cabinet, the purse and the difficulty curve', () => {
    expect(CLAW).toEqual({
      W: 640,
      H: 400,
      SHELF_Y: 300,
      TOKENS: 6,
      SWEEP: 0.55,
      SWEEP_GAIN: 0.15,
      TOL: [0.45, 0.35, 0.28],
      DROP_MS: 700,
      RISE_MS: 700,
      CHUTE_X: 0.08,
    })
  })
})

describe('newClaw', () => {
  it('opens with six tokens, a still shelf and the claw mid-rail', () => {
    const s = newClaw()
    expect(s.tokens).toBe(CLAW.TOKENS)
    expect({ x: s.x, dir: s.dir, y: s.y, phase: s.phase, t: s.t }).toEqual({ x: 0.5, dir: 1, y: 0, phase: 'sweep', t: 0 })
    expect({ caught: s.caught, holding: s.holding, justCaught: s.justCaught, speed: s.speed }).toEqual({
      caught: 0,
      holding: null,
      justCaught: null,
      speed: CLAW.SWEEP,
    })
  })

  it('puts the three projects on the shelf with two plushies between them', () => {
    const s = newClaw()
    // The mystery box is the stealth chapter and is never named here either.
    expect(s.prizes.map((p) => [p.id, p.x, p.w, p.decoy])).toEqual([
      ['lineage', 0.22, 0.14, false],
      ['plush_a', 0.36, 0.08, true],
      ['safestride', 0.5, 0.14, false],
      ['plush_b', 0.64, 0.08, true],
      ['stealth', 0.78, 0.14, false],
    ])
    expect(s.prizes.every((p) => !p.caught)).toBe(true)
  })

  it('hands back a fresh cabinet every time', () => {
    const a = newClaw()
    const b = newClaw()
    expect(a).not.toBe(b)
    expect(a.prizes[0]).not.toBe(b.prizes[0])
  })
})

describe('the sweep', () => {
  it('travels at the sweep speed in the direction it is facing', () => {
    const s = run(newClaw(), 500)
    expect(s.x).toBeCloseTo(0.5 + CLAW.SWEEP / 2, 6)
    expect(s.dir).toBe(1)
  })

  it('reflects off the end of the rail instead of stopping at it', () => {
    // 0.5 + 0.55 would be 1.05, a tenth of a width past the glass.
    const s = run(newClaw(), 1000)
    expect(s.x).toBeCloseTo(0.94 - (0.5 + CLAW.SWEEP - 0.94), 6)
    expect(s.dir).toBe(-1)
  })

  it('turns around at both ends and never leaves the rail', () => {
    let s = newClaw()
    let min = s.x
    let max = s.x
    const flips: number[] = []
    for (let i = 0; i < 120 * 20; i++) {
      const prev = s.dir
      s = step(s, MS)
      min = Math.min(min, s.x)
      max = Math.max(max, s.x)
      if (s.dir !== prev) flips.push(s.x)
    }
    // Twenty seconds at 0.55 widths/s over a 0.88-wide rail: a dozen or so ends.
    expect(flips.length).toBeGreaterThan(10)
    expect(min).toBeGreaterThanOrEqual(0.06)
    expect(max).toBeLessThanOrEqual(0.94)
    // A bounce reflects off the wall rather than sticking to it, so every turn
    // happens within a step's travel of the end it turned at.
    for (const x of flips) expect(Math.min(Math.abs(x - 0.06), Math.abs(x - 0.94))).toBeLessThan(CLAW.SWEEP * (MS / 1000) * 1.5)
  })

  it('is a triangle wave: the same run always lands in the same place', () => {
    const a = run(newClaw(), 9000)
    const b = run(newClaw(), 9000)
    expect(a.x).toBe(b.x)
    expect(a.dir).toBe(b.dir)
    // and one full there-and-back (2 × 0.88 / 0.55 = 3.2 s) comes home again
    expect(run(newClaw(), 3200).x).toBeCloseTo(0.5, 6)
  })

  it('never mutates the state it was handed', () => {
    const s = newClaw()
    const before = JSON.parse(JSON.stringify(s))
    step(s, MS)
    drop(s)
    refill(s, 2)
    expect(JSON.parse(JSON.stringify(s))).toEqual(before)
  })

  it('shrugs off a zero, negative or absent delta', () => {
    const s = newClaw()
    expect(step(s, 0).x).toBe(s.x)
    expect(step(s, -50).x).toBe(s.x)
    expect(step(s, Number.NaN).x).toBe(s.x)
  })
})

describe('drop', () => {
  it('spends a token and starts the claw down', () => {
    const s = drop(newClaw())
    expect(s.tokens).toBe(CLAW.TOKENS - 1)
    expect(s.phase).toBe('drop')
    expect(s.t).toBe(0)
    expect(s.y).toBe(0)
  })

  it('refuses when the purse is empty', () => {
    const broke: ClawState = { ...newClaw(), tokens: 0 }
    expect(drop(broke)).toBe(broke)
  })

  it('refuses while the claw is already working', () => {
    const falling = drop(newClaw())
    expect(drop(falling)).toBe(falling)
    const mid = run(falling, 400)
    expect(drop(mid)).toBe(mid)
    expect(mid.tokens).toBe(CLAW.TOKENS - 1) // one press, one token
  })

  it('clears the last prize signal so a catch can only be read once', () => {
    const won = dropAt(newClaw(), 0.5)
    expect(won.justCaught).toBe('safestride')
    expect(drop(won).justCaught).toBeNull()
  })

  it('takes the claw all the way down before it decides anything', () => {
    const falling = drop(newClaw())
    const half = run(falling, CLAW.DROP_MS / 2)
    expect(half.phase).toBe('drop')
    expect(half.y).toBeCloseTo(0.5, 1)
    expect(half.holding).toBeNull()
    const bottom = until(falling, (t) => t.phase === 'grab')
    expect(bottom.y).toBe(1)
    expect(bottom.holding).toBe('safestride')
  })
})

describe('catchTarget', () => {
  const at = (x: number, caught = 0): Prize | null => catchTarget({ ...newClaw(), x, caught })

  it('takes the nearest prize inside its tolerance', () => {
    expect(at(0.5)?.id).toBe('safestride')
    expect(at(0.22)?.id).toBe('lineage')
    expect(at(0.78)?.id).toBe('stealth')
  })

  it('measures the tolerance against the prize width', () => {
    // 0.14 wide × 0.45 = 0.063 either side of centre.
    expect(at(0.5 + 0.14 * 0.44)?.id).toBe('safestride')
    expect(at(0.5 + 0.14 * 0.46)).toBeNull()
  })

  it('tightens with every prize already won', () => {
    const edge = 0.5 + 0.14 * 0.44
    expect(at(edge, 0)?.id).toBe('safestride') // 0.45 — generous
    expect(at(edge, 1)).toBeNull() // 0.35
    expect(at(edge, 2)).toBeNull() // 0.28 — the third is the hard one
    // and the tightest tolerance still holds if the counter ever runs past it
    expect(at(0.5, 9)?.id).toBe('safestride')
    expect(at(0.5 + 0.14 * 0.3, 9)).toBeNull()
  })

  it('will pick up a plushie — they are small, but they are grabbable', () => {
    expect(at(0.36)?.id).toBe('plush_a')
    expect(at(0.64)?.id).toBe('plush_b')
    // 0.08 wide × 0.45 = 0.036: a plushie is a much smaller window than a box
    expect(at(0.36 + 0.08 * 0.5)).toBeNull()
  })

  it('finds nothing over the gaps between the prizes', () => {
    expect(at(0.3)).toBeNull()
    expect(at(0.14)).toBeNull()
    expect(at(0.9)).toBeNull()
  })

  it('ignores a prize already in the chute', () => {
    const s = newClaw()
    const spent: ClawState = { ...s, x: 0.5, prizes: s.prizes.map((p) => (p.id === 'safestride' ? { ...p, caught: true } : p)) }
    expect(catchTarget(spent)).toBeNull()
  })
})

describe('a catch', () => {
  it('rides the prize to the chute, banks it once, and speeds the rail up', () => {
    const s = dropAt(newClaw(), 0.5)
    expect(s.justCaught).toBe('safestride')
    expect(s.caught).toBe(1)
    expect(byId(s, 'safestride').caught).toBe(true)
    expect(s.holding).toBeNull()
    expect(s.speed).toBeCloseTo(CLAW.SWEEP * (1 + CLAW.SWEEP_GAIN), 6)
    // The prize goes down the chute, and the claw sets off from there.
    expect(s.x).toBeCloseTo(CLAW.CHUTE_X, 6)
    expect(s.dir).toBe(1)
    expect(s.phase).toBe('sweep')
  })

  it('holds the prize through the lift and the ride across', () => {
    const falling = drop(newClaw())
    const lifting = until(falling, (t) => t.phase === 'rise')
    expect(lifting.holding).toBe('safestride')
    // it is off the shelf but not yet banked: the card only opens at the chute
    expect(lifting.caught).toBe(0)
    expect(byId(lifting, 'safestride').caught).toBe(false)
    const across = until(lifting, (t) => t.phase === 'carry')
    expect(across.y).toBe(0)
    expect(across.holding).toBe('safestride')
    expect(until(across, (t) => t.phase === 'release').x).toBeCloseTo(CLAW.CHUTE_X, 6)
  })

  it('latches the signal so a renderer between frames cannot miss it', () => {
    const s = dropAt(newClaw(), 0.5)
    // Two more seconds of sweeping: still the same catch, and still only one.
    const later = run(s, 2000)
    expect(later.justCaught).toBe('safestride')
    expect(later.caught).toBe(1)
  })

  it('makes each prize harder than the last', () => {
    // 0.44 of a width off centre: fine for the first, hopeless for the third.
    const first = dropAt(newClaw(), 0.5 + 0.14 * 0.44)
    expect(first.caught).toBe(1)
    const second = dropAt(first, 0.22)
    expect(second.caught).toBe(2)
    expect(second.speed).toBeCloseTo(CLAW.SWEEP * 1.15 ** 2, 6)
    const third = dropAt(second, 0.78 + 0.14 * 0.44)
    expect(third.caught).toBe(2) // the same offset that won the first one misses
    expect(third.justCaught).toBeNull()
  })
})

describe('a miss', () => {
  it('costs a token, lifts nothing, and carries on from where it dropped', () => {
    const s = dropAt(newClaw(), 0.3)
    expect(s.caught).toBe(0)
    expect(s.justCaught).toBeNull()
    expect(s.holding).toBeNull()
    expect(s.tokens).toBe(CLAW.TOKENS - 1)
    expect(s.speed).toBe(CLAW.SWEEP) // no catch, no gain
    expect(s.phase).toBe('sweep')
    expect(s.x).toBeCloseTo(0.3, 6) // it never went to the chute
    expect(s.y).toBe(0)
  })

  it('empties the purse one press at a time', () => {
    let s = newClaw()
    for (let i = 0; i < CLAW.TOKENS; i++) s = dropAt(s, 0.3)
    expect(s.tokens).toBe(0)
    expect(s.caught).toBe(0)
    // and then the claw stops taking presses, even parked over a prize
    const parked: ClawState = { ...s, x: 0.5 }
    expect(drop(parked)).toBe(parked)
  })

  it('drops a plushie on the way up — no prize, no gain, still on the shelf', () => {
    const s = dropAt(newClaw(), 0.36)
    expect(s.caught).toBe(0)
    expect(s.justCaught).toBeNull()
    expect(s.holding).toBeNull()
    expect(byId(s, 'plush_a').caught).toBe(false)
    expect(s.speed).toBe(CLAW.SWEEP)
    expect(s.x).toBeCloseTo(0.36, 6) // it never rode to the chute
    expect(s.tokens).toBe(CLAW.TOKENS - 1)
  })
})

describe('allCaught', () => {
  it('is only true once all three projects are in the chute', () => {
    const s = newClaw()
    expect(allCaught(s)).toBe(false)
    const one = dropAt(s, 0.5)
    expect(allCaught(one)).toBe(false)
    const two = dropAt(one, 0.22)
    expect(allCaught(two)).toBe(false)
    const three = dropAt(two, 0.78)
    expect(three.caught).toBe(3)
    expect(allCaught(three)).toBe(true)
    // The cabinet stops the moment the shelf is empty.
    expect(three.phase).toBe('done')
    expect(run(three, 2000).x).toBe(three.x)
  })

  it('does not count the plushies', () => {
    const s = newClaw()
    const won: ClawState = { ...s, prizes: s.prizes.map((p) => (p.decoy ? p : { ...p, caught: true })) }
    expect(allCaught(won)).toBe(true)
  })
})

describe('refill and newRound', () => {
  it('adds tokens and touches nothing else', () => {
    const s = dropAt(newClaw(), 0.5)
    const more = refill({ ...s, tokens: 0 }, 2)
    expect(more.tokens).toBe(2)
    expect(more.caught).toBe(1)
    expect(more.prizes).toEqual(s.prizes)
    expect(more.speed).toBe(s.speed)
  })

  it('never hands back a negative purse', () => {
    expect(refill(newClaw(), -3).tokens).toBe(CLAW.TOKENS)
  })

  it('starts a fresh round with the won prizes still won', () => {
    const s = dropAt(newClaw(), 0.5)
    const next = newRound({ ...s, tokens: 0 })
    expect(next.tokens).toBe(CLAW.TOKENS)
    expect(next.caught).toBe(1)
    expect(next.speed).toBe(s.speed) // the rail does not get slower on a retry
    expect(byId(next, 'safestride').caught).toBe(true)
    expect(byId(next, 'lineage').caught).toBe(false)
    // and the cabinet itself is back at rest
    expect({ x: next.x, dir: next.dir, y: next.y, phase: next.phase, holding: next.holding, justCaught: next.justCaught }).toEqual({
      x: 0.5,
      dir: 1,
      y: 0,
      phase: 'sweep',
      holding: null,
      justCaught: null,
    })
  })
})
