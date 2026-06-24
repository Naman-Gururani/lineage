import { EGRESS, PROFILE } from '../data/content'
import { Reveal } from '../components/Reveal'
import { useMotion } from '../lib/motion'

const LINKS = [
  { label: 'Email', value: PROFILE.email, href: `mailto:${PROFILE.email}`, ext: false },
  { label: 'GitHub', value: PROFILE.githubHandle, href: PROFILE.github, ext: true },
  { label: 'LinkedIn', value: PROFILE.linkedinHandle, href: PROFILE.linkedin, ext: true },
]

export function Egress() {
  const { scrollTo } = useMotion()

  return (
    <section id="egress" className="section egress">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">
            <span className="node-anchor" data-thread-node aria-hidden="true" />
            06 — Egress
          </p>
          <Reveal as="h2" className="section-title">
            {EGRESS.heading}
          </Reveal>
          <Reveal as="p" className="section-intro">
            {EGRESS.body}
          </Reveal>
        </header>

        <Reveal className="connect" stagger>
          {LINKS.map((l) => (
            <a
              key={l.label}
              className="connect-link"
              href={l.href}
              {...(l.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <span className="connect-label mono">{l.label}</span>
              <span className="connect-value">{l.value}</span>
              {l.ext && <span className="sr-only"> (opens in a new tab)</span>}
              <span className="connect-arrow" aria-hidden="true">
                {l.ext ? '↗' : '→'}
              </span>
            </a>
          ))}
        </Reveal>

        <div className="egress-foot">
          <span className="rec-chip mono" aria-hidden="true">
            <span className="rec-dot rec-dot-amber" /> {EGRESS.closing}
          </span>
          <button className="replay mono" onClick={() => scrollTo(0)}>
            <span aria-hidden="true">↑</span> Replay the trace
          </button>
        </div>
      </div>
    </section>
  )
}
