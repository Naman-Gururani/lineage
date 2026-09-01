import { events } from '../core/events'

export function initLoading(root: HTMLElement): void {
  let box = document.getElementById('loading')
  if (!box) {
    box = document.createElement('div')
    box.id = 'loading'
    root.appendChild(box)
  }
  box.innerHTML = `
    <div class="load-logo">NAMAN'S WORLD</div>
    <div class="load-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="load-fill"></div></div>
    <div class="load-label">Painting sprites…</div>`
  const bar = box.querySelector('.load-bar') as HTMLElement
  const fill = box.querySelector('.load-fill') as HTMLElement
  const label = box.querySelector('.load-label') as HTMLElement
  events.on('load:progress', ({ pct, label: text }) => {
    fill.style.width = pct + '%'
    bar.setAttribute('aria-valuenow', String(pct))
    label.textContent = pct >= 100 ? 'Ready' : text + '…'
    if (pct >= 100) {
      box!.classList.add('gone')
      setTimeout(() => box!.remove(), 600)
    }
  })
}
