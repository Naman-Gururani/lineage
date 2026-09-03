// The Career Coaster, as maths: an arc-length sampler over the drawn profile and
// the speed profile the cart rides it with.
//
// This module is pure — no Phaser, no DOM, no time. Everything the ride decides
// that can be decided from geometry alone is decided here, so `systems/Coaster.ts`
// is left with nothing but "draw the cart, play the sound, hold the card" and the
// whole ride can be reasoned about (and tested) without a canvas.
//
// Two rules shape it.
//
// **Arc length, not indices.** `data/coaster.ts` resamples the profile every 20px,
// but nothing here assumes that: the cart's position is a distance travelled
// along the polyline, so the runner integrates `s += speed(s) * dt` at a fixed
// step and interpolates between steps. Redraw the track at any spacing and the
// ride still runs.
//
// **Geometry, not hand-typed indices.** The chain lift is "the sustained climb
// that reaches the highest point on the ride"; the loop is "the one tight stretch
// whose tangent turns through a whole circle"; the station is the flat at each end
// of the circuit. Task 3 can move the profile under this file and the ride keeps
// its shape: slow up the hill, fast down the drop, steady round the loop, gentle
// into the platform.
import type { Vec2 } from '../world/regions'

/* ------------------------------------------------------------------ *
 * the profile's speeds (px/s along the track), spec §4
 * ------------------------------------------------------------------ */

/** The chain drags the train up the hill at walking pace. */
export const LIFT_SPEED = 60
/** The fastest the cart may ever travel — the bottom of a vertical drop. */
export const DROP_MAX = 520
/** A loop is taken at speed or not at all. */
export const LOOP_SPEED = 380
/** The brake run at each end of the circuit. */
export const STATION_SPEED = 120
/**
 * The crawl past a résumé beat — and the floor of the whole profile, because
 * nothing on this ride is ever slower than reading pace.
 */
export const STOP_SPEED = 40
/**
 * A nominal dwell at a beat, in ms. The runner does *not* use it: the cart waits
 * at each beat until the rider presses Next (`systems/Coaster.ts`), so the real
 * hold is however long somebody spends reading. This is what the path's own
 * pacing test rides with, so "long enough to be a ride, short enough to sit
 * through" still has a number to be measured against.
 */
export const STOP_HOLD_MS = 1600

/**
 * Free-running speed on flat track. The long transfer run back to the lift is a
 * thousand pixels of nothing much, and at a gentler cruise it swallowed a second
 * of the wait before the ride's first card: this is the fastest the flat can be
 * taken without the drops losing their edge over it.
 */
export const CRUISE_SPEED = 300
/** …and the slowest a *chainless* climb gets before the crest lets go. */
export const CLIMB_SPEED = 90

/** How near a beat the cart has to be for the runner to call it arrived. */
export const STOP_RADIUS = 8
/** Braking distance either side of a beat: the cart eases down, it never snaps. */
export const STOP_BRAKE = 90
/** How much of each end of the circuit is platform. */
export const STATION_RUN = 240
/** …and how far before that the cart starts braking for it. */
export const STATION_BLEND = 150
/**
 * Clear air the platform's brake run must leave after the chain and the loop.
 * Without it the blend reaches back into the inversion and the cart leaves the
 * loop already slowing, which is the one second of the ride that must not be
 * given away.
 */
export const STATION_CLEAR = 40
/** Run-out either side of the chain and the loop, so speed changes are ridden. */
export const LIFT_BLEND = 140
export const LOOP_BLEND = 90
/** A descent this steep (unit tangent, y down) reads as a drop: whoosh, shake. */
export const DROP_SLOPE = 0.35
/** Net turn that makes a stretch of track a loop rather than a bend. */
const LOOP_TURN = Math.PI * 1.95
/** …and the longest share of the circuit a loop may occupy. */
const LOOP_SHARE = 0.35

/* ------------------------------------------------------------------ *
 * types
 * ------------------------------------------------------------------ */

/** All the runner needs of a `COASTER_STOPS` entry: which path point it sits on. */
export type StopLike = { at: number }

/** Position and unit tangent at some arc length, plus the segment it fell in. */
export type Sample = { x: number; y: number; dx: number; dy: number; index: number }

/**
 * A stretch of the circuit, as both path indices and arc lengths, plus the
 * run-out over which it hands its speed back to the open track. The blend is per
 * span rather than a global constant because the platform's has to be clipped:
 * see `trackInfo`.
 */
export type Span = { i0: number; i1: number; from: number; to: number; blend: number }

/** What the cart is on right now — the runner picks its sound and shake from this. */
export type RideZone = 'station' | 'lift' | 'loop' | 'drop' | 'run'

