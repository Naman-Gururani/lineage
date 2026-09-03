// Panel router (`ui:panel`), the shared content renderer used by zone panels,
// the locked-chapter card and Reader Mode, and the small Controls / Credits
// panels.
import { events } from '../core/events'
import { PROFILE, ZONES, type Content, type Zone } from '../data/content'
import { signById, type SignDef, type SignDir } from '../data/signs'
import { STORY_HINTS } from '../data/story'
import { closeModal, el, esc, initModals, isModalOpen, openModal, topModalId } from './modal'
import { applyMotionClass, reducedMotion, uiState } from './state'

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

/**
 * Is this résumé chapter readable yet? Every chapter but one is won by a game;
 * Contact never is — the way to reach Naman is always one interaction away.
 *
 * The list is `uiState.unlocked`, which the scenes mirror from the save. Panels
 * never reach into `GameState` for it (that would drag the game into the DOM
 * layer), so this is deliberately the same rule written twice.
 */
export function isUnlocked(id: string): boolean {
  return id === 'contact' || uiState.unlocked.includes(id)
}

/**
 * One chapter as a row in a list (the Journal's Résumé tab, Sol's prize shelf).
 * A locked row shows the hint in place of the title — never the title itself,
 * which is already half the chapter.
 *
 * A locked row also carries what the fair already shows about the chapter: the
 * venue, or — where the venue is shared — the label on the prize box, `short`.
 * All three projects are won at the one tent, so three "Project · Prize Tent"
 * rows carrying the same hint would be the same row three times; the prize
 * label tells them apart and gives nothing away, since the cabinet shows it to
 * anyone who walks up to it. Plus whatever `progress` the caller has for the
 * chapter ("3 / 10 forged"). A won row needs none of it — it has the chapter's
 * own title to show.
 */
export function zoneRow(z: Zone, progress?: string): string {
  const on = isUnlocked(z.id)
  const where = z.short ?? z.name
  // `has-prog` opens the row's fourth column. Only the row that renders a pill
  // gets it: on every other row that column would be dead space taken off the
  // hint beside it.
  const pill = !on && !!progress
  return (
    `<button type="button" class="rs-row${on ? '' : ' locked'}${pill ? ' has-prog' : ''}" data-zone="${esc(z.id)}" style="--accent:${accentOf(z)}">` +
    `<span class="rs-mark" aria-hidden="true">${on ? '✓' : '🔒'}</span>` +
    `<span class="rs-label">${esc(z.label)}${on ? '' : `<span class="rs-where"> · ${esc(where)}</span>`}</span>` +
    `<span class="rs-note">${esc(on ? z.content.title : (STORY_HINTS[z.id] ?? ''))}</span>` +
    (pill ? `<span class="rs-prog">${esc(progress)}</span>` : '') +
    `<span class="sr-only">${on ? 'Unlocked' : 'Locked'}</span></button>`
  )
}

/**
 * The card a chapter shows before it has been won: the lock, the chapter's
 * *label*, and the one line `STORY_HINTS` allows about where the game that
 * opens it is played. No kicker, no title, no body, no chips — a locked card
 * that leaked its own content would hand over the ending on the first click.
 */
function openLockedZone(z: Zone): void {
  const modalId = `zone:${z.id}`
  const box = el('article', 'book locked')
  box.style.setProperty('--accent', accentOf(z))
  box.dataset.width = '460px'
  box.innerHTML = `
    <div class="book-stripe" aria-hidden="true"></div>
    <button type="button" class="modal-x book-x" aria-label="Close">✕</button>
    <div class="book-page">
      <span class="book-lock" aria-hidden="true">🔒</span>
      <p class="d-kicker">LOCKED</p>
      <h2 class="d-title">${esc(z.label)}</h2>
      <p class="d-body">${esc(STORY_HINTS[z.id] ?? '')}</p>
    </div>
    <footer class="book-foot"><span class="book-tag">${esc(z.name)}</span>
      <button type="button" class="pbtn" data-act="map">Show on map</button>
      <button type="button" class="pbtn" data-act="close">Close</button></footer>`
  box.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-act="map"]')) return
    // The card knows its chapter, not which stall hands it over; the map turns
    // one into the other (`attractionFor`, pinned by tests/ui-map.test.ts).
    closeModal(modalId)
    events.emit('ui:panel', { id: 'map', data: { focus: z.id } })
  })
  wireClose(box, modalId)
  openModal({ id: modalId, el: box, label: `${z.label} — locked` })
}

