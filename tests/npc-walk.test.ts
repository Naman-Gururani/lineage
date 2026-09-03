// The NPC walk ticker. Every HD villager pack ships walk_{dir}_{0..3}
// (contact–down–contact–up), so the 150ms ticker must reach all four frames —
// the old expression collapsed the 0..3 counter onto walk frames {0,1} and
// interleaved the idle pose, which left frames 2 and 3 unused.
//
// `walkFrameIndex` is pure, so this suite runs in the default Node environment.
// Phaser is stubbed only because Npc.ts extends Phaser.GameObjects.Container at
// module-evaluation time; nothing here touches the class.
import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({ default: { GameObjects: { Container: class {} } } }))

const { NPC_WALK_FRAMES, NPC_WALK_MS, NPC_WALK_SPEED, walkFrameIndex, walkTick } = await import('../src/entities/Npc')

describe('NPC walk cycle', () => {
  it('is a four-frame cycle (the packs ship walk_{dir}_{0..3})', () => {
    expect(NPC_WALK_FRAMES).toBe(4)
  })

  it('maps the first four ticks to walk frames 0, 1, 2, 3 in order', () => {
    expect([0, 1, 2, 3].map(walkFrameIndex)).toEqual([0, 1, 2, 3])
  })

  it('wraps back to frame 0 on the fifth tick', () => {
    expect([4, 5, 6, 7, 8].map(walkFrameIndex)).toEqual([0, 1, 2, 3, 0])
  })

  it('reaches frames 2 and 3 — the regression the old `f === 0 ? 0 : 1` ternary caused', () => {
    const seen = new Set(Array.from({ length: 32 }, (_, t) => walkFrameIndex(t)))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })

  it('never advances by more than one frame per tick (no visible skipping)', () => {
    for (let t = 0; t < 64; t++) {
      const step = (walkFrameIndex(t + 1) - walkFrameIndex(t) + NPC_WALK_FRAMES) % NPC_WALK_FRAMES
      expect(step, `tick ${t} → ${t + 1}`).toBe(1)
    }
  })

  it('always returns an in-range frame index, including for a negative tick', () => {
    for (const t of [-1, -2, -4, -5, -1000, 0, 1, 999999]) {
      const f = walkFrameIndex(t)
      expect(Number.isInteger(f), `tick ${t} → ${f}`).toBe(true)
      expect(f, `tick ${t}`).toBeGreaterThanOrEqual(0)
      expect(f, `tick ${t}`).toBeLessThan(NPC_WALK_FRAMES)
    }
  })

  it('is pure — the same tick always yields the same frame', () => {
    for (const t of [0, 1, 2, 3, 17]) expect(walkFrameIndex(t)).toBe(walkFrameIndex(t))
  })
})

// Bo walks the fair at nearly the hero's pace while the rest of the cast ambles.
// The ticker is timed in milliseconds, so without scaling his legs would turn
// over at the villager rate and he would skate to his next station.
describe('the walk ticker at other paces', () => {
  it('leaves the villager amble ticking at one millisecond per millisecond', () => {
    expect(NPC_WALK_SPEED).toBe(38)
    for (const dt of [0, 8, 16, 150, 1000]) expect(walkTick(dt, NPC_WALK_SPEED)).toBe(dt)
  })

  it('holds the ground covered per walk frame constant at any pace', () => {
    const perFrame = (speed: number) => {
      // ms of real time to fill one NPC_WALK_MS of ticker, times the pace
      const ms = NPC_WALK_MS / (walkTick(1, speed) || 1)
      return (ms / 1000) * speed
    }
    for (const speed of [NPC_WALK_SPEED, 60, 110, 130]) expect(perFrame(speed)).toBeCloseTo(perFrame(NPC_WALK_SPEED), 6)
  })
})
