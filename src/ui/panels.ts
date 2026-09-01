// Panel router (`ui:panel`), the shared content renderer used by zone panels,
// Reader Mode and the Engine console, and the small Controls / Credits panels.
import { events } from '../core/events'
import { PROFILE, ZONES, type Content, type Zone } from '../data/content'
import { closeModal, el, esc, initModals, openModal } from './modal'
import { applyMotionClass, reducedMotion } from './state'

type Handler = (data?: unknown) => void
const handlers = new Map<string, Handler>()
let routing = false

/** Register the opener for a `ui:panel` id (each panel module does this in its init). */
export function registerPanel(id: string, fn: Handler): void {
  handlers.set(id, fn)
}

export function accentOf(z: Zone | number): string {
  const n = typeof z === 'number' ? z : z.accent
  return '#' + n.toString(16).padStart(6, '0')
}

const chips = (items: string[]) => `<ul class="chips">${items.map((i) => `<li class="chip">${esc(i)}</li>`).join('')}</ul>`

/** Content block → HTML (kicker, title, sub, body, facts, chip groups, points, chips, links). */
export function contentHTML(c: Content, o: { level?: 2 | 3; id?: string } = {}): string {
  const h = o.level ?? 2
  const idAttr = o.id ? ` id="${esc(o.id)}"` : ''
  let s = ''
  if (c.kicker) s += `<p class="d-kicker">${esc(c.kicker)}</p>`
  s += `<h${h} class="d-title"${idAttr}>${esc(c.title)}</h${h}>`
  if (c.sub) s += `<p class="d-sub">${esc(c.sub)}</p>`
  if (c.body) for (const p of c.body) s += `<p class="d-body">${esc(p)}</p>`
  if (c.facts?.length) {
    s += '<dl class="d-facts">'
    for (const f of c.facts) s += `<div class="d-fact"><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`
    s += '</dl>'
  }
  if (c.groups?.length) for (const g of c.groups) s += `<div class="d-group"><span class="d-glabel">${esc(g.label)}</span>${chips(g.items)}</div>`
  if (c.points?.length) s += `<ul class="d-points">${c.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
  if (c.chips?.length) s += chips(c.chips)
  if (c.links?.length) {
    s += '<div class="d-links">'
    for (const l of c.links) {
      const ext = l.ext ? ' target="_blank" rel="noopener noreferrer"' : ''
      const cue = l.ext ? '<span class="sr-only"> (opens in a new tab)</span>' : ''
      s += `<a class="d-link" href="${esc(l.href)}"${ext}><span class="d-llabel">${esc(l.label)}</span><span class="d-lval">${esc(l.value)}</span>${cue}<span class="d-larrow" aria-hidden="true">${l.ext ? '↗' : '→'}</span></a>`
    }
    s += '</div>'
  }
  return s
}

/**
 * Typewrite `text` into `node` over ~`totalMs`. Screen readers get the full
 * text at once (sr-only span); the visible span types. Returns a cancel fn
 * that completes the text immediately.
 */
export function typeText(node: HTMLElement, text: string, totalMs = 400): () => void {
  node.innerHTML = '<span class="sr-only"></span><span class="typed" aria-hidden="true"></span>'
  const sr = node.firstElementChild as HTMLElement
  const typed = node.lastElementChild as HTMLElement
  sr.textContent = text
  const chars = Array.from(text)
  const finish = () => {
    typed.textContent = text
    node.classList.remove('typing')
  }
  if (reducedMotion() || chars.length < 2) {
    finish()
    return () => {}
  }
  node.classList.add('typing')
  let i = 0
  const step = Math.max(8, totalMs / chars.length)
  const timer = window.setInterval(() => {
    i++
    typed.textContent = chars.slice(0, i).join('')
    if (i >= chars.length) {
      window.clearInterval(timer)
      node.classList.remove('typing')
    }
  }, step)
  return () => {
    window.clearInterval(timer)
    finish()
  }
}

/** Close `id` when a `.modal-x` or `[data-act="close"]` inside `box` is clicked. */
export function wireClose(box: HTMLElement, id: string): void {
  box.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.modal-x,[data-act="close"]')) closeModal(id)
  })
}

export function panelHead(title: string, kicker?: string): string {
  return `<header class="modal-head">${kicker ? `<span class="modal-kicker">${esc(kicker)}</span>` : ''}<h2 class="modal-title">${esc(title)}</h2><button type="button" class="modal-x" aria-label="Close">✕</button></header>`
}

/* ---------------- zone "book" panel ---------------- */

export function openZone(id: string): void {
  const z = ZONES.find((x) => x.id === id)
  if (!z) return
  const modalId = `zone:${id}`
  const box = el('article', 'book')
  box.style.setProperty('--accent', accentOf(z))
  box.dataset.width = '680px'
  box.innerHTML = `
    <div class="book-stripe" aria-hidden="true"></div>
    <button type="button" class="modal-x book-x" aria-label="Close">✕</button>
    <div class="book-page">${contentHTML(z.content)}</div>
    <footer class="book-foot"><span class="book-tag">${esc(z.name)} · ${esc(z.label)}</span><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  const title = box.querySelector<HTMLElement>('.d-title')!
  const cancel = typeText(title, z.content.title, 400)
  wireClose(box, modalId)
  openModal({ id: modalId, el: box, label: z.content.title, onClose: cancel })
}

