import { TRANSFORM } from '../data/content'
import { Reveal } from '../components/Reveal'

export function Transform() {
  return (
    <section id="transform" className="section transform">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">
            <span className="node-anchor" data-thread-node aria-hidden="true" />
            03 — Transform
          </p>
          <Reveal as="h2" className="section-title">
            {TRANSFORM.heading}
          </Reveal>
          <Reveal as="p" className="section-intro">
            {TRANSFORM.intro}
          </Reveal>
        </header>

        <div className="stack-grid">
          {TRANSFORM.groups.map((g, i) => (
            <Reveal className="stack-group" key={g.label}>
              <div className="stack-group-head">
                <span className="stack-idx mono">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="stack-label">{g.label}</h3>
              </div>
              <ul className="chips">
                {g.items.map((item) => (
                  <li className="chip" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <Reveal className="method">
          <span className="method-label eyebrow">{TRANSFORM.method.label}</span>
          <h3 className="method-title">{TRANSFORM.method.title}</h3>
          <p className="method-body">{TRANSFORM.method.body}</p>
        </Reveal>
      </div>
    </section>
  )
}
