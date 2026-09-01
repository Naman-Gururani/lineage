import type { Interactable } from '../systems/Interact'

export function makeDoor(
  x: number,
  y: number,
  name: string,
  enabled: () => boolean,
  onEnter: () => void,
  lockedPrompt?: () => string,
  onLocked?: () => void,
): Interactable {
  return {
    x,
    y,
    radius: 20,
    get prompt() {
      return enabled() ? `Enter ${name}` : (lockedPrompt?.() ?? `${name} is sealed`)
    },
    onInteract: () => {
      if (enabled()) onEnter()
      else onLocked?.()
    },
    priority: 2,
  }
}
