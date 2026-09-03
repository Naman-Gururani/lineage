// @vitest-environment happy-dom
//
// Prize Grab's cabinet: the panel the host mounts, the one button that drops the
// claw, and the handshake that makes the whole game worth playing — a prize
// reaching the chute opens that project's card *over* the paused machine, and
// the round picks up when the card closes.
//
// The rules themselves are pinned in tests/claw.test.ts. What is checked here is
// wiring: tokens spent, chapters unlocked, cards opened, the gag when the purse
// runs dry, and the fact that the picture keeps moving between simulation steps.
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
import { CLAW } from '../src/games/claw'
import { GameState } from '../src/systems/GameState'
import { MinigameHost, initMinigames, registerMinigame } from '../src/systems/Minigame'
import { initMinigameRenderers } from '../src/ui/minigames'
import { mountClaw, type ClawSession } from '../src/ui/minigames/claw'
import { closeAllModals, closeModal, topModalId } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

type Toast = Events['ui:toast']

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const stat = (k: string): string => q(`.mg [data-cw="${k}"]`)?.textContent ?? ''
const dropBtn = () => q<HTMLButtonElement>('.mg .mg-foot [data-act="drop"]')!
const gagButtons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.mg-gag [data-act]'))
const gagBtn = (act: string) => gagButtons().find((b) => b.dataset.act === act)!

/** A key pressed on the panel itself, which is what has focus while playing. */
const key = (k: string, repeat = false) => {
  q('.mg')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, repeat, bubbles: true, cancelable: true }))
}

/* ---------------- the 2D context happy-dom does not have ---------------- */

type Call = { fn: string; args: number[] }
let calls: Call[] = []

/** Every method is a no-op that remembers it was called; every property sticks. */
function stubCtx(): CanvasRenderingContext2D {
  const props: Record<string, unknown> = {}
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, k) {
      const key = String(k)
      if (key in props) return props[key]
      return (...args: unknown[]) => {
        calls.push({ fn: key, args: args as number[] })
      }
    },
    set(_t, k, v) {
      props[String(k)] = v
      return true
    },
  })
}

/** The claw's carriage is the only 32×12 rectangle on the board. */
const carriageX = (): number | null => {
  const hit = [...calls].reverse().find((c) => c.fn === 'fillRect' && c.args[2] === 32 && c.args[3] === 12)
  return hit ? hit.args[0] : null
}

/* ---------------- rAF, which happy-dom would otherwise run on its own ---------------- */

type RafCb = (t: number) => void
let queue: { id: number; cb: RafCb }[] = []
let nextId = 1

function frame(t: number): void {
  const due = queue
  queue = []
  for (const r of due) r.cb(t)
}

