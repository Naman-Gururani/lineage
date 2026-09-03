// @vitest-environment happy-dom
//
// The Career Coaster's two pieces of DOM: the milestone card that slides in at
// each résumé beat while the cart is still moving, and the Career card the ride
// parks on.
//
// The milestone card is deliberately *not* a modal: no focus trap, and Esc still
// belongs to the cutscene. It is a caption with exactly one control — Next, which
// is what moves the cart on, because the cart now waits at every beat for as long
// as the rider wants to read it. `hidden` between beats so nothing lingers over
// the world, the button focused while a beat is up so Enter and Space activate it
// natively, and a permanent `sr-only` status beside it that carries each beat to
// a screen reader — the card itself is hidden at the moment its text changes, so
// a live region on it says nothing.
//
// The Career card is the ride's payout, and every word in it is cut from
// `data/content.ts` by `careerCard()` — this file only has to prove it arrives
// whole.
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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { events } from '../src/core/events'
import { COASTER_STOPS, careerCard } from '../src/data/coaster'
import { closeAllModals, topModalId } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { initRidecard } from '../src/ui/ridecard'
import { uiState } from '../src/ui/state'

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)

const card = () => q<HTMLElement>('.ride-card')
const kicker = () => q<HTMLElement>('.ride-kicker')?.textContent ?? ''
const title = () => q<HTMLElement>('.ride-title')?.textContent ?? ''
const line = () => q<HTMLElement>('.ride-line')?.textContent ?? ''
const live = () => q<HTMLElement>('.ride-live')

const show = (data: unknown) => events.emit('ui:panel', { id: 'ridecard', data })
const hide = () => events.emit('ui:panel', { id: 'ridecard', data: null })

describe('the coaster milestone card', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    closeAllModals()
    initPanels()
    initRidecard()
  })

  it('starts hidden — nothing on screen until the cart reaches a beat', () => {
    expect(card()).toBeTruthy()
    expect(card()!.hidden).toBe(true)
  })

  it('shows the kicker, the title and the one line of a beat', () => {
    show(COASTER_STOPS[0])
    expect(card()!.hidden).toBe(false)
    expect(kicker()).toBe(COASTER_STOPS[0].kicker)
    expect(title()).toBe(COASTER_STOPS[0].title)
    expect(line()).toBe(COASTER_STOPS[0].line)
  })

  it('swaps to the next beat and hides between them', () => {
    for (const stop of COASTER_STOPS) {
      show(stop)
      expect(card()!.hidden).toBe(false)
      expect(title()).toBe(stop.title)
      hide()
      expect(card()!.hidden).toBe(true)
    }
  })

  it('is a caption, not a dialog: no modal, no focus trap, one control', () => {
    show(COASTER_STOPS[2])
    expect(topModalId()).toBe(null)
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(card()!.getAttribute('role')).not.toBe('dialog')
    // The one thing the rider presses — and the only thing. A second button on a
    // caption with no trap around it is a tab-order maze over a locked world.
    expect(card()!.querySelectorAll('button')).toHaveLength(1)
    expect(card()!.querySelector('button')!.classList.contains('ride-next')).toBe(true)
  })

  // The card shipped with `aria-live` on the card itself, which announced
  // nothing: the beat is written while the card is still `hidden`, and a live
  // region in a hidden subtree does not speak. The announcement is a permanent
  // sibling that is never hidden, so every beat reaches a screen reader.
  it('speaks each beat through a status line that is never hidden', () => {
    expect(live()).toBeTruthy()
    expect(live()!.getAttribute('role')).toBe('status')
    expect(live()!.getAttribute('aria-live')).toBe('polite')
    expect(live()!.classList.contains('sr-only')).toBe(true)
    expect(live()!.hidden).toBe(false)
    expect(live()!.closest('.ride-card')).toBeNull()

    for (const stop of COASTER_STOPS) {
      show(stop)
      expect(live()!.hidden).toBe(false)
      // The beat, then what to do about it: the card waits for Next, and a rider
      // who cannot see the button has to be told it is there.
      expect(live()!.textContent).toBe(`${stop.kicker}. ${stop.title}. ${stop.line} Press Next to continue.`)
      hide()
      // The caption goes; what was said stays said — clearing it here would
      // announce an empty string between every pair of beats.
      expect(card()!.hidden).toBe(true)
      expect(live()!.hidden).toBe(false)
    }
    expect(document.querySelectorAll('.ride-live')).toHaveLength(1)
  })

  it('reuses one element however many beats go past', () => {
    for (const stop of COASTER_STOPS) show(stop)
    expect(document.querySelectorAll('.ride-card')).toHaveLength(1)
  })

  it('survives a second init (the UI layer is built once per session, but still)', () => {
    initRidecard()
    show(COASTER_STOPS[1])
    expect(document.querySelectorAll('.ride-card')).toHaveLength(1)
    expect(title()).toBe(COASTER_STOPS[1].title)
  })

  it('escapes its copy rather than pasting it into the page as markup', () => {
    show({ kicker: '2020', title: '<img src=x onerror=alert(1)>', line: 'a & b' })
    expect(card()!.querySelector('img')).toBeNull()
    expect(title()).toBe('<img src=x onerror=alert(1)>')
    expect(line()).toBe('a & b')
  })

  it('shrugs at a payload that is not a beat', () => {
    show(COASTER_STOPS[0])
    show({ nonsense: true })
    expect(card()!.hidden).toBe(true)
    show(undefined)
    expect(card()!.hidden).toBe(true)
  })

  it('wraps the long beat — stop four’s line is a whole sentence', () => {
    const longest = COASTER_STOPS.reduce((a, b) => (b.line.length > a.line.length ? b : a))
    expect(longest.line.length).toBeGreaterThan(120)
    show(longest)
    // The element carries the class the stylesheet wraps; nothing may clip it.
    expect(card()!.querySelector('.ride-line')?.textContent).toBe(longest.line)
    expect(card()!.style.whiteSpace).not.toBe('nowrap')
  })
})

