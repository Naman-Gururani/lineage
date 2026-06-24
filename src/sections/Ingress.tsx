import { useLayoutEffect, useRef } from 'react'
import { HERO, PROFILE } from '../data/content'
import { gsap } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { Magnetic } from '../components/Magnetic'

export function Ingress() {
  const ref = useRef<HTMLElement>(null)
  const { reduced, scrollTo } = useMotion()

  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.hero-eyebrow', { y: 18, autoAlpha: 0, duration: 0.7 })
        .from('.hero-meta', { y: 12, autoAlpha: 0, duration: 0.6 }, '-=0.35')
        .from('.hero-line', { yPercent: 118, duration: 1.05, stagger: 0.12 }, '-=0.2')
        .from('.hero-sub', { y: 20, autoAlpha: 0, duration: 0.8 }, '-=0.55')
        .from('.hero-actions > *', { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, '-=0.5')
    }, ref)
    return () => ctx.revert()
  }, [reduced])

  return (
    <section id="ingress" className="hero" ref={ref}>
      <div className="container hero-inner">
        <p className="eyebrow hero-eyebrow">
          <span className="pulse-dot" aria-hidden="true" />
          {HERO.kicker} · ~{HERO.throughput.toLocaleString('en-US')} rec/s
        </p>

        <span className="node-anchor" data-thread-node aria-hidden="true" />

        <p className="hero-meta mono">
          <span>{PROFILE.role}</span>
          <span className="sep" aria-hidden="true">/</span>
          <span>{PROFILE.company}</span>
          <span className="sep" aria-hidden="true">/</span>
          <span>since {PROFILE.since}</span>
        </p>

        <h1 className="hero-title">
          {HERO.headlineLines.map((line, i) => (
            <span className="line-mask" key={line}>
              <span
                className={`hero-line${i === HERO.headlineLines.length - 1 ? ' hero-line--accent' : ''}`}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>

        <p className="hero-sub">{HERO.sub}</p>

        <div className="hero-actions">
          <Magnetic>
            <button className="btn btn-primary" onClick={() => scrollTo('#origin')}>
              {HERO.cta}
              <span className="btn-arrow" aria-hidden="true">↓</span>
            </button>
          </Magnetic>
          <span className="rec-chip mono" aria-hidden="true">
            <span className="rec-dot" /> rec ◦ ingested
          </span>
        </div>
      </div>
    </section>
  )
}
