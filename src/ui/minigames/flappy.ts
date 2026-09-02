// Chalk Flight — Prof. Iyer's chalkboard, running Flappy Bird in chalk.
//
// The rules are all in `games/flappy.ts`; this file is the board they are drawn
// on. Three things keep it smooth rather than jittery, which is the whole point
// of the cabinet: the simulation runs on the shared 120 Hz fixed step, the draw
// interpolates between the last two states with the loop's alpha, and the only
// DOM write in a frame is a score that actually changed. Each column's stack of
// books is rasterised once when it is first seen and blitted after that, so a
// frame is a handful of draws however many books are on the board.
import { sfx } from '../../audio/sfx'
import { BIRD_X, FLAPPY, type FlappyState, type Rect, columnRects, flap, newFlappy, revive, step, won } from '../../games/flappy'
import { type MinigameHost, type MinigameSession, afterWin } from '../../systems/Minigame'
import { panelHead } from '../panels'
import { reducedMotion } from '../state'
import { type Surface, makeCanvas } from './canvas'
import { createLoop } from './loop'

const HZ = 120
const STEP_MS = 1000 / HZ

/** Board green, and the two weights of chalk everything else is drawn in. */
const BOARD = '#1f3d2f'
const CHALK = '#eef3ea'
const CHALK_DIM = 'rgba(238, 243, 234, 0.5)'

/** Books are stacked at roughly this height, give or take the wobble. */
const BOOK_H = 14
/** Rasterised stacks live here; past this many distinct gaps the run starts over. */
const STACK_CACHE = 24
/**
 * The stack canvas is a little wider than the column it holds, because a 2 px
 * outline drawn on the column's own edge puts half of itself outside it — and a
 * clipped half-stroke is a book with one thin side.
 */
const STACK_PAD = 2

/** The headless warning is worth saying, and worth saying once a page. */
let warnedHeadless = false

/**
 * A deterministic 0…1 from two numbers — the hash every shader uses for cheap
 * noise. The stacks want to look hand-drawn while still being the same drawing
 * every time that column is rasterised, and a seeded `Rng` object per book would
 * be an allocation for a number.
 */
function wob(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return n - Math.floor(n)
}

/** An offscreen canvas in device pixels, drawn in logical ones. */
function offscreen(w: number, h: number, dpr: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)
  return { canvas, ctx }
}

/**
 * The board's texture: chalk dust that never moves, and the ghosts of what was
 * wiped off it. Drawn once into its own canvas and blitted, because 400 dots per
 * frame is 48,000 a second for something that is deliberately standing still.
 * Reduced motion skips it entirely — it is the busiest thing on the board.
 */
function makeGrain(w: number, h: number, dpr: number): HTMLCanvasElement | null {
  const off = offscreen(w, h, dpr)
  if (!off) return null
  const { ctx } = off
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(238, 243, 234, ${(0.02 + Math.random() * 0.05).toFixed(3)})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random())
  }
  ctx.strokeStyle = 'rgba(238, 243, 234, 0.045)'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const y = 30 + Math.random() * (h - 90)
    ctx.beginPath()
    ctx.moveTo(Math.random() * w * 0.3, y)
    ctx.lineTo(w * 0.5 + Math.random() * w * 0.5, y + (Math.random() - 0.5) * 14)
    ctx.stroke()
  }
  return off.canvas
}

/** One book: a leaning outline with a spine line down the fore edge. */
function drawBook(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, key: number, i: number): void {
  const inset = wob(key, i + 31) * 7
  const lean = (wob(key, i + 71) - 0.5) * 3
  const left = x + inset
  const right = x + w
  ctx.beginPath()
  ctx.moveTo(left, y + lean)
  ctx.lineTo(right, y - lean)
  ctx.lineTo(right, y + h - lean)
  ctx.lineTo(left, y + h + lean)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(left + 6, y + lean + 2)
  ctx.lineTo(left + 6, y + h + lean - 2)
  ctx.stroke()
}

/**
 * Fill one of a column's two boxes with books, stacked *outward from the gap* so
 * the edges the bird flies between are always clean book edges and the ragged
 * end is the one against the ceiling or the floor.
 */
function drawStack(ctx: CanvasRenderingContext2D, r: Rect, above: boolean, key: number): void {
  let edge = above ? r.y + r.h : r.y
  const end = above ? r.y : r.y + r.h
  for (let i = 0; i < 26; i++) {
    const room = above ? edge - end : end - edge
    if (room <= 3) break
    const h = Math.min(room, BOOK_H + Math.round(wob(key, i) * 7))
    drawBook(ctx, r.x, above ? edge - h : edge, r.w, h, key, i)
    edge = above ? edge - h : edge + h
  }
}

/**
 * What this cabinet hands the host: the ordinary session, plus a door for the
 * tests to walk the simulation through whole fixed steps without a real clock.
 * The host never looks at it and the player cannot reach it.
 */
export type FlappySession = MinigameSession & { __step(ms: number): void }

