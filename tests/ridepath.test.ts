// The pure half of the Career Coaster: the arc-length sampler and the speed
// profile the Phaser runner drives the cart with.
//
// Everything that can be decided without a canvas lives in `systems/ridepath.ts`
// so it can be pinned here: `systems/Coaster.ts` is then a thin shell that
// samples, draws and plays sounds. Two properties matter most.
//
//  1. The profile is derived from the *geometry* — the apex, the sustained climb
//     that reaches it, the stretch that turns through a full circle, the two ends
//     of the circuit — never from indices typed out by hand. `data/coaster.ts`
//     may redraw the profile at any time; the ride has to still read as a ride.
//  2. The whole thing is a function of arc length, so the runner can integrate
//     it at a fixed step and interpolate between steps. No per-point timers.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COASTER_PATH, COASTER_STOPS } from '../src/data/coaster'
import {
  CLIMB_SPEED,
  CRUISE_SPEED,
  DROP_MAX,
  DROP_SLOPE,
  LIFT_SPEED,
  LOOP_SPEED,
  STATION_CLEAR,
  STATION_RUN,
  STATION_SPEED,
  STOP_BRAKE,
  STOP_HOLD_MS,
  STOP_RADIUS,
  STOP_SPEED,
  buildArcTable,
  sampleAt,
  speedAt,
  stopArcs,
  stopWindow,
  trackInfo,
  zoneAt,
} from '../src/systems/ridepath'

const P = COASTER_PATH
const TABLE = buildArcTable(P)
const TOTAL = TABLE[TABLE.length - 1]
const INFO = trackInfo(P, TABLE)
const OPTS = { stops: COASTER_STOPS }
const STOP_S = stopArcs(COASTER_STOPS, TABLE)

const polylineLength = (pts: readonly { x: number; y: number }[]): number => {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return d
}

/** Arc positions every `step` px, endpoints included. */
const walk = (step = 1): number[] => {
  const out: number[] = []
  for (let s = 0; s <= TOTAL; s += step) out.push(s)
  out.push(TOTAL)
  return out
}

/** How far `s` is from the nearest résumé beat. */
const distToStop = (s: number): number => Math.min(...STOP_S.map((v) => Math.abs(v - s)))
/** Far enough from every beat that the brake has let go entirely. */
const clearOfStops = (s: number): boolean => distToStop(s) > STOP_RADIUS + STOP_BRAKE

/**
 * Open track: no beat, and no piece of hardware — not even its run-out — with a
 * say in the speed here. `zoneAt` reports cores only (it drives the cues, which
 * have to land on the crest), so the blends have to be spelled out separately.
 */
const openTrack = (s: number): boolean => {
  if (!clearOfStops(s)) return false
  for (const span of [INFO.lift, INFO.loop, INFO.stationIn, INFO.stationOut]) {
    if (span && s > span.from - span.blend && s < span.to + span.blend) return false
  }
  return true
}

const angleBetween = (a: { dx: number; dy: number }, b: { dx: number; dy: number }): number =>
  Math.acos(Math.max(-1, Math.min(1, a.dx * b.dx + a.dy * b.dy)))

describe('ridepath — arc-length table', () => {
  it('has one entry per point, starts at zero and never goes backwards', () => {
    expect(TABLE).toHaveLength(P.length)
    expect(TABLE[0]).toBe(0)
    for (let i = 1; i < TABLE.length; i++) expect(TABLE[i]).toBeGreaterThan(TABLE[i - 1])
  })

  it('totals the polyline length', () => {
    expect(TOTAL).toBeCloseTo(polylineLength(P), 6)
    // The drawn circuit: three 512px spans' worth of track and change.
    expect(TOTAL).toBeGreaterThan(2000)
  })

  it('is empty-safe and single-point-safe (a redrawn path can be anything)', () => {
    expect(buildArcTable([])).toEqual([])
    expect(buildArcTable([{ x: 4, y: 4 }])).toEqual([0])
  })
})

