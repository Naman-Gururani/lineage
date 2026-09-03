// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

// The atlas is built by BootScene, long after the UI mounts: the card asks for
// the portrait frame only when it is shown. Record what it asks for.
const atlas = vi.hoisted(() => ({ url: 'data:image/png;base64,PORTRAIT', calls: [] as [string, number | undefined][] }))
vi.mock('../src/art/atlas', () => ({
  frameDataURL: (name: string, scale?: number) => {
    atlas.calls.push([name, scale])
    return atlas.url
  },
}))

import { sfx } from '../src/audio/sfx'
import { events } from '../src/core/events'
import { defaultSave, loadSave, writeSave, type Save } from '../src/core/save'
import { PROFILE } from '../src/data/content'
import { closeAllModals } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { closeReader, initReader, isReaderOpen } from '../src/ui/reader'
import { uiState } from '../src/ui/state'
import { initTitle } from '../src/ui/title'
import { initWelcome, isWelcomeOpen } from '../src/ui/welcome'

/* ---------------- helpers ---------------- */

const card = () => document.querySelector('.welcome') as HTMLElement
const q = <T extends HTMLElement>(sel: string) => card().querySelector<T>(sel)!
const txt = (sel: string) => (q(sel).textContent ?? '').replace(/\s+/g, ' ').trim()
const rows = () =>
  Array.from(card().querySelectorAll('.welcome-howto .welcome-how')).map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())
