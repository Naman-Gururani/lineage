// Modal manager: stacked pixel-framed dialogs with a focus trap, Esc to close,
// focus restore, and the shared "world input lock" that modals, the dialogue
// box and Reader Mode all hold.
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { reducedMotion } from './state'

export type ModalOptions = {
  id: string
  el: HTMLElement
  label: string
  onClose?: () => void
  /** clicking the dark backdrop closes the modal (default true) */
  closeOnBackdrop?: boolean
}

type Entry = {
  id: string
  root: HTMLElement
  panel: HTMLElement
  opts: ModalOptions
  prevFocus: Element | null
  lastFocus: HTMLElement | null
}

const stack: Entry[] = []
const CLOSE_MS = 160
const BASE_Z = 100

/* ---------------- tiny DOM helpers shared by every panel ---------------- */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html != null) n.innerHTML = html
  return n
}

export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function uiRoot(): HTMLElement {
  return document.getElementById('ui') ?? document.body
}

/* ---------------- world-input lock ---------------- */

const holders = new Set<string>()

/** Hold the world-input lock on behalf of `source`; emits `ui:lock` on the first holder. */
export function holdLock(source: string): void {
  const was = holders.size > 0
  holders.add(source)
  if (!was) events.emit('ui:lock', { locked: true })
}

/** Release `source`'s hold; emits `ui:lock` false once nobody holds it. */
export function releaseLock(source: string): void {
  if (!holders.delete(source)) return
  if (holders.size === 0) events.emit('ui:lock', { locked: false })
}

export function isLocked(): boolean {
  return holders.size > 0
}

/* ---------------- focus helpers ---------------- */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function focusables(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => !n.hidden && !n.closest('[hidden],.hidden'))
}

function focusInto(entry: Entry): void {
  const auto = entry.panel.querySelector<HTMLElement>('[data-autofocus]')
  const target = auto ?? entry.lastFocus ?? entry.panel
  target.focus({ preventScroll: true })
}

/* ---------------- keyboard: trap + Esc ---------------- */

let keysInstalled = false

/**
 * Install the window key handler. Call once at UI init — before Phaser boots —
 * so it runs ahead of the game's own window listener and can stop keys that
 * close a panel from also reaching the scene (Esc would otherwise re-open it).
 */
export function initModals(): void {
  if (keysInstalled) return
  keysInstalled = true
  window.addEventListener('keydown', onKey)
}

function onKey(e: KeyboardEvent): void {
  const top = stack[stack.length - 1]
  if (!top) return
  const target = e.target instanceof HTMLElement ? e.target : null
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopImmediatePropagation()
    closeModal()
    return
  }
  const inside = !!target && top.root.contains(target)
  if (e.key === 'Tab') {
    const f = focusables(top.panel)
    const active = document.activeElement as HTMLElement | null
    if (!f.length) {
      e.preventDefault()
      top.panel.focus()
    } else if (!inside || !active) {
      e.preventDefault()
      ;(e.shiftKey ? f[f.length - 1] : f[0]).focus()
    } else if (e.shiftKey && (active === f[0] || active === top.panel)) {
      e.preventDefault()
      f[f.length - 1].focus()
    } else if (!e.shiftKey && active === f[f.length - 1]) {
      e.preventDefault()
      f[0].focus()
    }
    return
  }
  if (!inside) return
  // The game captures Space (and would cancel the button's native activation):
  // activate the focused button ourselves.
  if (e.key === ' ' && target.tagName === 'BUTTON' && !e.repeat) {
    e.preventDefault()
    e.stopImmediatePropagation()
    target.click()
    return
  }
  // Keys aimed at the panel never reach the game's window listener.
  e.stopImmediatePropagation()
}

/* ---------------- open / close ---------------- */

