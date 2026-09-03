// The two registries that have to agree, or the fair opens a door onto nothing:
//
//   world/blueprint.ts  attractions — where a stall stands, the tile you talk to
//                                     it from, and the chapters it hands over
//   data/content.ts     ZONES       — the content card behind each chapter
//
// Nothing type-checks across those two files, so this suite is the only thing
// standing between a half-landed attraction and an unbootable build.
//
// v4 note: the map's pin section that used to live here has gone. Pins are
// `ui/map.ts`'s business, and `tests/ui-map.test.ts` now carries the assertions
// about them — that every attraction gets one, and that a chapter resolves to
// the attraction listed here as handing it over.
import { describe, expect, it, vi } from 'vitest'

// `DISCOVERIES_FOR_100` lives in GameState, which reaches the event bus and so
// reaches Phaser. This suite is a pure data check; the bus is a stub.
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

import { ZONES } from '../src/data/content'
import { STATIONS } from '../src/data/story'
import { DISCOVERIES_FOR_100 } from '../src/systems/GameState'
import { BLUEPRINT, type AttractionId } from '../src/world/blueprint'

/**
 * The eight attractions, pinned at compile time rather than counted: add or
 * rename one and this line stops compiling until it is listed here.
 */
const EVERY_ATTRACTION: Record<AttractionId, true> = {
  gate: true,
  coaster: true,
  prizetent: true,
  forge: true,
  flight: true,
  arcade: true,
  duckpond: true,
  guestbook: true,
}
const ATTRACTION_IDS = Object.keys(EVERY_ATTRACTION) as AttractionId[]

const attractions = BLUEPRINT.attractions

describe('registry: attractions ↔ zones', () => {
  it('builds exactly the eight attractions the union names, once each', () => {
    expect(attractions.map((a) => a.id).sort()).toEqual([...ATTRACTION_IDS].sort())
    expect(new Set(attractions.map((a) => a.id)).size).toBe(attractions.length)
    expect(attractions.length).toBe(8)
  })

  it('delivers every chapter from exactly one attraction', () => {
    const owners = new Map<string, string[]>()
    for (const a of attractions) for (const z of a.zones) owners.set(z, [...(owners.get(z) ?? []), a.id])
    for (const z of ZONES) expect(owners.get(z.id) ?? [], `chapter "${z.id}"`).toHaveLength(1)
  })

  it('hands out only chapters that exist — no attraction promises a card nobody wrote', () => {
    const zoneIds = new Set(ZONES.map((z) => z.id))
    for (const a of attractions)
      for (const z of a.zones) expect(zoneIds.has(z), `attraction "${a.id}" delivers unknown chapter "${z}"`).toBe(true)
  })

  it('puts the chapters where the spec says they are told', () => {
    const zonesOf = (id: AttractionId) => [...(attractions.find((a) => a.id === id)?.zones ?? [])].sort()
    expect(zonesOf('gate')).toEqual(['about'])
    expect(zonesOf('coaster')).toEqual(['education', 'experience'])
    expect(zonesOf('prizetent')).toEqual(['lineage', 'safestride', 'stealth'])
    expect(zonesOf('forge')).toEqual(['skills'])
    expect(zonesOf('guestbook')).toEqual(['contact'])
    // The three fun stalls deliver nothing but a good time.
    for (const id of ['flight', 'arcade', 'duckpond'] as const) expect(zonesOf(id)).toEqual([])
  })

  it('counts eight zones and keeps the hundred-per-cent bar at eight discoveries', () => {
    expect(ZONES.length).toBe(8)
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length)
    expect(DISCOVERIES_FOR_100).toBe(8)
    expect(DISCOVERIES_FOR_100).toBe(attractions.length)
  })

  it('gives every attraction a name, a door, a sprite and something to do', () => {
    for (const a of attractions) {
      // The map pins read `name` — an unnamed attraction is a blank pin.
      expect(a.name.trim().length, `${a.id} name`).toBeGreaterThan(0)
      expect(a.w, `${a.id} width`).toBeGreaterThan(0)
      expect(a.h, `${a.id} height`).toBeGreaterThan(0)
      expect(a.sprite.trim().length, `${a.id} sprite`).toBeGreaterThan(0)
      expect(a.interact.trim().length, `${a.id} interact`).toBeGreaterThan(0)
      expect(typeof a.door.x, `${a.id} door.x`).toBe('number')
      expect(typeof a.door.y, `${a.id} door.y`).toBe('number')
    }
  })

  it('stands every story station at an attraction that exists', () => {
    const ids = new Set(attractions.map((a) => a.id))
    for (const st of Object.values(STATIONS))
      expect(ids.has(st.landmark as AttractionId), `station "${st.step}" → "${st.landmark}"`).toBe(true)
  })
})
