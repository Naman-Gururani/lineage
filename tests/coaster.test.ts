// The Career Coaster's drawn profile and its résumé stops.
//
// `src/data/coaster.ts` is the single source of the ride geometry: the art pack
// (`art/sprites/rides.ts`) draws its rails along COASTER_PATH and the Phaser
// runner (Task 6) samples the same polyline, so a change here moves the track
// and the cart together. These tests pin the three things that would otherwise
// drift apart: the profile stays inside the three spans, the stop copy comes
// only from `data/content.ts`, and the module stays free of Phaser/DOM so the
// ride can be reasoned about (and tested) without a canvas.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COASTER_ORIGIN, COASTER_PATH, COASTER_STOPS, careerCard, type Stop } from '../src/data/coaster'
import { ZONES, type Content, type Zone } from '../src/data/content'

/* ---------------- the drawn bounds ---------------- */

// coaster_span_0..2 are 512x320 each, laid side by side from the structure's
// left-bottom origin: x runs right, y runs up (negative).
const SPAN_W = 512
const SPANS = 3
const MAX_X = SPAN_W * SPANS // 1536
const MAX_UP = 320

const zone = (id: string): Zone => {
  const z = ZONES.find((v) => v.id === id)
  expect(z, `zone "${id}"`).toBeDefined()
  return z!
}
const factOf = (id: string, k: string): string => {
  const f = (zone(id).content.facts ?? []).find((v) => v.k === k)
  expect(f, `${id} fact "${k}"`).toBeDefined()
  return f!.v
}

/** Every string the résumé content holds, flattened — the stops' whole vocabulary. */
const CORPUS: string[] = ZONES.flatMap((z) => {
  const c = z.content
  return [
    z.name,
    z.label,
    c.kicker ?? '',
    c.title,
    c.sub ?? '',
    ...(c.body ?? []),
    ...(c.points ?? []),
    ...(c.chips ?? []),
    ...(c.facts ?? []).flatMap((f) => [f.k, f.v]),
    ...(c.groups ?? []).flatMap((g) => [g.label, ...g.items]),
    ...(c.links ?? []).flatMap((l) => [l.label, l.value]),
  ]
}).filter(Boolean)

const inContent = (s: string): boolean => CORPUS.some((c) => c.includes(s))

const len = (pts: { x: number; y: number }[]): number => {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return d
}

describe('coaster origin', () => {
  it('anchors the structure at the left-bottom tile of the span row', () => {
    // Layout table: spans sit at (12,6),(28,6),(44,6), each 16x10 tiles, so the
    // row below the last one — tile y 16 — is the structure's foot.
    expect(COASTER_ORIGIN).toEqual({ tx: 12, ty: 16 })
  })
})

describe('coaster path', () => {
  it('has enough points to sample smoothly', () => {
    expect(COASTER_PATH.length).toBeGreaterThanOrEqual(40)
  })

  it('stays inside the three spans (x right, y up-negative)', () => {
    for (const [i, p] of COASTER_PATH.entries()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), `point ${i} finite`).toBe(true)
      expect(p.x, `point ${i} x`).toBeGreaterThanOrEqual(0)
      expect(p.x, `point ${i} x`).toBeLessThanOrEqual(MAX_X)
      expect(p.y, `point ${i} y`).toBeLessThanOrEqual(0)
      expect(p.y, `point ${i} y`).toBeGreaterThanOrEqual(-MAX_UP)
    }
  })

  it('runs a circuit longer than 3000 px', () => {
    expect(len(COASTER_PATH)).toBeGreaterThan(3000)
  })

  it('closes the loop back at the station', () => {
    const a = COASTER_PATH[0]
    const b = COASTER_PATH[COASTER_PATH.length - 1]
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(64)
  })

  it('starts and ends at the station end of the structure (right-hand third)', () => {
    expect(COASTER_PATH[0].x).toBeGreaterThan(SPAN_W * 2)
    expect(COASTER_PATH[COASTER_PATH.length - 1].x).toBeGreaterThan(SPAN_W * 2)
  })

  it('climbs a lift hill in the left span and tops out above the loop', () => {
    const inSpan0 = COASTER_PATH.filter((p) => p.x < SPAN_W)
    const crest = Math.min(...inSpan0.map((p) => p.y))
    expect(crest, 'span 0 must carry the lift crest').toBeLessThan(-240)
  })

  it('is sampled evenly — no step long enough to cut a corner, and none zero-length (a duplicated point would NaN Task 6\'s tangent)', () => {
    for (let i = 1; i < COASTER_PATH.length; i++) {
      const d = Math.hypot(COASTER_PATH[i].x - COASTER_PATH[i - 1].x, COASTER_PATH[i].y - COASTER_PATH[i - 1].y)
      expect(d, `step ${i}`).toBeGreaterThan(0)
      expect(d, `step ${i}`).toBeLessThanOrEqual(24)
    }
  })
})

