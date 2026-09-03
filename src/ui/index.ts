// DOM overlay: loading, the welcome card, HUD, prompt, banner, touch controls
// — and the panel layer (modals, dialogue box, map, journal, settings, reader,
// rooms).
import { events } from '../core/events'
import { hooks } from '../core/hooks'
import { initBanner } from './banner'
import { initDialogue, openDialogue } from './dialogue'
import { initForgeboard } from './forgeboard'
import { initHud } from './hud'
import { initJournal } from './journal'
import { initLoading } from './loading'
import { initMinigames } from '../systems/Minigame'
import { initMap, initMinimap } from './map'
import { initMinigameRenderers } from './minigames'
import { initPanels } from './panels'
import { initPause } from './pause'
import { initPrizes } from './prizes'
import { initPrompt } from './prompt'
import { initReader } from './reader'
import { initRidecard } from './ridecard'
import { initSettings } from './settings'
import { initTouch } from './touch'
import { initWelcome } from './welcome'

export function initUI(): void {
  const root = document.getElementById('ui')!
  initLoading(root)
  initWelcome(root)
  initHud(root)
  initPrompt(root)
  initBanner(root)
  initTouch(root)

  // Panel layer. The order below buys no key priority: `core/keys` installs its
  // window listener at *import* time, which is before this function ever runs,
  // so the game's handler is always first on the window whatever we do here.
  // What actually keeps a panel's Esc/E off the world is the scenes' own guard —
  // every scene key handler bails while `document.body` carries `modal-open` —
  // plus the `stopImmediatePropagation` the panels themselves call.
  initPanels()
  initDialogue()
  initSettings()
  initReader()
  initJournal()
  initMap()
  initMinimap()
  initPause()
  initRidecard()
  initForgeboard()
  initPrizes()
  initMinigames()
  initMinigameRenderers()
  hooks.openDialogue = (runner) => openDialogue(runner)

  // Esc from the world (no modal open) is handled by scenes; keep a global fallback
  events.on('ui:title', () => document.body.classList.add('at-title'))
  events.on('game:new', () => document.body.classList.remove('at-title'))
  events.on('game:continue', () => document.body.classList.remove('at-title'))
}
