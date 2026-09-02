// The requestAnimationFrame driver over the fixed-step accumulator.
//
// One frame = advance the clock, run whatever whole simulation steps that bought,
// then draw once with the leftover as an interpolation alpha. Draw always runs,
// even on a frame that simulated nothing, so the picture keeps moving between
// steps instead of stuttering at the step rate.
import { createStepper } from '../../games/loop'

export type Loop = {
  start(): void
  stop(): void
  running: boolean
  /** Stop and unhook from the document; a torn-down game must not wake up again. */
  destroy(): void
}

export function createLoop(opts: { hz?: number; step: () => void; draw: (alpha: number) => void }): Loop {
  const stepper = createStepper(opts.hz ?? 120)
  let raf = 0
  let last = 0
  /** Whether `last` holds a real timestamp yet — a first frame stamped 0 is legal. */
  let seeded = false
  /** The loop was running when the tab went away, so bring it back on return. */
  let resumeOnShow = false

  const tick = (t: number): void => {
    raf = requestAnimationFrame(tick)
    // The first frame after every start carries a wall-clock timestamp, not a
    // delta. Seed on it and simulate nothing, or frame one spends the whole
    // frame clamp catching up from zero.
    const dt = seeded ? t - last : 0
    seeded = true
    last = t
    const { steps, alpha } = stepper.advance(dt)
    for (let i = 0; i < steps; i++) opts.step()
    opts.draw(alpha)
  }

  const loop: Loop = {
    get running() {
      return raf !== 0
    },
    start() {
      if (raf !== 0) return
      // A fresh clock and an empty accumulator: time spent stopped is not owed
      // to the simulation, so resuming never arrives as a burst of steps.
      seeded = false
      stepper.reset()
      raf = requestAnimationFrame(tick)
    },
    stop() {
      // Cleared before the guard, not after: while the tab is hidden the loop is
      // already stopped, so a game stopping itself then would hit the early
      // return and leave the pending resume armed — and coming back to the tab
      // would restart a game that had deliberately stopped.
      resumeOnShow = false
      if (raf === 0) return
      cancelAnimationFrame(raf)
      raf = 0
    },
    destroy() {
      loop.stop()
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }

  function onVisibility(): void {
    if (document.hidden) {
      // rAF is throttled or frozen in a hidden tab anyway; stopping outright
      // keeps the accumulator from being handed the whole absence at once.
      if (!loop.running) return
      loop.stop()
      resumeOnShow = true
    } else if (resumeOnShow) {
      resumeOnShow = false
      loop.start()
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  return loop
}