export function mountFlappy(host: MinigameHost, root: HTMLElement): FlappySession {
  /** Retry deals the next seed along, so a lost board is never handed back. */
  let seed = 1
  let state = newFlappy(seed)
  /** The state one step back: what the draw interpolates *from*. */
  let prev = state
  /** The score currently on the panel — the guard that keeps the DOM out of the frame. */
  let shown = 0
  /** Won or lost: the board is parked until the gag or the close says otherwise. */
  let over = false
  let winTimer = 0

  root.innerHTML =
    panelHead('Chalk Flight', 'SRM CAMPUS') +
    `<p class="mg-rule">Tap or press Space to flap. Fly through ten gaps and the notice board is yours.</p>` +
    `<div class="mg-stats"><span class="mg-stat"><b data-f="score">0</b><small>of ${FLAPPY.WIN} gaps</small></span></div>` +
    `<div class="mg-board fl-board"></div>` +
    `<footer class="mg-foot">` +
    `<span class="mg-keys">Space, ↑ or W — or the button.</span>` +
    `<button type="button" class="pbtn primary fl-flap" data-act="flap">Flap</button>` +
    `<button type="button" class="pbtn" data-act="quit">Leave</button>` +
    `</footer>`

  const scoreEl = root.querySelector<HTMLElement>('[data-f="score"]')!
  const board = root.querySelector<HTMLElement>('.fl-board')!

  let surface: Surface | null = null
  try {
    surface = makeCanvas(board, FLAPPY.W, FLAPPY.H, { label: 'Chalkboard' })
  } catch (e) {
    // Exactly one failure here is survivable: a browser that will not hand out a
    // 2D context (which is also what the DOM stub in the host's own tests does).
    // The panel, the rules and the score still stand up; there is simply nothing
    // to look at, and no loop burning frames to draw it. Anything else thrown by
    // the surface is a real bug and has to travel.
    if (!(e instanceof Error) || !/2d context/i.test(e.message)) throw e
    if (!warnedHeadless) {
      warnedHeadless = true
      console.warn('Chalk Flight: no 2D canvas context on this browser — the chalkboard will not draw.')
    }
    surface = null
  }

  const grain = surface && !reducedMotion() ? makeGrain(FLAPPY.W, FLAPPY.H, surface.dpr) : null
  /** gapY → the rasterised stack of books for a column with that gap. */
  const stacks = new Map<number, HTMLCanvasElement>()

  function stackFor(gapY: number): HTMLCanvasElement | null {
    const had = stacks.get(gapY)
    if (had) return had
    if (!surface) return null
    const off = offscreen(FLAPPY.COL_W + STACK_PAD * 2, FLAPPY.FLOOR, surface.dpr)
    if (!off) return null
    off.ctx.translate(STACK_PAD, 0)
    off.ctx.strokeStyle = CHALK
    off.ctx.lineWidth = 2
    off.ctx.lineJoin = 'round'
    off.ctx.lineCap = 'round'
    const [top, bottom] = columnRects({ x: 0, gapY, passed: false })
    drawStack(off.ctx, top, true, gapY)
    drawStack(off.ctx, bottom, false, gapY)
    // Only ~80 gaps exist and a run meets a dozen; the bound is for the player
    // who keeps hitting Try again all afternoon.
    if (stacks.size >= STACK_CACHE) stacks.clear()
    stacks.set(gapY, off.canvas)
    return off.canvas
  }

  function drawBird(ctx: CanvasRenderingContext2D, y: number, vy: number, t: number): void {
    ctx.save()
    ctx.translate(BIRD_X, y)
    // Nose up on the way up, nose down on the way down — the tilt is what makes
    // a circle read as a bird.
    ctx.rotate(Math.max(-0.45, Math.min(0.85, vy / 900)))
    ctx.strokeStyle = CHALK
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, FLAPPY.R, 0, Math.PI * 2)
    ctx.stroke()
    // the wing: a flapping arc, held still when motion is reduced
    const beat = reducedMotion() ? 0.6 : 0.6 + Math.sin(t / 90) * 0.5
    ctx.beginPath()
    ctx.arc(-2, 1, 7, Math.PI * beat, Math.PI * (beat + 0.9))
    ctx.stroke()
    // beak
    ctx.beginPath()
    ctx.moveTo(FLAPPY.R - 1, -2)
    ctx.lineTo(FLAPPY.R + 5, 0)
    ctx.lineTo(FLAPPY.R - 1, 2)
    ctx.stroke()
    // and the mortarboard, because this is the Education chapter's game
    ctx.beginPath()
    ctx.moveTo(-11, -8)
    ctx.lineTo(0, -15)
    ctx.lineTo(11, -8)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(9, -9)
    ctx.lineTo(12, -3)
    ctx.stroke()
    ctx.restore()
  }

  function draw(alpha: number): void {
    if (!surface) return
    const { ctx } = surface
    ctx.fillStyle = BOARD
    ctx.fillRect(0, 0, FLAPPY.W, FLAPPY.H)
    if (grain) ctx.drawImage(grain, 0, 0, FLAPPY.W, FLAPPY.H)

    // Every column translates by the same amount in a step, so winding them back
    // by the unspent part of the current step is exactly a lerp from where they
    // were — and needs no way of pairing this frame's columns with last frame's.
    const back = state.started && !state.dead ? (1 - alpha) * state.speed * (STEP_MS / 1000) : 0
    for (const c of state.cols) {
      const art = stackFor(c.gapY)
      if (art) ctx.drawImage(art, c.x + back - STACK_PAD, 0, FLAPPY.COL_W + STACK_PAD * 2, FLAPPY.FLOOR)
    }

    ctx.strokeStyle = CHALK_DIM
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.moveTo(0, FLAPPY.FLOOR)
    ctx.lineTo(FLAPPY.W, FLAPPY.FLOOR)
    ctx.stroke()
    ctx.setLineDash([])
    // two sticks of chalk resting in the tray below the line
    ctx.lineWidth = 5
    ctx.beginPath()
    for (let i = 0; i < 2; i++) {
      const x = 40 + i * 300
      ctx.moveTo(x, FLAPPY.FLOOR + 16)
      ctx.lineTo(x + 34, FLAPPY.FLOOR + 16)
    }
    ctx.stroke()

    drawBird(ctx, prev.y + (state.y - prev.y) * alpha, prev.vy + (state.vy - prev.vy) * alpha, state.t)

    if (!state.started) {
      ctx.fillStyle = CHALK_DIM
      ctx.font = '600 15px "Pixelify Sans", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('tap to flap', FLAPPY.W / 2, 84)
    }
  }

  function syncScore(): void {
    if (state.score === shown) return
    shown = state.score
    scoreEl.textContent = String(shown)
  }

  function stepOnce(): void {
    if (over) return
    prev = state
    state = step(state, STEP_MS)
    if (state.score !== shown) {
      syncScore()
      sfx.coin()
    }
    if (won(state)) finish()
    else if (state.dead) crash()
  }

  const loop = createLoop({ hz: HZ, step: stepOnce, draw })

  /** Park the board and put it back in the air on whatever state comes next. */
  function resume(next: FlappyState): void {
    state = next
    prev = next
    over = false
    syncScore()
    if (surface) loop.start()
  }

  function finish(): void {
    over = true
    loop.stop()
    // A beat to watch the tenth gap go by, then the chapter.
    winTimer = afterWin(() => host.close({ id: 'flappy', won: true, score: state.score }))
  }

  function crash(): void {
    over = true
    loop.stop()
    sfx.bump()
    host.gag({
      title: 'Bonk.',
      sub: `${state.score} of ${FLAPPY.WIN}.`,
      // A fresh board, one seed along: the run you just lost is not handed back.
      retry: () => resume(newFlappy(++seed)),
      // The lifeline keeps the score — that is the whole joke, and the mercy.
      hint: () => resume(revive(state)),
    })
  }

  function doFlap(): void {
    if (over || state.dead) return
    state = flap(state)
    sfx.hop()
  }

  // Element-scoped, never `core/keys`: the world is locked behind this dialog and
  // the panel layer reads its own DOM events.
  const FLAP_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'w', 'W'])
  const onKey = (e: KeyboardEvent): void => {
    // A held key is one flap, not sixty a second.
    if (e.repeat || !FLAP_KEYS.has(e.key)) return
    // A focused button owns its own Enter and Space — the modal layer clicks it
    // for us, so Space on Flap would flap twice, and Space on Leave would flap
    // on the way out of the game.
    if (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON') return
    // Space would otherwise scroll the dialog under the board.
    if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault()
    doFlap()
  }
  // The panel itself takes focus: the game surface is the control, and a key
  // pressed on a parent would never reach a listener down here. `data-autofocus`
  // is what brings focus back after the gag closes over it; the mount is past
  // the dialog's own first pass at focus, so it also asks directly.
  root.tabIndex = 0
  root.dataset.autofocus = ''
  root.addEventListener('keydown', onKey)
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'flap') doFlap()
    else if (act === 'quit' || t.closest('.modal-x')) host.quit()
  })
  surface?.canvas.addEventListener('pointerdown', (e) => {
    // Swallowed so the press cannot drag-select the panel or hand focus to the
    // canvas; the keys are listening on the root, which is where focus stays.
    e.preventDefault()
    root.focus({ preventScroll: true })
    doFlap()
  })

  root.focus({ preventScroll: true })
  if (surface) loop.start()

  /** Whole simulation steps, the way the loop would have run them. Tests only. */
  let owed = 0
  const __step = (ms: number): void => {
    owed += ms
    while (owed >= STEP_MS) {
      owed -= STEP_MS
      stepOnce()
    }
    draw(owed / STEP_MS)
  }

  return {
    score: () => state.score,
    // The tenth gap is banked the moment it goes by, but the close is a beat
    // behind it. Anything that shuts the dialog inside that beat — Leave, the
    // Esc confirm, the panel closed out from under the host — is still the win
    // it was, and without this the round would be recorded as a loss at ten.
    won: () => won(state),
    destroy() {
      loop.destroy()
      if (winTimer) window.clearTimeout(winTimer)
      root.removeEventListener('keydown', onKey)
      stacks.clear()
    },
    __step,
  }
}
