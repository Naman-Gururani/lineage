// @vitest-environment happy-dom
//
// The journal's Stats tab and the one progress line the Résumé tab carries.
//
// Every counter on the Stats tab is named for what the fair calls the thing it
// counts — tickets, prize boxes, ducks — while the save underneath still uses
// the island's field names. This suite is what keeps the two apart: rename a
// label here, never a field.
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
import { clearSave, defaultSave, writeSave } from '../src/core/save'
import { duckSummary } from '../src/data/ducks'
import { FORGE_ROUNDS, serialize, newForge, submit, pick, type ForgeState } from '../src/games/forge'
import { initJournal } from '../src/ui/journal'
import { closeAllModals } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'
import { BLUEPRINT } from '../src/world/blueprint'

const text = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim()
const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const openJournalTab = (tab: string) => events.emit('ui:panel', { id: 'journal', data: { tab } })
const stats = () => Array.from(document.querySelectorAll<HTMLElement>('.stat'))
const labels = () => stats().map((s) => text(s.querySelector('dt')))
const stat = (label: string) => text(stats().find((s) => text(s.querySelector('dt')) === label)?.querySelector('dd') ?? null)
const rowFor = (id: string) => q<HTMLButtonElement>(`.rs-row[data-zone="${id}"]`)

/** Spell one word on the current wheel, the way the bench does — a fresh tile per letter. */
function spell(s: ForgeState, word: string): ForgeState {
  const ring = FORGE_ROUNDS[s.round].ring
  const used = new Set<number>()
  let next = s
  for (const ch of word) {
    const i = ring.findIndex((r, idx) => r === ch && !used.has(idx))
    used.add(i)
    next = pick(next, i)
  }
  return submit(next).state
}

describe('journal — Stats tab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    uiState.unlocked = []
    uiState.visitedRegions = []
    uiState.stats = {
      steps: 1234,
      playSeconds: 90,
      fishCaught: 7,
      fish: { rubber: 5, golden: 2 },
      bonks: 3,
      grassCut: 12,
      packets: 4,
      packetsTotal: BLUEPRINT.packetSpots.length,
      discoveries: ['gate', 'coaster', 'forge'],
    }
    clearSave()
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initJournal()
  })

  afterEach(() => {
    closeAllModals()
    clearSave()
    uiState.unlocked = []
    vi.restoreAllMocks()
  })

  it('counts the fair’s collectibles by their fair names', () => {
    openJournalTab('stats')
    expect(labels()).toContain('Tickets')
    expect(stat('Tickets')).toBe(`4 / ${BLUEPRINT.packetSpots.length}`)
    expect(stat('Tickets')).toBe('4 / 20')
    expect(labels()).toContain('Prize boxes')
    // the island's words are gone from the page
    for (const gone of ['Packets', 'Fish caught', 'Species landed']) expect(labels()).not.toContain(gone)
  })

  it('counts ducks, hooked and landed, from the duck table', () => {
    openJournalTab('stats')
    expect(stat('Ducks hooked')).toBe('7')
    expect(stat('Ducks landed')).toBe(duckSummary({ rubber: 5, golden: 2 }))
    expect(stat('Ducks landed')).toContain('Rubber duck')
  })

  it('counts discoveries against the eight attractions, not the eight chapters', () => {
    openJournalTab('stats')
    expect(stat('Discoveries')).toBe(`3 / ${BLUEPRINT.attractions.length}`)
    expect(stat('Discoveries')).toBe('3 / 8')
    expect(stat('Regions visited')).toBe(`0 / ${BLUEPRINT.regions.length}`)
  })

  it('reads the prize boxes out of the save the game writes them to', () => {
    writeSave({ ...defaultSave(), chests: ['c1', 'c2'] })
    openJournalTab('stats')
    expect(stat('Prize boxes')).toBe(`2 / ${BLUEPRINT.chestSpots.length}`)
  })

  it('says none rather than nothing when there is no save yet', () => {
    openJournalTab('stats')
    expect(stat('Prize boxes')).toBe(`0 / ${BLUEPRINT.chestSpots.length}`)
  })
})

describe('journal — the Word Forge’s progress on the Résumé tab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    uiState.unlocked = []
    clearSave()
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initJournal()
  })

  afterEach(() => {
    closeAllModals()
    clearSave()
    uiState.unlocked = []
    vi.restoreAllMocks()
  })

  const words = () => FORGE_ROUNDS.flatMap((r) => r.words.map((w) => w.word))

  it('shows nothing forged yet as 0 of the ten tools', () => {
    openJournalTab('resume')
    expect(text(rowFor('skills'))).toContain(`0 / ${words().length} forged`)
    expect(text(rowFor('skills'))).toContain('0 / 10 forged')
  })

  it('counts the words the bench has actually spelled', () => {
    let s = newForge()
    s = spell(s, FORGE_ROUNDS[0].words[0].word)
    s = spell(s, FORGE_ROUNDS[0].words[1].word)
    expect(s.found.length).toBe(2)
    writeSave({ ...defaultSave(), minigames: { forge: { won: false, best: 0, plays: 1, progress: serialize(s) } } })

    openJournalTab('resume')
    expect(text(rowFor('skills'))).toContain('2 / 10 forged')
  })

  it('drops the line once Skills is won — the chapter speaks for itself', () => {
    writeSave({ ...defaultSave(), minigames: { forge: { won: true, best: 0, plays: 1, progress: { round: 3, found: words() } } } })
    uiState.unlocked = ['skills']
    openJournalTab('resume')
    expect(text(rowFor('skills'))).not.toContain('forged')
  })

  it('leaves every other chapter alone', () => {
    openJournalTab('resume')
    for (const id of ['about', 'experience', 'lineage', 'contact']) expect(text(rowFor(id)), id).not.toContain('forged')
  })
})
