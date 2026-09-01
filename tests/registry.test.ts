// @vitest-environment happy-dom
//
// The three registries that have to agree, or the island boots into a door
// that opens onto nothing:
//
//   world/blueprint.ts  landmarks — where a building stands and which room it opens
//   data/content.ts     ZONES     — the content card behind a discoverable landmark
//   data/rooms.ts       ROOMS     — the interior floor plan the door leads to
//
// Nothing type-checks across those three files, so this suite is the only thing
// standing between a half-landed landmark and an unbootable build.
//
// happy-dom (not node) because the same invariant is asserted a second time
// where it is actually consumed: the island map's "n/8 FOUND" counter and its
// landmark pins.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  type Fn = (p: unknown) => void
  class EventEmitter {
    private m = new Map<string, Set<Fn>>()
    on(k: string, fn: Fn) {
      let s = this.m.get(k)
      if (!s) {
        s = new Set()
        this.m.set(k, s)
      }
      s.add(fn)
      return this
    }
    once(k: string, fn: Fn) {
      const w: Fn = (p) => {
        this.off(k, w)
        fn(p)
      }
      return this.on(k, w)
    }
    off(k: string, fn: Fn) {
      this.m.get(k)?.delete(fn)
      return this
    }
    emit(k: string, p: unknown) {
      for (const fn of Array.from(this.m.get(k) ?? [])) fn(p)
      return true
    }
  }
  return { default: { Events: { EventEmitter } } }
})

import { sfx } from '../src/audio/sfx'
import { ZONES } from '../src/data/content'
import { ROOMS } from '../src/data/rooms'
import { closeAllModals } from '../src/ui/modal'
import { openMap } from '../src/ui/map'
import { uiState } from '../src/ui/state'
import { BLUEPRINT } from '../src/world/blueprint'

const landmarks = BLUEPRINT.landmarks
/** Discoverable buildings: a zone card, a journal line, a map pin. */
const major = landmarks.filter((l) => !l.minor)
/** Scenery with a door: a room, but no discovery and no map pin. */
const minor = landmarks.filter((l) => l.minor)

describe('registry: landmarks ↔ zones ↔ rooms', () => {
  it('gives every non-minor landmark a zone with the same id', () => {
    const zoneIds = new Set(ZONES.map((z) => z.id))
    expect(major.filter((l) => !zoneIds.has(l.id)).map((l) => l.id), 'landmarks with no ZONES entry').toEqual([])
  })

  it('gives every zone a non-minor landmark with the same id', () => {
    const majorIds = new Set<string>(major.map((l) => l.id))
    expect(ZONES.filter((z) => !majorIds.has(z.id)).map((z) => z.id), 'zones with no landmark to stand on').toEqual([])
  })

  it('leaves minor landmarks without a zone — they are scenery with a door', () => {
    const zoneIds = new Set(ZONES.map((z) => z.id))
    expect(minor.map((l) => l.id)).toEqual(['warehouse'])
    expect(minor.filter((l) => zoneIds.has(l.id)).map((l) => l.id), 'minor landmarks that would be discoverable').toEqual([])
  })

  it('points every landmark — minor ones included — at a room that exists', () => {
    expect(landmarks.filter((l) => !ROOMS[l.room]).map((l) => `${l.id} → ${l.room}`), 'landmarks whose room is missing from ROOMS').toEqual([])
  })

  it('keys every room by its own id and opens onto every one of them', () => {
    for (const [key, def] of Object.entries(ROOMS)) expect(def.id, `ROOMS["${key}"].id`).toBe(key)
    const used = new Set(landmarks.map((l) => l.room))
    expect(Object.keys(ROOMS).filter((k) => !used.has(k)), 'rooms no landmark opens onto').toEqual([])
  })

  it('keeps every landmark id, zone id and room key unique', () => {
    expect(new Set(landmarks.map((l) => l.id)).size).toBe(landmarks.length)
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length)
  })

  it('counts eight discoverable landmarks and eight zones', () => {
    expect(major.length).toBe(8)
    expect(ZONES.length).toBe(8)
    expect(landmarks.length).toBe(9)
    expect(Object.keys(ROOMS).length).toBe(9)
  })
})

describe('island map reads the registry', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    uiState.stats.discoveries = []
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
  })

  afterEach(() => {
    closeAllModals()
    uiState.stats.discoveries = []
    vi.restoreAllMocks()
  })

  const pins = () => Array.from(document.querySelectorAll<HTMLElement>('.map-lm')).map((b) => b.dataset.id)

  it('pins every zone and nothing else — no pin for the minor warehouse', () => {
    openMap()
    expect(pins().sort()).toEqual(ZONES.map((z) => z.id).sort())
    expect(pins()).toContain('education')
    expect(pins()).not.toContain('warehouse')
  })

  it('counts found landmarks out of the discoverable eight, not out of every building', () => {
    openMap()
    const head = document.querySelector('.map')!.textContent ?? ''
    expect(head).toContain(`0/${major.length} FOUND`)
    expect(head).not.toContain(`0/${landmarks.length} FOUND`)
  })

  it('counts a discovered campus', () => {
    uiState.stats.discoveries = ['about', 'education']
    openMap()
    expect(document.querySelector('.map')!.textContent).toContain('2/8 FOUND')
    const campus = document.querySelector<HTMLElement>('.map-lm[data-id="education"]')!
    expect(campus.classList.contains('known')).toBe(true)
    expect(campus.getAttribute('aria-label')).toBe('SRM Campus — Education')
  })
})
