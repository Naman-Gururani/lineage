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
  /** the elevator arrived at a floor: swap the room's window view */
  'room:window': { frame: 0 | 1 | 2 | 3 }
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
