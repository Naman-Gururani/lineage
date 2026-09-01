// The RPG dialogue box: portrait, name plate, typewriter text and choices.
// Drives a DialogueRunner; the returned promise resolves when it ends.
import { sfx } from '../audio/sfx'
import { events } from '../core/events'
import { hooks } from '../core/hooks'
import type { DialogueRunner, Emote } from '../systems/Dialogue'
import { el, esc, holdLock, isModalOpen, releaseLock, uiRoot } from './modal'
import { reducedMotion, uiState } from './state'

const SPEED: Record<string, number> = { slow: 40, normal: 25, fast: 12 }
const EMOTE: Record<Emote, string> = { happy: '♪', sad: '…', think: '?', shout: '!', wink: '☆' }

export type DialogueOptions = {
  /** npc id used for the portrait fallback (`face_<npc>`) when a line has no `face` */
  npc?: string
}

type Session = {
  runner: DialogueRunner
  npc?: string
  resolve: () => void
  typing: boolean
  timer: number
  chars: string[]
  i: number
  full: string
  choosing: boolean
  choiceIdx: number
  unsub: () => void
}

let root: HTMLElement | null = null
let box: HTMLElement
let portrait: HTMLElement
let who: HTMLElement
let emote: HTMLElement
let live: HTMLElement
let typed: HTMLElement
let choicesEl: HTMLElement
let next: HTMLElement
let current: Session | null = null
let hideTimer = 0
let keysInstalled = false

function ensure(): HTMLElement {
  if (root) {
    if (!root.isConnected) uiRoot().appendChild(root)
    return root
  }
  root = el('section', 'dlg hidden')
  root.setAttribute('aria-label', 'Dialogue')
  root.innerHTML = `
    <div class="dlg-box">
      <div class="dlg-portrait" aria-hidden="true"></div>
      <div class="dlg-main">
        <div class="dlg-name"><b class="dlg-who"></b><span class="dlg-emote" aria-hidden="true" hidden></span></div>
        <p class="dlg-text"><span class="sr-only dlg-live" aria-live="polite"></span><span class="dlg-typed" aria-hidden="true"></span></p>
        <ul class="dlg-choices" aria-label="Choices" hidden></ul>
        <span class="dlg-next" aria-hidden="true" hidden>▼</span>
      </div>
    </div>`
  const q = (s: string) => root!.querySelector<HTMLElement>(s)!
  box = q('.dlg-box')
  portrait = q('.dlg-portrait')
  who = q('.dlg-who')
  emote = q('.dlg-emote')
  live = q('.dlg-live')
  typed = q('.dlg-typed')
  choicesEl = q('.dlg-choices')
  next = q('.dlg-next')
  box.addEventListener('click', (e) => {
    if (!current) return
    const c = (e.target as HTMLElement).closest<HTMLElement>('.dlg-choice')
    if (c) {
      choose(Number(c.dataset.i))
      return
    }
    if (current.typing) completeLine()
    else if (!current.choosing) act()
  })
  uiRoot().appendChild(root)
  return root
}

/**
 * Window key handler. Installed at UI init — before Phaser boots — so it runs
 * ahead of the game's listener: the E/Space/Enter that ends a conversation is
 * stopped here and never also triggers the scene's interact (which would
 * immediately re-open the same conversation).
 */
function installKeys(): void {
  if (keysInstalled) return
  keysInstalled = true
  window.addEventListener('keydown', onKey)
}

function onKey(e: KeyboardEvent): void {
  const s = current
  if (!s || isModalOpen()) return
  const k = e.key
  let handled = true
  if (k === 'ArrowDown' || k === 's' || k === 'S') {
    if (s.choosing && !s.typing) moveChoice(1)
  } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
    if (s.choosing && !s.typing) moveChoice(-1)
  } else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') {
    if (!e.repeat) act()
  } else if (k === 'Escape') {
    if (s.typing) completeLine()
  } else handled = false
  if (handled) {
    e.preventDefault()
    e.stopImmediatePropagation()
  }
}

/* ---------------- flow ---------------- */

function act(): void {
  const s = current
  if (!s) return
  if (s.typing) {
    completeLine()
    return
  }
  if (s.choosing) {
    choose(s.choiceIdx)
    return
  }
  step(s.runner.advance())
}

function step(r: 'line' | 'choice' | 'end'): void {
  const s = current
  if (!s) return
  if (r === 'end' || s.runner.ended) {
    finish()
    return
  }
  if (r === 'choice') {
    showChoices()
    return
  }
  showLine()
}