describe('ridepath — sampleAt', () => {
  it('lands on the endpoints', () => {
    const a = sampleAt(P, TABLE, 0)
    expect(a.x).toBeCloseTo(P[0].x, 6)
    expect(a.y).toBeCloseTo(P[0].y, 6)
    expect(a.index).toBe(0)
    const b = sampleAt(P, TABLE, TOTAL)
    expect(b.x).toBeCloseTo(P[P.length - 1].x, 6)
    expect(b.y).toBeCloseTo(P[P.length - 1].y, 6)
  })

  it('clamps outside the circuit rather than running off the rails', () => {
    expect(sampleAt(P, TABLE, -500)).toMatchObject({ x: P[0].x, y: P[0].y })
    const end = sampleAt(P, TABLE, TOTAL + 5000)
    expect(end.x).toBeCloseTo(P[P.length - 1].x, 6)
    expect(end.y).toBeCloseTo(P[P.length - 1].y, 6)
  })

  it('lands on every drawn point at that point’s own arc length', () => {
    for (let i = 0; i < P.length; i++) {
      const v = sampleAt(P, TABLE, TABLE[i])
      expect(v.x).toBeCloseTo(P[i].x, 4)
      expect(v.y).toBeCloseTo(P[i].y, 4)
    }
  })

  it('interpolates the midpoint of a segment', () => {
    const mid = (TABLE[10] + TABLE[11]) / 2
    const v = sampleAt(P, TABLE, mid)
    expect(v.x).toBeCloseTo((P[10].x + P[11].x) / 2, 4)
    expect(v.y).toBeCloseTo((P[10].y + P[11].y) / 2, 4)
  })

  it('advances monotonically along the polyline', () => {
    let prev = -1
    for (const s of walk(7)) {
      const v = sampleAt(P, TABLE, s)
      expect(v.index).toBeGreaterThanOrEqual(prev)
      prev = v.index
    }
  })

  it('returns a unit tangent everywhere', () => {
    for (const s of walk(3)) {
      const v = sampleAt(P, TABLE, s)
      expect(Math.hypot(v.dx, v.dy)).toBeCloseTo(1, 6)
    }
  })

  it('points the tangent the way the ride travels: out of the station leftwards, home rightwards', () => {
    expect(sampleAt(P, TABLE, 10).dx).toBeLessThan(0)
    expect(sampleAt(P, TABLE, TOTAL - 10).dx).toBeGreaterThan(0)
  })

  it('turns the tangent smoothly — no kink a rotating sprite would snap through', () => {
    let prev = sampleAt(P, TABLE, 0)
    for (const s of walk(2).slice(1)) {
      const v = sampleAt(P, TABLE, s)
      // 2px of track may not turn the cart more than ~12 degrees.
      expect(angleBetween(prev, v)).toBeLessThan(0.21)
      prev = v
    }
  })

  it('smooths the drawn profile’s three corners rather than snapping through them', () => {
    // The resampled polyline turns as much as ~47 degrees between neighbouring
    // 20px samples in three places (the first drop's valley, the loop's entry and
    // the last bunny hop). A cart rotated to the raw segment direction flicks
    // there; the sampler's central difference must not.
    let raw = 0
    for (let i = 1; i < P.length - 1; i++) {
      const a = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x)
      const b = Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x)
      let d = Math.abs(b - a)
      if (d > Math.PI) d = 2 * Math.PI - d
      raw = Math.max(raw, d)
    }
    expect(raw).toBeGreaterThan(0.6) // the corners are really there…
    // …and one 120Hz step of the ride, at whatever speed the profile is running,
    // never turns the cart more than 15 degrees.
    let worst = 0
    for (const s of walk(1)) {
      const step = speedAt(P, TABLE, s, OPTS) / 120
      worst = Math.max(worst, angleBetween(sampleAt(P, TABLE, s), sampleAt(P, TABLE, Math.min(TOTAL, s + step))))
    }
    expect(worst).toBeLessThan((15 * Math.PI) / 180)
  })
})

