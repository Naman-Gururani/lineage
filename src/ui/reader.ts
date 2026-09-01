// Reader Mode: the whole portfolio as one scrollable, accessible document.
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { PROFILE, ZONES } from '../data/content'
import { el, esc, holdLock, isModalOpen, releaseLock, uiRoot } from './modal'
import { accentOf, contentHTML, registerPanel } from './panels'
import { reducedMotion, uiState } from './state'

let view: HTMLElement | null = null
let prevFocus: Element | null = null
let keysInstalled = false

export function isReaderOpen(): boolean {
  return view !== null
}

function installKeys(): void {
  if (keysInstalled) return
  keysInstalled = true
  window.addEventListener('keydown', (e) => {
    if (!view || isModalOpen()) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      closeReader()
      return
    }
    // keep the game's window listener from cancelling page-scrolling keys
    e.stopImmediatePropagation()
  })
}

function focusStart(): void {
  view?.querySelector<HTMLElement>('.reader-h1')?.focus({ preventScroll: true })
}

export function openReader(): void {
  installKeys()
  if (view) {
    focusStart()
    return
  }
  const r = el('div', 'reader')
  r.setAttribute('role', 'document')
  r.setAttribute('aria-label', 'Reader mode')
  const toc = ZONES.map(
    (z) =>
      `<li><a href="#reader-${z.id}" style="--accent:${accentOf(z)}"><span class="toc-label">${esc(z.label)}</span><span class="toc-name">${esc(z.content.title)}</span></a></li>`,
  ).join('')
  const zones = ZONES.map(
    (z) =>
      `<article class="reader-zone" id="reader-${z.id}" style="--accent:${accentOf(z)}" aria-labelledby="reader-h-${z.id}">` +
      `<p class="reader-place">${esc(z.name)} · ${esc(z.label)}</p>${contentHTML(z.content, { level: 2, id: `reader-h-${z.id}` })}</article>`,
  ).join('')
  r.innerHTML = `
    <a class="skip" href="#reader-main">Skip to content</a>
    <header class="reader-head">
      <div class="reader-brand"><span class="reader-logo">NAMAN'S WORLD</span><span class="reader-kicker">READER MODE</span></div>
      <button type="button" class="pbtn reader-back" data-act="back">◀ Back to the game</button>
    </header>
    <div class="reader-body">
      <nav class="reader-toc" aria-label="Contents"><h2 class="toc-title">Contents</h2><ol>${toc}</ol></nav>
      <main id="reader-main" class="reader-main" tabindex="-1">
        <h1 class="reader-h1" tabindex="-1">${esc(PROFILE.name)}<small>${esc(PROFILE.role)} · ${esc(PROFILE.company)}</small></h1>
        <p class="reader-intro">Everything the island has to say, as plain text — the same content the landmarks reveal, in order.</p>
        ${zones}
        <footer class="reader-foot"><p>Prefer to explore?</p><button type="button" class="pbtn primary" data-act="back">◀ Back to the game</button></footer>
      </main>
    </div>`
  r.querySelectorAll<HTMLElement>('.d-title').forEach((h) => (h.tabIndex = -1))
  r.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t.closest('[data-act="back"]')) {
      closeReader()
      return
    }
    const a = t.closest<HTMLAnchorElement>('a[href^="#"]')
    if (!a) return
    const target = r.querySelector<HTMLElement>(a.getAttribute('href')!)
    if (!target) return
    e.preventDefault()
    target.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
    const h = target.matches('main,h1,h2,h3') ? target : (target.querySelector<HTMLElement>('.d-title') ?? target)
    h.focus({ preventScroll: true })
  })
  uiRoot().appendChild(r)
  view = r
  prevFocus = document.activeElement
  document.body.classList.add('reader-open')
  holdLock('reader')
  uiState.achievements?.unlock('well_read')
  sfx.open()
  focusStart()
}

export function closeReader(): void {
  if (!view) return
  const v = view
  view = null
  v.remove()
  document.body.classList.remove('reader-open')
  releaseLock('reader')
  sfx.close()
  events.emit('ui:closed', { id: 'reader' })
  if (prevFocus instanceof HTMLElement && prevFocus.isConnected) prevFocus.focus({ preventScroll: true })
}

export function initReader(): void {
  installKeys()
  registerPanel('reader', () => openReader())
  events.on('game:reader', () => openReader())
}
