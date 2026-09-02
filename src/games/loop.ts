// The fixed-step accumulator every canvas game simulates on.
//
// Drawing happens whenever the browser feels like it — 60 Hz, 120 Hz, 48 Hz on a
// tired laptop, and never evenly spaced. Simulating on those raw deltas makes
// physics wobble with the frame rate, which is the jitter players feel. So the
// simulation runs on its own fixed clock (120 Hz by default): wall-clock time is
// poured into an accumulator, whole steps are drawn out of it, and whatever is
// left over comes back as `alpha` — how far between the last two states the
// renderer should draw. Small, pure, no DOM: `src/games/*` never touches one.
export type Stepper = {
  /** Feed one frame's elapsed ms; get the steps to simulate and the draw's interpolation. */
  advance(dtMs: number): { steps: number; alpha: number }
  /** Drop the residual — after a pause, so time spent away is not replayed. */
  reset(): void
}

/**
 * @param hz         simulation rate; games use 120 for smooth interpolation.
 * @param maxFrameMs the frame clamp. A backgrounded tab, a GC pause or a
 *   breakpoint hands back a delta of seconds; without the clamp that arrives as
 *   hundreds of steps in one frame — the game fast-forwards and drops inputs.
 *   Time past the clamp is deliberately lost: a slow moment plays slightly slow
 *   rather than exploding.
 */
export function createStepper(hz = 120, maxFrameMs = 50): Stepper {
  const stepMs = 1000 / hz
  let acc = 0
  return {
    advance(dtMs: number) {
      // `!(dt > 0)` also catches NaN, which would otherwise poison the
      // accumulator permanently.
      const dt = !(dtMs > 0) ? 0 : Math.min(dtMs, maxFrameMs)
      acc += dt
      const steps = Math.floor(acc / stepMs)
      // Floating point can round `acc / stepMs` up to a whole number that
      // `steps * stepMs` then overshoots; clamp so alpha never goes negative.
      acc = Math.max(0, acc - steps * stepMs)
      return { steps, alpha: acc / stepMs }
    },
    reset() {
      acc = 0
    },
  }
}
