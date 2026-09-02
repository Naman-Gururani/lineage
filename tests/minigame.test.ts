// @vitest-environment happy-dom
//
// The mini-game host: the modal it owns, the world lock it holds, the gag every
// game reaches for, and the teardown funnel that records every round exactly
// once. The five cabinets themselves are tested in tests/minigame-<id>.test.ts.
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

import { events, type Events } from '../src/core/events'
import { PROFILE } from '../src/data/content'
import { ARCADE_GAMES, GameState } from '../src/systems/GameState'
import { MERCY_HIRES, MINIGAME_IDS, MinigameHost, initMinigames, isMinigameId } from '../src/systems/Minigame'
import { closeAllModals, focusables, isLocked, isModalOpen, topModalId } from '../src/ui/modal'
import { initMinigameRenderers } from '../src/ui/minigames'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

type Toast = Events['ui:toast']

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))
const key = (k: string) => {
  const target = (document.activeElement as HTMLElement) ?? document.body
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}
const last = <T,>(a: T[]): T | undefined => a[a.length - 1]
const gagButtons = () => all<HTMLButtonElement>('.mg-gag [data-act]')

describe('mini-game host', () => {
  let host: MinigameHost
  let state: GameState
  let toasts: Toast[]
  let unsub: () => void

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    history.replaceState(null, '', '/')
    uiState.settings.reducedMotion = true // synchronous modal close, no win delay
    // happy-dom has no 2D context; the canvas cabinets (claw, flappy, crew) need
    // one to mount at all. A Proxy that answers every call with a no-op and every
    // property read with a harmless value stands in for it.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => new Proxy({}, { get: (_t, k) => (k === 'canvas' ? null : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D,
    )
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
    toasts = []
    unsub = events.on('ui:toast', (t) => toasts.push(t))
    initPanels()
    initMinigames()
    initMinigameRenderers()
    host = new MinigameHost()
    state = new GameState(null)
    host.state = state
  })

  afterEach(() => {
    closeAllModals()
    unsub()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /* ---------------- the framework ---------------- */

  it('knows its ids', () => {
    expect(isMinigameId('wordle')).toBe(true)
    expect(isMinigameId('claw')).toBe(true)
    expect(isMinigameId('studyhall')).toBe(false)
    expect(isMinigameId('fishing')).toBe(false)
  })

  // `GameState` keeps its own copy of this list so the save layer never has to
  // import the DOM-side host. The badge for beating all of them is only honest
  // while the two agree.
  it('agrees with the save layer about how many cabinets there are', () => {
    expect([...ARCADE_GAMES]).toEqual(MINIGAME_IDS)
  })

  it('opens a modal, holds the world lock, and lets go on close', () => {
    host.open('wordle')
    expect(host.openId).toBe('wordle')
    expect(isModalOpen()).toBe(true)
    expect(topModalId()).toBe('minigame')
    expect(isLocked()).toBe(true)
    expect(q('.modal-panel')?.getAttribute('aria-label')).toBe("Bo's Word Puzzle")
    expect(q('.mg')?.dataset.game).toBe('wordle')

    host.quit()
    expect(host.openId).toBe(null)
    expect(isModalOpen()).toBe(false)
    expect(isLocked()).toBe(false)
  })

  it('records an abandoned round as a play, not a win', () => {
    host.open('claw')
    host.quit()
    expect(state.save.minigames.claw).toEqual({ won: false, best: 0, plays: 1 })
    expect(state.save.hats).toEqual([])
  })

  it('has a renderer wired up for every cabinet on the list', () => {
    for (const id of MINIGAME_IDS) {
      host.open(id)
      expect(host.openId, `${id} has no renderer`).toBe(id)
      expect(q('.mg')?.dataset.game).toBe(id)
      closeAllModals()
    }
  })

  it('says so for an id the router has never heard of', () => {
    events.emit('ui:panel', { id: 'minigame', data: 'nonsense' })
    expect(isModalOpen()).toBe(false)
    expect(last(toasts)?.title).toBe('Coming soon.')
  })

  it('routes the `minigame` panel id through the shared host', () => {
    events.emit('ui:panel', { id: 'minigame', data: 'flappy' })
    expect(q('.mg')?.dataset.game).toBe('flappy')
    closeAllModals()
  })

  it('asks before Esc throws the round away, and leaves when told to', async () => {
    host.open('claw')
    key('Escape')
    await new Promise((r) => setTimeout(r, 0)) // the confirm is deferred a tick
    expect(topModalId()).toBe('minigame-exit')
    expect(host.openId).toBe('claw') // still playing
    q<HTMLButtonElement>('[data-act="stay"]')!.click()
    expect(topModalId()).toBe('minigame')

    key('Escape')
    await new Promise((r) => setTimeout(r, 0))
    q<HTMLButtonElement>('[data-act="leave"]')!.click()
    expect(host.openId).toBe(null)
    expect(isModalOpen()).toBe(false)
  })

  /* ---------------- the gag ---------------- */

  it('offers exactly Try again / Hire me / Exit, in that order', () => {
    host.open('wordle')
    host.gag({ title: 'Stuck!', retry: () => {} })
    expect(topModalId()).toBe('minigame-gag')
    expect(gagButtons().map((b) => b.textContent)).toEqual(['Try again', '🤝 Hire me — extra life', 'Exit'])
    expect(q('.mg-gag-title')?.textContent).toBe('Stuck!')
  })

  it('Try again retries and closes only the overlay', () => {
    const retry = vi.fn()
    host.open('wordle')
    host.gag({ title: 'Stuck!', retry })
    gagButtons()[0].click()
    expect(retry).toHaveBeenCalledTimes(1)
    expect(topModalId()).toBe('minigame')
    expect(host.openId).toBe('wordle')
  })

  it('Hire me pays out the hint and the punchline', () => {
    const hint = vi.fn()
    const retry = vi.fn()
    host.open('wordle')
    host.gag({ title: 'Stuck!', hint, retry })
    gagButtons()[1].click()
    expect(hint).toHaveBeenCalledTimes(1)
    expect(retry).not.toHaveBeenCalled()
    expect(last(toasts)?.title).toBe('Excellent choice. HR will be in touch.')
    expect(host.openId).toBe('wordle') // the round carries on
  })

  it('pins the mailto inside the dialog, where the backdrop and the trap cannot bury it', () => {
    host.open('wordle')
    host.gag({ title: 'Stuck!', hint: () => {}, retry: () => {} })
    gagButtons()[1].click()
    const a = q<HTMLAnchorElement>('.mg-hire-link')!
    expect(a.getAttribute('href')).toBe(`mailto:${PROFILE.email}`)
    expect(a.textContent).toBe('email Naman')
    // The layering contract this rests on: the anchor is inside the dialog
    // panel, so the full-inset `.modal` scrim is *below* it rather than over it,
    // and the focus trap counts it among the things Tab may reach. A toast could
    // satisfy neither — it sits under the scrim and outside the trap.
    const panel = a.closest('.modal-panel') as HTMLElement
    expect(panel).toBeTruthy()
    expect(panel.closest('.modal')).toBe(document.querySelector('.modal'))
    expect(focusables(panel)).toContain(a)

    host.gag({ title: 'Stuck again!', retry: () => {} })
    gagButtons()[1].click()
    expect(all('.mg-hire-link').length).toBe(1) // pinned once, however often the joke lands
  })

  it('falls back to a retry when a game offers no hint', () => {
    const retry = vi.fn()
    host.open('claw')
    host.gag({ title: 'Stuck!', retry })
    gagButtons()[1].click()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('Exit ends the round', () => {
    host.open('claw')
    host.gag({ title: 'Stuck!', retry: () => {} })
    gagButtons()[2].click()
    expect(host.openId).toBe(null)
    expect(state.save.minigames.claw.plays).toBe(1)
  })

  /* ---------------- the mercy rule ---------------- */

  it('waves the round through on the third Hire me, so no chapter stays behind a reflex test', () => {
    const hint = vi.fn()
    host.open('flappy')
    for (let i = 1; i < MERCY_HIRES; i++) {
      host.gag({ title: 'Bonk.', hint, retry: () => {} })
      gagButtons()[1].click()
      expect(host.openId, `hire ${i} keeps playing`).toBe('flappy')
    }
    expect(hint).toHaveBeenCalledTimes(MERCY_HIRES - 1)
    host.gag({ title: 'Bonk.', hint, retry: () => {} })
    gagButtons()[1].click()
    expect(hint).toHaveBeenCalledTimes(MERCY_HIRES - 1) // the third one is not a hint, it is the round
    expect(host.openId).toBe(null)
    expect(state.save.minigames.flappy.won).toBe(true)
    expect(last(toasts)?.title).toBe('HR fast-tracked you.')
  })

  it('counts lifelines per round, not per session', () => {
    host.open('flappy')
    host.gag({ title: 'Bonk.', retry: () => {} })
    gagButtons()[1].click()
    host.gag({ title: 'Bonk.', retry: () => {} })
    gagButtons()[1].click()
    host.quit()
    host.open('flappy')
    host.gag({ title: 'Bonk.', retry: () => {} })
    gagButtons()[1].click()
    expect(host.openId).toBe('flappy') // a fresh round starts its count over
  })

  /* ---------------- the dev skip ---------------- */

  it('shows no Skip button by default', () => {
    host.open('wordle')
    expect(q('.mg-cheat')).toBeNull()
  })

  it('offers Skip (dev) only under ?cheat=1, and it wins the round', () => {
    history.replaceState(null, '', '/?cheat=1')
    host.open('wordle')
    const skip = q<HTMLButtonElement>('.mg-cheat')!
    expect(skip?.textContent).toBe('Skip (dev)')
    skip.click()
    expect(host.openId).toBe(null)
    expect(state.save.minigames.wordle.won).toBe(true)
  })

  /* ---------------- every way out records the round ---------------- */

  it('records the round when Escape closes the dialog from outside the panel', () => {
    host.open('wordle')
    ;(document.activeElement as HTMLElement)?.blur()
    // straight at the window, the way the modal manager's own handler sees it:
    // the panel-scoped listener never runs, so no confirm — but the play lands
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(host.openId).toBe(null)
    expect(state.save.minigames.wordle).toEqual({ won: false, best: 0, plays: 1 })
  })

  it('records the round when the dialog is closed out from under the host', () => {
    host.open('claw')
    closeAllModals()
    expect(host.openId).toBe(null)
    expect(isLocked()).toBe(false)
    expect(state.save.minigames.claw).toEqual({ won: false, best: 0, plays: 1 })
  })

  it('keeps focus in the panel when the backdrop is pressed', () => {
    host.open('claw')
    const root = q('.modal')!
    root.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    expect(host.openId).toBe('claw') // closeOnBackdrop:false — still playing
    expect(q('.modal-panel')!.contains(document.activeElement)).toBe(true)
  })
})
