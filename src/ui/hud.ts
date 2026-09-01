import { events } from '../core/events'
import { clockOf, phaseAt } from '../core/time'

export function initHud(root: HTMLElement): void {
  const hud = document.createElement('header')
  hud.className = 'hud hidden'
  hud.innerHTML = `
    <div class="hud-left">
      <div class="hud-card hud-player">
        <div class="hud-portrait" aria-hidden="true"></div>
        <div class="hud-stats">
          <div class="hud-name">Explorer <span class="hud-level">Lv 1</span></div>
          <div class="hud-xp" role="progressbar" aria-label="Experience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="hud-xp-fill"></div></div>
        </div>
      </div>
      <div class="hud-card hud-counters">
        <span class="hud-count hud-packets" title="Lost packets recovered"><i class="ic ic-packet"></i><b>0</b>/20</span>
        <span class="hud-count hud-coins" title="Coins"><i class="ic ic-coin"></i><b>0</b></span>
      </div>
    </div>
    <div class="hud-right">
      <div class="hud-card hud-clock" title="Time of day"><i class="ic ic-sun"></i><span class="hud-time">07:00</span></div>
      <div class="hud-region"></div>
      <div class="hud-buttons">
        <button class="hbtn" data-act="map" title="Map (M)"><i class="ic ic-map"></i><span>Map</span></button>
        <button class="hbtn" data-act="journal" title="Journal (J)"><i class="ic ic-journal"></i><span>Journal</span></button>
        <button class="hbtn" data-act="menu" title="Menu (Esc)"><i class="ic ic-menu"></i><span>Menu</span></button>
      </div>
    </div>`
  root.appendChild(hud)

  const level = hud.querySelector('.hud-level') as HTMLElement
  const xpBar = hud.querySelector('.hud-xp') as HTMLElement
  const xpFill = hud.querySelector('.hud-xp-fill') as HTMLElement
  const packets = hud.querySelector('.hud-packets b') as HTMLElement
  const coins = hud.querySelector('.hud-coins b') as HTMLElement
  const time = hud.querySelector('.hud-time') as HTMLElement
  const clockIcon = hud.querySelector('.hud-clock .ic') as HTMLElement
  const region = hud.querySelector('.hud-region') as HTMLElement

  hud.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.hbtn')
    if (b) events.emit('world:action', { action: b.dataset.act as 'map' | 'journal' | 'menu' })
  })

  events.on('ui:hud', ({ visible }) => hud.classList.toggle('hidden', !visible))
  events.on('world:state', (s) => {
    level.textContent = `Lv ${s.level}`
    xpFill.style.width = `${Math.round(s.levelPct * 100)}%`
    xpBar.setAttribute('aria-valuenow', String(Math.round(s.levelPct * 100)))
    packets.textContent = String(s.packets)
    coins.textContent = String(s.coins)
    time.textContent = clockOf(s.time).label
    const p = phaseAt(s.time)
    clockIcon.className = `ic ${p === 'night' ? 'ic-moon' : p === 'dusk' || p === 'dawn' ? 'ic-dusk' : 'ic-sun'}`
    if (s.weather === 'rain') clockIcon.className = 'ic ic-rain'
    region.textContent = s.region
  })
}
