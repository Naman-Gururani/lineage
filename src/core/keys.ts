// Plain window-level keyboard state. Scene-independent and sleep-proof —
// Phaser's per-scene keyboard plugin can stall after scene sleep/wake cycles,
// so the game reads movement and action keys from here instead.

const pressed = new Set<string>()
type Handler = (e: KeyboardEvent) => void
const downHandlers = new Set<Handler>()

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) {
      pressed.add(e.code)
      // panels/dialogues stopPropagation before us when they own the key;
      // whoever is left gets to act on it.
      for (const h of downHandlers) h(e)
    }
  })
  window.addEventListener('keyup', (e) => pressed.delete(e.code))
  window.addEventListener('blur', () => pressed.clear())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pressed.clear()
  })
}

export const keys = {
  down(code: string): boolean {
    return pressed.has(code)
  },
  any(...codes: string[]): boolean {
    for (const c of codes) if (pressed.has(c)) return true
    return false
  },
  /** Subscribe to non-repeat keydowns; returns an unsubscribe. */
  onDown(h: Handler): () => void {
    downHandlers.add(h)
    return () => downHandlers.delete(h)
  },
}
