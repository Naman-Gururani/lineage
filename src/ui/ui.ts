import { bus } from '../game/bus'
import { touch } from '../game/input-state'
import { sfx } from '../game/sound'
import { ZONES, type Zone, type Content } from '../data/content'

const visited = new Set<string>()

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html != null) n.innerHTML = html
  return n
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function contentHTML(c: Content): string {
  let h = ''
  if (c.kicker) h += `<p class="d-kicker">${esc(c.kicker)}</p>`
  h += `<h2 class="d-title">${c.title}</h2>`
  if (c.sub) h += `<p class="d-sub">${c.sub}</p>`
  if (c.body) for (const p of c.body) h += `<p class="d-body">${p}</p>`
  if (c.facts) {
    h += '<ul class="d-facts">'
    for (const f of c.facts) h += `<li><span>${esc(f.k)}</span><b>${esc(f.v)}</b></li>`
    h += '</ul>'
  }
  if (c.groups) {
    for (const g of c.groups) {
      h += `<div class="d-group"><span class="d-glabel">${esc(g.label)}</span><div class="chips">`
      for (const it of g.items) h += `<span class="chip">${esc(it)}</span>`
      h += '</div></div>'
    }
  }
  if (c.points) {
    h += '<ul class="d-points">'
    for (const p of c.points) h += `<li>${p}</li>`
    h += '</ul>'
  }
  if (c.chips) {
    h += '<div class="chips">'
    for (const it of c.chips) h += `<span class="chip">${esc(it)}</span>`
    h += '</div>'
  }
  if (c.links) {
    h += '<div class="d-links">'
    for (const l of c.links) {
      const ext = l.ext ? ' target="_blank" rel="noopener noreferrer"' : ''
      const cue = l.ext ? '<span class="sr-only"> (opens in a new tab)</span>' : ''
      h += `<a class="d-link" href="${l.href}"${ext}><span class="d-llabel">${esc(l.label)}</span><span class="d-lval">${esc(l.value)}</span>${cue}<span class="d-larrow" aria-hidden="true">${l.ext ? '↗' : '→'}</span></a>`
    }
    h += '</div>'
  }
  return h
}

