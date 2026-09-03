// The HUD: one glass chip cluster top-left (avatar, name + XP pill, tickets,
// coins, clock, region) and the tool buttons top-right.
import { frameDataURL } from '../art/atlas'
import { TILE } from '../config'
import { events } from '../core/events'
import { clockOf, phaseAt } from '../core/time'
import { applyToGame } from './settings'
import { uiState } from './state'

/** How often the compass re-reads the player position (twice a second). */
const OBJECTIVE_MS = 500
let objectiveTimer = 0
/** Dropped before a second `initHud` wires a second chip to the same event. */
let offStory: (() => void) | null = null
/** Dropped before a second `initHud` wires a second listener to the same event. */
let offMute: (() => void) | null = null

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
          <span class="hud-chip hud-packets" title="Lost tickets found"><i class="ic ic-packet"></i><b>0</b><small>/<span class="hud-packets-total">20</span></small></span>
          <span class="hud-chip hud-coins" title="Coins"><i class="ic ic-coin"></i><b>0</b></span>
          <span class="hud-chip hud-clock" title="Time of day"><i class="ic ic-sun"></i><b class="hud-time">07:00</b></span>
          <span class="hud-chip hud-region-chip" hidden><span class="hud-region"></span></span>
          <button type="button" class="hud-chip hud-objective" title="Where the story goes next — open the map" hidden><i class="hud-compass" aria-hidden="true">➤</i><span class="hud-obj-text"></span></button>
        </div>
      </div>
    </div>
    <div class="hud-right">
      <div class="card hud-tools">
        <button class="hbtn" data-act="map" title="Map (M)"><i class="ic ic-map"></i><span>Map</span></button>
        <button class="hbtn" data-act="journal" title="Journal (J)"><i class="ic ic-journal"></i><span>Journal</span></button>
        <button class="hbtn" data-act="menu" title="Menu (Esc)"><i class="ic ic-menu"></i><span>Menu</span></button>
        <button class="hbtn" data-act="mute" aria-pressed="${uiState.settings.muted}" title="${uiState.settings.muted ? 'Unmute sound' : 'Mute sound'}"><i class="ic ic-sound">${uiState.settings.muted ? '🔇' : '🔊'}</i><span>Sound</span></button>
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
  const objChip = q('.hud-objective')
  const objText = q('.hud-obj-text')
  const compass = q('.hud-compass')
  const muteBtn = q<HTMLButtonElement>('[data-act="mute"]')
  const muteIcon = q('.ic-sound')

  /**
   * The story's next stop, and which way it lies. The arrow glyph points east
   * at rest, which is exactly where `atan2` puts 0° — so the bearing from the
   * player to the middle of the objective tile is the rotation, no offset.
   * Hidden once the story is told (`objective` null).
   */
  const refreshObjective = () => {
    const o = uiState.objective
    objChip.hidden = !o
    if (!o) return
    objText.textContent = `Next: ${o.text}`
    const dx = o.tx * TILE + TILE / 2 - uiState.player.x
    const dy = o.ty * TILE + TILE / 2 - uiState.player.y
    compass.style.setProperty('--rot', `${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1)}deg`)
  }

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

  // Reflects `settings.muted`, whichever surface changed it — this button or
  // the Settings panel's own Sound toggle — so the two never disagree.
  const refreshMute = () => {
    const muted = uiState.settings.muted
    muteBtn.setAttribute('aria-pressed', String(muted))
    muteBtn.title = muted ? 'Unmute sound' : 'Mute sound'
    muteIcon.textContent = muted ? '🔇' : '🔊'
  }

  hud.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    // A pointer click leaves the button focused, and the next Space or Enter
    // would press it again — reopening the map, or flipping the mute — instead
    // of reaching the world, where Space is the hop. Hand focus back before
    // anything opens (so a panel's "return focus" lands on the game, not the
    // button). A keyboard activation has no pointer and `detail` 0: it keeps
    // its focus, so Tab users are not thrown off the bar.
    const pressed = t.closest<HTMLElement>('button')
    const byPointer = e.detail > 0 || !!(e as PointerEvent).pointerType
    if (pressed && byPointer) pressed.blur()
    // Through the scene, like the Map button beside it: `ui:panel` would open
    // the map over a cutscene or a locked world, which nothing else in the HUD
    // is allowed to do.
    if (t.closest('.hud-objective')) {
      events.emit('world:action', { action: 'map' })
      return
    }
    const b = t.closest<HTMLButtonElement>('.hbtn')
    if (!b) return
    if (b.dataset.act === 'mute') {
      // Always on screen, one tap: silences sfx and the soundtrack without
      // touching the volume sliders underneath, so unmuting restores them.
      const next = { ...uiState.settings, muted: !uiState.settings.muted }
      uiState.settings = next
      applyToGame(next)
      refreshMute()
      return
    }
    events.emit('world:action', { action: b.dataset.act as 'map' | 'journal' | 'menu' })
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
  // The player moves every frame and the objective changes twice an hour: a
  // slow poll costs nothing and keeps the arrow honest without a per-frame hook.
  // Poll and listener are both replaced, never stacked, if the HUD remounts.
  refreshObjective()
  offStory?.()
  offStory = events.on('story:changed', () => refreshObjective())
  window.clearInterval(objectiveTimer)
  objectiveTimer = window.setInterval(refreshObjective, OBJECTIVE_MS)

  refreshMute()
  offMute?.()
  offMute = events.on('settings:changed', () => refreshMute())
}
