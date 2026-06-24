import { useEffect, useRef, useState } from 'react'
import { useMotion } from '../lib/motion'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Decorative live telemetry readout — sells the real-time-system fantasy at the
 * point of ingest, then fades out as you scroll into the journey so it never
 * overlaps content.
 */
export function TelemetryHud() {
  const { reduced } = useMotion()
  const ref = useRef<HTMLElement>(null)
  const [tp, setTp] = useState(8681)
  const [p99, setP99] = useState(41)
  const [lag, setLag] = useState(0)

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => {
      setTp((v) => clamp(Math.round(v + (Math.random() - 0.5) * 440 + (8681 - v) * 0.22), 7300, 9950))
      setP99((v) => clamp(Math.round(v + (Math.random() - 0.5) * 9 + (40 - v) * 0.3), 27, 72))
      setLag(() => (Math.random() < 0.86 ? 0 : Math.floor(Math.random() * 3)))
    }, 900)
    return () => window.clearInterval(id)
  }, [reduced])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      el.classList.toggle('is-hidden', window.scrollY > window.innerHeight * 0.55)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <aside ref={ref} className="hud" aria-hidden="true">
      <div className="hud-head">
        <span className="hud-dot" />
        STREAM · LIVE
      </div>
      <dl className="hud-grid">
        <div>
          <dt>throughput</dt>
          <dd>
            {tp.toLocaleString('en-US')} <i>rec/s</i>
          </dd>
        </div>
        <div>
          <dt>p99 latency</dt>
          <dd>
            {p99} <i>ms</i>
          </dd>
        </div>
        <div>
          <dt>consumer lag</dt>
          <dd>{lag}</dd>
        </div>
      </dl>
    </aside>
  )
}
