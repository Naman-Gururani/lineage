import { useEffect, useRef } from 'react'
import { ScrollTrigger } from '../lib/gsap'
import { useMotion } from '../lib/motion'

type Pt = { x: number; y: number }

// Smooth path through points (Catmull-Rom -> cubic bezier).
function catmullRom(points: Pt[], k = 1): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * k
    const c1y = p1.y + ((p2.y - p0.y) / 6) * k
    const c2x = p2.x - ((p3.x - p1.x) / 6) * k
    const c2y = p2.y - ((p3.y - p1.y) / 6) * k
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function lengthAtPoint(path: SVGPathElement, total: number, t: Pt, steps = 260): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i <= steps; i++) {
    const l = (total * i) / steps
    const pt = path.getPointAtLength(l)
    const dd = (pt.x - t.x) ** 2 + (pt.y - t.y) ** 2
    if (dd < bestD) {
      bestD = dd
      best = l
    }
  }
  return best
}

/**
 * The lineage — one continuous, unbranching thread that draws itself through
 * the whole page as you scroll, lighting a node at each stage. This is the
 * literal translation of the engineering invariant: exactly one upstream,
 * exactly one downstream.
 */
export function LineageThread() {
  const svgRef = useRef<SVGSVGElement>(null)
  const trackRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGPathElement>(null)
  const drawRef = useRef<SVGPathElement>(null)
  const cometRef = useRef<SVGGElement>(null)
  const nodesRef = useRef<SVGGElement>(null)
  const { reduced } = useMotion()

  useEffect(() => {
    const svg = svgRef.current
    const track = trackRef.current
    const glow = glowRef.current
    const draw = drawRef.current
    const comet = cometRef.current
    const nodesG = nodesRef.current
    if (!svg || !track || !glow || !draw || !comet || !nodesG) return

    let length = 0
    let nodeLengths: number[] = []
    let nodeEls: SVGCircleElement[] = []
    let st: ScrollTrigger | null = null
    const svgNS = 'http://www.w3.org/2000/svg'

    // x position per stage (fraction of width) — the weave.
    const weave = [0.5, 0.27, 0.71, 0.29, 0.63, 0.5]

    const build = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-thread-node]'))
      if (nodes.length < 2) return
      const W = window.innerWidth
      const docH = document.documentElement.scrollHeight
      // compress the weave toward centre on narrow screens
      const narrow = Math.min(1, Math.max(0, (780 - W) / (780 - 360)))
      const pts: Pt[] = nodes.map((el, i) => {
        const r = el.getBoundingClientRect()
        const fx = weave[i] ?? 0.5
        const x = (fx + (0.5 - fx) * narrow * 0.72) * W
        return { x, y: r.top + window.scrollY + r.height / 2 }
      })
      const d = catmullRom(pts)
      track.setAttribute('d', d)
      glow.setAttribute('d', d)
      draw.setAttribute('d', d)
      svg.setAttribute('viewBox', `0 0 ${W} ${docH}`)
      svg.setAttribute('width', String(W))
      svg.setAttribute('height', String(docH))
      svg.style.height = docH + 'px'

      length = draw.getTotalLength()
      draw.style.strokeDasharray = String(length)
      glow.style.strokeDasharray = String(length)
      nodeLengths = pts.map((p) => lengthAtPoint(draw, length, p))

      nodesG.replaceChildren()
      nodeEls = pts.map((p, i) => {
        const c = document.createElementNS(svgNS, 'circle')
        c.setAttribute('cx', p.x.toFixed(1))
        c.setAttribute('cy', p.y.toFixed(1))
        c.setAttribute('r', i === 0 ? '6' : '5')
        c.setAttribute('class', 'thread-node')
        nodesG.appendChild(c)
        return c
      })
    }

    const apply = (progress: number) => {
      const cur = length * progress
      const offset = String(Math.max(0, length - cur))
      draw.style.strokeDashoffset = offset
      glow.style.strokeDashoffset = offset
      if (length > 0) {
        const pt = draw.getPointAtLength(cur)
        comet.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`)
      }
      comet.style.opacity = progress > 0.002 && progress < 0.997 ? '1' : '0'
      for (let i = 0; i < nodeEls.length; i++) {
        nodeEls[i].classList.toggle('is-on', cur >= nodeLengths[i] - 2)
      }
    }

    const setupScrub = () => {
      if (reduced) {
        draw.style.strokeDashoffset = '0'
        glow.style.strokeDashoffset = '0'
        comet.style.opacity = '0'
        nodeEls.forEach((n) => n.classList.add('is-on'))
        return
      }
      draw.style.strokeDashoffset = String(length)
      glow.style.strokeDashoffset = String(length)
      st?.kill()
      st = ScrollTrigger.create({
        start: 0,
        end: 'max',
        scrub: 0.4,
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      })
      apply(0)
    }

    const init = () => {
      build()
      setupScrub()
    }

    let debounceId = 0
    const onResize = () => {
      window.clearTimeout(debounceId)
      debounceId = window.setTimeout(() => {
        build()
        if (reduced) {
          draw.style.strokeDashoffset = '0'
          glow.style.strokeDashoffset = '0'
          nodeEls.forEach((n) => n.classList.add('is-on'))
        } else {
          ScrollTrigger.refresh()
        }
      }, 180)
    }

    const raf = requestAnimationFrame(init)
    // rebuild once layout truly settles (fonts, late reflow)
    const t1 = window.setTimeout(onResize, 650)
    window.addEventListener('resize', onResize)
    window.addEventListener('load', onResize)
    if (document.fonts?.ready) document.fonts.ready.then(onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(debounceId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('load', onResize)
      st?.kill()
    }
  }, [reduced])

  return (
    <div className="thread-wrap" aria-hidden="true">
      <svg ref={svgRef} className="thread-svg" fill="none" preserveAspectRatio="none">
        <path ref={trackRef} className="thread-track" />
        <path ref={glowRef} className="thread-glow" />
        <path ref={drawRef} className="thread-draw" />
        <g ref={nodesRef} className="thread-nodes" />
        <g ref={cometRef} className="thread-comet" style={{ opacity: 0 }}>
          <circle r="10" className="comet-glow" />
          <circle r="3.4" className="comet-core" />
        </g>
      </svg>
    </div>
  )
}
