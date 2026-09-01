import type { Rng } from './rng'

const smooth = (a: number) => a * a * (3 - 2 * a)
const lerp = (a: number, b: number, f: number) => a + (b - a) * f

/** Two-octave value noise in [0,1), seeded from `rng`. `cell` is the lattice size. */
export function makeNoise(rng: Rng, cell = 6): (x: number, y: number) => number {
  const sa = rng.int(1, 2 ** 30)
  const sb = rng.int(1, 2 ** 30)
  const hash = (ix: number, iy: number, s: number) => {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + s) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  const octave = (x: number, y: number, size: number, s: number) => {
    const gx = x / size
    const gy = y / size
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const fx = smooth(gx - ix)
    const fy = smooth(gy - iy)
    const a = hash(ix, iy, s)
    const b = hash(ix + 1, iy, s)
    const c = hash(ix, iy + 1, s)
    const d = hash(ix + 1, iy + 1, s)
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
  }
  return (x, y) => 0.65 * octave(x, y, cell, sa) + 0.35 * octave(x, y, cell / 2.3, sb)
}