describe('ridepath — the geometry the profile is built from', () => {
  it('finds the apex, and a chain lift that climbs rightwards into it', () => {
    const apex = INFO.apex
    for (const p of P) expect(p.y).toBeGreaterThanOrEqual(P[apex].y)
    expect(INFO.lift).not.toBeNull()
    const lift = INFO.lift!
    expect(lift.i1).toBe(apex)
    expect(lift.to - lift.from).toBeGreaterThan(300) // a real hill, not a bump
    for (let i = lift.i0 + 1; i <= lift.i1; i++) {
      expect(P[i].y).toBeLessThan(P[i - 1].y) // gaining height (y is negative up)
      expect(P[i].x).toBeGreaterThan(P[i - 1].x) // and running right
    }
  })

  it('finds the loop: one tight stretch that turns through a whole circle', () => {
    expect(INFO.loop).not.toBeNull()
    const loop = INFO.loop!
    // Net turn of the tangent across the loop, unwrapped.
    let turn = 0
    let prev = Math.atan2(P[loop.i0 + 1].y - P[loop.i0].y, P[loop.i0 + 1].x - P[loop.i0].x)
    for (let i = loop.i0 + 1; i < loop.i1; i++) {
      const a = Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x)
      let d = a - prev
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      turn += d
      prev = a
    }
    expect(Math.abs(turn)).toBeGreaterThan(Math.PI * 1.9)
    // It is a loop, not a lap: a small share of the circuit.
    expect(loop.to - loop.from).toBeLessThan(TOTAL * 0.35)
    // And it is somewhere after the lift — the ride does not invert on the chain.
    expect(loop.from).toBeGreaterThan(INFO.lift!.to)
  })

  it('names the zone under the cart', () => {
    expect(zoneAt(P, TABLE, 0)).toBe('station')
    expect(zoneAt(P, TABLE, TOTAL)).toBe('station')
    expect(zoneAt(P, TABLE, (INFO.lift!.from + INFO.lift!.to) / 2)).toBe('lift')
    expect(zoneAt(P, TABLE, (INFO.loop!.from + INFO.loop!.to) / 2)).toBe('loop')
    // The first drop starts at the apex and is the steepest thing on the ride.
    const drops = walk(4).filter((s) => zoneAt(P, TABLE, s) === 'drop')
    expect(drops.length).toBeGreaterThan(0)
    expect(Math.min(...drops)).toBeGreaterThan(INFO.lift!.to)
  })

  it('ends every zone at its core, so a cue cannot fire inside the next one', () => {
    // Zones are what the runner plays sounds off. A zone that carried its speed
    // blend with it would still be "lift" a hundred and forty pixels down the first
    // drop, where the cart is doing four hundred and something.
    const apex = TABLE[INFO.apex]
    expect(INFO.lift!.to).toBeCloseTo(apex, 6)
    for (let s = apex + 0.5; s <= TOTAL; s += 2) expect(zoneAt(P, TABLE, s)).not.toBe('lift')
    for (let s = INFO.loop!.to + 0.5; s <= TOTAL; s += 2) expect(zoneAt(P, TABLE, s)).not.toBe('loop')
    // The chain itself is still the chain right up to the crest.
    expect(zoneAt(P, TABLE, apex - 1)).toBe('lift')
  })
})

