// Barclays Tower elevator: floor buttons, a short ride, one card per floor.
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { ZONES } from '../data/content'
import { el, esc, openModal } from './modal'
import { isUnlocked, panelHead, registerPanel, wireClose } from './panels'
import { reducedMotion } from './state'

/** What the lobby says while the Experience chapter is still unwon. No digits. */
const NO_PASS = 'The lift wants a visitor pass. Bo hands them out at the pier — solve his word puzzle.'

export type Role = { head: string; text: string }

/**
 * Split the experience body at its markers: the ⭐ paragraph heads the SDE
 * role, the 🛠️ paragraph heads the internship; each keeps the following
 * paragraphs up to the next marker as its text.
 */
export function splitRoles(body: string[]): { sde: Role; intern: Role } {
  const isMarker = (p: string) => p.startsWith('⭐') || p.startsWith('🛠')
  const grab = (m: string): Role => {
    const i = body.findIndex((p) => p.startsWith(m))
    if (i < 0) return { head: '', text: '' }
    const head = body[i].replace(/^[^A-Za-z0-9]+/, '').trim()
    const rest: string[] = []
    for (let k = i + 1; k < body.length && !isMarker(body[k]); k++) rest.push(body[k])
    return { head, text: rest.join('\n\n').trim() }
  }
  return { sde: grab('⭐'), intern: grab('🛠') }
}

type Floor = { key: string; label: string; sub?: string; frame: 0 | 1 | 2 | 3; level: number }

const FLOORS: Floor[] = [
  { key: 'G', label: 'Lobby', frame: 0, level: 0 },
  { key: '2', label: 'DevOps Intern', sub: 'Jun–Aug 2023', frame: 1, level: 2 },
  { key: '5', label: 'Software Development Engineer', sub: 'Aug 2024–now', frame: 2, level: 5 },
  { key: 'R', label: 'Rooftop', sub: 'the stack', frame: 3, level: 7 },
]
const DIGIT = ['G', '1', '2', '3', '4', '5', '6', 'R']

