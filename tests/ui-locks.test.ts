// @vitest-environment happy-dom
//
// Locked chapters. A résumé chapter is won by a game, and until it is won its
// card must say where the game is played and nothing else — the whole point of
// the island is that the story is *earned*, so a card that leaked its own body
// would give the ending away on the first click.
//
// Three things are pinned here: what a locked card is allowed to render, where
// its [Show on map] button goes, and when a freshly-won chapter opens itself
// (never on top of a mini-game that is still on screen).
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
import { events } from '../src/core/events'
import { ZONES, type Zone } from '../src/data/content'
import { STORY_HINTS } from '../src/data/story'
import { initMap } from '../src/ui/map'
import { closeAllModals, closeModal, el, isModalOpen, openModal } from '../src/ui/modal'
import { initPanels, isUnlocked, openZone } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

const zone = (id: string): Zone => ZONES.find((z) => z.id === id)!
const book = () => document.querySelector<HTMLElement>('.book')
const text = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim()
const btnByLabel = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('.book button')).find((b) => text(b) === label)
const openIds = () => Array.from(document.querySelectorAll<HTMLElement>('.modal:not(.closing)')).map((m) => m.dataset.id)

/** Every string a chapter's content holds — a locked card may show none of them. */
function contentStrings(z: Zone): string[] {
  const c = z.content
  return [
    c.kicker ?? '',
    c.sub ?? '',
    ...(c.body ?? []),
    ...(c.points ?? []),
    ...(c.chips ?? []),
    ...(c.facts ?? []).map((f) => f.v),
    ...(c.groups ?? []).flatMap((g) => g.items),
    ...(c.links ?? []).map((l) => l.value),
  ].filter((s) => s.length > 3)
}

