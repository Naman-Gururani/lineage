import { describe, expect, it } from 'vitest'
import { PROFILE, ZONES } from '../src/data/content'
import {
  CLIMB,
  CLIMB_BODY,
  CLIMB_CAPTIONS,
  CLIMB_PLATFORM,
  CLIMB_STAGES,
  CLIMB_TILE,
  climbInit,
  climbStep,
  platformRects,
  stageStart,
  type ClimbInput,
  type ClimbState,
  type StageData,
} from '../src/games/climb'
import { climbPlans, replay } from './helpers/climb-plan'

const DT = 1 / 60
const NONE: ClimbInput = { left: false, right: false, jump: false }
const JUMP: ClimbInput = { left: false, right: false, jump: true }
const RIGHT: ClimbInput = { left: false, right: true, jump: false }
const LEFT: ClimbInput = { left: true, right: false, jump: false }

const stage = (rows: string[], platforms: StageData['platforms'] = []): StageData => ({ rows, platforms })

const step = (s: ClimbState, inp: ClimbInput, data: StageData, n = 1, dt = DT): ClimbState => {
  let out = s
  for (let i = 0; i < n; i++) out = climbStep(out, inp, dt, data)
  return out
}

/* ------------------------------------------------------------------ */
/* physics                                                             */

const FLAT = stage(['........', '........', '...@....', '########'])

describe('tower climb — physics', () => {
  it('holds the constants the tower is tuned around', () => {
    expect(CLIMB).toEqual({ G: 1400, JUMP_V: -420, MOVE_V: 150, COYOTE: 0.08, BUFFER: 0.1, MAX_FALLS: 3 })
  })

  it('stands the hero on the floor where the stage says `@`', () => {
    const s = climbInit(FLAT)
    expect(stageStart(FLAT)).toEqual({ x: 3.5 * CLIMB_TILE, y: 3 * CLIMB_TILE })
    expect(s.x).toBe(3.5 * CLIMB_TILE)
    expect(s.y).toBe(3 * CLIMB_TILE)
    expect(s.cx).toBe(s.x)
    expect(s.cy).toBe(s.y)
    expect(s.falls).toBe(0)
    expect(s.done).toBe(false)
    expect(s.over).toBe(false)
    const settled = step(s, NONE, FLAT, 4)
    expect(settled.grounded).toBe(true)
    expect(settled.y).toBe(3 * CLIMB_TILE)
  })

  it('integrates gravity while falling', () => {
    const air: ClimbState = { ...climbInit(FLAT), y: 20, vy: 0, grounded: false, coyote: 0 }
    const a = climbStep(air, NONE, 0.05, FLAT)
    expect(a.vy).toBeCloseTo(CLIMB.G * 0.05, 6)
    expect(a.y).toBeCloseTo(20 + CLIMB.G * 0.05 * 0.05, 6)
  })

  it('walks at MOVE_V and stops dead when the key comes up', () => {
    const s = climbInit(FLAT)
    const a = climbStep(s, RIGHT, 0.1, FLAT)
    expect(a.x).toBeCloseTo(s.x + CLIMB.MOVE_V * 0.1, 6)
    expect(climbStep(a, NONE, 0.1, FLAT).x).toBeCloseTo(a.x, 6)
    expect(climbStep(s, LEFT, 0.1, FLAT).x).toBeCloseTo(s.x - CLIMB.MOVE_V * 0.1, 6)
  })

  it('jumps from the ground and comes back down', () => {
    const s = step(climbInit(FLAT), NONE, FLAT, 2)
    const up = climbStep(s, JUMP, DT, FLAT)
    expect(up.vy).toBe(CLIMB.JUMP_V)
    expect(up.grounded).toBe(false)
    let f = up
    let peak = f.y
    for (let i = 0; i < 200 && !f.grounded; i++) {
      f = climbStep(f, NONE, DT, FLAT)
      peak = Math.min(peak, f.y)
    }
    // v²/2g = 63 units — two tiles and a bit, which is what the stages are drawn to
    expect(s.y - peak).toBeGreaterThan(58)
    expect(s.y - peak).toBeLessThan(64)
    expect(f.y).toBe(3 * CLIMB_TILE)
  })

  it('will not double-jump in the air', () => {
    let s = climbStep(step(climbInit(FLAT), NONE, FLAT, 2), JUMP, DT, FLAT)
    s = step(s, NONE, FLAT, 10)
    const again = climbStep(s, JUMP, DT, FLAT)
    expect(again.vy).toBeGreaterThan(s.vy) // still falling under gravity, not re-launched
  })

  it('stops at the walls', () => {
    const box = stage(['........', '...@....', '########'])
    const left = step(climbInit(box), LEFT, box, 60)
    expect(left.x).toBeCloseTo(CLIMB_BODY.hw, 6)
    const right = step(climbInit(box), RIGHT, box, 60)
    expect(right.x).toBeCloseTo(8 * CLIMB_TILE - CLIMB_BODY.hw, 6)
  })
})

