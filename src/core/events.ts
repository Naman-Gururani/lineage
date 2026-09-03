// Typed event bus between Phaser scenes and the DOM UI.
import Phaser from 'phaser'

export type ToastKind = 'xp' | 'quest' | 'ach' | 'info' | 'item'

export type Events = {
  'load:progress': { pct: number; label: string }
  'ui:title': { hasSave: boolean }
  'ui:hud': { visible: boolean }
  'ui:prompt': { text: string | null; key?: string }
  'ui:banner': { title: string; sub?: string }
  'ui:toast': { icon?: string; title: string; sub?: string; kind?: ToastKind }
  'ui:dialogue': { tree: string; npc: string }
  /**
   * Where the speaker stands on screen as a conversation opens — 0 the top edge
   * of the viewport, 1 the bottom. The fair's arrival apron sits on the world's
   * bottom edge, so the camera clamps there and the cast ends up behind the
   * dialogue box; this is how the box learns to get out of their way.
   */
  'ui:dialogue-anchor': { y: number }
  'ui:dialogueClosed': { tree: string }
  'ui:panel': { id: string; data?: unknown }
  'ui:closed': { id: string }
  'ui:lock': { locked: boolean }
  'ui:hint': { text: string | null }
  'world:state': {
    packets: number
    packetsTotal: number
    xp: number
    level: number
    levelPct: number
    time: number
    weather: string
    coins: number
    region: string
    /** player position in world pixels (read by the minimap) */
    px?: number
    py?: number
  }
  'world:travel': { id: string }
  'world:action': { action: 'interact' | 'jump' | 'menu' | 'map' | 'journal' }
  'world:discovered': { id: string; first: boolean }
  /** a résumé chapter (zone id) was unlocked; `announce` false = the game shows the card itself */
  'facet:unlocked': { id: string; first: boolean; announce: boolean }
  /** the story's next station changed (`next` null = the story is done) */
  'story:changed': { next: string | null }
  /** a ride finished (the Career Coaster) */
  'ride:done': { id: 'coaster' }
  /**
   * The rider asked the Career Coaster for the next beat — the milestone card's
   * Next button, or Enter/Space/E while it is up (`ui/ridecard.ts`). The cart
   * stands at each beat until this arrives, so the ride is paced by the person
   * watching it rather than by a timer (`systems/Coaster.ts`).
   */
  'ride:next': Record<string, never>
  'game:new': Record<string, never>
  'game:continue': Record<string, never>
  'game:reader': Record<string, never>
  'game:pause': Record<string, never>
  'game:resume': Record<string, never>
  'game:title': Record<string, never>
  'settings:changed': Record<string, never>
  'save:changed': Record<string, never>
}

class TypedEmitter {
  private e = new Phaser.Events.EventEmitter()
  on<K extends keyof Events>(k: K, fn: (p: Events[K]) => void): () => void {
    this.e.on(k, fn)
    return () => this.e.off(k, fn)
  }
  once<K extends keyof Events>(k: K, fn: (p: Events[K]) => void): void {
    this.e.once(k, fn)
  }
  off<K extends keyof Events>(k: K, fn: (p: Events[K]) => void): void {
    this.e.off(k, fn)
  }
  emit<K extends keyof Events>(k: K, p: Events[K]): void {
    this.e.emit(k, p)
  }
}

export const events = new TypedEmitter()

/** Shared analog input written by the touch joystick / buttons, read by scenes. */
export const touchInput = { x: 0, y: 0, active: false, aHeld: false }
