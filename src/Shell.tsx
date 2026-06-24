import { useState } from 'react'
import { useGame } from './state/game'
import { MODULES, type ModuleId } from './data/content'
import { sound } from './lib/sound'
import { burst } from './lib/particles'

import { Crt } from './components/Crt'
import { Hud } from './components/Hud'
import { StartScreen } from './components/StartScreen'
import { Arena } from './components/Arena'
import { Hub } from './sections/Hub'
import { ModuleContent } from './sections/ModuleContent'

import { RouteGame } from './games/RouteGame'
import { SortGame } from './games/SortGame'
import { DecryptGame } from './games/DecryptGame'

type Open = { module: ModuleId; mode: 'game' | 'content' } | null

export function Shell() {
  const { started, isUnlocked, unlock, reduced } = useGame()
  const [open, setOpen] = useState<Open>(null)

  const moduleOf = (id: ModuleId) => MODULES.find((m) => m.id === id)!

  const openModule = (id: ModuleId) => {
    const mod = moduleOf(id)
    sound.click()
    if (isUnlocked(id)) {
      setOpen({ module: id, mode: 'content' })
    } else if (mod.game) {
      setOpen({ module: id, mode: 'game' })
    }
  }

  const handleWin = (id: ModuleId) => {
    unlock(id)
    sound.unlock()
    if (!reduced) burst(window.innerWidth / 2, window.innerHeight * 0.4, { count: 80, power: 12 })
    setOpen({ module: id, mode: 'content' })
  }

  const close = () => {
    sound.click()
    setOpen(null)
  }

  const renderGame = (id: ModuleId) => {
    switch (moduleOf(id).game) {
      case 'route':
        return <RouteGame onWin={() => handleWin(id)} />
      case 'sort':
        return <SortGame onWin={() => handleWin(id)} />
      case 'decrypt':
        return <DecryptGame onWin={() => handleWin(id)} />
      default:
        return null
    }
  }

  const activeMod = open ? moduleOf(open.module) : null

  return (
    <>
      <a href="#hub" className="skip-link">
        Skip to content
      </a>
      <Crt />
      <Hud />
      <main id="hub">{!started ? <StartScreen /> : <Hub onOpen={openModule} />}</main>

      {open && activeMod && (
        <Arena
          label={open.mode === 'game' ? activeMod.challenge : `${activeMod.code} · ${activeMod.label}`}
          tone={open.mode === 'game' ? 'cyan' : 'gold'}
          onClose={close}
          onSkip={open.mode === 'game' ? () => handleWin(open.module) : undefined}
        >
          {open.mode === 'game' ? renderGame(open.module) : <ModuleContent id={open.module} />}
        </Arena>
      )}
    </>
  )
}