describe('ridepath — the speed profile', () => {
  it('never leaves [STOP_SPEED, DROP_MAX], anywhere, with or without stops', () => {
    for (const s of walk(1)) {
      const v = speedAt(P, TABLE, s, OPTS)
      expect(v).toBeGreaterThanOrEqual(STOP_SPEED)
      expect(v).toBeLessThanOrEqual(DROP_MAX)
      const bare = speedAt(P, TABLE, s)
      expect(bare).toBeGreaterThanOrEqual(STOP_SPEED)
      expect(bare).toBeLessThanOrEqual(DROP_MAX)
    }
  })

  it('clamps outside the circuit', () => {
    expect(speedAt(P, TABLE, -100, OPTS)).toBeGreaterThanOrEqual(STOP_SPEED)
    expect(speedAt(P, TABLE, TOTAL + 100, OPTS)).toBeLessThanOrEqual(STATION_SPEED)
  })

  it('crawls up the chain at LIFT_SPEED', () => {
    const lift = INFO.lift!
    let sampled = 0
    for (let s = lift.from; s <= lift.to; s += 2) {
      if (!clearOfStops(s)) continue // braking for a milestone card
      expect(speedAt(P, TABLE, s, OPTS)).toBeCloseTo(LIFT_SPEED, 6)
      sampled++
    }
    expect(sampled).toBeGreaterThan(30)
  })

  it('holds LOOP_SPEED through the inversion', () => {
    const loop = INFO.loop!
    let sampled = 0
    for (let s = loop.from; s <= loop.to; s += 2) {
      if (!clearOfStops(s)) continue
      expect(speedAt(P, TABLE, s, OPTS)).toBeCloseTo(LOOP_SPEED, 6)
      sampled++
    }
    expect(sampled).toBeGreaterThan(30)
  })

  it('opens the throttle on the drops, scaled by how steep they are', () => {
    // On open track — no chain, no loop, no platform — the speed *is* the slope:
    // level cruises and straight down would be DROP_MAX. The steepest fall on this
    // profile is the far side of the loop, which the loop governs instead, so the
    // fastest the cart ever goes is the first drop's own gradient.
    let fastest = 0
    let steepestOpen = 0
    for (const s of walk(1)) {
      fastest = Math.max(fastest, speedAt(P, TABLE, s))
      if (zoneAt(P, TABLE, s) === 'drop') steepestOpen = Math.max(steepestOpen, sampleAt(P, TABLE, s).dy)
    }
    expect(steepestOpen).toBeGreaterThan(DROP_SLOPE)
    const open = CRUISE_SPEED + (DROP_MAX - CRUISE_SPEED) * steepestOpen
    expect(fastest).toBeLessThanOrEqual(open + 1e-6)
    expect(fastest).toBeGreaterThan(open * 0.95)
    expect(fastest).toBeGreaterThan(CRUISE_SPEED * 1.5) // it is a drop, not a slope
    expect(fastest).toBeLessThanOrEqual(DROP_MAX)
  })

  it('never runs faster than STATION_SPEED over the brake run at either end', () => {
    // The platform yields to the chain and the loop (see `trackInfo`), so its
    // extent is reported rather than assumed — but it must still be a run worth
    // braking over, and it must reach both ends of the circuit.
    expect(INFO.stationOut.to).toBeCloseTo(TOTAL, 6)
    expect(INFO.stationIn.from).toBe(0)
    expect(INFO.stationOut.to - INFO.stationOut.from).toBeGreaterThan(100)
    expect(INFO.stationIn.to - INFO.stationIn.from).toBeGreaterThan(100)
    for (let s = INFO.stationOut.from; s <= TOTAL; s += 1) expect(speedAt(P, TABLE, s, OPTS)).toBeLessThanOrEqual(STATION_SPEED + 1e-9)
    for (let s = 0; s <= INFO.stationIn.to; s += 1) expect(speedAt(P, TABLE, s, OPTS)).toBeLessThanOrEqual(STATION_SPEED + 1e-9)
    // On this profile nothing pushes the platform back, so it is the full run.
    expect(INFO.stationOut.from).toBeCloseTo(TOTAL - STATION_RUN, 6)
  })

  it('lets the cart out of the loop at speed — the brake run starts after it', () => {
    // The platform's blend used to reach back into the inversion, so the best
    // second of the ride was spent slowing down inside it. Its approach now has to
    // clear the loop by STATION_CLEAR before it may touch the throttle.
    expect(INFO.loop).not.toBeNull()
    expect(INFO.stationOut.from - INFO.stationOut.blend).toBeGreaterThanOrEqual(INFO.loop!.to + STATION_CLEAR - 1e-9)
    expect(speedAt(P, TABLE, INFO.loop!.to, OPTS)).toBeGreaterThanOrEqual(250)
    // …and it is still a brake run: the platform's own speed is exactly the
    // approach speed from end to end (the last two cards then brake below it).
    expect(INFO.stationOut.blend).toBeGreaterThan(0)
    for (let s = INFO.stationOut.from; s <= TOTAL; s += 1) expect(speedAt(P, TABLE, s)).toBeCloseTo(STATION_SPEED, 6)
  })

  it('labours up an unpowered climb without ever stalling', () => {
    // The camelback is climbed on momentum, not on a chain: slower than the
    // cruise, faster than the crawl.
    const climbs = walk(2).filter((s) => sampleAt(P, TABLE, s).dy < -0.6 && openTrack(s))
    expect(climbs.length).toBeGreaterThan(10)
    for (const s of climbs) {
      const v = speedAt(P, TABLE, s, OPTS)
      expect(v).toBeGreaterThanOrEqual(CLIMB_SPEED - 1e-9)
      expect(v).toBeLessThan(CRUISE_SPEED)
    }
  })

  it('changes speed smoothly — no step a cart could not physically take', () => {
    let prev = speedAt(P, TABLE, 0, OPTS)
    for (let s = 1; s <= TOTAL; s += 1) {
      const v = speedAt(P, TABLE, s, OPTS)
      expect(Math.abs(v - prev)).toBeLessThan(12) // px/s per px of track
      prev = v
    }
  })
})

