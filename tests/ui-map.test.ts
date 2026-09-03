// @vitest-environment happy-dom
//
// The fair map: eight attraction pins, the regions they stand in, and the only
// way to travel — walk to a pin you have already found and ask for a lift.
//
// The island's landmarks are gone from this panel: pins come from
// `BLUEPRINT.attractions`, the counter counts them, and the Tower Express fast
// travel that used to sit under the stage went with the tower.
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
import { WORLD_TH, WORLD_TW } from '../src/config'
import { events } from '../src/core/events'
import { ZONES } from '../src/data/content'
import { initMap } from '../src/ui/map'
import { closeAllModals } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'
import { BLUEPRINT } from '../src/world/blueprint'

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))
const text = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim()
const pins = () => all<HTMLButtonElement>('.map-lm')
const openMapPanel = (data?: unknown) => events.emit('ui:panel', { id: 'map', data })

const attractions = BLUEPRINT.attractions

describe('the fair map', () => {
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
    uiState.stats.discoveries = []
    uiState.objective = null
    vi.restoreAllMocks()
  })

  /* ---------------- the pins ---------------- */

  it('pins every attraction, and nothing else', () => {
    openMapPanel()
    expect(pins().length).toBe(8)
    expect(pins().map((p) => p.dataset.id)).toEqual(attractions.map((a) => a.id))
  })

  it('names each pin the way the blueprint names the attraction', () => {
    uiState.stats.discoveries = attractions.map((a) => a.id)
    openMapPanel()
    for (const a of attractions) {
      const pin = q(`.map-lm[data-id="${a.id}"]`)
      expect(text(pin.querySelector('.map-lbl')), a.id).toBe(a.name)
      expect(pin.getAttribute('aria-label'), a.id).toContain(a.name)
    }
  })

  it('says a repeated chapter label once — the Prize Tent hands over three "Project" chapters', () => {
    uiState.stats.discoveries = ['prizetent']
    openMapPanel()
    const pin = q('.map-lm[data-id="prizetent"]')
    const aria = pin.getAttribute('aria-label') ?? ''
    expect(BLUEPRINT.attractions.find((a) => a.id === 'prizetent')!.zones.length).toBe(3)
    expect(aria.match(/Project/g)?.length, aria).toBe(1)
    expect(aria).toBe('Prize Tent — Project')
    pin.click()
    const tag = text(q('.map-tag'))
    expect(tag.match(/Project/g)?.length, tag).toBe(1)
  })

  it('gives an undiscovered pin nothing away — no name, no icon', () => {
    uiState.stats.discoveries = ['forge']
    openMapPanel()
    const known = q('.map-lm[data-id="forge"]')
    const unknown = q('.map-lm[data-id="prizetent"]')
    expect(known.classList.contains('known')).toBe(true)
    expect(unknown.classList.contains('unknown')).toBe(true)
    expect(text(unknown)).not.toContain('Prize Tent')
    expect(unknown.getAttribute('aria-label')).not.toContain('Prize Tent')
  })

  it('counts the eight attractions in the header, and says which fair this is', () => {
    openMapPanel()
    expect(text(q('.modal-title'))).toBe("Naman's World Fair")
    expect(text(q('.modal-kicker'))).toBe('0/8 FOUND')
    closeAllModals()

    uiState.stats.discoveries = ['gate', 'coaster', 'duckpond']
    openMapPanel()
    expect(text(q('.modal-kicker'))).toBe('3/8 FOUND')
  })

  it('puts each pin at the middle of its footprint', () => {
    openMapPanel()
    const a = attractions.find((x) => x.id === 'coaster')!
    const pin = q('.map-lm[data-id="coaster"]')
    expect(pin.style.left).toBe((((a.tx + a.w / 2) / WORLD_TW) * 100).toFixed(2) + '%')
    expect(pin.style.top).toBe((((a.ty + a.h / 2) / WORLD_TH) * 100).toFixed(2) + '%')
  })

  it('labels the fair’s regions', () => {
    openMapPanel()
    const labels = all('.map-region').map((n) => text(n))
    expect(labels).toEqual(BLUEPRINT.regions.map((r) => r.name))
    expect(labels).toContain('The Midway')
  })

  /* ---------------- travel ---------------- */

  it('travels to a discovered attraction by its own id', () => {
    uiState.stats.discoveries = ['duckpond']
    openMapPanel()
    const seen: string[] = []
    const off = events.on('world:travel', ({ id }) => seen.push(id))
    q('.map-lm[data-id="duckpond"]').click()
    expect(text(q('.map-hint'))).toContain('Duck Pond')
    const travel = q<HTMLButtonElement>('.map-travel')
    expect(travel.disabled).toBe(false)
    travel.click()
    off()
    expect(seen).toEqual(['duckpond'])
  })

  it('refuses the trip to somewhere you have not found', () => {
    openMapPanel()
    const seen: string[] = []
    const off = events.on('world:travel', ({ id }) => seen.push(id))
    q('.map-lm[data-id="duckpond"]').click()
    const travel = q<HTMLButtonElement>('.map-travel')
    expect(travel.disabled).toBe(true)
    travel.click() // belt and braces: the handler refuses the trip on its own too
    off()
    expect(seen).toEqual([])
  })

  // Travel is dimmed rather than removed. A control that leaves the tab order
  // whenever the selection changes moves the furniture under the player's hands.
  it('keeps the Travel button in the tab order whatever is selected', () => {
    uiState.stats.discoveries = ['duckpond']
    openMapPanel()
    const travel = q<HTMLButtonElement>('.map-travel')
    expect(travel.hidden).toBe(false)
    q('.map-lm[data-id="forge"]').click() // undiscovered
    expect(travel.disabled).toBe(true)
    expect(travel.hidden).toBe(false)
    q('.map-lm[data-id="duckpond"]').click()
    expect(travel.disabled).toBe(false)
    expect(travel.hidden).toBe(false)
  })

  // Focusing a pin announces the pin. The hint used to be a live region as
  // well, so every arrow-key move said the same name twice over.
  it('does not double-announce: the hint is text, the pin is the live thing', () => {
    openMapPanel()
    const hint = q('.map-hint')
    expect(hint.hasAttribute('aria-live')).toBe(false)
    expect(hint.getAttribute('role')).not.toBe('status')
    expect(text(hint).length).toBeGreaterThan(0)
  })

  // Selection is a colour on the pin and a name in the hint below it; neither
  // reaches a screen reader sitting on the button itself.
  it('marks the selected pin as pressed, and only that one', () => {
    uiState.stats.discoveries = ['duckpond', 'arcade']
    openMapPanel()
    expect(all('.map-lm').every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
    q('.map-lm[data-id="duckpond"]').click()
    expect(q('.map-lm[data-id="duckpond"]').getAttribute('aria-pressed')).toBe('true')
    expect(all('.map-lm[aria-pressed="true"]').length).toBe(1)
    q('.map-lm[data-id="arcade"]').click()
    expect(q('.map-lm[data-id="duckpond"]').getAttribute('aria-pressed')).toBe('false')
    expect(all('.map-lm[aria-pressed="true"]').length).toBe(1)
  })

  it('has no fast travel left — the tower took the Tower Express with it', () => {
    uiState.flags = { tower_express: 1 }
    uiState.stats.discoveries = attractions.map((a) => a.id)
    openMapPanel()
    expect(document.querySelector('.map-express')).toBeNull()
    expect(document.querySelector('.map-express-btn')).toBeNull()
    expect(document.querySelector('[data-travel]')).toBeNull()
    expect(text(q('.map'))).not.toContain('Tower Express')
  })

  /* ---------------- what a locked card asks for ---------------- */

  it('resolves a chapter to the attraction that hands it over', () => {
    // Every project is won at one tent, so all three focus the same pin.
    for (const [zone, attraction] of [
      ['about', 'gate'],
      ['experience', 'coaster'],
      ['education', 'coaster'],
      ['lineage', 'prizetent'],
      ['safestride', 'prizetent'],
      ['stealth', 'prizetent'],
      ['skills', 'forge'],
      ['contact', 'guestbook'],
    ] as const) {
      openMapPanel({ focus: zone })
      expect(q(`.map-lm[data-id="${attraction}"]`).classList.contains('sel'), zone).toBe(true)
      expect(all('.map-lm.sel').length, zone).toBe(1)
      closeAllModals()
    }
    // and every chapter is answered by a pin
    expect(ZONES.every((z) => attractions.some((a) => a.zones.includes(z.id)))).toBe(true)
  })

  it('takes an attraction id as the focus too — the objective names one', () => {
    openMapPanel({ focus: 'arcade' })
    expect(q('.map-lm[data-id="arcade"]').classList.contains('sel')).toBe(true)
  })
})
