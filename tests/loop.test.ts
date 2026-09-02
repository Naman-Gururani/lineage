// @vitest-environment happy-dom
//
// The smoothness kit every canvas game runs on: a fixed-step accumulator
// (`games/loop.ts`, pure), the rAF driver over it (`ui/minigames/loop.ts`), and
// the DPR-aware surface they draw to (`ui/minigames/canvas.ts`). Jitter, catch-up
// bursts and a blurry backing store are the three failure modes pinned down here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// makeCanvas builds its element with `el()` from ui/modal, which reaches the
// event bus, which constructs a Phaser emitter at import time — and Phaser's
// canvas feature probe dies against happy-dom's stub. Nothing here uses the bus.
vi.mock('phaser', () => ({ default: { Events: { EventEmitter: class {} } } }))

import { createStepper } from '../src/games/loop'
import { makeCanvas } from '../src/ui/minigames/canvas'
import { createLoop, type Loop } from '../src/ui/minigames/loop'

/** One frame at 120 Hz — the brief's "8.33 ms", written exactly. */
const F120 = 1000 / 120
/** One frame at 60 Hz — the brief's "16.6 ms". */
const F60 = 1000 / 60

describe('createStepper', () => {
  it('turns one 120 Hz frame into exactly one step with no leftover', () => {
    const s = createStepper(120)
    expect(s.advance(F120)).toEqual({ steps: 1, alpha: 0 })
  })

  it('turns one 60 Hz frame into two steps at 120 Hz', () => {
    const s = createStepper(120)
    expect(s.advance(F60)).toEqual({ steps: 2, alpha: 0 })
  })

  it('holds a partial frame back as alpha instead of stepping early', () => {
    const s = createStepper(120)
    // Just short of a whole step: nothing simulates, but the draw is told it is
    // almost all the way to the next state. Stepping here would be the jitter.
    const { steps, alpha } = s.advance(F120 - 0.01)
    expect(steps).toBe(0)
    expect(alpha).toBeCloseTo(0.9988, 3)
  })

  it('carries the residual between calls', () => {
    // 100 Hz: 10 ms steps divide exactly, so the carry is readable rather than
    // buried in float noise.
    const s = createStepper(100)
    expect(s.advance(15)).toEqual({ steps: 1, alpha: 0.5 })
    // the two half-steps have added up to a whole one
    expect(s.advance(15)).toEqual({ steps: 2, alpha: 0 })
    expect(s.advance(4)).toEqual({ steps: 0, alpha: 0.4 })
    expect(s.advance(7)).toEqual({ steps: 1, alpha: 0.1 })
  })

  it('never reports a negative or over-full alpha, whatever the float noise', () => {
    // Frames that land a hair either side of a step boundary are where naive
    // accumulator maths hands the renderer an alpha it cannot interpolate with.
    const s = createStepper(120)
    for (const dt of [10, 8.333, 8.334, 16.666, 0.001, 33.3, 50]) {
      const { steps, alpha } = s.advance(dt)
      expect(steps).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThan(1)
    }
  })

  it('clamps a long frame so a stalled tab cannot burst', () => {
    const s = createStepper(120, 50)
    // 400 ms of wall clock (a tab switch, a GC pause) is worth 48 steps; the
    // clamp buys 6 and drops the rest on the floor.
    expect(s.advance(400).steps).toBe(6)
  })

  it('ignores a zero, negative or NaN frame instead of poisoning the accumulator', () => {
    const s = createStepper(120)
    expect(s.advance(0)).toEqual({ steps: 0, alpha: 0 })
    expect(s.advance(-100)).toEqual({ steps: 0, alpha: 0 })
    expect(s.advance(Number.NaN)).toEqual({ steps: 0, alpha: 0 })
    // still healthy afterwards
    expect(s.advance(F120).steps).toBe(1)
  })

  it('reset() drops the residual', () => {
    const s = createStepper(120)
    s.advance(10)
    expect(s.advance(0).alpha).toBeCloseTo(0.2, 6)
    s.reset()
    expect(s.advance(0)).toEqual({ steps: 0, alpha: 0 })
  })

  it('honours a non-default rate', () => {
    const s = createStepper(60)
    expect(s.advance(F60)).toEqual({ steps: 1, alpha: 0 })
  })
})