/**
 * The rider's own pacing. A ride that rolls on by itself reads its own résumé to
 * you at its own speed; these are the tests that keep the cart standing at each
 * beat until the person watching says go.
 */
describe('the milestone card’s Next', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui" tabindex="-1"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    closeAllModals()
    initPanels()
    initRidecard()
  })

  const next = () => q<HTMLButtonElement>('.ride-next')
  const keys = () => q<HTMLElement>('.ride-keys')?.textContent ?? ''

  /** Count `ride:next` while a test runs, and stop counting afterwards. */
  function watch() {
    const hits: unknown[] = []
    const off = events.on('ride:next', (p) => hits.push(p))
    return { hits, off }
  }

  const press = (init: KeyboardEventInit) => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))

  it('offers one Next button and says which keys are it', () => {
    show(COASTER_STOPS[0])
    expect(next()).toBeTruthy()
    expect(next()!.type).toBe('button')
    expect(next()!.textContent).toContain('Next')
    expect(next()!.closest('.ride-card')).toBe(card())
    expect(keys()).toContain('Enter')
    // House rule: no digits anywhere in the UI's own copy.
    expect(`${next()!.textContent}${keys()}`).not.toMatch(/\d/)
  })

  it('asks the ride for the next beat when it is clicked, once, and takes the card away', () => {
    const w = watch()
    show(COASTER_STOPS[0])
    next()!.click()
    expect(w.hits).toHaveLength(1)
    expect(card()!.hidden).toBe(true)
    // The runner has already been told; a second press on a card that is gone is
    // not a second beat.
    next()!.click()
    expect(w.hits).toHaveLength(1)
    w.off()
  })

  it('puts focus on the button as the beat lands, so Enter and Space are its own', () => {
    show(COASTER_STOPS[1])
    expect(document.activeElement).toBe(next())
  })

  it('takes Enter, Space and E from the document while a beat is up', () => {
    for (const init of [{ key: 'Enter', code: 'Enter' }, { key: ' ', code: 'Space' }, { key: 'e', code: 'KeyE' }]) {
      const w = watch()
      show(COASTER_STOPS[0])
      press(init)
      expect(w.hits, `${init.code}`).toHaveLength(1)
      expect(card()!.hidden).toBe(true)
      w.off()
    }
  })

  it('keeps the key to itself, so the world’s action key does not fire behind the cutscene', () => {
    const heard: string[] = []
    const spy = (e: Event) => heard.push((e as KeyboardEvent).code)
    window.addEventListener('keydown', spy)
    show(COASTER_STOPS[0])
    // The control: a key the card does not own still reaches the window listeners
    // the game reads its input from…
    press({ key: 'q', code: 'KeyQ' })
    expect(heard).toEqual(['KeyQ'])
    // …and the card's own does not.
    press({ key: 'Enter', code: 'Enter' })
    expect(heard).toEqual(['KeyQ'])
    window.removeEventListener('keydown', spy)
  })

  it('is deaf between beats: no card, no listener', () => {
    const w = watch()
    show(COASTER_STOPS[0])
    hide()
    press({ key: 'Enter', code: 'Enter' })
    press({ key: 'e', code: 'KeyE' })
    expect(w.hits).toHaveLength(0)
    w.off()
  })

  it('does not run through the ride on a held key', () => {
    const w = watch()
    show(COASTER_STOPS[0])
    press({ key: 'Enter', code: 'Enter', repeat: true })
    expect(w.hits).toHaveLength(0)
    w.off()
  })

  it('hands focus back to the overlay root when the card goes', () => {
    show(COASTER_STOPS[0])
    next()!.click()
    expect(document.activeElement).toBe(document.getElementById('ui'))
  })

  it('leaves focus alone when something else has already taken it', () => {
    // The last beat's card is dismissed as the Career card opens over it; the
    // caption must not snatch focus back out of the modal on its way out.
    show(COASTER_STOPS[4])
    const other = document.createElement('button')
    document.getElementById('ui')!.appendChild(other)
    other.focus()
    hide()
    expect(document.activeElement).toBe(other)
  })
})

