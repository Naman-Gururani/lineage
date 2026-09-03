// The rides pack: the Career Coaster (three spans, station, cart) and the
// Ferris wheel (A-frame base + a rim that spins on its own).
//
// Two things beyond the usual size/anchor contract get pinned here, because
// both are invisible in a code review and glaring in the game:
//
//  1. **The three spans tile.** They are laid side by side along tiles y 6…15,
//     so the rail leaving span n's right edge has to arrive at span n+1's left
//     edge at the same height. The spans draw one shared polyline
//     (`data/coaster.ts` COASTER_PATH) with an x offset, and these tests prove
//     the seam actually closes.
//  2. **The rails are the ride.** The cart follows COASTER_PATH; if the art
//     stopped tracking it the cart would float. Sample points of the path are
//     asserted to land on paint.
import { describe, expect, it } from 'vitest'
import { rasterize, type SpriteDef } from '../../src/art/pixel'
import { RIDE_DEFS } from '../../src/art/sprites/rides'
import { COASTER_PATH } from '../../src/data/coaster'
import { expectFrame, frameOf, index, itIsAWellFormedPack, need, opaqueIn } from './helpers'

const byName = index(RIDE_DEFS)

/** name → [frame w, frame h, frames, anchor] — the plan's Task 3 table, frozen. */
const DIMS: Record<string, [number, number, number, [number, number]]> = {
  coaster_span_0: [512, 320, 1, [0, 320]],
  coaster_span_1: [512, 320, 1, [0, 320]],
  coaster_span_2: [512, 320, 1, [0, 320]],
  coaster_span_0_night: [512, 320, 1, [0, 320]],
  coaster_span_1_night: [512, 320, 1, [0, 320]],
  coaster_span_2_night: [512, 320, 1, [0, 320]],
  coaster_station: [192, 128, 1, [96, 128]],
  coaster_station_night: [192, 128, 1, [96, 128]],
  coaster_cart_0: [48, 32, 1, [24, 28]],
  coaster_cart_1: [48, 32, 1, [24, 28]],
  ferris_wheel: [256, 320, 1, [128, 320]],
  ferris_wheel_night: [256, 320, 1, [128, 320]],
  ferris_rim_0: [224, 224, 1, [112, 112]],
  ferris_rim_1: [224, 224, 1, [112, 112]],
  ferris_rim_2: [224, 224, 1, [112, 112]],
  ferris_rim_3: [224, 224, 1, [112, 112]],
}

const SPANS = ['coaster_span_0', 'coaster_span_1', 'coaster_span_2']
const SPAN_W = 512
const SPAN_H = 320

const alphaAt = (r: { w: number; h: number; data: Uint8ClampedArray }, x: number, y: number): number =>
  x < 0 || y < 0 || x >= r.w || y >= r.h ? 0 : r.data[(y * r.w + x) * 4 + 3]

/** Topmost painted row in a column, or -1 when the column is empty. */
function topOfColumn(r: { w: number; h: number; data: Uint8ClampedArray }, x: number): number {
  for (let y = 0; y < r.h; y++) if (alphaAt(r, x, y) > 0) return y
  return -1
}

/** Is any pixel within `rad` of (x,y) painted? */
function paintNear(r: { w: number; h: number; data: Uint8ClampedArray }, x: number, y: number, rad: number): boolean {
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (alphaAt(r, x + dx, y + dy) > 0) return true
  return false
}

/** Opaque bounding box of a raster. */
function bounds(r: { w: number; h: number; data: Uint8ClampedArray }): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = r.w
  let y0 = r.h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++)
      if (alphaAt(r, x, y) > 0) {
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x > x1) x1 = x
        if (y > y1) y1 = y
      }
  return { x0, y0, x1, y1 }
}

const raster = (name: string) => rasterize(need(byName, name) as SpriteDef)

describe('rides pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('rides')
})

describe('the pinned table', () => {
  it('defines every name at its frozen size, frame count and anchor', () => {
    for (const [name, [w, h, frames, anchor]] of Object.entries(DIMS)) {
      const d = expectFrame(byName, name, w, h)
      expect(frameOf(d).frames, `${name} frames`).toBe(frames)
      expect(d.anchor, `${name} anchor`).toEqual(anchor)
    }
  })

  it('defines nothing the atlas has not been told about', () => {
    expect(RIDE_DEFS.map((d) => d.name).sort()).toEqual(Object.keys(DIMS).sort())
  })

  it('anchors the spans at their left-bottom corner so they butt together', () => {
    for (const n of SPANS) expect(need(byName, n).anchor, `${n} anchor`).toEqual([0, SPAN_H])
  })

  it('anchors the rim on its hub so it can be spun in place', () => {
    for (let i = 0; i < 4; i++) expect(need(byName, `ferris_rim_${i}`).anchor).toEqual([112, 112])
  })
})

