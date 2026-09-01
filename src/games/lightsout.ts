// Lights Out, the chalkboard puzzle in the Study Hall. Pure state: no DOM, no
// Phaser, no timers — the renderer in src/ui/minigames/studyhall.ts owns all of
// that and only ever calls the functions here.
import { makeRng } from '../core/rng'

/** A square board. `cells[y * n + x]` is true when that light is lit. */
export type LoBoard = { n: number; cells: boolean[] }

/** A generated board plus the press sequence that produced it (its solution). */
export type LoPuzzle = { board: LoBoard; par: number; seq: number[] }

export function emptyBoard(n: number): LoBoard {
  return { n, cells: new Array(n * n).fill(false) }
}

/** Toggle cell `i` and its four orthogonal neighbours. Out of range: no change. */
export function press(b: LoBoard, i: number): LoBoard {
  const cells = b.cells.slice()
  if (i < 0 || i >= cells.length || !Number.isInteger(i)) return { n: b.n, cells }
  const x = i % b.n
  const y = Math.floor(i / b.n)
  cells[i] = !cells[i]
  if (x > 0) cells[i - 1] = !cells[i - 1]
  if (x < b.n - 1) cells[i + 1] = !cells[i + 1]
  if (y > 0) cells[i - b.n] = !cells[i - b.n]
  if (y < b.n - 1) cells[i + b.n] = !cells[i + b.n]
  return { n: b.n, cells }
}

/** Every light off — the board is clear. */
export function solved(b: LoBoard): boolean {
  return b.cells.every((c) => !c)
}

/**
 * Build a board by pressing `presses` distinct cells on a clear board, so the
 * same presses always undo it: solvable by construction, and `seq` is a
 * ready-made solution the hint can read. A draw that happens to cancel itself
 * out (the press matrix is singular on 4×4 and 5×5) is redrawn.
 */
export function genBoard(n: number, presses: number, seed: number): LoPuzzle {
  const total = n * n
  const want = Math.max(1, Math.min(Math.trunc(presses), total))
  const rng = makeRng(seed)
  for (let attempt = 0; attempt < 64; attempt++) {
    const pool = rng.shuffle(Array.from({ length: total }, (_, i) => i))
    const seq = pool.slice(0, want).sort((a, b) => a - b)
    let board = emptyBoard(n)
    for (const i of seq) board = press(board, i)
    if (!solved(board)) return { board, par: seq.length, seq }
  }
  // Unreachable in practice: one press alone can never clear a board.
  const seq = [0]
  return { board: press(emptyBoard(n), 0), par: 1, seq }
}

/**
 * The next press that shortens the solution: a cell whose parity still differs
 * between the generator's sequence and what the player has pressed. `null` once
 * the two agree (the board is clear). Lowest index first, so the flash is stable.
 */
export function hintPress(seq: readonly number[], pressed: readonly number[]): number | null {
  const need = new Set(seq)
  for (const i of pressed) {
    if (need.has(i)) need.delete(i)
    else need.add(i)
  }
  let best: number | null = null
  for (const i of need) if (best === null || i < best) best = i
  return best
}

/** The five boards of a Study Hall run, easiest first. */
export const STUDY_BOARDS: { n: number; presses: number; seed: number }[] = [
  { n: 3, presses: 3, seed: 11 },
  { n: 3, presses: 4, seed: 22 },
  { n: 4, presses: 5, seed: 33 },
  { n: 4, presses: 6, seed: 44 },
  { n: 5, presses: 7, seed: 55 },
]
