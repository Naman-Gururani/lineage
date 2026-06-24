import { MODULES, PROFILE, type ModuleId } from '../data/content'
import { ModuleCard } from '../components/ModuleCard'
import { useGame } from '../state/game'

export function Hub({ onOpen }: { onOpen: (id: ModuleId) => void }) {
  const { access } = useGame()
  const allDone = access >= 1

  return (
    <div className="container hub">
      <div className="hub-head">
        <p className="pixel hub-kicker">PLAYER · {PROFILE.name.toUpperCase()}</p>
        <h2 className="hub-title">{allDone ? 'System unlocked.' : 'Unlock the system.'}</h2>
        <p className="hub-sub">
          {PROFILE.role} at {PROFILE.company}. {PROFILE.tagline} Beat a game to open each module —
          or hit <strong>REVEAL&nbsp;ALL</strong>.
        </p>
      </div>
      <div className="mod-grid">
        {MODULES.map((m) => (
          <ModuleCard key={m.id} mod={m} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}
