import { useEffect, useRef } from 'react'
import { useMotion } from '../lib/motion'
import { flow } from '../lib/flow'

type Particle = {
  x: number
  y: number
  vy: number
  len: number
  w: number
  amber: boolean
  a: number
  phase: number
  sw: number
  amp: number
}

/**
 * The record field: a sparse stream of particles drifting downward through the
 * system. Calm by default; it surges during the SCALE stage (flow.intensity).
 * Disabled entirely under reduced-motion.
 */
export function BackgroundCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const { reduced } = useMotion()

  useEffect(() => {
    if (reduced) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let W = 0
    let H = 0
    let particles: Particle[] = []
    let raf = 0

    const make = (): Particle => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: 0.25 + Math.random() * 0.9,
      len: 6 + Math.random() * 26,
      w: 0.8 + Math.random() * 0.9,
      amber: Math.random() < 0.13,
      a: 0.05 + Math.random() * 0.16,
      phase: Math.random() * Math.PI * 2,
      sw: 0.004 + Math.random() * 0.01,
      amp: 0.2 + Math.random() * 0.8,
    })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const target = Math.round(Math.min(150, Math.max(34, (W * H) / 15500)))
      if (particles.length > target) particles.length = target
      while (particles.length < target) particles.push(make())
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      ctx.clearRect(0, 0, W, H)
      const intensity = flow.intensity
      const speed = 1 + intensity * 2.6
      const bright = 0.55 + intensity * 1.0
      for (const p of particles) {
        p.phase += p.sw
        p.y += p.vy * speed
        if (p.y - p.len > H) {
          p.y = -p.len
          p.x = Math.random() * W
        }
        const x = p.x + Math.sin(p.phase) * p.amp
        const alpha = Math.min(0.5, p.a * bright)
        ctx.strokeStyle = p.amber
          ? `rgba(245,177,76,${alpha})`
          : `rgba(94,234,212,${alpha})`
        ctx.lineWidth = p.w
        ctx.beginPath()
        ctx.moveTo(x, p.y)
        ctx.lineTo(x - Math.sin(p.phase) * p.amp * 0.6, p.y - p.len)
        ctx.stroke()
      }
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        raf = requestAnimationFrame(frame)
      }
    }

    resize()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced])

  if (reduced) return null
  return <canvas ref={ref} className="bg-canvas" aria-hidden="true" />
}