/* ------------------------------------------------------------------ */
/* the two mercies: coyote time and the jump buffer                     */

const LEDGE = stage(['........', '........', '@.......', '##......'])

describe('tower climb — coyote time', () => {
  const offTheEdge = () => {
    let s = climbInit(LEDGE)
    for (let i = 0; i < 200 && s.grounded; i++) s = climbStep(s, RIGHT, DT, LEDGE)
    return s
  }

  it('leaves the ledge with a full coyote window', () => {
    const s = offTheEdge()
    expect(s.grounded).toBe(false)
    expect(s.coyote).toBeCloseTo(CLIMB.COYOTE, 6)
  })

  it('still jumps just after the ledge runs out', () => {
    const late = climbStep(offTheEdge(), JUMP, DT, LEDGE)
    expect(late.vy).toBe(CLIMB.JUMP_V)
  })

  it('still jumps 0.06 s late, but not 0.12 s late', () => {
    const ok = climbStep(step(offTheEdge(), RIGHT, LEDGE, 3), JUMP, DT, LEDGE) // 0.05 s
    expect(ok.vy).toBe(CLIMB.JUMP_V)
    const tooLate = climbStep(step(offTheEdge(), RIGHT, LEDGE, 8), JUMP, DT, LEDGE) // 0.13 s
    expect(tooLate.vy).toBeGreaterThan(0)
    expect(tooLate.coyote).toBe(0)
  })
})

