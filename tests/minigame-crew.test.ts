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

import { events } from '../src/core/events'
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
const corner = (tx: number, ty: number): [number, number] => [32 + tx * 48, 42 + ty * 42]

/** Every string the renderer painted this frame, in the order it painted them. */
const texts = () => ops.filter((o) => o.k === 'fillText' || o.k === 'strokeText').map((o) => o.args[0] as string)

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
    expect(q('.modal-kicker')?.textContent).toBe('GAME ROW')
    expect(q('.mg-rule')?.textContent).toBe(
      "The floor gives way wherever you stand. Keep moving. You're the coral bean under the YOU tag, and the last bean standing wins.",
    )
    expect(q('.mg-foot [data-act="quit"]')?.textContent).toBe('Leave')
  })

  it('draws into a pixelated, labelled canvas', () => {
    host.open('crew')
    const canvas = q<HTMLCanvasElement>('.mg-canvas')!
    expect(canvas).toBeTruthy()
    // The label says which bean is the player's, because the canvas cannot.
    expect(canvas.getAttribute('aria-label')).toBe('Dropping floor — you are the coral bean, the four named beans are the crew')
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
    expect([you().x, you().y]).toEqual([1, 4])
    key('ArrowRight')
    advance(CREW.MOVE_MS / 2)
    // Mid-hop: the bean still owns the tile it left, and the renderer has a
    // fraction of a hop to draw with rather than a jump.
    expect([you().x, you().y]).toEqual([1, 4])
    expect([you().fx, you().fy]).toEqual([2, 4])
    expect(you().moveT).toBeGreaterThan(0)

    advance(CREW.MOVE_MS)
    expect([you().x, you().y]).toEqual([2, 4])
  })

  it('takes W A S D as well, and swallows the key so the page stays put', () => {
    host.open('crew')
    const panel = q<HTMLElement>('.mg')!
    const e = new KeyboardEvent('keydown', { key: 'w', bubbles: true, cancelable: true })
    panel.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    advance(CREW.MOVE_MS + 20)
    expect([you().x, you().y]).toEqual([1, 3])
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
    expect([you().x, you().y]).toEqual([1, 5])
  })

  it('holds a press made mid-hop and plays it on landing', () => {
    host.open('crew')
    key('ArrowRight')
    advance(CREW.MOVE_MS / 4)
    key('ArrowDown') // too early: the bean is still in the air
    advance(CREW.MOVE_MS * 2 + 20)
    expect([you().x, you().y]).toEqual([2, 5])
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
    tiles[1] = { state: 'gone', t: 0 }
    ops = []
    frame(0)
    // The bite is an absence of deck: one flat rectangle, no lip to light.
    expect(rectsAt(...corner(0, 0))).toEqual([40])
    // A hole is a pit with the deck's own edge still around it.
    expect(rectsAt(...corner(1, 0))).toEqual([40, 3])
    // and untouched floor is the top face and its lit edge
    expect(rectsAt(...corner(4, 4))).toEqual([31, 2])
  })

  it('lays the whole twelve-by-eight deck out inside the canvas', () => {
    host.open('crew')
    ops = []
    frame(0)
    // Every tile of the grid is painted, and the last one still has a margin
    // of canvas beyond it — the deck grew, the canvas did not.
    expect(rectsAt(...corner(CREW.W - 1, CREW.H - 1))).toEqual([31, 2])
    expect(rectsAt(...corner(CREW.W, 0))).toEqual([])
    const [rx, ry] = corner(CREW.W - 1, CREW.H - 1)
    expect(rx + 48).toBeLessThanOrEqual(640)
    expect(ry + 42).toBeLessThanOrEqual(420)
  })

  it('leaves a hole a hole — nothing is ever painted back over it', () => {
    uiState.settings.reducedMotion = false
    host.open('crew')
    board().tiles[1] = { state: 'gone', t: 0 }
    ops = []
    frame(0)
    // The pit and its lip, and nothing after them: no floor fading back in, in
    // either motion setting, however long the round runs.
    expect(rectsAt(...corner(1, 0))).toEqual([40, 3])
    uiState.settings.reducedMotion = true
    key('ArrowRight')
    advance(CREW.CRACK_MS * 2)
    ops = []
    frame(4)
    expect(rectsAt(...corner(1, 0))).toEqual([40, 3])
    expect(board().tiles[1].state).toBe('gone')
  })

  /* ---------------- who is who ---------------- */

  it('tags you and names the four other people playing, all round', () => {
    host.open('crew')
    key('ArrowRight')
    // Not just at the start: a second in, half a round in, the tags are still
    // there. This is the whole of the feedback — "it is not clearly visible who
    // you are" — so it is checked at three points rather than one.
    for (const ms of [0, 1000, CREW.CRACK_MS * 4]) {
      advance(ms)
      if (board().status !== 'play') break
      ops = []
      frame(100 + ms)
      const drawn = texts()
      expect(drawn).toContain('YOU')
      for (const name of ['Sol', 'Ravi', 'Pip', 'Mira']) expect(drawn).toContain(name)
    }
  })

  it('draws YOU in the coral of the bean it points at, over everything else', () => {
    host.open('crew')
    ops = []
    frame(0)
    const tag = ops.findIndex((o) => o.k === 'fillText' && o.args[0] === 'YOU')
    expect(tag).toBeGreaterThanOrEqual(0)
    // Outlined against the pit so it reads over deck, hole or bean alike…
    expect(ops.some((o) => o.k === 'strokeText' && o.args[0] === 'YOU')).toBe(true)
    // …filled in the player bean's own colour…
    const fill = ops.slice(0, tag).filter((o) => o.k === 'set:fillStyle').pop()
    expect(fill?.args[0]).toBe('#ff7a59')
    // …and painted after the last tile and after all four bot names, so nothing
    // on the board can land on top of it.
    const lastTile = ops.map((o) => o.k).lastIndexOf('fillRect')
    expect(tag).toBeGreaterThan(lastTile)
    for (const name of ['Sol', 'Ravi', 'Pip', 'Mira'])
      expect(tag).toBeGreaterThan(ops.findIndex((o) => o.k === 'fillText' && o.args[0] === name))
  })

  it('points a down-arrow at your bean and rings its feet in white', () => {
    host.open('crew')
    ops = []
    frame(0)
    const tag = ops.findIndex((o) => o.k === 'fillText' && o.args[0] === 'YOU')
    // The arrow: a small closed triangle drawn just under the tag.
    const tri = ops.slice(0, tag).filter((o) => o.k === 'lineTo')
    expect(tri.length).toBeGreaterThanOrEqual(2)
    expect(ops.slice(0, tag).some((o) => o.k === 'closePath')).toBe(true)
    // The ring: white, and nobody else on the board is drawn in white.
    expect(ops.filter((o) => o.k === 'set:strokeStyle' && o.args[0] === '#ffffff')).toHaveLength(1)
  })

  it('names the bots more quietly than it names you', () => {
    host.open('crew')
    ops = []
    frame(0)
    const size = (text: string): number => {
      const i = ops.findIndex((o) => o.k === 'fillText' && o.args[0] === text)
      const font = ops.slice(0, i).filter((o) => o.k === 'set:font').pop()?.args[0] as string
      return Number(/(\d+)px/.exec(font)?.[1])
    }
    for (const name of ['Sol', 'Ravi', 'Pip', 'Mira']) expect(size(name)).toBeLessThan(size('YOU'))
    // and dimmed, where yours is at full strength
    const faded = ops.filter((o) => o.k === 'set:globalAlpha' && o.args[0] === 0.8)
    expect(faded).toHaveLength(4)
  })

  it('keeps the tag on the canvas in the worst case a round can produce', () => {
    // The deck grew and its margins shrank with it, so the highest tag a round
    // can ask for is the one worth checking: a bean on the *top row*, at the
    // *peak of a hop*, with the *bob* at the top of its own swing. Any one of
    // the three left out and this passes on slack it does not have.
    uiState.settings.reducedMotion = false
    host.open('crew')
    key('ArrowRight')
    frame(0) // seeds the loop's clock; every later frame(0) is a pure redraw
    const tops: number[] = []
    for (let i = 0; i < 30; i++) {
      advance(60) // walks the bob on; thirty of these is more than a full turn
      const live = board()
      live.tiles[0] = { state: 'ok', t: 0 } // keep floor under it, so the round runs on
      const me = live.beans.find((b) => b.id === 'you')!
      me.x = 0
      me.y = 0
      me.fx = 1
      me.fy = 0
      me.moveT = CREW.MOVE_MS / 2 // half way through the hop: the top of the arc
      me.alive = true
      ops = []
      frame(0)
      const y = ops.find((o) => o.k === 'fillText' && o.args[0] === 'YOU')!.args[2] as number
      // The outline's own top edge: half the glyph box, plus half the stroke.
      tops.push(y - 15 / 2 - 4 / 2)
    }
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...tops)).toBeLessThan(42) // and still clear of the deck
    // …and the bob really did swing while we sampled: a phase that never moved
    // would make every line above a coincidence.
    expect(new Set(tops.map((t) => Math.round(t * 10))).size).toBeGreaterThan(3)
    // None of which would fit if the pips had stayed above the deck, which is
    // why they are in the margin below it now.
    const pips = ops.filter((o) => o.k === 'ellipse' && o.args[2] === 5 && o.args[3] === 6)
    expect(pips).toHaveLength(CREW.BOTS + 1)
    for (const p of pips) {
      expect(p.args[1] as number).toBeGreaterThan(42 + 42 * CREW.H)
      expect(p.args[1] as number).toBeLessThan(420)
    }
  })

  it('rides the tag down with the bean that falls, then takes it away', () => {
    uiState.settings.reducedMotion = false
    host.open('crew')
    key('ArrowRight')
    // Stand still until the floor gives way.
    advance(CREW.MOVE_MS + CREW.CRACK_MS + 20)
    expect(you().alive).toBe(false)
    frame(0)

    /** The tag's own alpha: the last one set before the outline is stroked. */
    const tagAlpha = (): number => {
      const i = ops.findIndex((o) => o.k === 'strokeText' && o.args[0] === 'YOU')
      expect(i).toBeGreaterThanOrEqual(0)
      return ops.slice(0, i).filter((o) => o.k === 'set:globalAlpha').pop()!.args[0] as number
    }
    const tagY = (): number => ops.find((o) => o.k === 'fillText' && o.args[0] === 'YOU')!.args[2] as number

    // A quarter of the way down: still lettered, already fading, already sinking.
    advance(100)
    ops = []
    frame(0)
    const [a1, y1] = [tagAlpha(), tagY()]
    expect(a1).toBeLessThan(1)

    advance(200)
    ops = []
    frame(0)
    expect(tagAlpha()).toBeLessThan(a1)
    expect(tagY()).toBeGreaterThan(y1)

    // …and once the fall has played out the tag goes with it.
    advance(200)
    ops = []
    frame(0)
    expect(texts()).not.toContain('YOU')
  })

  /* ---------------- the held board ---------------- */

  it('holds the floor until the first press, and says so over the deck', () => {
    host.open('crew')
    ops = []
    frame(0)
    // The hint the held board shows instead of a countdown — no numerals, in
    // the panel's own accent — over the line that says which bean is yours.
    expect(ops.some((o) => o.k === 'fillText' && o.args[0] === 'ready — press a key or tap the pad')).toBe(true)
    expect(texts()).toContain('you are the coral bean under the YOU tag')
    expect(ops.some((o) => o.k === 'set:fillStyle' && o.args[0] === '#5eead4')).toBe(true)

    // Five seconds of nothing: no crack, no drop, no ejection. CRACK_MS is well
    // under this, so an unheld board would have taken the floor out by now.
    advance(5000)
    expect(board().t).toBe(0)
    expect(board().status).toBe('play')
    expect(you().alive).toBe(true)
    expect(board().tiles.every((t) => t.state === 'ok')).toBe(true)
    expect(q('.mg-gag')).toBeNull()

    // …and the moment a key lands both lines are gone and the clock is running.
    // The name tags stay, so it is the two held-board lines that are checked
    // for rather than the absence of text altogether.
    key('ArrowRight')
    ops = []
    advance(CREW.MOVE_MS)
    frame(100)
    expect(texts()).not.toContain('ready — press a key or tap the pad')
    expect(texts()).not.toContain('you are the coral bean under the YOU tag')
    expect(board().t).toBeGreaterThan(0)
  })

  it('starts the clock from the d-pad as well as from the keys', () => {
    host.open('crew')
    advance(1000)
    expect(board().t).toBe(0)
    click('.mg-padbtn[data-dir="down"]')
    advance(CREW.MOVE_MS + 20)
    expect(board().t).toBeGreaterThan(0)
    expect([you().x, you().y]).toEqual([1, 5])
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
    expect([you().x, you().y]).toEqual([2, 4])
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

  /* ---------------- the way out for a recruiter in a hurry ---------------- */

  it('offers to skip the round, in the footer, just before Leave', () => {
    host.open('crew')
    const foot = q<HTMLElement>('.mg-foot')!
    const btn = q<HTMLButtonElement>('.mg-reveal')!
    expect(btn.textContent).toBe('Skip this one')
    const order = Array.from(foot.querySelectorAll('button')).map((b) => b.textContent)
    expect(order.indexOf('Skip this one')).toBe(order.indexOf('Leave') - 1)
  })

  it('ends the round with nothing to show for it — there is no hat for peeking', () => {
    const toasts: string[] = []
    const off = events.on('ui:toast', (t) => toasts.push(t.title))
    host.open('crew')
    q<HTMLButtonElement>('.mg-reveal')!.click()
    off()
    expect(isModalOpen()).toBe(false)
    expect(host.openId).toBe(null)
    expect(state.save.minigames.crew).toEqual({ won: false, best: 0, plays: 1 })
    expect(state.save.hats).not.toContain('captain')
    expect(toasts).toContain('Noted. HR sees everything.')
    expect(toasts).toContain('No hat for peeking.')
  })
})
