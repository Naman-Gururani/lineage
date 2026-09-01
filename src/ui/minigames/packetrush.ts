// Packet Rush — the sorting cabinet on the Engine floor. Packets drop out of the
// Stream tagged £, € or $; send each one to its bin before it hits the deck.
//
// All the rules live in src/games/packetrush.ts. This file is DOM: three lanes
// of absolutely-positioned motes over a fixed 60 Hz tick, three real buttons for
// the bins, and the hand-off to the host when the run ends either way.
//
// The clock is a `setInterval`, not `requestAnimationFrame`, for the same reason
// the Engine console's is: a fixed step makes the run reproducible from its seed
// — the tests drive the reducer at exactly this tick — and a mini-game inside a
// modal has no camera to keep smooth.
import { sfx } from '../../audio/sfx'
import { JURISDICTIONS, PR, prEndless, prInit, prLowest, prRoute, prSpawnInterval, prStep, type Jur, type PrState } from '../../games/packetrush'
import { afterWin, registerMinigame, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { el, esc } from '../modal'
import { panelHead } from '../panels'
import { reducedMotion } from '../state'

/** The tick. Fixed, so a seed replays the same run every time. */
export const PR_TICK_MS = 1000 / 60
/** With motion reduced the packets step down the lane in visible notches instead of sliding. */
export const PR_STEPS = 24
/** What the cabinet says when the deck wins. */
export const PR_GAG_TITLE = 'The stream got away from you.'

const KEYS: Record<string, Jur> = {
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowRight: 2,
  a: 0,
  s: 1,
  d: 2,
  '1': 0,
  '2': 1,
  '3': 2,
}

export function mountPacketRush(host: MinigameHost, root: HTMLElement): MinigameSession {
  const bins = JURISDICTIONS.map(
    (j, i) =>
      `<button type="button" class="pr-bin" data-jur="${i}" style="--jur:${j.color}" aria-label="Route to ${esc(j.label)}">` +
      `<span class="pr-glyph" aria-hidden="true">${j.glyph}</span><small>${esc(j.label)}</small></button>`,
  ).join('')

  root.innerHTML = `
    ${panelHead('Packet Rush', 'THE ENGINE')}
    <p class="mg-rule">Sol is running the Stream hot. Every packet falls tagged with a jurisdiction — send it to that bin before it reaches the deck. Route ${PR.WIN} and the Engine is clean.</p>
    <div class="mg-stats">
      <span class="mg-stat"><b data-f="score">0</b><small>of ${PR.WIN} routed</small></span>
      <span class="mg-stat"><b data-f="lives">${PR.LIVES}</b><small>lives</small></span>
      <span class="mg-stat"><b data-f="rate">1.0×</b><small>stream rate</small></span>
    </div>
    <div class="mg-board card">
      <div class="pr-field" role="application" aria-label="The Stream: three lanes of falling packets" tabindex="0">
        ${[0, 1, 2].map(() => '<div class="pr-lane"></div>').join('')}
        <div class="pr-deck" aria-hidden="true"></div>
      </div>
    </div>
    <div class="pr-bins" role="group" aria-label="Jurisdiction bins">${bins}</div>
    <p class="mg-live sr-only" role="status" aria-live="polite"></p>
    <footer class="mg-foot">
      <span class="mg-keys"><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> route · <kbd>1</kbd>–<kbd>3</kbd> also</span>
      <button type="button" class="pbtn" data-act="quit">Leave</button>
    </footer>`

  const field = root.querySelector('.pr-field') as HTMLElement
  const lanes = Array.from(root.querySelectorAll<HTMLElement>('.pr-lane'))
  const live = root.querySelector('.mg-live') as HTMLElement
  const f = (name: string) => root.querySelector(`[data-f="${name}"]`) as HTMLElement

  let state: PrState = prInit((Date.now() ^ 0x9e3779b9) >>> 0)
  /** the win, once earned: an endless run still ends as the win it already was */
  let banked = false
  let best = 0
  let timer = 0
  let winTimer = 0
  let closing = false
  /**
   * One element per packet *slot*, not per packet: the reducer is pure, so every
   * tick hands back fresh `Packet` objects and there is no identity to key a map
   * on. The pool is indexed by position in `state.falling`, which only ever gains
   * an entry at the end or loses one from the middle — and since every property
   * is written each tick, a slot changing hands is invisible.
   */
  const pool: HTMLElement[] = []
  let overlay: HTMLElement | null = null

  const say = (text: string) => (live.textContent = text)
  const reduced = () => reducedMotion()

  function paintStats() {
    f('score').textContent = String(state.score)
    f('lives').textContent = String(state.lives)
    f('rate').textContent = `${(state.speed / PR.SPEED).toFixed(1)}×`
    field.setAttribute('aria-label', `The Stream: ${state.score} of ${PR.WIN} routed, ${state.lives} lives left.`)
  }

  function paint() {
    const next = prLowest(state)
    const still = reduced()
    const span = Math.max(1, (lanes[0].clientHeight || 224) - 30)
    for (let i = 0; i < state.falling.length; i++) {
      const p = state.falling[i]
      const j = JURISDICTIONS[p.jur]
      let mote = pool[i]
      if (!mote) {
        mote = el('i', 'pr-packet')
        mote.setAttribute('aria-hidden', 'true')
        pool[i] = mote
      }
      if (mote.parentElement !== lanes[p.lane]) lanes[p.lane].appendChild(mote)
      if (mote.textContent !== j.glyph) {
        mote.textContent = j.glyph
        mote.style.setProperty('--jur', j.color)
      }
      // Motion reduced: the mote drops in notches, and nothing is transformed —
      // only `top` moves, so there is no sliding to follow.
      const y = still ? Math.round(p.y * PR_STEPS) / PR_STEPS : p.y
      mote.style.top = still ? `${Math.round(y * span)}px` : '0px'
      mote.style.transform = still ? 'translate(-50%, 0)' : `translate(-50%, ${Math.round(y * span)}px)`
      mote.classList.toggle('next', p === next)
      mote.hidden = false
    }
    for (let i = state.falling.length; i < pool.length; i++) {
      pool[i].hidden = true
      pool[i].classList.remove('next')
    }
    paintStats()
  }

  function stop() {
    window.clearInterval(timer)
    timer = 0
  }

  function start() {
    stop()
    timer = window.setInterval(tick, PR_TICK_MS)
  }

  function tick() {
    if (closing) return
    const before = state.lives
    state = prStep(state, PR_TICK_MS / 1000)
    if (state.lives < before) {
      sfx.bump()
      say(`A packet hit the deck. ${state.lives} lives left.`)
    }
    paint()
    if (state.over) finish()
  }

  /** The run ended — as a loss, or as the win the player already banked. */
  function finish() {
    stop()
    if (banked || state.won) return bank()
    sfx.back()
    say(`Run over on ${state.score}.`)
    host.gag({
      title: PR_GAG_TITLE,
      sub: `${state.score} routed before backpressure won. One more life?`,
      hint: reprieve,
      retry: restart,
    })
  }

  /**
   * Hire me: one more life — and a clear column to spend it on.
   *
   * The lives ran out with packets still falling, one of them very likely a
   * hair above the deck; handing the life back into that column would spend it
   * in two frames. The Stream is flushed and the spawn timer reset, the way a
   * fall in the tower puts you back on your feet rather than mid-air.
   */
  function reprieve() {
    state = { ...state, lives: 1, over: false, falling: [], spawnIn: prSpawnInterval(state.speed) }
    say('One more life. Back to the Stream.')
    paint()
    start()
  }

  function restart() {
    state = prInit((state.seed ^ 0x85ebca6b) >>> 0)
    for (const mote of pool) {
      mote.hidden = true
      mote.classList.remove('next')
    }
    say('New run.')
    paint()
    start()
  }

  function bank() {
    if (closing) return
    closing = true
    stop()
    sfx.levelup()
    say(`Stream clean: ${best} routed.`)
    winTimer = afterWin(() => host.close({ id: 'packetrush', won: true, score: best }))
  }

  /** Thirty routed: bank it now, or push the high score with the lives left. */
  function celebrate() {
    banked = true
    stop()
    sfx.chest()
    say(`${PR.WIN} routed — the Engine is clean.`)
    overlay = el('div', 'pr-done card')
    overlay.innerHTML =
      `<p class="pr-done-kicker">STREAM CLEAN</p><h3 class="pr-done-title">${PR.WIN} routed.</h3>` +
      `<p class="pr-done-sub">Bank the run, or keep going for a high score on the ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} you have left.</p>` +
      `<div class="mg-gag-acts"><button type="button" class="pbtn primary" data-act="bank" data-autofocus>Bank the run</button>` +
      `<button type="button" class="pbtn" data-act="endless">Keep going</button></div>`
    field.appendChild(overlay)
    overlay.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus({ preventScroll: true })
  }

  function dismissOverlay() {
    overlay?.remove()
    overlay = null
  }

  function route(jur: Jur) {
    if (closing || overlay || state.over) return
    const target = prLowest(state)
    if (!target) return
    const hit = target.jur === jur
    state = prRoute(state, jur)
    best = Math.max(best, state.score)
    if (hit) sfx.blip()
    else {
      sfx.bump()
      say(`${JURISDICTIONS[target.jur].glyph}, not ${JURISDICTIONS[jur].glyph}. ${state.lives} lives left.`)
    }
    paint()
    if (state.won && !banked) return celebrate()
    if (state.over) finish()
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'quit' || target.closest('.modal-x')) return host.quit()
    if (act === 'bank') {
      dismissOverlay()
      return bank()
    }
    if (act === 'endless') {
      dismissOverlay()
      state = prEndless(state)
      say('Endless. Keep them moving.')
      field.focus({ preventScroll: true })
      return start()
    }
    const bin = target.closest<HTMLElement>('[data-jur]')?.dataset.jur
    if (bin) route(Number(bin) as Jur)
  })

  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const jur = KEYS[k]
    if (jur === undefined) return
    e.preventDefault()
    route(jur)
  })

  field.dataset.autofocus = ''
  field.focus({ preventScroll: true })
  paint()
  say(`Three lanes, three bins. Route ${PR.WIN}.`)
  start()

  return {
    score: () => best,
    won: () => banked,
    destroy: () => {
      stop()
      window.clearTimeout(winTimer)
    },
  }
}

export function initPacketRush(): void {
  registerMinigame('packetrush', mountPacketRush)
}
