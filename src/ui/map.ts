// The island map (modal) and the always-on minimap widget.
import { sfx } from '../audio/sfx'
import { WORLD_H, WORLD_TH, WORLD_TW, WORLD_W } from '../config'
import { events } from '../core/events'
import { ZONES, type Zone } from '../data/content'
import { BLUEPRINT } from '../world/blueprint'
import { closeAllModals, closeModal, el, esc, openModal, uiRoot } from './modal'
import { accentOf, panelHead, registerPanel } from './panels'
import { uiState } from './state'

const KIND_ICON: Record<string, string> = {
  home: '🏠',
  tower: '🏢',
  workshop: '🛠️',
  engine: '⚙️',
  vault: '🔐',
  cottage: '🏡',
  lighthouse: '🗼',
  campus: '🎓',
}

/**
 * Discoverable landmarks — the "n/N FOUND" denominator and the pin set. Minor
 * buildings (the warehouse) are scenery with a door: no zone, no discovery, so
 * counting them would leave the tally stuck one short of full forever.
 */
const discoverable = () => BLUEPRINT.landmarks.filter((lm) => !lm.minor)

/**
 * Routes that are earned rather than found. The Tower Express is the Tower
 * Climb's prize: the entry is registered now and stays out of the map until the
 * flag lands, so nothing has to be added to this panel when the game ships.
 */
export const FAST_TRAVEL: { id: string; label: string; note: string; flag: string }[] = [
  { id: 'experience', label: 'Tower Express', note: 'Straight to Tower Heights, from anywhere', flag: 'tower_express' },
]

export const unlockedTravel = (): typeof FAST_TRAVEL => FAST_TRAVEL.filter((f) => !!uiState.flags[f.flag])

const zoneOf = (id: string): Zone | undefined => ZONES.find((z) => z.id === id)
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

function lmCentre(id: string): { x: number; y: number } {
  const lm = BLUEPRINT.landmarks.find((l) => l.id === id)!
  return { x: lm.tx + lm.w / 2, y: lm.ty + lm.h / 2 }
}

function nearestInDirection(buttons: HTMLButtonElement[], from: HTMLButtonElement | null, dx: number, dy: number): HTMLButtonElement | null {
  if (!from) return buttons[0] ?? null
  const o = lmCentre(from.dataset.id!)
  let best: HTMLButtonElement | null = null
  let score = Infinity
  for (const b of buttons) {
    if (b === from) continue
    const p = lmCentre(b.dataset.id!)
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

export function openMap(): void {
  const discovered = new Set(uiState.stats.discoveries)
  const box = el('div', 'map')
  box.dataset.width = '900px'
  let stage = uiState.minimapURL
    ? `<img class="map-img" alt="" draggable="false" src="${esc(uiState.minimapURL)}">`
    : '<div class="map-img map-img-empty" aria-hidden="true"></div>'
  for (const r of BLUEPRINT.regions) {
    const c = bboxCentre(r.poly)
    stage += `<span class="map-region" style="left:${pctX(c.x)};top:${pctY(c.y)}">${esc(r.name)}</span>`
  }
  for (const lm of discoverable()) {
    const z = zoneOf(lm.id)
    if (!z) continue
    const known = discovered.has(lm.id)
    const c = lmCentre(lm.id)
    stage +=
      `<button type="button" class="map-lm ${known ? 'known' : 'unknown'}" data-id="${lm.id}" ` +
      `style="left:${pctX(c.x)};top:${pctY(c.y)};--accent:${accentOf(z)}" ` +
      `aria-label="${known ? `${esc(z.name)} — ${esc(z.label)}` : 'Undiscovered landmark'}">` +
      `<span class="map-ic" aria-hidden="true">${known ? (KIND_ICON[z.kind] ?? '★') : '?'}</span>` +
      `<span class="map-lbl" aria-hidden="true">${known ? esc(z.label) : '?'}</span></button>`
  }
  stage += `<span class="map-player" role="img" aria-label="You are here" style="left:${((uiState.player.x / WORLD_W) * 100).toFixed(2)}%;top:${((uiState.player.y / WORLD_H) * 100).toFixed(2)}%"></span>`
  const express = unlockedTravel()
  box.innerHTML = `${panelHead('Lineage Isle', `${discovered.size}/${discoverable().length} FOUND`)}
    <div class="map-wrap"><div class="map-stage">${stage}</div></div>
    <div class="map-info"><p class="map-hint" aria-live="polite">Select a landmark — discovered places can be travelled to.</p><button type="button" class="pbtn primary map-travel" hidden>Travel ▶</button></div>
    ${
      express.length
        ? `<div class="map-express"><span class="map-express-lbl">Fast travel</span>${express
            .map(
              (f) =>
                `<button type="button" class="pbtn map-express-btn" data-travel="${esc(f.id)}">⚡ ${esc(f.label)}<small>${esc(f.note)}</small></button>`,
            )
            .join('')}</div>`
        : ''
    }`

  const hint = box.querySelector('.map-hint') as HTMLElement
  const travel = box.querySelector('.map-travel') as HTMLButtonElement
  const buttons = Array.from(box.querySelectorAll<HTMLButtonElement>('.map-lm'))
  let selId = ''
  const select = (id: string) => {
    selId = id
    buttons.forEach((b) => b.classList.toggle('sel', b.dataset.id === id))
    const z = zoneOf(id)
    if (!z) return
    if (discovered.has(id)) {
      hint.innerHTML =
        `<b>${esc(z.name)}</b> <span class="map-tag">${esc(z.label)}</span>` +
        (z.content.kicker ? `<span class="map-kick">${esc(z.content.kicker)}</span>` : '')
      travel.hidden = false
    } else {
      hint.textContent = 'An undiscovered place — you will have to find it on foot.'
      travel.hidden = true
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
    const route = t.closest<HTMLButtonElement>('[data-travel]')
    if (route) {
      goTo(route.dataset.travel!)
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
  openModal({ id: 'map', el: box, label: 'Island map' })
}

export function initMap(): void {
  registerPanel('map', () => openMap())
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
  btn.addEventListener('click', () => events.emit('ui:panel', { id: 'map' }))

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
    ctx.fillStyle = '#2b7fc0'
    ctx.fillRect(0, 0, 128, 96)
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, 128, 96)
    for (const lm of discoverable()) {
      const z = zoneOf(lm.id)
      const known = uiState.stats.discoveries.includes(lm.id)
      ctx.fillStyle = known && z ? accentOf(z) : 'rgba(253,251,244,0.55)'
      const x = Math.round(((lm.tx + lm.w / 2) / WORLD_TW) * 128)
      const y = Math.round(((lm.ty + lm.h / 2) / WORLD_TH) * 96)
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
