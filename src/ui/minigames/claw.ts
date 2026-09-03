// Prize Grab — Sol's claw machine, drawn over the reducer in `games/claw.ts`.
//
// Nothing here decides anything. The rules — where the claw may go, what a drop
// costs, what counts as a catch — are the reducer's; this file owns the cabinet:
// the enamel, the glass, the shelf, the cable, and the one button that drops the
// claw. It simulates on the shared 120 Hz fixed step and draws on rAF with the
// leftover as an interpolation alpha, which is the whole reason the sweep glides
// instead of stuttering at whatever rate the browser felt like today.
//
// The one piece of choreography that is genuinely this file's: a prize reaching
// the chute stops the loop, unlocks that chapter *quietly*, and opens the
// project's own card over the game. The round picks up where it left off when
// the card closes — so a catch reads as "here is the thing you won", not as a
// toast you might have blinked past.
import { sfx } from '../../audio/sfx'
import { events } from '../../core/events'
import { ZONES } from '../../data/content'
import { CLAW, type ClawState, type Prize, allCaught, drop, newClaw, newRound, refill, step } from '../../games/claw'
import { afterWin, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { accentOf, panelHead } from '../panels'
import { reducedMotion } from '../state'
import { makeCanvas } from './canvas'
import { mountReveal } from './reveal'
import { createLoop } from './loop'

/** The simulation's fixed step; the loop runs at the same rate. */
const MS = 1000 / 120

/**
 * What the tests drive the machine with. The rAF driver is inert under
 * happy-dom, so `__step` advances the same pipeline the loop would — catches,
 * gag and all — a whole number of fixed steps at a time.
 */
export type ClawSession = MinigameSession & { __step(ms: number): void }

/* ---------------- the shelf, as the cabinet shows it ---------------- */

/**
 * The three project boxes. Colours are each chapter's own accent from
 * `content.ts`, so the prize you grab is already the colour of the card that
 * opens; the label is the chapter's `short`, the same field the Journal's prize
 * shelf reads, so the box and the row can never disagree about what is on the
 * shelf. The stealth product is a mystery box and stays one: `content.ts`
 * labels it `???` exactly as it is unnamed everywhere else.
 */
const ICON: Record<string, string> = { lineage: '💳', safestride: '🚶', stealth: '🔒' }

const BOXES: Record<string, { label: string; color: string; ic: string }> = Object.fromEntries(
  ZONES.filter((z) => z.short !== undefined).map((z) => [z.id, { label: z.short!, color: accentOf(z), ic: ICON[z.id] ?? '' }]),
)

/** The cabinet's palette — fair-tent enamel, gold trim, dark glass. */
const C = {
  cab: '#7b2d3c',
  cabDark: '#571d29',
  cabLip: '#94394a',
  trim: '#ffc24b',
  glass: '#0c1322',
  wall: '#16233a',
  wallLine: '#1e2f4d',
  shelf: '#c98f52',
  shelfDark: '#8a5f34',
  steel: '#9fadc8',
  steelDark: '#5b6b86',
  cable: '#7f8ca6',
  dim: '#9fadc8',
  plush: '#ff9db1',
  plushDark: '#e07a91',
  chute: '#070b14',
}

/* ---------------- cabinet geometry, in the canvas's logical pixels ---------------- */

const GX = 20 // glass left edge
const GW = 600 // glass width — the rail's 0…1 maps onto this
const GTOP = 46 // glass top (under the marquee)
const GBOT = 356 // glass bottom (above the fascia)
const RAIL_Y = 64 // the bar the carriage rides along
const HEAD_TOP = 88 // claw head with y = 0
const HEAD_BOT = 240 // claw head with y = 1 — arms closed around a prize
const SHELF_Y = CLAW.SHELF_Y // 300: prizes stand on this line
const BOX_H = 54
const PLUSH_R = 20
/** Left of this the shelf gives way to the chute well. */
const CHUTE_EDGE = 104
/** How long the confetti over the chute lasts, once the card is out of the way. */
const BURST_MS = 900

/** Rail fraction → canvas x. */
const px = (fx: number): number => GX + fx * GW

/* ---------------- little drawing helpers ---------------- */

/** A rounded rectangle path, built by hand: `roundRect` is too new to rely on. */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function fillRRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.fillStyle = fill
  rrect(ctx, x, y, w, h, r)
  ctx.fill()
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = '600'): void {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px 'Pixelify Sans', 'Inter', system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}

