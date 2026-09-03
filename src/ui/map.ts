// The fair map (modal) and the always-on minimap widget.
import { sfx } from '../audio/sfx'
import { WORLD_H, WORLD_TH, WORLD_TW, WORLD_W } from '../config'
import { events } from '../core/events'
import { ZONES, type Zone } from '../data/content'
import { BLUEPRINT, type Attraction, type AttractionId } from '../world/blueprint'
import { closeAllModals, closeModal, el, esc, openModal, uiRoot } from './modal'
import { accentOf, panelHead, registerPanel } from './panels'
import { uiState } from './state'

/** One glyph per attraction — what the stall *is*, not what it hands over. */
const ICON: Record<AttractionId, string> = {
  gate: '🎟️',
  coaster: '🎢',
  prizetent: '🎪',
  forge: '🔨',
  flight: '🪁',
  arcade: '🕹️',
  duckpond: '🦆',
  guestbook: '📖',
}

/** Pin colour for the three stalls that hand over no chapter: fair gold. */
const FAIR_ACCENT = 0xffd23f

/**
 * The pin set and the "n/8 FOUND" denominator: every attraction at the fair.
 * All eight are discoverable — there is no scenery with a door here, so nothing
 * can leave the tally stuck one short of full.
 */
const attractions = (): Attraction[] => BLUEPRINT.attractions

const zoneOf = (id: string): Zone | undefined => ZONES.find((z) => z.id === id)

/**
 * The attraction a pin request means. Panels ask by *chapter* — a locked card's
 * [Show on map] knows which chapter it is, not which stall hands it over — and
 * the story asks by attraction id. Both are answered here, id first.
 */
const attractionFor = (id: string): Attraction | undefined =>
  attractions().find((a) => a.id === id) ?? attractions().find((a) => a.zones.includes(id))

/**
 * The chapters a stall hands over, as the résumé labels them ('' for the fun
 * stalls). Deduped: the Prize Tent hands over three chapters and all three are
 * labelled "Project", which is one thing to say, not three.
 */
const chaptersOf = (a: Attraction): string => {
  const labels = a.zones.map((z) => zoneOf(z)?.label).filter((l): l is string => !!l)
  return [...new Set(labels)].join(' · ')
}

const accentFor = (a: Attraction): string => {
  const z = a.zones.map(zoneOf).find(Boolean)
  return accentOf(z ?? FAIR_ACCENT)
}

const pctX = (tx: number) => ((tx / WORLD_TW) * 100).toFixed(2) + '%'
const pctY = (ty: number) => ((ty / WORLD_TH) * 100).toFixed(2) + '%'

function bboxCentre(poly: { x: number; y: number }[]): { x: number; y: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of poly) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
}

const centreOf = (a: Attraction): { x: number; y: number } => ({ x: a.tx + a.w / 2, y: a.ty + a.h / 2 })

function nearestInDirection(buttons: HTMLButtonElement[], from: HTMLButtonElement | null, dx: number, dy: number): HTMLButtonElement | null {
  if (!from) return buttons[0] ?? null
  const start = attractionFor(from.dataset.id!)
  if (!start) return buttons[0] ?? null
  const o = centreOf(start)
  let best: HTMLButtonElement | null = null
  let score = Infinity
  for (const b of buttons) {
    if (b === from) continue
    const a = attractionFor(b.dataset.id!)
    if (!a) continue
    const p = centreOf(a)
    const vx = p.x - o.x
    const vy = p.y - o.y
    const along = vx * dx + vy * dy
    if (along <= 0) continue
    const perp = Math.abs(vx * dy - vy * dx)
    const s = along + perp * 2
    if (s < score) {
      score = s
      best = b
    }
  }
  return best
}