export function initUI() {
  const ui = document.getElementById('ui')!

  // ---------- HUD ----------
  const hud = el('header', 'hud')
  hud.innerHTML = `
    <div class="hud-brand"><span class="hud-dot"></span> Naman’s World</div>
    <div class="hud-right">
      <div class="hud-orbs" title="Data orbs collected"><span class="orb-ic">◈</span> <b id="orb-n">0</b><span class="orb-sep">/</span><span id="orb-t">0</span></div>
      <button class="hud-btn" id="btn-sound" aria-label="Mute sound" aria-pressed="true">🔊</button>
      <button class="hud-btn hud-map" id="btn-map">🗺️ Map · Skip</button>
    </div>`
  ui.appendChild(hud)

  const orbN = hud.querySelector('#orb-n') as HTMLElement
  const orbT = hud.querySelector('#orb-t') as HTMLElement
  const btnSound = hud.querySelector('#btn-sound') as HTMLButtonElement
  const btnMap = hud.querySelector('#btn-map') as HTMLButtonElement

  btnSound.addEventListener('click', () => {
    const m = !sfx.isMuted()
    sfx.setMuted(m)
    btnSound.textContent = m ? '🔇' : '🔊'
    btnSound.setAttribute('aria-pressed', String(!m))
    btnSound.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound')
  })

  // ---------- interaction prompt ----------
  const prompt = el('div', 'prompt')
  prompt.setAttribute('aria-hidden', 'true')
  ui.appendChild(prompt)

  // ---------- intro hint ----------
  const hint = el('div', 'hint')
  hint.innerHTML = `
    <button class="hint-x" aria-label="Dismiss">✕</button>
    <p class="hint-h">Welcome to Naman’s World 🌴</p>
    <p>Walk around with <b>WASD / arrows</b> (or the joystick on touch). Wander into a glowing
    landmark and press <b>E</b> / tap <b>✦</b> to discover that part of his portfolio.</p>
    <p class="hint-skip">Not in the mood to explore? Hit <b>🗺️ Map · Skip</b> to jump anywhere or read everything.</p>`
  ui.appendChild(hint)
  const closeHint = () => hint.classList.add('gone')
  hint.querySelector('.hint-x')!.addEventListener('click', closeHint)

  // ---------- dialog (content panel) ----------
  const back = el('div', 'modal-back')
  back.setAttribute('aria-hidden', 'true')
  const dialog = el('div', 'dialog')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  back.appendChild(dialog)
  ui.appendChild(back)

  let lastFocus: HTMLElement | null = null
  const showDialog = (z: Zone) => {
    closeHint()
    visited.add(z.id)
    updateMenuState()
    lastFocus = document.activeElement as HTMLElement
    dialog.style.setProperty('--accent', '#' + z.accent.toString(16).padStart(6, '0'))
    dialog.innerHTML =
      `<button class="dialog-x" aria-label="Close">✕</button>` + contentHTML(z.content)
    back.classList.add('show')
    bus.emit('lock', true)
    sfx.open()
    const x = dialog.querySelector('.dialog-x') as HTMLButtonElement
    x.addEventListener('click', closeDialog)
    x.focus()
  }
  const closeDialog = () => {
    if (!back.classList.contains('show')) return
    back.classList.remove('show')
    bus.emit('lock', false)
    sfx.close()
    lastFocus?.focus?.()
  }
  back.addEventListener('mousedown', (e) => {
    if (e.target === back) closeDialog()
  })

  // ---------- map / menu (also the skip + accessibility path) ----------
  const menuBack = el('div', 'modal-back')
  const menu = el('div', 'menu')
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-modal', 'true')
  menu.setAttribute('aria-label', 'Map and quick travel')
  menuBack.appendChild(menu)
  ui.appendChild(menuBack)

  const buildMenu = () => {
    let rows = ''
    for (const z of ZONES) {
      rows += `<li class="menu-row" data-id="${z.id}">
        <button class="menu-open" data-id="${z.id}">
          <span class="menu-check" data-id="${z.id}">○</span>
          <span class="menu-name">${esc(z.name)}</span>
          <span class="menu-label">${esc(z.label)}</span>
        </button>
        <button class="menu-go" data-id="${z.id}" aria-label="Walk to ${esc(z.name)}">📍 Go</button>
      </li>`
    }
    menu.innerHTML = `
      <button class="dialog-x" aria-label="Close">✕</button>
      <h2 class="menu-title">🗺️ Map & Skip</h2>
      <p class="menu-hint">Open any place to read it now, or hit <b>Go</b> to walk your character there. Explore in any order — or skip the walking entirely.</p>
      <ul class="menu-list">${rows}</ul>`
    menu.querySelector('.dialog-x')!.addEventListener('click', closeMenu)
    menu.querySelectorAll<HTMLButtonElement>('.menu-open').forEach((b) =>
      b.addEventListener('click', () => {
        const z = ZONES.find((zz) => zz.id === b.dataset.id)!
        closeMenu()
        showDialog(z)
      }),
    )
    menu.querySelectorAll<HTMLButtonElement>('.menu-go').forEach((b) =>
      b.addEventListener('click', () => {
        const z = ZONES.find((zz) => zz.id === b.dataset.id)!
        closeMenu()
        bus.emit('travel', z)
      }),
    )
    updateMenuState()
  }
  const updateMenuState = () => {
    menu.querySelectorAll<HTMLElement>('.menu-check').forEach((c) => {
      if (visited.has(c.dataset.id!)) {
        c.textContent = '✓'
        c.classList.add('done')
      }
    })
  }
  const openMenu = () => {
    sfx.open()
    menuBack.classList.add('show')
    bus.emit('lock', true)
    ;(menu.querySelector('.menu-open') as HTMLElement)?.focus()
  }
  const closeMenu = () => {
    menuBack.classList.remove('show')
    bus.emit('lock', false)
    sfx.close()
  }
  menuBack.addEventListener('mousedown', (e) => {
    if (e.target === menuBack) closeMenu()
  })
  btnMap.addEventListener('click', openMenu)
  buildMenu()

  // Esc closes whatever is open
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (back.classList.contains('show')) closeDialog()
      else if (menuBack.classList.contains('show')) closeMenu()
    }
  })

  // ---------- touch controls ----------
  const joyWrap = el('div', 'joy joy-hidden')
  joyWrap.innerHTML = `<div class="joy-base"><div class="joy-thumb"></div></div>`
  const interactBtn = el('button', 'touch-act joy-hidden', '✦')
  interactBtn.setAttribute('aria-label', 'Interact')
  ui.appendChild(joyWrap)
  ui.appendChild(interactBtn)
  setupJoystick(joyWrap)
  interactBtn.addEventListener('click', () => bus.emit('interact'))

  const wantTouch = () =>
    window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 820
  const applyTouch = () => {
    const v = wantTouch()
    joyWrap.classList.toggle('joy-hidden', !v)
    interactBtn.classList.toggle('joy-hidden', !v)
  }
  applyTouch()
  window.addEventListener('resize', applyTouch)
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      joyWrap.classList.remove('joy-hidden')
      interactBtn.classList.remove('joy-hidden')
    }
  })

  // ---------- bus wiring ----------
  bus.on('ready', () => {
    document.getElementById('loading')?.classList.add('gone')
  })
  bus.on('orbs', (g: number, t: number) => {
    orbN.textContent = String(g)
    orbT.textContent = String(t)
    if (g > 0 && g === t) orbN.parentElement?.classList.add('full')
  })
  bus.on('prompt', (z: Zone | null) => {
    if (z) {
      prompt.innerHTML = `<span class="prompt-key">E</span> Enter <b>${esc(z.name)}</b>`
      prompt.classList.add('show')
    } else {
      prompt.classList.remove('show')
    }
  })
  bus.on('open', (z: Zone) => showDialog(z))
}

function setupJoystick(wrap: HTMLElement) {
  const base = wrap.querySelector('.joy-base') as HTMLElement
  const thumb = wrap.querySelector('.joy-thumb') as HTMLElement
  let id: number | null = null
  let cx = 0
  let cy = 0
  const R = 46

  const start = (e: PointerEvent) => {
    id = e.pointerId
    const r = base.getBoundingClientRect()
    cx = r.left + r.width / 2
    cy = r.top + r.height / 2
    touch.active = true
    move(e)
  }
  const move = (e: PointerEvent) => {
    if (id !== e.pointerId) return
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx = (dx / d) * R
      dy = (dy / d) * R
    }
    thumb.style.transform = `translate(${dx}px, ${dy}px)`
    touch.x = dx / R
    touch.y = dy / R
  }
  const end = (e: PointerEvent) => {
    if (id !== e.pointerId) return
    id = null
    touch.active = false
    touch.x = 0
    touch.y = 0
    thumb.style.transform = 'translate(0,0)'
  }
  base.addEventListener('pointerdown', (e) => {
    base.setPointerCapture(e.pointerId)
    start(e)
  })
  base.addEventListener('pointermove', move)
  base.addEventListener('pointerup', end)
  base.addEventListener('pointercancel', end)
}
