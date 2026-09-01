import { events, touchInput } from '../core/events'

export function initTouch(root: HTMLElement): void {
  const wrap = document.createElement('div')
  wrap.className = 'touch hidden'
  wrap.innerHTML = `
    <div class="joy"><div class="joy-base"><div class="joy-thumb"></div></div></div>
    <div class="tbuttons">
      <button class="tb tb-b" aria-label="Run">B</button>
      <button class="tb tb-a" aria-label="Interact">A</button>
    </div>
    <button class="tb tb-menu" aria-label="Menu">≡</button>`
  root.appendChild(wrap)

  const base = wrap.querySelector('.joy-base') as HTMLElement
  const thumb = wrap.querySelector('.joy-thumb') as HTMLElement
  let id: number | null = null
  let cx = 0
  let cy = 0
  const R = 40
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
    touchInput.x = dx / R
    touchInput.y = dy / R
  }
  const end = (e: PointerEvent) => {
    if (id !== e.pointerId) return
    id = null
    touchInput.active = false
    touchInput.x = 0
    touchInput.y = 0
    thumb.style.transform = 'translate(0,0)'
  }
  base.addEventListener('pointerdown', (e) => {
    base.setPointerCapture(e.pointerId)
    id = e.pointerId
    const r = base.getBoundingClientRect()
    cx = r.left + r.width / 2
    cy = r.top + r.height / 2
    touchInput.active = true
    move(e)
  })
  base.addEventListener('pointermove', move)
  base.addEventListener('pointerup', end)
  base.addEventListener('pointercancel', end)

  const a = wrap.querySelector('.tb-a') as HTMLButtonElement
  const b = wrap.querySelector('.tb-b') as HTMLButtonElement
  const m = wrap.querySelector('.tb-menu') as HTMLButtonElement
  a.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    touchInput.aHeld = true
    events.emit('world:action', { action: 'interact' })
  })
  const aOff = () => (touchInput.aHeld = false)
  a.addEventListener('pointerup', aOff)
  a.addEventListener('pointercancel', aOff)
  a.addEventListener('pointerleave', aOff)
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    touchInput.run = true
  })
  const runOff = () => (touchInput.run = false)
  b.addEventListener('pointerup', runOff)
  b.addEventListener('pointercancel', runOff)
  b.addEventListener('pointerleave', runOff)
  m.addEventListener('click', () => events.emit('world:action', { action: 'menu' }))

  const wantTouch = () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
  let forced: 'auto' | 'on' | 'off' = 'auto'
  const apply = () => {
    const on = forced === 'on' || (forced === 'auto' && wantTouch())
    wrap.classList.toggle('hidden', !on || document.body.classList.contains('at-title'))
  }
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && forced === 'auto') {
      forced = 'on'
      apply()
    }
  })
  events.on('ui:hud', () => setTimeout(apply, 0))
  events.on('settings:changed', () => apply())
  ;(window as unknown as { __setTouch?: (v: 'auto' | 'on' | 'off') => void }).__setTouch = (v) => {
    forced = v
    apply()
  }
}