describe('tower climb — the jump buffer', () => {
  it('fires a jump pressed just before the hero lands', () => {
    const falling: ClimbState = { ...climbInit(FLAT), y: 57, vy: 0, grounded: false, coyote: 0 }
    let s = climbStep(falling, JUMP, DT, FLAT)
    expect(s.vy).toBeGreaterThan(0) // nothing to jump off yet
    expect(s.buffer).toBeCloseTo(CLIMB.BUFFER, 6)
    for (let i = 0; i < 10 && s.vy >= 0; i++) s = climbStep(s, NONE, DT, FLAT)
    expect(s.vy).toBe(CLIMB.JUMP_V) // it fired the moment the feet touched down
  })

  it('lets a jump pressed far too early expire', () => {
    const falling: ClimbState = { ...climbInit(FLAT), y: 30, vy: 0, grounded: false, coyote: 0 }
    let s = climbStep(falling, JUMP, DT, FLAT)
    for (let i = 0; i < 20; i++) s = climbStep(s, NONE, DT, FLAT)
    expect(s.grounded).toBe(true)
    expect(s.vy).toBe(0)
    expect(s.buffer).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* hazards, checkpoints, the exit                                       */

const RUN = stage(['........', '........', '@..^.C.E', '########'])

describe('tower climb — hazards and checkpoints', () => {
  /** Standing between the spikes and the flag: the only safe strip to set off from. */
  const midRun = (): ClimbState => ({ ...climbInit(RUN), x: 4.5 * CLIMB_TILE, cx: 4.5 * CLIMB_TILE })

  it('banks a checkpoint the hero touches, once', () => {
    let s = midRun()
    let hits = 0
    for (let i = 0; i < 120 && !s.done; i++) {
      s = climbStep(s, RIGHT, DT, RUN)
      if (s.atCheckpoint) hits++
    }
    expect(hits).toBe(1)
    expect(s.done).toBe(true)
    expect(s.cx).toBeCloseTo(5.5 * CLIMB_TILE, 6)
    expect(s.cy).toBeCloseTo(3 * CLIMB_TILE, 6)
  })

  it('counts a fall and puts the hero back at the last checkpoint', () => {
    let s = midRun()
    for (let i = 0; i < 120 && !s.atCheckpoint; i++) s = climbStep(s, RIGHT, DT, RUN)
    expect(s.cx).toBeCloseTo(5.5 * CLIMB_TILE, 6)
    // …then back the way we came, onto the spikes
    for (let i = 0; i < 300 && s.falls === 0; i++) s = climbStep(s, LEFT, DT, RUN)
    expect(s.falls).toBe(1)
    expect(s.x).toBeCloseTo(5.5 * CLIMB_TILE, 6)
    expect(s.y).toBeCloseTo(3 * CLIMB_TILE, 6)
    expect(s.vx).toBe(0)
    expect(s.vy).toBe(0)
    expect(s.over).toBe(false)
  })

  it('sends the hero back to the start when no checkpoint has been banked', () => {
    let s = climbInit(RUN)
    for (let i = 0; i < 200 && s.falls === 0; i++) s = climbStep(s, RIGHT, DT, RUN)
    expect(s.falls).toBe(1)
    expect(s.x).toBeCloseTo(0.5 * CLIMB_TILE, 6)
  })

  it('ends the climb on the third fall', () => {
    let s = climbInit(RUN)
    for (let i = 0; i < 900 && !s.over; i++) s = climbStep(s, RIGHT, DT, RUN)
    expect(s.falls).toBe(CLIMB.MAX_FALLS)
    expect(s.over).toBe(true)
    expect(s.done).toBe(false)
    expect(climbStep(s, RIGHT, DT, RUN)).toBe(s)
  })

  it('counts a drop out of the bottom of the stage as a fall', () => {
    const hole = stage(['........', '@.......', '##......'])
    let s = climbInit(hole)
    for (let i = 0; i < 300 && s.falls === 0; i++) s = climbStep(s, RIGHT, DT, hole)
    expect(s.falls).toBe(1)
    expect(s.x).toBeCloseTo(0.5 * CLIMB_TILE, 6)
  })

  it('finishes the stage at the exit', () => {
    const open = stage(['........', '........', '@......E', '########'])
    let s = climbInit(open)
    for (let i = 0; i < 300 && !s.done; i++) s = climbStep(s, RIGHT, DT, open)
    expect(s.done).toBe(true)
    expect(s.falls).toBe(0)
    expect(climbStep(s, RIGHT, DT, open)).toBe(s)
  })
})

/* ------------------------------------------------------------------ */
/* moving platforms                                                     */

describe('tower climb — moving platforms', () => {
  const lift = stage(['........', '........', '@.......', '##......'], [{ x: 3, y: 2, range: 3, speed: 1 }])

  it('walks its ledge back and forth at a steady speed', () => {
    const at = (t: number) => platformRects(lift, t)[0].x
    expect(at(0)).toBe(3 * CLIMB_TILE)
    expect(at(1)).toBe(4 * CLIMB_TILE) // 1 tile a second
    expect(at(3)).toBe(6 * CLIMB_TILE) // the far end of a 3-tile sweep
    expect(at(4)).toBe(5 * CLIMB_TILE) // …and back
    expect(at(6)).toBe(3 * CLIMB_TILE)
    expect(platformRects(lift, 0)[0]).toEqual({ x: 3 * CLIMB_TILE, y: 2 * CLIMB_TILE, w: CLIMB_PLATFORM.w, h: CLIMB_PLATFORM.h })
  })

  it('carries whoever is standing on it', () => {
    const on: ClimbState = { ...climbInit(lift), x: 3.5 * CLIMB_TILE, y: 2 * CLIMB_TILE, grounded: true }
    const s = step(on, NONE, lift, 30)
    expect(s.grounded).toBe(true)
    expect(s.y).toBeCloseTo(2 * CLIMB_TILE, 6)
    expect(s.x).toBeCloseTo(3.5 * CLIMB_TILE + 0.5 * CLIMB_TILE, 3) // half a second, one tile a second
  })

  it('is a one-way ledge: the hero jumps up through it and lands on top', () => {
    // stand directly under the ledge's left end and jump: the head passes through
    const under: ClimbState = { ...climbInit(lift), x: 3.5 * CLIMB_TILE, y: 3 * CLIMB_TILE, grounded: true }
    let s = climbStep(under, JUMP, DT, lift)
    expect(s.vy).toBe(CLIMB.JUMP_V)
    for (let i = 0; i < 120 && !s.grounded; i++) s = climbStep(s, NONE, DT, lift)
    expect(s.grounded).toBe(true)
    expect(s.y).toBeCloseTo(2 * CLIMB_TILE, 6) // caught on the way down
  })
})

/* ------------------------------------------------------------------ */
/* the three stages                                                     */

const CHARS = new Set(['.', '#', '^', 'C', 'E', '@'])

/** Stage 1 exactly as the design authored it — the shape of the whole tower. */
const STAGE_1_ROWS = [
  '........................',
  '.E......................',
  '####....................',
  '....................^^..',
  '............########.C..',
  '........................',
  '......###....^^.........',
  '..C........####.........',
  '####....................',
  '........................',
  '.....########...........',
  '........................',
  '@...........###.........',
  '########################',
]

describe('tower climb — stage data', () => {
  it('keeps the authored stage 1 verbatim', () => {
    expect(CLIMB_STAGES[0].rows).toEqual(STAGE_1_ROWS)
  })

  it('climbs three floors, each with its own caption', () => {
    expect(CLIMB_STAGES.length).toBe(3)
    expect(CLIMB_CAPTIONS.length).toBe(3)
    expect(CLIMB_CAPTIONS[0]).toBe('2023 — DevOps Intern')
    expect(CLIMB_CAPTIONS[1]).toContain(PROFILE.company)
    expect(CLIMB_CAPTIONS[1]).toContain('2024')
    expect(CLIMB_CAPTIONS[2]).toContain('750M')
  })

  it('quotes a number the Engine still claims', () => {
    // the caption is only true while the project page says so
    const lineage = ZONES.find((z) => z.id === 'lineage')!
    expect(lineage.content.body?.join(' ')).toContain('750')
  })

  CLIMB_STAGES.forEach((data, i) => {
    describe(`stage ${i + 1}`, () => {
      it('is a rectangle of known glyphs', () => {
        expect(data.rows.length).toBe(14)
        for (const r of data.rows) {
          expect(r.length).toBe(24)
          for (const c of r) expect(CHARS.has(c), `unknown glyph "${c}"`).toBe(true)
        }
      })

      it('has exactly one start and one exit, and at least one checkpoint', () => {
        const all = data.rows.join('')
        expect(all.split('@').length - 1).toBe(1)
        expect(all.split('E').length - 1).toBe(1)
        expect(all.split('C').length - 1).toBeGreaterThan(0)
      })

      it('keeps spikes to at most a quarter of the built structure', () => {
        const all = data.rows.join('')
        const spikes = all.split('^').length - 1
        const solid = all.split('#').length - 1
        expect(spikes / (spikes + solid)).toBeLessThanOrEqual(0.25)
      })

      it('keeps every moving ledge inside the stage', () => {
        for (const p of data.platforms) {
          expect(p.range).toBeGreaterThan(0)
          expect(p.speed).toBeGreaterThan(0)
          expect(p.x).toBeGreaterThanOrEqual(0)
          expect((p.x + p.range) * CLIMB_TILE + CLIMB_PLATFORM.w).toBeLessThanOrEqual(24 * CLIMB_TILE)
          expect(p.y).toBeGreaterThan(0)
          expect(p.y).toBeLessThan(14)
        }
      })
    })
  })
})

/* ------------------------------------------------------------------ */
/* reachability: is there a way up at all?                              */

/**
 * The search itself lives in `tests/helpers/climb-plan.ts`, because the answer
 * it gives is worth more than a boolean: the tick-by-tick inputs that walk the
 * route are what `minigame.test.ts` types at the renderer to prove the cabinet
 * pays out. Here they are replayed straight through the reducer.
 */
describe('tower climb — every stage has a way up', () => {
  CLIMB_STAGES.forEach((data, i) => {
    it(`stage ${i + 1} can be climbed from @ to E without taking a fall`, () => {
      const { toExit } = climbPlans(data)
      expect(toExit, `no route from @ to E on stage ${i + 1}`).not.toBeNull()
      const end = replay(data, toExit!)
      expect(end.done).toBe(true)
      expect(end.falls).toBe(0)
    })

    it(`stage ${i + 1} has a way to come off it, three times over`, () => {
      // Not decoration: this is the script that drives the cabinet into its gag.
      const { toFall } = climbPlans(data)
      expect(toFall, `nothing on stage ${i + 1} can kill you the same way twice`).not.toBeNull()
      const once = replay(data, toFall!)
      expect(once.falls).toBe(1)
      expect(once.done).toBe(false)
      expect(once.over).toBe(false)
    })
  })
})
