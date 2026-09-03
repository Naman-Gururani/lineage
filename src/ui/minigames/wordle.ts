// Bo's Word Puzzle — Wordle, as the site plays it, inside the mini-game modal.
//
// Everything that *decides* anything lives in `games/wordle.ts`: which word is
// up, how a guess scores, when the board is lost. This file is the board itself
// — six rows of five tiles, the on-screen QWERTY under them, the flip on reveal,
// the shake on a word the dictionary has never heard of — plus the one thing the
// real site does not have: Bo, leaning over the player's shoulder with a 💡.
//
// Two rules shape the code. The dictionary (fourteen thousand words) is
// dynamic-imported when the panel opens, so it costs the island's first paint
// nothing and the board stays *lenient* until it lands. And every key is caught
// on the modal root — `core/keys` is the world's input and must never hear a
// letter typed into a dialog.
import { MAX_HINTS, WORD_LEN, backspace, extraRow, hint, keyStates, newGame, pickAnswer, submit, typeLetter, type Mark, type WordleState } from '../../games/wordle'
import { afterWin, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { el } from '../modal'
import { panelHead } from '../panels'
import { reducedMotion } from '../state'
import { mountReveal } from './reveal'

/* ---------------- the look-up tables the board draws from ---------------- */

const KBD: string[][] = [[...'qwertyuiop'], [...'asdfghjkl'], ['enter', ...'zxcvbnm', 'back']]
const KEY_LABEL: Record<string, string> = { enter: '⏎', back: '⌫' }
const KEY_ARIA: Record<string, string> = { enter: 'Enter', back: 'Backspace' }

/** What a colour is called out loud, for the tile labels and the live line. */
const MARK_WORD: Record<Mark, string> = { g: 'correct', y: 'present', x: 'absent' }

/** Bo's running commentary — one line per hint spent, and none of them a number. */
const BO = ['Bo is watching.', 'Bo coughs meaningfully.', 'Bo points at a letter.', 'Bo has basically told you.']
const ORDINAL = ['first', 'second', 'third']

/** The reveal: one tile every `FLIP_STEP_MS`, each turning over for `FLIP_MS`. */
const FLIP_MS = 500
const FLIP_STEP_MS = 180
const SHAKE_MS = 460
const NOTE_MS = 1200

/**
 * Which word this player is on, and which word they just had. Module scope on
 * purpose: losing and asking for another one must hand out a *different*
 * word, and the panel is torn down and rebuilt between rounds, so neither can
 * live in the mount. `lastAnswer` is what `pickAnswer` is told to avoid, so a
 * fresh board — from a first open or a "Try again" — never wheels back onto
 * the word the player just had.
 */
let attempts = 0
let lastAnswer: string | undefined

/* ---------------- the dictionary, fetched the moment a board opens ---------------- */

let words: Set<string> | null = null
let loadingWords: Promise<void> | null = null

/**
 * Pull in the allowed-guess list, once per session, and tell the panel when it
 * has landed. Until then `isWord` says yes to everything: a player who types
 * faster than the network should never be told a real word is not one.
 */
function loadWords(root: HTMLElement): void {
  const mark = (): void => {
    if (words) root.dataset.dict = 'ready'
  }
  if (words) {
    mark()
    return
  }
  loadingWords ??= import('../../data/wordlist')
    .then((m) => {
      words = m.wordSet()
    })
    .catch(() => undefined)
  void loadingWords.then(mark)
}

const isWord = (w: string): boolean => !words || words.has(w)

/** `?word=kafka` pins the answer — for a demo, or for a test that needs to know it. */
function readOverride(): string | null {
  try {
    return new URLSearchParams(location.search).get('word')
  } catch {
    return null
  }
}

export function mountWordle(host: MinigameHost, root: HTMLElement): MinigameSession {
  loadWords(root)
  const override = readOverride()
  let state: WordleState = newGame(pickAnswer(attempts, override, Math.random, lastAnswer))
  lastAnswer = state.answer
  const timers: number[] = []
  /** True while a row is turning over: the board takes no input mid-reveal. */
  let busy = false

  root.innerHTML =
    panelHead("Bo's Word Puzzle", 'THE GATE') +
    `<p class="mg-rule">Guess the five-letter word in six tries. Green is right, yellow is misplaced.</p>` +
    `<div class="wd-hint" aria-live="polite"><div class="wd-hint-slots" aria-hidden="true"></div><p class="wd-bo"></p></div>` +
    `<div class="wd-board"><p class="wd-note" hidden></p><div class="wd-grid" role="grid" aria-label="Guesses"></div></div>` +
    `<div class="wd-kbd" role="group" aria-label="Letters"></div>` +
    `<footer class="mg-foot">` +
    `<button type="button" class="pbtn wd-hintbtn" data-act="hint">💡 Hint (${MAX_HINTS} left)</button>` +
    `<button type="button" class="pbtn" data-act="quit">Leave</button>` +
    `</footer>` +
    `<p class="mg-live sr-only" role="status"></p>`

  const grid = root.querySelector<HTMLElement>('.wd-grid')!
  const kbd = root.querySelector<HTMLElement>('.wd-kbd')!
  const slotBox = root.querySelector<HTMLElement>('.wd-hint-slots')!
  const bo = root.querySelector<HTMLElement>('.wd-bo')!
  const note = root.querySelector<HTMLElement>('.wd-note')!
  const hintBtn = root.querySelector<HTMLButtonElement>('.wd-hintbtn')!
  const live = root.querySelector<HTMLElement>('.mg-live')!

  // The stagger the CSS animates by is the stagger the timers below paint by;
  // handing the numbers to CSS from here is what keeps the two honest.
  grid.style.setProperty('--wd-flip', `${FLIP_MS}ms`)
  grid.style.setProperty('--wd-step', `${FLIP_STEP_MS}ms`)

  const say = (msg: string): void => {
    live.textContent = msg
  }

  const after = (ms: number, fn: () => void): void => {
    if (ms <= 0) {
      fn()
      return
    }
    timers.push(window.setTimeout(fn, ms))
  }

  /* ---------------- building the furniture ---------------- */

  for (const keys of KBD) {
    const kr = el('div', 'wd-kbd-row')
    for (const id of keys) {
      const b = el('button', 'wd-key')
      b.type = 'button'
      b.dataset.key = id
      b.dataset.state = ''
      b.textContent = KEY_LABEL[id] ?? id.toUpperCase()
      if (id.length > 1) {
        // ⏎ and ⌫ read as their names and take a key and a half, as on the site.
        b.setAttribute('aria-label', KEY_ARIA[id])
        b.classList.add('wide')
      }
      kr.appendChild(b)
    }
    kbd.appendChild(kr)
  }

  const slots: HTMLElement[] = []
  for (let i = 0; i < WORD_LEN; i++) {
    const s = el('span', 'wd-hint-slot')
    slotBox.appendChild(s)
    slots.push(s)
  }

  /** Grow the grid to the board's current height — seven rows once HR buys one. */
  function ensureRows(): void {
    while (grid.children.length < state.maxRows) {
      const row = el('div', 'wd-row')
      row.setAttribute('role', 'row')
      for (let c = 0; c < WORD_LEN; c++) {
        const tile = el('div', 'wd-tile')
        tile.setAttribute('role', 'gridcell')
        tile.dataset.state = ''
        tile.setAttribute('aria-label', 'blank')
        row.appendChild(tile)
      }
      grid.appendChild(row)
    }
  }

  const tilesOf = (r: number) => Array.from((grid.children[r] as HTMLElement).children) as HTMLElement[]

  /** One tile's whole truth: its letter, its colour, and how it reads aloud. */
  function paint(tile: HTMLElement, ch: string, mark?: Mark): void {
    tile.textContent = ch
    tile.dataset.state = mark ?? (ch ? 'filled' : '')
    tile.setAttribute('aria-label', ch ? (mark ? `${ch}, ${MARK_WORD[mark]}` : ch) : 'blank')
  }

  /* ---------------- drawing the state ---------------- */

  function render(): void {
    ensureRows()
    for (let r = 0; r < state.maxRows; r++) {
      const done = state.rows[r]
      const text = done ? done.guess : r === state.rows.length ? state.current : ''
      const tiles = tilesOf(r)
      for (let c = 0; c < WORD_LEN; c++) paint(tiles[c], (text[c] ?? '').toUpperCase(), done?.marks[c])
    }

    const ks = keyStates(state.rows)
    for (const b of Array.from(kbd.querySelectorAll<HTMLElement>('.wd-key'))) {
      const k = b.dataset.key ?? ''
      if (k.length === 1) b.dataset.state = ks[k] ?? ''
    }

    for (let i = 0; i < WORD_LEN; i++) slots[i].textContent = (state.hints[i] ?? '').toUpperCase()
    // Only when it changes: `.wd-hint` is a live region, and re-writing Bo's line
    // on every keystroke would have him mutter through the whole word.
    const line = BO[Math.min(state.hints.length, BO.length - 1)]
    if (bo.textContent !== line) bo.textContent = line

    const left = MAX_HINTS - state.hints.length
    hintBtn.textContent = `💡 Hint (${left} left)`
    hintBtn.disabled = left <= 0 || state.status !== 'play'
  }

  /**
   * The row that would not go in: a shake, and the reason, for a beat.
   *
   * Both timers are held rather than merely queued, because a player who bangs
   * out two bad words in a row would otherwise have the *first* one's timer cut
   * the second one's message and shake short.
   */
  let noteTimer = 0
  let shakeTimer = 0
  function bounce(kind: 'short' | 'notword'): void {
    const msg = kind === 'short' ? 'Not enough letters' : 'Not in word list'
    note.textContent = msg
    note.hidden = false
    say(msg)
    clearTimeout(noteTimer)
    noteTimer = window.setTimeout(() => {
      note.hidden = true
    }, NOTE_MS)
    timers.push(noteTimer)

    const row = grid.children[state.rows.length] as HTMLElement | undefined
    if (!row || reducedMotion()) return
    clearTimeout(shakeTimer)
    row.classList.remove('shake')
    void row.offsetWidth // a reflow, so a second bad word shakes again
    row.classList.add('shake')
    shakeTimer = window.setTimeout(() => row.classList.remove('shake'), SHAKE_MS)
    timers.push(shakeTimer)
  }

  /** Turn a submitted row over, one tile at a time, colouring at the halfway point. */
  function reveal(r: number, marks: Mark[]): void {
    const tiles = tilesOf(r)
    marks.forEach((m, i) => {
      const tile = tiles[i]
      if (reducedMotion()) {
        paint(tile, tile.textContent ?? '', m)
        return
      }
      tile.style.setProperty('--i', String(i))
      tile.classList.add('flip')
      after(i * FLIP_STEP_MS + FLIP_MS / 2, () => paint(tile, tile.textContent ?? '', m))
    })
  }

  /* ---------------- the moves ---------------- */

  function onLetter(ch: string): void {
    if (busy) return
    const next = typeLetter(state, ch)
    if (next === state) return
    state = next
    render()
  }

  function onBack(): void {
    if (busy) return
    const next = backspace(state)
    if (next === state) return
    state = next
    render()
  }

  function onEnter(): void {
    if (busy || state.status !== 'play') return
    const out = submit(state, isWord)
    if (out.error) {
      bounce(out.error)
      return
    }
    const r = state.rows.length
    state = out.state
    const { guess, marks } = state.rows[r]
    const spent = reducedMotion() ? 0 : FLIP_STEP_MS * (WORD_LEN - 1) + FLIP_MS
    busy = spent > 0
    reveal(r, marks)
    after(spent, () => {
      busy = false
      for (const t of tilesOf(r)) t.classList.remove('flip')
      render()
      const read = marks.map((m, i) => `${guess[i].toUpperCase()} ${MARK_WORD[m]}`).join(', ')
      if (state.status === 'won') {
        say(`${read}. Solved!`)
        // With motion reduced there is no beat and no timer: `afterWin` has
        // already closed the round (and cleared this list) by the time it returns.
        const beat = afterWin(() => host.close({ id: 'wordle', won: true, score: 7 - state.rows.length }))
        if (beat) timers.push(beat)
      } else if (state.status === 'lost') {
        say(`${read}. Out of tries. It was ${state.answer.toUpperCase()}.`)
        lose()
      } else say(`${read}.`)
    })
  }

  function onHint(): void {
    if (busy) return
    const next = hint(state)
    if (next === state) return
    state = next
    render()
    const i = state.hints.length - 1
    say(`Hint: ${state.hints[i].toUpperCase()} is the ${ORDINAL[i] ?? 'next'} letter.`)
  }

  /** A fresh board on a new random word, never the one just played — the gag's "Try again". */
  function newWord(): void {
    attempts++
    clearTimers()
    busy = false
    state = newGame(pickAnswer(attempts, override, Math.random, lastAnswer))
    lastAnswer = state.answer
    grid.innerHTML = ''
    note.hidden = true
    render()
  }

  /**
   * "Show me the word": type the answer into whatever row is next and hand it
   * in. The board does the rest — the flip, the live line, the win and the
   * ticket — because the reveal is a solve, not a special case. Whatever was
   * half-typed is rubbed out first, so the row starts clean.
   */
  function revealAnswer(): boolean | void {
    if (busy || state.status !== 'play') return false
    let next = state
    while (next.current) next = backspace(next)
    for (const ch of next.answer) next = typeLetter(next, ch)
    state = next
    render()
    onEnter()
  }

  function lose(): void {
    host.gag({
      title: 'Out of tries.',
      sub: `It was ${state.answer.toUpperCase()}.`,
      retry: newWord,
      // "Hire me" buys the seventh row on the board that was just lost — the
      // same word, one more go, exactly once.
      hint: () => {
        state = extraRow(state)
        render()
        say('One more row. Make it count.')
      },
    })
  }

  /* ---------------- input ---------------- */

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t.closest('.modal-x, [data-act="quit"]')) {
      host.quit()
      return
    }
    if (t.closest('[data-act="hint"]')) {
      onHint()
      return
    }
    const k = t.closest<HTMLElement>('.wd-key')
    if (!k) return
    const id = k.dataset.key ?? ''
    if (id === 'enter') onEnter()
    else if (id === 'back') onBack()
    else onLetter(id)
  })

  // Element-scoped, never `core/keys`: the world must not hear a word being
  // typed at it. Escape is deliberately left alone — the host's own handler,
  // one level up on the modal panel, is what asks before throwing a round away.
  root.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    const onControl = t instanceof HTMLElement && t !== root && !!t.closest('button, a')
    if (e.key === 'Enter') {
      // A focused button activates itself; stealing Enter would double-fire it.
      if (onControl) return
      e.preventDefault()
      e.stopPropagation()
      onEnter()
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      onBack()
    } else if (/^[a-z]$/i.test(e.key)) {
      e.stopPropagation()
      onLetter(e.key)
    }
  })

  function clearTimers(): void {
    for (const t of timers) clearTimeout(t)
    timers.length = 0
  }

  mountReveal(root, 'Show me the word', revealAnswer)
  root.tabIndex = 0
  root.dataset.autofocus = '' // brings focus back here when the gag closes
  render()
  root.focus({ preventScroll: true })

  return {
    score: () => (state.status === 'won' ? 7 - state.rows.length : 0),
    // The win is banked the moment the last row turns green; walking out during
    // the beat before the panel closes is still a win.
    won: () => state.status === 'won',
    destroy: clearTimers,
  }
}