/* ---------------- the cabinet ---------------- */

/** A project box: lid, ribbon, bow, and the shine down one edge. */
function drawBox(ctx: CanvasRenderingContext2D, cx: number, bottom: number, w: number, skin: { color: string; ic: string }): void {
  const x = cx - w / 2
  const y = bottom - BOX_H
  fillRRect(ctx, x, y, w, BOX_H, 5, skin.color)
  // the lid, a shade darker, and a highlight along the left edge
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#05131a'
  ctx.fillRect(x, y, w, 10)
  ctx.globalAlpha = 0.18
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + 3, y + 12, 4, BOX_H - 16)
  ctx.globalAlpha = 1
  // ribbon: one band down, one across, and a bow where they cross
  ctx.fillStyle = '#ff6b6b'
  ctx.fillRect(cx - 5, y, 10, BOX_H)
  ctx.fillRect(x, y + 20, w, 8)
  ctx.beginPath()
  ctx.arc(cx - 8, y + 24, 6, 0, Math.PI * 2)
  ctx.arc(cx + 8, y + 24, 6, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, skin.ic, cx, y + 42, 16, '#05131a')
}

/** A plushie: the thing you grab by mistake. */
function drawPlush(ctx: CanvasRenderingContext2D, cx: number, bottom: number): void {
  const cy = bottom - PLUSH_R
  ctx.fillStyle = C.plushDark
  ctx.beginPath()
  ctx.arc(cx - 12, cy - 14, 8, 0, Math.PI * 2)
  ctx.arc(cx + 12, cy - 14, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.plush
  ctx.beginPath()
  ctx.arc(cx, cy, PLUSH_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3a1620'
  ctx.beginPath()
  ctx.arc(cx - 7, cy - 3, 2.5, 0, Math.PI * 2)
  ctx.arc(cx + 7, cy - 3, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3a1620'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy + 3, 6, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
}

/**
 * Whatever the arms are around, hanging under the claw head. The offset is the
 * one that puts a prize back exactly where it stood when the claw is at the
 * bottom of its travel — anything else and the grab looks like the box sinking
 * through the shelf.
 */
function drawHeld(ctx: CanvasRenderingContext2D, p: Prize, cx: number, headY: number): void {
  const bottom = headY + (SHELF_Y - HEAD_BOT)
  if (p.decoy) drawPlush(ctx, cx, bottom)
  else drawBox(ctx, cx, bottom, p.w * GW, BOXES[p.id] ?? { color: C.steel, ic: '' })
}

/** The claw itself: carriage, cable, head and two arms, `open` from 0 to 1. */
function drawClaw(ctx: CanvasRenderingContext2D, cx: number, headY: number, open: number): void {
  ctx.fillStyle = C.steelDark
  ctx.fillRect(cx - 16, RAIL_Y - 7, 32, 12)
  ctx.fillStyle = C.steel
  ctx.fillRect(cx - 12, RAIL_Y - 5, 24, 5)
  ctx.strokeStyle = C.cable
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx, RAIL_Y + 4)
  ctx.lineTo(cx, headY)
  ctx.stroke()
  fillRRect(ctx, cx - 15, headY, 30, 14, 4, C.steel)
  fillRRect(ctx, cx - 6, headY - 6, 12, 8, 3, C.steelDark)
  // Two arms, mirrored: elbow out by `open`, then a hook back under the prize.
  const spread = 6 + open * 13
  ctx.strokeStyle = C.steel
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * 9, headY + 12)
    ctx.lineTo(cx + s * spread, headY + 24)
    ctx.lineTo(cx + s * (spread * 0.45), headY + 34)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

/** The marquee, the enamel and the fascia — everything outside the glass. */
function drawCabinet(ctx: CanvasRenderingContext2D, clock: number): void {
  ctx.fillStyle = C.cab
  ctx.fillRect(0, 0, CLAW.W, CLAW.H)
  ctx.fillStyle = C.cabDark
  ctx.fillRect(0, GTOP - 6, CLAW.W, 6)
  ctx.fillRect(0, GBOT, CLAW.W, 6)
  // marquee: a gold band of bulbs with the tent's name in the middle
  fillRRect(ctx, 12, 6, CLAW.W - 24, GTOP - 18, 8, C.cabLip)
  text(ctx, "SOL'S PRIZES", CLAW.W / 2, GTOP / 2 - 3, 18, C.trim, '700')
  for (let i = 0; i < 14; i++) {
    const on = Math.floor(clock / 420 + i) % 2 === 0
    ctx.fillStyle = on ? C.trim : '#6a4a1f'
    ctx.beginPath()
    ctx.arc(30 + i * 45, GTOP / 2 - 3, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
  // fascia: the prize door under the chute, a coin slot, and the button
  fillRRect(ctx, 26, GBOT + 12, 96, 30, 5, C.cabDark)
  text(ctx, 'PRIZES', 74, GBOT + 27, 11, C.trim)
  ctx.fillStyle = C.cabDark
  ctx.fillRect(CLAW.W - 150, GBOT + 20, 40, 6)
  fillRRect(ctx, CLAW.W - 84, GBOT + 10, 44, 34, 8, '#c0392b')
  fillRRect(ctx, CLAW.W - 80, GBOT + 13, 36, 22, 6, '#e05545')
  text(ctx, 'DROP', CLAW.W - 62, GBOT + 24, 10, '#3a0d08', '700')
}

/** Inside the glass: back wall, shelf, chute well and the banked prizes. */
function drawInterior(ctx: CanvasRenderingContext2D, s: ClawState): void {
  ctx.fillStyle = C.glass
  ctx.fillRect(GX, GTOP, GW, GBOT - GTOP)
  ctx.fillStyle = C.wall
  ctx.fillRect(GX, GTOP, GW, SHELF_Y - GTOP)
  ctx.fillStyle = C.wallLine
  for (let x = GX + 14; x < GX + GW; x += 40) ctx.fillRect(x, GTOP, 14, SHELF_Y - GTOP)
  // the rail the carriage hangs from
  ctx.fillStyle = C.steelDark
  ctx.fillRect(GX + 6, RAIL_Y - 3, GW - 12, 4)
  // the chute: a dark well at the left with a ramp down to the prize door
  ctx.fillStyle = C.chute
  ctx.fillRect(GX, SHELF_Y - 4, CHUTE_EDGE - GX, GBOT - SHELF_Y + 4)
  ctx.fillStyle = C.shelfDark
  ctx.beginPath()
  ctx.moveTo(GX, GBOT - 6)
  ctx.lineTo(CHUTE_EDGE, SHELF_Y + 26)
  ctx.lineTo(CHUTE_EDGE, GBOT - 6)
  ctx.closePath()
  ctx.fill()
  // the shelf itself
  ctx.fillStyle = C.shelf
  ctx.fillRect(CHUTE_EDGE, SHELF_Y - 4, GX + GW - CHUTE_EDGE, 10)
  ctx.fillStyle = C.shelfDark
  ctx.fillRect(CHUTE_EDGE, SHELF_Y + 6, GX + GW - CHUTE_EDGE, GBOT - SHELF_Y - 6)
  // what has already gone down: a small stack in the well
  let stacked = 0
  for (const p of s.prizes) {
    if (!p.caught) continue
    const skin = BOXES[p.id]
    if (!skin) continue
    fillRRect(ctx, 34 + stacked * 8, GBOT - 22 - stacked * 9, 34, 16, 3, skin.color)
    stacked++
  }
}

/** The prize tickets under the shelf edge — the labels the player is playing for. */
function drawTickets(ctx: CanvasRenderingContext2D, s: ClawState): void {
  for (const p of s.prizes) {
    const skin = BOXES[p.id]
    if (!skin) continue
    const cx = px(p.x)
    fillRRect(ctx, cx - 46, SHELF_Y + 12, 92, 20, 4, p.caught ? '#24344f' : '#111a2b')
    text(ctx, p.caught ? '✓ won' : skin.label, cx, SHELF_Y + 22, 11, p.caught ? C.dim : skin.color)
  }
}

/** The diagonal band of light across the glass; it drifts only if motion may. */
function drawGlare(ctx: CanvasRenderingContext2D, clock: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(GX, GTOP, GW, GBOT - GTOP)
  ctx.clip()
  const travel = GW + 260
  const at = GX - 200 + ((clock * 0.06) % travel)
  ctx.globalAlpha = 0.07
  ctx.fillStyle = '#ffffff'
  for (const [off, w] of [
    [0, 54],
    [76, 22],
  ]) {
    ctx.beginPath()
    ctx.moveTo(at + off, GTOP)
    ctx.lineTo(at + off + w, GTOP)
    ctx.lineTo(at + off + w - 120, GBOT)
    ctx.lineTo(at + off - 120, GBOT)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

/** A short, fixed spray of paper over the chute — never random, never on repeat. */
function drawBurst(ctx: CanvasRenderingContext2D, ms: number): void {
  const t = ms / BURST_MS
  ctx.globalAlpha = Math.max(0, 1 - t)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const r = 20 + t * 90 * (0.6 + (i % 5) * 0.14)
    ctx.fillStyle = [C.trim, '#ff6b6b', '#5eead4', '#eef3ff'][i % 4]
    ctx.fillRect(64 + Math.cos(a) * r, GBOT - 34 + Math.sin(a) * r * 0.7, 5, 5)
  }
  ctx.globalAlpha = 1
}

/* ---------------- the panel ---------------- */

export function mountClaw(host: MinigameHost, root: HTMLElement): ClawSession {
  let state = newClaw()
  /** The state one step back — the other end of every interpolated draw. */
  let prev = state
  /** True while a project card is up, or the gag, or the win beat. */
  let paused = false
  let dead = false
  let won = false
  let winTimer = 0
  /** Render-only clocks: the marquee/glare drift, and the confetti after a catch. */
  let clock = 0
  let burst = -1
  /** How open the arms are, chased rather than snapped so the grip reads. */
  let arm = 1
  let shownTokens = -1
  let shownCaught = -1
  const offs: Array<() => void> = []

  root.innerHTML =
    panelHead('Prize Grab', "SOL'S PRIZE TENT") +
    `<p class="mg-rule">One button. Drop the claw over a prize. Three prizes, three projects.</p>` +
    `<div class="mg-stats cw-stats">` +
    `<span class="mg-stat"><b data-cw="tokens">${CLAW.TOKENS}</b><small>tokens</small></span>` +
    `<span class="mg-stat"><b data-cw="prizes">0 / 3</b><small>prizes</small></span>` +
    `</div>` +
    `<div class="mg-board cw-board"></div>` +
    `<footer class="mg-foot">` +
    `<span class="mg-keys">Space / Enter — drop</span>` +
    `<button type="button" class="pbtn primary" data-act="drop">Drop</button>` +
    `<button type="button" class="pbtn" data-act="quit">Leave</button>` +
    `</footer>` +
    `<p class="cw-live sr-only" role="status"></p>`

  const board = root.querySelector<HTMLElement>('.cw-board')!
  const tokenEl = root.querySelector<HTMLElement>('[data-cw="tokens"]')!
  const prizeEl = root.querySelector<HTMLElement>('[data-cw="prizes"]')!
  const live = root.querySelector<HTMLElement>('.cw-live')!
  const { canvas, ctx } = makeCanvas(board, CLAW.W, CLAW.H, { pixelated: true, label: 'Claw machine' })
  /** Read once: a mid-round settings change is not reachable from inside a game. */
  const reduced = reducedMotion()

  // The panel takes the keys itself, so a player can press Space the moment the
  // cabinet opens without hunting for something to focus first.
  root.tabIndex = 0
  root.dataset.autofocus = ''

  const say = (msg: string): void => {
    live.textContent = msg
  }

  /* ---------------- drawing ---------------- */

  function render(x: number, y: number): void {
    const headY = HEAD_TOP + y * (HEAD_BOT - HEAD_TOP)
    const cx = px(x)
    drawCabinet(ctx, clock)
    drawInterior(ctx, state)
    for (const p of state.prizes) {
      if (p.caught || p.id === state.holding) continue
      if (p.decoy) drawPlush(ctx, px(p.x), SHELF_Y)
      else drawBox(ctx, px(p.x), SHELF_Y, p.w * GW, BOXES[p.id] ?? { color: C.steel, ic: '' })
    }
    drawTickets(ctx, state)
    const held = state.holding ? state.prizes.find((p) => p.id === state.holding) : null
    if (held) drawHeld(ctx, held, cx, headY)
    drawClaw(ctx, cx, headY, arm)
    if (burst >= 0) drawBurst(ctx, burst)
    if (!reduced) drawGlare(ctx, clock)
  }

  const draw = (alpha: number): void => {
    render(prev.x + (state.x - prev.x) * alpha, prev.y + (state.y - prev.y) * alpha)
  }

  /* ---------------- the panel's own state ---------------- */

  function syncStats(): void {
    if (shownTokens !== state.tokens) {
      shownTokens = state.tokens
      tokenEl.textContent = String(state.tokens)
    }
    if (shownCaught !== state.caught) {
      shownCaught = state.caught
      prizeEl.textContent = `${state.caught} / 3`
    }
  }

  function pause(): void {
    paused = true
    loop.stop()
  }

  /**
   * Pick the round back up — after a card, a retry or a lifeline. Everything
   * that could have ended the round while the loop was stopped is checked here,
   * in the order the player would expect to hear it: the win, then the empty
   * purse, then simply carrying on.
   */
  function resume(): void {
    if (dead) return
    paused = false
    prev = state
    syncStats()
    if (allCaught(state)) {
      winRound()
      return
    }
    if (state.tokens <= 0) {
      outOfTokens()
      return
    }
    loop.start()
  }

  function winRound(): void {
    if (won || dead) return
    won = true
    pause()
    winTimer = afterWin(() => host.close({ id: 'claw', won: true, score: 3 }))
  }

  function outOfTokens(): void {
    pause()
    host.gag({
      title: 'Out of tokens.',
      sub: 'The claw is honest. Mostly.',
      // A retry is a fresh six tokens, not a fresh shelf: a chapter already won
      // stays won, and the rail keeps the speed those catches bought it.
      retry: () => {
        state = newRound(state)
        resume()
      },
      hint: () => {
        state = refill(state, 2)
        resume()
      },
    })
  }

  /**
   * A prize has reached the chute. Credit the chapter *quietly* — `announce`
   * false, so the panel layer does not queue a second copy of the card — and
   * then open that project's card over the paused cabinet. The next `ui:closed`
   * for that card, and only that card, starts the machine again.
   */
  function onCatch(id: Prize['id']): void {
    state = { ...state, justCaught: null }
    pause()
    burst = reduced ? -1 : 0
    sfx.chest()
    const zone = ZONES.find((z) => z.id === id)
    say(`Caught: ${zone?.label ?? 'prize'} — ${state.caught} of 3.`)
    host.unlockFacet(id, false)
    showCard(id, resume)
  }

  /**
   * Open one project's card over the paused cabinet, and do `then` when *that*
   * card closes — never on somebody else's `ui:closed`, which is why the modal
   * id is checked and the listener unsubscribes itself.
   */
  function showCard(id: Prize['id'], then: () => void): void {
    const zone = ZONES.find((z) => z.id === id)
    const modalId = `zone:${id}`
    const off = events.on('ui:closed', (e) => {
      if (e.id !== modalId) return
      off()
      const i = offs.indexOf(off)
      if (i >= 0) offs.splice(i, 1)
      then()
    })
    offs.push(off)
    if (zone) events.emit('ui:toast', { kind: 'ach', icon: '🎁', title: zone.content.title })
    events.emit('ui:panel', { id: modalId })
  }

  /**
   * "Just show me the prizes." Every project still on the shelf is handed over
   * quietly and its card opened, one after another — the same beat as three
   * catches, without the six tokens. The round closes as a win when the last
   * card is shut, which is also what a played-out win does.
   */
  function revealAll(): boolean | void {
    if (dead || won) return false
    pause()
    const owed = state.prizes.filter((p) => !p.decoy && !p.caught).map((p) => p.id)
    for (const id of owed) host.unlockFacet(id, false)
    const all = state.prizes.filter((p) => !p.decoy).length
    state = { ...state, prizes: state.prizes.map((p) => (p.decoy ? p : { ...p, caught: true })), caught: all, justCaught: null }
    syncStats()
    say('The shelf is yours. Every project on it.')
    // One card at a time, in shelf order, each waiting on the one before it.
    const next = (): void => {
      const id = owed.shift()
      if (id) showCard(id, next)
      else winRound()
    }
    next()
  }

  /** One fixed step of the machine, plus everything the cabinet does about it. */
  function tick(): void {
    if (paused || dead) return
    prev = state
    state = step(state, MS)
    const target = state.phase === 'sweep' || state.phase === 'drop' || state.phase === 'release' ? 1 : 0
    arm += (target - arm) * 0.25
    if (!reduced) clock += MS
    if (burst >= 0) {
      burst += MS
      if (burst > BURST_MS) burst = -1
    }
    if (state.phase !== prev.phase) {
      if (state.phase === 'grab') {
        if (state.holding) sfx.pickup()
        else sfx.bump()
      } else if (state.phase === 'sweep' && prev.phase === 'rise') {
        say(prev.holding ? 'The plushie slips off on the way up.' : `Empty. ${state.tokens} tokens left.`)
      }
    }
    syncStats()
    if (state.justCaught) {
      onCatch(state.justCaught)
      return
    }
    // The purse ran dry and the shelf still has projects on it: that is the gag,
    // and it waits until the claw is back at rest so it never lands mid-grab.
    if (state.phase === 'sweep' && prev.phase !== 'sweep' && state.tokens <= 0) outOfTokens()
  }

  const loop = createLoop({ step: tick, draw })

  /* ---------------- input: one button, however it is pressed ---------------- */

  function press(): void {
    if (dead || paused) return
    const next = drop(state)
    if (next === state) {
      // Mid-grab presses are free and silent; an empty purse is worth saying.
      if (state.phase === 'sweep' && state.tokens <= 0) outOfTokens()
      return
    }
    state = next
    prev = next
    syncStats()
    sfx.blip()
  }

  root.addEventListener('keydown', (e) => {
    if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
    // A focused button owns its own Enter and Space — the modal layer clicks it
    // for us, and pressing here as well would spend two tokens on one press.
    if (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON') return
    e.preventDefault()
    press()
  })
  canvas.addEventListener('pointerdown', () => press())
  root.querySelector('[data-act="drop"]')?.addEventListener('click', () => press())
  root.querySelector('[data-act="quit"]')?.addEventListener('click', () => host.quit())
  mountReveal(root, 'Just show me the prizes', revealAll)

  render(state.x, state.y)
  loop.start()

  return {
    score: () => state.caught,
    won: () => allCaught(state),
    destroy: () => {
      dead = true
      window.clearTimeout(winTimer)
      for (const off of offs.splice(0)) off()
      loop.destroy()
    },
    __step: (ms: number) => {
      const n = Math.round(ms / MS)
      for (let i = 0; i < n && !paused && !dead; i++) tick()
    },
  }
}
