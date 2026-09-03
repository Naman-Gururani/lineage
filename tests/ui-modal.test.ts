// @vitest-environment happy-dom
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
import { closeAllModals, closeModal, isModalOpen, openModal, topModalId } from '../src/ui/modal'
import { uiState } from '../src/ui/state'

const makePanel = (html = '<button class="inner">ok</button>') => {
  const d = document.createElement('div')
  d.innerHTML = html
  return d
}

const pressKey = (target: EventTarget, key: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))

describe('modal manager', () => {
  let locks: boolean[]
  let closed: string[]
  let unsubs: (() => void)[]

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true // synchronous close/removal
    locks = []
    closed = []
    unsubs = [
      events.on('ui:lock', ({ locked }) => locks.push(locked)),
      events.on('ui:closed', ({ id }) => closed.push(id)),
    ]
    for (const k of ['open', 'close', 'select', 'blip', 'pickup'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
  })

  afterEach(() => {
    closeAllModals()
    for (const u of unsubs) u()
    vi.restoreAllMocks()
  })

  it('opens a dialog with backdrop, aria and the lock', () => {
    openModal({ id: 'a', el: makePanel(), label: 'Panel A' })
    expect(isModalOpen()).toBe(true)
    expect(topModalId()).toBe('a')
    const panel = document.querySelector('.modal-panel')!
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(panel.getAttribute('aria-label')).toBe('Panel A')
    expect(document.querySelector('.modal')).toBeTruthy()
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(locks).toEqual([true])
    // focus moved onto the dialog itself (no data-autofocus element here)
    expect((document.activeElement as HTMLElement).className).toBe('modal-panel')
  })

  it('stacks: Esc closes only the top; lock releases after the last', () => {
    openModal({ id: 'a', el: makePanel(), label: 'A' })
    openModal({ id: 'b', el: makePanel(), label: 'B' })
    expect(topModalId()).toBe('b')
    const roots = document.querySelectorAll('.modal')
    expect(roots.length).toBe(2)
    expect(roots[0].hasAttribute('inert')).toBe(true)
    expect(roots[1].hasAttribute('inert')).toBe(false)

    pressKey(window, 'Escape')
    expect(topModalId()).toBe('a')
    expect(closed).toEqual(['b'])
    expect(locks).toEqual([true]) // still locked by 'a'
    expect(document.body.classList.contains('modal-open')).toBe(true)

    closeModal('a')
    expect(isModalOpen()).toBe(false)
    expect(topModalId()).toBe(null)
    expect(closed).toEqual(['b', 'a'])
    expect(locks).toEqual([true, false])
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(document.querySelectorAll('.modal').length).toBe(0)
  })

  it('fires onClose, emits ui:closed and restores focus', () => {
    const outside = document.createElement('button')
    outside.id = 'outside'
    document.body.appendChild(outside)
    outside.focus()
    const onClose = vi.fn()
    openModal({ id: 'a', el: makePanel(), label: 'A', onClose })
    expect(document.activeElement).not.toBe(outside)
    closeModal('a')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(closed).toEqual(['a'])
    expect(document.activeElement).toBe(outside)
  })

  // Two cards in the fair open without a click behind them — the Career card
  // from a cutscene (`prevFocus` is `<body>`) and the tech-stack card over the
  // forge panel that is closing under it (`prevFocus` detached). Both used to
  // leave the document with no focus at all, so Tab restarted at the top.
  it('falls back to the UI root when the opener cannot take focus back', () => {
    const root = document.getElementById('ui')!

    // opened from a cutscene: nothing was focused
    document.body.focus()
    openModal({ id: 'career', el: makePanel(), label: 'Career' })
    closeModal('career')
    expect(document.activeElement).toBe(root)

    // opened over a panel that is removed a moment later
    const dying = document.createElement('button')
    document.body.appendChild(dying)
    dying.focus()
    openModal({ id: 'techstack', el: makePanel(), label: 'Tech stack' })
    dying.remove()
    closeModal('techstack')
    expect(document.activeElement).toBe(root)
    expect(root.tabIndex).toBe(-1)
  })

  it('closes on backdrop click by default, not with closeOnBackdrop:false', () => {
    openModal({ id: 'a', el: makePanel(), label: 'A' })
    const root = document.querySelector('.modal') as HTMLElement
    root.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    expect(isModalOpen()).toBe(false)

    openModal({ id: 'b', el: makePanel(), label: 'B', closeOnBackdrop: false })
    const root2 = document.querySelector('.modal') as HTMLElement
    root2.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    expect(isModalOpen()).toBe(true)
    expect(topModalId()).toBe('b')
  })

  it('traps Tab focus inside the top panel', () => {
    openModal({ id: 't', el: makePanel('<button id="f1">1</button><button id="f2">2</button>'), label: 'T' })
    const f1 = document.getElementById('f1')!
    const f2 = document.getElementById('f2')!
    f2.focus()
    pressKey(f2, 'Tab')
    expect(document.activeElement).toBe(f1)
    pressKey(f1, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(f2)
  })

  it('honours data-autofocus and replaces a re-opened id', () => {
    openModal({ id: 'a', el: makePanel('<button>x</button><button data-autofocus id="go">go</button>'), label: 'A' })
    expect((document.activeElement as HTMLElement).id).toBe('go')
    openModal({ id: 'a', el: makePanel(), label: 'A again' })
    expect(document.querySelectorAll('.modal').length).toBe(1)
    expect(topModalId()).toBe('a')
    expect(closed).toEqual(['a'])
  })
})
