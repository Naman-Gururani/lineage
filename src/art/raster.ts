// Minimal RGBA raster ops shared by the tile painter, the world baker and the
// Node preview tool. No canvas dependency.

export type RGBA = [number, number, number, number]
export type Raster = { w: number; h: number; data: Uint8ClampedArray<ArrayBuffer> }

export function makeRaster(w: number, h: number): Raster {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) }
}

export function pixelAt(r: Raster, x: number, y: number): RGBA {
  const i = (y * r.w + x) * 4
  return [r.data[i], r.data[i + 1], r.data[i + 2], r.data[i + 3]]
}

export function setPx(r: Raster, x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return
  const i = (y * r.w + x) * 4
  r.data[i] = c[0]
  r.data[i + 1] = c[1]
  r.data[i + 2] = c[2]
  r.data[i + 3] = c[3]
}

export function fillRect(r: Raster, x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(r.w, x + w)
  const y1 = Math.min(r.h, y + h)
  for (let py = y0; py < y1; py++) {
    let i = (py * r.w + x0) * 4
    for (let px = x0; px < x1; px++) {
      r.data[i] = c[0]
      r.data[i + 1] = c[1]
      r.data[i + 2] = c[2]
      r.data[i + 3] = c[3]
      i += 4
    }
  }
}

/** Alpha-composite `src` onto `dst` at (x,y), clipping at the edges. */
export function blit(dst: Raster, src: Raster, x: number, y: number): void {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(dst.w, x + src.w)
  const y1 = Math.min(dst.h, y + src.h)
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const si = ((py - y) * src.w + (px - x)) * 4
      const sa = src.data[si + 3]
      if (sa === 0) continue
      const di = (py * dst.w + px) * 4
      if (sa === 255) {
        dst.data[di] = src.data[si]
        dst.data[di + 1] = src.data[si + 1]
        dst.data[di + 2] = src.data[si + 2]
        dst.data[di + 3] = 255
        continue
      }
      const a = sa / 255
      const da = dst.data[di + 3] / 255
      const outA = a + da * (1 - a)
      for (let k = 0; k < 3; k++) {
        const sc = src.data[si + k]
        const dc = dst.data[di + k]
        dst.data[di + k] = outA === 0 ? 0 : Math.round((sc * a + dc * da * (1 - a)) / outA)
      }
      dst.data[di + 3] = Math.round(outA * 255)
    }
  }
}

/** Multiply every pixel's RGB by a factor (0..1+), leaving alpha. */
export function shade(r: Raster, f: number): void {
  const d = r.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    d[i] = Math.min(255, d[i] * f)
    d[i + 1] = Math.min(255, d[i + 1] * f)
    d[i + 2] = Math.min(255, d[i + 2] * f)
  }
}