export type TrackInfo = {
  /** Total arc length of the circuit. */
  total: number
  /** Path index of the highest point on the ride (y is negative up). */
  apex: number
  /** The chain lift: the climb that reaches the apex, or null if there is none. */
  lift: Span | null
  /** The inversion, or null if the profile has no loop in it. */
  loop: Span | null
  /** The platform the ride leaves from, and the brake run it comes home on. */
  stationIn: Span
  stationOut: Span
  /** Unit tangent at each drawn point (averaged across the two adjacent segments). */
  tangents: Vec2[]
}

export type SpeedOpts = {
  /** The résumé beats to brake for. Omit them and the cart rides straight through. */
  stops?: readonly StopLike[]
}

/* ------------------------------------------------------------------ *
 * small maths
 * ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const mix = (a: number, b: number, t: number): number => a + (b - a) * t
/** Smoothstep — C1 at both ends, so a blended speed has no corner in it. */
const smooth = (t: number): number => {
  const u = clamp(t, 0, 1)
  return u * u * (3 - 2 * u)
}

/**
 * 1 inside `[from, to]`, easing to 0 over `blend` px either side.
 *
 * Every named stretch of the ride is applied through this: inside its own span it
 * *is* its speed, and outside it hands back over to whatever it interrupted.
 */
function weight(s: number, from: number, to: number, blend: number): number {
  if (s >= from && s <= to) return 1
  if (blend <= 0) return 0
  const d = s < from ? from - s : s - to
  return d >= blend ? 0 : smooth(1 - d / blend)
}

/* ------------------------------------------------------------------ *
 * arc length
 * ------------------------------------------------------------------ */

/**
 * Cumulative distance along the polyline: `table[i]` is how far point `i` is from
 * the start. Monotone by construction, and `table[n-1]` is the circuit's length.
 */
export function buildArcTable(path: readonly Vec2[]): number[] {
  const out: number[] = []
  if (!path.length) return out
  out.push(0)
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y))
  return out
}

/** Largest `i` with `table[i] <= s` (and `i < n-1`), by binary search. */
function segmentAt(table: readonly number[], s: number): number {
  let lo = 0
  let hi = table.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (table[mid] <= s) lo = mid
    else hi = mid - 1
  }
  return lo
}

/* ------------------------------------------------------------------ *
 * the track, read once
 * ------------------------------------------------------------------ */

const CACHE = new WeakMap<readonly Vec2[], TrackInfo>()

/**
 * Unit tangent at each point, as a central difference across `TANGENT_SPAN`
 * samples either side.
 *
 * The obvious tangent — the segment the cart is on — snaps: the resampled profile
 * has three places (the first drop's valley, the loop's entry, the last bunny hop)
 * where the drawn direction swings more than forty degrees between one 20px sample
 * and the next, and a sprite rotated to that visibly flicks round. A central
 * difference is exact on a circular arc (both halves of the chord subtend the same
 * angle) so it costs nothing through the loop and the hairpin, and it turns those
 * three corners into a lean.
 */
const TANGENT_SPAN = 2

function buildTangents(path: readonly Vec2[]): Vec2[] {
  const n = path.length
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - TANGENT_SPAN)]
    const b = path[Math.min(n - 1, i + TANGENT_SPAN)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const m = Math.hypot(dx, dy)
    out.push(m > 1e-9 ? { x: dx / m, y: dy / m } : { x: 1, y: 0 })
  }
  return out
}

/** Tangent angles, unwrapped so the running total is the track's turning. */
function headings(path: readonly Vec2[]): number[] {
  const out: number[] = []
  let prev = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = Math.atan2(path[i + 1].y - path[i].y, path[i + 1].x - path[i].x)
    if (i === 0) prev = a
    else {
      let d = a - prev
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      prev += d
    }
    out.push(prev)
  }
  return out
}

/**
 * The loop: the tightest stretch whose tangent turns through very nearly a whole
 * circle. That is what makes a loop a loop, and it is the one thing on the
 * profile a hairpin (half a turn) or a camelback (a lot less) cannot fake.
 */
function findLoop(path: readonly Vec2[], table: readonly number[]): Span | null {
  const h = headings(path)
  if (h.length < 3) return null
  const total = table[table.length - 1]
  let best: Span | null = null
  for (let i = 0; i < h.length; i++) {
    for (let j = i + 1; j < h.length; j++) {
      if (Math.abs(h[j] - h[i]) < LOOP_TURN) continue
      const len = table[j] - table[i]
      if (len > total * LOOP_SHARE) break
      if (!best || len < best.to - best.from) best = { i0: i, i1: j, from: table[i], to: table[j], blend: LOOP_BLEND }
      break // the first j that closes the circle is this i's tightest
    }
  }
  return best
}