describe('ridepath — the résumé beats', () => {
  it('gives every stop an arc position, in path order', () => {
    expect(STOP_S).toHaveLength(COASTER_STOPS.length)
    for (let i = 1; i < STOP_S.length; i++) expect(STOP_S[i]).toBeGreaterThan(STOP_S[i - 1])
  })

  it('detects each stop’s window, and only within STOP_RADIUS of it', () => {
    for (let i = 0; i < COASTER_STOPS.length; i++) {
      const s = STOP_S[i]
      expect(stopWindow(COASTER_STOPS, TABLE, s)).toBe(i)
      expect(stopWindow(COASTER_STOPS, TABLE, s + STOP_RADIUS * 0.5)).toBe(i)
      expect(stopWindow(COASTER_STOPS, TABLE, s - STOP_RADIUS * 0.5)).toBe(i)
      expect(stopWindow(COASTER_STOPS, TABLE, s + STOP_RADIUS * 2)).not.toBe(i)
    }
  })

  it('reports no window on open track', () => {
    const open = walk(4).filter((s) => distToStop(s) > STOP_RADIUS * 4)
    expect(open.length).toBeGreaterThan(100)
    for (const s of open) expect(stopWindow(COASTER_STOPS, TABLE, s)).toBe(-1)
  })

  it('slows to STOP_SPEED across every beat’s whole window, so the card can be read', () => {
    for (const s of STOP_S)
      for (let d = -STOP_RADIUS; d <= STOP_RADIUS; d += 1) expect(speedAt(P, TABLE, s + d, OPTS)).toBeCloseTo(STOP_SPEED, 6)
  })

  it('does not slow down for stops it was not told about', () => {
    // The brake belongs to the caller's stop list, not to the geometry: a runner
    // that wants an uninterrupted ride simply passes none.
    const mid = STOP_S[2]
    expect(speedAt(P, TABLE, mid)).toBeGreaterThan(STOP_SPEED)
  })
})

