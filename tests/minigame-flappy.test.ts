// @vitest-environment happy-dom
//
// Chalk Flight's cabinet: the chalkboard it mounts, the three ways to flap, the
// gag it opens when the bird bonks, and the chapter a finished run hands over.
// The rules themselves are `tests/flappy.test.ts`; what is pinned here is the
// wiring — and the two promises the panel makes about being smooth: the loop
// drives the simulation in fixed steps, and a frame writes nothing to the DOM
// unless the score changed.
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
import { BIRD_X, FLAPPY, type FlappyState, flap, newFlappy, step, won } from '../src/games/flappy'
import { GameState } from '../src/systems/GameState'
import { MinigameHost, initMinigames } from '../src/systems/Minigame'
import { closeAllModals, topModalId } from '../src/ui/modal'
import { initMinigameRenderers } from '../src/ui/minigames'
import { type FlappySession, mountFlappy } from '../src/ui/minigames/flappy'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

const STEP_MS = 1000 / 120

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))
const gagButtons = () => all<HTMLButtonElement>('.mg-gag [data-act]')

/**
 * Every canvas in this suite is a stub: happy-dom has no 2D context at all, so
 * the surface, the grain layer and the rasterised book stacks all draw into a
 * proxy that answers every call with a shrug and remembers every property set.
 */
function stubContext(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      new Proxy({} as Record<string, unknown>, {
        get: (t, prop) => (typeof prop === 'symbol' ? undefined : prop in t ? t[prop] : () => undefined),
        set: (t, prop, v) => {
          t[prop as string] = v
          return true
        },
      }) as unknown as CanvasRenderingContext2D,
  )
}

/** Count writes to an element's text, including ones that set the same value again. */
function countWrites(node: HTMLElement): { n: number } {
  const seen = { n: 0 }
  let proto: object | null = Object.getPrototypeOf(node)
  let desc: PropertyDescriptor | undefined
  while (proto && !desc) {
    desc = Object.getOwnPropertyDescriptor(proto, 'textContent')
    proto = Object.getPrototypeOf(proto)
  }
  const { get, set } = desc!
  Object.defineProperty(node, 'textContent', {
    configurable: true,
    get(this: HTMLElement) {
      return get!.call(this)
    },
    set(this: HTMLElement, v: string) {
      seen.n++
      set!.call(this, v)
    },
  })
  return seen
}