/**
 * The chain lift: walk back from the highest point on the ride for as long as the
 * track is both gaining height and running forward across the spans. That is the
 * hill a chain would be strung along, whatever shape Task 3 draws it.
 */
function findLift(path: readonly Vec2[], table: readonly number[], apex: number): Span | null {
  let i = apex
  while (i > 0 && path[i].y < path[i - 1].y && path[i].x > path[i - 1].x) i--
  if (i >= apex) return null
  return { i0: i, i1: apex, from: table[i], to: table[apex], blend: LIFT_BLEND }
}

/**
 * Everything the profile is built from, worked out once per path and cached on the
 * array itself (the path is a module constant, so this runs a single time).
 */
export function trackInfo(path: readonly Vec2[], table: readonly number[]): TrackInfo {
  const hit = CACHE.get(path)
  if (hit) return hit
  const n = path.length
  const total = n ? table[n - 1] : 0
  let apex = 0
  for (let i = 1; i < n; i++) if (path[i].y < path[apex].y) apex = i
  const lift = n > 2 ? findLift(path, table, apex) : null
  let loop = n > 2 ? findLoop(path, table) : null
  // Hardware does not overlap: a "loop" that ran into the chain would be the
  // hairpin at the foot of the hill read twice.
  if (loop && lift && loop.from < lift.to && loop.to > lift.from) loop = null

  // The platform is the flat at each end of the circuit — but it yields to the
  // chain and the loop, blend included, so a profile whose loop exits close to
  // the station does not have its inversion braked away.
  const busyOut = Math.max(lift ? lift.to + LIFT_BLEND : 0, loop ? loop.to + LOOP_BLEND : 0)
  const busyIn = Math.min(lift ? lift.from - LIFT_BLEND : total, loop ? loop.from - LOOP_BLEND : total)
  const stationIn: Span = { i0: 0, i1: 0, from: 0, to: clamp(Math.min(STATION_RUN, busyIn), 0, total), blend: STATION_BLEND }
  const stationOut: Span = {
    i0: 0,
    i1: Math.max(0, n - 1),
    from: clamp(Math.max(total - STATION_RUN, busyOut), 0, total),
    to: total,
    blend: STATION_BLEND,
  }
  // …and the brake run's *approach* is clipped too, not just its core. A blend
  // that started inside the loop's tail would have the cart leaving the inversion
  // already slowing — the one second of this ride that has to arrive at speed.
  const clearOut = Math.max(loop ? loop.to + STATION_CLEAR : 0, lift ? lift.to + STATION_CLEAR : 0)
  const clearIn = Math.min(loop ? loop.from - STATION_CLEAR : total, lift ? lift.from - STATION_CLEAR : total)
  stationOut.blend = clamp(stationOut.from - clearOut, 0, STATION_BLEND)
  stationIn.blend = clamp(clearIn - stationIn.to, 0, STATION_BLEND)
  stationIn.i1 = n ? segmentAt(table, stationIn.to) : 0
  stationOut.i0 = n ? segmentAt(table, stationOut.from) : 0

  const info: TrackInfo = { total, apex, lift, loop, stationIn, stationOut, tangents: buildTangents(path) }
  CACHE.set(path, info)
  return info
}

/* ------------------------------------------------------------------ *
 * sampling
 * ------------------------------------------------------------------ */

/**
 * Where the cart is `s` px into the circuit, and which way it is pointing.
 *
 * The tangent is interpolated between the two neighbouring points' tangents, not
 * taken from the segment: a sprite rotated to a per-segment tangent visibly snaps
 * round every 20px, and this ride spends its best seconds inside a loop.
 */
export function sampleAt(path: readonly Vec2[], table: readonly number[], s: number): Sample {
  const n = path.length
  if (!n) return { x: 0, y: 0, dx: 1, dy: 0, index: 0 }
  if (n === 1) return { x: path[0].x, y: path[0].y, dx: 1, dy: 0, index: 0 }
  const info = trackInfo(path, table)
  const cs = clamp(s, 0, info.total)
  const i = segmentAt(table, cs)
  const span = table[i + 1] - table[i]
  const u = span > 1e-9 ? clamp((cs - table[i]) / span, 0, 1) : 0
  const a = path[i]
  const b = path[i + 1]
  const ta = info.tangents[i]
  const tb = info.tangents[i + 1]
  let dx = mix(ta.x, tb.x, u)
  let dy = mix(ta.y, tb.y, u)
  let m = Math.hypot(dx, dy)
  if (m < 1e-6) {
    // Two opposed tangents cancelled: fall back to the segment's own direction.
    dx = b.x - a.x
    dy = b.y - a.y
    m = Math.hypot(dx, dy) || 1
  }
  return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), dx: dx / m, dy: dy / m, index: i }
}

