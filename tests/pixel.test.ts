import { describe, expect, it } from 'vitest'
import { PAL } from '../src/art/palette'
import { hex, outlineRaster, packSheet, rasterize, type Raster } from '../src/art/pixel'

const px = (r: Raster, x: number, y: number) => Array.from(r.data.slice((y * r.w + x) * 4, (y * r.w + x) * 4 + 4))

describe('hex', () => {
  it('parses #rrggbb and rgba()', () => {
    expect(hex('#e2483f')).toEqual([226, 72, 63, 255])
    expect(hex('rgba(20,30,40,0.5)')).toEqual([20, 30, 40, 128])
  })
})

describe('rasterize', () => {
  it('maps legend characters to palette colours and dots to transparent', () => {
    const r = rasterize({ name: 't', rows: ['.X.', 'XXX', '.X.'], legend: { X: 'red' } })
    expect(r.w).toBe(3)
    expect(r.h).toBe(3)
    expect(px(r, 1, 1)).toEqual(hex(PAL.red))
    expect(px(r, 0, 0)[3]).toBe(0)
  })

  it('accepts raw hex colours in the legend', () => {
    const r = rasterize({ name: 't', rows: ['A'], legend: { A: '#010203' } })
    expect(px(r, 0, 0)).toEqual([1, 2, 3, 255])
  })

  it('throws on an unknown character', () => {
    expect(() => rasterize({ name: 'bad', rows: ['Q'], legend: {} })).toThrow(/bad/)
  })

  it('applies a 4-connected outline into transparent neighbours', () => {
    const r = rasterize({ name: 't', rows: ['...', '.X.', '...'], legend: { X: 'red' }, outline: 'outline' })
    expect(px(r, 1, 0)).toEqual(hex(PAL.outline))
    expect(px(r, 0, 1)).toEqual(hex(PAL.outline))
    expect(px(r, 0, 0)[3]).toBe(0)
    expect(px(r, 1, 1)).toEqual(hex(PAL.red))
  })

  it('outlineRaster does not touch opaque pixels', () => {
    const r = rasterize({ name: 't', rows: ['XX', 'XX'], legend: { X: 'red' } })
    const o = outlineRaster(r, PAL.outline)
    expect(px(o, 0, 0)).toEqual(hex(PAL.red))
  })
})

describe('packSheet', () => {
  it('records frame counts for horizontal strips', () => {
    const p = packSheet([{ name: 's', rows: ['XXXXXX', 'XXXXXX'], legend: { X: 'red' }, frames: 2 }])
    expect(p.place.s.frames).toBe(2)
    expect(p.place.s.w).toBe(6)
    expect(p.place.s.h).toBe(2)
  })

  it('places sprites without overlap inside the sheet', () => {
    const defs = [
      { name: 'a', rows: Array(10).fill('XXXXXXXXXX'), legend: { X: 'red' as const } },
      { name: 'b', rows: Array(4).fill('XXXXXXXX'), legend: { X: 'red' as const } },
      { name: 'c', rows: Array(7).fill('XXX'), legend: { X: 'red' as const } },
    ]
    const p = packSheet(defs, 16)
    const rects = Object.values(p.place)
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(p.w)
      expect(r.y + r.h).toBeLessThanOrEqual(p.h)
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap).toBe(false)
      }
  })
})

describe('procedural defs', () => {
  it('rasterizes via paint() using w/h', () => {
    const r = rasterize({
      name: 'p',
      w: 2,
      h: 2,
      legend: {},
      paint: (ras) => {
        ras.data[0] = 1
        ras.data[1] = 2
        ras.data[2] = 3
        ras.data[3] = 255
      },
    })
    expect(r.w).toBe(2)
    expect(px(r, 0, 0)).toEqual([1, 2, 3, 255])
    expect(px(r, 1, 1)[3]).toBe(0)
  })

  it('packSheet sizes procedural defs from w/h', () => {
    const p = packSheet([{ name: 'p', w: 5, h: 3, legend: {}, paint: () => {} }])
    expect(p.place.p.w).toBe(5)
    expect(p.place.p.h).toBe(3)
  })
})