describe('locked chapter cards', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true // synchronous typewriter + modal close
    uiState.unlocked = []
    uiState.objective = null
    uiState.stats.discoveries = []
    uiState.flags = {}
    uiState.minimapURL = ''
    uiState.player = { x: 0, y: 0 }
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initMap()
  })

  afterEach(() => {
    closeAllModals()
    uiState.unlocked = []
    uiState.objective = null
    vi.restoreAllMocks()
  })

  /* ---------------- isUnlocked ---------------- */

  it('reads the unlocked list, and never locks Contact', () => {
    expect(isUnlocked('experience')).toBe(false)
    expect(isUnlocked('contact')).toBe(true)
    uiState.unlocked = ['experience']
    expect(isUnlocked('experience')).toBe(true)
    expect(isUnlocked('skills')).toBe(false)
    expect(isUnlocked('contact')).toBe(true)
  })

  /* ---------------- the locked card ---------------- */

  it('shows the label, the LOCKED kicker and the story hint — and no content at all', () => {
    for (const id of ['lineage', 'education', 'skills', 'stealth', 'safestride', 'experience']) {
      openZone(id)
      const z = zone(id)
      const card = book()!
      expect(card, id).toBeTruthy()
      expect(card.classList.contains('locked'), id).toBe(true)
      expect(text(card.querySelector('.d-kicker')), id).toBe('LOCKED')
      // the chapter *label*, never the chapter's own title
      expect(text(card.querySelector('.d-title')), id).toBe(z.label)
      expect(text(card), id).toContain(STORY_HINTS[id])
      for (const leak of contentStrings(z)) expect(text(card), `${id} leaked: ${leak}`).not.toContain(leak)
      // and none of the rendered content blocks reached the page
      expect(card.querySelectorAll('.chip,.d-fact,.d-link,.d-points,.d-sub').length, id).toBe(0)
      closeModal(`zone:${id}`)
    }
  })

  it('keeps the chapter title out of the locked card even when the label is not the title', () => {
    openZone('education')
    expect(text(book())).not.toContain(zone('education').content.title)
    expect(text(book())).toContain('Education')
  })

  it('offers exactly Show on map and Close', () => {
    openZone('lineage')
    expect(btnByLabel('Show on map')).toBeTruthy()
    expect(btnByLabel('Close')).toBeTruthy()
    btnByLabel('Close')!.click()
    expect(isModalOpen()).toBe(false)
  })

  it('Show on map closes the card and opens the map with that attraction selected', () => {
    const seen: { id: string; data?: unknown }[] = []
    const off = events.on('ui:panel', (p) => seen.push(p))
    openZone('lineage')
    btnByLabel('Show on map')!.click()
    off()
    expect(seen).toEqual([{ id: 'map', data: { focus: 'lineage' } }])
    // the card is gone and the map took its place, with the stall that hands
    // that chapter over selected: the pin is the Prize Tent, not the project
    expect(openIds()).toEqual(['map'])
    const pin = document.querySelector<HTMLElement>('.map-lm[data-id="prizetent"]')!
    expect(pin.classList.contains('sel')).toBe(true)
    // undiscovered: it may be pointed at, but not travelled to. The button
    // stays on screen and in the tab order — dimmed, not taken away.
    expect(document.querySelector<HTMLButtonElement>('.map-travel')!.disabled).toBe(true)
  })

  /* ---------------- the unlocked card is untouched ---------------- */

  it('renders the normal book once the chapter is won', () => {
    uiState.unlocked = ['lineage']
    openZone('lineage')
    const card = book()!
    expect(card.classList.contains('locked')).toBe(false)
    expect(text(card)).toContain(zone('lineage').content.title)
    for (const s of contentStrings(zone('lineage'))) expect(text(card), s).toContain(s)
    expect(btnByLabel('Show on map')).toBeFalsy()
  })

  it('opens Contact in full without ever being unlocked', () => {
    openZone('contact')
    expect(book()!.classList.contains('locked')).toBe(false)
    expect(text(book())).toContain(zone('contact').content.title)
  })

  /* ---------------- facet:unlocked ---------------- */

  const unlock = (id: string, first = true, announce = true) => events.emit('facet:unlocked', { id, first, announce })

  it('records the chapter whatever the announcement says', () => {
    unlock('lineage', true, false)
    expect(uiState.unlocked).toEqual(['lineage'])
    unlock('lineage', false, false) // idempotent — the scenes record it too
    expect(uiState.unlocked).toEqual(['lineage'])
    unlock('skills', false, true)
    expect(uiState.unlocked).toEqual(['lineage', 'skills'])
  })

  it('opens the card straight away when nothing else is on screen', () => {
    unlock('lineage')
    expect(openIds()).toEqual(['zone:lineage'])
    expect(book()!.classList.contains('locked')).toBe(false)
  })

  it('never opens a card for announce:false — the game shows its own', () => {
    unlock('lineage', true, false)
    expect(isModalOpen()).toBe(false)
    expect(isUnlocked('lineage')).toBe(true)
  })

  it('never re-opens a card for a chapter that was already won', () => {
    uiState.unlocked = ['lineage']
    unlock('lineage', false, true)
    expect(isModalOpen()).toBe(false)
  })

  it('waits for the mini-game to close before opening the card', () => {
    openModal({ id: 'minigame:forge', el: el('div', 'mg'), label: 'Word Forge' })
    unlock('skills')
    expect(openIds()).toEqual(['minigame:forge']) // not over the top of the game
    closeModal('minigame:forge')
    expect(openIds()).toEqual(['zone:skills'])
  })

  it('opens several chapters one card at a time, in the order they were won', () => {
    openModal({ id: 'minigame:claw', el: el('div', 'mg'), label: 'Prize Grab' })
    unlock('lineage')
    unlock('safestride')
    unlock('stealth')
    expect(openIds()).toEqual(['minigame:claw'])
    closeModal('minigame:claw')
    expect(openIds()).toEqual(['zone:lineage'])
    closeModal('zone:lineage')
    expect(openIds()).toEqual(['zone:safestride'])
    closeModal('zone:safestride')
    expect(openIds()).toEqual(['zone:stealth'])
    closeModal('zone:stealth')
    expect(isModalOpen()).toBe(false)
  })

  it('opens one card when a chapter is unlocked and routed at the same moment', () => {
    // The lighthouse lens does both: its `signal` node unlocks `contact` (the
    // facet queue opens the card) and carries a `panel: 'zone:contact'` effect.
    // Two opens of the same id used to close the first card and stack a second
    // — a visible flicker, and a `ui:closed` for a card nobody had closed.
    const closed: string[] = []
    const off = events.on('ui:closed', ({ id }) => closed.push(id))
    unlock('contact')
    events.emit('ui:panel', { id: 'zone:contact' })
    off()
    expect(openIds()).toEqual(['zone:contact'])
    expect(document.querySelectorAll('.book').length).toBe(1)
    expect(closed).toEqual([])
  })

  it('drops what was still queued when you quit to the title', () => {
    openModal({ id: 'minigame:claw', el: el('div', 'mg'), label: 'Prize Grab' })
    unlock('lineage')
    events.emit('game:title', {})
    // quitting closes every modal: each `ui:closed` would otherwise pop a
    // chapter card over the title screen and shut it again
    closeAllModals()
    expect(isModalOpen()).toBe(false)
    expect(document.querySelector('.book')).toBeNull()
  })
})
