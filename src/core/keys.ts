// Plain window-level keyboard state. Scene-independent and sleep-proof —
// Phaser's per-scene keyboard plugin can stall after scene sleep/wake cycles,
// so the game reads movement and action keys from here instead.

/** Named bindings, as `KeyboardEvent.code` lists. */
export const BINDINGS = {
  jump: ['Space'],
} as const satisfies Record<string, readonly string[]>

/**
 * Normalise a key spelling to the `KeyboardEvent.code` the game checks against.
 * Space is the one key with two common spellings — `code:'Space'` but `key:' '`
 * — so both resolve here and callers never have to know which they were handed.
 */
function normalize(name: string): string {
  return name === ' ' || name === 'Spacebar' ? 'Space' : name
}

/** The code to track an event under; synthetic/mobile events may omit `code`. */
function eventCode(e: KeyboardEvent): string {
  return e.code || normalize(e.key)
}

/** True when `e` is one of the keys bound to `name` (synthetic events included). */
export function isBound(e: KeyboardEvent, name: keyof typeof BINDINGS): boolean {
  return (BINDINGS[name] as readonly string[]).includes(eventCode(e))
}

const pressed = new Set<string>()
type Handler = (e: KeyboardEvent) => void
const downHandlers = new Set<Handler>()

function isDown(code: string): boolean {
  return pressed.has(normalize(code))
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) {
      pressed.add(eventCode(e))
      // panels/dialogues stopPropagation before us when they own the key;
      // whoever is left gets to act on it.
      for (const h of downHandlers) h(e)
    }
  })
  window.addEventListener('keyup', (e) => pressed.delete(eventCode(e)))
  window.addEventListener('blur', () => pressed.clear())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pressed.clear()
  })
}

export const keys = {
  down(code: string): boolean {
    return isDown(code)
  },
  any(...codes: string[]): boolean {
    for (const c of codes) if (isDown(c)) return true
    return false
  },
  /** Subscribe to non-repeat keydowns; returns an unsubscribe. */
  onDown(h: Handler): () => void {
    downHandlers.add(h)
    return () => downHandlers.delete(h)
  },
}
