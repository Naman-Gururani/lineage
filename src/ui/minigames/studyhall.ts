// Study Hall — Lights Out on the lecture-room chalkboard. Five boards, each one
// built by pressing a handful of cells on a clear board, so the same presses
// always clear it again: solvable by construction, and the stuck-hint just reads
// the generator's own sequence back.
//
// All the puzzle logic lives in src/games/lightsout.ts. This file is DOM: a grid
// of real buttons (click, arrows, Enter, 1–9), a par counter and the hand-off to
// the host when the last board goes dark.
import { frameDataURL } from '../../art/atlas'
import { sfx } from '../../audio/sfx'
import { STUDY_BOARDS, genBoard, hintPress, press, solved, type LoBoard } from '../../games/lightsout'
import { afterWin, registerMinigame, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { el } from '../modal'
import { panelHead } from '../panels'

/** How far over par the player may wander before the game offers a way out. */
export const OVER_PAR_GAG = 12
const HINT_MS = 1400

export function mountStudyHall(host: MinigameHost, root: HTMLElement): MinigameSession {
  root.innerHTML = `
    ${panelHead('Lights Out', 'STUDY HALL')}
    <p class="mg-rule">Turn every light off. A press flips the light you pick and the four beside it.</p>
    <div class="mg-stats">
      <span class="mg-stat"><b data-f="board">1</b><small>of ${STUDY_BOARDS.length} boards</small></span>
      <span class="mg-stat"><b data-f="presses">0</b><small>presses</small></span>
      <span class="mg-stat"><b data-f="par">0</b><small>par</small></span>
    </div>
    <div class="mg-board card"><div class="mg-grid" role="group" aria-label="Chalkboard lights"></div></div>
    <p class="mg-live sr-only" role="status" aria-live="polite"></p>
    <footer class="mg-foot">
      <span class="mg-keys"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> move · <kbd>Enter</kbd> press · <kbd>1</kbd>–<kbd>9</kbd> pick · <kbd>R</kbd> reset</span>
      <button type="button" class="pbtn" data-act="reset">Reset board</button>
      <button type="button" class="pbtn" data-act="quit">Leave</button>
    </footer>`

  const grid = root.querySelector('.mg-grid') as HTMLElement
  const live = root.querySelector('.mg-live') as HTMLElement
  const field = (name: string) => root.querySelector(`[data-f="${name}"]`) as HTMLElement
  const litURL = frameDataURL('glow_warm', 1)

  let at = 0 // which of STUDY_BOARDS
  let puzzle = genBoard(STUDY_BOARDS[0].n, STUDY_BOARDS[0].presses, STUDY_BOARDS[0].seed)
  let board: LoBoard = puzzle.board
  let pressed: number[] = []
  let gagged = false
  let cells: HTMLButtonElement[] = []
  let hintTimer = 0
  let winTimer = 0
  let busy = false // mid hand-off to the next board: keys do nothing
  let done = false

  const say = (text: string) => (live.textContent = text)
  const rc = (i: number) => `row ${Math.floor(i / board.n) + 1}, column ${(i % board.n) + 1}`

  function build() {
    grid.style.setProperty('--n', String(board.n))
    grid.classList.toggle('has-art', !!litURL)
    grid.innerHTML = ''
    cells = board.cells.map((_, i) => {
      const b = el('button', 'mg-cell')
      b.type = 'button'
      b.dataset.i = String(i)
      const ic = el('i', 'mg-cell-ic')
      ic.setAttribute('aria-hidden', 'true')
      if (litURL) ic.style.backgroundImage = `url(${litURL})`
      b.appendChild(ic)
      grid.appendChild(b)
      return b
    })
    if (cells[0]) {
      cells[0].dataset.autofocus = ''
      cells[0].focus({ preventScroll: true })
    }
    paint()
  }

  function paint() {
    for (let i = 0; i < cells.length; i++) {
      const lit = board.cells[i]
      cells[i].classList.toggle('lit', lit)
      cells[i].setAttribute('aria-pressed', String(lit))
      cells[i].setAttribute('aria-label', `${rc(i)} — ${lit ? 'lit' : 'dark'}`)
    }
    field('board').textContent = String(at + 1)
    field('presses').textContent = String(pressed.length)
    field('par').textContent = String(puzzle.par)
  }

  function loadBoard(i: number) {
    at = i
    const spec = STUDY_BOARDS[i]
    puzzle = genBoard(spec.n, spec.presses, spec.seed)
    board = puzzle.board
    pressed = []
    gagged = false
    busy = false
    build()
    say(`Board ${i + 1} of ${STUDY_BOARDS.length}. ${board.cells.filter(Boolean).length} lights on, par ${puzzle.par}.`)
  }

  function reset() {
    if (busy || done) return
    board = puzzle.board
    pressed = []
    gagged = false
    paint()
    sfx.back()
    say('Board reset.')
  }

  function hint() {
    const i = hintPress(puzzle.seq, pressed)
    if (i == null || !cells[i]) return
    window.clearTimeout(hintTimer)
    for (const c of cells) c.classList.remove('hint')
    cells[i].classList.add('hint')
    cells[i].focus({ preventScroll: true })
    say(`Try ${rc(i)}.`)
    hintTimer = window.setTimeout(() => cells[i]?.classList.remove('hint'), HINT_MS)
  }

  function tap(i: number) {
    if (busy || done || i < 0 || i >= board.cells.length) return
    board = press(board, i)
    pressed.push(i)
    sfx.blip()
    paint()
    if (solved(board)) {
      advance()
      return
    }
    if (!gagged && pressed.length >= puzzle.par + OVER_PAR_GAG) {
      gagged = true
      host.gag({
        title: 'The chalkboard is winning.',
        sub: `${OVER_PAR_GAG} presses over par on board ${at + 1}. Fancy a hand?`,
        hint,
        retry: reset,
      })
    }
  }

  function advance() {
    busy = true
    for (const c of cells) c.classList.add('clear')
    window.clearTimeout(winTimer)
    if (at + 1 < STUDY_BOARDS.length) {
      sfx.pickup()
      say(`Board ${at + 1} clear.`)
      winTimer = afterWin(() => loadBoard(at + 1))
      return
    }
    done = true
    sfx.levelup()
    say('Every board clear.')
    winTimer = afterWin(() => host.close({ id: 'studyhall', won: true, score: STUDY_BOARDS.length }))
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'reset') return reset()
    if (act === 'quit' || target.closest('.modal-x')) return host.quit()
    const cell = target.closest<HTMLElement>('.mg-cell')
    if (cell) tap(Number(cell.dataset.i))
  })

  root.addEventListener('keydown', (e) => {
    // Ctrl+R still reloads and Ctrl+1 still switches tabs: the game only claims
    // bare keys.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.repeat && e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      return reset()
    }
    if (e.key >= '1' && e.key <= '9') {
      const i = Number(e.key) - 1
      if (i < board.cells.length) {
        e.preventDefault()
        cells[i]?.focus({ preventScroll: true })
        tap(i)
      }
      return
    }
    const active = document.activeElement as HTMLElement | null
    const from = cells.findIndex((c) => c === active)
    if (from < 0) return
    const n = board.n
    let to = from
    if (e.key === 'ArrowLeft') to = from % n > 0 ? from - 1 : from
    else if (e.key === 'ArrowRight') to = from % n < n - 1 ? from + 1 : from
    else if (e.key === 'ArrowUp') to = from >= n ? from - n : from
    else if (e.key === 'ArrowDown') to = from + n < cells.length ? from + n : from
    else return
    e.preventDefault()
    cells[to]?.focus({ preventScroll: true })
  })

  loadBoard(0)

  return {
    score: () => at + (done ? 1 : 0),
    destroy: () => {
      window.clearTimeout(hintTimer)
      window.clearTimeout(winTimer)
    },
  }
}

export function initStudyHall(): void {
  registerMinigame('studyhall', mountStudyHall)
}
