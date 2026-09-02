// The five cabinets register their renderers here, so `ui/index.ts` learns
// about one module and the host imports no DOM game code at all.
// Deliberately spread over three lines: `tests/module-graph.test.ts` uses this
// as its one live newline-spanning import, and collapsing it would leave that
// branch of the import scanner untested. Do not reformat.
import {
  registerMinigame,
} from '../../systems/Minigame'
import { mountClaw } from './claw'
import { mountCrew } from './crew'
import { mountFlappy } from './flappy'
import { mountForge } from './forge'
import { mountWordle } from './wordle'

export function initMinigameRenderers(): void {
  registerMinigame('wordle', mountWordle)
  registerMinigame('claw', mountClaw)
  registerMinigame('flappy', mountFlappy)
  registerMinigame('forge', mountForge)
  registerMinigame('crew', mountCrew)
}
