// @vitest-environment happy-dom
//
// "Where do I go next?" — the two surfaces that answer it.
//
//   HUD chip     the objective text plus a compass arrow turned toward the tile
//   Map          a pulsing marker on that tile (and on its pin, when it has one)
//
// The v3 lock views (the elevator lobby, the workshop tool wall) were rooms in
// a building the fair does not have; both panels are gone and so are their
// assertions. What is still locked is said on the résumé card — `ui-locks`.
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

// The atlas is painted by BootScene, long after the HUD mounts.
vi.mock('../src/art/atlas', () => ({ frameDataURL: () => '' }))

import { sfx } from '../src/audio/sfx'
import { TILE, WORLD_TH, WORLD_TW } from '../src/config'
import { events } from '../src/core/events'
import { ZONES } from '../src/data/content'
import { initHud } from '../src/ui/hud'
import { initMap } from '../src/ui/map'
import { closeAllModals } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState, type Objective } from '../src/ui/state'

const text = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim()
const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const chip = () => q('.hud-objective')
const compass = () => q('.hud-compass')
const rot = () => Math.round(parseFloat(compass().style.getPropertyValue('--rot')))
const at = (tx: number, ty: number): Objective => ({
  step: 'prizes',
  text: 'Win the prizes at the Prize Tent — west side of the midway',
  landmark: 'prizetent',
  tx,
  ty,
})

describe('HUD objective chip', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    vi.useFakeTimers()
    uiState.settings.reducedMotion = true
    uiState.unlocked = []
    uiState.objective = null
    uiState.player = { x: 0, y: 0 }
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
  })

  afterEach(() => {
    closeAllModals()
    uiState.objective = null
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hides itself while there is no objective', () => {
    initHud(document.getElementById('ui')!)
    expect(chip().hidden).toBe(true)
    expect(chip().closest('.hud-chips')).toBeTruthy()
  })

  it('shows the objective text as soon as the HUD mounts', () => {
    uiState.objective = at(10, 10)
    initHud(document.getElementById('ui')!)
    expect(chip().hidden).toBe(false)
    expect(text(chip())).toContain('Prize Tent')
    expect(compass().getAttribute('aria-hidden')).toBe('true')
  })

  it('turns the compass toward the tile, twice a second, from the player position', () => {
    uiState.objective = at(10, 10) // centre = (336, 336) in world pixels
    uiState.player = { x: 10 * TILE + 16 - 100, y: 10 * TILE + 16 } // due west of it
    initHud(document.getElementById('ui')!)
    expect(rot()).toBe(0) // ➤ already points east

    uiState.player = { x: 10 * TILE + 16, y: 10 * TILE + 16 + 100 } // due south of it
    expect(rot()).toBe(0) // not yet — the chip refreshes on its own clock
    vi.advanceTimersByTime(500)
    expect(rot()).toBe(-90) // north

    uiState.player = { x: 10 * TILE + 16 + 100, y: 10 * TILE + 16 } // due east of it
    vi.advanceTimersByTime(500)
    expect(Math.abs(rot())).toBe(180) // west
  })

  it('follows the story: a new station re-reads the objective, and the end hides the chip', () => {
    uiState.objective = at(10, 10)
    initHud(document.getElementById('ui')!)
    uiState.objective = { step: 'toolkit', text: 'Spell the toolkit at the Word Forge — east side of the midway', landmark: 'forge', tx: 46, ty: 40 }
    events.emit('story:changed', { next: 'toolkit' })
    expect(text(chip())).toContain('Word Forge')

    uiState.objective = null
    events.emit('story:changed', { next: null })
    expect(chip().hidden).toBe(true)
  })

  it('is a button, not a span — it is the one chip you can press', () => {
    uiState.objective = at(10, 10)
    initHud(document.getElementById('ui')!)
    expect(chip().tagName).toBe('BUTTON')
    expect(chip().getAttribute('type')).toBe('button')
  })

  it('asks the scene for the map, the same way the Map button does', () => {
    uiState.objective = at(10, 10)
    initHud(document.getElementById('ui')!)
    const seen: unknown[] = []
    const offAction = events.on('world:action', (p) => seen.push(p))
    const offPanel = events.on('ui:panel', (p) => seen.push(p))
    chip().click()
    offAction()
    offPanel()
    // `ui:panel` would open the map over a cutscene or a locked world; the
    // scene's own handler is what refuses to.
    expect(seen).toEqual([{ action: 'map' }])
  })
})

