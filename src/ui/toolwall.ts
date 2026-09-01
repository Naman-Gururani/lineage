// The Workshop pegboard: one skills group per wall, tools hanging on hooks,
// with the "How I work" note pinned beside the first wall.
import { sfx } from '../audio/sfx'
import { ZONES } from '../data/content'
import { el, esc, openModal } from './modal'
import { panelHead, registerPanel, wireClose } from './panels'

const ICONS: Record<string, string> = {
  Java: '☕',
  'Spring Boot': '🍃',
  Python: '🐍',
  'C++': '⚙️',
  SQL: '🗄️',
  'Apache Kafka': '📨',
  'Apache Flink': '🌊',
  'Kafka Streams': '🔁',
  'IBM MQ': '📬',
  Redis: '⚡',
  DynamoDB: '🗃️',
  Docker: '🐳',
  Linux: '🐧',
  Git: '🌿',
}

export function openToolwall(data?: unknown): void {
  const zone = ZONES.find((z) => z.id === 'skills')
  const groups = zone?.content.groups ?? []
  if (!zone || !groups.length) return
  const want = Number((data as { group?: number } | undefined)?.group ?? 0)
  let g = Number.isFinite(want) ? Math.min(Math.max(0, Math.trunc(want)), groups.length - 1) : 0

  const box = el('div', 'toolwall')
  box.dataset.width = '720px'
  box.innerHTML = `${panelHead('The Workshop', 'TOOL WALL')}
    <div class="toolwall-sub"><h3 class="tw-label"></h3><span class="tw-count"></span></div>
    <div class="peg">
      <ul class="tools"></ul>
      <aside class="note" hidden><span class="note-pin" aria-hidden="true"></span><p></p></aside>
    </div>
    <footer class="toolwall-foot">
      <button type="button" class="pbtn" data-nav="-1">◀ Prev wall</button>
      <span class="dots" aria-hidden="true"></span>
      <button type="button" class="pbtn" data-nav="1">Next wall ▶</button>
    </footer>`
  const label = box.querySelector('.tw-label') as HTMLElement
  const count = box.querySelector('.tw-count') as HTMLElement
  const tools = box.querySelector('.tools') as HTMLElement
  const note = box.querySelector('.note') as HTMLElement
  const noteP = note.querySelector('p') as HTMLElement
  const dots = box.querySelector('.dots') as HTMLElement
  const render = () => {
    const grp = groups[g]
    label.textContent = grp.label
    count.textContent = `wall ${g + 1} / ${groups.length}`
    tools.innerHTML = grp.items
      .map(
        (t, i) =>
          `<li class="tool" style="--i:${i}"><span class="tool-hook" aria-hidden="true"></span>` +
          `<span class="tool-ic" aria-hidden="true">${ICONS[t] ?? '🔧'}</span><span class="tool-name">${esc(t)}</span></li>`,
      )
      .join('')
    const showNote = g === 0 && !!zone.content.sub
    note.hidden = !showNote
    if (showNote) noteP.textContent = zone.content.sub ?? ''
    dots.textContent = groups.map((_, i) => (i === g ? '●' : '○')).join(' ')
  }
  const nav = (d: number) => {
    g = (g + d + groups.length) % groups.length
    sfx.blip()
    render()
  }
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-nav]')
    if (b) nav(Number(b.dataset.nav))
  })
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') nav(-1)
    else if (e.key === 'ArrowRight') nav(1)
    else return
    e.preventDefault()
  })
  wireClose(box, 'toolwall')
  render()
  openModal({ id: 'toolwall', el: box, label: 'The Workshop tool wall' })
}

export function initToolwall(): void {
  registerPanel('toolwall', (data) => openToolwall(data))
}
