// The boot screen: the name, the island's title and a thin progress bar.
import { events } from '../core/events'
import { PROFILE } from '../data/content'

export function initLoading(root: HTMLElement): void {
  let box = document.getElementById('loading')
  if (!box) {
    box = document.createElement('div')
    box.id = 'loading'
    root.appendChild(box)
  }
  box.innerHTML = `
    <p class="load-logo">${PROFILE.name}</p>
    <p class="load-kicker">Lineage Isle</p>
    <div class="load-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="load-fill"></span></div>
    <p class="load-label">Painting sprites…</p>`
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
