// Crew Drop — the cabinet in Mira's arcade: a canvas, four keys, a d-pad.
//
// Every rule lives in `games/crew.ts`; this file is the shell around it. It
// simulates on the shared fixed step (120 Hz, `ui/minigames/loop.ts`) and draws
// on whatever frames the browser hands out, interpolating each hop by the
// fraction of it left — which is the whole difference between beans that glide
// and beans that stutter at the step rate.
import { CREW, newCrew, revive, step, tryMove, type Bean, type CrewState, type Dir } from '../../games/crew'
import { events } from '../../core/events'
import { afterWin, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { panelHead } from '../panels'
import { reducedMotion } from '../state'
import { makeCanvas } from './canvas'
import { createLoop } from './loop'
import { mountPad } from './pad'
import { mountReveal } from './reveal'

/** The simulation's own clock; the draw interpolates inside one of these. */
const HZ = 120
const STEP_MS = 1000 / HZ

/**
 * Logical canvas: twelve tiles across, eight down, with a margin around the
 * deck. The tile is sized to the deck rather than the other way round — the
 * canvas is the panel's, fixed at this ratio, so a bigger deck means smaller
 * tiles. Twelve by eight at forty-eight by forty-two leaves a clean margin on
 * every side: room above for the beans' name tags, room below for the pips.
 */
const VIEW_W = 640
const VIEW_H = 420
const TW = 48
const TH = 42
const OX = (VIEW_W - TW * CREW.W) / 2
const OY = (VIEW_H - TH * CREW.H) / 2
/** the tile's front face, the bit that reads as thickness */
const LIP = 9
/** the hairline between tiles */
const GAP = 2

/** How high a hop arcs, and how far a falling bean sinks before it is gone. */
const HOP_LIFT = 13
const FALL_MS = 400
const FALL_DROP = 18

/** The crewmate, drawn at scale one: what the tags hang above. */
const BEAN_W = 22
const BEAN_H = 28

const VOID = '#080b12'
const TOP = '#4a6480'
const TOP_DEAD = '#3a4353'
const TOP_EDGE = '#6b8aa8'
const LIP_COL = '#22364a'
const CRACK = '#101823'
const PIT = '#05070c'
const PIT_RIM = '#111a26'
const OUTLINE = '#101722'
const VISOR = '#c6e8ff'
const VISOR_LIT = '#f2fbff'
/** The panel's own accent (`--accent`), spelled out: a canvas cannot read tokens. */
const ACCENT = '#5eead4'

/**
 * The held board's two lines: who you are, and how to start. No numerals, and
 * no clock behind either of them.
 */
const WHO = 'you are the coral bean under the YOU tag'
const READY = 'ready — press a key or tap the pad'

/** You are the island's coral; the crew are the four colours everyone expects. */
const COLOURS: Record<Bean['id'], string> = {
  you: '#ff7a59',
  bot0: '#d9433c',
  bot1: '#4a86d8',
  bot2: '#46ad61',
  bot3: '#e5c341',
}

/**
 * Who is who, over their heads all round. The four bots are the other people
 * at Mira's cabinet, so they get the fair's own first names rather than a
 * number each — spelled out here rather than imported, because a renderer that
 * reached into the dialogue data for four strings would tie the arcade to the
 * island's cast for no gain.
 */
const NAMES: Record<Bean['id'], string> = {
  you: 'YOU',
  bot0: 'Sol',
  bot1: 'Ravi',
  bot2: 'Pip',
  bot3: 'Mira',
}

const KEYS: Record<string, Dir> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

/** What the cabinet hands back: the host's contract, plus the seams the tests drive. */
export type CrewSession = MinigameSession & {
  /** one for the round you won, nought for the round you were dropped out of */
  score(): number
  /** advance the simulation by `ms`, exactly as the loop would */
  __step(ms: number): void
  /** the live board, for assertions the DOM cannot make */
  __state(): CrewState
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Blend two hex colours — the floor greys out as its crack runs down. */
function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const t = clamp01(k)
  return `rgb(${Math.round(lerp(r1, r2, t))},${Math.round(lerp(g1, g2, t))},${Math.round(lerp(b1, b2, t))})`
}

/** A darker (k < 1) or lighter (k > 1) shade of one colour. */
function shade(hex: string, k: number): string {
  const [r, g, b] = rgb(hex)
  const f = (n: number) => Math.max(0, Math.min(255, Math.round(n * k)))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: number, bottom: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y + h - bottom)
  ctx.quadraticCurveTo(x, y + h, x + bottom, y + h)
  ctx.lineTo(x + w - bottom, y + h)
  ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - bottom)
  ctx.lineTo(x + w, y + top)
  ctx.quadraticCurveTo(x + w, y, x + w - top, y)
  ctx.lineTo(x + top, y)
  ctx.quadraticCurveTo(x, y, x, y + top)
  ctx.closePath()
}

