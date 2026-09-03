// The Career Coaster — its drawn profile and the five résumé beats it rides past.
//
// This module is the ONE description of the ride's geometry. `art/sprites/rides.ts`
// lays the rails of `coaster_span_0..2` along COASTER_PATH, and the Phaser runner
// (`systems/Coaster.ts`) drives the cart along the same polyline, so the cart can
// never leave the track: there is no second copy of the profile to fall out of
// step with the first.
//
// Coordinate frame: pixels relative to COASTER_ORIGIN — the world tile of the
// structure's left-bottom corner. `x` runs right across the three 512px spans
// (0…1536) and `y` runs UP as a negative number (0 = the spans' foot, −320 = the
// top of the sprite). Nothing here knows about tiles, Phaser or the DOM.
//
// The circuit, in travel order:
//   station (right) → the transfer track running left along the ground →
//   a hairpin turnaround at the far left → the lift hill climbing right →
//   the first drop → a camelback → the vertical loop → the final run →
//   the brake run back into the station.
// It closes: the last point is the first point, because a train stops where it
// boarded.
//
// Copy rule (spec §4): every kicker, title and line is *cut* from
// `data/content.ts`. Nothing is retyped here — that is what keeps the résumé
// honest, and `tests/coaster.test.ts` asserts each string is a substring of a
// content string or a formatting of a content fact.
import type { Vec2 } from '../world/regions'
import { ZONES, type Content } from './content'

/** World tile of the structure's left-bottom corner (spans occupy x 12…59, y 6…15). */
export const COASTER_ORIGIN = { tx: 12, ty: 16 }

/** Width of one `coaster_span_*` sprite, and how many there are. */
const SPAN_W = 512
const SPAN_COUNT = 3
/** The drawn box the profile has to stay inside. */
const MAX_X = SPAN_W * SPAN_COUNT
const MAX_UP = 320

/* ------------------------------------------------------------------ *
 * profile primitives
 *
 * The profile is built as a dense polyline and then resampled at even arc
 * length, so `COASTER_PATH[i]` steps are all the same size: a runner can walk
 * it by index and get constant speed for free, and the rails drawn between
 * consecutive points never cut a visible corner (the loop's sagitta at this
 * spacing is under a pixel).
 * ------------------------------------------------------------------ */

/** A profile knot: a point plus the slope dy/dx the track holds through it. */
type Knot = { x: number; y: number; s: number }

const pt = (x: number, y: number): Vec2 => ({ x, y })

/** Cubic-Hermite ride between two knots — C1 by construction, so no kinks. */
function hermite(a: Knot, b: Knot, out: Vec2[], step = 1): void {
  const dx = b.x - a.x
  const m0 = dx * a.s
  const m1 = dx * b.s
  const n = Math.max(2, Math.ceil(Math.abs(dx) / step))
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    out.push(pt(a.x + dx * t, h00 * a.y + h10 * m0 + h01 * b.y + h11 * m1))
  }
}

/** Chain of Hermite spans through a knot list (each knot's slope is shared). */
function ride(knots: Knot[], out: Vec2[]): void {
  for (let i = 1; i < knots.length; i++) hermite(knots[i - 1], knots[i], out)
}

/**
 * Elliptical arc with a linear drift along x — the shape of both the hairpin
 * (drift 0) and the vertical loop, whose exit sits downstream of its entry the
 * way a real loop's does.
 */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, drift: number, out: Vec2[]): void {
  const n = 180
  for (let i = 1; i <= n; i++) {
    const u = i / n
    const a = a0 + (a1 - a0) * u
    out.push(pt(cx + rx * Math.cos(a) + drift * u, cy + ry * Math.sin(a)))
  }
}

const RAD = Math.PI / 180

/* ------------------------------------------------------------------ *
 * the profile itself
 * ------------------------------------------------------------------ */

/** Platform deck height, and the ground-level transfer track that feeds the lift. */
const DECK = -46
const LOW = -24
/** Where the train sits to board — under the station attraction at tiles (48,16,6,4). */
const BOARD = { x: 1290, y: DECK }
/** Hairpin turnaround at the far left: the only way a front-facing circuit can turn round. */
const TURN = { cx: 110, cy: -64, r: 40 }
/** The vertical loop: taller than it is wide, and lower than the lift crest. */
const LOOP = { cx: 985, cy: -174, rx: 84, ry: 104, drift: 96 }

