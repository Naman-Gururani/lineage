// @vitest-environment happy-dom
//
// Crew Drop's cabinet: the panel it builds, the keys and the d-pad that hop the
// bean, and the three ways a round ends — ejected (the gag, and the two ways
// back), last bean standing (the payout), and Skip (dev).
//
// The simulation itself is `tests/crew.test.ts`; everything here drives the
// renderer through `__step`, so a round plays out in exact milliseconds instead
// of in whatever frames the machine felt like handing out.
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

import { CREW } from '../src/games/crew'
import { GameState } from '../src/systems/GameState'
import { MinigameHost, initMinigames } from '../src/systems/Minigame'
import { initMinigameRenderers } from '../src/ui/minigames'
import type { CrewSession } from '../src/ui/minigames/crew'
import { closeAllModals, isModalOpen } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))

const key = (k: string) => {
  const target = (document.activeElement as HTMLElement) ?? document.body
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}
const click = (sel: string) => q<HTMLButtonElement>(sel)?.click()

/* ---------------- the rAF driver and the drawing surface ---------------- */

type RafCb = (t: number) => void
let queue: { id: number; cb: RafCb }[] = []
let nextId = 1

function frame(t: number): void {
  const due = queue
  queue = []
  for (const r of due) r.cb(t)
}

/** Every call and every property set the renderer makes, in order. */
let ops: { k: string; args: unknown[] }[] = []

/**
 * happy-dom has no 2D context, so every draw call lands on a Proxy that says
 * yes to everything: a function for a method, a remembered value for a property.
 * It writes down what it was asked to draw on the way past.
 */
