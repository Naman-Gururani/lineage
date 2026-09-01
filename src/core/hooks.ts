// Late-bound hooks so the world can call DOM UI features without a hard import
// cycle (the UI registers implementations at init).
import type { DialogueRunner } from '../systems/Dialogue'

export const hooks: {
  openDialogue: ((runner: DialogueRunner) => Promise<void>) | null
  faces: (frame: string) => string
} = {
  openDialogue: null,
  faces: () => '',
}
