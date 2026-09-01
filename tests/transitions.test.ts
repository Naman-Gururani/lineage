// The world <-> interior hand-off.
//
// The bug this file locks down: `game:title` is a global event and BOTH scenes
// hear it. `WorldScene` restarts itself into the attract screen; the room used
// to leave down the ordinary door path, which fades for 240ms and then calls
// `scene.wake('world', {x, y})` — landing on a world that is already showing
// the welcome card, with `player`/`state` dropped by `resetBuild()`. The result
// was the title screen wearing the play HUD, and `registry.state` set to
// `undefined` for the next room you opened.
//
// The decision itself is pure and tested directly. The wiring that consumes it
// lives inside two Phaser Scenes, which cannot be constructed in a node test
// (they need a Game, a renderer and a built atlas), so the scenes are pinned by
// reading them off disk — the same technique `ui-welcome.test.ts` uses.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { acceptsRoomWake, planRoomExit, type ExitReason } from '../src/scenes/transitions'

const src = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')

const HOME = { x: 1848, y: 892 }

describe('planRoomExit', () => {
  it('walking out of the door wakes the world at the return position', () => {
    expect(planRoomExit('door', HOME, null)).toEqual({ wakeWorld: true, fadeMs: 240, data: { x: 1848, y: 892 } })
  })

  it('carries a queued cutscene out through the door', () => {
    expect(planRoomExit('door', HOME, 'beacon')).toEqual({ wakeWorld: true, fadeMs: 240, data: { x: 1848, y: 892, cutscene: 'beacon' } })
  })

  it('fast travel wakes the world but leaves the position to it', () => {
    const plan = planRoomExit('travel', HOME, null)
    expect(plan.wakeWorld).toBe(true)
    expect(plan.data).toEqual({})
    expect(plan.data.x).toBeUndefined()
    expect(plan.data.y).toBeUndefined()
  })

  it('fast travel still carries a queued cutscene', () => {
    expect(planRoomExit('travel', HOME, 'beacon').data).toEqual({ cutscene: 'beacon' })
  })

  // The regression. Back to Title must not schedule a wake: the world scene is
  // restarting itself, and the wake would arrive after the welcome card is up.
  it('Back to Title never wakes the world, and never waits out a fade', () => {
    const plan = planRoomExit('title', HOME, null)
    expect(plan.wakeWorld).toBe(false)
    expect(plan.fadeMs).toBe(0)
    expect(plan.data).toEqual({})
  })

  it('Back to Title drops even a queued cutscene', () => {
    expect(planRoomExit('title', HOME, 'beacon')).toEqual({ wakeWorld: false, fadeMs: 0, data: {} })
  })

  it('only ever hands the world keys WorldScene.onWake reads', () => {
    const reasons: ExitReason[] = ['door', 'travel', 'title']
    for (const r of reasons) for (const k of Object.keys(planRoomExit(r, HOME, 'beacon').data)) expect(['x', 'y', 'cutscene']).toContain(k)
  })

  it('never sets x without y — onWake takes the pair or neither', () => {
    const reasons: ExitReason[] = ['door', 'travel', 'title']
    for (const r of reasons) {
      const { data } = planRoomExit(r, HOME, null)
      expect(typeof data.x).toBe(typeof data.y)
    }
  })
})

describe('acceptsRoomWake', () => {
  it('takes a room hand-off while a run is live', () => {
    expect(acceptsRoomWake('play')).toBe(true)
  })

  // The belt to planRoomExit's braces: any wake still in flight when the world
  // restarts (a `!def` bail-out, a queued op, a future exit path) is refused
  // rather than resuming play on top of the attract screen.
  it('refuses a hand-off that lands on the attract screen', () => {
    expect(acceptsRoomWake('title')).toBe(false)
  })
})

describe('the scenes are wired to the decision', () => {
  const interior = src('scenes/InteriorScene.ts')
  const world = src('scenes/WorldScene.ts')

  it('InteriorScene routes every exit through planRoomExit', () => {
    expect(interior).toContain("import { planRoomExit, type ExitReason } from './transitions'")
    expect(interior).toMatch(/const plan = planRoomExit\(reason, this\.returnPos, this\.pendingCutscene\)/)
    // no exit may hand-roll the payload any more
    expect(interior).not.toMatch(/scene\.wake\('world', \{ x: this\.returnPos/)
  })

  it('InteriorScene leaves for the title with reason "title", not the door path', () => {
    expect(interior).toMatch(/events\.on\('game:title', \(\) => this\.leave\('title'\)\)/)
    expect(interior).toMatch(/events\.on\('world:travel', \(\) => this\.leave\('travel'\)\)/)
  })

  it('InteriorScene skips the wake when the plan says not to', () => {
    expect(interior).toMatch(/if \(!plan\.wakeWorld\) \{\s*this\.scene\.stop\(\)\s*return\s*\}/)
  })

  it('WorldScene.onWake guards on acceptsRoomWake before touching anything', () => {
    expect(world).toContain("import { acceptsRoomWake, type Mode } from './transitions'")
    const body = world.slice(world.indexOf('private onWake('))
    const guard = body.indexOf('if (!acceptsRoomWake(this.mode)) return')
    expect(guard).toBeGreaterThan(-1)
    // it has to be the first statement: everything after it mutates play state
    for (const after of ['ui:hud', "registry.set('state'", 'setLocked(false)', 'fadeIn']) expect(body.indexOf(after)).toBeGreaterThan(guard)
  })

  it('WorldScene takes its WAKE listener off on shutdown so restarts cannot stack them', () => {
    expect(world).toContain('this.events.off(Phaser.Scenes.Events.WAKE, onWakeEvent)')
    expect(world).toContain('this.events.on(Phaser.Scenes.Events.WAKE, onWakeEvent)')
  })
})
