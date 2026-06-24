import Phaser from 'phaser'
import type { Zone } from '../data/content'

// Bridge between the Phaser world and the DOM UI layer.
export type BusEvents = {
  ready: () => void
  prompt: (zone: Zone | null) => void
  open: (zone: Zone) => void
  visited: (id: string) => void
  orbs: (collected: number, total: number) => void
  travel: (zone: Zone) => void
}

export const bus = new Phaser.Events.EventEmitter()
