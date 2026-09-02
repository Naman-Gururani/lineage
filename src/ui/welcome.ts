// The welcome card — the game's front page. Who this is, what the island is,
// and how to play it, all visible before anyone has to figure anything out.
// It floats over the live drifting-island attract mode (the scene keeps
// running behind it) and replaces the old title menu; `initTitle` delegates
// here. Every fact on it is imported from `content.ts`, never retyped.
import { frameDataURL } from '../art/atlas'
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { clearSave, loadSave, writeSave } from '../core/save'
import { PROFILE } from '../data/content'
import { closeModal, el, esc, focusables, isLocked, openModal } from './modal'

const PITCH = 'I build real-time systems that move money — this island is my résumé. Bo will show you around.'
const FOOT = 'Prefer plain text? Reader Mode has everything.'

type HowRow = { k: string; v: string }

/** Keyboard legend — the pace is automatic now, so Shift *slows* you down. */
const HOWTO_KEYS: HowRow[] = [
  { k: 'Move', v: 'WASD / arrows' },
  { k: 'Run', v: 'automatic (Shift to stroll)' },
  { k: 'Jump', v: 'Space' },
  { k: 'Interact', v: 'E' },
]

/** Touch legend — matches the on-screen stick and the A/B buttons. */
const HOWTO_TOUCH: HowRow[] = [
  { k: 'Move', v: 'left stick' },
  { k: 'Jump', v: 'B' },
  { k: 'Interact', v: 'A' },
]

let card: HTMLElement | null = null
let wired = false

/* ---------------- markup ---------------- */

const howtoHTML = (list: HowRow[]) =>
  list
    .map((r) => `<li class="welcome-how"><b class="welcome-how-k">${esc(r.k)}</b> — <span class="welcome-how-v">${esc(r.v)}</span></li>`)
    .join('')

function build(): HTMLElement {
  const s = el('section', 'welcome hidden')
  s.setAttribute('aria-label', 'Welcome')
  s.innerHTML = `
    <div class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-name" tabindex="-1">
      <div class="welcome-id">
        <img class="welcome-portrait" alt="" width="96" height="96" hidden>
        <div class="welcome-who">
          <h1 class="welcome-name" id="welcome-name">${esc(PROFILE.name)}</h1>
          <p class="welcome-role">${esc(PROFILE.role)} · ${esc(PROFILE.company)} · ${esc(PROFILE.location)}</p>
          <p class="welcome-pitch">${esc(PITCH)}</p>
        </div>
      </div>
      <ul class="welcome-howto" aria-label="How to play">${howtoHTML(HOWTO_KEYS)}</ul>
      <nav class="welcome-links" aria-label="Links">
        <a class="wlink" href="${esc(PROFILE.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a class="wlink" href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a class="wlink" href="mailto:${esc(PROFILE.email)}">Email</a>
        <button type="button" class="wlink" data-act="reader">Reader Mode</button>
      </nav>
      <div class="welcome-actions">
        <button type="button" class="wbtn primary" data-act="start" aria-label="Start the game"><span aria-hidden="true">▶ </span>Start</button>
        <button type="button" class="wbtn" data-act="new" hidden>New Game</button>
        <button type="button" class="wbtn" data-act="settings">Settings</button>
      </div>
      <p class="welcome-foot">${esc(FOOT)}</p>
    </div>`
  s.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (b) act(b.dataset.act!)
  })
  return s
}

/* ---------------- layout ---------------- */

/** Touch device or a phone-width viewport: stack the card, swap the legend. */
function touchLayout(): boolean {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true
  } catch {
    /* no matchMedia: fall through to the cheaper checks */
  }
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true
  return window.innerWidth <= 720
}

function applyLayout(): void {
  if (!card) return
  const touch = touchLayout()
  card.classList.toggle('welcome-touch', touch)
  const list = card.querySelector('.welcome-howto')
  if (list) list.innerHTML = howtoHTML(touch ? HOWTO_TOUCH : HOWTO_KEYS)
}

/* ---------------- focus ---------------- */

const ring = () => (card ? focusables(card) : [])

function moveFocus(delta: number): void {
  const f = ring()
  if (!f.length) return
  const cur = f.indexOf(document.activeElement as HTMLElement)
  const next = cur < 0 ? (delta > 0 ? 0 : f.length - 1) : (cur + delta + f.length) % f.length
  f[next].focus({ preventScroll: true })
}

/**
 * Keys are handled here rather than left to the browser because the game owns
 * the window: Space is bound to jump and Enter to interact, so both are taken
 * out of circulation while the card is up.
 *
 * Anything that holds the world-input lock — Settings, the New Game confirm,
 * Reader Mode — is opened *over* the card and owns the keyboard while it is
 * up. This listener is installed before theirs, so without this guard it would
 * swallow their keys (Esc included) before they ever saw them.
 */
