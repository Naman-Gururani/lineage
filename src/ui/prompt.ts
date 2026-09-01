import { events } from '../core/events'

export function initPrompt(root: HTMLElement): void {
  const el = document.createElement('div')
  el.className = 'prompt'
  el.setAttribute('aria-live', 'polite')
  root.appendChild(el)
  events.on('ui:prompt', ({ text, key }) => {
    if (!text) {
      el.classList.remove('show')
      return
    }
    el.innerHTML = `<kbd class="pkey">${key ?? 'E'}</kbd><span></span>`
    ;(el.querySelector('span') as HTMLElement).textContent = text
    el.classList.add('show')
  })
  const hint = document.createElement('div')
  hint.className = 'hint'
  root.appendChild(hint)
  let hintTimer = 0
  events.on('ui:hint', ({ text }) => {
    clearTimeout(hintTimer)
    if (!text) {
      hint.classList.remove('show')
      return
    }
    hint.textContent = text
    hint.classList.add('show')
    hintTimer = window.setTimeout(() => hint.classList.remove('show'), 4200)
  })
}