export function openMap(data?: { focus?: string }): void {
  const discovered = new Set(uiState.stats.discoveries)
  const objective = uiState.objective
  // The stall the story is sending you to. It names an attraction, but a
  // chapter is answered too, so the ring never lands on nothing.
  const objectivePin = objective ? attractionFor(objective.landmark) : undefined
  const box = el('div', 'map')
  box.dataset.width = '900px'
  let stage = uiState.minimapURL
    ? `<img class="map-img" alt="" draggable="false" src="${esc(uiState.minimapURL)}">`
    : '<div class="map-img map-img-empty" aria-hidden="true"></div>'
  for (const r of BLUEPRINT.regions) {
    const c = bboxCentre(r.poly)
    stage += `<span class="map-region" style="left:${pctX(c.x)};top:${pctY(c.y)}">${esc(r.name)}</span>`
  }
  // Where the story sends you next, pinned to its tile as well as to its stall:
  // the tile is where you are actually being sent (a door, not a roof).
  if (objective)
    stage += `<span class="map-objective" aria-hidden="true" style="left:${pctX(objective.tx + 0.5)};top:${pctY(objective.ty + 0.5)}"></span>`
  for (const a of attractions()) {
    const known = discovered.has(a.id)
    const c = centreOf(a)
    const chapters = chaptersOf(a)
    const isNext = objectivePin?.id === a.id
    // The ring round the story's next stall is a colour, and colour is the one
    // thing a screen reader cannot read. `aria-current` puts the pin in the set
    // as the current one; the label says it in words. It goes in the *label* and
    // not in an `sr-only` child because `aria-label` wins over anything inside
    // the button — a hidden span there would never be read at all.
    const name = (known ? (chapters ? `${a.name} — ${chapters}` : a.name) : 'Undiscovered attraction') + (isNext ? ' — the story goes here' : '')
    stage +=
      `<button type="button" class="map-lm ${known ? 'known' : 'unknown'}${isNext ? ' objective' : ''}" data-id="${a.id}" ` +
      `style="left:${pctX(c.x)};top:${pctY(c.y)};--accent:${accentFor(a)}" ` +
      `aria-pressed="false"${isNext ? ' aria-current="true"' : ''} ` +
      `aria-label="${esc(name)}">` +
      `<span class="map-ic" aria-hidden="true">${known ? ICON[a.id] : '?'}</span>` +
      `<span class="map-lbl" aria-hidden="true">${known ? esc(a.name) : '?'}</span></button>`
  }
  stage += `<span class="map-player" role="img" aria-label="You are here" style="left:${((uiState.player.x / WORLD_W) * 100).toFixed(2)}%;top:${((uiState.player.y / WORLD_H) * 100).toFixed(2)}%"></span>`
  box.innerHTML = `${panelHead("Naman's World Fair", `${discovered.size}/${attractions().length} FOUND`)}
    <div class="map-wrap"><div class="map-stage">${stage}</div></div>
    <div class="map-info"><p class="map-hint">Select an attraction — the ones you have found can be travelled to.</p><button type="button" class="pbtn primary map-travel" disabled>Travel ▶</button></div>`
  // Two deliberate absences above.
  //
  // `.map-hint` is not a live region. Moving between pins focuses a button, and
  // a focused button announces its own label; rewriting a live hint with the
  // same name at the same moment said everything twice.
  //
  // Travel is `disabled`, never `hidden`. Removing a control from the tab order
  // whenever the selection changes moves the furniture under the player's hands;
  // a button that is there and dimmed says the same thing and stays put.

  const hint = box.querySelector('.map-hint') as HTMLElement
  const travel = box.querySelector('.map-travel') as HTMLButtonElement
  const buttons = Array.from(box.querySelectorAll<HTMLButtonElement>('.map-lm'))
  let selId = ''
  const select = (id: string) => {
    selId = id
    buttons.forEach((b) => {
      const on = b.dataset.id === id
      b.classList.toggle('sel', on)
      b.setAttribute('aria-pressed', String(on))
    })
    const a = attractionFor(id)
    if (!a) return
    if (discovered.has(a.id)) {
      const chapters = chaptersOf(a)
      hint.innerHTML = `<b>${esc(a.name)}</b>` + (chapters ? ` <span class="map-tag">${esc(chapters)}</span>` : '')
      travel.disabled = false
    } else {
      hint.textContent = 'An undiscovered place — you will have to find it on foot.'
      travel.disabled = true
    }
  }
  const goTo = (id: string) => {
    sfx.select()
    closeAllModals()
    events.emit('world:travel', { id })
  }
  box.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t.closest('.modal-x')) {
      closeModal('map')
      return
    }
    const b = t.closest<HTMLButtonElement>('.map-lm')
    if (b) {
      select(b.dataset.id!)
      sfx.blip()
    }
  })
  travel.addEventListener('click', () => {
    if (!selId || !discovered.has(selId)) return
    goTo(selId)
  })
  box.addEventListener('focusin', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.map-lm')
    if (b) select(b.dataset.id!)
  })
  box.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      if (e.repeat) return // auto-repeat of the press that opened the map
      closeModal('map')
      e.preventDefault()
      return
    }
    const dir =
      e.key === 'ArrowLeft' ? [-1, 0] : e.key === 'ArrowRight' ? [1, 0] : e.key === 'ArrowUp' ? [0, -1] : e.key === 'ArrowDown' ? [0, 1] : null
    if (!dir) return
    const active = document.activeElement as HTMLButtonElement | null
    const from = buttons.find((b) => b === active) ?? buttons.find((b) => b.dataset.id === selId) ?? null
    const nxt = nearestInDirection(buttons, from, dir[0], dir[1])
    if (nxt) {
      nxt.focus({ preventScroll: true })
      select(nxt.dataset.id!)
      sfx.blip()
    }
    e.preventDefault()
  })
  // A locked card's [Show on map] asks for its chapter: select the stall that
  // hands it over and give it the opening focus, discovered or not — being told
  // where a place is does not make it somewhere you may travel to.
  const focus = data?.focus ? attractionFor(data.focus) : undefined
  const wanted = focus ? buttons.find((b) => b.dataset.id === focus.id) : undefined
  if (wanted) {
    select(wanted.dataset.id!)
    wanted.setAttribute('data-autofocus', '')
  }
  openModal({ id: 'map', el: box, label: 'Fair map' })
}