export function openElevator(): void {
  const zone = ZONES.find((z) => z.id === 'experience')
  if (!zone) return
  const roles = splitRoles(zone.content.body ?? [])
  const stack = zone.content.chips ?? []
  // The tower is a re-read spot for a chapter you have to win first: without the
  // pass the lift stays in the lobby and the floors above it say nothing at all.
  const locked = !isUnlocked('experience')
  const box = el('div', 'elev' + (locked ? ' locked' : ''))
  box.dataset.width = '780px'
  box.innerHTML = `${panelHead('Barclays Tower', 'ELEVATOR')}
    <div class="elev-body">
      <div class="elev-panel">
        <div class="elev-counter" aria-hidden="true"><span class="elev-arrow"></span><span class="elev-digit">G</span></div>
        <div class="elev-buttons" role="group" aria-label="Floors">
          ${FLOORS.map((f, i) => {
            // A locked floor is a blank on the panel: the dates and the job
            // titles printed beside these buttons *are* the chapter.
            const blank = locked && i > 0
            return (
              `<button type="button" class="ebtn" data-floor="${i}" aria-pressed="${i === 0}"${i === 0 ? ' data-autofocus' : ''}>` +
              `<b aria-hidden="true">${blank ? '?' : f.key}</b>` +
              `<span>${blank ? 'Floor ?' : esc(f.label) + (f.sub ? `<small>${esc(f.sub)}</small>` : '')}</span></button>`
            )
          }).join('')}
        </div>
      </div>
      <div class="elev-car">
        <div class="elev-window" data-frame="0" aria-hidden="true"><i class="ew-far"></i><i class="ew-near"></i><i class="ew-glass"></i></div>
        <div class="elev-card" aria-live="polite"></div>
      </div>
    </div>`
  const card = box.querySelector('.elev-card') as HTMLElement
  const digit = box.querySelector('.elev-digit') as HTMLElement
  const arrow = box.querySelector('.elev-arrow') as HTMLElement
  const win = box.querySelector('.elev-window') as HTMLElement
  const buttons = Array.from(box.querySelectorAll<HTMLButtonElement>('.ebtn'))
  let at = 0
  let timer = 0
  let settleTimer = 0

  const cardHTML = (i: number): string => {
    if (i === 0)
      return (
        `<p class="elev-kicker">GROUND FLOOR</p><h3>Welcome to Barclays Tower</h3>` +
        `<p>${locked ? NO_PASS : `Naman's floors of the bank, one ride at a time. Pick a floor — the lift is slow, the streams are not.`}</p>`
      )
    if (i === 1) return `<p class="elev-kicker">FLOOR 2 · INTERNSHIP</p><h3>${esc(roles.intern.head)}</h3><p>${esc(roles.intern.text)}</p>`
    if (i === 2) return `<p class="elev-kicker">FLOOR 5 · CURRENT ROLE</p><h3>${esc(roles.sde.head)}</h3><p>${esc(roles.sde.text)}</p>`
    return `<p class="elev-kicker">ROOFTOP · THE STACK</p><h3>Tools with a view</h3><p>The stack the lineage engine runs on:</p><ul class="badges">${stack
      .map((c) => `<li class="badge">${esc(c)}</li>`)
      .join('')}</ul>`
  }
  const render = (i: number) => {
    digit.textContent = DIGIT[FLOORS[i].level] ?? 'G'
    arrow.textContent = ''
    win.dataset.frame = String(FLOORS[i].frame)
    card.innerHTML = cardHTML(i)
    card.classList.remove('in')
    void card.offsetWidth
    card.classList.add('in')
  }
  const arrive = (i: number) => {
    at = i
    box.classList.remove('moving')
    buttons.forEach((b, k) => (b.disabled = locked && k > 0))
    events.emit('room:window', { frame: FLOORS[i].frame })
    sfx.pickup()
    render(i)
    buttons[i]?.focus({ preventScroll: true })
  }
  const go = (i: number) => {
    if (i === at || i < 0 || i >= FLOORS.length || box.classList.contains('moving')) return
    sfx.select()
    buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    if (reducedMotion()) {
      arrive(i)
      return
    }
    box.classList.add('moving')
    buttons.forEach((b) => (b.disabled = true))
    const from = FLOORS[at].level
    const to = FLOORS[i].level
    const dir = to > from ? 1 : -1
    arrow.textContent = dir > 0 ? '▲' : '▼'
    let cur = from
    window.clearInterval(timer)
    timer = window.setInterval(() => {
      cur += dir
      digit.textContent = DIGIT[cur] ?? String(cur)
      sfx.blip()
      if (cur === to) {
        window.clearInterval(timer)
        settleTimer = window.setTimeout(() => arrive(i), 220)
      }
    }, 130)
  }
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.ebtn')
    if (b) go(Number(b.dataset.floor))
  })
  box.addEventListener('keydown', (e) => {
    if (!(e.target as HTMLElement).closest('.ebtn')) return
    const active = document.activeElement as HTMLButtonElement | null
    const i = buttons.findIndex((b) => b === active)
    if (i < 0) return
    if (e.key === 'ArrowDown') buttons[(i + 1) % buttons.length].focus()
    else if (e.key === 'ArrowUp') buttons[(i + buttons.length - 1) % buttons.length].focus()
    else return
    e.preventDefault()
  })
  wireClose(box, 'elevator')
  if (locked) buttons.forEach((b, k) => (b.disabled = k > 0))
  render(0)
  openModal({
    id: 'elevator',
    el: box,
    label: 'Barclays Tower elevator',
    onClose: () => {
      window.clearInterval(timer)
      window.clearTimeout(settleTimer)
    },
  })
}

export function initElevator(): void {
  registerPanel('elevator', () => openElevator())
}
