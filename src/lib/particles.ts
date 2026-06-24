/* Pixel-confetti bursts on a lazily-created fullscreen canvas.
   Runs the rAF loop only while particles are alive. */

type P = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  rot: number
  vr: number
}

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let parts: P[] = []
let raf = 0
let W = 0
let H = 0

function resize() {
  if (!canvas || !ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = window.innerWidth
  H = window.innerHeight
  canvas.width = Math.floor(W * dpr)
  canvas.height = Math.floor(H * dpr)
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function ensure() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.className = 'fx-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
}

function loop() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.life++
    p.vy += 0.26
    p.vx *= 0.99
    p.x += p.vx
    p.y += p.vy
    p.rot += p.vr
    const t = p.life / p.max
    if (t >= 1 || p.y > H + 40) {
      parts.splice(i, 1)
      continue
    }
    ctx.globalAlpha = 1 - t * t
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  raf = parts.length ? requestAnimationFrame(loop) : 0
}

export function burst(
  x: number,
  y: number,
  opts?: { count?: number; colors?: string[]; power?: number },
) {
  ensure()
  const count = opts?.count ?? 40
  const colors = opts?.colors ?? ['#5be9ff', '#ffc24b', '#5ef0a1', '#ff5d73']
  const power = opts?.power ?? 9
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = power * (0.35 + Math.random() * 1)
    parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 3,
      life: 0,
      max: 42 + Math.random() * 34,
      size: 3 + Math.random() * 4,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.34,
    })
  }
  if (!raf) raf = requestAnimationFrame(loop)
}

/** burst centred on an element */
export function burstFrom(el: Element | null, opts?: Parameters<typeof burst>[2]) {
  if (!el) return
  const r = el.getBoundingClientRect()
  burst(r.left + r.width / 2, r.top + r.height / 2, opts)
}