function sync(): void {
  const open = stack.length > 0
  document.body.classList.toggle('modal-open', open)
  stack.forEach((entry, i) => {
    const top = i === stack.length - 1
    entry.root.toggleAttribute('inert', !top)
    entry.root.classList.toggle('below', !top)
  })
  for (const child of Array.from(uiRoot().children)) {
    // Toasts are transient status, not background content: `inert` would pull
    // the live region out of the accessibility tree, so a toast raised while a
    // dialog is open (a mini-game reward, say) would never be announced.
    if (child.classList.contains('modal') || child.classList.contains('toasts')) continue
    child.toggleAttribute('inert', open)
  }
  document.getElementById('game-root')?.toggleAttribute('inert', open)
  if (open) holdLock('modal')
  else releaseLock('modal')
}

export function openModal(opts: ModalOptions): void {
  initModals()
  if (stack.some((e) => e.id === opts.id)) closeModal(opts.id)

  const root = el('div', 'modal show')
  root.dataset.id = opts.id
  root.style.zIndex = String(BASE_Z + stack.length)
  const panel = el('div', 'modal-panel')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', opts.label)
  panel.tabIndex = -1
  if (opts.el.dataset.width) panel.style.setProperty('--panel-w', opts.el.dataset.width)
  panel.appendChild(opts.el)
  root.appendChild(panel)

  const entry: Entry = { id: opts.id, root, panel, opts, prevFocus: document.activeElement, lastFocus: null }
  root.addEventListener('pointerdown', (e) => {
    if (e.target !== root) return
    // Always swallow the press: its default action moves focus to <body>, and a
    // dialog that does not close on its backdrop would then be left with no
    // focus at all — Esc and every other key would miss it.
    e.preventDefault()
    if (opts.closeOnBackdrop !== false) closeModal(entry.id)
    else focusInto(entry)
  })
  root.addEventListener('focusin', (e) => {
    if (e.target instanceof HTMLElement && e.target !== panel) entry.lastFocus = e.target
  })

  uiRoot().appendChild(root)
  stack.push(entry)
  sync()
  focusInto(entry)
  sfx.open()
}

export function closeModal(id?: string): void {
  const idx = id == null ? stack.length - 1 : stack.findIndex((e) => e.id === id)
  if (idx < 0) return
  const [entry] = stack.splice(idx, 1)
  entry.root.classList.remove('show')
  entry.root.classList.add('closing')
  entry.root.setAttribute('aria-hidden', 'true')
  entry.root.toggleAttribute('inert', true)
  const remove = () => entry.root.remove()
  if (reducedMotion()) remove()
  else window.setTimeout(remove, CLOSE_MS)
  sync()
  entry.opts.onClose?.()
  events.emit('ui:closed', { id: entry.id })
  sfx.close()

  const top = stack[stack.length - 1]
  if (top) focusInto(top)
  else restoreFocus(entry.prevFocus)
}

/**
 * Where focus goes when whatever opened a modal cannot take it back.
 *
 * Two cards in the fair are opened by the game rather than by a click: the
 * Career card at the end of the coaster (opened from a cutscene, so `prevFocus`
 * is `<body>`) and the tech-stack card at the end of the Word Forge (opened over
 * a panel that is about to be removed, so `prevFocus` is detached by the time it
 * is read). Focusing neither leaves the document with no focus at all and Tab
 * restarts at the top of the page.
 *
 * The fallback is the UI root — focusable but not tabbable — and not
 * `#game-root`, which is `aria-hidden` for the canvas it wraps: focus inside an
 * `aria-hidden` subtree is a worse bug than the one being fixed. `#ui` comes
 * after the canvas and before the first control, so Tab carries straight on into
 * the overlay.
 */
function restoreFocus(prev: Element | null): void {
  if (prev instanceof HTMLElement && prev.isConnected && prev !== document.body) {
    prev.focus({ preventScroll: true })
    // An element can refuse focus (it went `inert`, or it is display:none);
    // `activeElement` is the only honest answer about whether it took.
    if (document.activeElement === prev) return
  }
  const root = uiRoot()
  if (!root.hasAttribute('tabindex')) root.tabIndex = -1
  root.focus({ preventScroll: true })
}

export function closeAllModals(): void {
  while (stack.length) closeModal()
}

export function isModalOpen(): boolean {
  return stack.length > 0
}

export function topModalId(): string | null {
  return stack.length ? stack[stack.length - 1].id : null
}