function onKey(e: KeyboardEvent): void {
  if (!isWelcomeOpen() || isLocked()) return
  const stop = () => {
    e.preventDefault()
    e.stopImmediatePropagation()
  }
  if (e.key === 'Tab') {
    stop()
    moveFocus(e.shiftKey ? -1 : 1)
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    stop()
    moveFocus(1)
    sfx.blip()
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    stop()
    moveFocus(-1)
    sfx.blip()
  } else if (e.key === 'Enter' || e.key === ' ') {
    if (e.repeat) return
    stop()
    const focused = document.activeElement as HTMLElement | null
    const target = focused && ring().includes(focused) ? focused : primaryButton()
    target?.click()
  }
}

const primaryButton = () => card?.querySelector<HTMLButtonElement>('.welcome-actions .primary') ?? null

/* ---------------- actions ---------------- */

/**
 * Remember that the card has been seen — in the save that already exists. It
 * is what stops the "the island got a big upgrade" toast greeting a returning
 * v1 player on every single load: the world checks `save.welcomeSeen` before
 * greeting. A brand-new run has no save file yet (GameState writes the first
 * one), so there is nothing to flag: writing a placeholder here would only be
 * overwritten by that first autosave, and would offer "Continue" to someone
 * who never played.
 */
function markWelcomeSeen(): void {
  const save = loadSave()
  if (!save || save.welcomeSeen) return
  save.welcomeSeen = true
  writeSave(save)
}

function enterWorld(a: 'start' | 'continue'): void {
  markWelcomeSeen()
  hideWelcome()
  events.emit(a === 'start' ? 'game:new' : 'game:continue', {})
}

/** New Game over an existing save is destructive, so it asks first. */
function confirmNewGame(): void {
  const box = el('div', 'confirm')
  box.dataset.width = '440px'
  box.innerHTML = `
    <h2 class="modal-title">Start a new game?</h2>
    <p>This erases the explorer you have — discoveries, quests, badges, everything. The island will forget you.</p>
    <div class="confirm-actions">
      <button type="button" class="pbtn" data-act="cancel" data-autofocus>Keep my save</button>
      <button type="button" class="pbtn danger" data-act="wipe">Erase and start over</button>
    </div>`
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]')
    if (!b) return
    closeModal('confirm')
    if (b.dataset.act !== 'wipe') return
    clearSave()
    events.emit('save:changed', {})
    // nothing left to flag welcomeSeen in — the fresh run writes its own save
    hideWelcome()
    events.emit('game:new', {})
  })
  openModal({ id: 'confirm', el: box, label: 'Start a new game?', closeOnBackdrop: false })
}

function act(a: string): void {
  sfx.select()
  if (a === 'start' || a === 'continue') enterWorld(a)
  else if (a === 'new') confirmNewGame()
  else if (a === 'reader') events.emit('game:reader', {})
  else if (a === 'settings') events.emit('ui:panel', { id: 'settings' })
}

/* ---------------- show / hide ---------------- */

export function isWelcomeOpen(): boolean {
  return !!card && !card.classList.contains('hidden')
}

export function showWelcome(hasSave: boolean): void {
  if (!card) return
  const primary = primaryButton()
  if (primary) {
    primary.dataset.act = hasSave ? 'continue' : 'start'
    primary.innerHTML = hasSave ? 'Continue' : '<span aria-hidden="true">▶ </span>Start'
    primary.setAttribute('aria-label', hasSave ? 'Continue your game' : 'Start the game')
  }
  const fresh = card.querySelector<HTMLButtonElement>('[data-act="new"]')
  if (fresh) fresh.hidden = !hasSave
  // the atlas only exists once BootScene has built it, so ask at open time
  const img = card.querySelector<HTMLImageElement>('.welcome-portrait')
  if (img) {
    const url = frameDataURL('portrait_naman', 2)
    if (url) img.src = url
    img.hidden = !url
  }
  applyLayout()
  card.classList.remove('hidden')
  primary?.focus({ preventScroll: true })
  armAudioUnlock()
}

export function hideWelcome(): void {
  card?.classList.add('hidden')
}

/** Browsers keep audio asleep until a gesture; the first one here wakes it. */
let unlockArmed = false
function armAudioUnlock(): void {
  if (unlockArmed) return
  unlockArmed = true
  const unlock = () => {
    unlockArmed = false
    sfx.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/* ---------------- init ---------------- */

export function initWelcome(root: HTMLElement): void {
  card?.remove()
  card = build()
  root.appendChild(card)
  if (wired) return
  wired = true
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', () => {
    if (isWelcomeOpen()) applyLayout()
  })
  events.on('ui:title', ({ hasSave }) => showWelcome(hasSave))
  // `game:title` carries no payload (Settings' "Reset save" ends here, and the
  // save it is bouncing back from may have just been wiped): ask storage.
  events.on('game:title', () => showWelcome(!!loadSave()))
}
