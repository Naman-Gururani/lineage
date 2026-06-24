import { useEffect, useRef } from 'react'
import { SCALE } from '../data/content'
import { Reveal } from '../components/Reveal'
import { Counter } from '../components/Counter'
import { ScrollTrigger } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { flow } from '../lib/flow'

export function Scale() {
  const ref = useRef<HTMLElement>(null)
  const { reduced } = useMotion()

  useEffect(() => {
    if (reduced || !ref.current) return
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        flow.intensity = Math.sin(self.progress * Math.PI)
      },
      onLeave: () => (flow.intensity = 0),
      onLeaveBack: () => (flow.intensity = 0),
    })
    return () => {
      flow.intensity = 0
      st.kill()
    }
  }, [reduced])

  return (
    <section id="scale" className="section scale" ref={ref}>
      <div className="container">
        <header className="section-head center">
          <p className="eyebrow">
            <span className="node-anchor" data-thread-node aria-hidden="true" />
            05 — Scale
          </p>
          <Reveal as="h2" className="section-title">
            {SCALE.heading}
          </Reveal>
          <Reveal as="p" className="section-intro">
            {SCALE.intro}
          </Reveal>
        </header>

        <div className="stats">
          {SCALE.stats.map((s) => (
            <Reveal className="stat" key={s.label}>
              <div className="stat-num">
                {s.kind === 'static' ? (
                  <span className="mono">{s.display}</span>
                ) : (
                  <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
                )}
              </div>
              <div className="stat-label">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
