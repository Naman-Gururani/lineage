import { useState } from 'react'
import { useGame } from '../state/game'
import { MODULES, type ModuleId } from '../data/content'
import { sound } from '../lib/sound'

type Mod = (typeof MODULES)[number]

export function ModuleCard({ mod, onOpen }: { mod: Mod; onOpen: (id: ModuleId) => void }) {
  const { isUnlocked } = useGame()
  const unlocked = isUnlocked(mod.id)
  const blocked = mod.id === 'contact' && !unlocked
  const [shake, setShake] = useState(false)

  const handle = () => {
    if (blocked) {
      sound.wrong()
      setShake(true)
      window.setTimeout(() => setShake(false), 420)
      return
    }
    onOpen(mod.id)
  }

  const cta = unlocked ? 'view →' : mod.game ? `play · ${mod.challenge.split(' — ')[0]}` : 'locked'

  return (
    <button
      type="button"
      className={`mod-card mod-${mod.id} ${unlocked ? 'is-unlocked' : 'is-locked'} ${
        shake ? 'is-shake' : ''
      }`}
      onClick={handle}
      aria-label={`${mod.label}: ${
        unlocked
          ? 'unlocked — view content'
          : blocked
            ? 'locked until full access'
            : 'locked — play ' + mod.challenge
      }`}
    >
      <div className="mod-top">
        <span className="mod-code pixel">{mod.code}</span>
        <span className={`mod-status pixel ${unlocked ? 'ok' : ''}`}>
          {unlocked ? 'OPEN' : 'LOCKED'}
        </span>
      </div>
      <h3 className="mod-label">{mod.label}</h3>
      <p className="mod-teaser">{mod.teaser}</p>
      <span className="mod-cta mono">{cta}</span>
    </button>
  )
}
