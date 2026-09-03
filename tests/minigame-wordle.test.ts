// @vitest-environment happy-dom
//
// Bo's Word Puzzle, as a player meets it: six rows, an on-screen QWERTY that a
// physical one shadows, the flip, the shake, the 💡, and the two doors out of a
// lost board. The rules themselves are pinned in tests/wordle.test.ts; what is
// under test here is the panel — that the DOM says what the state says, that
// keys reach the board and nothing else, and that a solve pays out the chapter.
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

import { events } from '../src/core/events'
import { wordleAnswers } from '../src/games/wordle'
import { GameState } from '../src/systems/GameState'
import { MinigameHost, initMinigames } from '../src/systems/Minigame'
import { closeAllModals } from '../src/ui/modal'
import { initMinigameRenderers } from '../src/ui/minigames'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))

const panel = () => q<HTMLElement>('.mg')!
// A won board closes its own panel, so every board read is scoped: hold the
// element from before the win and the tiles it was left showing are still there.
const rowsIn = (scope: HTMLElement) => Array.from(scope.querySelectorAll<HTMLElement>('.wd-row'))
const tilesOf = (scope: HTMLElement, r: number) => Array.from(rowsIn(scope)[r].querySelectorAll<HTMLElement>('.wd-tile'))
const rows = () => rowsIn(panel())
const tilesIn = (r: number) => tilesOf(panel(), r)
const states = (r: number, scope = panel()) => tilesOf(scope, r).map((t) => t.dataset.state)
const letters = (r: number, scope = panel()) => tilesOf(scope, r).map((t) => t.textContent).join('')
const keyBtn = (k: string) => q<HTMLButtonElement>(`.wd-key[data-key="${k}"]`)!
const hintBtn = () => q<HTMLButtonElement>('.wd-hintbtn')!
const live = (scope = panel()) => scope.querySelector('.mg-live')?.textContent ?? ''
const gagButtons = () => all<HTMLButtonElement>('.mg-gag [data-act]')

/** Tap the on-screen keyboard, the way a phone plays it. */
const tap = (word: string) => {
  for (const ch of word) keyBtn(ch).click()
}
/** A physical key, delivered where the renderer listens for it. */
const press = (key: string, from: HTMLElement = panel()) =>
  from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

const guess = (word: string) => {
  tap(word)
  press('Enter')
}

/** The word list arrives by dynamic import; wait for the panel to say it landed. */
const dictReady = async () => {
  for (let i = 0; i < 300 && panel().dataset.dict !== 'ready'; i++) await new Promise((r) => setTimeout(r, 1))
  expect(panel().dataset.dict, 'the word list never loaded').toBe('ready')
}

/** Six words that are none of the answers — enough to lose a board on. */
const MISSES = ['crane', 'slate', 'mound', 'vixen', 'wrist', 'bulge']

