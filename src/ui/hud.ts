// The HUD: one glass chip cluster top-left (avatar, name + XP pill, packets,
// coins, clock, region) and the tool buttons top-right.
import { frameDataURL } from '../art/atlas'
import { events } from '../core/events'
import { clockOf, phaseAt } from '../core/time'

export function initHud(root: HTMLElement): void {
  const hud = document.createElement('header')
  hud.className = 'hud hidden'
  hud.innerHTML = `
    <div class="hud-left">
      <div class="card hud-cluster">
        <div class="hud-avatar" aria-hidden="true"></div>
        <div class="hud-id">
          <div class="hud-name">Explorer <span class="hud-level">Lv 1</span></div>
          <div class="hud-xp" role="progressbar" aria-label="Experience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="hud-xp-fill"></div></div>
        </div>
        <div class="hud-chips">
          <span class="hud-chip hud-packets" title="Lost packets recovered"><i class="ic ic-packet"></i><b>0</b><small>/<span class="hud-packets-total">20</span></small></span>
          <span class="hud-chip hud-coins" title="Coins"><i class="ic ic-coin"></i><b>0</b></span>
          <span class="hud-chip hud-clock" title="Time of day"><i class="ic ic-sun"></i><b class="hud-time">07:00</b></span>
          <span class="hud-chip hud-region-chip" hidden><span class="hud-region"></span></span>
        </div>
      </div>
    </div>
    <div class="hud-right">
      <div class="card hud-tools">
        <button class="hbtn" data-act="map" title="Map (M)"><i class="ic ic-map"></i><span>Map</span></button>
        <button class="hbtn" data-act="journal" title="Journal (J)"><i class="ic ic-journal"></i><span>Journal</span></button>
        <button class="hbtn" data-act="menu" title="Menu (Esc)"><i class="ic ic-menu"></i><span>Menu</span></button>
      </div>
    </div>`
  root.appendChild(hud)

  const q = <T extends HTMLElement>(s: string) => hud.querySelector(s) as T
  const avatar = q('.hud-avatar')
  const level = q('.hud-level')
  const xpBar = q('.hud-xp')
  const xpFill = q('.hud-xp-fill')
  const packets = q('.hud-packets b')
  const packetsTotal = q('.hud-packets-total')
  const coins = q('.hud-coins b')
  const time = q('.hud-time')
  const clockIcon = q('.hud-clock .ic')
  const regionChip = q('.hud-region-chip')
  const region = q('.hud-region')

  // BootScene paints the atlas long after the HUD mounts, so the portrait is
  // asked for lazily — on the first frame the HUD is on screen — and kept once
  // it comes back.
  let avatarSet = false
  const setAvatar = () => {
    if (avatarSet) return
    const url = frameDataURL('face_hero', 2)
    if (!url) return
    avatarSet = true
    avatar.style.backgroundImage = `url("${url}")`
  }

  hud.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.hbtn')
    if (b) events.emit('world:action', { action: b.dataset.act as 'map' | 'journal' | 'menu' })
  })

  events.on('ui:hud', ({ visible }) => {
    hud.classList.toggle('hidden', !visible)
    if (visible) setAvatar()
  })
  events.on('world:state', (s) => {
    setAvatar()
    level.textContent = `Lv ${s.level}`
    xpFill.style.width = `${Math.round(s.levelPct * 100)}%`
    xpBar.setAttribute('aria-valuenow', String(Math.round(s.levelPct * 100)))
    packets.textContent = String(s.packets)
    packetsTotal.textContent = String(s.packetsTotal)
    coins.textContent = String(s.coins)
    time.textContent = clockOf(s.time).label
    const p = phaseAt(s.time)
    clockIcon.className = `ic ${p === 'night' ? 'ic-moon' : p === 'dusk' || p === 'dawn' ? 'ic-dusk' : 'ic-sun'}`
    if (s.weather === 'rain') clockIcon.className = 'ic ic-rain'
    region.textContent = s.region
    regionChip.hidden = !s.region
  })
}
