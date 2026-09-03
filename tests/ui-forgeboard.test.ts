// @vitest-environment happy-dom
//
// The prize board outside Ravi's booth: the ten tools, grouped the way the
// Workshop card groups them, with the ones already forged lit up.
//
// Two things are pinned here. The board is fed by the panel payload — it never
// reaches into a save or a host — so the scene can hand it whatever the player
// has forged and the tests can hand it the same thing. And a word that has not
// been forged yet must not appear on the board at all: the board is a progress
// meter, not a cheat sheet.
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { events } from '../src/core/events'
import { defaultSave } from '../src/core/save'
import { ZONES } from '../src/data/content'
import { FORGE_ROUNDS, newForge, serialize } from '../src/games/forge'
import { initForgeboard } from '../src/ui/forgeboard'
import { closeAllModals, topModalId } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))

const board = () => q<HTMLElement>('.forgeboard')
const rows = () => all<HTMLElement>('.fb-word')
const lit = () => rows().filter((r) => r.classList.contains('on'))
const labels = () => all<HTMLElement>('.fb-label').map((l) => l.textContent)
const text = () => (board()?.textContent ?? '').replace(/\s+/g, ' ').trim()

const open = (data?: unknown) => events.emit('ui:panel', { id: 'forgeboard', data })

/** Every word on every wheel, in the order Ravi hangs them. */
const WORDS = FORGE_ROUNDS.flatMap((r) => r.words)

describe('the Word Forge prize board', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    closeAllModals()
    initPanels()
    initForgeboard()
  })

  it('opens from the panel router with a row per tool, none of them lit', () => {
    open()
    expect(topModalId()).toBe('forgeboard')
    expect(q('.modal-title')?.textContent).toBe('Prize board')
    expect(rows()).toHaveLength(WORDS.length)
    expect(rows()).toHaveLength(10)
    expect(lit()).toHaveLength(0)
    expect(text()).toContain('0 / 10 forged')
  })

  it('groups the tools the way the Workshop card groups them', () => {
    open()
    const groups = ZONES.find((z) => z.id === 'skills')?.content.groups ?? []
    // Only the groups the wheels actually spell for, in the card's own order.
    expect(labels()).toEqual(groups.map((g) => g.label))
    expect(labels().length).toBe(3)
  })

  it('lights the words already forged and names the tool behind each', () => {
    open(serialize({ ...newForge(), round: 1, found: ['JAVA', 'KAFKA'] }))
    expect(lit()).toHaveLength(2)
    expect(text()).toContain('2 / 10 forged')
    expect(text()).toContain('JAVA')
    expect(text()).toContain('Java')
    expect(text()).toContain('KAFKA')
    expect(text()).toContain('Apache Kafka')
  })

  it('keeps every unforged word off the board — it is a meter, not a cheat sheet', () => {
    open(serialize({ ...newForge(), round: 1, found: ['JAVA', 'KAFKA'] }))
    for (const w of WORDS) {
      if (w.word === 'JAVA' || w.word === 'KAFKA') continue
      expect(text()).not.toContain(w.word)
      expect(text()).not.toContain(w.skill)
    }
  })

  it('shows a blank per letter for a word still to be forged', () => {
    open()
    const asc = (a: number, b: number) => a - b
    const blanks = rows().map((r) => r.querySelectorAll('.fb-blank').length)
    expect([...blanks].sort(asc)).toEqual(WORDS.map((w) => w.word.length).sort(asc))
    expect(blanks[0]).toBe('JAVA'.length) // the first tool under the first heading
  })

  // The blanks are `aria-hidden`, so without this every unforged row read as the
  // same three words. The length is what the blanks already show; the word and
  // the tool are still withheld.
  it('gives a screen reader the letter count the blanks show', () => {
    open(serialize({ ...newForge(), round: 1, found: ['JAVA', 'KAFKA'] }))
    const said = rows()
      .filter((r) => !r.classList.contains('on'))
      .map((r) => r.querySelector('.sr-only')?.textContent)
    const unforged = WORDS.filter((w) => w.word !== 'JAVA' && w.word !== 'KAFKA')
    // The board hangs its rows in the Workshop card's group order, not the
    // wheels' — so this is the same multiset of lines, not the same sequence.
    const sorted = (xs: (string | null | undefined)[]) => [...xs].sort()
    expect(sorted(said)).toEqual(sorted(unforged.map((w) => `${w.word.length}-letter tool, not forged yet`)))
    expect(said).toContain('3-letter tool, not forged yet') // GIT, SQL
    expect(said).toContain('6-letter tool, not forged yet') // DOCKER, SPRING, PYTHON
  })

  it('shrugs at a payload that is not a record of progress', () => {
    open({ found: 'JAVA' })
    expect(rows()).toHaveLength(10)
    expect(lit()).toHaveLength(0)
    expect(text()).toContain('0 / 10 forged')
  })

  it('says so when every tool is on the wall', () => {
    open(serialize({ ...newForge(), round: FORGE_ROUNDS.length, found: WORDS.map((w) => w.word), status: 'won' }))
    expect(lit()).toHaveLength(10)
    expect(text()).toContain('10 / 10 forged')
  })

  // The board's one hard dependency on the rest of the game: the scene has to
  // put the save's own forge record in the panel payload. It shipped once
  // emitting `ui:panel { id }` with nothing attached, so the board rendered
  // `restore(undefined)` and read "0 / 10" however much had been forged. This
  // drives the exact expression `WorldScene.openPanel` builds — the save record
  // straight off `save.minigames.forge?.progress`, no re-serialising in between.
  it('reads the save record the scene puts in the panel payload', () => {
    const save = defaultSave()
    save.minigames.forge = { won: false, best: 0, plays: 1, progress: serialize({ ...newForge(), round: 1, found: ['JAVA', 'KAFKA', 'FLINK'] }) }
    open(save.minigames.forge?.progress)
    expect(lit()).toHaveLength(3)
    expect(text()).toContain('3 / 10 forged')
    expect(text()).toContain('Apache Flink')
  })

  it('closes on the Close button and on the panel cross', () => {
    open()
    q<HTMLButtonElement>('.forgeboard [data-act="close"]')!.click()
    expect(topModalId()).toBe(null)
    open()
    q<HTMLButtonElement>('.forgeboard .modal-x')!.click()
    expect(topModalId()).toBe(null)
  })
})
