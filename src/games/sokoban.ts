// Sokoban, the crate puzzle on the Cargo Cove pallet. Pure state plus a
// breadth-first solver: no DOM, no Phaser, no timers. The solver is shared —
// the tests prove every level is winnable with it, and the stuck-hint replays
// its first few moves as ghost arrows.

/** Level glyphs: `#` wall · `.`/space floor · `o` goal · `$` crate · `*` crate on goal · `@` player · `+` player on goal. */
export type SokState = {
  w: number
  h: number
  walls: boolean[]
  goals: boolean[]
  crates: boolean[]
  /** cell index of the player */
  player: number
  moves: number
  /** one snapshot per move, oldest first; each snapshot's own trail is empty */
  trail: SokState[]
}

export type SokAxis = 0 | 1 | -1
export type SokMove = { dx: SokAxis; dy: SokAxis }

/** The four legal steps, in reading order (up, left, right, down). */
export const SOK_MOVES: SokMove[] = [
  { dx: 0, dy: -1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
]

export function parse(rows: string[]): SokState {
  const h = rows.length
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const walls = new Array(w * h).fill(false)
  const goals = new Array(w * h).fill(false)
  const crates = new Array(w * h).fill(false)
  let player = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] ?? ' '
      const i = y * w + x
      if (c === '#') walls[i] = true
      if (c === 'o' || c === '*' || c === '+') goals[i] = true
      if (c === '$' || c === '*') crates[i] = true
      if (c === '@' || c === '+') player = i
    }
  return { w, h, walls, goals, crates, player, moves: 0, trail: [] }
}

/** Every crate is home. */
export function won(s: SokState): boolean {
  return s.crates.every((c, i) => !c || s.goals[i])
}

/** Step or push. An illegal move returns the state it was given, unchanged. */
export function move(s: SokState, dx: SokAxis, dy: SokAxis): SokState {
  if ((dx === 0) === (dy === 0)) return s // no standstill, no diagonal
  const x = s.player % s.w
  const y = Math.floor(s.player / s.w)
  const nx = x + dx
  const ny = y + dy
  if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) return s
  const to = ny * s.w + nx
  if (s.walls[to]) return s
  let crates = s.crates
  if (s.crates[to]) {
    const bx = nx + dx
    const by = ny + dy
    if (bx < 0 || by < 0 || bx >= s.w || by >= s.h) return s
    const beyond = by * s.w + bx
    if (s.walls[beyond] || s.crates[beyond]) return s
    crates = s.crates.slice()
    crates[to] = false
    crates[beyond] = true
  }
  return { ...s, crates, player: to, moves: s.moves + 1, trail: [...s.trail, { ...s, trail: [] }] }
}

/** Rewind one move. At the start of the level it returns the state it was given. */
export function undo(s: SokState): SokState {
  const prev = s.trail[s.trail.length - 1]
  if (!prev) return s
  return { ...prev, trail: s.trail.slice(0, -1) }
}

const key = (player: number, crates: boolean[]) => {
  let k = player + '|'
  for (let i = 0; i < crates.length; i++) if (crates[i]) k += i + ','
  return k
}

/**
 * Breadth-first search over (player, crates) for the shortest solution, or
 * `null` when there is none. The levels are 8×8 at most, so the plain search is
 * fast enough to run in the browser for a hint.
 */
export function solve(level: string[] | SokState, limit = 400_000): SokMove[] | null {
  const s0: SokState = Array.isArray(level) ? parse(level) : { ...level, moves: 0, trail: [] }
  if (won(s0)) return []
  const seen = new Set<string>([key(s0.player, s0.crates)])
  type Node = { state: SokState; from: number; step: SokMove | null }
  const nodes: Node[] = [{ state: s0, from: -1, step: null }]
  for (let head = 0; head < nodes.length && nodes.length < limit; head++) {
    const node = nodes[head]
    for (const m of SOK_MOVES) {
      const next = move(node.state, m.dx, m.dy)
      if (next === node.state) continue
      const k = key(next.player, next.crates)
      if (seen.has(k)) continue
      seen.add(k)
      if (won(next)) {
        const plan = [m]
        for (let at = head; at >= 0 && nodes[at].step; at = nodes[at].from) plan.unshift(nodes[at].step!)
        return plan
      }
      nodes.push({ state: { ...next, trail: [] }, from: head, step: m })
    }
  }
  return null
}

/**
 * The six Cargo Cove levels, easiest first. Level 6's lower-left goal sits one
 * cell further left than first drafted so the crate pinned against the west
 * wall has somewhere to go — see the solver test.
 */
export const CARGO_LEVELS: string[][] = [
  ['#####', '#@$o#', '#####'],
  ['######', '#@$ o#', '# $ o#', '######'],
  ['#######', '#  o  #', '# @$  #', '# $o  #', '#######'],
  ['#######', '#o$ $o#', '#  @  #', '#o$ $o#', '#######'],
  ['########', '#o  #  #', '# $@$ o#', '#   $  #', '#  o   #', '########'],
  ['########', '# o o  #', '#$$@ $ #', '#o     #', '#   #  #', '########'],
]
