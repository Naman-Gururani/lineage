// Mutable UI-facing snapshot of the game. The scenes fill it in; the panels
// (journal, map, dialogue…) only ever read it.
import { loadSettings, type Settings } from '../core/save'
import type { Achievements } from '../systems/Achievements'
import type { WardrobeView } from '../systems/GameState'
import type { QuestLog } from '../systems/Quests'
import type { Xp } from '../systems/Xp'
import { BLUEPRINT } from '../world/blueprint'

export type UiStats = {
  steps: number
  playSeconds: number
  fishCaught: number
  /** species id → how many of it have been landed */
  fish: Record<string, number>
  bonks: number
  grassCut: number
  packets: number
  packetsTotal: number
  discoveries: string[]
}

export type UiState = {
  quests: QuestLog | null
  achievements: Achievements | null
  xp: Xp | null
  stats: UiStats
  settings: Settings
  /** data URL of the 320×240 minimap image (2 px per tile) */
  minimapURL: string
  /** player position in world pixels */
  player: { x: number; y: number }
  /** data URL for a portrait frame name like 'face_mira' ('' if missing) */
  faces: (face: string) => string
  visitedRegions: string[]
  /** hats owned / worn, and the one way to change what is worn */
  wardrobe: WardrobeView
  /** the save's own flag bag — read by panels that unlock (fast travel) */
  flags: Record<string, number>
}

export const uiState: UiState = {
  quests: null,
  achievements: null,
  xp: null,
  stats: {
    steps: 0,
    playSeconds: 0,
    fishCaught: 0,
    fish: {},
    bonks: 0,
    grassCut: 0,
    packets: 0,
    packetsTotal: BLUEPRINT.packetSpots.length,
    discoveries: [],
  },
  settings: loadSettings(),
  minimapURL: '',
  player: { x: 0, y: 0 },
  faces: () => '',
  visitedRegions: [],
  // Replaced by the live view the moment there is a save (see `WorldScene`).
  wardrobe: { hats: [], equipped: '', equip: () => false },
  flags: {},
}

/** True when motion should be minimised: the OS preference or the in-game toggle. */
export function reducedMotion(): boolean {
  if (uiState.settings.reducedMotion) return true
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Mirror settings that CSS needs to know about onto the document. */
export function applyMotionClass(): void {
  document.documentElement.classList.toggle('reduce-motion', !!uiState.settings.reducedMotion)
}
