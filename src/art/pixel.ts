// ASCII pixel-art painter. Sprites are authored as rows of characters mapped
// through a legend to palette keys. The core is canvas-free so it can be unit
// tested and previewed from Node; `toCanvas`/`buildSheet` are browser-only.
import { PAL, type PalKey } from './palette'
import type { Raster } from './raster'

export type { Raster }

export type Legend = Record<string, PalKey | 'transparent' | `#${string}` | `rgba(${string})`>

export type SpriteDef = {
  name: string
  /** ASCII rows (omit when using ) */
  rows?: string[]
  legend: Legend
  /** procedural sprites: size + painter instead of rows */
  w?: number
  h?: number
  paint?: (r: Raster) => void
  /** auto 1px outline (4-connected) painted into transparent neighbours */
  outline?: PalKey
  /** horizontal strip: the rows hold `frames` frames side by side */
  frames?: number
  /** origin in frame pixels; default bottom-centre */
  anchor?: [number, number]
}


export type Placement = { x: number; y: number; w: number; h: number; frames: number }

export type Sheet = {
  canvas: HTMLCanvasElement
  frames: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }>
}

export function hex(c: string): [number, number, number, number] {
  if (c[0] === '#') {
    if (c.length === 4) {
      const r = parseInt(c[1] + c[1], 16)
      const g = parseInt(c[2] + c[2], 16)
      const b = parseInt(c[3] + c[3], 16)
      return [r, g, b, 255]
    }
    const n = parseInt(c.slice(1, 7), 16)
    const a = c.length === 9 ? parseInt(c.slice(7, 9), 16) : 255
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
  }
  const m = /rgba?\(([^)]+)\)/.exec(c)
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s))
    return [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255]
  }
  throw new Error(`bad colour "${c}"`)
}

const colorCache = new Map<string, [number, number, number, number]>()
function colorOf(v: string): [number, number, number, number] {
  let c = colorCache.get(v)
  if (!c) {
    c = hex(v)
    colorCache.set(v, c)
  }
  return c
}

function resolve(def: SpriteDef, ch: string): [number, number, number, number] | null {
  const v = def.legend[ch]
  if (v === undefined) {
    if (ch === '.' || ch === ' ') return null
    throw new Error(`Sprite "${def.name}": unknown char "${ch}"`)
  }
  if (v === 'transparent') return null
  if (v in PAL) return colorOf(PAL[v as PalKey])
  if (v.startsWith('#') || v.startsWith('rgb')) return colorOf(v)
  throw new Error(`Sprite "${def.name}": unknown colour "${v}"`)
}

export function sizeOf(def: SpriteDef): { w: number; h: number } {
  if (def.paint) {
    if (!def.w || !def.h) throw new Error(`Sprite "${def.name}": procedural defs need w and h`)
    return { w: def.w, h: def.h }
  }
  const rows = def.rows ?? []
  let w = 0
  for (const r of rows) if (r.length > w) w = r.length
  return { w, h: rows.length }
}

export function rasterize(def: SpriteDef): Raster {
  const { w, h } = sizeOf(def)
  const data = new Uint8ClampedArray(w * h * 4)
  if (def.paint) {
    const r = { w, h, data }
    def.paint(r)
    return def.outline ? outlineRaster(r, PAL[def.outline]) : r
  }
  const rows = def.rows ?? []
  for (let y = 0; y < h; y++) {
    const row = rows[y]
    for (let x = 0; x < row.length; x++) {
      const c = resolve(def, row[x])
      if (!c) continue
      const i = (y * w + x) * 4
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = c[3]
    }
  }
  const r = { w, h, data }
  return def.outline ? outlineRaster(r, PAL[def.outline]) : r
}

/** Paint `color` into every transparent pixel that touches an opaque one (4-connected). */
export function outlineRaster(r: Raster, color: string): Raster {
  const c = colorOf(color)
  const out = new Uint8ClampedArray(r.data)
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= r.w || y >= r.h ? 0 : r.data[(y * r.w + x) * 4 + 3]
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      if (alpha(x, y) > 0) continue
      if (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1)) {
        const i = (y * r.w + x) * 4
        out[i] = c[0]
        out[i + 1] = c[1]
        out[i + 2] = c[2]
        out[i + 3] = c[3]
      }
    }
  return { w: r.w, h: r.h, data: out }
}

/** Mirror a def horizontally (frame by frame for strips) under a new name. */
export function mirrorDef(def: SpriteDef, name: string): SpriteDef {
  if (!def.rows) throw new Error(`Sprite "${def.name}": cannot mirror a procedural def`)
  const frames = def.frames ?? 1
  const { w } = sizeOf(def)
  const fw = w / frames
  const rows = def.rows.map((row) => {
    const padded = row.padEnd(w, '.')
    let out = ''
    for (let f = 0; f < frames; f++) out += padded.slice(f * fw, (f + 1) * fw).split('').reverse().join('')
    return out
  })
  const anchor = def.anchor ? ([fw - def.anchor[0], def.anchor[1]] as [number, number]) : undefined
  return { ...def, name, rows, anchor }
}

/** Shelf-pack sprite rectangles (1px gutter). */
export function packSheet(defs: SpriteDef[], maxW = 1024): { w: number; h: number; place: Record<string, Placement> } {
  const items = defs.map((d) => ({ d, ...sizeOf(d) }))
  items.sort((a, b) => b.h - a.h || b.w - a.w || (a.d.name < b.d.name ? -1 : 1))
  let sheetW = maxW
  for (const it of items) if (it.w > sheetW) sheetW = it.w
  const place: Record<string, Placement> = {}
  let x = 0
  let y = 0
  let shelfH = 0
  for (const it of items) {
    if (x + it.w > sheetW) {
      x = 0
      y += shelfH + 1
      shelfH = 0
    }
    place[it.d.name] = { x, y, w: it.w, h: it.h, frames: it.d.frames ?? 1 }
    x += it.w + 1
    if (it.h > shelfH) shelfH = it.h
  }
  return { w: sheetW, h: y + shelfH, place }
}

/* ---------------- browser-only helpers ---------------- */

export function toCanvas(r: Raster): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = r.w
  canvas.height = r.h
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(new ImageData(r.data, r.w, r.h), 0, 0)
  return canvas
}

export function buildSheet(defs: SpriteDef[], maxW = 1024): Sheet {
  const seen = new Set<string>()
  for (const d of defs) {
    if (seen.has(d.name)) throw new Error(`duplicate sprite name "${d.name}"`)
    seen.add(d.name)
  }
  const pack = packSheet(defs, maxW)
  const canvas = document.createElement('canvas')
  canvas.width = pack.w
  canvas.height = Math.max(1, pack.h)
  const ctx = canvas.getContext('2d')!
  const frames: Sheet['frames'] = {}
  for (const d of defs) {
    const p = pack.place[d.name]
    const r = rasterize(d)
    ctx.putImageData(new ImageData(r.data, r.w, r.h), p.x, p.y)
    const fw = p.w / p.frames
    const ax = d.anchor ? d.anchor[0] : fw / 2
    const ay = d.anchor ? d.anchor[1] : p.h
    if (p.frames === 1) frames[d.name] = { x: p.x, y: p.y, w: p.w, h: p.h, ax, ay }
    else for (let f = 0; f < p.frames; f++) frames[`${d.name}_${f}`] = { x: p.x + f * fw, y: p.y, w: fw, h: p.h, ax, ay }
  }
  return { canvas, frames }
}
