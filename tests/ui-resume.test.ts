// @vitest-environment happy-dom
//
// The two chapter lists: the Journal's Résumé tab (the whole story, in reading
// order, with what is still locked) and the prize shelf in Sol's tent (the
// three projects). Both are the same row: a button that opens the chapter's
// card — the full one when it is won, the locked one when it is not.
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
import { ZONES } from '../src/data/content'
import { STORY_HINTS } from '../src/data/story'
import { initJournal } from '../src/ui/journal'
import { closeAllModals, closeModal } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { initPrizes, PRIZE_IDS } from '../src/ui/prizes'
import { uiState } from '../src/ui/state'

const text = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim()
const rows = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.rs-row'))
const ids = () => rows().map((r) => r.dataset.zone)
const rowFor = (id: string) => rows().find((r) => r.dataset.zone === id)!
const openJournalTab = (tab?: string) => events.emit('ui:panel', { id: 'journal', data: tab ? { tab } : undefined })
const zone = (id: string) => ZONES.find((z) => z.id === id)!

/**
 * Reading order, pinned once. The tab and Reader Mode both take it straight off
 * `ZONES` now, so what is worth writing down is that `ZONES` still reads this
 * way — a chapter shuffled in `content.ts` would otherwise reorder the résumé
 * everywhere at once with nothing to say so.
 */
const READER_ORDER = ['about', 'experience', 'education', 'skills', 'lineage', 'stealth', 'safestride', 'contact']

describe('Journal — Résumé tab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    uiState.unlocked = []
    uiState.objective = null
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initJournal()
    initPrizes()
  })

  afterEach(() => {
    closeAllModals()
    uiState.unlocked = []
    vi.restoreAllMocks()
  })

  it('puts Résumé first and opens on it', () => {
    openJournalTab()
    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'))
    expect(tabs.map((t) => t.dataset.tab)).toEqual(['resume', 'quests', 'achievements', 'stats'])
    expect(text(tabs[0])).toBe('Résumé')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect((document.querySelector('#jp-resume') as HTMLElement).hidden).toBe(false)
  })

  it('lists all eight chapters in reading order, as buttons', () => {
    openJournalTab('resume')
    // The tab iterates `ZONES` itself, so this is the assertion that it does…
    expect(ids()).toEqual(ZONES.map((z) => z.id))
    // …and this is the one that says what that order is meant to be.
    expect(ZONES.map((z) => z.id)).toEqual(READER_ORDER)
    for (const r of rows()) expect(r.tagName).toBe('BUTTON')
  })

  it('marks won chapters ✓ with their title and locked ones 🔒 with the hint', () => {
    uiState.unlocked = ['about', 'lineage']
    openJournalTab('resume')

    const won = rowFor('lineage')
    expect(text(won)).toContain('✓')
    expect(text(won)).toContain(zone('lineage').label)
    expect(text(won)).toContain(zone('lineage').content.title)

    const locked = rowFor('education')
    expect(text(locked)).toContain('🔒')
    expect(text(locked)).toContain(zone('education').label)
    expect(text(locked)).toContain(STORY_HINTS.education)
    expect(text(locked)).not.toContain(zone('education').content.title)
    expect(text(rowFor('skills'))).not.toContain('Apache Kafka')

    // Contact is readable from the first minute
    expect(text(rowFor('contact'))).toContain('✓')
    expect(text(rowFor('contact'))).toContain(zone('contact').content.title)
  })

  it('opens the row’s fourth column only where there is progress to report', () => {
    openJournalTab('resume')
    // Skills is the one chapter you can be part-way through, so it is the one
    // row with a pill — and `has-prog`, the class that makes room for it, must
    // follow the pill exactly: on any other row it is dead space stolen from
    // the hint beside it.
    expect(rows().filter((r) => r.querySelector('.rs-prog')).map((r) => r.dataset.zone)).toEqual(['skills'])
    for (const r of rows()) expect(r.classList.contains('has-prog'), r.dataset.zone).toBe(!!r.querySelector('.rs-prog'))
  })

  it('opens the locked card from a locked row and the full card from a won one', () => {
    uiState.unlocked = ['lineage']
    openJournalTab('resume')

    rowFor('skills').click()
    let card = document.querySelector<HTMLElement>('.book')!
    expect(card.classList.contains('locked')).toBe(true)
    expect(text(card)).toContain(STORY_HINTS.skills)
    closeModal('zone:skills')

    rowFor('lineage').click()
    card = document.querySelector<HTMLElement>('.book')!
    expect(card.classList.contains('locked')).toBe(false)
    expect(text(card)).toContain(zone('lineage').content.title)
  })
})

describe('prize shelf', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    uiState.unlocked = []
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initPrizes()
  })

  afterEach(() => {
    closeAllModals()
    uiState.unlocked = []
    vi.restoreAllMocks()
  })

  it('lists the three projects with their lock state', () => {
    uiState.unlocked = ['safestride']
    events.emit('ui:panel', { id: 'prizes', data: undefined })
    expect(PRIZE_IDS).toEqual(['lineage', 'safestride', 'stealth'])
    expect(ids()).toEqual(['lineage', 'safestride', 'stealth'])
    expect(text(rowFor('safestride'))).toContain('✓')
    expect(text(rowFor('lineage'))).toContain('🔒')
    expect(text(rowFor('lineage'))).toContain(STORY_HINTS.lineage)
    expect(text(rowFor('lineage'))).not.toContain(zone('lineage').content.title)
    // the shelf reports no progress, so no row asks for the extra column
    for (const r of rows()) expect(r.classList.contains('has-prog'), r.dataset.zone).toBe(false)
  })

  it('tells the three locked prizes apart — all three are labelled "Project"', () => {
    events.emit('ui:panel', { id: 'prizes', data: undefined })
    const lines = rows().map((r) => text(r))
    expect(new Set(lines).size, `identical rows: ${lines.join(' | ')}`).toBe(3)
    // All three are won at the one tent, so the venue no longer separates them.
    // What does is the label on the box the claw grabs for, which the cabinet
    // shows to anyone who walks up to it.
    for (const id of PRIZE_IDS) {
      expect(text(rowFor(id)), id).toContain(zone(id).label)
      expect(text(rowFor(id)), id).toContain(zone(id).name) // the hint: "Win it at the Prize Tent."
      expect(text(rowFor(id)), id).toContain(zone(id).short!)
      // the chapter itself still says nothing beyond that label (Safe Stride's
      // title *is* the label on its box, so that one has nothing left to give)
      if (zone(id).content.title !== zone(id).short) expect(text(rowFor(id)), id).not.toContain(zone(id).content.title)
      expect(text(rowFor(id)), id).not.toContain(zone(id).content.sub ?? '~')
    }
    expect(zone('stealth').short, 'the stealth product stays unnamed').toBe('???')
  })

  it('opens a prize card from its row', () => {
    uiState.unlocked = ['stealth']
    events.emit('ui:panel', { id: 'prizes', data: undefined })
    rowFor('stealth').click()
    const card = document.querySelector<HTMLElement>('.book')!
    expect(card.classList.contains('locked')).toBe(false)
    expect(text(card)).toContain(zone('stealth').content.title)
  })
})