export function openZone(id: string): void {
  const z = ZONES.find((x) => x.id === id)
  if (!z) return
  // Already the card on top: opening it again would stack a second copy and
  // close it, which is exactly what the lighthouse lens used to do — its
  // `signal` node unlocks `contact` (the queue opens the card) *and* carries a
  // `panel: 'zone:contact'` effect, so the same card arrived twice.
  if (topModalId() === `zone:${id}`) return
  if (!isUnlocked(id)) {
    openLockedZone(z)
    return
  }
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

/* ---------------- finger post ---------------- */

const ARROW: Record<SignDir, string> = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' }
const HEADING: Record<SignDir, string> = {
  N: 'North',
  NE: 'North-east',
  E: 'East',
  SE: 'South-east',
  S: 'South',
  SW: 'South-west',
  W: 'West',
  NW: 'North-west',
}

/**
 * The card a finger post opens: one row per arm — arrow, destination, small
 * print. The arrow is decorative; the heading it stands for is spelled out for
 * screen readers instead.
 */
export function openSign(sign: SignDef | string): void {
  const def = typeof sign === 'string' ? signById(sign) : sign
  if (!def) return
  const box = el('article', 'signcard')
  box.dataset.width = '420px'
  const arms = def.arms
    .map(
      (a) =>
        `<li class="sign-arm"><span class="sign-arrow" aria-hidden="true">${ARROW[a.dir]}</span>` +
        `<span class="sign-way"><span class="sign-dir sr-only">${esc(HEADING[a.dir])}:</span>` +
        `<b class="sign-label">${esc(a.label)}</b>` +
        (a.note ? `<span class="sign-note">${esc(a.note)}</span>` : '') +
        '</span></li>',
    )
    .join('')
  box.innerHTML = `
    <div class="sign-post" aria-hidden="true"></div>
    <button type="button" class="modal-x" aria-label="Close">✕</button>
    <h2 class="sign-title">Finger post</h2>
    <ul class="sign-arms">${arms}</ul>
    <footer class="sign-foot"><span class="sign-hint">Press <kbd>E</kbd> or <kbd>Esc</kbd> to walk on</span><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  const id = `sign:${def.id}`
  wireClose(box, id)
  openModal({ id, el: box, label: 'Sign — where the roads go' })
  // E reads a sign and E walks on from it. The listener sits on the panel (where
  // the modal manager parks focus and traps it) so it catches the key wherever
  // inside the dialog it is pressed — which also means it is live for the rest of
  // the very press that opened the card: opening moved focus here, so every
  // further keydown of that one press lands on this listener and would shut the
  // card it just opened. `e.repeat` catches only the browser's own auto-repeat,
  // so the release is the guard instead: the close arms on the first keyup the
  // dialog sees, which is the end of the opening press whichever key it was.
  // Both listeners live on the panel, so this needs nothing from the game's input
  // module and both die with the card.
  const panelEl = box.parentElement
  let armed = false
  panelEl?.addEventListener('keyup', () => {
    armed = true
  })
  panelEl?.addEventListener('keydown', (e) => {
    if (e.repeat || (e.key !== 'e' && e.key !== 'E')) return
    e.preventDefault()
    e.stopImmediatePropagation()
    if (!armed) return // still the press that opened the card
    closeModal(id)
  })
}

/* ---------------- controls / credits ---------------- */

export function openControls(): void {
  const box = el('div', 'controls')
  box.dataset.width = '600px'
  const rows: [string, string][] = [
    ['Move', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> · left stick · joystick'],
    ['Walk (running is the default)', '<kbd>Shift</kbd> · gamepad <kbd>B</kbd>'],
    ['Hop', '<kbd>Space</kbd> · gamepad <kbd>X</kbd> · touch <kbd>B</kbd>'],
    ['Talk · act', '<kbd>E</kbd> <kbd>Enter</kbd> · gamepad <kbd>A</kbd> · touch <kbd>A</kbd>'],
    ['Next line', '<kbd>E</kbd> <kbd>Space</kbd> <kbd>Enter</kbd>'],
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
      <p><b>Naman's World Fair</b> is the portfolio of ${esc(PROFILE.name)}, ${esc(PROFILE.role)} at ${esc(PROFILE.company)}.</p>
      <p>Built with Phaser 3, TypeScript and Vite. Every sprite, tile and building is painted procedurally while the game loads, and the music and sounds are synthesised with Web Audio — there are no asset files at all.</p>
      <p>Type: Inter for reading, Pixelify Sans for headings.</p>
      <p class="credits-thanks">Thanks for exploring. 🎡</p>
    </div>
    <footer class="modal-foot"><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  wireClose(box, 'credits')
  openModal({ id: 'credits', el: box, label: 'Credits' })
}

/* ---------------- chapters won mid-game ---------------- */

/**
 * Chapters won while something else is on screen. A mini-game ends inside its
 * own modal, so the card it earned queues behind it and opens on the next
 * `ui:closed` — one card at a time, in the order they were won (the claw hands
 * over three).
 */
const facetQueue: string[] = []

function flushFacets(): void {
  if (!facetQueue.length || isModalOpen()) return
  openZone(facetQueue.shift()!)
}

/* ---------------- router ---------------- */

export function initPanels(): void {
  initModals()
  applyMotionClass()
  registerPanel('controls', openControls)
  registerPanel('credits', openCredits)
  registerPanel('sign', (data) => {
    if (typeof data === 'string') openSign(data)
  })
  if (routing) return
  routing = true
  events.on('ui:panel', ({ id, data }) => {
    if (id.startsWith('zone:')) {
      openZone(id.slice(5))
      return
    }
    handlers.get(id)?.(data)
  })
  events.on('facet:unlocked', ({ id, first, announce }) => {
    // Record it first, whatever the announcement asks for: a game that opens
    // the card itself (the claw, `announce: false`) must not find it locked.
    // The scenes mirror the save into `unlocked` too — this is idempotent.
    if (!uiState.unlocked.includes(id)) uiState.unlocked.push(id)
    if (!announce || !first) return
    facetQueue.push(id)
    flushFacets()
  })
  events.on('ui:closed', () => flushFacets())
  // Leaving the fair drops whatever was still waiting to be read: quitting
  // closes every modal, and each of those `ui:closed` events would otherwise
  // pop a chapter card up over the title screen and shut it again.
  const drop = () => {
    facetQueue.length = 0
  }
  events.on('game:title', drop)
  events.on('game:new', drop)
}

/* ---------------- a card that is not a chapter ---------------- */

/**
 * Open an arbitrary content block in the chapter book's own furniture.
 *
 * Some cards are not a zone: Word Forge finishes on a cumulative "Naman's tech
 * stack" that is the Skills content plus the tools the player actually spelled,
 * and the Career Coaster ends on a synthetic Career card built from two zones at
 * once. Neither has a `Zone` behind it, so neither can go through `openZone` —
 * but both should read exactly like one.
 *
 * The only difference is the accent: with no zone to take a colour from, the box
 * sets none and inherits the UI's own `--accent`.
 */
export function openContent(content: Content, foot: string, id = 'content'): void {
  if (topModalId() === id) return
  const box = el('article', 'book')
  box.dataset.width = '680px'
  box.innerHTML = `
    <div class="book-stripe" aria-hidden="true"></div>
    <button type="button" class="modal-x book-x" aria-label="Close">✕</button>
    <div class="book-page">${contentHTML(content)}</div>
    <footer class="book-foot"><span class="book-tag">${esc(foot)}</span><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  const title = box.querySelector<HTMLElement>('.d-title')!
  const cancel = typeText(title, content.title, 400)
  wireClose(box, id)
  openModal({ id, el: box, label: content.title, onClose: cancel })
}