function buildProfile(): Vec2[] {
  const p: Vec2[] = [pt(BOARD.x, BOARD.y)]

  // 1 · out of the station, running LEFT, easing down onto the transfer track
  ride(
    [
      { x: BOARD.x, y: DECK, s: 0 },
      { x: 1240, y: DECK, s: 0 },
      { x: 1140, y: LOW, s: 0 },
      { x: TURN.cx + TURN.r, y: LOW, s: 0 },
    ],
    p,
  )

  // 2 · the hairpin: in low moving left, up round the outside, out high moving right
  arc(TURN.cx, TURN.cy, TURN.r, TURN.r, 90 * RAD, 270 * RAD, 0, p)

  // 3 · the lift hill, the first drop, the camelback — knots carry the slope
  ride(
    [
      { x: TURN.cx, y: TURN.cy - TURN.r, s: 0 }, // hairpin exit, level
      { x: 210, y: -140, s: -0.52 }, // onto the chain
      { x: 460, y: -270, s: -0.52 }, // the lift straight
      { x: 520, y: -293, s: 0 }, // crest — the highest point on the ride
      { x: 600, y: -232, s: 1.25 },
      { x: 665, y: -132, s: 1.7 }, // the steepest of the first drop
      { x: 720, y: -68, s: 0.75 },
      { x: 760, y: -56, s: 0 }, // the valley
      { x: 820, y: -158, s: -1.5 },
      { x: 880, y: -206, s: 0 }, // camelback crest
      { x: 935, y: -150, s: 1.5 },
      { x: LOOP.cx, y: LOOP.cy + LOOP.ry, s: 0 }, // level into the loop
    ],
    p,
  )

  // 4 · the loop: up the near side, over the top backwards, down and out forwards
  arc(LOOP.cx, LOOP.cy, LOOP.rx, LOOP.ry, 90 * RAD, -270 * RAD, LOOP.drift, p)

  // 5 · the final run and the brake run back into the station
  ride(
    [
      { x: LOOP.cx + LOOP.drift, y: LOOP.cy + LOOP.ry, s: 0 },
      { x: 1140, y: -104, s: 0 }, // one last bunny hop
      { x: 1200, y: -60, s: 0.55 },
      { x: 1240, y: DECK, s: 0 }, // onto the brakes
      { x: BOARD.x, y: DECK, s: 0 }, // home — the same spot it left
    ],
    p,
  )

  return p
}

/** Even-arc-length resample; `spacing` is the distance between output points. */
function resample(dense: Vec2[], spacing: number): Vec2[] {
  const out: Vec2[] = [dense[0]]
  let carry = 0
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1]
    const b = dense[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (seg <= 0) continue
    let t = spacing - carry
    while (t <= seg) {
      const u = t / seg
      out.push(pt(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u))
      t += spacing
    }
    carry = seg - (t - spacing)
  }
  const last = dense[dense.length - 1]
  const tail = out[out.length - 1]
  // Always land exactly on the boarding spot, so the circuit closes on the pixel.
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > 1) out.push(last)
  else out[out.length - 1] = last
  return out
}

const round1 = (v: number): number => Math.round(v * 10) / 10
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/**
 * The cart's centre-line, in origin-relative px, sampled every 20px of track.
 * ≈165 points over ≈3.3k px of circuit.
 */
export const COASTER_PATH: Vec2[] = resample(buildProfile(), 20).map((v) => ({
  x: round1(clamp(v.x, 0, MAX_X)),
  y: round1(clamp(v.y, -MAX_UP, 0)),
}))