describe('the coaster spans tile', () => {
  const rasters = SPANS.map((n) => rasterize(need(byName, n)))

  it('carries the same rail height on both sides of every seam', () => {
    for (let i = 0; i < rasters.length - 1; i++) {
      const left = topOfColumn(rasters[i], SPAN_W - 1)
      const right = topOfColumn(rasters[i + 1], 0)
      expect(left, `span ${i} right edge is empty`).toBeGreaterThanOrEqual(0)
      expect(right, `span ${i + 1} left edge is empty`).toBeGreaterThanOrEqual(0)
      expect(Math.abs(left - right), `seam ${i}/${i + 1}: rail steps ${left}→${right}`).toBeLessThanOrEqual(4)
    }
  })

  it('paints a solid-looking base row across each span (the footing the world makes solid)', () => {
    for (const [i, r] of rasters.entries()) {
      let painted = 0
      for (let x = 0; x < SPAN_W; x++) if (alphaAt(r, x, SPAN_H - 1) > 0) painted++
      expect(painted / SPAN_W, `span ${i} base row coverage`).toBeGreaterThan(0.6)
    }
  })

  it('reaches near the top of the frame where the profile does (the lift crest in span 0)', () => {
    const b = bounds(rasters[0])
    expect(b.y0, 'span 0 should carry the highest point of the ride').toBeLessThan(40)
  })
})

describe('the rails follow COASTER_PATH', () => {
  const rasters = SPANS.map((n) => rasterize(need(byName, n)))

  it('paints track under every path point, in the span that owns it', () => {
    let checked = 0
    for (const p of COASTER_PATH) {
      const span = Math.min(2, Math.floor(p.x / SPAN_W))
      const x = Math.round(p.x) - span * SPAN_W
      const y = Math.round(SPAN_H + p.y)
      if (x < 3 || x > SPAN_W - 4) continue // seam columns are checked above
      expect(paintNear(rasters[span], x, y, 4), `no rail near path point (${p.x}, ${p.y}) in span ${span}`).toBe(true)
      checked++
    }
    expect(checked, 'path points sampled').toBeGreaterThan(120)
  })
})

describe('night overlays', () => {
  const pairs: [string, string][] = [
    ['coaster_span_0', 'coaster_span_0_night'],
    ['coaster_span_1', 'coaster_span_1_night'],
    ['coaster_span_2', 'coaster_span_2_night'],
    ['coaster_station', 'coaster_station_night'],
    ['ferris_wheel', 'ferris_wheel_night'],
  ]

  it('lights bulbs rather than repainting the sprite', () => {
    for (const [day, night] of pairs) {
      const d = opaqueIn(need(byName, day))
      const n = opaqueIn(need(byName, night))
      expect(n, `${night} is empty`).toBeGreaterThan(0)
      expect(n / d, `${night} covers ${((n / d) * 100) | 0}% of ${day} — an overlay, not a repaint`).toBeLessThan(0.7)
    }
  })

  it('keeps the overlay the same size and anchor as its day sprite', () => {
    for (const [day, night] of pairs) {
      expect(frameOf(need(byName, night)), night).toEqual(frameOf(need(byName, day)))
      expect(need(byName, night).anchor, night).toEqual(need(byName, day).anchor)
    }
  })

  it('runs bulbs along the rails of every span', () => {
    // The overlay must light the track, not just the footings: sample the upper
    // half of each span and require lit pixels up there too.
    for (const n of ['coaster_span_0_night', 'coaster_span_1_night', 'coaster_span_2_night']) {
      const r = raster(n)
      let high = 0
      for (let y = 0; y < SPAN_H / 2; y++) for (let x = 0; x < SPAN_W; x++) if (alphaAt(r, x, y) > 0) high++
      expect(high, `${n} lights nothing in the upper half of the structure`).toBeGreaterThan(20)
    }
  })
})

describe('the cart', () => {
  it('animates — the two frames are not the same picture', () => {
    const a = raster('coaster_cart_0')
    const b = raster('coaster_cart_1')
    let diff = 0
    for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 3] !== b.data[i + 3]) diff++
    expect(diff, 'coaster_cart_1 is a copy of coaster_cart_0').toBeGreaterThan(20)
  })

  it('sits its wheels on the anchor row, with the rider above it', () => {
    for (const n of ['coaster_cart_0', 'coaster_cart_1']) {
      const b = bounds(raster(n))
      expect(b.y1, `${n} drawn depth`).toBeGreaterThanOrEqual(26)
      expect(b.y0, `${n} rider headroom`).toBeLessThan(12)
    }
  })
})

describe('the ferris wheel', () => {
  it('gives the rim four distinct rotations', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 4; i++) {
      const r = raster(`ferris_rim_${i}`)
      let key = ''
      for (let y = 8; y < 216; y += 7) for (let x = 8; x < 216; x += 7) key += alphaAt(r, x, y) > 0 ? '1' : '0'
      seen.add(key)
    }
    expect(seen.size, 'the four rim frames must all differ or the wheel stutters').toBe(4)
  })

  it('centres the rim on its hub anchor', () => {
    for (let i = 0; i < 4; i++) {
      const b = bounds(raster(`ferris_rim_${i}`))
      expect(Math.abs((b.x0 + b.x1) / 2 - 112), `ferris_rim_${i} x centre`).toBeLessThanOrEqual(8)
      expect(Math.abs((b.y0 + b.y1) / 2 - 112), `ferris_rim_${i} y centre`).toBeLessThanOrEqual(12)
      expect(b.x1 - b.x0, `ferris_rim_${i} width`).toBeGreaterThan(180)
    }
  })

  it('stands the base on the ground with the hub where the rim will hang', () => {
    const r = raster('ferris_wheel')
    const b = bounds(r)
    expect(b.y1, 'the A-frame must reach the anchor row').toBeGreaterThanOrEqual(316)
    // hub at (128,128): the rim is placed there, so the base must carry paint there
    expect(paintNear(r, 128, 128, 6), 'no hub at (128,128)').toBe(true)
  })
})
