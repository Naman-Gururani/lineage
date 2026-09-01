// Binds the audio module to game state: which music plays where, and what the
// ambience bed sounds like (coast, woods, night, rain, interiors).
import { ambience } from '../audio/ambience'
import { audio } from '../audio/engine'
import { music, type TrackId } from '../audio/music'
import { events } from '../core/events'
import { loadSettings } from '../core/save'

class Soundtrack {
  private mode: 'title' | 'world' | 'room' = 'title'
  private night = false
  private rain = 0
  private coast = 0.3
  private woods = 0

  constructor() {
    this.applyVolumes()
    events.on('settings:changed', () => this.applyVolumes())
  }

  applyVolumes(): void {
    const s = loadSettings()
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx })
  }

  title(): void {
    this.mode = 'title'
    music.play('title')
    ambience.set({ coast: 0.35, woods: 0.1, night: 0, rain: 0, interior: 0 })
  }

  /** Ambient mix for the overworld; call cheaply (ramps are smooth). */
  world(opts: { night: boolean; rain: number; coast: number; woods: number }): void {
    this.mode = 'world'
    this.night = opts.night
    this.rain = opts.rain
    this.coast = opts.coast
    this.woods = opts.woods
    music.play(this.night ? 'night' : 'day')
    ambience.set({ coast: opts.coast, woods: opts.woods, night: opts.night ? 1 : 0, rain: opts.rain, interior: 0 })
  }

  room(track: 'interior' | 'tower' | 'engine'): void {
    this.mode = 'room'
    music.play(track as TrackId)
    ambience.set({ interior: 1, rain: this.rain * 0.5, coast: this.coast * 0.4, woods: 0, night: this.night ? 1 : 0 })
  }

  fanfare(): void {
    music.play('fanfare')
  }

  stop(): void {
    music.stop()
    ambience.stop()
  }
}

export const soundtrack = new Soundtrack()
