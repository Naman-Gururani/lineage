// Procedural pixel painters for things that are tedious to hand-author: glows,
// shadows, particles, animated strips. Deterministic per variant.
//
// The foliage and rock painters that used to live here (paintTree, paintPine,
// paintPalm, paintBush, paintRock) were superseded by the hand-authored HD
// sprites in `sprites/env.ts` and `sprites/props.ts`; nothing imported them any
// more, so they and their private shading helpers are gone.
import { makeRng } from '../core/rng'
import { PAL, type PalKey } from './palette'
import { hex, outlineRaster } from './pixel'
import { makeRaster, setPx, type RGBA, type Raster } from './raster'

export const K = (k: PalKey, alpha?: number): RGBA => {
  const c = hex(PAL[k])
  return alpha === undefined ? c : [c[0], c[1], c[2], alpha]
}

/** Light/mid/dark ramp — the shape every shaded painter here takes its colours in. */
export type Tones = { light: RGBA; mid: RGBA; dark: RGBA }

/** Copy `src` pixels into `dst` (same size). */
function copyInto(dst: Raster, src: Raster) {
  dst.data.set(src.data)
}

/** Run `fn` on a scratch raster, outline it, then write into `r`. */
export function withOutline(r: Raster, fn: (s: Raster) => void, color = PAL.outline): void {
  const s = makeRaster(r.w, r.h)
  fn(s)
  copyInto(r, outlineRaster(s, color))
}

/** Radial glow (white by default) — used with ERASE for lights and ADD for warm halos. */
export function paintGlow(r: Raster, color: RGBA = [255, 255, 255, 255], power = 1.6): void {
  const cx = (r.w - 1) / 2
  const cy = (r.h - 1) / 2
  const rad = Math.min(r.w, r.h) / 2
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad
      if (d >= 1) continue
      const a = Math.pow(1 - d, power)
      setPx(r, x, y, [color[0], color[1], color[2], Math.round(color[3] * a)])
    }
}

/** Soft cloud shadow blob, 128×96, for MULTIPLY blending. */
export function paintCloudShadow(r: Raster): void {
  const rng = makeRng(777)
  const blobs: [number, number, number, number][] = []
  for (let i = 0; i < 6; i++) blobs.push([rng.range(30, 98), rng.range(30, 66), rng.range(22, 34), rng.range(14, 22)])
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      let v = 0
      for (const [bx, by, rx, ry] of blobs) {
        const d = Math.hypot((x - bx) / rx, (y - by) / ry)
        v = Math.max(v, 1 - d)
      }
      if (v <= 0) continue
      const a = Math.min(1, v * 1.6)
      setPx(r, x, y, [40, 50, 80, Math.round(a * 120)])
    }
}

export function paintDot(r: Raster, color: RGBA): void {
  const cx = (r.w - 1) / 2
  const cy = (r.h - 1) / 2
  const rad = r.w / 2
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad
      if (d <= 1) setPx(r, x, y, [color[0], color[1], color[2], Math.round(color[3] * (d > 0.75 ? 0.5 : 1))])
    }
}

/** Ripple rings 12×6 × 3 frames. */
export function paintRipple(r: Raster): void {
  for (let f = 0; f < 3; f++) {
    const ox = f * 12
    const rx = 2 + f * 2
    const ry = 1 + f
    const alpha = 200 - f * 60
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      const x = Math.round(ox + 5.5 + Math.cos(a) * rx)
      const y = Math.round(2.5 + Math.sin(a) * ry)
      setPx(r, x, y, [232, 248, 255, alpha])
    }
  }
}

/** Lighthouse beam: a soft wedge 160×48, apex at the left-middle. */
export function paintBeam(r: Raster): void {
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const t = x / r.w
      const half = 2 + t * (r.h / 2 - 2)
      const dy = Math.abs(y - r.h / 2 + 0.5)
      if (dy > half) continue
      const edge = 1 - dy / half
      const a = Math.round(150 * (1 - t) * Math.min(1, edge * 2))
      if (a > 0) setPx(r, x, y, [255, 244, 190, a])
    }
}

/** Water 64×64 × 4 frames and foam 16×16 × 4 frames are painted by tiles.ts; wrappers live in env.ts. */
export function paintStrip(r: Raster, frames: number, fn: (r: Raster, ox: number, frame: number) => void): void {
  const fw = r.w / frames
  for (let f = 0; f < frames; f++) fn(r, f * fw, f)
}