describe("Bo's Word Puzzle", () => {
  let host: MinigameHost
  let state: GameState

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    history.replaceState(null, '', '/')
    uiState.settings.reducedMotion = true // no flip beat, no win beat: everything lands at once
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
  })

  /* ---------------- the board it draws ---------------- */

  it('opens from the panel router with a full board and a full keyboard', () => {
    events.emit('ui:panel', { id: 'minigame', data: 'wordle' })
    expect(panel().dataset.game).toBe('wordle')
    expect(q('.modal-title')?.textContent).toBe("Bo's Word Puzzle")
    expect(q('.modal-kicker')?.textContent).toBe('THE GATE')
    expect(q('.mg-rule')?.textContent).toBe('Guess the five-letter word in six tries. Green is right, yellow is misplaced.')
    expect(rows()).toHaveLength(6)
    expect(all('.wd-tile')).toHaveLength(30)
    expect(all('.wd-key')).toHaveLength(28)
    expect(keyBtn('enter').getAttribute('aria-label')).toBe('Enter')
    expect(keyBtn('back').getAttribute('aria-label')).toBe('Backspace')
    expect(hintBtn().textContent).toBe('💡 Hint (3 left)')
    expect(q('.mg-live')?.getAttribute('role')).toBe('status')
    expect(states(0)).toEqual(['', '', '', '', ''])
  })

  it('takes the keys itself, and points focus at the board', () => {
    host.open('wordle')
    // Element-scoped input: the panel is what is focused and what listens.
    expect(panel().tabIndex).toBe(0)
    expect(panel().dataset.autofocus).toBe('')
    expect(document.activeElement).toBe(panel())
  })

  /* ---------------- typing ---------------- */

  it('fills the current row from the on-screen keys, and rubs out from the end', () => {
    host.open('wordle')
    tap('cran')
    expect(letters(0)).toBe('CRAN')
    expect(states(0)).toEqual(['filled', 'filled', 'filled', 'filled', ''])
    keyBtn('back').click()
    expect(letters(0)).toBe('CRA')
    tap('nes') // the sixth letter has nowhere to go
    expect(letters(0)).toBe('CRANE')
    expect(letters(1)).toBe('')
  })

  it('shadows the on-screen keys with the physical ones', () => {
    host.open('wordle')
    for (const ch of 'CraNe') press(ch)
    expect(letters(0)).toBe('CRANE')
    press('Backspace')
    expect(letters(0)).toBe('CRAN')
    press('1')
    press('-')
    expect(letters(0)).toBe('CRAN')
    // an auto-repeat is one press held down, not four more letters
    panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, repeat: true }))
    expect(letters(0)).toBe('CRAN')
  })

  it('still types while a key button holds focus, but leaves that button its own Enter', () => {
    history.replaceState(null, '', '/?word=grump')
    host.open('wordle')
    const btn = keyBtn('q')
    press('c', btn)
    expect(letters(0)).toBe('C')
    tap('rane')
    press('Enter', btn) // the focused button activates itself; the board must not also submit
    expect(states(0)).toEqual(['filled', 'filled', 'filled', 'filled', 'filled'])
    press('Enter') // …from the board itself, it does
    expect(states(0)).not.toContain('filled')
  })

  /* ---------------- submitting ---------------- */

  it('will not spend a row on a short word', () => {
    host.open('wordle')
    guess('cran')
    expect(states(0)).toEqual(['filled', 'filled', 'filled', 'filled', ''])
    expect(letters(0)).toBe('CRAN')
    expect(q('.wd-note')?.hidden).toBe(false)
    expect(q('.wd-note')?.textContent).toBe('Not enough letters')
  })

  it('will not spend a row on a word the dictionary has never heard of', async () => {
    host.open('wordle')
    await dictReady()
    guess('zzzzz')
    expect(letters(0)).toBe('ZZZZZ')
    expect(states(0)).toEqual(['filled', 'filled', 'filled', 'filled', 'filled'])
    expect(q('.wd-note')?.textContent).toBe('Not in word list')
    expect(live()).toBe('Not in word list')
  })

  it('marks a wrong guess green, yellow and grey, and colours the keys with it', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    guess('crane')
    // crane vs kafka: only the a is in the word, and not where it was put.
    expect(states(0)).toEqual(['x', 'x', 'y', 'x', 'x'])
    expect(letters(0)).toBe('CRANE')
    expect(keyBtn('a').dataset.state).toBe('y')
    expect(keyBtn('c').dataset.state).toBe('x')
    expect(keyBtn('k').dataset.state).toBe('')
    expect(live()).toBe('C absent, R absent, A present, N absent, E absent.')
    // …and the next row is the live one
    tap('sl')
    expect(letters(1)).toBe('SL')
  })

  it('labels every tile for a screen reader, before and after the reveal', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    expect(tilesIn(0).map((t) => t.getAttribute('aria-label'))).toEqual(['blank', 'blank', 'blank', 'blank', 'blank'])
    tap('c')
    expect(tilesIn(0)[0].getAttribute('aria-label')).toBe('C')
    tap('rane')
    press('Enter')
    expect(tilesIn(0).map((t) => t.getAttribute('aria-label'))).toEqual(['C, absent', 'R, absent', 'A, present', 'N, absent', 'E, absent'])
  })

  /* ---------------- winning ---------------- */

  it('honours ?word=, banks the win, and buys the ticket', () => {
    history.replaceState(null, '', '/?word=grump') // not one of the cycled answers
    host.open('wordle')
    const board = panel() // the win closes the panel; read the board it left behind
    expect(state.flag('ticket')).toBe(false)
    guess('grump')
    expect(states(0, board)).toEqual(['g', 'g', 'g', 'g', 'g'])
    expect(live(board)).toContain('Solved!')
    expect(host.openId).toBe(null)
    // The gate puzzle pays in a *flag*, not a chapter: the ticket is what takes
    // the turnstiles out of the gateway. Experience is the coaster's to give.
    expect(state.flag('ticket')).toBe(true)
    expect(state.isUnlocked('experience')).toBe(false)
    expect(state.save.minigames.wordle).toEqual({ won: true, best: 6, plays: 1 })
  })

  it('pays a row saved as a point of score', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    guess('crane')
    guess('slate')
    guess('kafka')
    expect(state.save.minigames.wordle.best).toBe(4) // solved on the third of seven
  })

  /* ---------------- losing ---------------- */

  it('opens the gag on the sixth miss, and says what the word was', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    for (const w of MISSES) guess(w)
    expect(rows().every((_, i) => states(i).every((s) => s && s !== 'filled'))).toBe(true)
    expect(q('.mg-gag-title')?.textContent).toBe('Out of tries.')
    expect(q('.mg-gag-sub')?.textContent).toBe('It was KAFKA.')
    expect(host.openId).toBe('wordle') // the round is not over until the player says so
  })

  it('buys a seventh row with "Hire me", on the same word', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    for (const w of MISSES) guess(w)
    gagButtons()[1].click()
    const board = panel()
    expect(rows()).toHaveLength(7)
    expect(all('.wd-tile')).toHaveLength(35)
    expect(letters(6)).toBe('')
    guess('kafka')
    expect(states(6, board)).toEqual(['g', 'g', 'g', 'g', 'g'])
    expect(state.flag('ticket')).toBe(true)
  })

  it('deals a different word on "Try again"', () => {
    host.open('wordle')
    for (const w of MISSES) guess(w)
    const first = q('.mg-gag-sub')?.textContent
    gagButtons()[0].click()
    expect(rows()).toHaveLength(6)
    expect(letters(0)).toBe('')
    expect(states(0)).toEqual(['', '', '', '', ''])
    expect(keyBtn('c').dataset.state).toBe('') // the keyboard forgets the old board too
    for (const w of MISSES) guess(w)
    const second = q('.mg-gag-sub')?.textContent
    expect(second).not.toBe(first)
    for (const w of [first, second]) expect(wordleAnswers()).toContain(w!.slice('It was '.length, -1).toLowerCase())
  })

  /* ---------------- the 💡 ---------------- */

  it('reveals the answer a letter at a time, and Bo runs out of things to say', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    const slots = () => all<HTMLElement>('.wd-hint-slot').map((s) => s.textContent)
    expect(slots()).toEqual(['', '', '', '', ''])
    expect(q('.wd-bo')?.textContent).toBe('Bo is watching.')

    hintBtn().click()
    expect(slots()).toEqual(['K', '', '', '', ''])
    expect(hintBtn().textContent).toBe('💡 Hint (2 left)')
    expect(q('.wd-bo')?.textContent).toBe('Bo coughs meaningfully.')
    expect(live()).toBe('Hint: K is the first letter.')

    hintBtn().click()
    expect(q('.wd-bo')?.textContent).toBe('Bo points at a letter.')
    hintBtn().click()
    expect(slots()).toEqual(['K', 'A', 'F', '', ''])
    expect(hintBtn().textContent).toBe('💡 Hint (0 left)')
    expect(hintBtn().disabled).toBe(true)
    expect(q('.wd-bo')?.textContent).toBe('Bo has basically told you.')
    expect(live()).toBe('Hint: F is the third letter.')
  })

  /* ---------------- leaving ---------------- */

  it('leaves on the Leave button and on the panel cross, scoring the round as a play', () => {
    host.open('wordle')
    q<HTMLButtonElement>('.mg-foot [data-act="quit"]')!.click()
    expect(host.openId).toBe(null)
    expect(state.save.minigames.wordle).toEqual({ won: false, best: 0, plays: 1 })

    host.open('wordle')
    q<HTMLButtonElement>('.modal-x')!.click()
    expect(host.openId).toBe(null)
    expect(state.save.minigames.wordle.plays).toBe(2)
  })

  /* ---------------- motion ---------------- */

  it('turns the row over a tile at a time, and shakes the words it will not take', async () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    await dictReady()
    uiState.settings.reducedMotion = false
    vi.useFakeTimers()

    guess('crane')
    expect(tilesIn(0).every((t) => t.classList.contains('flip'))).toBe(true)
    expect(states(0)).toEqual(['filled', 'filled', 'filled', 'filled', 'filled']) // still face-up
    expect(tilesIn(0).map((t) => t.style.getPropertyValue('--i'))).toEqual(['0', '1', '2', '3', '4'])
    tap('sl') // the board takes no input mid-reveal
    expect(letters(1)).toBe('')

    vi.advanceTimersByTime(1300)
    expect(states(0)).toEqual(['x', 'x', 'y', 'x', 'x'])
    expect(tilesIn(0).some((t) => t.classList.contains('flip'))).toBe(false)

    guess('zzzzz')
    expect(rows()[1].classList.contains('shake')).toBe(true)
    expect(q('.wd-note')?.hidden).toBe(false)
    vi.advanceTimersByTime(1300)
    expect(rows()[1].classList.contains('shake')).toBe(false)
    expect(q('.wd-note')?.hidden).toBe(true)
  })

  it('gives a second rejected word its own full beat, not the leftovers of the first', async () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    await dictReady()
    uiState.settings.reducedMotion = false
    vi.useFakeTimers()

    guess('zzzzz')
    expect(q('.wd-note')?.textContent).toBe('Not in word list')
    vi.advanceTimersByTime(800)
    for (let i = 0; i < 5; i++) keyBtn('back').click()
    guess('ab') // a second rejection, 800 ms into the first one's beat
    expect(q('.wd-note')?.textContent).toBe('Not enough letters')
    expect(rows()[0].classList.contains('shake')).toBe(true)

    vi.advanceTimersByTime(700) // past when the *first* note was due to go
    expect(q('.wd-note')?.hidden).toBe(false)
    expect(q('.wd-note')?.textContent).toBe('Not enough letters')
    vi.advanceTimersByTime(600) // and past its own
    expect(q('.wd-note')?.hidden).toBe(true)
  })

  it('drops the flip and the shake when the player has asked for less motion', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    guess('crane')
    expect(tilesIn(0).some((t) => t.classList.contains('flip'))).toBe(false)
    expect(states(0)).toEqual(['x', 'x', 'y', 'x', 'x']) // the colours still land, at once
    guess('cran')
    expect(rows()[1].classList.contains('shake')).toBe(false)
    expect(q('.wd-note')?.hidden).toBe(false)
  })

  it('clears its timers when the panel goes away', () => {
    uiState.settings.reducedMotion = false
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    vi.useFakeTimers()
    guess('crane')
    host.quit()
    // the reveal was still in flight; nothing it scheduled may touch a dead panel
    expect(() => vi.advanceTimersByTime(3000)).not.toThrow()
    expect(state.save.minigames.wordle).toEqual({ won: false, best: 0, plays: 1 })
  })

  /* ---------------- the way out for a recruiter in a hurry ---------------- */

  it('offers to show the word, in the footer, just before Leave', () => {
    host.open('wordle')
    const foot = q<HTMLElement>('.mg-foot')!
    const btn = q<HTMLButtonElement>('.mg-reveal')!
    expect(btn.textContent).toBe('Show me the word')
    expect(btn.type).toBe('button')
    expect(btn.classList.contains('pbtn')).toBe(true)
    const order = Array.from(foot.querySelectorAll('button')).map((b) => b.textContent)
    expect(order.indexOf('Show me the word')).toBe(order.indexOf('Leave') - 1)
  })

  it('does not toast when the reveal is pressed while a row is mid-flip', () => {
    const toasts: string[] = []
    const off = events.on('ui:toast', (t) => toasts.push(t.title))
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    uiState.settings.reducedMotion = false
    guess('crane') // busy while the row flips: revealAnswer must decline
    q<HTMLButtonElement>('.mg-reveal')!.click()
    off()
    expect(toasts).not.toContain('Noted. HR sees everything.')
  })

  it('fills the answer row, banks the win, and lets HR know', () => {
    const toasts: string[] = []
    const off = events.on('ui:toast', (t) => toasts.push(t.title))
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    const board = panel() // the win closes the panel; read the board it left behind
    q<HTMLButtonElement>('.mg-reveal')!.click()
    off()
    expect(letters(0, board)).toBe('KAFKA')
    expect(states(0, board)).toEqual(['g', 'g', 'g', 'g', 'g'])
    expect(host.openId).toBe(null)
    expect(state.save.minigames.wordle.won).toBe(true)
    expect(state.flag('ticket')).toBe(true)
    expect(toasts).toContain('Noted. HR sees everything.')
  })

  it('shows the word over whatever was half-typed at the time', () => {
    history.replaceState(null, '', '/?word=kafka')
    host.open('wordle')
    const board = panel()
    guess('crane')
    tap('sla') // a row in progress is not in the way
    q<HTMLButtonElement>('.mg-reveal')!.click()
    expect(letters(1, board)).toBe('KAFKA')
    expect(host.openId).toBe(null)
  })
})
