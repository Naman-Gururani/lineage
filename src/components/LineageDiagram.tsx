import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'
import { useMotion } from '../lib/motion'

const NODES = ['Ingest', 'Tokenize', 'Jurisdiction', 'Map', 'Lineage', 'Sink']

/**
 * A chain of decoupled stages. Each link is single — one upstream, one
 * downstream — and a record pulses through end to end, continuously.
 */
export function LineageDiagram() {
  const svgRef = useRef<SVGSVGElement>(null)
  const pulseRef = useRef<SVGPathElement>(null)
  const { reduced } = useMotion()

  const W = 1000
  const H = 112
  const padX = 72
  const y = 56
  const n = NODES.length
  const step = (W - padX * 2) / (n - 1)
  const xs = NODES.map((_, i) => padX + i * step)
  const dLine = `M ${xs[0]} ${y} ` + xs.slice(1).map((x) => `L ${x} ${y}`).join(' ')

  useEffect(() => {
    const p = pulseRef.current
    const svg = svgRef.current
    if (!p || !svg) return
    const L = p.getTotalLength()
    const dash = (L / (n - 1)) * 0.5
    p.style.strokeDasharray = `${dash} ${L}`

    if (reduced) {
      p.style.strokeDashoffset = String(-L * 0.5)
      return
    }

    p.style.strokeDashoffset = '0'
    const tween = gsap.to(p, {
      strokeDashoffset: -(L + dash),
      duration: 3.6,
      ease: 'none',
      repeat: -1,
    })
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? tween.play() : tween.pause()),
      { threshold: 0 },
    )
    io.observe(svg)
    return () => {
      tween.kill()
      io.disconnect()
    }
  }, [reduced, n])

  return (
    <div className="ld">
      <svg
        ref={svgRef}
        className="lineage-diagram"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="A chain of six decoupled stages — ingest, tokenize, jurisdiction, map, lineage, sink — each linked to exactly one upstream and one downstream, with a record pulsing through end to end."
      >
        <path d={dLine} className="ld-track" />
        {xs.slice(0, -1).map((x, i) => {
          const mx = x + step / 2
          return (
            <polyline
              key={i}
              className="ld-arrow"
              points={`${mx - 6},${y - 4.5} ${mx + 3},${y} ${mx - 6},${y + 4.5}`}
            />
          )
        })}
        <path ref={pulseRef} d={dLine} className="ld-pulse" />
        {NODES.map((label, i) => (
          <g key={label} className="ld-node" transform={`translate(${xs[i]} ${y})`}>
            <circle r="11" className="ld-halo" />
            <circle r="6.5" className="ld-dot" />
          </g>
        ))}
      </svg>
      <ul className="ld-legend mono" aria-hidden="true">
        {NODES.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </div>
  )
}