describe('coaster stops', () => {
  it('tells the résumé in five beats', () => {
    expect(COASTER_STOPS).toHaveLength(5)
  })

  it('indexes strictly increasing points of the path', () => {
    let prev = -1
    for (const s of COASTER_STOPS) {
      expect(Number.isInteger(s.at), `stop "${s.title}" at`).toBe(true)
      expect(s.at, `stop "${s.title}" after the previous stop`).toBeGreaterThan(prev)
      expect(s.at).toBeGreaterThanOrEqual(0)
      expect(s.at).toBeLessThan(COASTER_PATH.length)
      prev = s.at
    }
  })

  it('builds every kicker, title and line out of content strings', () => {
    for (const s of COASTER_STOPS)
      for (const [field, v] of Object.entries({ kicker: s.kicker, title: s.title, line: s.line })) {
        expect(v.length, `stop "${s.title}" ${field} is empty`).toBeGreaterThan(0)
        expect(inContent(v), `stop "${s.title}" ${field} "${v}" is not built from data/content.ts`).toBe(true)
      }
  })

  /* --- the five beats, each pinned to the content it is cut from --- */

  const at = (i: number): Stop => COASTER_STOPS[i]

  it('1 · the degree begins, from the education facts', () => {
    const s = at(0)
    expect(s.kicker).toBe('2020')
    expect(factOf('education', 'Years').startsWith(s.kicker)).toBe(true)
    expect(s.title).toContain('B.Tech CSE')
    expect(s.title).toContain('SRM IST')
    expect(factOf('about', 'Education')).toContain(s.title)
    expect(s.line).toBe((zone('education').content.body ?? [])[0])
  })

  it('2 · the internship, from the wrench paragraph', () => {
    const s = at(1)
    const body = zone('experience').content.body ?? []
    expect(s.kicker).toBe('2023')
    expect(s.title).toContain('DevOps Intern')
    expect(s.title).toContain('Barclays')
    expect(s.title).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    expect(body[2]).toContain(s.kicker)
    expect(body[2]).toContain(s.title)
    expect(body[3].startsWith(s.line)).toBe(true)
    expect(s.line).toContain('Automated loading')
  })

  it('3 · the SDE role, from the star paragraph', () => {
    const s = at(2)
    const body = zone('experience').content.body ?? []
    expect(s.kicker).toBe('2024')
    expect(s.title).toContain('Software Development Engineer')
    expect(s.title).toContain('Barclays')
    expect(s.title).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    expect(body[0]).toContain(s.kicker)
    expect(body[0]).toContain(s.title)
    expect(body[1].startsWith(s.line)).toBe(true)
    expect(s.line).toContain('Apache Kafka')
  })

  it('4 · the lineage engine, kicker cut from its own content kicker', () => {
    const s = at(3)
    const c = zone('lineage').content
    expect(s.kicker).toBe('IN PRODUCTION')
    expect(c.kicker).toContain(s.kicker)
    expect(s.title).toBe(c.title)
    expect(s.title).toContain('Payment Lineage Engine')
    expect((c.body ?? [])[0]).toContain(s.line)
    expect(s.line).toContain('750 million')
  })

  it('5 · the product in the making, with nothing named that content does not name', () => {
    const s = at(4)
    const c = zone('stealth').content
    expect(s.kicker).toBe('BUILDING')
    expect(c.kicker).toContain(s.kicker)
    expect(s.title).toBe(c.title)
    expect((c.body ?? [])[0].startsWith(s.line)).toBe(true)
    expect(s.line).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })

  it('rides the beats in résumé order, oldest first', () => {
    expect(COASTER_STOPS.map((s) => s.kicker)).toEqual(['2020', '2023', '2024', 'IN PRODUCTION', 'BUILDING'])
  })
})

describe('careerCard()', () => {
  const card: Content = careerCard()
  const text = JSON.stringify(card)

  it('is titled Career', () => {
    expect(card.title).toBe('Career')
  })

  it('carries both role headlines, glyphs stripped', () => {
    const body = card.body ?? []
    expect(body.some((p) => p.startsWith('Software Development Engineer · Barclays'))).toBe(true)
    expect(body.some((p) => p.startsWith('DevOps Intern · Barclays'))).toBe(true)
    for (const p of body) expect(p.startsWith('⭐') || p.startsWith('🛠'), `"${p.slice(0, 24)}" keeps a role glyph`).toBe(false)
  })

  it('keeps each role paragraph with its headline', () => {
    const body = card.body ?? []
    const exp = zone('experience').content.body ?? []
    expect(body).toContain(exp[1])
    expect(body).toContain(exp[3])
  })

  it('adds the education line', () => {
    expect(card.body ?? []).toContain(zone('education').content.sub)
  })

  it('states the CGPA and the start date as facts', () => {
    const facts = card.facts ?? []
    const cgpa = facts.find((f) => f.k === 'CGPA')
    expect(cgpa?.v).toBe(factOf('education', 'CGPA'))
    expect(text).toContain('9.63')
    expect(facts.find((f) => f.k === 'Since')?.v).toBe(factOf('about', 'Since'))
  })

  it('reuses the experience chips, not a new stack', () => {
    expect(card.chips).toEqual(zone('experience').content.chips)
  })

  it('invents no copy — every string comes from content', () => {
    const strings = [card.kicker ?? '', card.sub ?? '', ...(card.body ?? []), ...(card.chips ?? [])].filter(Boolean)
    for (const s of strings) expect(inContent(s), `"${s.slice(0, 40)}" is not from data/content.ts`).toBe(true)
  })

  it('returns a fresh object each call (callers may mutate the card)', () => {
    expect(careerCard()).not.toBe(card)
    expect(careerCard()).toEqual(card)
  })
})

describe('purity', () => {
  const src = readFileSync(new URL('../src/data/coaster.ts', import.meta.url), 'utf8')

  it('imports no Phaser and touches no DOM', () => {
    expect(src).not.toMatch(/from ['"]phaser['"]/i)
    expect(src).not.toMatch(/\b(document|window|HTMLElement|localStorage)\b/)
  })

  it('imports nothing but content and a type', () => {
    const specs = [...src.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const s of specs) expect(['./content', '../world/regions']).toContain(s)
  })
})
