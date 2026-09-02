// @vitest-environment happy-dom
//
// Word Forge, at the bench: the wheel Ravi lays out, the three ways a player can
// reach a word (drag, tap, type), the chip that names the tool they just found,
// and the wall of skills the fifth wheel finally opens. The rules themselves are
// pinned in tests/forge.test.ts; everything here is what the panel does with
// them.
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
import { FORGE_MISSES, FORGE_ROUNDS } from '../src/games/forge'
import { GameState } from '../src/systems/GameState'
import { MinigameHost, initMinigames } from '../src/systems/Minigame'
import { initMinigameRenderers } from '../src/ui/minigames'
import { closeAllModals, topModalId } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

type Toast = Events['ui:toast']

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))
const last = <T,>(a: T[]): T | undefined => a[a.length - 1]

const panel = () => q<HTMLElement>('.mg')!
const letters = () => all<HTMLButtonElement>('.fg-letter')
const wheelText = () => letters().map((b) => b.textContent).join('')
const slots = () => all<HTMLElement>('.fg-slot')
const slotOf = (word: string) => q<HTMLElement>(`.fg-slot[data-word="${word}"]`)!
const tilesOf = (word: string) => Array.from(slotOf(word).querySelectorAll<HTMLElement>('.fg-tile')).map((t) => t.textContent)
const bench = () => q<HTMLElement>('.fg-current')!
const noteText = () => {
  const n = q<HTMLElement>('.fg-note')!
  return n.hidden ? '' : n.textContent
}
const live = () => q<HTMLElement>('.mg-live')!.textContent
const act = (name: string) => q<HTMLButtonElement>(`.mg [data-act="${name}"]`)!
const gagButtons = () => all<HTMLButtonElement>('.mg-gag [data-act]')

/** A key press at whatever has focus, the way the browser sends it. */
const key = (k: string) => {
  const target = (document.activeElement as HTMLElement) ?? document.body
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}

/** Tap out a word tile by tile, refusing to re-use one already in the word. */
function tap(word: string): void {
  for (const ch of word) {
    const btn = letters().find((b) => b.textContent === ch && !b.classList.contains('picked'))
    if (!btn) throw new Error(`no free ${ch} on the wheel ${wheelText()}`)
    btn.click()
  }
}

const play = (word: string): void => {
  tap(word)
  key('Enter')
}

/** Clear the wheel the panel is on, in the order its words are hung. */
function clearRound(i: number): void {
  for (const w of FORGE_ROUNDS[i].words) play(w.word)
}