describe('ridepath — a whole ride', () => {
  /**
   * The runner's loop, mirrored: fixed 120Hz steps and the same cue rule
   * `Coaster.cues` uses — silent inside a beat's window, one whoosh per entry
   * into a drop. `Coaster.ts` needs a canvas, so this is where the timing of its
   * sounds can be pinned.
   *
   * `holdMs` is the one liberty taken. The real cart waits at each beat until the
   * rider presses Next, which is not a number at all; a nominal dwell stands in
   * for it here so the *path* can still be timed — everything below is about how
   * long the track takes, not how long the reading does.
   */
  function simulate(holdMs = STOP_HOLD_MS) {
    const STEP = 1 / 120
    let s = 0
    let t = 0
    let hold = 0
    let next = 0
    let lastZone = 'station'
    const seen: number[] = []
    const cards: number[] = []
    const cues: { s: number; t: number; v: number }[] = []
    let guard = 0
    while (s < TOTAL && guard++ < 200_000) {
      t += STEP
      if (hold > 0) {
        hold -= STEP * 1000
        continue
      }
      s += speedAt(P, TABLE, s, OPTS) * STEP
      if (next < STOP_S.length && s >= STOP_S[next]) {
        s = STOP_S[next]
        seen.push(next)
        cards.push(t)
        hold = holdMs
        next++
      }
      if (stopWindow(COASTER_STOPS, TABLE, s) >= 0) continue
      const zone = zoneAt(P, TABLE, s)
      if (zone === 'drop' && lastZone !== 'drop') cues.push({ s, t, v: speedAt(P, TABLE, s, OPTS) })
      lastZone = zone
    }
    return { seconds: t, seen, cards, cues, s, guard }
  }

  it('gets home, passing every beat once and in order', () => {
    const r = simulate()
    expect(r.s).toBeGreaterThanOrEqual(TOTAL)
    expect(r.seen).toEqual(COASTER_STOPS.map((_, i) => i))
  })

  it('takes long enough to be a ride and short enough to sit through', () => {
    const full = simulate()
    expect(full.seconds).toBeGreaterThan(15)
    expect(full.seconds).toBeLessThan(90)
    // Reduced motion shortens the card holds; the ride itself is the content and
    // still runs, so it can only be shorter.
    const reduced = simulate(900)
    expect(reduced.seconds).toBeLessThan(full.seconds)
    expect(reduced.seconds).toBeLessThan(90)
  })

  it('says its first word within a few seconds of leaving the platform', () => {
    // The first beat is the degree, pinned to the foot of the chain: a rider who
    // has been given nothing to read for a quarter of a minute has already decided
    // the ride is broken.
    const r = simulate()
    expect(r.cards[0]).toBeLessThan(9)
    expect(r.cards[0]).toBeGreaterThan(1)
  })

  it('fires each drop cue at the crest, never inside a beat’s window', () => {
    const r = simulate()
    expect(r.cues.length).toBeGreaterThanOrEqual(2)
    // The lift's cue territory ends at the apex; the first whoosh belongs just
    // over it, while the cart is still slow, not a second down the plunge.
    const apex = TABLE[INFO.apex]
    expect(r.cues[0].s).toBeGreaterThan(apex)
    expect(r.cues[0].s - apex).toBeLessThan(60)
    expect(r.cues[0].v).toBeLessThanOrEqual(LIFT_SPEED * 1.5)
    // …and none of them lands while the cart is crawling past a card.
    for (const c of r.cues) expect(stopWindow(COASTER_STOPS, TABLE, c.s)).toBe(-1)
  })

  it('never overshoots a beat by more than a pixel at 120Hz', () => {
    // The cards must land *at* the milestone, not a cart-length past it.
    const STEP = 1 / 120
    for (const s of STOP_S) {
      const before = s - 0.5
      expect(speedAt(P, TABLE, before, OPTS) * STEP).toBeLessThan(1)
    }
  })
})

describe('ridepath — purity', () => {
  it('touches neither Phaser nor the DOM', () => {
    // The ride's whole brain has to run in a plain node test. Anything the module
    // reaches for below would drag a canvas (or a browser) in behind it.
    const src = readFileSync(new URL('../src/systems/ridepath.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from\s+'[^']*phaser'/i)
    expect(src).not.toMatch(/\bwindow\s*\./)
    expect(src).not.toMatch(/\b(?:document|globalThis|localStorage|performance)\s*\./)
    expect(src).not.toMatch(/\brequestAnimationFrame\b/)
    expect(src).not.toMatch(/\bDate\.now\b/)
  })
})
