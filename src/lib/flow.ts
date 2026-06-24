/* Tiny shared store read by the rAF-driven background canvas.
   Kept outside React so the render loop never triggers re-renders. */
export const flow = {
  intensity: 0, // 0..1 — peaks during the SCALE stage
}
