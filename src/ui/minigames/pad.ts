// The shared on-screen d-pad, lifted out of the retired Cargo Cove renderer.
//
// Every game has to be playable with taps, and the world's own joystick is inert
// underneath a modal, so a game that wants direction input on a phone mounts one
// of these into its footer. `.mg-pad` / `.mg-padbtn` in panels.css lay the four
// buttons out as a grid keyed off the direction class.
import { el } from '../modal'

export type PadDir = 'up' | 'down' | 'left' | 'right'

const GLYPH: Record<PadDir, string> = { up: '↑', left: '←', down: '↓', right: '→' }
/** DOM order = the grid's reading order, so Tab walks the pad the way it looks. */
const ORDER: PadDir[] = ['up', 'left', 'down', 'right']

/**
 * @param onDir fired per press — a click, a tap, or Enter/Space on a focused button.
 * @param opts.held for games that move while a direction is held down: the
 *   direction on press, `null` once the press ends, however it ends.
 */
export function mountPad(root: HTMLElement, onDir: (d: PadDir) => void, opts?: { held?: (d: PadDir | null) => void }): HTMLElement {
  const pad = el('div', 'mg-pad')
  pad.setAttribute('role', 'group')
  pad.setAttribute('aria-label', 'Direction pad')
  pad.innerHTML = ORDER.map(
    (d) => `<button type="button" class="mg-padbtn ${d}" data-dir="${d}" aria-label="Move ${d}">${GLYPH[d]}</button>`,
  ).join('')

  const dirOf = (e: Event): PadDir | undefined =>
    (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-dir]')?.dataset.dir as PadDir | undefined

  pad.addEventListener('click', (e) => {
    const d = dirOf(e)
    if (d) onDir(d)
  })

  const held = opts?.held
  if (held) {
    let active: PadDir | null = null
    const release = (): void => {
      if (!active) return
      active = null
      held(null)
    }
    pad.addEventListener('pointerdown', (e) => {
      const d = dirOf(e)
      if (!d) return
      active = d
      held(d)
    })
    pad.addEventListener('pointerup', release)
    pad.addEventListener('pointercancel', release)
    // `pointerleave` does not bubble, so on the pad it means the pointer left the
    // whole control — a thumb dragged off the buttons, whose `pointerup` would
    // otherwise land somewhere else and leave the direction stuck down.
    pad.addEventListener('pointerleave', release)
  }

  root.append(pad)
  return pad
}