describe('the Career card', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    closeAllModals()
    initPanels()
    initRidecard()
  })

  const open = () => events.emit('ui:panel', { id: 'career' })

  it('opens as a chapter card titled Career', () => {
    open()
    expect(topModalId()).toBe('career')
    // The chapter book types its title in, so the heading holds the text twice —
    // once for the screen reader, once for the typewriter.
    expect(q('.book .d-title')?.textContent).toContain('Career')
    expect(q('.modal-panel')?.getAttribute('aria-label')).toBe('Career')
  })

  it('carries both role headlines, the degree and the stack', () => {
    open()
    const c = careerCard()
    const text = (q('.book')?.textContent ?? '').replace(/\s+/g, ' ')
    for (const p of c.body ?? []) expect(text).toContain(p.replace(/\s+/g, ' '))
    for (const chip of c.chips ?? []) expect(text).toContain(chip)
    for (const f of c.facts ?? []) expect(text).toContain(f.v)
  })

  it('names the ride in its footer, so the card knows where it was won', () => {
    open()
    expect(q('.book-foot')?.textContent).toContain('Career Coaster')
  })

  it('does not stack a second copy when the ride is taken again', () => {
    open()
    open()
    expect(document.querySelectorAll('.modal[data-id="career"]')).toHaveLength(1)
  })

  it('closes on its Close button', () => {
    open()
    q<HTMLButtonElement>('.book [data-act="close"]')!.click()
    expect(topModalId()).toBe(null)
  })
})

describe('ridecard — layering', () => {
  it('never reaches into the game’s input module', () => {
    // `ui/*` reads the DOM; held keys are the scenes' business (module-graph.test).
    const src = readFileSync(resolve(__dirname, '../src/ui/ridecard.ts'), 'utf8')
    expect(src).not.toMatch(/from\s+'[^']*core\/keys'/)
    expect(src).not.toMatch(/from\s+'[^']*phaser'/i)
  })
})