/* ---------------- controls / credits ---------------- */

export function openControls(): void {
  const box = el('div', 'controls')
  box.dataset.width = '600px'
  const rows: [string, string][] = [
    ['Move', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> · left stick · joystick'],
    ['Run', '<kbd>Shift</kbd> · gamepad <kbd>B</kbd> · touch <kbd>B</kbd>'],
    ['Talk · act · next line', '<kbd>E</kbd> <kbd>Space</kbd> <kbd>Enter</kbd> · gamepad <kbd>A</kbd> · touch <kbd>A</kbd>'],
    ['Map', '<kbd>M</kbd>'],
    ['Journal', '<kbd>J</kbd>'],
    ['Menu · close', '<kbd>Esc</kbd> · touch <kbd>≡</kbd>'],
    ['In panels', '<kbd>Tab</kbd> move · <kbd>↑</kbd><kbd>↓</kbd> choose · <kbd>Enter</kbd> select'],
  ]
  box.innerHTML = `${panelHead('Controls')}
    <table class="controls-table"><thead><tr><th scope="col">Action</th><th scope="col">Input</th></tr></thead>
    <tbody>${rows.map(([a, k]) => `<tr><th scope="row">${a}</th><td>${k}</td></tr>`).join('')}</tbody></table>
    <footer class="modal-foot"><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  wireClose(box, 'controls')
  openModal({ id: 'controls', el: box, label: 'Controls' })
}

export function openCredits(): void {
  const box = el('div', 'credits')
  box.dataset.width = '540px'
  box.innerHTML = `${panelHead('Credits')}
    <div class="credits-body">
      <p><b>Naman's World — Lineage Isle</b> is the portfolio of ${esc(PROFILE.name)}, ${esc(PROFILE.role)} at ${esc(PROFILE.company)}.</p>
      <p>Built with Phaser 3, TypeScript and Vite. Every sprite, tile and building is painted procedurally while the game loads, and the music and sounds are synthesised with Web Audio — there are no asset files at all.</p>
      <p>Type: Press Start 2P, Pixelify Sans and Fredoka.</p>
      <p class="credits-thanks">Thanks for exploring. ⛵</p>
    </div>
    <footer class="modal-foot"><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  wireClose(box, 'credits')
  openModal({ id: 'credits', el: box, label: 'Credits' })
}

/* ---------------- router ---------------- */

export function initPanels(): void {
  initModals()
  applyMotionClass()
  registerPanel('controls', openControls)
  registerPanel('credits', openCredits)
  if (routing) return
  routing = true
  events.on('ui:panel', ({ id, data }) => {
    if (id.startsWith('zone:')) {
      openZone(id.slice(5))
      return
    }
    handlers.get(id)?.(data)
  })
}
