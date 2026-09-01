// Procedural pixel painters for things that are tedious to hand-author:
// foliage, rocks, glows, particles. Deterministic per variant.
import { makeRng, type Rng } from '../core/rng'
import { PAL, type PalKey } from './palette'
import { hex, outlineRaster } from './pixel'
import { fillRect, makeRaster, setPx, type RGBA, type Raster } from './raster'

export const K = (k: PalKey, alpha?: number): RGBA => {
  const c = hex(PAL[k])
  return alpha === undefined ? c : [c[0], c[1], c[2], alpha]
}

export type Tones = { light: RGBA; mid: RGBA; dark: RGBA }
export const LEAF: Tones = { light: K('leafLight'), mid: K('leaf'), dark: K('leafDark') }
export const LEAF_WARM: Tones = { light: K('grassLight'), mid: K('leaf'), dark: K('moss') }
export const PINE: Tones = { light: K('pineLight'), mid: K('pine'), dark: K('pineDark') }
export const STONE: Tones = { light: K('stoneLight'), mid: K('stone'), dark: K('stoneDark') }

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

/** Shaded blob with a jittered, leafy edge. Light comes from the top-left. */
export function blob(r: Raster, cx: number, cy: number, radius: number, tones: Tones, rng: Rng, jitter = 1.2): void {
  const lx = -0.55
  const ly = -0.83
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++)
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.hypot(dx, dy)
      const edge = radius + (rng.next() - 0.5) * jitter
      if (d > edge) continue
      const n = (dx * lx + dy * ly) / radius
      const dither = (x + y) % 2 === 0
      let c: RGBA
      if (n > 0.32 || (n > 0.2 && dither)) c = tones.light
      else if (n < -0.38 || (n < -0.24 && dither)) c = tones.dark
      else c = tones.mid
      setPx(r, x, y, c)
    }
}

export function shadowEllipse(r: Raster, cx: number, cy: number, rx: number, ry: number, alpha = 70): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
      if (d > 1) continue
      const i = (y * r.w + x) * 4
      if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue
      if (r.data[i + 3] > 0) continue // never over the sprite itself
      setPx(r, x, y, [20, 30, 40, d > 0.8 ? alpha / 2 : alpha])
    }
}

function trunk(r: Raster, cx: number, top: number, bottom: number, w: number) {
  const x0 = Math.round(cx - w / 2)
  fillRect(r, x0, top, w, bottom - top, K('wood'))
  fillRect(r, x0 + w - 2, top, 2, bottom - top, K('woodDark'))
  fillRect(r, x0, top, 1, bottom - top, K('woodLight'))
  // root flare
  fillRect(r, x0 - 1, bottom - 2, w + 2, 2, K('woodDark'))
  setPx(r, x0 - 2, bottom - 1, K('woodDark'))
  setPx(r, x0 + w + 1, bottom - 1, K('woodDark'))
}

/** Round deciduous tree, 32×40, base at y=38. */
export function paintTree(r: Raster, v: number): void {
  const rng = makeRng(1000 + v)
  const tones = v % 2 ? LEAF_WARM : LEAF
  withOutline(r, (s) => {
    trunk(s, 16, 20, 38, 6)
    blob(s, 16, 17, 11.5, tones, rng)
    blob(s, 9, 20, 7.5, tones, rng)
    blob(s, 23, 20, 7.5, tones, rng)
    blob(s, 16, 10, 8, tones, rng)
    blob(s, 11, 13, 6, tones, rng)
    // leaf sparkle + bottom shade
    for (let i = 0; i < 8; i++) setPx(s, rng.int(6, 20), rng.int(4, 16), tones.light)
    for (let i = 0; i < 6; i++) setPx(s, rng.int(10, 26), rng.int(20, 28), tones.dark)
  })
  shadowEllipse(r, 16, 38, 12, 3)
}

/** Conifer, 24×40, base at y=38. */
export function paintPine(r: Raster, v: number): void {
  const rng = makeRng(2000 + v)
  withOutline(r, (s) => {
    trunk(s, 12, 28, 38, 4)
    const tiers: [number, number, number][] = [
      [4, 16, 5],
      [12, 26, 8],
      [20, 34, 11],
    ]
    for (const [apex, base, hw] of tiers) {
      for (let y = apex; y <= base; y++) {
        const t = (y - apex) / (base - apex)
        const half = Math.round(hw * t) + (y === base ? (rng.chance(0.5) ? 0 : -1) : 0)
        for (let x = 12 - half; x <= 12 + half; x++) {
          const scallop = y === base && (x + v) % 3 === 0
          if (scallop) continue
          const side = (x - 12) / Math.max(1, hw)
          const c = side < -0.35 ? PINE.light : side > 0.3 ? PINE.dark : PINE.mid
          setPx(s, x, y, c)
        }
      }
    }
    // snow-free highlights
    for (let i = 0; i < 6; i++) setPx(s, rng.int(6, 12), rng.int(8, 30), PINE.light)
  })
  shadowEllipse(r, 12, 38, 9, 3)
}

