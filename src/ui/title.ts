import { events } from '../core/events'
import { sfx } from '../audio/sfx'

export function initTitle(root: HTMLElement): void {
  const el = document.createElement('section')
  el.className = 'title hidden'
  el.setAttribute('aria-label', 'Title screen')
  el.innerHTML = `
    <div class="title-top">
      <div class="title-logo"><span>NAMAN'S</span><span>WORLD</span></div>
      <div class="title-sub">Lineage Isle</div>
      <div class="title-tag">an explorable portfolio</div>
    </div>
    <nav class="title-menu" aria-label="Main menu">
      <button class="tbtn" data-act="new">New Game</button>
      <button class="tbtn" data-act="continue" hidden>Continue</button>
      <button class="tbtn" data-act="reader">Reader Mode</button>
      <button class="tbtn" data-act="settings">Settings</button>
    </nav>
    <div class="title-foot">
      <span><kbd>WASD</kbd>/<kbd>↑↓←→</kbd> move</span><span><kbd>Shift</kbd> run</span><span><kbd>E</kbd> talk / act</span><span><kbd>Esc</kbd> menu</span>
    </div>`
  root.appendChild(el)

  const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.tbtn')).filter((b) => !b.hidden)
  let index = 0
  const focusIdx = (i: number) => {
    const bs = buttons()
    index = (i + bs.length) % bs.length
    bs.forEach((b, k) => b.classList.toggle('sel', k === index))
    bs[index]?.focus({ preventScroll: true })
  }

  const act = (a: string) => {
    sfx.select()
    if (a === 'new') {
      hide()
      events.emit('game:new', {})
    } else if (a === 'continue') {
      hide()
      events.emit('game:continue', {})
    } else if (a === 'reader') events.emit('game:reader', {})
    else if (a === 'settings') events.emit('ui:panel', { id: 'settings' })
  }
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tbtn')
    if (b) act(b.dataset.act!)
  })
  el.addEventListener('mousemove', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tbtn')
    if (b) {
      const bs = buttons()
      const i = bs.indexOf(b)
      if (i >= 0 && i !== index) focusIdx(i)
    }
  })
  const onKey = (e: KeyboardEvent) => {
    if (el.classList.contains('hidden')) return
    if (document.body.classList.contains('modal-open')) return
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      focusIdx(index + 1)
      sfx.blip()
      e.preventDefault()
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      focusIdx(index - 1)
      sfx.blip()
      e.preventDefault()
    } else if (e.key === 'Enter' || e.key === ' ') {
      act(buttons()[index].dataset.act!)
      e.preventDefault()
    }
  }
  window.addEventListener('keydown', onKey)

  const show = (hasSave: boolean) => {
    ;(el.querySelector('[data-act=continue]') as HTMLButtonElement).hidden = !hasSave
    el.classList.remove('hidden')
    focusIdx(hasSave ? 1 : 0)
    // unlock audio on the first gesture
    const unlock = () => {
      sfx.resume()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }
  const hide = () => el.classList.add('hidden')

  events.on('ui:title', ({ hasSave }) => show(hasSave))
  events.on('game:title', () => show(true))
}