describe('Word Forge — the bench', () => {
  let host: MinigameHost
  let state: GameState
  let toasts: Toast[]
  let unsub: () => void

  /** Just the bench's own chips — the save layer toasts about other things too. */
  const chips = () => toasts.filter((t) => t.icon === '🔧')

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    history.replaceState(null, '', '/')
    uiState.settings.reducedMotion = true // synchronous closes, no win beat
    toasts = []
    unsub = events.on('ui:toast', (t) => toasts.push(t))
    initPanels()
    initMinigames()
    initMinigameRenderers()
    host = new MinigameHost()
    state = new GameState(null)
    host.state = state
    host.open('forge')
  })

  afterEach(() => {
    closeAllModals()
    unsub()
    uiState.settings.reducedMotion = true
    vi.restoreAllMocks()
  })

  /* ---------------- the wheel it lays out ---------------- */

  it('lays the first wheel out with a tile per letter and a slot per word', () => {
    expect(q('.modal-title')?.textContent).toBe('Word Forge')
    expect(q('.modal-kicker')?.textContent).toBe('THE WORKSHOP')
    expect(q('.mg-rule')?.textContent).toBe('Spell the tools Naman actually uses. Drag or tap the letters, then press Enter.')
    expect(letters().length).toBe(7)
    expect(wheelText()).toBe(FORGE_ROUNDS[0].ring.join(''))
    expect(slots().length).toBe(2)
  })

  it('clues each slot with the group the skill is filed under, and nothing else', () => {
    expect(slots().map((s) => s.querySelector('.fg-clue')?.textContent)).toEqual(['Languages & Frameworks', 'Streaming & Messaging'])
    // A blank tile per letter — and no count anywhere, which would hand over the
    // answer's shape a second time.
    expect(tilesOf('JAVA')).toEqual(['', '', '', ''])
    expect(tilesOf('KAFKA').length).toBe(5)
    expect(q('.fg-slots')?.textContent).not.toMatch(/[0-9]/)
  })

  it('seats every tile on the circle by angle, a full turn and no more', () => {
    const angles = letters().map((b) => Number(/--a:(-?[\d.]+)deg/.exec(b.getAttribute('style') ?? '')?.[1]))
    expect(angles[0]).toBe(-90) // the first tile is at the top
    expect(angles.every((a) => Number.isFinite(a))).toBe(true)
    expect(new Set(angles).size).toBe(angles.length)
    expect(Math.max(...angles) - Math.min(...angles)).toBeLessThan(360)
  })

  it('puts the keys on the panel itself, so the world never hears them', () => {
    expect(document.activeElement).toBe(panel())
    expect(panel().tabIndex).toBe(0)
    expect(panel().dataset.autofocus).toBe('')
    expect(q('.mg-live')?.getAttribute('role')).toBe('status')
  })

  /* ---------------- forging a word ---------------- */

  it('forges a word tapped out one tile at a time, and names the tool', () => {
    tap('JAVA')
    expect(bench().textContent).toBe('JAVA')
    expect(letters().filter((b) => b.classList.contains('picked')).length).toBe(4)

    key('Enter')
    expect(slotOf('JAVA').classList.contains('found')).toBe(true)
    expect(tilesOf('JAVA')).toEqual(['J', 'A', 'V', 'A'])
    expect(last(chips())).toEqual({ kind: 'info', icon: '🔧', title: 'JAVA — Java', sub: 'Languages & Frameworks' })
    expect(live()).toContain('Java')
    expect(bench().textContent).toBe('') // the bench clears for the next word
    expect(slotOf('KAFKA').classList.contains('found')).toBe(false)
  })

  it('draws the trail between the tiles as the word grows', () => {
    const points = () => q('.fg-path polyline')?.getAttribute('points') ?? ''
    expect(points()).toBe('')
    tap('JAV')
    expect(points().split(' ').length).toBe(3)
    key('Backspace')
    expect(points().split(' ').length).toBe(2)
    expect(bench().textContent).toBe('JA')
  })

  it('hangs the next wall once every word on this one is forged', () => {
    play('JAVA')
    expect(wheelText()).toBe(FORGE_ROUNDS[0].ring.join('')) // one word is not a wall
    play('KAFKA')
    expect(wheelText()).toBe(FORGE_ROUNDS[1].ring.join(''))
    expect(letters().length).toBe(7)
    expect(slots().map((s) => s.querySelector('.fg-clue')?.textContent)).toEqual(['Streaming & Messaging', 'State & Tooling'])
    expect(tilesOf('FLINK')).toEqual(['', '', '', '', ''])
    expect(act('hint').textContent).toBe('💡 Hint (2 left)') // a fresh wheel, a fresh budget
  })

  /* ---------------- the words it will not take ---------------- */

  it('shakes a word that is not one of Naman’s tools, and keeps it up to be read', () => {
    uiState.settings.reducedMotion = false
    play('JAK')
    expect(bench().classList.contains('shake')).toBe(true)
    expect(bench().textContent).toBe('JAK') // the rejected word stays while it shakes
    expect(noteText()).toBe("Not one of Naman's tools.")
    expect(live()).toBe("Not one of Naman's tools.")
    expect(slots().some((s) => s.classList.contains('found'))).toBe(false)
  })

  it('says so gently when a word is already forged, and does not toast it twice', () => {
    play('JAVA')
    expect(chips().length).toBe(1)
    play('JAVA')
    expect(noteText()).toBe('Already forged.')
    expect(chips().length).toBe(1)
    expect(slotOf('JAVA').classList.contains('found')).toBe(true)
  })

  it('turns a half-spelled word away without spending the round’s patience', () => {
    for (let i = 0; i < FORGE_MISSES + 2; i++) play('JA')
    expect(noteText()).toBe('Not enough letters.')
    expect(topModalId()).toBe('minigame') // no overlay: none of that was a guess
  })

  /* ---------------- the stuck overlay ---------------- */

  it('offers a way out after six wrong words, and takes six more to offer it again', () => {
    for (let i = 0; i < FORGE_MISSES - 1; i++) play('JAK')
    expect(topModalId()).toBe('minigame')
    play('JAK')
    expect(topModalId()).toBe('minigame-gag')
    expect(q('.mg-gag-title')?.textContent).toBe('Stuck at the bench?')
    expect(q('.mg-gag-sub')?.textContent).toBe('Every word is a tool on the walls.')

    gagButtons()[0].click() // Try again — the tally goes back to nothing
    expect(topModalId()).toBe('minigame')
    for (let i = 0; i < FORGE_MISSES - 1; i++) play('JAK')
    expect(topModalId()).toBe('minigame')
    play('JAK')
    expect(topModalId()).toBe('minigame-gag')
  })

  it('forges a whole word when HR is asked, chip and all', () => {
    for (let i = 0; i < FORGE_MISSES; i++) play('JAK')
    gagButtons()[1].click() // 🤝 Hire me
    expect(slotOf('JAVA').classList.contains('found')).toBe(true)
    expect(tilesOf('JAVA')).toEqual(['J', 'A', 'V', 'A'])
    expect(chips().some((t) => t.title === 'JAVA — Java')).toBe(true)
    expect(host.openId).toBe('forge') // one word, not the round
  })

  /* ---------------- the other two ways in ---------------- */

  it('takes a word typed at it, and ignores letters the wheel does not have', () => {
    key('j')
    key('a')
    key('v')
    expect(bench().textContent).toBe('JAV')
    key('z') // not on this wheel
    key('q')
    expect(bench().textContent).toBe('JAV')
    key('a')
    key('Enter')
    expect(slotOf('JAVA').classList.contains('found')).toBe(true)
  })

  it('will not spend one tile on two letters of the same word', () => {
    key('j')
    key('j')
    key('j')
    expect(bench().textContent).toBe('J')
    // …but the wheel's second A is a tile of its own.
    key('a')
    key('a')
    expect(bench().textContent).toBe('JAA')
  })

  it('spells a word dragged across the wheel and forges it on release', () => {
    const wheel = q<HTMLElement>('.fg-ring')!
    const tiles = letters()
    // No layout in happy-dom, so the drag's hit-test is fed a coordinate space of
    // its own: x is the seat the finger is over.
    vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number) => tiles[Math.round(x)] ?? null)
    const at = (type: string, seat: number, el: HTMLElement) =>
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: seat, clientY: 0 }))

    at('pointerdown', 0, tiles[0]) // J
    at('pointermove', 1, wheel) // A
    at('pointermove', 3, wheel) // V
    at('pointermove', 2, wheel) // the wheel's other A
    expect(bench().textContent).toBe('JAVA')
    expect(q('.fg-path polyline')?.getAttribute('points')?.split(' ').length).toBe(4)

    at('pointerup', 2, wheel) // letting go hands the word in
    expect(slotOf('JAVA').classList.contains('found')).toBe(true)
    expect(last(chips())?.title).toBe('JAVA — Java')
  })

  it('leaves a tapped tile where it is — a tap is not a word', () => {
    const wheel = q<HTMLElement>('.fg-ring')!
    const tiles = letters()
    vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number) => tiles[Math.round(x)] ?? null)
    tiles[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }))
    wheel.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }))
    expect(bench().textContent).toBe('J') // still picked, nothing submitted
    expect(noteText()).toBe('')
  })

  /* ---------------- the two buttons ---------------- */

  it('chalks in a letter when asked, twice a wheel and no more', () => {
    act('hint').click()
    expect(tilesOf('JAVA')).toEqual(['J', '', '', ''])
    expect(act('hint').textContent).toBe('💡 Hint (1 left)')
    expect(live()).toBe('Languages & Frameworks: J.')

    act('hint').click() // the second goes to the slot showing the least
    expect(tilesOf('KAFKA')).toEqual(['K', '', '', '', ''])
    expect(act('hint').textContent).toBe('💡 Hint (0 left)')
    expect(act('hint').disabled).toBe(true)
  })

  it('re-lays the tiles without dropping the word being spelled', () => {
    tap('JA')
    const before = wheelText()
    act('shuffle').click()
    expect(wheelText().split('').sort()).toEqual(before.split('').sort())
    expect(bench().textContent).toBe('JA')
    expect(letters().filter((b) => b.classList.contains('picked')).length).toBe(2)
  })

  /* ---------------- the wall it finally opens ---------------- */

  it('closes as a win when the last wheel is cleared, and opens the Skills chapter', () => {
    for (let i = 0; i < FORGE_ROUNDS.length; i++) clearRound(i)
    expect(host.openId).toBe(null)
    expect(state.save.minigames.forge).toEqual({ won: true, best: FORGE_ROUNDS.length, plays: 1 })
    expect(state.isUnlocked('skills')).toBe(true)
    expect(state.save.hats).toContain('hardhat')
  })

  it('scores the wheels finished when the player walks out halfway', () => {
    clearRound(0)
    host.quit()
    expect(state.save.minigames.forge).toEqual({ won: false, best: 1, plays: 1 })
    expect(state.isUnlocked('skills')).toBe(false)
  })
})
