// Pause menu: Resume / Map / Journal / Settings / Reader Mode / Controls / Title.
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { closeAllModals, closeModal, el, openModal, topModalId } from './modal'
import { registerPanel } from './panels'

const ITEMS: [string, string][] = [
  ['resume', 'Resume'],
  ['map', 'Map'],
  ['journal', 'Journal'],
  ['settings', 'Settings'],
  ['reader', 'Reader Mode'],
  ['controls', 'Controls'],
  ['title', 'Back to Title'],
]

export function openPause(): void {
  if (topModalId() === 'pause') return
  const box = el('div', 'pause')
  box.dataset.width = '400px'
  box.innerHTML = `
    <div class="pause-head"><span class="pause-kicker">PAUSED</span><h2 class="modal-title">Menu</h2></div>
    <nav class="pause-menu" aria-label="Pause menu">${ITEMS.map(
      ([a, l], i) => `<button type="button" class="mbtn${i === 0 ? ' sel' : ''}" data-act="${a}"${i === 0 ? ' data-autofocus' : ''}>${l}</button>`,
    ).join('')}</nav>
    <p class="pause-foot"><kbd>↑</kbd><kbd>↓</kbd> choose · <kbd>Enter</kbd> select · <kbd>Esc</kbd> resume</p>`
  const buttons = Array.from(box.querySelectorAll<HTMLButtonElement>('.mbtn'))
  let index = 0
  const mark = (i: number) => {
    index = (i + buttons.length) % buttons.length
    buttons.forEach((b, k) => b.classList.toggle('sel', k === index))
  }
  const focusIdx = (i: number) => {
    mark(i)
    buttons[index].focus({ preventScroll: true })
  }
  const act = (a: string) => {
    if (a !== 'resume') sfx.select()
    switch (a) {
      case 'resume':
        closeModal('pause')
        break
      case 'map':
      case 'journal':
      case 'settings':
      case 'controls':
        events.emit('ui:panel', { id: a })
        break
      case 'reader':
        closeAllModals()
        events.emit('ui:panel', { id: 'reader' })
        break
      case 'title':
        closeAllModals()
        events.emit('game:title', {})
        break
    }
  }
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mbtn')
    if (b) act(b.dataset.act!)
  })
  box.addEventListener('mousemove', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mbtn')
    if (!b) return
    const i = buttons.indexOf(b)
    if (i >= 0 && i !== index) focusIdx(i)
  })
  box.addEventListener('focusin', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mbtn')
    const i = b ? buttons.indexOf(b) : -1
    if (i >= 0) mark(i)
  })
  box.addEventListener('keydown', (e) => {
    const k = e.key
    if (k === 'ArrowDown' || k === 's' || k === 'S') focusIdx(index + 1)
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') focusIdx(index - 1)
    else if (k === 'Home') focusIdx(0)
    else if (k === 'End') focusIdx(buttons.length - 1)
    else return
    sfx.blip()
    e.preventDefault()
  })
  events.emit('game:pause', {})
  openModal({ id: 'pause', el: box, label: 'Pause menu', onClose: () => events.emit('game:resume', {}) })
}

export function initPause(): void {
  registerPanel('pause', () => openPause())
}