const primary = () => q<HTMLButtonElement>('.welcome-actions .primary')
const btn = (act: string) => q<HTMLButtonElement>(`[data-act="${act}"]`)
const press = (key: string, init: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
const active = () => document.activeElement as HTMLElement
const seed = (patch: Partial<Save> = {}) => writeSave({ ...defaultSave(), xp: 40, ...patch })
const show = (hasSave: boolean) => events.emit('ui:title', { hasSave })

describe('welcome card', () => {
  let fired: { k: string; p: unknown }[]
  let unsubs: (() => void)[]

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    localStorage.clear()
    atlas.calls.length = 0
    uiState.settings.reducedMotion = true // synchronous modal close
    for (const k of ['open', 'close', 'select', 'blip', 'resume'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    fired = []
    unsubs = (['game:new', 'game:continue', 'game:reader', 'ui:panel', 'save:changed'] as const).map((k) =>
      events.on(k, (p) => fired.push({ k, p })),
    )
    initWelcome(document.getElementById('ui')!)
  })

  afterEach(() => {
    closeReader()
    closeAllModals()
    for (const u of unsubs) u()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  /* ---------------- identity + copy ---------------- */

  it('mounts hidden and opens on ui:title', () => {
    expect(card()).toBeTruthy()
    expect(card().classList.contains('hidden')).toBe(true)
    expect(isWelcomeOpen()).toBe(false)
    show(false)
    expect(card().classList.contains('hidden')).toBe(false)
    expect(isWelcomeOpen()).toBe(true)
  })

  it('renders the identity from PROFILE, not from duplicated strings', () => {
    show(false)
    expect(PROFILE.location).toBe('India')
    expect(txt('.welcome-name')).toBe(PROFILE.name)
    expect(txt('.welcome-role')).toBe(`${PROFILE.role} · ${PROFILE.company} · ${PROFILE.location}`)
    // the same line, as the brief spells it
    expect(txt('.welcome-role')).toBe('Software Development Engineer · Barclays · India')
    expect(txt('.welcome-name')).toBe('Naman Gururani')

    const src = readFileSync(resolve(process.cwd(), 'src/ui/welcome.ts'), 'utf8')
    expect(src).toContain('PROFILE.name') // reading the right file
    for (const dupe of [PROFILE.name, PROFILE.role, PROFILE.company, PROFILE.email, PROFILE.github, PROFILE.linkedin])
      expect(src).not.toContain(dupe)
  })

  it('shows the pitch, the how-to rows and the reader footer, verbatim', () => {
    show(false)
    expect(txt('.welcome-pitch')).toBe('I build real-time systems that move money — this fair is my résumé. Bo has your ticket.')
    expect(rows()).toEqual(['Move — WASD / arrows', 'Run — automatic (Shift to stroll)', 'Jump — Space', 'Interact — E'])
    expect(txt('.welcome-foot')).toBe('Prefer plain text? Reader Mode has everything.')
  })

  it('draws the portrait from the atlas at 2× when the card opens', () => {
    expect(atlas.calls).toEqual([]) // nothing asked for at mount time
    show(false)
    expect(atlas.calls).toContainEqual(['portrait_naman', 2])
    const img = q<HTMLImageElement>('.welcome-portrait')
    expect(img.getAttribute('src')).toBe(atlas.url)
    expect(img.hidden).toBe(false)
    expect(img.getAttribute('alt')).toBe('')
  })

  /* ---------------- actions ---------------- */

  it('offers ▶ Start and no New Game when there is no save', () => {
    show(false)
    expect(primary().dataset.act).toBe('start')
    expect((primary().textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('▶ Start')
    expect(btn('new').hidden).toBe(true)
  })

  it('makes Continue the primary and reveals New Game when a save exists', () => {
    seed()
    show(true)
    expect(primary().dataset.act).toBe('continue')
    expect((primary().textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('Continue')
    const fresh = btn('new')
    expect(fresh.hidden).toBe(false)
    expect((fresh.textContent ?? '').trim()).toBe('New Game')
    expect(fresh.classList.contains('primary')).toBe(false)
  })

  it('starts a fresh run without writing a placeholder save', () => {
    show(false)
    primary().click()
    expect(fired.map((f) => f.k)).toEqual(['game:new'])
    expect(isWelcomeOpen()).toBe(false)
    expect(loadSave()).toBeNull()
  })

  it('flags welcomeSeen in the save before continuing', () => {
    seed({ welcomeSeen: false })
    show(true)
    let seenAtEmit: boolean | undefined
    const off = events.on('game:continue', () => (seenAtEmit = loadSave()?.welcomeSeen))
    primary().click()
    off()
    expect(fired.map((f) => f.k)).toEqual(['game:continue'])
    expect(seenAtEmit).toBe(true) // written before the world reads the save
    expect(loadSave()?.welcomeSeen).toBe(true)
    expect(loadSave()?.xp).toBe(40) // and nothing else was lost
    expect(isWelcomeOpen()).toBe(false)
  })

  it('asks before New Game wipes a save, and keeps it on cancel', () => {
    seed()
    show(true)
    btn('new').click()
    const confirm = document.querySelector('.confirm') as HTMLElement
    expect(confirm).toBeTruthy()
    confirm.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click()
    expect(document.querySelector('.confirm')).toBeNull()
    expect(loadSave()?.xp).toBe(40)
    expect(fired.map((f) => f.k)).toEqual([])
    expect(isWelcomeOpen()).toBe(true)
  })

  it('wipes the save and starts over when the confirm is accepted', () => {
    seed()
    show(true)
    btn('new').click()
    const confirm = document.querySelector('.confirm') as HTMLElement
    confirm.querySelector<HTMLButtonElement>('[data-act="wipe"]')!.click()
    expect(loadSave()).toBeNull()
    expect(document.querySelector('.confirm')).toBeNull()
    expect(fired.map((f) => f.k)).toEqual(['save:changed', 'game:new'])
    expect(isWelcomeOpen()).toBe(false)
  })

  it('opens Settings from the card', () => {
    show(false)
    btn('settings').click()
    expect(fired).toEqual([{ k: 'ui:panel', p: { id: 'settings' } }])
    expect(isWelcomeOpen()).toBe(true)
  })

  /* ---------------- quick links ---------------- */

  it('links out to GitHub, LinkedIn and email straight from PROFILE', () => {
    show(false)
    const links = Array.from(card().querySelectorAll<HTMLAnchorElement>('.welcome-links a'))
    expect(links.map((a) => a.textContent?.trim())).toEqual(['GitHub', 'LinkedIn', 'Email'])
    expect(links.map((a) => a.getAttribute('href'))).toEqual([PROFILE.github, PROFILE.linkedin, `mailto:${PROFILE.email}`])
    for (const a of links.slice(0, 2)) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toContain('noopener')
    }
  })

  it('keeps Reader Mode one click away', () => {
    show(false)
    const reader = btn('reader')
    expect(reader.closest('.welcome-links')).toBeTruthy()
    expect((reader.textContent ?? '').trim()).toBe('Reader Mode')
    reader.click()
    expect(fired.map((f) => f.k)).toEqual(['game:reader'])
    expect(isWelcomeOpen()).toBe(true) // the card stays put behind the reader
  })

  /* ---------------- keyboard ---------------- */

  it('focuses the primary action when it opens', () => {
    seed()
    show(true)
    expect(active()).toBe(primary())
  })

  it('moves focus with the arrow keys and wraps', () => {
    show(false)
    const ring = Array.from(card().querySelectorAll<HTMLElement>('a[href],button:not([disabled])')).filter((n) => !n.hidden)
    expect(active()).toBe(primary())
    const at = ring.indexOf(primary())
    press('ArrowDown')
    expect(active()).toBe(ring[at + 1])
    press('ArrowUp')
    expect(active()).toBe(primary())
    ring[ring.length - 1].focus()
    press('ArrowRight')
    expect(active()).toBe(ring[0])
    press('ArrowLeft')
    expect(active()).toBe(ring[ring.length - 1])
  })

  it('traps Tab inside the card', () => {
    show(false)
    const ring = Array.from(card().querySelectorAll<HTMLElement>('a[href],button:not([disabled])')).filter((n) => !n.hidden)
    ring[ring.length - 1].focus()
    press('Tab')
    expect(active()).toBe(ring[0])
    press('Tab', { shiftKey: true })
    expect(active()).toBe(ring[ring.length - 1])
    document.body.focus()
    press('Tab')
    expect(card().contains(active())).toBe(true)
  })

  it('activates the focused action with Enter', () => {
    seed()
    show(true)
    press('Enter')
    expect(fired.map((f) => f.k)).toEqual(['game:continue'])
  })

  it('activates whatever is focused, not always the primary', () => {
    show(false)
    btn('settings').focus()
    press('Enter')
    expect(fired).toEqual([{ k: 'ui:panel', p: { id: 'settings' } }])
  })

  it('ignores keys while it is closed', () => {
    press('Enter')
    press('Tab')
    expect(fired).toEqual([])
  })

  it('hands the keyboard over to Reader Mode and takes it back', () => {
    initPanels()
    initReader()
    show(false)
    btn('reader').click()
    expect(isReaderOpen()).toBe(true)

    // the card is still mounted behind the reader: it must not act on keys
    press('Enter')
    press('ArrowDown')
    expect(fired.map((f) => f.k)).toEqual(['game:reader'])
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(isReaderOpen()).toBe(false)

    press('Enter')
    expect(fired.map((f) => f.k)).toEqual(['game:reader', 'game:new'])
  })

  it('ignores keys while a modal of its own is up', () => {
    seed()
    show(true)
    btn('new').click()
    press('Enter')
    expect(loadSave()?.xp).toBe(40)
    expect(fired.map((f) => f.k)).toEqual([])
  })

  /* ---------------- mobile ---------------- */

  it('swaps in the touch legend on a coarse pointer', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('coarse'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )
    show(false)
    expect(rows()).toEqual(['Move — left stick', 'Jump — B', 'Interact — A'])
    expect(card().classList.contains('welcome-touch')).toBe(true)
  })

  it('re-reads storage when the world bounces back to the title', () => {
    seed()
    events.emit('game:title', {})
    expect(primary().dataset.act).toBe('continue')
    localStorage.clear() // Settings → Reset save wipes, then emits game:title
    events.emit('game:title', {})
    expect(primary().dataset.act).toBe('start')
    expect(btn('new').hidden).toBe(true)
  })

  /* ---------------- the old title screen ---------------- */

  it('is what initTitle mounts now', () => {
    document.body.innerHTML = '<div id="ui"></div>'
    initTitle(document.getElementById('ui')!)
    expect(document.querySelectorAll('.welcome').length).toBe(1)
    expect(document.querySelector('.title')).toBeNull()
    show(false)
    expect(txt('.welcome-name')).toBe(PROFILE.name)
  })
})
