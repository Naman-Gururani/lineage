import { describe, expect, it } from 'vitest'
import { CARGO_LEVELS, move, parse, solve, undo, won, type SokMove, type SokState } from '../src/games/sokoban'

const apply = (s: SokState, plan: SokMove[]) => plan.reduce((acc, m) => move(acc, m.dx, m.dy), s)

describe('sokoban — parse', () => {
  it('reads walls, floors, goals, crates and the player', () => {
    const s = parse(['#####', '#@$o#', '#####'])
    expect(s.w).toBe(5)
    expect(s.h).toBe(3)
    expect(s.player).toBe(1 * 5 + 1)
    expect(s.crates[1 * 5 + 2]).toBe(true)
    expect(s.goals[1 * 5 + 3]).toBe(true)
    expect(s.walls[0]).toBe(true)
    expect(s.walls[1 * 5 + 1]).toBe(false)
    expect(s.moves).toBe(0)
    expect(s.trail).toEqual([])
  })

  it('reads the combined glyphs: * crate-on-goal and + player-on-goal', () => {
    const s = parse(['#####', '#+*.#', '#####'])
    expect(s.goals[1 * 5 + 1]).toBe(true)
    expect(s.player).toBe(1 * 5 + 1)
    expect(s.goals[1 * 5 + 2]).toBe(true)
    expect(s.crates[1 * 5 + 2]).toBe(true)
    expect(won(s)).toBe(true) // the one crate is home; the player's own goal is free floor
  })

  it('pads ragged rows with floor', () => {
    const s = parse(['####', '#@ ', '####'])
    expect(s.w).toBe(4)
    expect(s.walls[1 * 4 + 3]).toBe(false)
  })
})

describe('sokoban — move', () => {
  it('walks into free floor and counts the move', () => {
    const s = parse(['#####', '#@ o#', '#####'])
    const a = move(s, 1, 0)
    expect(a.player).toBe(1 * 5 + 2)
    expect(a.moves).toBe(1)
    expect(s.player).toBe(1 * 5 + 1) // pure
  })

  it('pushes a crate and wins when every crate sits on a goal', () => {
    const s = parse(['#####', '#@$o#', '#####'])
    const a = move(s, 1, 0)
    expect(a.crates[1 * 5 + 3]).toBe(true)
    expect(a.crates[1 * 5 + 2]).toBe(false)
    expect(a.player).toBe(1 * 5 + 2)
    expect(won(a)).toBe(true)
  })

  it('returns the very same state for an illegal move', () => {
    const s = parse(['#####', '#@$o#', '#####'])
    expect(move(s, -1, 0)).toBe(s) // into a wall
    expect(move(s, 0, -1)).toBe(s)
    const twoCrates = parse(['######', '#@$$o#', '######'])
    expect(move(twoCrates, 1, 0)).toBe(twoCrates) // crate behind crate
    const crateOnWall = parse(['####', '#@$#', '####'])
    expect(move(crateOnWall, 1, 0)).toBe(crateOnWall) // wall behind crate
  })

  it('refuses a diagonal or a standstill', () => {
    const s = parse(['#####', '#@  #', '#####'])
    expect(move(s, 0, 0)).toBe(s)
    expect(move(s, 1, 1)).toBe(s)
  })
})

describe('sokoban — undo', () => {
  it('rewinds one move, including a push, and stops at the start', () => {
    const s = parse(['######', '#@$ o#', '######'])
    const a = move(s, 1, 0)
    const b = move(a, 1, 0)
    expect(won(b)).toBe(true)
    const back = undo(b)
    expect(back.player).toBe(a.player)
    expect(back.crates).toEqual(a.crates)
    expect(back.moves).toBe(1)
    const start = undo(back)
    expect(start.player).toBe(s.player)
    expect(start.moves).toBe(0)
    expect(undo(start)).toBe(start)
  })

  it('keeps the trail shallow — one snapshot per move, no nesting', () => {
    let s = parse(['######', '#@$ o#', '######'])
    s = move(s, 1, 0)
    s = move(s, 1, 0)
    expect(s.trail.length).toBe(2)
    for (const t of s.trail) expect(t.trail).toEqual([])
  })
})

describe('sokoban — solve', () => {
  it('finds the one-move solution and reports the shortest path first', () => {
    expect(solve(['#####', '#@$o#', '#####'])).toEqual([{ dx: 1, dy: 0 }])
  })

  it('returns null for a level that cannot be solved', () => {
    // the crate is pinned against the left wall; no goal shares its column
    expect(solve(['#####', '#$@ #', '#  o#', '#####'])).toBe(null)
  })

  it('solves every Cargo Cove level', () => {
    expect(CARGO_LEVELS.length).toBe(6)
    for (const [i, level] of CARGO_LEVELS.entries()) {
      const plan = solve(level)
      expect(plan, `level ${i + 1} must be solvable`).not.toBe(null)
      expect(won(apply(parse(level), plan!))).toBe(true)
    }
  })

  it('gives every Cargo Cove level as many crates as goals, and a fair start', () => {
    for (const [i, level] of CARGO_LEVELS.entries()) {
      const s = parse(level)
      const crates = s.crates.filter(Boolean).length
      const goals = s.goals.filter(Boolean).length
      expect(crates, `level ${i + 1} crates`).toBe(goals)
      expect(crates).toBeGreaterThan(0)
      expect(won(s), `level ${i + 1} must not start solved`).toBe(false)
      expect(s.w).toBeLessThanOrEqual(8)
      expect(s.h).toBeLessThanOrEqual(8)
    }
  })
})
