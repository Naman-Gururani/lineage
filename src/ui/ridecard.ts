// The Career Coaster's DOM: the milestone card that captions each résumé beat the
// cart stops at, and the Career card the ride parks on.
//
// The milestone card is a caption with one control, not a dialog. The cart waits
// at every beat until the rider presses Next, so the card carries the button that
// says so — but five modals in one ride would trap and release focus five times
// over, so it stays a caption: one element, `hidden` between beats so
// nothing lingers over the world, and no trap around it. Esc still belongs to the
// cutscene.
//
// The button takes focus as each beat lands, which makes Enter and Space the
// browser's own activation. `E` — the world's action key — is taken as well,
// from a `keydown` listener on the document that this file owns and removes the
// moment the card goes. It reads the DOM event, never `core/keys`: `ui/*` does
// not reach into the game's input layer (module-graph.test). The keys the card
// claims are stopped where they are caught, so the world behind the cutscene
// never sees them.
//
// The announcement is a *second* element. A live region only speaks when its
// text changes while it is in the tree, and the card is `hidden` at the moment
// each beat is written into it — so `aria-live` on the card itself announced
// nothing at all. The permanent `sr-only` status beside it is never hidden, and
// takes the whole beat as one line the moment the card updates.
import { events } from '../core/events'
import { careerCard } from '../data/coaster'
import { el, uiRoot } from './modal'
import { openContent, registerPanel } from './panels'
import { reducedMotion } from './state'

/** What the runner hands over at each beat — `COASTER_STOPS[i]`, minus its index. */
type Beat = { kicker: string; title: string; line: string }

/**
 * How long the card takes to slide back out. The same number as `--t-med` in
 * `styles/ui.css`, which is the transition `.ride-card` is given in `ride.css`:
 * hide the element any sooner and the slide is cut off half way down.
 */
const OUT_MS = 220

/** What the status line adds to every beat, because the beat is not the whole job. */
const CALL_TO_ACT = 'Press Next to continue.'

/** `KeyboardEvent.code`s that mean Next while a beat is up. */
const NEXT_CODES = new Set(['Enter', 'Space', 'KeyE'])

const isBeat = (d: unknown): d is Beat => {
  if (!d || typeof d !== 'object') return false
  const b = d as Partial<Beat>
  return typeof b.kicker === 'string' && typeof b.title === 'string' && typeof b.line === 'string'
}

let card: HTMLElement | null = null
let live: HTMLElement | null = null
let nextBtn: HTMLButtonElement | null = null
let outTimer = 0
/** A beat is on screen and its Next has not been answered yet. */
let showing = false
let listening = false

/**
 * The one card element and the one status line beside it, made on demand and
 * kept for the session. `isConnected` rather than a plain null check: the tests
 * (and a hard UI rebuild) replace the overlay root under us, and a card left
 * pointing at a detached node would show nothing at all.
 */
function ensure(): HTMLElement {
  if (card?.isConnected) return card
  const box = el('div', 'ride-card')
  box.hidden = true
  box.innerHTML =
    '<p class="ride-kicker"></p><h3 class="ride-title"></h3><p class="ride-line"></p>' +
    '<div class="ride-foot">' +
    '<button type="button" class="pbtn primary ride-next">Next ▶</button>' +
    '<span class="ride-keys">Enter · Space · E</span>' +
    '</div>'
  nextBtn = box.querySelector<HTMLButtonElement>('.ride-next')
  nextBtn?.addEventListener('click', advance)
  const say = el('p', 'ride-live sr-only')
  say.setAttribute('role', 'status')
  say.setAttribute('aria-live', 'polite')
  const root = uiRoot()
  root.appendChild(box)
  root.appendChild(say)
  card = box
  live = say
  return box
}

function put(box: HTMLElement, sel: string, text: string): void {
  const node = box.querySelector<HTMLElement>(sel)
  // textContent, never innerHTML: the copy is cut straight from `content.ts` and
  // has an em-dash and an ampersand or two in it. It is text, so it stays text.
  if (node) node.textContent = text
}

/**
 * The rider asked for the next beat. `showing` goes down first, so the browser's
 * own follow-up activation (a click after a Space keydown) and a second tap on a
 * card that is already sliding out both cost nothing: the runner is told once.
 */
function advance(): void {
  if (!showing) return
  showing = false
  events.emit('ride:next', {})
  hideBeat()
}

