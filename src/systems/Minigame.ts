// The mini-game host: one modal over whichever scene is running, one mounted
// renderer at a time, the shared "stuck" overlay every game reaches for, and
// the rewards handshake with GameState.
//
// The games themselves are pure reducers in src/games/*; the renderers in
// src/ui/minigames/* are thin DOM over them and never touch Phaser. Everything
// that pauses the world — the input lock, the focus trap, Esc — is the modal
// manager's, held here so the scene behind keeps drawing but stops listening.
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { PROFILE } from '../data/content'
import { closeModal, el, esc, holdLock, openModal, releaseLock } from '../ui/modal'
import { registerPanel } from '../ui/panels'
import { reducedMotion } from '../ui/state'
import type { GameState } from './GameState'

export type MinigameId = 'studyhall' | 'cargo' | 'packetrush' | 'climb'

export type MinigameResult = { id: MinigameId; won: boolean; score: number }

/** The lose / stuck overlay: a title in the game's own voice, and a way on. */
export type GagOpts = {
  title: string
  sub?: string
  /** the free nudge the "Hire me" button buys; falls back to `retry` */
  hint?: () => void
  /** start this board or level over */
  retry: () => void
}

/** What a renderer hands back so the host can tidy up and score an early exit. */
export type MinigameSession = {
  destroy?(): void
  /** progress so far, higher is better — read when the player quits mid-game */
  score?(): number
  /**
   * Has this round *already* been won, whatever happens next?
   *
   * Only a game that carries on past its own win needs this: Packet Rush banks
   * the clear at thirty and then offers the endless run, and walking away from
   * that — or losing the last life to it — must still be recorded as the clear
   * it was. A game that ends the moment it is won leaves this alone.
   */
  won?(): boolean
}

export type MinigameMount = (host: MinigameHost, root: HTMLElement) => MinigameSession

export const MINIGAME_IDS: MinigameId[] = ['studyhall', 'cargo', 'packetrush', 'climb']

export const MINIGAME_LABELS: Record<MinigameId, string> = {
  studyhall: 'Study Hall — Lights Out',
  cargo: 'Cargo Cove — crate stacking',
  packetrush: 'Packet Rush',
  climb: 'Tower Climb',
}

const MODAL_ID = 'minigame'
const GAG_ID = 'minigame-gag'
const EXIT_ID = 'minigame-exit'

/** A beat to admire the last move before the modal closes; none when motion is reduced. */
export const WIN_DELAY_MS = 650

const MOUNTS = new Map<MinigameId, MinigameMount>()

/** Each renderer registers itself at UI init, so the host imports no DOM game code. */
export function registerMinigame(id: MinigameId, mount: MinigameMount): void {
  MOUNTS.set(id, mount)
}

export function isMinigameId(v: unknown): v is MinigameId {
  return typeof v === 'string' && (MINIGAME_IDS as string[]).includes(v)
}

export class MinigameHost {
  /** Set by WorldScene once the save is loaded; rewards are skipped without it. */
  state: GameState | null = null
  private id: MinigameId | null = null
  private session: MinigameSession | null = null
  private box: HTMLElement | null = null
  private hired: HTMLElement | null = null
  /** the result `close()` asked for, read by the teardown funnel */
  private pending: MinigameResult | null = null

  get openId(): MinigameId | null {
    return this.id
  }

