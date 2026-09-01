// Settings: sound sliders, text speed, display toggles, touch mode, reset save.
import { audio } from '../audio/engine'
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { clearSave, writeSettings, type Settings } from '../core/save'
import { closeAllModals, closeModal, el, openModal } from './modal'
import { panelHead, registerPanel, wireClose } from './panels'
import { applyMotionClass, uiState } from './state'

function applyToGame(s: Settings): void {
  writeSettings(s)
  applyMotionClass()
  audio.setVolumes(s)
  sfx.setVolume(s.master * s.sfx)
  sfx.setMuted(s.master === 0 || s.sfx === 0)
  const w = window as unknown as { __setTouch?: (v: 'auto' | 'on' | 'off') => void }
  w.__setTouch?.(s.touch)
  events.emit('settings:changed', {})
}

const pctOf = (v: number) => Math.round(v * 100)

export function openSettings(): void {
  const s = uiState.settings
  const box = el('form', 'settings')
  box.dataset.width = '560px'
  box.noValidate = true
  const slider = (name: string, label: string, v: number) =>
    `<label class="row"><span>${label}</span>` +
    `<input type="range" name="${name}" min="0" max="100" step="5" value="${pctOf(v)}" aria-label="${label} volume">` +
    `<output>${pctOf(v)}</output></label>`
  const seg = (name: string, label: string, opts: [string, string][], cur: string) =>
    `<div class="row seg-row"><span id="lbl-${name}">${label}</span>` +
    `<div class="seg" role="radiogroup" aria-labelledby="lbl-${name}">${opts
      .map(([v, l]) => `<label class="seg-opt"><input type="radio" name="${name}" value="${v}"${v === cur ? ' checked' : ''}><span>${l}</span></label>`)
      .join('')}</div></div>`
  const toggle = (name: string, label: string, on: boolean) =>
    `<label class="row toggle"><span>${label}</span><input type="checkbox" name="${name}"${on ? ' checked' : ''}><i class="switch" aria-hidden="true"></i></label>`
  box.innerHTML = `${panelHead('Settings')}
    <fieldset><legend>Sound</legend>
      ${slider('master', 'Master', s.master)}
      ${slider('music', 'Music', s.music)}
      ${slider('sfx', 'Effects', s.sfx)}
    </fieldset>
    <fieldset><legend>Text</legend>
      ${seg('textSpeed', 'Text speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], s.textSpeed)}
    </fieldset>
    <fieldset><legend>Display</legend>
      ${toggle('shake', 'Screen shake', s.shake)}
      ${toggle('reducedMotion', 'Reduced motion', s.reducedMotion)}
      ${toggle('minimap', 'Minimap', s.minimap)}
    </fieldset>
    <fieldset><legend>Touch controls</legend>
      ${seg('touch', 'Show touch controls', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], s.touch)}
    </fieldset>
    <div class="settings-foot">
      <button type="button" class="pbtn danger" data-act="reset">Reset save</button>
      <button type="button" class="pbtn primary" data-act="close">Done</button>
    </div>`
  const read = () => {
    const f = new FormData(box)
    const cur = uiState.settings
    const num = (k: string, d: number) => {
      const v = Number(f.get(k))
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v / 100)) : d
    }
    const ns: Settings = {
      master: num('master', cur.master),
      music: num('music', cur.music),
      sfx: num('sfx', cur.sfx),
      textSpeed: (f.get('textSpeed') as Settings['textSpeed']) ?? 'normal',
      shake: f.get('shake') != null,
      reducedMotion: f.get('reducedMotion') != null,
      minimap: f.get('minimap') != null,
      touch: (f.get('touch') as Settings['touch']) ?? 'auto',
    }
    uiState.settings = ns
    applyToGame(ns)
  }
  const onInput = (e: Event) => {
    const t = e.target as HTMLInputElement
    if (t.type === 'range') {
      const o = t.parentElement?.querySelector('output')
      if (o) o.textContent = t.value
    }
    read()
    if (t.type === 'range' && (t.name === 'sfx' || t.name === 'master')) sfx.blip()
  }
  box.addEventListener('input', onInput)
  box.addEventListener('change', onInput)
  box.addEventListener('submit', (e) => e.preventDefault())
  box.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="reset"]')) confirmReset()
  })
  wireClose(box, 'settings')
  openModal({ id: 'settings', el: box, label: 'Settings' })
}

function confirmReset(): void {
  const box = el('div', 'confirm')
  box.dataset.width = '440px'
  box.innerHTML = `
    <h2 class="modal-title">Reset save?</h2>
    <p>This wipes your explorer — discoveries, quests, badges, everything. The island will forget you.</p>
    <div class="confirm-actions">
      <button type="button" class="pbtn" data-act="cancel" data-autofocus>Keep playing</button>
      <button type="button" class="pbtn danger" data-act="wipe">Reset save</button>
    </div>`
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]')
    if (!b) return
    if (b.dataset.act === 'cancel') closeModal('confirm')
    else if (b.dataset.act === 'wipe') {
      clearSave()
      events.emit('save:changed', {})
      closeAllModals()
      events.emit('game:title', {})
    }
  })
  openModal({ id: 'confirm', el: box, label: 'Reset save?', closeOnBackdrop: false })
}

export function initSettings(): void {
  registerPanel('settings', () => openSettings())
  // push the loaded settings into the audio engine / touch / motion class at boot
  applyToGame(uiState.settings)
}