/** Index of the path point nearest `target`, searching forward from `from`. */
function nearestIndex(target: Vec2, from: number): number {
  let best = from
  let bestD = Infinity
  for (let i = from; i < COASTER_PATH.length; i++) {
    const d = Math.hypot(COASTER_PATH[i].x - target.x, COASTER_PATH[i].y - target.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/* ------------------------------------------------------------------ *
 * the résumé beats
 * ------------------------------------------------------------------ */

export type Stop = { at: number; kicker: string; title: string; line: string }

const contentOf = (id: string): Content => {
  const z = ZONES.find((v) => v.id === id)
  if (!z) throw new Error(`coaster: no zone "${id}"`)
  return z.content
}
const bodyOf = (id: string): string[] => contentOf(id).body ?? []
const factOf = (id: string, k: string): string => (contentOf(id).facts ?? []).find((f) => f.k === k)?.v ?? ''

type Role = { head: string; text: string }

/**
 * The experience chapter is one body array with two roles in it, each opened by
 * a glyph headline (⭐ current, 🛠️ internship). Split them apart and drop the
 * glyph — the same cut `ui/elevator.ts` makes, re-implemented here because
 * `data/*` never imports from `ui/*`.
 */
function splitRoles(body: string[]): { sde: Role; intern: Role } {
  const isMarker = (p: string) => p.startsWith('⭐') || p.startsWith('🛠')
  const grab = (m: string): Role => {
    const i = body.findIndex((p) => p.startsWith(m))
    if (i < 0) return { head: '', text: '' }
    const head = body[i].replace(/^[^A-Za-z0-9]+/, '').trim()
    const rest: string[] = []
    for (let k = i + 1; k < body.length && !isMarker(body[k]); k++) rest.push(body[k])
    return { head, text: rest.join('\n\n').trim() }
  }
  return { sde: grab('⭐'), intern: grab('🛠') }
}

/** First four-digit year in a string: '2020 – 2024' → '2020', '… Aug 2023' → '2023'. */
const firstYear = (s: string): string => /\b(\d{4})\b/.exec(s)?.[1] ?? ''
/** A role headline without its trailing date segment: 'X · Barclays · Aug 2024 — now' → 'X · Barclays'. */
const beforeDate = (head: string): string => head.split(' · ').slice(0, -1).join(' · ')
/** The specific half of a content kicker: 'PROJECT · IN PRODUCTION' → 'IN PRODUCTION'. */
const kickerTail = (id: string): string => (contentOf(id).kicker ?? '').split(' · ').slice(-1)[0]
/** Everything before the first parenthesis: 'B.Tech CSE · SRM IST (2020–2024)' → 'B.Tech CSE · SRM IST'. */
const beforeParen = (s: string): string => {
  const i = s.indexOf(' (')
  return (i < 0 ? s : s.slice(0, i)).trim()
}

/** Split a paragraph into sentences, keeping the full stop on each. */
function sentences(s: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < s.length - 1; i++)
    if (s[i] === '.' && s[i + 1] === ' ') {
      out.push(s.slice(start, i + 1))
      start = i + 2
    }
  out.push(s.slice(start))
  return out.map((v) => v.trim()).filter(Boolean)
}
/** The first sentence — a card line has about a second and a half to be read. */
const firstSentence = (s: string): string => sentences(s)[0] ?? s
/** …trimmed again at the first em-dash aside, for the two long role paragraphs. */
const firstClause = (s: string): string => {
  const t = firstSentence(s)
  const i = t.indexOf(' — ')
  return i < 0 ? t : t.slice(0, i)
}
/** The one sentence in `s` that carries `needle` (spec §4 asks for the ~750M one). */
const sentenceWith = (s: string, needle: string): string => sentences(s).find((v) => v.includes(needle)) ?? firstSentence(s)

const ROLES = splitRoles(bodyOf('experience'))

/**
 * Five milestones in résumé order, each pinned to the piece of track that tells
 * it: the climb is the degree, the crest is the internship, the camelback is
 * the job, the loop's exit is the engine in production, the run home is what is
 * being built now.
 */
function buildStops(): Stop[] {
  const marks: { where: Vec2; kicker: string; title: string; line: string }[] = [
    {
      // The foot of the lift hill — the outside of the turnaround, where the chain
      // takes hold. The degree is the climb, so the card that names it belongs at
      // the bottom of it: pinned a third of the way up instead, the rider spent
      // thirteen seconds looking at nothing before the ride said its first word.
      where: pt(TURN.cx - TURN.r, TURN.cy),
      kicker: firstYear(factOf('education', 'Years')),
      title: beforeParen(factOf('about', 'Education')),
      line: bodyOf('education')[0],
    },
    {
      where: pt(520, -293), // the crest, where the ride hangs
      kicker: firstYear(ROLES.intern.head),
      title: beforeDate(ROLES.intern.head),
      line: firstClause(ROLES.intern.text),
    },
    {
      where: pt(880, -206), // the camelback
      kicker: firstYear(ROLES.sde.head),
      title: beforeDate(ROLES.sde.head),
      line: firstClause(ROLES.sde.text),
    },
    {
      // The last bunny hop of the final run (the knot of the same name in
      // `buildProfile`). Pinned to the loop's exit knot instead, this card braked
      // the cart the moment it came out of the inversion — the one second of the
      // ride that has to be taken at speed. Out here it lands on the run home.
      where: pt(1140, -104),
      kicker: kickerTail('lineage'),
      title: contentOf('lineage').title,
      line: sentenceWith(bodyOf('lineage')[0], '750 million'),
    },
    {
      where: pt(1240, DECK), // the brake run, coming home
      kicker: kickerTail('stealth'),
      title: contentOf('stealth').title,
      line: firstSentence(bodyOf('stealth')[0]),
    },
  ]
  const out: Stop[] = []
  let from = 1
  for (const m of marks) {
    const at = nearestIndex(m.where, from)
    out.push({ at, kicker: m.kicker, title: m.title, line: m.line })
    from = at + 1
  }
  return out
}

export const COASTER_STOPS: Stop[] = buildStops()

/**
 * The card that opens when the ride parks: the whole career in one block. It is
 * assembled, never authored — both role paragraphs with their glyph-free
 * headlines, the degree line, the education facts plus the date the current job
 * started, and the experience chips as the stack.
 */
export function careerCard(): Content {
  const exp = contentOf('experience')
  const edu = contentOf('education')
  return {
    kicker: exp.kicker,
    title: 'Career',
    sub: contentOf('about').sub,
    body: [ROLES.sde.head, ROLES.sde.text, ROLES.intern.head, ROLES.intern.text, edu.sub ?? ''].filter(Boolean),
    facts: [...(edu.facts ?? []).map((f) => ({ ...f })), { k: 'Since', v: factOf('about', 'Since') }],
    chips: [...(exp.chips ?? [])],
  }
}
