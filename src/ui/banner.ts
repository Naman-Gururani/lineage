import { events } from '../core/events'

export function initBanner(root: HTMLElement): void {
  const el = document.createElement('div')
  el.className = 'banner'
  el.setAttribute('role', 'status')
  el.innerHTML = `<div class="banner-line"></div><div class="banner-title"></div><div class="banner-sub"></div><div class="banner-line"></div>`
  root.appendChild(el)
  const title = el.querySelector('.banner-title') as HTMLElement
  const sub = el.querySelector('.banner-sub') as HTMLElement
  let timer = 0
  events.on('ui:banner', (b) => {
    title.textContent = b.title
    sub.textContent = b.sub ?? ''
    sub.hidden = !b.sub
    el.classList.remove('show')
    void el.offsetWidth // restart the animation
    el.classList.add('show')
    clearTimeout(timer)
    timer = window.setTimeout(() => el.classList.remove('show'), 2600)
  })

  const toasts = document.createElement('div')
  toasts.className = 'toasts'
  toasts.setAttribute('aria-live', 'polite')
  root.appendChild(toasts)
  events.on('ui:toast', (t) => {
    const n = document.createElement('div')
    n.className = `toast card toast-${t.kind ?? 'info'}`
    n.innerHTML = `<span class="toast-ic">${t.icon ?? ''}</span><span class="toast-body"><b></b><small></small></span>`
    ;(n.querySelector('b') as HTMLElement).textContent = t.title
    const s = n.querySelector('small') as HTMLElement
    s.textContent = t.sub ?? ''
    s.hidden = !t.sub
    toasts.appendChild(n)
    while (toasts.children.length > 6) toasts.firstElementChild?.remove()
    setTimeout(() => n.classList.add('out'), 3200)
    setTimeout(() => n.remove(), 3700)
  })
}