  /** Mount a game: locks the world, opens the modal, routes keys to the renderer. */
  open(id: MinigameId): void {
    if (this.id) return
    const mount = MOUNTS.get(id)
    if (!mount) {
      events.emit('ui:toast', { kind: 'info', icon: '🎮', title: 'Coming soon.' })
      return
    }
    const box = el('div', 'mg')
    box.dataset.game = id
    box.dataset.width = '640px'
    this.id = id
    this.box = box
    this.pending = null
    this.hired = null
    // Held alongside the modal manager's own lock so the scene behind stops
    // reading input the moment the game opens, and only lets go on close.
    holdLock('minigame')
    openModal({ id: MODAL_ID, el: box, label: MINIGAME_LABELS[id], closeOnBackdrop: false, onClose: () => this.teardown() })
    // Esc inside the game asks before throwing the round away. The listener sits
    // on the panel so it runs before the modal manager's window handler, and the
    // confirm is deferred a tick — a modal opened inside a keydown would be shut
    // again by that same key.
    box.parentElement?.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      window.setTimeout(() => this.confirmExit(), 0)
    })
    this.session = mount(this, box)
  }

  /** Finish a round: records it, hands the rewards to GameState, unpauses. */
  close(result: MinigameResult): void {
    if (this.id !== result.id) return
    this.pending = result
    closeModal(MODAL_ID) // → teardown(), which is the one place a round is recorded
  }

  /** Quit whatever is running, scoring the progress so far. */
  quit(): void {
    if (!this.id) return
    this.close({ id: this.id, won: this.session?.won?.() ?? false, score: this.session?.score?.() ?? 0 })
  }

  /**
   * The save this host was pointed at is going away — the player asked for the
   * title screen, and `WorldScene` is about to build a new `GameState`.
   *
   * Any round still open is closed first, so it is recorded against the save it
   * was actually played on, and only then is the reference dropped. Without this
   * the host keeps the old `GameState` alive across a new game, and a mini-game
   * won on the next save pays its rewards into a file nobody will ever write.
   */
  detach(): void {
    if (this.id) closeModal(MODAL_ID)
    this.state = null
  }

  /** The shared lose / stuck overlay. */
  gag(opts: GagOpts): void {
    if (!this.id) return
    const box = el('div', 'mg-gag card')
    box.dataset.width = '460px'
    box.innerHTML =
      `<p class="mg-gag-kicker">STUCK?</p>` +
      `<h2 class="mg-gag-title">${esc(opts.title)}</h2>` +
      (opts.sub ? `<p class="mg-gag-sub">${esc(opts.sub)}</p>` : '') +
      `<div class="mg-gag-acts">` +
      `<button type="button" class="pbtn" data-act="retry">Try again</button>` +
      `<button type="button" class="pbtn primary" data-act="hire" data-autofocus>🤝 Hire me — extra life</button>` +
      `<button type="button" class="pbtn" data-act="exit">Exit</button>` +
      `</div>`
    box.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]')?.dataset.act
      if (!act) return
      closeModal(GAG_ID)
      if (act === 'retry') opts.retry()
      else if (act === 'hire') {
        // The joke pays out: the nudge is real, and so is the address.
        ;(opts.hint ?? opts.retry)()
        sfx.pickup()
        this.pinHireNote()
        events.emit('ui:toast', { kind: 'ach', icon: '🤝', title: 'Excellent choice. HR will be in touch.' })
      } else if (act === 'exit') this.quit()
    })
    openModal({ id: GAG_ID, el: box, label: opts.title, closeOnBackdrop: false })
  }

  /**
   * Pin the punchline — and a real mailto — into the game panel, once per round.
   *
   * It lives *inside* the dialog on purpose. A toast cannot carry this link: the
   * `.modal` backdrop is a full-inset scrim above the toast layer, so it would
   * swallow the click, and the dialog's focus trap would pull Tab straight back
   * off it. Inside the panel the anchor is in the trap's own focusable list, and
   * it is the topmost thing under the pointer. The toast stays as flavour.
   */
  private pinHireNote(): void {
    if (!this.box || this.hired) return
    const note = el('p', 'mg-hire')
    note.innerHTML = `<span class="mg-hire-ic" aria-hidden="true">🤝</span><span>Excellent choice. HR will be in touch — </span>`
    const a = el('a', 'mg-hire-link')
    a.href = `mailto:${PROFILE.email}`
    a.textContent = 'email Naman'
    note.appendChild(a)
    this.box.appendChild(note)
    this.hired = note
  }

  private confirmExit(): void {
    if (!this.id) return
    const box = el('div', 'mg-confirm card')
    box.dataset.width = '380px'
    box.innerHTML =
      `<h2 class="mg-gag-title">Leave the game?</h2>` +
      `<p class="mg-gag-sub">This round starts over next time.</p>` +
      `<div class="mg-gag-acts">` +
      `<button type="button" class="pbtn" data-act="stay" data-autofocus>Keep playing</button>` +
      `<button type="button" class="pbtn danger" data-act="leave">Leave</button>` +
      `</div>`
    box.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]')?.dataset.act
      if (!act) return
      closeModal(EXIT_ID)
      if (act === 'leave') this.quit()
    })
    openModal({ id: EXIT_ID, el: box, label: 'Leave the game?', closeOnBackdrop: false })
  }

  /**
   * The one way out. Every dismissal lands here — `close()`, the Exit button,
   * the Esc confirm, a backdrop click, `closeAllModals()` — so a round is always
   * recorded exactly once, even when nobody asked politely. A dismissal that
   * skipped `close()` counts as walking away: a play at the score reached.
   */
  private teardown(): void {
    const id = this.id
    const result = this.pending ?? (id ? { id, won: this.session?.won?.() ?? false, score: this.session?.score?.() ?? 0 } : null)
    closeModal(GAG_ID)
    closeModal(EXIT_ID)
    this.session?.destroy?.()
    this.session = null
    this.pending = null
    this.hired = null
    this.box = null
    this.id = null
    releaseLock('minigame')
    // After the modal is gone, so the reward toasts land on the world.
    const st = this.state
    if (!st || !result) return
    if (result.won) st.minigameWon(result.id, result.score)
    else st.minigamePlayed(result.id, result.score)
  }
}

export const minigames = new MinigameHost()

/** Wire the `minigame` panel id; the renderers register themselves separately. */
export function initMinigames(): void {
  registerPanel('minigame', (data) => {
    // An id nobody recognises says so, exactly as a known-but-unbuilt one does:
    // pressing E on a prop must never look like a dead button.
    if (isMinigameId(data)) minigames.open(data)
    else events.emit('ui:toast', { kind: 'info', icon: '🎮', title: 'Coming soon.' })
  })
}

/** A win reads better after a beat — unless the player asked for less motion. */
export function winDelay(): number {
  return reducedMotion() ? 0 : WIN_DELAY_MS
}

/**
 * Run `fn` after that beat, and return the timer to cancel. With motion reduced
 * there is no beat and no timer: the next board is simply there.
 */
export function afterWin(fn: () => void): number {
  const ms = winDelay()
  if (ms <= 0) {
    fn()
    return 0
  }
  return window.setTimeout(fn, ms)
}