export function mountCrew(host: MinigameHost, root: HTMLElement): CrewSession {
  // A different crew every visit: the seed is the round's whole memory, and
  // "Try again" walks it on by one.
  let seed = (Date.now() % 100000) + 1
  let state = newCrew(seed)

  /** The renderer's own clock. It keeps running after the round ends, so the
   *  last bean's fall plays out instead of freezing mid-air. */
  let clock = 0
  /**
   * The press waiting for the bean to land. There is no expiry window on it and
   * it needs none: a press is only ever held while a hop is in the air, and a
   * hop is a sixth of a second — far inside the window a buffer would have
   * used, so a held press is never a stale one.
   */
  let pending: Dir | null = null
  /** when each bean fell, by the renderer's clock — drives the shrink and fade */
  const fell = new Map<Bean['id'], number>()
  /** the clock reading the round ended on, and whether it has been reported */
  let endAt: number | null = null
  let settled = false
  let winTimer = 0
  let torn = false
  /**
   * Whether the round has actually started. The floor begins cracking under
   * whoever stands on it, so a board that ages from the moment the panel mounts
   * spends the player's first seconds — the ones they need to read the rule and
   * find the keys — dropping them through it. Nothing ticks until the first
   * press; after that the round is the round.
   */
  let begun = false

  root.innerHTML =
    panelHead('Crew Drop', 'GAME ROW') +
    `<p class="mg-rule">The floor gives way wherever you stand. Keep moving. You're the coral bean under the YOU tag, and the last bean standing wins.</p>` +
    `<div class="mg-board cd-board"></div>` +
    `<footer class="mg-foot">` +
    `<span class="mg-keys cd-keys">Hop with the arrow keys, or W A S D.</span>` +
    `<div class="cd-pad"></div>` +
    `<button type="button" class="pbtn" data-act="quit">Leave</button>` +
    `</footer>`

  const surface = makeCanvas(root.querySelector<HTMLElement>('.cd-board') ?? root, VIEW_W, VIEW_H, {
    pixelated: true,
    label: 'Dropping floor — you are the coral bean, the four named beans are the crew',
  })
  const ctx = surface.ctx

  // Always mounted, shown by CSS only where there is a thumb to press it.
  mountPad(root.querySelector<HTMLElement>('.cd-pad') ?? root, (d) => press(d))

  root.querySelector('[data-act="quit"]')?.addEventListener('click', () => host.quit())
  // "Skip this one" reveals nothing, because the arcade guards nothing: the
  // round simply ends, and the cap — which is for playing — stays on its hook.
  mountReveal(root, 'Skip this one', () => {
    events.emit('ui:toast', { kind: 'info', icon: '🧢', title: 'No hat for peeking.' })
    host.quit()
  })

  // Keys are scoped to the panel, never to the window: the world behind the
  // modal has its own idea of what W means.
  root.tabIndex = 0
  root.dataset.autofocus = ''
  root.addEventListener('keydown', onKey)
  // The modal chose where focus went before this renderer existed, so take it
  // back; `data-autofocus` is what brings it home again when the gag closes.
  root.focus({ preventScroll: true })

  function onKey(e: KeyboardEvent): void {
    // Held keys would fire at the OS repeat rate, which is neither the hop rate
    // nor a rhythm anybody chose.
    if (e.repeat) return
    const dir = KEYS[e.key.toLowerCase()]
    if (!dir) return
    e.preventDefault()
    press(dir)
  }

  /** Every input arrives here — the keys and the d-pad both — so the first of
   *  them starts the clock whichever way the player reached for it. */
  function press(dir: Dir): void {
    begun = true
    pending = dir
  }

  const fallMs = (): number => (reducedMotion() ? 0 : FALL_MS)

  /** Start over on a fresh board — or on the one the lifeline just re-opened. */
  function restart(next: CrewState): void {
    state = next
    fell.clear()
    for (const b of state.beans) if (!b.alive) fell.set(b.id, clock - FALL_MS)
    pending = null
    endAt = null
    settled = false
    // A new board waits for you too: a gag dismissed with the mouse leaves the
    // hands nowhere near the keys.
    begun = false
  }

  /** One fixed step: the buffered press, the simulation, the bookkeeping. */
  function slice(dt: number): void {
    if (!begun) return
    if (state.status === 'play') {
      const you = state.beans.find((b) => b.id === 'you')
      if (pending && you && you.alive && you.moveT === 0) {
        state = tryMove(state, 'you', pending)
        pending = null
      }
      clock += dt
      state = step(state, dt)
      for (const b of state.beans) if (!b.alive && !fell.has(b.id)) fell.set(b.id, clock)
      if (state.status !== 'play') endAt = clock
    } else {
      clock += dt
    }
    if (endAt !== null && !settled && clock - endAt >= fallMs()) {
      settled = true
      settle()
    }
  }

  /** Advance in whole steps, however lumpy the caller's milliseconds are. */
  function advance(ms: number): void {
    if (torn || !(ms > 0)) return
    let left = ms
    while (left > 0 && !torn) {
      const dt = Math.min(left, STEP_MS)
      slice(dt)
      left -= dt
    }
  }

  /** The round is over and the fall has played: pay out, or offer the way back. */
  function settle(): void {
    if (state.status === 'won') {
      winTimer = afterWin(() => host.close({ id: 'crew', won: true, score: 1 }))
      return
    }
    host.gag({
      title: 'You were ejected.',
      sub: 'Naman was not the impostor.',
      retry: () => {
        seed += 1
        restart(newCrew(seed))
      },
      hint: () => restart(revive(state)),
    })
  }

  /* ---------------- drawing ---------------- */

  /** The deck itself: a lit top face over the darker lip that gives it thickness. */
  function drawFace(x: number, y: number, px: number, py: number, w: number, h: number, p: number): void {
    // A cracking tile greys out and settles a little into its own hole.
    const sink = p * 3
    const top = py + sink
    ctx.fillStyle = mix(LIP_COL, PIT, p)
    ctx.fillRect(px, top + h - LIP, w, LIP)
    ctx.fillStyle = mix(TOP, TOP_DEAD, p)
    ctx.fillRect(px, top, w, h - LIP)
    ctx.fillStyle = mix(TOP_EDGE, TOP_DEAD, p)
    ctx.fillRect(px, top, w, 2)
    if (p <= 0.12) return
    // Hairlines out of the middle. The angles come from the tile's own
    // coordinates, so a crack does not shimmer about as the frames go by.
    const cx = px + w / 2
    const cy = top + (h - LIP) / 2
    ctx.strokeStyle = CRACK
    ctx.globalAlpha = clamp01((p - 0.12) * 1.6)
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = ((x * 7 + y * 13 + i * 5) % 12) * (Math.PI / 6)
      const len = (10 + ((x + y + i) % 7)) * p
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.7)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  function drawTile(x: number, y: number): void {
    const tile = state.tiles[y * CREW.W + x]
    if (!tile) return
    const px = OX + x * TW
    const py = OY + y * TH
    const w = TW - GAP
    const h = TH - GAP
    // The arena's bite: not a hole in the deck, an absence of deck. Nothing to
    // catch the light along its edge, and nothing coming back.
    if (tile.state === 'void') {
      ctx.fillStyle = PIT
      ctx.fillRect(px, py, w, h)
      return
    }
    // A hole: the deck's own edge is still around it, which is the only thing
    // that tells it from the arena's bite. Nothing is coming back through it —
    // the pit a bean drops through is the last state that tile has.
    if (tile.state === 'gone') {
      ctx.fillStyle = PIT
      ctx.fillRect(px, py, w, h)
      ctx.fillStyle = PIT_RIM
      ctx.fillRect(px, py, w, 3)
      return
    }
    drawFace(x, y, px, py, w, h, tile.state === 'cracking' ? clamp01(tile.t / CREW.CRACK_MS) : 0)
  }

  /** One crewmate: body, visor, backpack — and a shadow so a hop reads as a hop. */
  function drawBean(cx: number, cy: number, colour: string, scale: number, alpha: number, lift: number): void {
    const w = BEAN_W * scale
    const h = BEAN_H * scale
    const r = w / 2
    ctx.globalAlpha = alpha * 0.3
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 2, r * 0.9, r * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = alpha
    const top = cy - h - lift
    const bottom = cy - lift
    // backpack
    ctx.fillStyle = shade(colour, 0.62)
    roundRect(ctx, cx - r - 5 * scale, top + h * 0.28, 7 * scale, h * 0.44, 3 * scale, 3 * scale)
    ctx.fill()
    // feet
    ctx.fillStyle = shade(colour, 0.72)
    roundRect(ctx, cx - r + 1, bottom - 4 * scale, w * 0.36, 5 * scale, 1, 2 * scale)
    ctx.fill()
    roundRect(ctx, cx + r - w * 0.36 - 1, bottom - 4 * scale, w * 0.36, 5 * scale, 1, 2 * scale)
    ctx.fill()
    // body
    ctx.fillStyle = colour
    roundRect(ctx, cx - r, top, w, h - 3 * scale, r, 5 * scale)
    ctx.fill()
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2 * scale
    ctx.stroke()
    // a soft light down the left edge, so the body is not a flat blob
    ctx.fillStyle = shade(colour, 1.18)
    roundRect(ctx, cx - r + 2 * scale, top + 3 * scale, 4 * scale, h * 0.45, 2 * scale, 2 * scale)
    ctx.fill()
    // visor
    ctx.fillStyle = VISOR
    ctx.beginPath()
    ctx.ellipse(cx + 2 * scale, top + h * 0.3, r * 0.66, r * 0.46, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.5 * scale
    ctx.stroke()
    ctx.fillStyle = VISOR_LIT
    ctx.beginPath()
    ctx.ellipse(cx + r * 0.35, top + h * 0.24, r * 0.18, r * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  /** Where a bean is *drawn* this frame — the interpolated place, not the grid one. */
  type Placed = { gx: number; gy: number; hop: number; fall: number }

  /**
   * The bean's position on the canvas, or `null` for one that has finished
   * falling and is no longer on it. `alpha` is the fraction of a fixed step the
   * draw is ahead of the simulation; folding it into the hop is what makes a
   * hop glide instead of stuttering at the step rate.
   */
  function place(b: Bean, alpha: number): Placed | null {
    const at = fell.get(b.id)
    const age = at == null ? 0 : clock - at
    if (!b.alive && (at == null || age >= fallMs())) return null
    const left = Math.max(0, b.moveT - alpha * STEP_MS)
    const k = b.moveT > 0 ? clamp01(1 - left / CREW.MOVE_MS) : 1
    return {
      gx: OX + lerp(b.x, b.fx, k) * TW + TW / 2 - GAP / 2,
      gy: OY + lerp(b.y, b.fy, k) * TH + TH - LIP - GAP,
      hop: b.moveT > 0 ? Math.sin(k * Math.PI) * HOP_LIFT : 0,
      fall: b.alive || fallMs() <= 0 ? 0 : clamp01(age / fallMs()),
    }
  }

  /**
   * The ring on the floor that is only ever under you. Drawn before the bean
   * and wider than its shadow, so it reads as a halo around your feet whichever
   * tile you are standing on — the half of "which one am I" that survives being
   * squinted at from across the room, where a tag is still being read.
   */
  function drawYouRing(cx: number, cy: number, alpha: number): void {
    const r = BEAN_W / 2
    ctx.globalAlpha = alpha * 0.85
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(cx, cy + 2, r * 1.2, r * 0.58, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /** The crew, drawn back to front so a bean in front overlaps the one behind. */
  function drawBeans(alpha: number): void {
    const order = state.beans.slice().sort((a, b) => Math.max(a.y, a.fy) - Math.max(b.y, b.fy))
    for (const b of order) {
      const p = place(b, alpha)
      if (!p) continue
      const cy = p.gy + p.fall * FALL_DROP
      if (b.id === 'you') drawYouRing(p.gx, cy, 1 - p.fall)
      drawBean(p.gx, cy, COLOURS[b.id] ?? COLOURS.you, 1 - p.fall * 0.65, 1 - p.fall, p.hop)
    }
  }

  /**
   * A name over a head, outlined so it reads over deck, pit or bean alike.
   *
   * The baseline is clamped rather than trusted: a bean on the top row at the
   * peak of a hop with the bob at its lowest asks for a tag whose outline hangs
   * off the top of the canvas, and a tag with its head shaved is worse than one
   * sitting a couple of pixels lower than it wanted. Half the glyph box plus
   * half the stroke is what has to stay on the canvas, so that is the floor.
   */
  function tagText(text: string, x: number, y: number, colour: string, px: number, alpha: number): void {
    const stroke = px < 13 ? 3 : 4
    ctx.font = `700 ${px}px 'Pixelify Sans', 'Inter', system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = alpha
    ctx.strokeStyle = VOID
    ctx.lineWidth = stroke
    const ty = Math.max(px / 2 + stroke / 2, y)
    ctx.strokeText(text, x, ty)
    ctx.fillStyle = colour
    ctx.fillText(text, x, ty)
    ctx.globalAlpha = 1
  }

  /**
   * The top of a bean's head, where its tag hangs from — the drawn one, which
   * on a falling bean is both sinking and shrinking, so the tag goes down with
   * it instead of hanging in the air over the hole.
   */
  function headY(p: Placed): number {
    return p.gy + p.fall * FALL_DROP - BEAN_H * (1 - p.fall * 0.65) - p.hop
  }

  /**
   * Who everybody is, drawn over the whole board after it — the last pass, so a
   * tag is never behind a bean. Yours is loud and bobs and points down at you;
   * theirs are small, quiet and in their own colour, because they are the four
   * other people playing rather than four obstacles.
   */
  function drawTags(alpha: number): void {
    // Theirs first, and yours after all four, so that where two tags cross it
    // is always yours on top — "on top of everything" has to include them. A
    // tag fades out with the bean wearing it rather than blinking off the
    // instant it is ejected: `place` keeps a falling bean on the canvas for the
    // length of its fall, and the tag rides the whole of it down.
    for (const b of state.beans) {
      if (b.id === 'you') continue
      const p = place(b, alpha)
      if (!p) continue
      tagText(NAMES[b.id], p.gx, headY(p) - 9, shade(COLOURS[b.id] ?? COLOURS.you, 1.3), 11, 0.8 * (1 - p.fall))
    }
    const me = state.beans.find((b) => b.id === 'you')
    const p = me ? place(me, alpha) : null
    if (!p) return
    const head = headY(p)
    // A slow bob, so the tag catches the eye on a board where everything else
    // is either still or hopping. Motion turned down parks it.
    const bob = reducedMotion() ? 0 : Math.sin(clock / 240) * 2.5
    const tip = head - 6 + bob
    ctx.globalAlpha = 1 - p.fall
    ctx.beginPath()
    ctx.moveTo(p.gx, tip)
    ctx.lineTo(p.gx - 5, tip - 7)
    ctx.lineTo(p.gx + 5, tip - 7)
    ctx.closePath()
    ctx.strokeStyle = VOID
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.fillStyle = COLOURS.you
    ctx.fill()
    ctx.globalAlpha = 1
    tagText(NAMES.you, p.gx, head - 21 + bob, COLOURS.you, 15, 1 - p.fall)
  }

  /** Who is still up, as pips — a scoreboard that needs no numerals. Below the
   *  deck, where the name tags above it cannot land on them. */
  function drawPips(): void {
    let px = OX + 2
    const y = OY + TH * CREW.H + 20
    for (const b of state.beans) {
      ctx.globalAlpha = b.alive ? 1 : 0.25
      ctx.fillStyle = COLOURS[b.id] ?? COLOURS.you
      ctx.beginPath()
      ctx.ellipse(px, y, 5, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1.5
      ctx.stroke()
      px += 16
    }
    ctx.globalAlpha = 1
  }

  /** The held board's two lines — who you are, then how to start — outlined so
   *  they read over deck or bean. */
  function drawReady(): void {
    const x = VIEW_W / 2
    const y = OY + TH * 1.5
    ctx.font = "600 17px 'Pixelify Sans', 'Inter', system-ui, sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = VOID
    ctx.lineWidth = 5
    ctx.strokeText(WHO, x, y - 15)
    ctx.fillStyle = '#dbe7f2'
    ctx.fillText(WHO, x, y - 15)
    ctx.font = "600 20px 'Pixelify Sans', 'Inter', system-ui, sans-serif"
    ctx.strokeText(READY, x, y + 15)
    ctx.fillStyle = ACCENT
    ctx.fillText(READY, x, y + 15)
  }

  function draw(alpha: number): void {
    if (torn) return
    ctx.fillStyle = VOID
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    for (let y = 0; y < CREW.H; y++) for (let x = 0; x < CREW.W; x++) drawTile(x, y)
    drawBeans(alpha)
    drawPips()
    // Last, and over everything: whoever is still up wears their name.
    drawTags(alpha)
    if (!begun) drawReady()
  }

  const loop = createLoop({ hz: HZ, step: () => slice(STEP_MS), draw })
  loop.start()

  return {
    score: () => (state.status === 'won' ? 1 : 0),
    // The board stays up for the win beat; leaving during it is still the win.
    won: () => state.status === 'won',
    destroy() {
      torn = true
      window.clearTimeout(winTimer)
      loop.destroy()
      root.removeEventListener('keydown', onKey)
    },
    __step: advance,
    __state: () => state,
  }
}
