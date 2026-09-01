// Plays Tower Climb, badly and then well, so two test files can ask it things.
//
// A breadth-first search over the jump lattice — where the lattice is not a
// hand-written table of "you may hop two tiles" but the real reducer: every edge
// is a run of `climbStep` at the same 60 Hz the game plays at, so a route found
// here is a route a player can actually take, and the tick-by-tick inputs that
// walk it can be typed at the renderer as keystrokes.
//
// Nodes are settled, grounded positions quantised to a 10-unit grid. Edges are
// the moves a pair of hands can make: hold a direction for a while, wait (which
// is how you ride a moving ledge, and how you let one come back), or jump after
// a delay with a direction held for a chosen number of ticks — steering is
// instant in this physics, so *how long you hold* is the whole aiming
// vocabulary. Highest-first, because the tower is climbed upwards.
//
// The search under-approximates: a hop it cannot express is a hop it will not
// find, which is the safe direction for a proof that a route exists.
import { climbInit, climbStep, type ClimbInput, type ClimbState, type StageData } from '../../src/games/climb'

export const DT = 1 / 60

/** One input per tick — replayable through `climbStep`, or through the keyboard. */
export type ClimbScript = ClimbInput[]

export type ClimbPlans = {
  /** start → `E`, without ever touching a spike */
  toExit: ClimbScript | null
  /**
   * start → one fall, banking no checkpoint on the way, and *verified* to still
   * cost a fall when replayed three times over — which is what makes it a way
   * to drive a whole climb into the ground.
   */
  toFall: ClimbScript | null
}

type Move = { dir: -1 | 0 | 1; jump: boolean; delay: number; hold: number }

function moveSet(): Move[] {
  const moves: Move[] = []
  for (const hold of [30, 90, 180]) moves.push({ dir: 0, jump: false, delay: 0, hold })
  for (const dir of [-1, 1] as const) for (const hold of [6, 16, 30, 50, 80]) moves.push({ dir, jump: false, delay: 0, hold })
  for (const dir of [-1, 0, 1] as const) for (const hold of dir === 0 ? [240] : [6, 12, 18, 26, 36, 240]) moves.push({ dir, jump: true, delay: 0, hold })
  // the delays sweep a whole hoist cycle, so the search can wait for one rather
  // than only ever meeting the one it happens to be standing beside
  for (const delay of [24, 48, 72, 96, 120, 144, 168, 192, 216]) {
    for (const dir of [-1, 0, 1] as const) moves.push({ dir, jump: true, delay, hold: 240 })
    for (const dir of [-1, 1] as const) moves.push({ dir, jump: true, delay, hold: 12 })
  }
  return moves
}

const inputAt = (m: Move, i: number): ClimbInput => {
  const held = i >= m.delay && i < m.delay + m.hold
  return { left: held && m.dir === -1, right: held && m.dir === 1, jump: m.jump && i === m.delay }
}

/** Run a script from the top of the stage; the state it leaves behind is the answer. */
export function replay(data: StageData, script: ClimbScript, from = climbInit(data)): ClimbState {
  let s = from
  for (const inp of script) s = climbStep(s, inp, DT, data)
  return s
}

/**
 * Three deaths from one script. A fall with no checkpoint banked puts the hero
 * back exactly where the script started, so the same keystrokes kill them again
 * — but only if nothing time-dependent (a moving ledge) has drifted underneath,
 * which is why this is checked rather than assumed.
 */
function killsThreeTimes(data: StageData, script: ClimbScript): boolean {
  let s = climbInit(data)
  for (let round = 0; round < 3; round++) {
    const before = s.falls
    for (const inp of script) {
      s = climbStep(s, inp, DT, data)
      if (s.done) return false
    }
    if (s.falls !== before + 1) return false
  }
  return s.over
}

const cache = new Map<StageData, ClimbPlans>()

/** Both plans for a stage, computed once per module instance. */
export function climbPlans(data: StageData): ClimbPlans {
  const hit = cache.get(data)
  if (hit) return hit
  const out = search(data)
  cache.set(data, out)
  return out
}

function search(data: StageData): ClimbPlans {
  const moves = moveSet()
  const key = (s: ClimbState) => `${Math.round(s.x / 10)},${Math.round(s.y / 10)}`
  type Node = { state: ClimbState; script: ClimbScript; banked: boolean }
  const start: Node = { state: climbInit(data), script: [], banked: false }
  const seen = new Set<string>([key(start.state)])
  const frontier: Node[] = [start]
  let toExit: ClimbScript | null = null
  let toFall: ClimbScript | null = null
  let expanded = 0
  while (frontier.length && expanded < 3000 && !(toExit && toFall)) {
    let best = 0
    for (let i = 1; i < frontier.length; i++) if (frontier[i].state.y < frontier[best].state.y) best = i
    const from = frontier.splice(best, 1)[0]
    expanded++
    for (const m of moves) {
      let s = from.state
      let banked = from.banked
      const inputs: ClimbScript = []
      let died = false
      const end = m.delay + m.hold
      for (let i = 0; i < end + 200; i++) {
        const inp = inputAt(m, i)
        const next = climbStep(s, inp, DT, data)
        inputs.push(inp)
        if (next.falls > s.falls) {
          died = true
          s = next
          break
        }
        s = next
        if (s.atCheckpoint) banked = true
        if (s.done) break
        if (i >= end && s.grounded && s.vy === 0) break
      }
      const script = [...from.script, ...inputs]
      if (s.done) {
        toExit ??= script
        continue
      }
      if (died) {
        // Only a checkpoint-free death repeats, and only a repeating one can
        // drive a climb all the way into the ground.
        if (!toFall && !banked && killsThreeTimes(data, script)) toFall = script
        continue
      }
      if (!s.grounded) continue
      const k = key(s)
      if (seen.has(k)) continue
      seen.add(k)
      frontier.push({ state: s, script, banked })
    }
  }
  return { toExit, toFall }
}
