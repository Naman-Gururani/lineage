import { describe, expect, it } from 'vitest'
import { CHUNK, RUN_SPEED, TILE, WALK_SPEED, WORLD_H, WORLD_TH, WORLD_TW, WORLD_W, pickZoom } from '../src/config'

describe('config', () => {
  it('uses 32px HD tiles on a 96x72 island', () => {
    expect(TILE).toBe(32)
    expect(WORLD_TW).toBe(96)
    expect(WORLD_TH).toBe(72)
    expect(WORLD_W).toBe(TILE * WORLD_TW)
    expect(WORLD_H).toBe(TILE * WORLD_TH)
  })

  it('bakes the world in 1024px chunks', () => {
    expect(CHUNK).toBe(1024)
  })

  it('walks at 4.5 tiles/s and runs at 7 tiles/s', () => {
    expect(WALK_SPEED / TILE).toBeCloseTo(4.5)
    expect(RUN_SPEED / TILE).toBeCloseTo(7)
  })

  it('picks a camera zoom for the viewport', () => {
    expect(pickZoom(1280, 800)).toBe(1)
    expect(pickZoom(1920, 1080)).toBe(1.5)
    expect(pickZoom(2560, 1440)).toBe(2)
  })

  it('falls back to 1x on small and portrait viewports', () => {
    expect(pickZoom(1024, 768)).toBe(1)
    expect(pickZoom(390, 844)).toBe(1)
  })
})
