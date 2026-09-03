// "Show me the answers" — the one control every cabinet on the midway carries.
//
// The fair is a résumé, and a résumé that can only be read by somebody good at
// Wordle is not a résumé. So each game keeps a door in its footer that hands
// over whatever it was guarding: the word, the prizes, the whole tool wall — or,
// for the two games that guard nothing but a hat, simply the end of the round.
//
// What the door *costs* is the joke: a toast that says HR was watching. The
// button is deliberately last-but-one in the footer, right before Leave, where
// a player looking for a way out will find it and a player enjoying themselves
// will not trip over it.
import { events } from '../../core/events'
import { el } from '../modal'

/** The line every game's reveal button raises before it gives anything away. */
export const REVEAL_TOAST = 'Noted. HR sees everything.'

/**
 * Hang a reveal button in `root`'s footer and wire it to `onReveal`.
 *
 * `root` is the mini-game panel; the button goes into its `.mg-foot`, in front
 * of the Leave button so the two ways out sit together. The click is stopped
 * where it lands: every cabinet delegates its footer clicks from the panel root,
 * and none of them has ever heard of this button.
 */
export function mountReveal(root: HTMLElement, label: string, onReveal: () => boolean | void): HTMLButtonElement {
  const btn = el('button', 'pbtn mg-reveal')
  btn.type = 'button'
  btn.dataset.act = 'reveal'
  btn.textContent = label
  const foot = root.querySelector<HTMLElement>('.mg-foot') ?? root
  const leave = foot.querySelector<HTMLElement>('[data-act="quit"]')
  if (leave?.parentElement === foot) foot.insertBefore(btn, leave)
  else foot.appendChild(btn)
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    // A handler that declined (busy, already over, nothing to give) says so by
    // returning `false` — and HR does not get to see nothing.
    const ok = onReveal()
    if (ok !== false) events.emit('ui:toast', { kind: 'info', icon: '👀', title: REVEAL_TOAST })
  })
  return btn
}
