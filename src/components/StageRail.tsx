import { STAGES } from '../data/content'
import { useMotion } from '../lib/motion'

export function StageRail({ active }: { active: string }) {
  const { scrollTo } = useMotion()

  return (
    <nav className="rail" aria-label="Stages">
      <ol>
        {STAGES.map((s) => {
          const on = s.id === active
          return (
            <li key={s.id} className={on ? 'is-active' : undefined}>
              <a
                href={`#${s.id}`}
                aria-label={`Stage ${s.index}, ${s.label}`}
                aria-current={on ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(`#${s.id}`)
                  history.replaceState(null, '', `#${s.id}`)
                }}
              >
                <span className="rail-tick" aria-hidden="true" />
                <span className="rail-num mono">{s.index}</span>
                <span className="rail-label">{s.label}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