/* ---------------- the rAF driver ---------------- */

type RafCb = (t: number) => void
let queue: { id: number; cb: RafCb }[] = []
let nextId = 1
/** Frame ids handed to cancelAnimationFrame, so a redundant stop() is visible. */
let cancelled: number[] = []

/** Run every callback queued for the next frame, stamped `t` ms. */
function frame(t: number): void {
  const due = queue
  queue = []
  for (const r of due) r.cb(t)
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('createLoop', () => {
  beforeEach(() => {
    queue = []
    nextId = 1
    cancelled = []
    vi.stubGlobal('requestAnimationFrame', (cb: RafCb) => {
      const id = nextId++
      queue.push({ id, cb })
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id)
      queue = queue.filter((r) => r.id !== id)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (document as unknown as { hidden?: boolean }).hidden
  })

  it('does not run until start(), and seeds its clock on the first frame', () => {
    const step = vi.fn()
    const draw = vi.fn()
    const loop = createLoop({ hz: 120, step, draw })
    expect(loop.running).toBe(false)
    expect(queue).toHaveLength(0)

    loop.start()
    expect(loop.running).toBe(true)
    // The first rAF timestamp is wall-clock, not a delta: measuring from zero
    // would spend the whole frame clamp on frame one.
    frame(5000)
    expect(step).toHaveBeenCalledTimes(0)
    expect(draw).toHaveBeenCalledTimes(1)
    loop.destroy()
  })

  it('steps in step with elapsed time and draws once per frame', () => {
    const step = vi.fn()
    const draw = vi.fn()
    const loop = createLoop({ hz: 120, step, draw })
    loop.start()
    let t = 1000
    frame(t)
    for (let i = 0; i < 60; i++) {
      t += F60
      frame(t)
    }
    // One second of 60 fps frames = 120 steps at 120 Hz, one draw per frame.
    expect(step).toHaveBeenCalledTimes(120)
    expect(draw).toHaveBeenCalledTimes(61)
    loop.destroy()
  })

  it('draws even on a frame that simulates nothing', () => {
    const step = vi.fn()
    const draw = vi.fn()
    const loop = createLoop({ hz: 120, step, draw })
    loop.start()
    frame(0)
    frame(1) // 1 ms: not a whole step
    expect(step).toHaveBeenCalledTimes(0)
    expect(draw).toHaveBeenCalledTimes(2)
    loop.destroy()
  })

  it('hands draw the interpolation alpha', () => {
    const step = vi.fn()
    const draw = vi.fn()
    const loop = createLoop({ hz: 120, step, draw })
    loop.start()
    frame(0)
    frame(10) // one step, 1.67 ms of the next already elapsed
    expect(draw).toHaveBeenLastCalledWith(expect.closeTo(0.2, 6))
    loop.destroy()
  })

  it('stop() halts the loop and cancels the pending frame', () => {
    const step = vi.fn()
    const draw = vi.fn()
    const loop = createLoop({ hz: 120, step, draw })
    loop.start()
    frame(0)
    frame(F60)
    loop.stop()
    expect(loop.running).toBe(false)
    expect(queue).toHaveLength(0)
    frame(1000)
    expect(step).toHaveBeenCalledTimes(2)
    expect(draw).toHaveBeenCalledTimes(2)
    loop.destroy()
  })

  it('start() after stop() resumes without replaying the gap', () => {
    const step = vi.fn()
    const draw = vi.fn()
    const loop = createLoop({ hz: 120, step, draw })
    loop.start()
    frame(0)
    loop.stop()
    loop.start()
    frame(30000) // 30 s later: a fresh clock, not 30 s of catch-up
    expect(step).toHaveBeenCalledTimes(0)
    loop.destroy()
  })

  it('lets a game stop itself from inside a step, with no frame after it', () => {
    // Every game ends this way: the step that detects the crash calls stop().
    // The frame it happened on still draws the final picture, and then nothing.
    const draw = vi.fn()
    let loop: Loop | undefined
    const step = vi.fn(() => loop?.stop())
    loop = createLoop({ hz: 120, step, draw })
    loop.start()
    frame(0)
    frame(F60)
    expect(loop.running).toBe(false)
    expect(draw).toHaveBeenCalledTimes(2)

    const stepped = step.mock.calls.length
    frame(9999)
    expect(step).toHaveBeenCalledTimes(stepped)
    expect(draw).toHaveBeenCalledTimes(2)
    loop.destroy()
  })

  it('pauses while the tab is hidden and resumes with no catch-up burst', () => {
    const step = vi.fn()
    const draw = vi.fn()
    const loop = createLoop({ hz: 120, step, draw })
    loop.start()
    frame(0)
    frame(F60)
    expect(step).toHaveBeenCalledTimes(2)

    setHidden(true)
    expect(loop.running).toBe(false)
    expect(queue).toHaveLength(0)

    setHidden(false)
    expect(loop.running).toBe(true)
    // Minutes of wall clock passed while hidden. The resumed loop reseeds, so
    // the player comes back to the game where they left it, not to a fast-forward.
    frame(120000)
    expect(step).toHaveBeenCalledTimes(2)
    frame(120000 + F60)
    expect(step).toHaveBeenCalledTimes(4)
    loop.destroy()
  })

  it('leaves a loop the game stopped stopped, however the tab flickers', () => {
    const loop = createLoop({ hz: 120, step: vi.fn(), draw: vi.fn() })
    loop.start()
    frame(0)
    loop.stop() // e.g. a prize card opened over the game
    setHidden(true)
    setHidden(false)
    expect(loop.running).toBe(false)
    loop.destroy()
  })

  it('stays stopped when the game stops it while the tab was already hidden', () => {
    // The pause has already stopped the loop, so the game's own stop() lands on a
    // loop that is not running. It must still cancel the pending resume, or
    // returning to the tab restarts a game that was deliberately shut down.
    const step = vi.fn()
    const loop = createLoop({ hz: 120, step, draw: vi.fn() })
    loop.start()
    frame(0)
    setHidden(true)
    expect(loop.running).toBe(false)

    loop.stop() // e.g. the player closed the panel while away
    setHidden(false)
    expect(loop.running).toBe(false)
    frame(1000)
    expect(step).toHaveBeenCalledTimes(0)
    loop.destroy()
  })

  it('takes a second stop() as a no-op', () => {
    const loop = createLoop({ hz: 120, step: vi.fn(), draw: vi.fn() })
    loop.start()
    frame(0)
    loop.stop()
    loop.stop()
    // the second stop owns no frame, so it must not cancel anybody else's
    expect(cancelled).toHaveLength(1)
    expect(loop.running).toBe(false)
    // and the loop is still startable afterwards
    loop.start()
    expect(loop.running).toBe(true)
    loop.destroy()
  })

  it('destroy() stops the loop and removes the visibility listener it added', () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const step = vi.fn()
    const loop = createLoop({ hz: 120, step, draw: vi.fn() })
    const added = add.mock.calls.find((c) => c[0] === 'visibilitychange')
    expect(added).toBeDefined()

    loop.start()
    frame(0)
    loop.destroy()

    expect(loop.running).toBe(false)
    expect(queue).toHaveLength(0)
    expect(remove).toHaveBeenCalledWith('visibilitychange', added![1])
    // and the handler really is gone: a torn-down game must not restart itself
    setHidden(true)
    setHidden(false)
    expect(loop.running).toBe(false)
  })
})

/* ---------------- the DPR-aware drawing surface ---------------- */

describe('makeCanvas', () => {
  let scale: ReturnType<typeof vi.fn>
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    root = document.createElement('div')
    document.body.append(root)
    scale = vi.fn()
    // happy-dom has no 2D context at all, so every game surface is stubbed.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ scale, imageSmoothingEnabled: true }) as unknown as CanvasRenderingContext2D,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const make = (w = 640, h = 400, opts: { pixelated?: boolean; label?: string } = {}) =>
    makeCanvas(root, w, h, { label: 'Prize machine', ...opts })

  it('mounts a labelled, focusable canvas into the root', () => {
    const s = make()
    expect(s.canvas.parentElement).toBe(root)
    expect(s.canvas.className).toBe('mg-canvas')
    // A canvas is a black box to a screen reader; `img` + a label is the most it
    // can honestly offer, and tabIndex lets a keyboard player focus the game.
    expect(s.canvas.getAttribute('role')).toBe('img')
    expect(s.canvas.getAttribute('aria-label')).toBe('Prize machine')
    expect(s.canvas.tabIndex).toBe(0)
  })

  it('sizes the backing store by the device pixel ratio and scales the context to match', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const s = make(640, 400)
    expect([s.canvas.width, s.canvas.height]).toEqual([1280, 800])
    expect({ w: s.w, h: s.h, dpr: s.dpr }).toEqual({ w: 640, h: 400, dpr: 2 })
    // Games draw in logical pixels; the one scale here is what keeps them from
    // having to multiply every coordinate.
    expect(scale).toHaveBeenCalledExactlyOnceWith(2, 2)
  })

  it('lets CSS lay the canvas out by aspect ratio rather than fixed pixels', () => {
    // The CSS size is `width: 100%` from .mg-canvas; without the ratio the
    // element would collapse or stretch and the drawing would smear.
    const s = make(480, 360)
    expect(s.canvas.style.aspectRatio.replace(/\s/g, '')).toBe('480/360')
  })

  it('publishes the ratio as --ar, which is how .mg-canvas caps the height', () => {
    // A bare max-height clamps the height and leaves the width at 100%, which
    // stretches the bitmap. panels.css instead caps the *width* with
    // "calc(70vh * var(--ar))", and only a unitless number works inside calc().
    expect(make(640, 400).canvas.style.getPropertyValue('--ar')).toBe('1.6')
    expect(make(480, 360).canvas.style.getPropertyValue('--ar')).toBe(String(480 / 360))
  })

  it('falls back to 1 and caps at 3 so a phone cannot ask for a huge buffer', () => {
    vi.stubGlobal('devicePixelRatio', 0)
    expect(make().dpr).toBe(1)
    vi.stubGlobal('devicePixelRatio', 4)
    const s = make(640, 400)
    expect(s.dpr).toBe(3)
    expect(s.canvas.width).toBe(1920)
  })

  it('rounds a fractional ratio to whole pixels', () => {
    // Windows sits at 1.25 and 1.5 constantly. `width` truncates, so 601.25 px of
    // backing store would silently become 601 against a 601.25 px scale.
    vi.stubGlobal('devicePixelRatio', 1.5)
    const s = make(101, 51)
    expect([s.canvas.width, s.canvas.height]).toEqual([152, 77])
  })

  it('keeps pixel art crisp when asked and smooth otherwise', () => {
    const pixel = make(640, 400, { pixelated: true })
    expect(pixel.ctx.imageSmoothingEnabled).toBe(false)
    expect(pixel.canvas.style.imageRendering).toBe('pixelated')

    const smooth = make(480, 360)
    expect(smooth.ctx.imageSmoothingEnabled).toBe(true)
    expect(smooth.canvas.style.imageRendering).toBe('auto')
  })

  it('fails loudly when the browser gives no 2D context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(() => make()).toThrow(/2d/i)
  })
})
