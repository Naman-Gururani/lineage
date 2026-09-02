// The drawing surface the canvas games share.
//
// A canvas has two sizes: the CSS box the browser lays out, and the backing store
// it actually rasterises into. Leave them equal on a 2× screen and every line the
// game draws is upscaled and soft. So the backing store is sized in device pixels
// and the context scaled to match, which lets a game go on thinking in the logical
// pixels its constants are written in.
import { el } from '../modal'

export type Surface = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /** logical size — the coordinate space the game draws in */
  w: number
  h: number
  dpr: number
}

/**
 * Past 3× the extra pixels are past what anyone can see, and a phone asking for
 * 4× a 640×420 board would be rasterising 4.3 megapixels every frame.
 */
const MAX_DPR = 3

export function makeCanvas(root: HTMLElement, w: number, h: number, opts: { pixelated?: boolean; label: string }): Surface {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  const canvas = el('canvas', 'mg-canvas')
  // Round: `width` truncates to a whole number, and the 1.25 / 1.5 ratios Windows
  // hands out would otherwise leave the buffer a fraction short of the scale.
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  // CSS gives the element its width; the ratio gives it its height, so the box
  // always matches what is drawn into it however the panel is sized.
  canvas.style.aspectRatio = `${w}/${h}`
  // The same ratio as a bare number: `aspect-ratio` alone cannot stop a height cap
  // from clamping the height while the width stays put, which stretches the
  // bitmap. panels.css feeds this into a calc() that caps the *width* instead.
  canvas.style.setProperty('--ar', String(w / h))
  canvas.style.imageRendering = opts.pixelated ? 'pixelated' : 'auto'
  // A canvas is opaque to assistive tech: `img` plus a name is the honest
  // description, and the tab stop lets a keyboard player focus the game itself.
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', opts.label)
  canvas.tabIndex = 0

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('makeCanvas: no 2d context on this canvas')
  ctx.scale(dpr, dpr)
  // Pixel art wants nearest-neighbour on both paths: the browser's upscale of the
  // element (imageRendering) and the context's own draws of sprites.
  ctx.imageSmoothingEnabled = !opts.pixelated

  root.append(canvas)
  return { canvas, ctx, w, h, dpr }
}
