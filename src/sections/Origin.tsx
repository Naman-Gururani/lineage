import { ORIGIN } from '../data/content'
import { Reveal } from '../components/Reveal'

export function Origin() {
  return (
    <section id="origin" className="section origin">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">
            <span className="node-anchor" data-thread-node aria-hidden="true" />
            02 — Origin
          </p>
          <Reveal as="h2" className="section-title">
            {ORIGIN.heading}
          </Reveal>
        </header>

        <div className="origin-grid">
          <Reveal className="origin-body" stagger>
            {ORIGIN.body.map((p) => (
              <p key={p.slice(0, 16)}>{p}</p>
            ))}
          </Reveal>

          <Reveal className="facts" stagger>
            {ORIGIN.facts.map((f) => (
              <div className="fact" key={f.k}>
                <span className="fact-k mono">{f.k}</span>
                <span className="fact-v">{f.v}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
