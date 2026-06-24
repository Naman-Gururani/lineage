import {
  EXPERIENCE,
  SKILLS,
  SKILL_CATS,
  SKILL_METHOD,
  PROJECTS,
  CONTACT,
  PROFILE,
  type ModuleId,
} from '../data/content'

function Experience() {
  return (
    <div className="mc mc-exp">
      {EXPERIENCE.map((e) => (
        <article className="mc-job" key={e.role + e.span}>
          <div className="mc-job-head">
            <h3>{e.role}</h3>
            <span className="mc-org mono">
              {e.org}
              {e.now && <i className="dot-live" aria-label="current" />}
            </span>
            <span className="mc-span mono">{e.span}</span>
          </div>
          <ul className="mc-points">
            {e.points.map((p) => (
              <li key={p.slice(0, 18)}>{p}</li>
            ))}
          </ul>
          <ul className="chips chips-sm">
            {e.tags.map((t) => (
              <li className="chip" key={t}>
                {t}
              </li>
            ))}
          </ul>
        </article>
      ))}
      <div className="mc-edu">
        <span className="pixel mc-edu-k">EDU</span>
        <div>
          <h4>{PROFILE.education.degree}</h4>
          <p className="mono dim">
            {PROFILE.education.school} · {PROFILE.education.span} · CGPA {PROFILE.education.cgpa}
          </p>
        </div>
      </div>
    </div>
  )
}

function Skills() {
  return (
    <div className="mc mc-skills">
      <div className="skill-cats">
        {SKILL_CATS.map((c) => (
          <div className={`skill-cat sc-${c.key}`} key={c.key}>
            <span className="pixel skill-cat-h">{c.short}</span>
            <h4>{c.label}</h4>
            <ul className="chips">
              {SKILLS.filter((s) => s.cat === c.key).map((s) => (
                <li className="chip" key={s.name}>
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="skill-method">
        <span className="pixel skill-method-k">METHOD</span>
        <h4>{SKILL_METHOD.title}</h4>
        <p>{SKILL_METHOD.body}</p>
      </div>
    </div>
  )
}

function Projects() {
  return (
    <div className="mc mc-projects">
      {PROJECTS.map((p) => (
        <article className={`proj proj-${p.accent}`} key={p.title}>
          <div className="proj-top mono">
            <span className="proj-status">
              <i className="dot" aria-hidden="true" />
              {p.status}
            </span>
            <span className="proj-ctx">{p.context}</span>
          </div>
          <h3>{p.title}</h3>
          <p>{p.blurb}</p>
          {p.tags.length > 0 && (
            <ul className="chips chips-sm">
              {p.tags.map((t) => (
                <li className="chip" key={t}>
                  {t}
                </li>
              ))}
            </ul>
          )}
          {p.link && (
            <a className="proj-link mono" href={p.link} target="_blank" rel="noopener noreferrer">
              view on GitHub <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </article>
      ))}
    </div>
  )
}

function Contact() {
  return (
    <div className="mc mc-contact">
      <p className="pixel t-green contact-win">{CONTACT.win}</p>
      <p className="contact-msg">{CONTACT.message}</p>
      <ul className="contact-links">
        {CONTACT.links.map((l) => (
          <li key={l.label}>
            <a
              className="contact-link"
              href={l.href}
              {...(l.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <span className="contact-label pixel">{l.label}</span>
              <span className="contact-value">{l.value}</span>
              {l.ext && <span className="sr-only"> (opens in a new tab)</span>}
              <span className="contact-arrow" aria-hidden="true">
                {l.ext ? '↗' : '→'}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ModuleContent({ id }: { id: ModuleId }) {
  if (id === 'experience') return <Experience />
  if (id === 'skills') return <Skills />
  if (id === 'projects') return <Projects />
  return <Contact />
}
