// Pause menu: Resume / Map / Journal / Wardrobe / Settings / Reader Mode /
// Controls / Credits / Title — and the wardrobe panel itself.
import { frameDataURL } from '../art/atlas'
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { hatName } from '../systems/GameState'
import { closeAllModals, closeModal, el, esc, openModal, topModalId } from './modal'
import { panelHead, registerPanel, wireClose } from './panels'
import { uiState } from './state'

const ITEMS: [string, string][] = [
  ['resume', 'Resume'],
  ['map', 'Map'],
  ['journal', 'Journal'],
  ['wardrobe', 'Wardrobe'],
  ['settings', 'Settings'],
  ['reader', 'Reader Mode'],
  ['controls', 'Controls'],
  ['credits', 'Credits'],
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
      case 'wardrobe':
      case 'settings':
      case 'controls':
      case 'credits':
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

/* ---------------- wardrobe ---------------- */

/**
 * The hat rack: bare-headed, then every hat won so far. The icons are the same
 * pixels the player wears — pulled out of the atlas as data URLs — and fall back
 * to a glyph before the atlas is painted (or in a test, where there is none).
 */
export function openWardrobe(): void {
  const w = uiState.wardrobe
  const owned = [...w.hats]
  const box = el('div', 'wardrobe')
  box.dataset.width = '460px'
  const option = (id: string) => {
    const url = id ? frameDataURL(`hat_${id}`, 3) : ''
    const on = w.equipped === id
    return (
      `<button type="button" class="wr-opt${on ? ' on' : ''}" data-hat="${esc(id)}" aria-pressed="${on}"${on ? ' data-autofocus' : ''}>` +
      (url
        ? `<i class="wr-ic" aria-hidden="true" style="background-image:url(${url})"></i>`
        : `<i class="wr-ic wr-ic-none" aria-hidden="true">${id ? '🎩' : '—'}</i>`) +
      `<span class="wr-name">${esc(id ? hatName(id) : 'No hat')}</span>` +
      `<span class="wr-on" aria-hidden="true">Worn</span></button>`
    )
  }
  box.innerHTML = `${panelHead('Wardrobe', `${owned.length} ${owned.length === 1 ? 'HAT' : 'HATS'}`)}
    <div class="wr-rack" role="group" aria-label="Hats">${['', ...owned].map(option).join('')}</div>
    ${owned.length ? '' : '<p class="wr-empty">No hat yet. Quests and the island’s games hand them out.</p>'}
    <p class="wr-live sr-only" role="status" aria-live="polite"></p>
    <footer class="modal-foot"><span class="wr-keys"><kbd>↑</kbd><kbd>↓</kbd> choose · <kbd>Enter</kbd> wear</span><button type="button" class="pbtn" data-act="close">Done</button></footer>`

  const opts = Array.from(box.querySelectorAll<HTMLButtonElement>('.wr-opt'))
  const live = box.querySelector('.wr-live') as HTMLElement
  const pick = (i: number) => {
    const id = opts[i]?.dataset.hat
    if (id == null || !w.equip(id)) return
    for (const b of opts) {
      const on = b.dataset.hat === id
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', String(on))
    }
    live.textContent = id ? `Wearing the ${hatName(id).toLowerCase()}.` : 'Hat off.'
    sfx.select()
  }
  const focusIdx = (i: number) => {
    const n = (i + opts.length) % opts.length
    opts[n]?.focus({ preventScroll: true })
    sfx.blip()
  }
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.wr-opt')
    if (b) pick(opts.indexOf(b))
  })
  box.addEventListener('keydown', (e) => {
    const at = opts.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const k = e.key
    // Enter is handled here rather than left to the button's own activation so
    // the key and the mouse take exactly the same path.
    if (k === 'Enter') pick(at)
    else if (k === 'ArrowDown' || k === 'ArrowRight') focusIdx(at + 1)
    else if (k === 'ArrowUp' || k === 'ArrowLeft') focusIdx(at - 1)
    else if (k === 'Home') focusIdx(0)
    else if (k === 'End') focusIdx(opts.length - 1)
    else return
    e.preventDefault()
  })
  wireClose(box, 'wardrobe')
  openModal({ id: 'wardrobe', el: box, label: 'Wardrobe' })
}

export function initPause(): void {
  registerPanel('pause', () => openPause())
  registerPanel('wardrobe', () => openWardrobe())
}