describe('Prize Grab', () => {
  let host: MinigameHost
  let state: GameState
  let toasts: Toast[]
  let unsub: () => void
  let sess: ClawSession

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    history.replaceState(null, '', '/')
    uiState.settings.reducedMotion = true // synchronous modal close, no win delay
    calls = []
    queue = []
    nextId = 1
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => stubCtx())
    vi.stubGlobal('requestAnimationFrame', (cb: RafCb) => {
      const id = nextId++
      queue.push({ id, cb })
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      queue = queue.filter((r) => r.id !== id)
    })
    toasts = []
    unsub = events.on('ui:toast', (t) => toasts.push(t))
    initPanels()
    initMinigames()
    initMinigameRenderers()
    // The host keeps its session to itself, and happy-dom never runs a frame, so
    // the same renderer is registered again through a wrapper that keeps hold of
    // it: `__step` is how these tests advance the machine, one fixed step at a
    // time, exactly as the loop would.
    registerMinigame('claw', (h, r) => (sess = mountClaw(h, r)))
    host = new MinigameHost()
    state = new GameState(null)
    host.state = state
  })

  afterEach(() => {
    closeAllModals()
    unsub()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /* ---------------- the cabinet ---------------- */

  it('opens as a labelled pixel canvas with a purse, a rule and one button', () => {
    host.open('claw')
    const panel = q('.mg')!
    expect(panel.dataset.game).toBe('claw')
    expect(q('.mg-rule')!.textContent).toBe('One button. Drop the claw over a prize. Three prizes, three projects.')
    const canvas = q<HTMLCanvasElement>('.mg .mg-canvas')!
    expect(canvas.getAttribute('aria-label')).toBe('Claw machine')
    expect(canvas.style.imageRendering).toBe('pixelated')
    expect(canvas.style.getPropertyValue('--ar')).toBe(String(CLAW.W / CLAW.H))
    expect(stat('tokens')).toBe(String(CLAW.TOKENS))
    expect(stat('prizes')).toBe('0 / 3')
    expect(dropBtn().textContent).toBe('Drop')
    // The panel takes the keys itself, so Space works the moment it opens.
    expect(panel.tabIndex).toBe(0)
    expect(panel.dataset.autofocus).toBe('')
  })

  it('is what the renderer index registers for the claw cabinet', () => {
    initMinigameRenderers() // undo the capturing wrapper: the real wiring
    host.open('claw')
    expect(q('.mg .mg-canvas')?.getAttribute('aria-label')).toBe('Claw machine')
  })

  it('draws the cabinet before the first frame is ever asked for', () => {
    host.open('claw')
    expect(calls.some((c) => c.fn === 'fillText')).toBe(true)
    expect(carriageX()).not.toBeNull()
  })

  /* ---------------- one button, three ways to press it ---------------- */

  it('spends a token on the Drop button', () => {
    host.open('claw')
    dropBtn().click()
    expect(stat('tokens')).toBe('5')
  })

  it('spends a token on Space or Enter, and ignores a held key', () => {
    host.open('claw')
    key(' ')
    expect(stat('tokens')).toBe('5')
    key(' ', true) // auto-repeat: one press is one drop
    expect(stat('tokens')).toBe('5')
    // The claw is busy until the grab finishes, and a press it cannot use is free.
    sess.__step(400)
    key('Enter')
    expect(stat('tokens')).toBe('5')
    // That first drop was over Safe Stride; once its card is out of the way the
    // machine takes presses again, Enter included.
    sess.__step(2400)
    closeModal('zone:safestride')
    key('Enter')
    expect(stat('tokens')).toBe('4')
  })

  it('spends a token on a tap on the glass', () => {
    host.open('claw')
    q<HTMLCanvasElement>('.mg .mg-canvas')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(stat('tokens')).toBe('5')
  })

  it('does not spend two tokens when Space activates the focused Drop button', () => {
    host.open('claw')
    const btn = dropBtn()
    btn.focus()
    // The modal layer turns Space on a focused button into a click; the panel's
    // own handler must keep its hands off, or one press costs two tokens.
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    expect(stat('tokens')).toBe('5')
  })

  /* ---------------- the catch ---------------- */

  it('opens the project card over the paused machine and credits the chapter quietly', () => {
    host.open('claw')
    // The claw starts mid-rail, which is where Safe Stride sits.
    dropBtn().click()
    sess.__step(2400)

    expect(state.isUnlocked('safestride')).toBe(true)
    expect(topModalId()).toBe('zone:safestride')
    expect(host.openId).toBe('claw') // the round is paused, not over
    expect(stat('prizes')).toBe('1 / 3')
    expect(toasts.map((t) => `${t.icon} ${t.title}`)).toContain('🎁 Safe Stride')

    // Paused means paused: the button is dead and the machine does not move.
    const x = carriageX()
    dropBtn().click()
    sess.__step(1000)
    expect(stat('tokens')).toBe('5')
    expect(carriageX()).toBe(x)
  })

  it('starts the machine again when the card closes, and only for that card', () => {
    host.open('claw')
    dropBtn().click()
    sess.__step(2400)
    // Some other panel closing is not this game's cue.
    events.emit('ui:closed', { id: 'zone:lineage' })
    dropBtn().click()
    expect(stat('tokens')).toBe('5')

    closeModal('zone:safestride')
    expect(topModalId()).toBe('minigame')
    dropBtn().click()
    expect(stat('tokens')).toBe('4')
  })

  it('takes all three projects, then closes the round as a win worth three', () => {
    host.open('claw')
    // Safe Stride, dead centre.
    dropBtn().click()
    sess.__step(2400)
    closeModal('zone:safestride')
    // The claw sets off from the chute at 0.08, now 15% faster: 221 ms of rail
    // puts it over Lineage Engine at 0.22.
    sess.__step(221)
    dropBtn().click()
    sess.__step(2400)
    expect(state.isUnlocked('lineage')).toBe(true)
    closeModal('zone:lineage')
    // 15% faster again, and the tolerance is down to 0.28 of a box: 962 ms to
    // the mystery box at 0.78.
    sess.__step(962)
    dropBtn().click()
    sess.__step(2800)
    expect(state.isUnlocked('stealth')).toBe(true)
    expect(stat('prizes')).toBe('3 / 3')

    closeModal('zone:stealth')
    expect(host.openId).toBeNull() // the win closes the round
    expect(state.save.minigames.claw).toEqual({ won: true, best: 3, plays: 1 })
    expect(state.save.unlocked).toEqual(expect.arrayContaining(['lineage', 'safestride', 'stealth']))
  })

  /* ---------------- the empty purse ---------------- */

  /** Park over a gap and spend the whole purse there: six drops, six misses. */
  function missAll(): void {
    // 1966 ms: out to the right wall, bounce, back to x ≈ 0.298 — between the
    // first box and the first plushie, and outside both catch windows. A whole
    // grab is 1666 ms, and it ends where it began, so the claw never drifts off
    // the gap: the token count either falls by one a press or this test lies.
    sess.__step(1964)
    for (let i = 1; i <= CLAW.TOKENS; i++) {
      dropBtn().click()
      expect(stat('tokens')).toBe(String(CLAW.TOKENS - i))
      sess.__step(1670)
    }
  }

  it("brings up Sol's gag when the purse runs dry with prizes still on the shelf", () => {
    host.open('claw')
    missAll()
    expect(stat('prizes')).toBe('0 / 3')
    expect(q('.mg-gag-title')!.textContent).toBe('Out of tokens.')
    expect(q('.mg-gag-sub')!.textContent).toBe('The claw is honest. Mostly.')
    expect(gagButtons().map((b) => b.dataset.act)).toEqual(['retry', 'hire', 'exit'])
  })

  it('Try again is a fresh six tokens and a machine that moves again', () => {
    host.open('claw')
    missAll()
    gagBtn('retry').click()
    expect(stat('tokens')).toBe(String(CLAW.TOKENS))
    expect(stat('prizes')).toBe('0 / 3')
    const x = carriageX()
    sess.__step(200)
    frame(0) // the loop is running again; one frame is one draw
    expect(carriageX()).not.toBe(x)
    dropBtn().click()
    expect(stat('tokens')).toBe('5')
  })

  it('Hire me buys two more tokens and the round carries on', () => {
    host.open('claw')
    missAll()
    gagBtn('hire').click()
    expect(stat('tokens')).toBe('2')
    expect(host.openId).toBe('claw')
    dropBtn().click()
    expect(stat('tokens')).toBe('1')
  })

  /* ---------------- teardown ---------------- */

  it('records the prizes taken when the player walks away mid-round', () => {
    host.open('claw')
    dropBtn().click()
    sess.__step(2400)
    // Quit with the project card still up — the round is scored at one prize.
    host.quit()
    expect(host.openId).toBeNull()
    expect(state.save.minigames.claw).toEqual({ won: false, best: 1, plays: 1 })
    // And the torn-down game must not answer that card's close.
    expect(() => closeModal('zone:safestride')).not.toThrow()
    expect(q('.mg')).toBeNull()
  })

  it('stops the loop when it is torn down', () => {
    host.open('claw')
    expect(queue).toHaveLength(1)
    host.quit()
    expect(queue).toHaveLength(0)
  })

  /* ---------------- smoothness ---------------- */

  it('keeps drawing between simulation steps, interpolated by the frame alpha', () => {
    host.open('claw')
    frame(0) // the first frame only seeds the clock
    frame(1000 / 120) // one whole step: the picture lands on the earlier state
    const a = carriageX()!
    // Half a step of wall clock: nothing simulates, and the claw still moves —
    // half way from the state before the step to the state after it.
    frame(1000 / 120 + 1000 / 240)
    const b = carriageX()!
    const stepPx = CLAW.SWEEP * (1000 / 120 / 1000) * 600
    expect(b - a).toBeGreaterThan(stepPx * 0.3)
    expect(b - a).toBeLessThan(stepPx * 0.7)
  })

  it('runs the simulation on the shared fixed step, whatever the frame rate', () => {
    host.open('claw')
    frame(0) // seeds the clock
    frame(1000 / 60)
    const before = carriageX()!
    // One 60 Hz frame is two 120 Hz steps, every time — the frame rate changes
    // how often the picture is drawn, never how fast the claw travels.
    frame(2 * (1000 / 60))
    const after = carriageX()!
    const stepPx = CLAW.SWEEP * (1000 / 120 / 1000) * 600
    expect(after - before).toBeCloseTo(stepPx * 2, 1)
  })

  /* ---------------- the way out for a recruiter in a hurry ---------------- */

  it('offers to show the prizes, in the footer, just before Leave', () => {
    host.open('claw')
    const foot = q<HTMLElement>('.mg-foot')!
    const btn = q<HTMLButtonElement>('.mg-reveal')!
    expect(btn.textContent).toBe('Just show me the prizes')
    const order = Array.from(foot.querySelectorAll('button')).map((b) => b.textContent)
    expect(order.indexOf('Just show me the prizes')).toBe(order.indexOf('Leave') - 1)
  })

  it('hands over all three projects and opens their cards one after another', () => {
    host.open('claw')
    q<HTMLButtonElement>('.mg-reveal')!.click()
    expect(toasts.map((t) => t.title)).toContain('Noted. HR sees everything.')
    for (const id of ['lineage', 'safestride', 'stealth']) expect(state.isUnlocked(id)).toBe(true)
    expect(stat('prizes')).toBe('3 / 3')

    // One card at a time, in shelf order, each waiting on the one before it.
    expect(topModalId()).toBe('zone:lineage')
    expect(host.openId).toBe('claw') // the cabinet is still there behind them
    closeModal('zone:lineage')
    expect(topModalId()).toBe('zone:safestride')
    closeModal('zone:safestride')
    expect(topModalId()).toBe('zone:stealth')
    closeModal('zone:stealth')
    expect(host.openId).toBeNull()
    expect(state.save.minigames.claw).toEqual({ won: true, best: 3, plays: 1 })
  })

  it('parks the machine while the revealed cards are up', () => {
    host.open('claw')
    q<HTMLButtonElement>('.mg-reveal')!.click()
    const x = carriageX()
    const purse = stat('tokens')
    dropBtn().click()
    sess.__step(1000)
    expect(stat('tokens')).toBe(purse) // paused means paused: no token, no travel
    expect(carriageX()).toBe(x)
  })

  it('opens only the cards still owed when a prize was already won', () => {
    host.open('claw')
    dropBtn().click()
    sess.__step(2400) // Safe Stride, dead centre
    closeModal('zone:safestride')
    q<HTMLButtonElement>('.mg-reveal')!.click()
    expect(topModalId()).toBe('zone:lineage')
    closeModal('zone:lineage')
    expect(topModalId()).toBe('zone:stealth')
    closeModal('zone:stealth')
    expect(host.openId).toBeNull()
    expect(state.save.minigames.claw).toEqual({ won: true, best: 3, plays: 1 })
  })
})