function stubContext(): CanvasRenderingContext2D {
  const store = new Map<string, unknown>()
  return new Proxy(
    {},
    {
      get: (_t, k: string) =>
        store.has(k)
          ? store.get(k)
          : (...args: unknown[]) => {
              ops.push({ k, args })
            },
      set: (_t, k: string, v: unknown) => {
        ops.push({ k: `set:${k}`, args: [v] })
        store.set(k, v)
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
}

/**
 * The heights of the rectangles filled at one tile's top-left corner, which is
 * how the four states tell themselves apart on a stubbed context: floor is a
 * top face and its lit edge, a hole is a pit and the lip that catches the
 * light, and the arena's bite is a pit with no lip at all.
 */
function rectsAt(x: number, y: number): number[] {
  return ops.filter((o) => o.k === 'fillRect' && o.args[0] === x && o.args[1] === y).map((o) => o.args[3] as number)
}

/** Tile (tx, ty)'s top-left corner in the 640 × 420 logical canvas. */
const corner = (tx: number, ty: number): [number, number] => [40 + tx * 56, 42 + ty * 48]

/** Where a bean of this colour was drawn: the visor, the first ellipse after its body. */
function visorX(colour: string): number {
  const i = ops.findIndex((o) => o.k === 'set:fillStyle' && o.args[0] === colour)
  expect(i).toBeGreaterThanOrEqual(0)
  const e = ops.slice(i).find((o) => o.k === 'ellipse')
  return e?.args[0] as number
}

describe('Crew Drop — the cabinet', () => {
  let host: MinigameHost
  let state: GameState

  /** The live renderer, reached the way the host holds it. */
  const session = () => (host as unknown as { session: CrewSession | null }).session!
  const advance = (ms: number) => session().__step(ms)
  const board = () => session().__state()
  const you = () => board().beans.find((b) => b.id === 'you')!

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    history.replaceState(null, '', '/')
    // A synchronous modal close and no win delay, so a round ends inside the
    // call that ended it; it also makes the fall instant, which is what the
    // reduced-motion path promises.
    uiState.settings.reducedMotion = true
    queue = []
    nextId = 1
    ops = []
    vi.stubGlobal('requestAnimationFrame', (cb: RafCb) => {
      const id = nextId++
      queue.push({ id, cb })
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      queue = queue.filter((r) => r.id !== id)
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => stubContext())
    initPanels()
    initMinigames()
    initMinigameRenderers()
    host = new MinigameHost()
    state = new GameState(null)
    host.state = state
  })

  afterEach(() => {
    closeAllModals()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /* ---------------- the panel ---------------- */

  it('builds the board, the rule and the way out', () => {
    host.open('crew')
    expect(q('.modal-title')?.textContent).toBe('Crew Drop')
    expect(q('.modal-kicker')?.textContent).toBe('HARBOR ARCADE')
    expect(q('.mg-rule')?.textContent).toBe('The floor gives way wherever you stand. Keep moving. Last bean standing wins.')
    expect(q('.mg-foot [data-act="quit"]')?.textContent).toBe('Leave')
  })

  it('draws into a pixelated, labelled canvas', () => {
    host.open('crew')
    const canvas = q<HTMLCanvasElement>('.mg-canvas')!
    expect(canvas).toBeTruthy()
    expect(canvas.getAttribute('aria-label')).toBe('Dropping floor')
    expect(canvas.getAttribute('role')).toBe('img')
    expect(canvas.style.imageRendering).toBe('pixelated')
    // 640 × 420 logical, whatever the screen's ratio
    expect(canvas.style.getPropertyValue('--ar')).toBe(String(640 / 420))
  })

  it('mounts the d-pad for thumbs, and takes the focus for keys', () => {
    host.open('crew')
    expect(q('.mg-pad')).toBeTruthy()
    expect(all('.mg-padbtn').map((b) => b.dataset.dir)).toEqual(['up', 'left', 'down', 'right'])
    const panel = q<HTMLElement>('.mg')!
    expect(panel.tabIndex).toBe(0)
    // The host mounts us after the modal has already chosen where focus goes,
    // so the game takes it back — and keeps it when the gag closes.
    expect(panel.dataset.autofocus).toBe('')
    expect(document.activeElement).toBe(panel)
  })

  it('runs on the shared rAF loop, and stops dead when the round is torn down', () => {
    host.open('crew')
    expect(queue).toHaveLength(1)
    key('ArrowRight') // the board is held until the first press
    frame(0)
    frame(100)
    expect(board().t).toBeGreaterThan(0)
    expect(queue).toHaveLength(1)

    host.quit()
    expect(queue).toHaveLength(0)
  })

  /* ---------------- hopping ---------------- */

  it('hops you east on ArrowRight, and interpolates the way there', () => {
    host.open('crew')
    expect([you().x, you().y]).toEqual([1, 3])
    key('ArrowRight')
    advance(CREW.MOVE_MS / 2)
    // Mid-hop: the bean still owns the tile it left, and the renderer has a
    // fraction of a hop to draw with rather than a jump.
    expect([you().x, you().y]).toEqual([1, 3])
    expect([you().fx, you().fy]).toEqual([2, 3])
    expect(you().moveT).toBeGreaterThan(0)

    advance(CREW.MOVE_MS)
    expect([you().x, you().y]).toEqual([2, 3])
  })

  it('takes W A S D as well, and swallows the key so the page stays put', () => {
    host.open('crew')
    const panel = q<HTMLElement>('.mg')!
    const e = new KeyboardEvent('keydown', { key: 'w', bubbles: true, cancelable: true })
    panel.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    advance(CREW.MOVE_MS + 20)
    expect([you().x, you().y]).toEqual([1, 2])
  })

  it('leaves a key it does not use alone', () => {
    host.open('crew')
    const e = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true })
    q<HTMLElement>('.mg')!.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
  })

  it('hops from the d-pad too', () => {
    host.open('crew')
    click('.mg-padbtn[data-dir="down"]')
    advance(CREW.MOVE_MS + 20)
    expect([you().x, you().y]).toEqual([1, 4])
  })

  it('holds a press made mid-hop and plays it on landing', () => {
    host.open('crew')
    key('ArrowRight')
    advance(CREW.MOVE_MS / 4)
    key('ArrowDown') // too early: the bean is still in the air
    advance(CREW.MOVE_MS * 2 + 20)
    expect([you().x, you().y]).toEqual([2, 4])
  })

  it('draws between steps, not only on them', () => {
    host.open('crew')
    key('ArrowRight')
    frame(0) // the loop seeds its clock here and simulates nothing
    frame(100) // twelve whole steps: the hop is under way
    // Two frames four milliseconds apart: less than one 120 Hz step, so the
    // simulation does not move at all and only the interpolation can. A bean
    // drawn in the same place twice would be a bean that stutters at the step
    // rate — the jitter this whole fixed-step-plus-alpha arrangement exists to
    // avoid.
    ops = []
    frame(104)
    const early = visorX('#ff7a59')
    ops = []
    frame(108)
    const late = visorX('#ff7a59')
    expect(you().moveT).toBeGreaterThan(0)
    expect(late).toBeGreaterThan(early)
    expect(late - early).toBeLessThan(4) // a creep, not a jump
  })

  it('draws floor, a hole and the arena’s bite as three different things', () => {
    host.open('crew')
    const tiles = board().tiles
    tiles[0] = { state: 'void', t: 0 }
    tiles[1] = { state: 'gone', t: CREW.REGROW_MS }
    ops = []
    frame(0)
    // The bite is an absence of deck: one flat rectangle, no lip to light.
    expect(rectsAt(...corner(0, 0))).toEqual([46])
    // A hole is a pit with the deck's own edge still around it.
    expect(rectsAt(...corner(1, 0))).toEqual([46, 3])
    // and untouched floor is the top face and its lit edge
    expect(rectsAt(...corner(4, 4))).toEqual([37, 2])
  })

  it('fades a closing hole back into floor over its last moments', () => {
    uiState.settings.reducedMotion = false
    host.open('crew')
    board().tiles[1] = { state: 'gone', t: 200 } // inside the last stretch
    ops = []
    frame(0)
    // The pit and its lip, and then the floor painted back over them.
    expect(rectsAt(...corner(1, 0))).toEqual([46, 3, 37, 2])
    const part = ops.filter((o) => o.k === 'set:globalAlpha' && (o.args[0] as number) > 0 && (o.args[0] as number) < 1)
    expect(part.length).toBeGreaterThan(0)

    // …and with motion turned down the floor simply returns, without the fade.
    uiState.settings.reducedMotion = true
    ops = []
    frame(4)
    expect(rectsAt(...corner(1, 0))).toEqual([46, 3])
  })

  /* ---------------- the held board ---------------- */

  it('holds the floor until the first press, and says so over the deck', () => {
    host.open('crew')
    ops = []
    frame(0)
    // The hint the held board shows instead of a countdown — no numerals, in
    // the panel's own accent.
    expect(ops.some((o) => o.k === 'fillText' && o.args[0] === 'ready — press a key or tap the pad')).toBe(true)
    expect(ops.some((o) => o.k === 'set:fillStyle' && o.args[0] === '#5eead4')).toBe(true)

    // Five seconds of nothing: no crack, no drop, no ejection. CRACK_MS is well
    // under this, so an unheld board would have taken the floor out by now.
    advance(5000)
    expect(board().t).toBe(0)
    expect(board().status).toBe('play')
    expect(you().alive).toBe(true)
    expect(board().tiles.every((t) => t.state === 'ok')).toBe(true)
    expect(q('.mg-gag')).toBeNull()

    // …and the moment a key lands the hint is gone and the clock is running.
    key('ArrowRight')
    ops = []
    advance(CREW.MOVE_MS)
    frame(100)
    expect(ops.some((o) => o.k === 'fillText')).toBe(false)
    expect(board().t).toBeGreaterThan(0)
  })

  it('starts the clock from the d-pad as well as from the keys', () => {
    host.open('crew')
    advance(1000)
    expect(board().t).toBe(0)
    click('.mg-padbtn[data-dir="down"]')
    advance(CREW.MOVE_MS + 20)
    expect(board().t).toBeGreaterThan(0)
    expect([you().x, you().y]).toEqual([1, 4])
  })

  /* ---------------- ejected ---------------- */

  it('drops you through the floor if you stand still, in Mira’s words', () => {
    host.open('crew')
    key('ArrowRight')
    // one hop, then the tile it lands on has its own crack to run down
    advance(CREW.MOVE_MS + CREW.CRACK_MS + 100)
    expect(you().alive).toBe(false)
    expect(q('.mg-gag-title')?.textContent).toBe('You were ejected.')
    expect(q('.mg-gag-sub')?.textContent).toBe('Naman was not the impostor.')
  })

  it('deals a fresh round on Try again', () => {
    host.open('crew')
    const first = board().seed
    key('ArrowRight')
    // one hop, then the tile it lands on has its own crack to run down
    advance(CREW.MOVE_MS + CREW.CRACK_MS + 100)
    click('.mg-gag [data-act="retry"]')
    expect(q('.mg-gag')).toBeNull()
    expect(board().seed).not.toBe(first)
    expect(board().status).toBe('play')
    expect(board().tiles.every((t) => t.state === 'ok')).toBe(true)
    expect(you().alive).toBe(true)
    // and it really is playable again
    key('ArrowRight')
    advance(CREW.MOVE_MS + 20)
    expect([you().x, you().y]).toEqual([2, 3])
  })

  it('puts you back on the floor for a Hire me, with the bots holding still', () => {
    host.open('crew')
    const seed = board().seed
    key('ArrowRight')
    // one hop, then the tile it lands on has its own crack to run down
    advance(CREW.MOVE_MS + CREW.CRACK_MS + 100)
    click('.mg-gag [data-act="hire"]')
    expect(board().seed).toBe(seed) // the same round, not a new one
    expect(board().status).toBe('play')
    expect(you().alive).toBe(true)
    expect(board().beans.filter((b) => b.id !== 'you').every((b) => b.frozen === CREW.FREEZE_MS)).toBe(true)
    // the joke pays out in the panel, where it can actually be clicked
    expect(q('.mg-hire-link')?.getAttribute('href')).toMatch(/^mailto:/)
  })

  it('scores the round it was quit in', () => {
    host.open('crew')
    expect(session().score()).toBe(0)
    host.quit()
    expect(state.save.minigames.crew?.plays).toBe(1)
    expect(state.save.minigames.crew?.won).toBe(false)
  })

  /* ---------------- last bean standing ---------------- */

  it('closes as a win when the last bot goes down, and pays Mira’s dare out', () => {
    host.open('crew')
    // Take the bots out from under the renderer: the simulation itself is
    // proven in tests/crew.test.ts, and what matters here is what the cabinet
    // does the moment it is handed a won board.
    for (const b of board().beans) if (b.id !== 'you') b.alive = false
    const live = session()
    key('ArrowRight') // the board is held until the first press
    advance(16)

    expect(live.score()).toBe(1)
    expect(isModalOpen()).toBe(false)
    expect(state.save.minigames.crew?.won).toBe(true)
    expect(state.quests.isDone('crew')).toBe(true)
    expect(state.save.hats).toContain('captain')
  })

  it('hands the round over to Skip (dev) under ?cheat=1', () => {
    history.replaceState(null, '', '/?cheat=1')
    host.open('crew')
    expect(q('.mg-cheat')).toBeTruthy()
    click('.mg-cheat')
    expect(isModalOpen()).toBe(false)
    expect(state.save.minigames.crew?.won).toBe(true)
    expect(state.quests.isDone('crew')).toBe(true)
    expect(state.save.hats).toContain('captain')
  })
})
