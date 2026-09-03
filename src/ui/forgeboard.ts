// The prize board bolted to the side of Ravi's booth: the ten tools the Word
// Forge spells, grouped the way the Workshop card groups them, with the ones
// already forged lit up.
//
// It is a progress meter, never a cheat sheet. A word still to be forged shows
// one blank per letter and nothing else — no word, no tool name — because the
// whole point of the bench is that the toolkit is spelled out rather than read.
//
// The board owns no state. Whatever has been forged arrives in the panel
// payload (`ui:panel { id: 'forgeboard', data: progress }`, the same record the
// game writes into the save through `host.progress`), so this module never
// reaches into a save or a mini-game host to find it.
import { ZONES } from '../data/content'
import { FORGE_ROUNDS, groupOf, restore, type ForgeWord } from '../games/forge'
import { el, esc, openModal } from './modal'
import { panelHead, registerPanel, wireClose } from './panels'

/** The line under the board while there is still work on it. */
const NOTE = 'Spell them out at the bench and Ravi hangs them up.'

/** Every word on every wheel, in the order Ravi hangs them. */
function everyWord(): ForgeWord[] {
  return FORGE_ROUNDS.flatMap((r) => r.words)
}

/**
 * The board's rows, gathered under the Workshop card's own group headings and in
 * the card's own order — so the board reads as the card it is filling in, not as
 * the order the wheels happen to come in.
 */
function byGroup(words: ForgeWord[]): { label: string; words: ForgeWord[] }[] {
  const order = (ZONES.find((z) => z.id === 'skills')?.content.groups ?? []).map((g) => g.label)
  const out: { label: string; words: ForgeWord[] }[] = []
  for (const w of words) {
    const label = groupOf(w.skill)
    const had = out.find((g) => g.label === label)
    if (had) had.words.push(w)
    else out.push({ label, words: [w] })
  }
  // Groups the card does not list (there should be none) sort to the back
  // rather than disappearing — a tool with nowhere to hang is still forged.
  const rank = (label: string): number => {
    const i = order.indexOf(label)
    return i < 0 ? order.length : i
  }
  return out.sort((a, b) => rank(a.label) - rank(b.label))
}

function rowHTML(w: ForgeWord, found: boolean): string {
  if (found) {
    return (
      `<li class="fb-word on">` +
      `<span class="fb-w">${esc(w.word)}</span>` +
      `<span class="fb-skill">${esc(w.skill)}</span>` +
      `<span class="sr-only">forged</span></li>`
    )
  }
  // Sighted players can count the blanks; the row said only "not forged yet",
  // so a screen reader got ten rows that were all the same. The length is the
  // one thing the blanks already give away — the word and the tool behind it
  // still are not said, because the board is a meter and not a cheat sheet.
  const blanks = [...w.word].map(() => '<span class="fb-blank"></span>').join('')
  return `<li class="fb-word"><span class="fb-w" aria-hidden="true">${blanks}</span><span class="sr-only">${w.word.length}-letter tool, not forged yet</span></li>`
}

export function openForgeboard(data?: unknown): void {
  // `restore` is the same validator the bench itself mounts through, so a
  // payload the game would refuse is a payload the board refuses too.
  const found = restore(data).found
  const words = everyWord()
  const done = words.filter((w) => found.includes(w.word)).length

  const box = el('div', 'forgeboard')
  box.dataset.width = '560px'
  box.innerHTML =
    panelHead('Prize board', 'WORD FORGE') +
    `<p class="fb-count"><b>${done}</b> / ${words.length} forged</p>` +
    `<ul class="fb-groups" role="list">` +
    byGroup(words)
      .map(
        (g) =>
          `<li class="fb-group"><h3 class="fb-label">${esc(g.label)}</h3>` +
          `<ul class="fb-words" role="list">${g.words.map((w) => rowHTML(w, found.includes(w.word))).join('')}</ul></li>`,
      )
      .join('') +
    `</ul>` +
    `<footer class="modal-foot">` +
    (done < words.length ? `<span class="fb-note">${esc(NOTE)}</span>` : '') +
    `<button type="button" class="pbtn" data-act="close">Close</button></footer>`

  wireClose(box, 'forgeboard')
  openModal({ id: 'forgeboard', el: box, label: 'Word Forge prize board' })
}

export function initForgeboard(): void {
  registerPanel('forgeboard', (data) => openForgeboard(data))
}
