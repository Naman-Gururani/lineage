import { WORK, PROFILE } from '../data/content'
import { Reveal } from '../components/Reveal'
import { LineageDiagram } from '../components/LineageDiagram'

export function Work() {
  return (
    <section id="lineage" className="section work">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">
            <span className="node-anchor" data-thread-node aria-hidden="true" />
            04 — Lineage
          </p>
          <Reveal as="h2" className="section-title">
            {WORK.heading}
          </Reveal>
          <Reveal as="p" className="section-intro">
            {WORK.intro}
          </Reveal>
        </header>

        <Reveal className="diagram-wrap">
          <LineageDiagram />
        </Reveal>

        <div className="projects">
          {WORK.projects.map((proj) => (
            <Reveal className={`project project-${proj.kind}`} key={proj.title}>
              <article>
                <div className="project-top mono">
                  <span className="project-status">
                    <span className="project-status-dot" aria-hidden="true" />
                    {proj.status}
                  </span>
                  <span className="project-context">{proj.context}</span>
                </div>
                <h3 className="project-title">{proj.title}</h3>
                <p className="project-blurb">{proj.blurb}</p>
                {proj.tech.length > 0 ? (
                  <ul className="chips chips-sm">
                    {proj.tech.map((t) => (
                      <li className="chip" key={t}>
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="redacted" aria-hidden="true">
                    <span className="redacted-tag mono">// payload withheld</span>
                    <div className="redacted-bars">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                )}
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="work-more">
          <a
            className="link-arrow"
            href={PROFILE.github}
            target="_blank"
            rel="noopener noreferrer"
          >
            More on GitHub <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Reveal>
      </div>
    </section>
  )
}
