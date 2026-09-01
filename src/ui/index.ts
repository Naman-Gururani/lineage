// DOM overlay: loading, title, HUD, prompt, banner, touch controls — and the
// panel layer (modals, dialogue box, map, journal, settings, reader, rooms).
import { events } from '../core/events'
import { hooks } from '../core/hooks'
import { initBanner } from './banner'
import { initDialogue, openDialogue } from './dialogue'
import { initElevator } from './elevator'
import { initHud } from './hud'
import { initJournal } from './journal'
import { initLineage } from './lineage'
import { initLoading } from './loading'
import { initMap, initMinimap } from './map'
import { initPanels } from './panels'
import { initPause } from './pause'
import { initPrompt } from './prompt'
import { initReader } from './reader'
import { initSettings } from './settings'
import { initTitle } from './title'
import { initToolwall } from './toolwall'
import { initTouch } from './touch'

export function initUI(): void {
  const root = document.getElementById('ui')!
  initLoading(root)
  initTitle(root)
  initHud(root)
  initPrompt(root)
  initBanner(root)
  initTouch(root)

  // panel layer — initialised before Phaser boots so its window key handlers
  // run ahead of the game's (Esc/E that close a panel never reach the scene)
  initPanels()
  initDialogue()
  initSettings()
  initReader()
  initJournal()
  initMap()
  initMinimap()
  initPause()
  initElevator()
  initToolwall()
  initLineage()
  hooks.openDialogue = (runner) => openDialogue(runner)

  // Esc from the world (no modal open) is handled by scenes; keep a global fallback
  events.on('ui:title', () => document.body.classList.add('at-title'))
  events.on('game:new', () => document.body.classList.remove('at-title'))
  events.on('game:continue', () => document.body.classList.remove('at-title'))
}
