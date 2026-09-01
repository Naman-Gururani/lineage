// Cargo Cove — sokoban on the warehouse pallet. Six levels; push every crate
// onto a mark. The rules and the solver both live in src/games/sokoban.ts, so
// the same breadth-first search the tests use to prove the levels winnable is
// the one that draws the ghost arrows when a player gets stuck.
import { frameDataURL } from '../../art/atlas'
import { sfx } from '../../audio/sfx'
import { CARGO_LEVELS, move, parse, solve, undo, won, type SokAxis, type SokState } from '../../games/sokoban'
import { afterWin, registerMinigame, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { el } from '../modal'
import { panelHead } from '../panels'

/** Resets on one level before the game offers a way out. */
export const RESET_GAG = 3
/** How much of the solver's plan the hint gives away. */
export const HINT_MOVES = 5

const ARROW: Record<string, string> = { '0,-1': '↑', '0,1': '↓', '-1,0': '←', '1,0': '→' }
const WORD: Record<string, string> = { '0,-1': 'up', '0,1': 'down', '-1,0': 'left', '1,0': 'right' }
const KEYS: Record<string, [SokAxis, SokAxis]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
}

export function mountCargo(host: MinigameHost, root: HTMLElement): MinigameSession {
  root.innerHTML = `
    ${panelHead('Stack the cargo', 'CARGO COVE')}
    <p class="mg-rule">Push every crate onto a mark. Crates only push — never pull — and only one at a time.</p>
    <div class="mg-stats">
      <span class="mg-stat"><b data-f="level">1</b><small>of ${CARGO_LEVELS.length} levels</small></span>
      <span class="mg-stat"><b data-f="moves">0</b><small>moves</small></span>
      <span class="mg-stat"><b data-f="home">0</b><small>crates home</small></span>
    </div>
    <div class="mg-board card"><div class="mg-grid mg-sok" role="application" aria-label="Warehouse floor"></div></div>
    <p class="mg-live sr-only" role="status" aria-live="polite"></p>
    <footer class="mg-foot">
      <div class="mg-pad" role="group" aria-label="Move">
        <button type="button" class="mg-padbtn up" data-step="0,-1" aria-label="Move up">↑</button>
        <button type="button" class="mg-padbtn left" data-step="-1,0" aria-label="Move left">←</button>
        <button type="button" class="mg-padbtn down" data-step="0,1" aria-label="Move down">↓</button>
        <button type="button" class="mg-padbtn right" data-step="1,0" aria-label="Move right">→</button>
      </div>
      <span class="mg-keys"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> move · <kbd>Z</kbd> undo · <kbd>R</kbd> reset</span>
      <button type="button" class="pbtn" data-act="undo">Undo</button>
      <button type="button" class="pbtn" data-act="reset">Reset level</button>
      <button type="button" class="pbtn" data-act="quit">Leave</button>
    </footer>`

  const grid = root.querySelector('.mg-grid') as HTMLElement
  const live = root.querySelector('.mg-live') as HTMLElement
  const field = (name: string) => root.querySelector(`[data-f="${name}"]`) as HTMLElement
  const crateURL = frameDataURL('crate', 1)
  const heroURL = frameDataURL('hero_idle_down', 1)

  let at = 0
  let state: SokState = parse(CARGO_LEVELS[0])
  let resets = 0
  let ghosts: string[] = [] // one arrow glyph per cell index, '' for none
  let cells: HTMLElement[] = []
  let winTimer = 0
  let busy = false
  let done = false

  const say = (text: string) => (live.textContent = text)

  function build() {
    grid.style.setProperty('--n', String(state.w))
    grid.classList.toggle('has-art', !!crateURL && !!heroURL)
    grid.innerHTML = ''
    cells = state.walls.map(() => {
      const c = el('div', 'mg-cell mg-sok-cell')
      const ic = el('i', 'mg-cell-ic')
      ic.setAttribute('aria-hidden', 'true')
      c.appendChild(ic)
      const g = el('span', 'mg-ghost')
      g.setAttribute('aria-hidden', 'true')
      c.appendChild(g)
      grid.appendChild(c)
      return c
    })
    paint()
  }

  function paint() {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      const crate = state.crates[i]
      const goal = state.goals[i]
      c.classList.toggle('wall', state.walls[i])
      c.classList.toggle('goal', goal)
      c.classList.toggle('crate', crate)
      c.classList.toggle('home', crate && goal)
      c.classList.toggle('hero', state.player === i)
      const ic = c.firstElementChild as HTMLElement
      const url = crate ? crateURL : state.player === i ? heroURL : ''
      ic.style.backgroundImage = url ? `url(${url})` : ''
      ;(c.lastElementChild as HTMLElement).textContent = ghosts[i] ?? ''
    }
    const home = state.crates.filter((c, i) => c && state.goals[i]).length
    field('level').textContent = String(at + 1)
    field('moves').textContent = String(state.moves)
    field('home').textContent = String(home)
    grid.setAttribute('aria-label', `Level ${at + 1}: ${home} of ${state.crates.filter(Boolean).length} crates home, ${state.moves} moves.`)
  }

  function loadLevel(i: number) {
    at = i
    state = parse(CARGO_LEVELS[i])
    resets = 0
    ghosts = []
    busy = false
    build()
    say(`Level ${i + 1} of ${CARGO_LEVELS.length}. ${state.crates.filter(Boolean).length} crates to place.`)
  }

  function reset() {
    if (busy || done) return
    state = parse(CARGO_LEVELS[at])
    ghosts = []
    resets += 1
    paint()
    sfx.back()
    say('Level reset.')
    if (resets >= RESET_GAG) {
      resets = 0
      host.gag({
        title: 'The pallet is winning.',
        sub: `${RESET_GAG} resets on level ${at + 1}. Fancy a hand?`,
        hint,
        retry: reset,
      })
    }
  }

  /** Lay the solver's first few moves over the floor as ghost arrows. */
  function hint() {
    const plan = solve(state)
    if (!plan || !plan.length) {
      say('No way through from here — reset the level.')
      return
    }
    ghosts = []
    let walk = state
    const words: string[] = []
    for (const m of plan.slice(0, HINT_MOVES)) {
      const k = `${m.dx},${m.dy}`
      ghosts[walk.player] = ARROW[k] ?? '·'
      words.push(WORD[k] ?? '')
      walk = move(walk, m.dx, m.dy)
    }
    paint()
    say(`Hint: ${words.join(', ')}.`)
  }

  function step(dx: SokAxis, dy: SokAxis) {
    if (busy || done) return
    const next = move(state, dx, dy)
    if (next === state) {
      sfx.bump()
      return
    }
    const pushed = next.crates !== state.crates
    state = next
    ghosts = []
    paint()
    if (pushed) sfx.pickup()
    else sfx.blip()
    if (won(state)) advance()
  }

  function stepBack() {
    if (busy || done) return
    const back = undo(state)
    if (back === state) return
    state = back
    ghosts = []
    paint()
    sfx.back()
  }

  function advance() {
    busy = true
    grid.classList.add('clear')
    window.clearTimeout(winTimer)
    if (at + 1 < CARGO_LEVELS.length) {
      sfx.chest()
      say(`Level ${at + 1} clear in ${state.moves} moves.`)
      winTimer = afterWin(() => {
        grid.classList.remove('clear')
        loadLevel(at + 1)
      })
      return
    }
    done = true
    sfx.levelup()
    say('Every crate home.')
    winTimer = afterWin(() => host.close({ id: 'cargo', won: true, score: CARGO_LEVELS.length }))
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    // the on-screen d-pad: the only way to push a crate without a keyboard
    const pad = target.closest<HTMLElement>('[data-step]')?.dataset.step
    if (pad) {
      const [dx, dy] = pad.split(',').map(Number) as [SokAxis, SokAxis]
      return step(dx, dy)
    }
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'reset') reset()
    else if (act === 'undo') stepBack()
    else if (act === 'quit' || target.closest('.modal-x')) host.quit()
  })

  root.addEventListener('keydown', (e) => {
    // Ctrl+R still reloads and Ctrl+Z still belongs to the browser: the game
    // only claims bare keys.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    if (k === 'z') {
      e.preventDefault()
      return stepBack()
    }
    if (k === 'r') {
      if (e.repeat) return
      e.preventDefault()
      return reset()
    }
    const d = KEYS[k]
    if (!d) return
    e.preventDefault()
    step(d[0], d[1])
  })

  loadLevel(0)
  grid.tabIndex = 0
  grid.dataset.autofocus = ''
  grid.focus({ preventScroll: true })

  return {
    score: () => at + (done ? 1 : 0),
    destroy: () => window.clearTimeout(winTimer),
  }
}

export function initCargo(): void {
  registerMinigame('cargo', mountCargo)
}