describe('map: the objective is pointed at', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    uiState.stats.discoveries = []
    uiState.flags = {}
    uiState.minimapURL = ''
    uiState.player = { x: 0, y: 0 }
    uiState.objective = null
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initMap()
  })

  afterEach(() => {
    closeAllModals()
    uiState.objective = null
    uiState.stats.discoveries = []
    vi.restoreAllMocks()
  })

  const openMapPanel = (data?: unknown) => events.emit('ui:panel', { id: 'map', data })

  it('draws a marker on the objective tile and rings the pin that matches', () => {
    uiState.objective = at(16, 48)
    openMapPanel()
    const mark = q('.map-objective')
    expect(mark.style.left).toBe(((16.5 / WORLD_TW) * 100).toFixed(2) + '%')
    expect(mark.style.top).toBe(((48.5 / WORLD_TH) * 100).toFixed(2) + '%')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    expect(q('.map-lm[data-id="prizetent"]').classList.contains('objective')).toBe(true)
    expect(document.querySelectorAll('.map-lm.objective').length).toBe(1)
  })

  // The ring is a colour. `aria-current` and the words in the label are what a
  // screen reader has to go on, and only the one pin may carry them.
  it('says in words, not only in colour, which pin the story is pointing at', () => {
    uiState.objective = at(16, 48)
    openMapPanel()
    const pin = q('.map-lm[data-id="prizetent"]')
    expect(pin.getAttribute('aria-current')).toBe('true')
    expect(pin.getAttribute('aria-label')).toContain('the story goes here')
    expect(document.querySelectorAll('.map-lm[aria-current]').length).toBe(1)
    expect(q('.map-lm[data-id="forge"]').getAttribute('aria-label')).not.toContain('the story goes here')
  })

  // Every station at the fair names an attraction, so this is the guard rather
  // than a case the story reaches: the marker belongs to the tile, and a station
  // sending you somewhere no stall answers for still gets one.
  it('still marks a station that has no pin of its own', () => {
    uiState.objective = { step: 'ride', text: 'Meet Bo by the fountain', landmark: 'fountain', tx: 35, ty: 42 }
    openMapPanel()
    expect(q('.map-objective')).toBeTruthy()
    expect(document.querySelectorAll('.map-lm.objective').length).toBe(0)
    expect(document.querySelector('.map-lm[data-id="fountain"]')).toBeNull()
  })

  it('draws no marker once the story is told', () => {
    openMapPanel()
    expect(document.querySelector('.map-objective')).toBeNull()
  })

  it('selects the pin a locked card asked to be shown, discovered or not', () => {
    openMapPanel({ focus: 'skills' }) // the chapter; the Word Forge is where it is won
    const pin = q('.map-lm[data-id="forge"]')
    expect(pin.classList.contains('sel')).toBe(true)
    expect(pin.classList.contains('unknown')).toBe(true)
    expect(text(q('.map-hint'))).toContain('undiscovered')
    expect(q<HTMLButtonElement>('.map-travel').disabled).toBe(true) // no travelling to a place you have not found
  })

  it('names a discovered pin it was asked to focus, and offers the trip', () => {
    uiState.stats.discoveries = ['forge']
    openMapPanel({ focus: 'skills' })
    expect(text(q('.map-hint'))).toContain(ZONES.find((z) => z.id === 'skills')!.name)
    expect(q<HTMLButtonElement>('.map-travel').disabled).toBe(false)
  })
})
