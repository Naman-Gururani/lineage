// Tower Climb — the scaffold up the outside of Barclays Tower, three floors of
// it. All the physics and every stage live in src/games/climb.ts; this file is
// the picture: one `<canvas>` in the mini-game panel, a fixed 60 Hz tick, and
// the atlas's own hero frames drawn side-on.
//
// **Why a canvas and not a Phaser mini-scene.** The plan asked for a small
// Phaser scene over the interior, and that cannot work as drawn: the mini-game
// host mounts a *DOM* panel inside `.modal`, which is a full-inset scrim at
// `z-index: 100` over the game canvas — a scene launched on the running game
// would render underneath it, unseen. The alternatives were a second
// `Phaser.Game` parented into the panel (a second WebGL context, and a second
// 4096² atlas build — the thing BootScene shows a loading bar for) or this: a
// canvas in the panel, the same shape as every other renderer here, drawing
// atlas frames through `frameDataURL`. The Engine console (`ui/lineage.ts`) is
// the precedent. The pure module stays authoritative either way: nothing below
// decides anything about the climb, it only draws what `climbStep` returns.
import { frameDataURL } from '../../art/atlas'
import { sfx } from '../../audio/sfx'
import {
  CLIMB,
  CLIMB_BODY,
  CLIMB_CAPTIONS,
  CLIMB_STAGES,
  CLIMB_TILE,
  climbInit,
  climbStep,
  platformRects,
  type ClimbInput,
  type ClimbState,
} from '../../games/climb'
import { afterWin, registerMinigame, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { esc } from '../modal'
import { panelHead } from '../panels'
import { reducedMotion } from '../state'

/** The tick: fixed, and the same one the physics tests drive the reducer at. */
export const CLIMB_TICK_MS = 1000 / 60
/** Backing-store scale — the stage is drawn in climb units and blown up crisply. */
const SCALE = 2
/** How long a checkpoint caption stays up, in seconds. */
const CAPTION_S = 2.6
/** What the scaffold says when the pavement wins. */
export const CLIMB_GAG_TITLE = 'The corner office stays corner-less — today.'

const SKY = '#141a2e'
const SKY_LOW = '#232a45'
const GIRDER = '#54607f'
const GIRDER_TOP = '#7d8bad'
const GIRDER_DARK = '#38415c'
const SPIKE = '#e2483f'
const SPIKE_DARK = '#8e2a26'
const HOIST = '#f28c28'
const HOIST_DARK = '#a55c14'
const FLAG = '#5eead4'
const DOOR = '#ffd23f'
const RIVET = '#9fb0d6'

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A'])
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D'])
const JUMP_KEYS = new Set(['ArrowUp', 'w', 'W', ' ', 'Spacebar', 'z', 'Z'])

/** One atlas frame, ready to blit — or null when the atlas has not been built. */
function sprite(name: string): HTMLImageElement | null {
  const url = frameDataURL(name, 1)
  if (!url) return null
  const img = new Image()
  img.src = url
  return img
}

export function mountClimb(host: MinigameHost, root: HTMLElement): MinigameSession {
  const cols = CLIMB_STAGES[0].rows[0].length
  const rows = CLIMB_STAGES[0].rows.length
  const W = cols * CLIMB_TILE
  const H = rows * CLIMB_TILE

  root.innerHTML = `
    ${panelHead('Tower Climb', 'BARCLAYS TOWER')}
    <p class="mg-rule">The lift is out. Three floors of scaffold, ${CLIMB.MAX_FALLS} falls between you and the pavement — the flags save your place.</p>
    <div class="mg-stats">
      <span class="mg-stat"><b data-f="floor">1</b><small>of ${CLIMB_STAGES.length} floors</small></span>
      <span class="mg-stat"><b data-f="falls">${CLIMB.MAX_FALLS}</b><small>falls left</small></span>
      <span class="mg-stat cl-caption"><b data-f="caption">${esc(CLIMB_CAPTIONS[0])}</b></span>
    </div>
    <div class="mg-board card">
      <div class="cl-frame">
        <canvas class="cl-canvas" width="${W * SCALE}" height="${H * SCALE}" role="img" aria-label="The scaffold"></canvas>
        <div class="cl-flash" aria-hidden="true"></div>
      </div>
    </div>
    <p class="mg-live sr-only" role="status" aria-live="polite"></p>
    <footer class="mg-foot">
      <div class="mg-pad cl-pad" role="group" aria-label="Climb">
        <button type="button" class="mg-padbtn left" data-hold="left" aria-label="Move left">←</button>
        <button type="button" class="mg-padbtn right" data-hold="right" aria-label="Move right">→</button>
        <button type="button" class="mg-padbtn up cl-jump" data-hold="jump" aria-label="Jump">⤒</button>
      </div>
      <span class="mg-keys"><kbd>←</kbd><kbd>→</kbd> move · <kbd>Space</kbd> jump · <kbd>R</kbd> restart floor</span>
      <button type="button" class="pbtn" data-act="quit">Leave</button>
    </footer>`

  const canvas = root.querySelector('.cl-canvas') as HTMLCanvasElement
  const flash = root.querySelector('.cl-flash') as HTMLElement
  const live = root.querySelector('.mg-live') as HTMLElement
  const f = (name: string) => root.querySelector(`[data-f="${name}"]`) as HTMLElement
  const ctx = canvas.getContext('2d')

  const art = {
    idle: sprite('hero_idle_down'),
    hopUp: sprite('hero_hop_0'),
    hopDown: sprite('hero_hop_1'),
    left: [0, 1, 2, 3].map((i) => sprite(`hero_walk_left_${i}`)),
    right: [0, 1, 2, 3].map((i) => sprite(`hero_walk_right_${i}`)),
  }

  let at = 0
  let cleared = 0
  let state: ClimbState = climbInit(CLIMB_STAGES[0], 0)
  let held = { left: false, right: false, jump: false }
  /** a fresh press waiting to be handed to the reducer as an edge */
  let queued = false
  let facing: 1 | -1 = 1
  let captionUntil = 0
  let timer = 0
  let winTimer = 0
  let done = false

  const say = (text: string) => (live.textContent = text)
  const stageData = () => CLIMB_STAGES[at]

  /* ---------------- drawing ---------------- */

  function drawStage() {
    if (!ctx) return
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, SKY)
    grad.addColorStop(1, SKY_LOW)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    // the city behind the scaffold: a flat skyline, no motion of its own
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    for (let i = 0; i < cols; i += 2) ctx.fillRect(i * CLIMB_TILE + 3, H - 28 - ((i * 37) % 46), CLIMB_TILE - 6, 90)

    const data = stageData()
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const ch = data.rows[r][c]
        const x = c * CLIMB_TILE
        const y = r * CLIMB_TILE
        if (ch === '#') {
          ctx.fillStyle = GIRDER
          ctx.fillRect(x, y, CLIMB_TILE, CLIMB_TILE)
          ctx.fillStyle = GIRDER_TOP
          ctx.fillRect(x, y, CLIMB_TILE, 3)
          ctx.fillStyle = GIRDER_DARK
          ctx.fillRect(x, y + CLIMB_TILE - 2, CLIMB_TILE, 2)
          ctx.fillStyle = RIVET
          ctx.fillRect(x + 3, y + 7, 2, 2)
          ctx.fillRect(x + CLIMB_TILE - 5, y + 7, 2, 2)
        } else if (ch === '^') {
          ctx.fillStyle = SPIKE_DARK
          ctx.fillRect(x, y + CLIMB_TILE - 4, CLIMB_TILE, 4)
          ctx.fillStyle = SPIKE
          for (let i = 0; i < 3; i++) {
            const sx = x + 1 + i * 6.5
            ctx.beginPath()
            ctx.moveTo(sx, y + CLIMB_TILE - 3)
            ctx.lineTo(sx + 3, y + 5)
            ctx.lineTo(sx + 6, y + CLIMB_TILE - 3)
            ctx.closePath()
            ctx.fill()
          }
        } else if (ch === 'C') {
          const banked = state.cx === (c + 0.5) * CLIMB_TILE && state.cy === (r + 1) * CLIMB_TILE
          ctx.fillStyle = GIRDER_TOP
          ctx.fillRect(x + 4, y + 3, 2, CLIMB_TILE - 4)
          ctx.fillStyle = banked ? FLAG : 'rgba(94,234,212,0.35)'
          ctx.beginPath()
          ctx.moveTo(x + 6, y + 3)
          ctx.lineTo(x + 15, y + 7)
          ctx.lineTo(x + 6, y + 11)
          ctx.closePath()
          ctx.fill()
        } else if (ch === 'E') {
          ctx.fillStyle = DOOR
          ctx.fillRect(x + 2, y + 2, CLIMB_TILE - 4, CLIMB_TILE - 2)
          ctx.fillStyle = SKY
          ctx.fillRect(x + 5, y + 6, CLIMB_TILE - 10, CLIMB_TILE - 6)
          ctx.fillStyle = DOOR
          ctx.fillRect(x + CLIMB_TILE - 8, y + 12, 2, 2)
        }
      }

    for (const p of platformRects(data, state.t)) {
      ctx.fillStyle = HOIST
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.fillStyle = HOIST_DARK
      ctx.fillRect(p.x, p.y + p.h - 2, p.w, 2)
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(p.x + 3, p.y + 2, p.w - 6, 1)
    }

    drawHero()
  }

  function drawHero() {
    if (!ctx) return
    const airborne = !state.grounded
    const walking = state.vx !== 0
    const frame = airborne
      ? state.vy < 0
        ? art.hopUp
        : art.hopDown
      : walking
        ? (facing === 1 ? art.right : art.left)[Math.floor(state.t * 8) % 4]
        : art.idle
    const w = 20
    const h = 30
    const x = Math.round(state.x - w / 2)
    const y = Math.round(state.y - h)
    if (frame && frame.complete && frame.naturalWidth) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(frame, x, y, w, h)
      return
    }
    // No atlas (or it has not decoded yet): a plain marker, so the climb is
    // always playable rather than invisible.
    ctx.fillStyle = '#ffd23f'
    ctx.fillRect(state.x - CLIMB_BODY.hw, state.y - CLIMB_BODY.h, CLIMB_BODY.hw * 2, CLIMB_BODY.h)
    ctx.fillStyle = '#1b1a2e'
    ctx.fillRect(state.x - 3, state.y - CLIMB_BODY.h + 4, 6, 3)
  }

  function paintStats() {
    f('floor').textContent = String(at + 1)
    f('falls').textContent = String(CLIMB.MAX_FALLS - state.falls)
    const caption = f('caption')
    caption.textContent = CLIMB_CAPTIONS[at] ?? ''
    // A banked flag lights its floor's caption for a beat — a colour change, not
    // a movement, so it reads the same with motion reduced.
    caption.classList.toggle('lit', captionUntil > 0)
    canvas.setAttribute('aria-label', `Floor ${at + 1} of ${CLIMB_STAGES.length}. ${CLIMB.MAX_FALLS - state.falls} falls left.`)
  }

  /* ---------------- the loop ---------------- */

  function stop() {
    window.clearInterval(timer)
    timer = 0
  }

  function start() {
    stop()
    timer = window.setInterval(tick, CLIMB_TICK_MS)
  }

  function tick() {
    if (done) return
    const inp: ClimbInput = { left: held.left, right: held.right, jump: queued }
    queued = false
    if (held.left !== held.right) facing = held.right ? 1 : -1
    const before = state
    state = climbStep(state, inp, CLIMB_TICK_MS / 1000, stageData())
    if (state.vy === CLIMB.JUMP_V && before.vy !== CLIMB.JUMP_V) sfx.hop()
    if (state.falls > before.falls) onFall()
    if (state.atCheckpoint) {
      sfx.pickup()
      captionUntil = state.t + CAPTION_S
      say(`Checkpoint — ${CLIMB_CAPTIONS[at]}.`)
    }
    if (captionUntil && state.t > captionUntil) captionUntil = 0
    drawStage()
    paintStats()
    if (state.over) return lose()
    if (state.done) return advance()
  }

  function onFall() {
    sfx.bump()
    say(`Fell. ${CLIMB.MAX_FALLS - state.falls} left.`)
    // Reduced motion: no flash, no shake — the counter says it instead.
    if (reducedMotion()) return
    flash.classList.remove('on')
    void flash.offsetWidth
    flash.classList.add('on')
  }

  function advance() {
    stop()
    cleared = at + 1
    if (at + 1 < CLIMB_STAGES.length) {
      sfx.chest()
      say(`Floor ${at + 1} clear. ${CLIMB_CAPTIONS[at + 1]}.`)
      winTimer = afterWin(() => {
        at += 1
        state = climbInit(CLIMB_STAGES[at], at, state.falls)
        drawStage()
        paintStats()
        start()
      })
      return
    }
    done = true
    sfx.levelup()
    say('The roof. Some view.')
    winTimer = afterWin(() => host.close({ id: 'climb', won: true, score: CLIMB_STAGES.length }))
  }

  function lose() {
    stop()
    sfx.back()
    say('Out of falls.')
    host.gag({
      title: CLIMB_GAG_TITLE,
      sub: `Floor ${at + 1} of ${CLIMB_STAGES.length}, and the pavement won. One more go at it?`,
      hint: reprieve,
      retry: restartRun,
    })
  }

  /** From the pavement up: a fresh climb, all three falls back. */
  function restartRun() {
    at = 0
    cleared = 0
    state = climbInit(CLIMB_STAGES[0], 0)
    say(`Floor 1 of ${CLIMB_STAGES.length}. ${CLIMB_CAPTIONS[0]}.`)
    drawStage()
    paintStats()
    start()
  }

  /** Hire me: one fall back, and you carry on from the last flag. */
  function reprieve() {
    state = { ...state, falls: CLIMB.MAX_FALLS - 1, over: false, x: state.cx, y: state.cy, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0 }
    say('One more fall in hand.')
    drawStage()
    paintStats()
    start()
  }

  /** Start this floor again, keeping the falls already taken. */
  function restart() {
    state = climbInit(stageData(), at, Math.min(state.falls, CLIMB.MAX_FALLS - 1))
    say(`Floor ${at + 1}, from the bottom.`)
    drawStage()
    paintStats()
    start()
  }

  /* ---------------- input ---------------- */

  const setHold = (k: 'left' | 'right' | 'jump', on: boolean) => {
    if (k === 'jump') {
      if (on && !held.jump) queued = true
      held.jump = on
      return
    }
    held[k] = on
  }

  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (LEFT_KEYS.has(e.key)) setHold('left', true)
    else if (RIGHT_KEYS.has(e.key)) setHold('right', true)
    else if (JUMP_KEYS.has(e.key)) setHold('jump', true)
    else if (e.key === 'r' || e.key === 'R') {
      if (e.repeat) return
      e.preventDefault()
      return restart()
    } else return
    e.preventDefault()
  })

  root.addEventListener('keyup', (e) => {
    if (LEFT_KEYS.has(e.key)) setHold('left', false)
    else if (RIGHT_KEYS.has(e.key)) setHold('right', false)
    else if (JUMP_KEYS.has(e.key)) setHold('jump', false)
  })

  // The on-screen pad: pointer down/up, so a thumb can hold a direction.
  for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-hold]'))) {
    const k = btn.dataset.hold as 'left' | 'right' | 'jump'
    const on = (e: Event) => {
      e.preventDefault()
      setHold(k, true)
    }
    const off = () => setHold(k, false)
    btn.addEventListener('pointerdown', on)
    btn.addEventListener('pointerup', off)
    btn.addEventListener('pointerleave', off)
    btn.addEventListener('pointercancel', off)
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'quit' || target.closest('.modal-x')) host.quit()
  })

  canvas.tabIndex = 0
  canvas.dataset.autofocus = ''
  canvas.focus({ preventScroll: true })
  drawStage()
  paintStats()
  say(`Floor 1 of ${CLIMB_STAGES.length}. ${CLIMB_CAPTIONS[0]}.`)
  start()

  return {
    // Floors cleared. The errand behind this cabinet is a yes/no — "did you
    // reach the roof?" — so `GameState` credits it from a win alone and this
    // number can say honestly how far the run got without ever finishing it.
    score: () => cleared,
    // The roof is reached the instant the last floor clears, but the close is a
    // beat later. Anything that shuts the dialog inside that beat must still
    // record the climb as won, or the cap, the badge and the errand all vanish.
    won: () => done,
    destroy: () => {
      stop()
      window.clearTimeout(winTimer)
    },
  }
}

export function initClimb(): void {
  registerMinigame('climb', mountClimb)
}
