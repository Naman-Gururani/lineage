import { describe, expect, it } from 'vitest'
import { blit, fillRect, makeRaster, pixelAt, setPx } from '../src/art/raster'

describe('raster', () => {
  it('fills rectangles with clipping', () => {
    const r = makeRaster(4, 4)
    fillRect(r, 1, 1, 10, 2, [255, 0, 0, 255])
    expect(pixelAt(r, 1, 1)).toEqual([255, 0, 0, 255])
    expect(pixelAt(r, 3, 2)).toEqual([255, 0, 0, 255])
    expect(pixelAt(r, 0, 0)).toEqual([0, 0, 0, 0])
    expect(pixelAt(r, 1, 3)).toEqual([0, 0, 0, 0])
  })

  it('sets single pixels and ignores out-of-range writes', () => {
    const r = makeRaster(2, 2)
    setPx(r, 1, 1, [1, 2, 3, 255])
    setPx(r, 5, 5, [9, 9, 9, 255])
    expect(pixelAt(r, 1, 1)).toEqual([1, 2, 3, 255])
  })

  it('blits with alpha (opaque pixels replace, transparent skip, partial blend)', () => {
    const dst = makeRaster(3, 3)
    fillRect(dst, 0, 0, 3, 3, [0, 0, 255, 255])
    const src = makeRaster(2, 1)
    setPx(src, 0, 0, [255, 0, 0, 255])
    setPx(src, 1, 0, [255, 0, 0, 128])
    blit(dst, src, 1, 1)
    expect(pixelAt(dst, 1, 1)).toEqual([255, 0, 0, 255])
    const blended = pixelAt(dst, 2, 1)
    expect(blended[0]).toBeGreaterThan(120)
    expect(blended[2]).toBeGreaterThan(120)
    expect(blended[3]).toBe(255)
    expect(pixelAt(dst, 0, 0)).toEqual([0, 0, 255, 255])
  })

  it('blits clip at the edges', () => {
    const dst = makeRaster(2, 2)
    const src = makeRaster(3, 3)
    fillRect(src, 0, 0, 3, 3, [1, 1, 1, 255])
    blit(dst, src, -1, -1)
    blit(dst, src, 1, 1)
    expect(pixelAt(dst, 0, 0)).toEqual([1, 1, 1, 255])
    expect(pixelAt(dst, 1, 1)).toEqual([1, 1, 1, 255])
  })
})
