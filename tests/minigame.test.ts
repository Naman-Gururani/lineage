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

import { events, type Events } from '../src/core/events'
import { PROFILE } from '../src/data/content'
import { STUDY_BOARDS, genBoard } from '../src/games/lightsout'
import { CARGO_LEVELS, solve } from '../src/games/sokoban'
import { ARCADE_GAMES, GameState } from '../src/systems/GameState'
import { MINIGAME_IDS, MinigameHost, initMinigames, isMinigameId } from '../src/systems/Minigame'
import { closeAllModals, focusables, isLocked, isModalOpen, topModalId } from '../src/ui/modal'
import { initCargo } from '../src/ui/minigames/cargo'
import { CLIMB_GAG_TITLE, initClimb } from '../src/ui/minigames/climb'
import { initPacketRush, PR_GAG_TITLE } from '../src/ui/minigames/packetrush'
import { initStudyHall, OVER_PAR_GAG } from '../src/ui/minigames/studyhall'
import { PR } from '../src/games/packetrush'
import { CLIMB, CLIMB_CAPTIONS, CLIMB_STAGES } from '../src/games/climb'
import { climbPlans, type ClimbScript } from './helpers/climb-plan'
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
    uiState.settings.reducedMotion = true // synchronous modal close, no win delay
    toasts = []
    unsub = events.on('ui:toast', (t) => toasts.push(t))
    initPanels()
    initMinigames()
    initStudyHall()
    initCargo()
    initPacketRush()
    initClimb()
    host = new MinigameHost()
    state = new GameState(null)
    host.state = state
  })

  afterEach(() => {
    closeAllModals()
    unsub()
    vi.useRealTimers()
  })

  /* ---------------- the framework ---------------- */

  it('knows its ids', () => {
    expect(isMinigameId('studyhall')).toBe(true)
    expect(isMinigameId('cargo')).toBe(true)
    expect(isMinigameId('fishing')).toBe(false)
  })

  // `GameState` keeps its own copy of this list so the save layer never has to
  // import the DOM-side host. The badge for beating all four is only honest
  // while the two agree.
  it('agrees with the save layer about how many cabinets there are', () => {
    expect([...ARCADE_GAMES]).toEqual(MINIGAME_IDS)
  })

  it('opens a modal, holds the world lock, and lets go on close', () => {
    host.open('studyhall')
    expect(host.openId).toBe('studyhall')
    expect(isModalOpen()).toBe(true)
    expect(topModalId()).toBe('minigame')
    expect(isLocked()).toBe(true)
    expect(q('.modal-panel')?.getAttribute('aria-label')).toBe('Study Hall — Lights Out')
    expect(q('.mg')?.dataset.game).toBe('studyhall')

    host.quit()
    expect(host.openId).toBe(null)
    expect(isModalOpen()).toBe(false)
    expect(isLocked()).toBe(false)
  })

  it('records an abandoned round as a play, not a win', () => {
    host.open('cargo')
    host.quit()
    expect(state.save.minigames.cargo).toEqual({ won: false, best: 0, plays: 1 })
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
    events.emit('ui:panel', { id: 'minigame', data: 'packetrush' })
    expect(q('.mg')?.dataset.game).toBe('packetrush')
    closeAllModals()
  })

  it('asks before Esc throws the round away, and leaves when told to', async () => {
    host.open('cargo')
    key('Escape')
    await new Promise((r) => setTimeout(r, 0)) // the confirm is deferred a tick
    expect(topModalId()).toBe('minigame-exit')
    expect(host.openId).toBe('cargo') // still playing
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
    host.open('studyhall')
    host.gag({ title: 'Stuck!', retry: () => {} })
    expect(topModalId()).toBe('minigame-gag')
    expect(gagButtons().map((b) => b.textContent)).toEqual(['Try again', '🤝 Hire me — extra life', 'Exit'])
    expect(q('.mg-gag-title')?.textContent).toBe('Stuck!')
  })

  it('Try again retries and closes only the overlay', () => {
    const retry = vi.fn()
    host.open('studyhall')
    host.gag({ title: 'Stuck!', retry })
    gagButtons()[0].click()
    expect(retry).toHaveBeenCalledTimes(1)
    expect(topModalId()).toBe('minigame')
    expect(host.openId).toBe('studyhall')
  })

  it('Hire me pays out the hint and the punchline', () => {
    const hint = vi.fn()
    const retry = vi.fn()
    host.open('studyhall')
    host.gag({ title: 'Stuck!', hint, retry })
    gagButtons()[1].click()
    expect(hint).toHaveBeenCalledTimes(1)
    expect(retry).not.toHaveBeenCalled()
    expect(last(toasts)?.title).toBe('Excellent choice. HR will be in touch.')
    expect(host.openId).toBe('studyhall') // the round carries on
  })

  it('pins the mailto inside the dialog, where the backdrop and the trap cannot bury it', () => {
    host.open('studyhall')
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
    host.open('cargo')
    host.gag({ title: 'Stuck!', retry })
    gagButtons()[1].click()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('Exit ends the round', () => {
    host.open('cargo')
    host.gag({ title: 'Stuck!', retry: () => {} })
    gagButtons()[2].click()
    expect(host.openId).toBe(null)
    expect(state.save.minigames.cargo.plays).toBe(1)
  })

  /* ---------------- every way out records the round ---------------- */

  it('records the round when Escape closes the dialog from outside the panel', () => {
    host.open('studyhall')
    ;(document.activeElement as HTMLElement)?.blur()
    // straight at the window, the way the modal manager's own handler sees it:
    // the panel-scoped listener never runs, so no confirm — but the play lands
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(host.openId).toBe(null)
    expect(state.save.minigames.studyhall).toEqual({ won: false, best: 0, plays: 1 })
  })

  it('records the round when the dialog is closed out from under the host', () => {
    host.open('cargo')
    closeAllModals()
    expect(host.openId).toBe(null)
    expect(isLocked()).toBe(false)
    expect(state.save.minigames.cargo).toEqual({ won: false, best: 0, plays: 1 })
  })

  it('keeps focus in the panel when the backdrop is pressed', () => {
    host.open('cargo')
    const root = q('.modal')!
    root.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    expect(host.openId).toBe('cargo') // closeOnBackdrop:false — still playing
    expect(q('.modal-panel')!.contains(document.activeElement)).toBe(true)
  })

  /* ---------------- Study Hall ---------------- */

  it('plays Study Hall to the end with the mouse and pays out the cap', () => {
    host.open('studyhall')
    expect(all('.mg-cell').length).toBe(STUDY_BOARDS[0].n ** 2)
    for (const spec of STUDY_BOARDS) {
      const { seq } = genBoard(spec.n, spec.presses, spec.seed)
      for (const i of seq) all<HTMLButtonElement>('.mg-cell')[i].click()
    }
    expect(host.openId).toBe(null)
    expect(state.save.minigames.studyhall).toEqual({ won: true, best: 5, plays: 1 })
    expect(state.save.hats).toEqual(['grad'])
    expect(state.save.hat).toBe('grad') // an empty head wears the first cap it earns
    expect(toasts.some((t) => t.title === 'Graduation cap unlocked')).toBe(true)
  })

  it('plays Study Hall from the keyboard: arrows, Enter and the number row', () => {
    host.open('studyhall')
    const cells = all<HTMLButtonElement>('.mg-cell')
    expect(document.activeElement).toBe(cells[0])
    key('ArrowRight')
    expect(document.activeElement).toBe(cells[1])
    key('ArrowDown')
    expect(document.activeElement).toBe(cells[1 + 3])
    key('ArrowLeft')
    key('ArrowUp')
    expect(document.activeElement).toBe(cells[0])
    key('ArrowUp') // clamped at the edge, never wraps
    expect(document.activeElement).toBe(cells[0])

    const lit = () => all('.mg-cell.lit').length
    const before = lit()
    key('5') // the middle of a 3×3
    expect(lit()).not.toBe(before)
    expect(q('[data-f="presses"]')?.textContent).toBe('1')
    key('r')
    expect(lit()).toBe(before)
    expect(q('[data-f="presses"]')?.textContent).toBe('0')
  })

  it('offers the gag once the board is 12 over par, and the hint names a real press', () => {
    host.open('studyhall')
    const cells = all<HTMLButtonElement>('.mg-cell')
    const par = Number(q('[data-f="par"]')!.textContent)
    // press one cell twice over and over: the board keeps changing, nothing is solved
    for (let i = 0; i < par + OVER_PAR_GAG; i++) cells[i % 2].click()
    expect(topModalId()).toBe('minigame-gag')
    expect(q('.mg-gag-title')?.textContent).toBe('The chalkboard is winning.')

    gagButtons()[1].click() // Hire me → flash a correct press
    const hinted = q<HTMLElement>('.mg-cell.hint')
    expect(hinted).toBeTruthy()
    expect(q('.mg-live')?.textContent).toMatch(/^Try row \d, column \d\.$/)
  })

  /* ---------------- Cargo Cove ---------------- */

  it('plays Cargo Cove to the end with the arrow keys and pays out the cap and the coins', () => {
    host.open('cargo')
    expect(all('.mg-sok-cell').length).toBe(5 * 3) // level 1 is 5×3
    const NAME: Record<string, string> = { '0,-1': 'ArrowUp', '0,1': 'ArrowDown', '-1,0': 'ArrowLeft', '1,0': 'ArrowRight' }
    for (const level of CARGO_LEVELS) for (const m of solve(level)!) key(NAME[`${m.dx},${m.dy}`])
    expect(host.openId).toBe(null)
    expect(state.save.minigames.cargo).toEqual({ won: true, best: 6, plays: 1 })
    expect(state.save.hats).toEqual(['captain'])
    expect(state.coins).toBe(40)
    expect(toasts.some((t) => t.title === '+40 coins')).toBe(true)
  })

  it('plays Cargo Cove with the on-screen d-pad, so a touch device can push a crate', () => {
    host.open('cargo')
    expect(all('.mg-padbtn').map((b) => b.getAttribute('aria-label'))).toEqual(['Move up', 'Move left', 'Move down', 'Move right'])
    q<HTMLButtonElement>('.mg-padbtn.right')!.click() // level 1 falls in a single push
    expect(q('[data-f="level"]')?.textContent).toBe('2')
    q<HTMLButtonElement>('.mg-padbtn.right')!.click()
    expect(q('[data-f="moves"]')?.textContent).toBe('1')
    q<HTMLButtonElement>('.mg-padbtn.up')!.click() // into the wall: no move
    expect(q('[data-f="moves"]')?.textContent).toBe('1')
  })

  it('undoes a move with Z and starts over with R', () => {
    host.open('cargo')
    key('ArrowRight') // level 1 falls in a single push; the host moves straight on
    expect(q('[data-f="level"]')?.textContent).toBe('2')
    key('ArrowRight') // level 2: a push that does not finish it
    expect(q('[data-f="moves"]')?.textContent).toBe('1')
    key('z')
    expect(q('[data-f="moves"]')?.textContent).toBe('0')
    expect(q('[data-f="home"]')?.textContent).toBe('0')
    key('z') // nothing left to undo
    expect(q('[data-f="moves"]')?.textContent).toBe('0')
    key('ArrowUp') // into the wall: no move, no count
    expect(q('[data-f="moves"]')?.textContent).toBe('0')
    key('ArrowRight')
    key('r')
    expect(q('[data-f="moves"]')?.textContent).toBe('0')
  })

  it('offers the gag after three resets and lays the solver plan out as ghost arrows', () => {
    host.open('cargo')
    key('r')
    key('r')
    expect(topModalId()).toBe('minigame')
    key('r')
    expect(topModalId()).toBe('minigame-gag')
    expect(q('.mg-gag-title')?.textContent).toBe('The pallet is winning.')

    gagButtons()[1].click()
    const ghosts = all('.mg-ghost').filter((g) => g.textContent)
    expect(ghosts.length).toBeGreaterThan(0)
    expect(ghosts[0].textContent).toBe('→')
    expect(q('.mg-live')?.textContent).toBe('Hint: right.')
    key('ArrowRight')
    expect(all('.mg-ghost').filter((g) => g.textContent).length).toBe(0)
  })

  /* ---------------- Packet Rush ---------------- */

  describe('Packet Rush', () => {
    // The cabinet runs on a fixed `setInterval`, so fake timers play it exactly
    // — and they pin `Date.now()`, which is where the run's seed comes from.
    beforeEach(() => vi.useFakeTimers())

    const bins = () => all<HTMLButtonElement>('.pr-bin')
    const glyphOf = (b: HTMLElement) => b.querySelector('.pr-glyph')!.textContent
    const waiting = () => {
      for (let i = 0; i < 600 && !q('.pr-packet.next'); i++) vi.advanceTimersByTime(50)
      return q('.pr-packet.next')!.textContent
    }
    const routeRight = () => {
      const g = waiting()
      bins().find((b) => glyphOf(b) === g)!.click()
    }
    const routeWrong = () => {
      const g = waiting()
      bins().find((b) => glyphOf(b) !== g)!.click()
    }
    const win = () => {
      for (let i = 0; i < PR.WIN; i++) routeRight()
    }

    it('lays out three lanes and three labelled bins', () => {
      host.open('packetrush')
      expect(all('.pr-lane').length).toBe(3)
      expect(bins().map(glyphOf)).toEqual(['£', '€', '$'])
      expect(q('[data-f="lives"]')?.textContent).toBe(String(PR.LIVES))
      expect(q('[data-f="score"]')?.textContent).toBe('0')
    })

    it('drops packets that can be routed, and scores the right bin', () => {
      host.open('packetrush')
      routeRight()
      expect(q('[data-f="score"]')?.textContent).toBe('1')
      expect(q('[data-f="lives"]')?.textContent).toBe(String(PR.LIVES))
    })

    it('costs a life for the wrong bin and gags after three', () => {
      host.open('packetrush')
      routeWrong()
      expect(q('[data-f="lives"]')?.textContent).toBe('2')
      routeWrong()
      routeWrong()
      expect(topModalId()).toBe('minigame-gag')
      expect(q('.mg-gag-title')?.textContent).toBe(PR_GAG_TITLE)
      expect(PR_GAG_TITLE).toBe('The stream got away from you.')
    })

    it('hands back a life when the joke is taken up, and flushes the column with it', () => {
      host.open('packetrush')
      // let a second packet get well down its lane before the last life goes
      routeWrong()
      routeWrong()
      waiting()
      for (let i = 0; i < 120; i++) vi.advanceTimersByTime(16)
      routeWrong()
      expect(topModalId()).toBe('minigame-gag')

      gagButtons()[1].click() // 🤝 Hire me
      expect(topModalId()).toBe('minigame')
      expect(host.openId).toBe('packetrush')
      expect(q('[data-f="lives"]')?.textContent).toBe('1')
      expect(q('.mg-hire-link')).toBeTruthy()
      // A life handed back into a column with a packet already at the deck is
      // spent in two frames. The Stream starts clean.
      expect(all('.pr-packet').filter((p) => !p.hidden).length).toBe(0)
      routeRight() // …and it is still a live game
      expect(q('[data-f="score"]')?.textContent).toBe('1')
      expect(q('[data-f="lives"]')?.textContent).toBe('1')
    })

    it('offers the endless run at thirty, and pays the goggles when banked', () => {
      host.open('packetrush')
      win()
      expect(q('.pr-done-title')?.textContent).toBe('30 routed.')
      q<HTMLButtonElement>('[data-act="bank"]')!.click()
      expect(host.openId).toBe(null)
      expect(state.save.minigames.packetrush).toEqual({ won: true, best: PR.WIN, plays: 1 })
      expect(state.save.hats).toEqual(['goggles'])
      expect(state.quests.isDone('packetrush')).toBe(true)
      // the run pays five real packets down the ordinary collect pathway
      expect(state.save.packets.length).toBe(5)
    })

    it('keeps the win when the endless run is walked away from', () => {
      host.open('packetrush')
      win()
      q<HTMLButtonElement>('[data-act="endless"]')!.click()
      routeRight()
      expect(q('[data-f="score"]')?.textContent).toBe('31')
      host.quit()
      expect(state.save.minigames.packetrush).toEqual({ won: true, best: 31, plays: 1 })
      expect(state.save.hats).toEqual(['goggles'])
    })

    it('credits the errand with the score a quitter got to', () => {
      host.open('packetrush')
      routeRight()
      routeRight()
      host.quit()
      expect(state.save.minigames.packetrush).toEqual({ won: false, best: 2, plays: 1 })
      expect(state.quests.stepProgress('packetrush', 'score')).toBe(2)
      expect(state.quests.isDone('packetrush')).toBe(false)
    })
  })

  /* ---------------- Tower Climb ---------------- */

  describe('Tower Climb', () => {
    // The scaffold runs on a fixed `setInterval` and reads an edge-triggered
    // jump, so the whole climb can be typed at it: the reachability search in
    // tests/helpers/climb-plan.ts hands back the route as one input per tick,
    // and each tick here is a keystroke plus exactly one turn of the clock.
    beforeEach(() => vi.useFakeTimers())

    const canvas = () => q<HTMLCanvasElement>('.cl-canvas')
    const key = (type: 'keydown' | 'keyup', k: string) => canvas()?.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }))

    /** Type a script at the cabinet, one tick of the game clock per input. */
    const drive = (script: ClimbScript) => {
      let left = false
      let right = false
      for (const inp of script) {
        if (!host.openId) break
        if (inp.left !== left) key(inp.left ? 'keydown' : 'keyup', 'ArrowLeft'), (left = inp.left)
        if (inp.right !== right) key(inp.right ? 'keydown' : 'keyup', 'ArrowRight'), (right = inp.right)
        if (inp.jump) key('keydown', ' ')
        vi.advanceTimersToNextTimer()
        if (inp.jump) key('keyup', ' ')
      }
      if (left) key('keyup', 'ArrowLeft')
      if (right) key('keyup', 'ArrowRight')
    }

    const plan = (i: number) => {
      const p = climbPlans(CLIMB_STAGES[i])
      expect(p.toExit, `stage ${i + 1} has no route`).not.toBeNull()
      return p.toExit!
    }

    it('opens on the first floor, with its caption and its falls', () => {
      host.open('climb')
      expect(canvas()).toBeTruthy()
      expect(q('[data-f="floor"]')?.textContent).toBe('1')
      expect(q('[data-f="falls"]')?.textContent).toBe(String(CLIMB.MAX_FALLS))
      expect(q('[data-f="caption"]')?.textContent).toBe(CLIMB_CAPTIONS[0])
      expect(all('[data-hold]').map((b) => b.dataset.hold)).toEqual(['left', 'right', 'jump'])
    })

    it('climbs a floor from the keyboard and moves on to the next one', () => {
      host.open('climb')
      drive(plan(0))
      expect(host.openId).toBe('climb')
      expect(q('[data-f="floor"]')?.textContent).toBe('2')
      expect(q('[data-f="caption"]')?.textContent).toBe(CLIMB_CAPTIONS[1])
      expect(q('[data-f="falls"]')?.textContent).toBe(String(CLIMB.MAX_FALLS)) // a clean floor costs nothing
    })

    it('climbs all three and pays the hard hat, the badge and the Tower Express', () => {
      host.open('climb')
      for (let i = 0; i < CLIMB_STAGES.length; i++) drive(plan(i))
      expect(host.openId).toBe(null)
      expect(state.save.minigames.climb).toEqual({ won: true, best: CLIMB_STAGES.length, plays: 1 })
      expect(state.save.hats).toEqual(['hardhat'])
      expect(state.ach.has('ach_climb')).toBe(true)
      expect(state.quests.isDone('climb')).toBe(true)
      expect(state.flag('tower_express')).toBe(true)
      expect(toasts.some((t) => t.title === 'Hard hat unlocked')).toBe(true)
    })

    it('starts the floor over on R, keeping the falls already taken', () => {
      host.open('climb')
      drive(plan(0))
      expect(q('[data-f="floor"]')?.textContent).toBe('2')
      key('keydown', 'r')
      vi.advanceTimersToNextTimer()
      expect(q('[data-f="floor"]')?.textContent).toBe('2') // the same floor, from the bottom
      expect(q('.mg-live')?.textContent).toBe('Floor 2, from the bottom.')
    })

    it('says its piece when the pavement wins, and Hire me buys a fall back', () => {
      const { toFall } = climbPlans(CLIMB_STAGES[0])
      expect(toFall, 'stage 1 has no repeatable fall').not.toBeNull()
      host.open('climb')
      drive(toFall!)
      expect(q('[data-f="falls"]')?.textContent).toBe('2')
      expect(topModalId()).toBe('minigame')
      drive(toFall!)
      drive(toFall!)
      expect(topModalId()).toBe('minigame-gag')
      expect(q('.mg-gag-title')?.textContent).toBe(CLIMB_GAG_TITLE)
      expect(CLIMB_GAG_TITLE).toBe('The corner office stays corner-less — today.')

      gagButtons()[1].click() // 🤝 Hire me
      expect(topModalId()).toBe('minigame')
      expect(host.openId).toBe('climb')
      expect(q('[data-f="falls"]')?.textContent).toBe('1')
      expect(q('.mg-hire-link')).toBeTruthy()
    })

    it('gives up the whole climb, and records it as a play, when the gag is walked away from', () => {
      const { toFall } = climbPlans(CLIMB_STAGES[0])
      host.open('climb')
      for (let i = 0; i < 3; i++) drive(toFall!)
      gagButtons()[2].click() // Exit
      expect(host.openId).toBe(null)
      expect(state.save.minigames.climb).toEqual({ won: false, best: 0, plays: 1 })
      expect(state.save.hats).toEqual([])
      expect(state.quests.isDone('climb')).toBe(false)
      expect(state.quests.stepProgress('climb', 'roof')).toBe(0)
    })

    it('records the roof even when the dialog is shut inside the win beat', () => {
      // With motion allowed, the roof and the close are 650 ms apart. Anything
      // that shuts the panel inside that beat must still pay out — which is the
      // whole reason `MinigameSession.won()` exists.
      uiState.settings.reducedMotion = false
      try {
        host.open('climb')
        for (let i = 0; i < CLIMB_STAGES.length; i++) {
          drive(plan(i))
          if (i < CLIMB_STAGES.length - 1) vi.advanceTimersToNextTimer() // the between-floors beat
        }
        expect(host.openId).toBe('climb') // on the roof, and the close has not fired
        closeAllModals()
        expect(state.save.minigames.climb).toEqual({ won: true, best: CLIMB_STAGES.length, plays: 1 })
        expect(state.save.hats).toEqual(['hardhat'])
        expect(state.quests.isDone('climb')).toBe(true)
      } finally {
        uiState.settings.reducedMotion = true
      }
    })

    it('never finishes the errand for a run that only got partway', () => {
      state.minigamePlayed('climb', 2)
      expect(state.save.minigames.climb).toEqual({ won: false, best: 2, plays: 1 })
      expect(state.quests.isDone('climb')).toBe(false)
      expect(state.quests.stepProgress('climb', 'roof')).toBe(0)
    })
  })

  /* ---------------- rewards ---------------- */

  it('pays the hat out once and keeps counting the plays', () => {
    state.minigameWon('studyhall', 5)
    state.minigameWon('studyhall', 3)
    expect(state.save.minigames.studyhall).toEqual({ won: true, best: 5, plays: 2 })
    expect(state.save.hats).toEqual(['grad'])
    expect(toasts.filter((t) => t.title === 'Graduation cap unlocked').length).toBe(1)
    expect(last(toasts)?.title).toBe('Cleared it again.')
  })

  it('does not announce a hat the wardrobe already holds', () => {
    state.unlockHat('captain')
    toasts.length = 0
    state.minigameWon('cargo', 6)
    expect(state.save.hats).toEqual(['captain'])
    expect(toasts.some((t) => t.title === "Captain's cap unlocked")).toBe(false)
    expect(toasts.some((t) => t.title === '+40 coins')).toBe(true) // the coins are still owed
  })

  it('leaves a hat you are already wearing alone, but banks the new one', () => {
    state.save.hat = 'crown'
    state.minigameWon('cargo', 6)
    expect(state.save.hats).toEqual(['captain'])
    expect(state.save.hat).toBe('crown')
    expect(toasts.some((t) => t.sub === 'Added to your hats')).toBe(true)
  })
})
