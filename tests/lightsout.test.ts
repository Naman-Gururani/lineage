import { describe, expect, it } from 'vitest'
import { STUDY_BOARDS, genBoard, hintPress, press, solved, type LoBoard } from '../src/games/lightsout'

const make = (n: number, lit: number[] = []): LoBoard => ({ n, cells: Array.from({ length: n * n }, (_, i) => lit.includes(i)) })
const litOf = (b: LoBoard) => b.cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0)

describe('lights out — press', () => {
  it('toggles exactly the plus shape in the middle of a 3×3', () => {
    const b = press(make(3), 4)
    expect(litOf(b)).toEqual([1, 3, 4, 5, 7])
  })

  it('clips the plus at the edges and never wraps a row', () => {
    expect(litOf(press(make(3), 0))).toEqual([0, 1, 3])
    expect(litOf(press(make(3), 2))).toEqual([1, 2, 5])
    // index 3 is the left edge of row 1: its left neighbour is off the board,
    // not the right end of row 0
    expect(litOf(press(make(3), 3))).toEqual([0, 3, 4, 6])
    expect(litOf(press(make(3), 8))).toEqual([5, 7, 8])
  })

  it('is its own inverse and leaves the input untouched', () => {
    const a = make(4, [2, 7])
    const once = press(a, 5)
    const twice = press(once, 5)
    expect(twice.cells).toEqual(a.cells)
    expect(litOf(a)).toEqual([2, 7]) // pure: the original board is unchanged
    expect(once).not.toBe(a)
  })

  it('ignores an out-of-range index', () => {
    const a = make(3, [1])
    expect(press(a, -1).cells).toEqual(a.cells)
    expect(press(a, 9).cells).toEqual(a.cells)
  })
})

describe('lights out — solved', () => {
  it('is true only when every light is off', () => {
    expect(solved(make(3))).toBe(true)
    expect(solved(make(3, [8]))).toBe(false)
  })
})

describe('lights out — genBoard', () => {
  it('returns a board solvable by replaying its own press sequence', () => {
    const { board, par, seq } = genBoard(4, 5, 33)
    expect(solved(board)).toBe(false)
    expect(par).toBe(seq.length)
    let b = board
    for (const i of seq) b = press(b, i)
    expect(solved(b)).toBe(true)
  })

  it('is deterministic for a seed and distinct across seeds', () => {
    expect(genBoard(4, 5, 33).board.cells).toEqual(genBoard(4, 5, 33).board.cells)
    expect(genBoard(4, 5, 33).board.cells).not.toEqual(genBoard(4, 5, 44).board.cells)
  })

  it('draws distinct in-range cells', () => {
    const { seq, board } = genBoard(5, 7, 55)
    expect(new Set(seq).size).toBe(seq.length)
    for (const i of seq) expect(i).toBeGreaterThanOrEqual(0)
    for (const i of seq) expect(i).toBeLessThan(board.n * board.n)
  })

  it('gives every designed board a non-trivial, replayable start', () => {
    expect(STUDY_BOARDS.length).toBe(5)
    for (const spec of STUDY_BOARDS) {
      const { board, par, seq } = genBoard(spec.n, spec.presses, spec.seed)
      expect(board.n).toBe(spec.n)
      expect(board.cells.length).toBe(spec.n * spec.n)
      expect(solved(board)).toBe(false)
      expect(par).toBe(spec.presses)
      let b = board
      for (const i of seq) b = press(b, i)
      expect(solved(b)).toBe(true)
    }
  })

  it('ramps the designed boards from 3×3 to 5×5', () => {
    expect(STUDY_BOARDS.map((s) => s.n)).toEqual([3, 3, 4, 4, 5])
    expect(STUDY_BOARDS.map((s) => s.presses)).toEqual([3, 4, 5, 6, 7])
  })
})

describe('lights out — hintPress', () => {
  it('names a cell that is still needed, and nothing once the parity matches', () => {
    expect(hintPress([1, 4, 7], [])).toBe(1)
    expect(hintPress([1, 4, 7], [1])).toBe(4)
    expect(hintPress([1, 4, 7], [7, 4, 1])).toBe(null)
    // a wrong press has to be undone: the hint says so
    expect(hintPress([1, 4], [1, 4, 8])).toBe(8)
  })

  it('always names a press that shortens the solution', () => {
    const { board, seq } = genBoard(4, 6, 44)
    let b = board
    const pressed: number[] = []
    for (let guard = 0; guard < 40 && !solved(b); guard++) {
      const i = hintPress(seq, pressed)
      expect(i).not.toBe(null)
      b = press(b, i!)
      pressed.push(i!)
    }
    expect(solved(b)).toBe(true)
    expect(pressed.length).toBe(seq.length)
  })
})