/* ------------------------------------------------------------------ *
 * the beats
 * ------------------------------------------------------------------ */

/** Where each résumé beat sits, as an arc length. */
export function stopArcs(stops: readonly StopLike[], table: readonly number[]): number[] {
  if (!table.length) return stops.map(() => 0)
  return stops.map((s) => table[clamp(Math.round(s.at), 0, table.length - 1)])
}

/**
 * Which beat the cart has reached, or -1 between them. The runner uses this to
 * raise the milestone card; the profile uses the same arc positions to brake.
 */
export function stopWindow(stops: readonly StopLike[], table: readonly number[], s: number, radius = STOP_RADIUS): number {
  const arcs = stopArcs(stops, table)
  let best = -1
  let bestD = radius
  for (let i = 0; i < arcs.length; i++) {
    const d = Math.abs(arcs[i] - s)
    if (d <= bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/* ------------------------------------------------------------------ *
 * the speed profile
 * ------------------------------------------------------------------ */

/** A span's influence at `s`: 1 inside it, easing out over its own blend. */
const spanWeight = (s: number, span: Span): number => weight(s, span.from, span.to, span.blend)

/** Free-running speed from the slope alone: steeper down is faster, up is slower. */
function coast(dy: number): number {
  return dy >= 0 ? mix(CRUISE_SPEED, DROP_MAX, clamp(dy, 0, 1)) : mix(CRUISE_SPEED, CLIMB_SPEED, clamp(-dy, 0, 1))
}

/**
 * How fast the cart is travelling `s` px into the circuit.
 *
 * Each named stretch of hardware is laid over the free-running slope speed in turn
 * — the platform, then the loop, then the chain, then the beats — so the most
 * specific thing under the cart wins, and each hands over across a blend rather
 * than a step. The result is continuous everywhere, which is what lets the runner
 * integrate it directly without a second smoothing pass.
 */
export function speedAt(path: readonly Vec2[], table: readonly number[], s: number, opts: SpeedOpts = {}): number {
  const n = path.length
  if (n < 2) return CRUISE_SPEED
  const info = trackInfo(path, table)
  if (info.total <= 0) return CRUISE_SPEED
  const cs = clamp(s, 0, info.total)
  let v = coast(sampleAt(path, table, cs).dy)
  const platform = Math.max(spanWeight(cs, info.stationIn), spanWeight(cs, info.stationOut))
  v = mix(v, STATION_SPEED, platform)
  if (info.loop) v = mix(v, LOOP_SPEED, spanWeight(cs, info.loop))
  if (info.lift) v = mix(v, LIFT_SPEED, spanWeight(cs, info.lift))
  const stops = opts.stops
  if (stops?.length) {
    const arcs = stopArcs(stops, table)
    let brake = 0
    for (const at of arcs) brake = Math.max(brake, weight(cs, at - STOP_RADIUS, at + STOP_RADIUS, STOP_BRAKE))
    v = mix(v, STOP_SPEED, brake)
  }
  return clamp(v, STOP_SPEED, DROP_MAX)
}

/**
 * What the cart is riding right now. The runner reads this for its cues: clicks on
 * the chain, a whoosh and a shake the moment a drop begins.
 *
 * Every zone is its *core*, blend excluded — a blend is how a speed hands over,
 * not how far the hardware reaches. Testing the chain with its run-out included
 * used to call the first hundred and forty pixels of the first drop "lift", so the
 * clicks kept ticking a second into the plunge and the whoosh, the shake and the
 * hands-up frame all arrived at the bottom of it instead of the crest.
 */
export function zoneAt(path: readonly Vec2[], table: readonly number[], s: number): RideZone {
  const n = path.length
  if (n < 2) return 'station'
  const info = trackInfo(path, table)
  const cs = clamp(s, 0, info.total)
  if (info.lift && weight(cs, info.lift.from, info.lift.to, 0) > 0) return 'lift'
  if (info.loop && weight(cs, info.loop.from, info.loop.to, 0) > 0) return 'loop'
  if (
    weight(cs, info.stationIn.from, info.stationIn.to, 0) > 0 ||
    weight(cs, info.stationOut.from, info.stationOut.to, 0) > 0
  )
    return 'station'
  return sampleAt(path, table, cs).dy > DROP_SLOPE ? 'drop' : 'run'
}