describe('Chalk Flight', () => {
  let host: MinigameHost
  let state: GameState

  const panel = () => q<HTMLElement>('.mg')!
  /** The renderer hands the host a session with a stepper on it, for exactly this. */
  const sim = () => (host as unknown as { session: FlappySession }).session
  const key = (k: string, repeat = false) => panel().dispatchEvent(new KeyboardEvent('keydown', { key: k, repeat, bubbles: true, cancelable: true }))
  const space = () => key(' ')
  const scoreText = () => q('[data-f="score"]')?.textContent

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    history.replaceState(null, '', '/')
    uiState.settings.reducedMotion = true // synchronous modal close, no win delay
    stubContext()
    // The loop is never allowed a frame of its own: the simulation only moves
    // when a test asks it to, so nothing here depends on wall-clock timing.
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    initPanels()
    initMinigames()
    initMinigameRenderers()
    host = new MinigameHost()
    state = new GameState(null)
    host.state = state
  })

  afterEach(() => {
    closeAllModals()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /**
   * Fly the mounted cabinet to its tenth gap with its eyes shut: a mirror of the
   * same pure simulation, fed the same taps at the same fixed steps, is what
   * tells the panel when to press Space. Same seed, same reducer, same step —
   * so the mirror always knows exactly where the real bird is.
   */
  function flyToTen(): { mirror: FlappyState; frames: number } {
    const aim = (s: FlappyState) => {
      const next = s.cols.find((c) => c.x + FLAPPY.COL_W >= BIRD_X - FLAPPY.R)
      return next ? next.gapY + FLAPPY.GAP / 2 : FLAPPY.H / 2
    }
    space() // the tap that starts the run, on both
    let mirror = flap(newFlappy(1))
    let frames = 0
    for (; frames < 3000 && !won(mirror) && host.openId; frames++) {
      if (mirror.y > aim(mirror) + 24) {
        space()
        mirror = flap(mirror)
      }
      sim().__step(STEP_MS)
      mirror = step(mirror, STEP_MS)
    }
    return { mirror, frames }
  }

  /* ---------------- the panel ---------------- */

  it('mounts a chalkboard, the rule, the score and the three ways to flap', () => {
    host.open('flappy')
    expect(q('.modal-title')?.textContent).toBe('Chalk Flight')
    expect(q('.modal-kicker')?.textContent).toBe('SRM CAMPUS')
    expect(q('.mg-rule')?.textContent).toBe('Tap or press Space to flap. Fly through ten gaps and the notice board is yours.')

    const canvas = q<HTMLCanvasElement>('.mg-canvas')!
    expect(canvas).not.toBeNull()
    expect(canvas.getAttribute('aria-label')).toBe('Chalkboard')
    // The logical board is 480×360, whatever the screen's pixel ratio.
    expect(canvas.style.getPropertyValue('--ar')).toBe(String(FLAPPY.W / FLAPPY.H))

    expect(scoreText()).toBe('0')
    expect(q('.fl-flap')?.textContent).toBe('Flap')
    expect(all<HTMLButtonElement>('.mg-foot [data-act]').map((b) => b.dataset.act)).toEqual(['flap', 'quit'])
  })

  it('takes focus itself, so a key lands on the game and not on the dialog around it', () => {
    host.open('flappy')
    expect(document.activeElement).toBe(panel())
    expect(panel().dataset.autofocus).toBe('')
  })

  it('leaves when asked', () => {
    host.open('flappy')
    q<HTMLButtonElement>('[data-act="quit"]')!.click()
    expect(host.openId).toBe(null)
    expect(state.save.minigames.flappy).toEqual({ won: false, best: 0, plays: 1 })
  })

  /* ---------------- flapping ---------------- */

  it('waits on the board until it is asked to fly', () => {
    host.open('flappy')
    sim().__step(6000)
    expect(topModalId()).toBe('minigame') // no gag: an untouched bird cannot lose
    expect(scoreText()).toBe('0')
  })

  it('takes a held key as one flap, not sixty a second', () => {
    host.open('flappy')
    key(' ', true)
    sim().__step(2000)
    // The repeat never started the run, so the bird is still waiting.
    expect(topModalId()).toBe('minigame')
  })

  it('starts the run on Space, and drops an unflapped bird onto the floor', () => {
    host.open('flappy')
    space()
    sim().__step(2000)
    expect(topModalId()).toBe('minigame-gag')
    expect(q('.mg-gag-title')?.textContent).toBe('Bonk.')
    expect(q('.mg-gag-sub')?.textContent).toBe(`0 of ${FLAPPY.WIN}.`)
  })

  it('keeps the bird up while the player keeps tapping', () => {
    host.open('flappy')
    // A tap every 550 ms is roughly the hover cadence: gravity takes back what
    // one flap buys. Two and a bit seconds of it is four times the free fall.
    for (let i = 0; i < 4; i++) {
      space()
      sim().__step(550)
    }
    expect(topModalId()).toBe('minigame')
  })

  it('flaps for a tap on the board and for the footer button', () => {
    for (const tap of [() => q<HTMLCanvasElement>('.mg-canvas')!.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true })), () => q<HTMLButtonElement>('.fl-flap')!.click()]) {
      host.open('flappy')
      tap()
      sim().__step(2000)
      // Only a started run can be lost, so the gag is the proof the tap flapped.
      expect(topModalId()).toBe('minigame-gag')
      closeAllModals()
    }
  })

  it('flaps for the arrow and for W as well', () => {
    for (const k of ['ArrowUp', 'w']) {
      host.open('flappy')
      key(k)
      sim().__step(2000)
      expect(topModalId(), `${k} did not flap`).toBe('minigame-gag')
      closeAllModals()
    }
  })

  it('leaves Space alone on a focused button — the modal layer already clicks it', () => {
    const hop = vi.spyOn(sfx, 'hop').mockImplementation(() => {})

    // Space on the Flap button: the modal layer swallows it and clicks the
    // button, so the game must not also read the key. Two listeners on one
    // press is one flap and two flap sounds.
    host.open('flappy')
    q<HTMLButtonElement>('.fl-flap')!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    expect(hop).toHaveBeenCalledTimes(1)

    // …and Space on Leave must not fly the bird on the way out of the game.
    hop.mockClear()
    host.open('flappy')
    q<HTMLButtonElement>('.mg-foot [data-act="quit"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    expect(hop).not.toHaveBeenCalled()
  })

  /* ---------------- the gag ---------------- */

  it('deals a fresh board on Try again and carries the run on for Hire me', () => {
    host.open('flappy')
    space()
    sim().__step(2000)
    gagButtons()[0].click() // Try again
    expect(topModalId()).toBe('minigame')
    expect(scoreText()).toBe('0')
    // A fresh board is a waiting board: it cannot be lost until it is flapped.
    sim().__step(3000)
    expect(topModalId()).toBe('minigame')

    space()
    sim().__step(2000)
    expect(topModalId()).toBe('minigame-gag')
    gagButtons()[1].click() // 🤝 Hire me
    expect(topModalId()).toBe('minigame')
    // The lifeline puts the same run back in the air — still flying, still
    // falling — rather than parking it the way Try again does.
    sim().__step(FLAPPY.GRACE_MS + 500)
    expect(topModalId()).toBe('minigame-gag')
  })

  /* ---------------- a finished run ---------------- */

  it('flies ten gaps and hands over the Education chapter, writing to the panel once a gap', () => {
    host.open('flappy')
    const writes = countWrites(q('[data-f="score"]')!)

    const { mirror, frames } = flyToTen()

    expect(mirror.dead).toBe(false)
    expect(mirror.score).toBe(FLAPPY.WIN)
    expect(host.openId).toBe(null)
    expect(state.save.minigames.flappy).toEqual({ won: true, best: FLAPPY.WIN, plays: 1 })
    expect(state.isUnlocked('education')).toBe(true)
    expect(state.save.hats).toContain('grad')
    // ~1900 frames of chalk for ten writes: the score is the only thing in the
    // frame allowed to touch the DOM, and only when it changes.
    expect(frames).toBeGreaterThan(1000)
    expect(writes.n).toBe(FLAPPY.WIN)
  })

  it('records the win even when the player leaves during the winning beat', () => {
    // Motion is *not* reduced here, so the close really is 650 ms away and the
    // panel is still open when it lands. Leave asks the session whether the
    // round was won; a session that could not answer would file a cleared board
    // as a loss and drop the chapter on the floor.
    vi.useFakeTimers()
    uiState.settings.reducedMotion = false
    host.open('flappy')

    const { mirror } = flyToTen()
    expect(mirror.score).toBe(FLAPPY.WIN)
    expect(host.openId).toBe('flappy') // the beat has not passed yet

    q<HTMLButtonElement>('[data-act="quit"]')!.click()
    vi.advanceTimersByTime(2000)

    expect(host.openId).toBe(null)
    expect(state.save.minigames.flappy).toEqual({ won: true, best: FLAPPY.WIN, plays: 1 })
    expect(state.isUnlocked('education')).toBe(true)
    expect(state.save.hats).toContain('grad')
  })

  it('closes as a win under ?cheat=1', () => {
    history.replaceState(null, '', '/?cheat=1')
    host.open('flappy')
    q<HTMLButtonElement>('.mg-cheat')!.click()
    expect(host.openId).toBe(null)
    expect(state.save.minigames.flappy.won).toBe(true)
    expect(state.isUnlocked('education')).toBe(true)
  })

  /* ---------------- reduced motion ---------------- */

  /* ---------------- a board with no chalk ---------------- */

  it('keeps the panel up when the browser refuses a 2D context, and says so once', () => {
    // The one survivable surface failure. The rules, the score and the buttons
    // still stand up; there is simply nothing to draw on.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const first = mountFlappy(host, document.createElement('div'))
    const root = document.createElement('div')
    const second = mountFlappy(host, root)

    expect(root.querySelector('.mg-canvas')).toBeNull()
    expect(root.querySelector('.mg-rule')).not.toBeNull()
    expect(second.score!()).toBe(0)
    // Said once a page, not once a mount: the second board is just as headless.
    expect(warn).toHaveBeenCalledTimes(1)
    first.destroy!()
    second.destroy!()
  })

  it('lets a surface failure that is not a missing context travel', () => {
    // Swallowing everything would hide a real bug behind a panel that quietly
    // never draws, which is the worst of both outcomes.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('canvas is on fire')
    })
    expect(() => mountFlappy(host, document.createElement('div'))).toThrow('canvas is on fire')
  })

  it('skips the chalk grain when motion is reduced, and pre-renders it when it is not', () => {
    const made = vi.spyOn(document, 'createElement')
    const canvases = () => made.mock.calls.filter((c) => c[0] === 'canvas').length

    host.open('flappy')
    expect(canvases()).toBe(1) // the board, and no grain layer
    closeAllModals()

    made.mockClear()
    uiState.settings.reducedMotion = false
    host.open('flappy')
    expect(canvases()).toBe(2) // the board and the grain pre-rendered beside it
  })
})
