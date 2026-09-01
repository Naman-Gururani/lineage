// Tracks interactables near the player and shows the contextual prompt.
import { events } from '../core/events'

export interface Interactable {
  x: number
  y: number
  radius: number
  prompt: string
  key?: string
  enabled?: () => boolean
  onInteract: () => void | Promise<void>
  /** priority when several overlap (higher wins) */
  priority?: number
}

export class InteractSystem {
  private items = new Set<Interactable>()
  current: Interactable | null = null
  private lastPrompt = ''

  add(i: Interactable): Interactable {
    this.items.add(i)
    return i
  }

  remove(i: Interactable): void {
    this.items.delete(i)
    if (this.current === i) this.setCurrent(null)
  }

  clear(): void {
    this.items.clear()
    this.setCurrent(null)
  }

  update(px: number, py: number): void {
    let best: Interactable | null = null
    let bestScore = Infinity
    for (const i of this.items) {
      if (i.enabled && !i.enabled()) continue
      const d = Math.hypot(i.x - px, i.y - py)
      if (d > i.radius) continue
      const score = d - (i.priority ?? 0) * 100
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    this.setCurrent(best)
  }

  private setCurrent(i: Interactable | null) {
    const prompt = i ? `${i.key ?? 'E'}|${i.prompt}` : ''
    if (prompt === this.lastPrompt) return
    this.lastPrompt = prompt
    this.current = i
    events.emit('ui:prompt', i ? { text: i.prompt, key: i.key ?? 'E' } : { text: null })
  }

  hide(): void {
    this.lastPrompt = ''
    events.emit('ui:prompt', { text: null })
  }

  trigger(): boolean {
    if (!this.current) return false
    void this.current.onInteract()
    return true
  }
}