export function initMap(): void {
  registerPanel('map', (data) => openMap(data as { focus?: string } | undefined))
}

/* ---------------- minimap widget ---------------- */

let widget: HTMLButtonElement | null = null

export function initMinimap(): void {
  if (widget) return
  const btn = el('button', 'minimap hidden')
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Open map')
  btn.title = 'Map (M)'
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 96
  btn.appendChild(canvas)
  uiRoot().appendChild(btn)
  widget = btn
  btn.addEventListener('click', (e) => {
    // A pointer click would leave the widget focused, and the next Space (the
    // hop) would press it again; hand focus back first. Keyboard activation
    // (`detail` 0, no pointer) keeps its focus.
    if (e.detail > 0 || !!(e as PointerEvent).pointerType) btn.blur()
    events.emit('ui:panel', { id: 'map' })
  })

  let img: HTMLImageElement | null = null
  let loaded = ''
  let hudVisible = false
  const visible = () => hudVisible && uiState.settings.minimap && !document.body.classList.contains('at-title')
  const draw = () => {
    btn.classList.toggle('hidden', !visible())
    if (!visible()) return
    if (uiState.minimapURL && uiState.minimapURL !== loaded) {
      loaded = uiState.minimapURL
      img = new Image()
      img.onload = () => draw()
      img.src = loaded
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#3f7d3a'
    ctx.fillRect(0, 0, 128, 96)
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, 128, 96)
    for (const a of attractions()) {
      const known = uiState.stats.discoveries.includes(a.id)
      ctx.fillStyle = known ? accentFor(a) : 'rgba(253,251,244,0.55)'
      const c = centreOf(a)
      const x = Math.round((c.x / WORLD_TW) * 128)
      const y = Math.round((c.y / WORLD_TH) * 96)
      ctx.fillRect(x - 1, y - 1, 3, 3)
    }
    const px = Math.round((uiState.player.x / WORLD_W) * 128)
    const py = Math.round((uiState.player.y / WORLD_H) * 96)
    ctx.fillStyle = '#1b1a2e'
    ctx.fillRect(px - 2, py - 2, 5, 5)
    ctx.fillStyle = '#ffd23f'
    ctx.fillRect(px - 1, py - 1, 3, 3)
  }
  events.on('world:state', (s) => {
    if (typeof s.px === 'number') uiState.player.x = s.px
    if (typeof s.py === 'number') uiState.player.y = s.py
    uiState.stats.packets = s.packets
    uiState.stats.packetsTotal = s.packetsTotal
    draw()
  })
  events.on('ui:hud', ({ visible: v }) => {
    hudVisible = v
    draw()
  })
  events.on('ui:title', () => {
    hudVisible = false
    draw()
  })
  events.on('settings:changed', () => draw())
  events.on('world:discovered', () => draw())
}
