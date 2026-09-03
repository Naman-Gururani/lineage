// @vitest-environment happy-dom
//
// The finger-post card, wired the way the running game wires it: the scene's
// key handler lives behind `keys.onDown` (a window listener installed when
// `core/keys` is imported), the panel layer's own window listener is installed
// later by `initPanels`, and one real `keydown` runs the whole chain —
// scene → `ui:panel` → `openSign` → `openModal` — inside a single dispatch.
//
// Every key here is dispatched at a real target and allowed to bubble, because
// that ordering is the whole story: the card's own close listener sits on the
// modal panel (deep in the tree, so it runs *before* the window listeners),
// while the scene's sits on `window` (so it runs last). E both reads a post and
// walks on from it, which makes the same key the opener and the closer.
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
// imported for its side effect: the window keydown listener the scenes read
import { keys } from '../src/core/keys'
import { SIGNS } from '../src/data/signs'
import { closeAllModals, isModalOpen } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

/** The scene's key handler, as `WorldScene.create` installs it. */
function wireScene(onE: () => void): () => void {
  return keys.onDown((e) => {
    if (document.body.classList.contains('modal-open')) return
    if (e.code === 'KeyE' || e.code === 'Enter') onE()
  })
}

const evt = (type: 'keydown' | 'keyup', init: KeyboardEventInit = {}) =>
  new KeyboardEvent(type, { key: 'e', code: 'KeyE', bubbles: true, cancelable: true, ...init })

/** Press a key at `target` — the focused element, as a browser delivers it. */
const press = (target: EventTarget = document.body, init: KeyboardEventInit = {}) => target.dispatchEvent(evt('keydown', init))
/** Let a key go. The keyup is never swallowed, so `core/keys` always sees it. */
const release = (target: EventTarget = document.body, init: KeyboardEventInit = {}) => target.dispatchEvent(evt('keyup', init))
const pressE = press
const releaseE = release
const ENTER: KeyboardEventInit = { key: 'Enter', code: 'Enter' }

const card = () => document.querySelector('.signcard')
const panel = () => document.querySelector('.modal-panel')!

describe('finger post card', () => {
  let offScene: (() => void) | null = null

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true // synchronous close/removal
    for (const k of ['open', 'close', 'select', 'blip', 'pickup'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    offScene = wireScene(() => events.emit('ui:panel', { id: 'sign', data: 'gate' }))
  })

  afterEach(() => {
    releaseE() // never leave a key down in `core/keys`' shared state
    offScene?.()
    offScene = null
    closeAllModals()
    vi.restoreAllMocks()
  })

  it('routes ui:panel {id:"sign"} to the card', () => {
    events.emit('ui:panel', { id: 'sign', data: 'gate' })
    expect(card()).toBeTruthy()
    expect(document.querySelectorAll('.sign-arm').length).toBe(SIGNS[0].arms.length)
  })

  it('opens on the E keydown that triggers it', () => {
    pressE()
    expect(card()).toBeTruthy()
    expect(isModalOpen()).toBe(true)
  })

  // The regression. Opening the card moves focus onto the modal panel, so every
  // further keydown of the *same* press lands on the card's own close listener:
  // a browser auto-repeat, or a harness that re-sends keydown to hold the key.
  // The card must outlive the press that opened it.
  it('survives the press that opened it being delivered again before any keyup', () => {
    pressE()
    expect(card()).toBeTruthy()
    pressE(panel()) // still held: no keyup has been seen
    expect(card(), 'the opening press closed the card it had just opened').toBeTruthy()
    pressE(panel(), { repeat: true }) // and again, this time flagged as a repeat
    expect(card()).toBeTruthy()
  })

  it('walks on when E is released and pressed again', () => {
    pressE()
    expect(card()).toBeTruthy()
    releaseE(panel())
    pressE(panel())
    expect(card()).toBeFalsy()
    expect(isModalOpen()).toBe(false)
  })

  // The card is opened by E *or* Enter, so the arming cannot key off E alone:
  // the end of the opening press is the first keyup the dialog sees, whatever
  // key it belonged to.
  it('opens on Enter and walks on with E once the opening key is released', () => {
    press(document.body, ENTER)
    expect(card()).toBeTruthy()
    press(panel()) // Enter still down: E must not close it yet
    expect(card()).toBeTruthy()
    release(panel(), ENTER)
    pressE(panel())
    expect(card()).toBeFalsy()
  })

  it('never lets E reach the scene behind it, open or held', () => {
    let sceneSawE = 0
    const off = keys.onDown((e) => {
      if (e.code === 'KeyE') sceneSawE++
    })
    pressE() // opens the card; the scene reads this one
    expect(sceneSawE).toBe(1)
    pressE(panel()) // swallowed at the panel
    releaseE(panel())
    pressE(panel()) // closes the card, also swallowed
    expect(sceneSawE).toBe(1)
    off()
  })
})