/** Enter, Space or E — by `code`, or by `key` for events that carry no code. */
function isNext(e: KeyboardEvent): boolean {
  if (NEXT_CODES.has(e.code)) return true
  const k = e.key
  return k === 'Enter' || k === ' ' || k === 'Spacebar' || k === 'e' || k === 'E'
}

function onNextKey(e: KeyboardEvent): void {
  // A held key is one beat, not the whole ride: without this, leaning on Enter
  // would deal out every card on the circuit before the first was read.
  if (!showing || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !isNext(e)) return
  // The world's own action key is listening on `window`, one hop further out, and
  // the cutscene it is behind does not stop it: this press is the card's and goes
  // no further. `preventDefault` also cancels the browser's native activation of
  // the focused button, which would otherwise arrive as a second Next.
  e.preventDefault()
  e.stopPropagation()
  advance()
}

/** One document listener at most, and only while there is a beat to dismiss. */
function listen(on: boolean): void {
  if (on === listening) return
  listening = on
  if (on) document.addEventListener('keydown', onNextKey)
  else document.removeEventListener('keydown', onNextKey)
}

/**
 * Hand focus back to the overlay root as the card goes. `#ui` is focusable but
 * not tabbable, so the ride's Esc hint and the world's keys keep working and Tab
 * carries on from the overlay rather than restarting at the top of the page.
 * Focus that has already moved on is left where it is — the last beat's card is
 * dismissed just as the Career card opens over it, and snatching focus back out
 * of that modal is worse than doing nothing.
 */
function releaseFocus(box: HTMLElement): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !box.contains(active)) return
  const root = uiRoot()
  if (!root.hasAttribute('tabindex')) root.tabIndex = -1
  root.focus({ preventScroll: true })
}

function showBeat(data: unknown): void {
  const box = ensure()
  window.clearTimeout(outTimer)
  if (!isBeat(data)) {
    hideBeat(true)
    return
  }
  put(box, '.ride-kicker', data.kicker)
  put(box, '.ride-title', data.title)
  put(box, '.ride-line', data.line)
  box.hidden = false
  box.classList.remove('in')
  void box.offsetWidth // restart the slide for a second beat
  box.classList.add('in')
  showing = true
  listen(true)
  // The button takes focus while the beat is up: Enter and Space are then the
  // browser's own activation, and anyone tabbing or reading their way through the
  // page lands on the one thing there is to do.
  nextBtn?.focus({ preventScroll: true })
  // One sentence, in the order the card reads: year, milestone, the line under
  // it, then what to press. Written last so the visible card and the spoken one
  // never disagree.
  if (live) live.textContent = `${data.kicker}. ${data.title}. ${data.line} ${CALL_TO_ACT}`
}

/**
 * Take the card away again. Reduced motion (and a payload that was not a beat)
 * clears it on the spot; otherwise it slides back down first, and the element is
 * only marked hidden once it has gone — a `hidden` element cannot animate.
 *
 * The button and its key listener go at once either way: the slide-out is
 * scenery, and a Next still live over a card that has been answered would ask the
 * runner for a beat the rider never saw.
 */
function hideBeat(now = false): void {
  const box = ensure()
  window.clearTimeout(outTimer)
  showing = false
  listen(false)
  releaseFocus(box)
  box.classList.remove('in')
  if (now || reducedMotion()) {
    box.hidden = true
    return
  }
  outTimer = window.setTimeout(() => {
    box.hidden = true
  }, OUT_MS)
}

let wired = false

export function initRidecard(): void {
  ensure()
  // `data: null` between beats, the beat itself at one. The runner never opens a
  // modal for these — the world is already locked behind the cutscene, and the
  // card answers back through `ride:next` rather than through a close button.
  registerPanel('ridecard', (data) => (data == null ? hideBeat() : showBeat(data)))
  // The payout. `careerCard()` assembles it out of the Experience and Education
  // chapters, so nothing here knows a single fact about Naman.
  registerPanel('career', () => openContent(careerCard(), 'Career Coaster · Career', 'career'))
  if (wired) return
  wired = true
  // A ride cut short (Esc, or quitting to the title) must not leave a caption
  // stranded over the world.
  events.on('ride:done', () => hideBeat(true))
  events.on('game:title', () => hideBeat(true))
}