function faceFor(s: Session, line: { who: string; face?: string }): string {
  const name = line.face ?? (s.npc ? `face_${s.npc}` : `face_${line.who.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
  return uiState.faces(name) || hooks.faces(name)
}

function showLine(): void {
  const s = current!
  const line = s.runner.line
  if (!line) {
    step(s.runner.advance())
    return
  }
  const url = faceFor(s, line)
  portrait.style.backgroundImage = url ? `url("${url}")` : ''
  box.classList.toggle('noface', !url)
  who.textContent = line.who
  if (line.emote) {
    emote.textContent = EMOTE[line.emote] ?? '!'
    emote.className = `dlg-emote emote-${line.emote}`
    emote.hidden = false
  } else emote.hidden = true
  live.textContent = `${line.who}: ${line.text}`
  choicesEl.hidden = true
  choicesEl.innerHTML = ''
  next.hidden = true
  s.choosing = false
  s.full = line.text
  s.chars = Array.from(line.text)
  s.i = 0
  typed.textContent = ''
  s.typing = true
  window.clearInterval(s.timer)
  const ms = SPEED[uiState.settings.textSpeed] ?? SPEED.normal
  s.timer = window.setInterval(() => tick(s), ms)
}

function tick(s: Session): void {
  if (current !== s) {
    window.clearInterval(s.timer)
    return
  }
  s.i++
  typed.textContent = s.chars.slice(0, s.i).join('')
  if (s.i % 2 === 0) sfx.blip()
  if (s.i >= s.chars.length) doneTyping(s)
}

function doneTyping(s: Session): void {
  window.clearInterval(s.timer)
  s.typing = false
  typed.textContent = s.full
  if (s.runner.atChoice) showChoices()
  else next.hidden = false
}

function completeLine(): void {
  if (current?.typing) doneTyping(current)
}

function showChoices(): void {
  const s = current!
  const cs = s.runner.choices
  if (!cs.length) {
    step(s.runner.advance())
    return
  }
  s.choosing = true
  s.choiceIdx = 0
  next.hidden = true
  choicesEl.innerHTML = cs.map((c, i) => `<li><button type="button" class="dlg-choice" data-i="${i}">${esc(c.text)}</button></li>`).join('')
  choicesEl.hidden = false
  highlight()
}

function highlight(): void {
  const s = current!
  const buttons = Array.from(choicesEl.querySelectorAll<HTMLButtonElement>('.dlg-choice'))
  buttons.forEach((b, i) => {
    b.classList.toggle('sel', i === s.choiceIdx)
    if (i === s.choiceIdx) b.setAttribute('aria-current', 'true')
    else b.removeAttribute('aria-current')
  })
  buttons[s.choiceIdx]?.focus({ preventScroll: true })
}

function moveChoice(d: number): void {
  const s = current!
  const n = s.runner.choices.length
  if (!n) return
  s.choiceIdx = (s.choiceIdx + d + n) % n
  highlight()
  sfx.blip()
}

function choose(i: number): void {
  const s = current
  if (!s || !s.choosing) return
  if (!s.runner.choices[i]) return
  sfx.select()
  s.runner.choose(i)
  s.choosing = false
  if (s.runner.ended) finish()
  else showLine()
}

function finish(): void {
  const s = current
  if (!s) return
  window.clearInterval(s.timer)
  current = null
  s.unsub()
  const r = root!
  r.classList.add('out')
  const hide = () => {
    if (current) return
    r.classList.add('hidden')
    r.classList.remove('out', 'show')
  }
  window.clearTimeout(hideTimer)
  if (reducedMotion()) hide()
  else hideTimer = window.setTimeout(hide, 120)
  releaseLock('dialogue')
  s.resolve()
}

/* ---------------- API ---------------- */

export function isDialogueOpen(): boolean {
  return current !== null
}

export function openDialogue(runner: DialogueRunner, opts: DialogueOptions = {}): Promise<void> {
  installKeys()
  const r = ensure()
  if (current) finish()
  return new Promise<void>((resolve) => {
    window.clearTimeout(hideTimer)
    r.classList.remove('hidden', 'out')
    r.classList.add('show')
    const unsub = events.on('world:action', ({ action }) => {
      if (action === 'interact' && !isModalOpen()) act()
    })
    current = { runner, npc: opts.npc, resolve, typing: false, timer: 0, chars: [], i: 0, full: '', choosing: false, choiceIdx: 0, unsub }
    holdLock('dialogue')
    sfx.blip()
    if (runner.ended) {
      finish()
      return
    }
    if (runner.atChoice) showChoices()
    else showLine()
  })
}

/** Create the box and install the key handler (call at UI init, before Phaser boots). */
export function initDialogue(): void {
  ensure()
  installKeys()
}