/** Palm, 32×48, base at y=46. */
export function paintPalm(r: Raster, v: number): void {
  const rng = makeRng(3000 + v)
  withOutline(r, (s) => {
    // curved trunk
    const lean = v % 2 ? 1 : -1
    for (let y = 46; y >= 16; y--) {
      const t = (46 - y) / 30
      const x = Math.round(16 + lean * t * t * 6)
      fillRect(s, x - 1, y, 3, 1, K('wood'))
      setPx(s, x + 1, y, K('woodDark'))
      if (y % 4 === 0) fillRect(s, x - 1, y, 3, 1, K('woodDark'))
    }
    const topX = 16 + lean * 6
    const topY = 16
    // fronds
    const angles = [-160, -120, -75, -35, 10, 45, 100]
    for (const a of angles) {
      const rad = (a * Math.PI) / 180
      const len = 12 + rng.int(0, 3)
      for (let k = 0; k < len; k++) {
        const droop = (k / len) ** 2 * 5
        const x = Math.round(topX + Math.cos(rad) * k)
        const y = Math.round(topY + Math.sin(rad) * k * 0.6 + droop)
        const c = k < len * 0.35 ? LEAF.dark : k > len * 0.7 ? LEAF.light : LEAF.mid
        setPx(s, x, y, c)
        if (k % 2 === 0) setPx(s, x, y + 1, c)
      }
    }
    // coconuts
    fillRect(s, topX - 2, topY + 1, 2, 2, K('woodDark'))
    fillRect(s, topX + 1, topY + 2, 2, 2, K('woodDark'))
  })
  shadowEllipse(r, 16, 46, 10, 3)
}

/** Bush 20×16 (v=1 adds berries). */
export function paintBush(r: Raster, v: number): void {
  const rng = makeRng(4000 + v)
  withOutline(r, (s) => {
    blob(s, 7, 10, 5.5, LEAF, rng)
    blob(s, 13, 10, 5.5, LEAF, rng)
    blob(s, 10, 7, 5, LEAF, rng)
    if (v === 1) for (let i = 0; i < 5; i++) setPx(s, rng.int(4, 16), rng.int(4, 12), K('red'))
  })
  shadowEllipse(r, 10, 15, 8, 2)
}

/** Rock 20×16. */
export function paintRock(r: Raster, v: number): void {
  const rng = makeRng(5000 + v)
  withOutline(r, (s) => {
    const rx = v ? 8 : 6.5
    const ry = v ? 6 : 5
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 20; x++) {
        const dx = (x - 10) / rx
        const dy = (y - 9) / ry
        const d = Math.hypot(dx, dy) + (rng.next() - 0.5) * 0.12
        if (d > 1) continue
        const n = -dx * 0.55 - dy * 0.83
        const c = n > 0.35 ? STONE.light : n < -0.4 ? STONE.dark : STONE.mid
        setPx(s, x, y, c)
        if (y > 12 && d > 0.75) setPx(s, x, y, K('stoneDeep'))
      }
    setPx(s, 8 + v, 6, K('stoneDeep'))
    setPx(s, 9 + v, 7, K('stoneDeep'))
  })
  shadowEllipse(r, 10, 15, 8, 2)
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

/** Packet collectible, 12×12 × 4 frames (pulsing glow). */
export function paintPacket(r: Raster, frames = 4): void {
  const fw = r.w / frames
  for (let f = 0; f < frames; f++) {
    const ox = f * fw
    const pulse = [0.55, 0.8, 1, 0.8][f % 4]
    const cx = ox + fw / 2 - 0.5
    const cy = r.h / 2 - 0.5
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < fw; x++) {
        const d = Math.abs(x + ox - cx) + Math.abs(y - cy)
        if (d <= 3.2) setPx(r, ox + x, y, d < 1.2 ? K('white') : d < 2.3 ? K('tealLight') : K('teal'))
        else if (d <= 5.5) setPx(r, ox + x, y, [143, 240, 224, Math.round(90 * pulse)])
      }
    setPx(r, ox + Math.round(cx) - 1, Math.round(cy) - 1, K('white'))
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
