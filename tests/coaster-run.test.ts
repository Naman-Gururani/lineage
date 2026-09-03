// @vitest-environment happy-dom
//
// The Career Coaster's runner, driven over a fake scene.
//
// `systems/Coaster.ts` needs a canvas, so the geometry lives next door in the pure
// `systems/ridepath.ts` (see `ridepath.test.ts`) and what is left here is a
// lifecycle: a cutscene, a sprite, a camera and a payout. That lifecycle is where
// every defect this module has had came from — a ride abandoned half way, a second
// ride started over the top of the first, a throw between hiding the player and
// giving them back — and none of it needs pixels to reproduce. A fake scene with a
// hand-cranked update loop is enough.
//
// The one thing the fake controls that a real scene does not is *when* a camera
// fade calls back, because a fade that never calls back is exactly what a scene
// teardown looks like from inside `Cutscene.fade`.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  type Fn = (...p: unknown[]) => void
  class EventEmitter {
    private m = new Map<string, Set<Fn>>()
    on(k: string, fn: Fn) {
      let s = this.m.get(k)
      if (!s) {
        s = new Set()
        this.m.set(k, s)
      }
      s.add(fn)
      return this
    }
    once(k: string, fn: Fn) {
      // Like eventemitter3, a once-listener is removable by its ORIGINAL
      // reference: the wrapper remembers `fn` so `off(k, fn)` finds it.
      const w: Fn & { orig?: Fn } = (...p) => {
        this.off(k, w)
        fn(...p)
      }
      w.orig = fn
      return this.on(k, w)
    }
    off(k: string, fn: Fn) {
      const s = this.m.get(k)
      if (!s) return this
      for (const l of Array.from(s)) if (l === fn || (l as Fn & { orig?: Fn }).orig === fn) s.delete(l)
      return this
    }
    emit(k: string, ...p: unknown[]) {
      for (const fn of Array.from(this.m.get(k) ?? [])) fn(...p)
      return true
    }
  }
  return { default: { Events: { EventEmitter }, Scenes: { Events: { UPDATE: 'update', SHUTDOWN: 'shutdown' } } } }
})

import Phaser from 'phaser'
import { events } from '../src/core/events'
import { COASTER_ORIGIN, COASTER_PATH, COASTER_STOPS } from '../src/data/coaster'
import { Coaster } from '../src/systems/Coaster'

type FadeMode = 'instant' | 'never'
type Cart = { x: number; y: number; frame: string; depth: number; flipX: boolean; rotation: number; destroyed: boolean }
type Emitter = { on: Function; once: Function; off: Function; emit: (k: string, ...p: unknown[]) => boolean }

/** A scene with just enough of Phaser in it to run a ride. */
function fakeScene(opts: { fadeOut?: FadeMode; fadeIn?: FadeMode; throwOnSprite?: boolean } = {}) {
  const carts: Cart[] = []
  const emitter = new (Phaser as unknown as { Events: { EventEmitter: new () => Emitter } }).Events.EventEmitter()
  const fade =
    (mode: FadeMode) =>
    (_ms: number, _r: number, _g: number, _b: number, cb?: (c: unknown, p: number) => void) => {
      if (mode !== 'never') cb?.(null, 1)
    }
  const scene = {
    events: emitter,
    scale: { width: 1280, height: 720 },
    textures: { exists: () => true, get: () => ({ has: () => true }) },
    cameras: { main: { fadeOut: fade(opts.fadeOut ?? 'instant'), fadeIn: fade(opts.fadeIn ?? 'instant') } },
    time: {
      delayedCall: (ms: number, fn: () => void) => {
        const id = setTimeout(fn, ms)
        return { remove: () => clearTimeout(id) }
      },
    },
    add: {
      sprite(x: number, y: number, _key: string, frame: string) {
        if (opts.throwOnSprite) throw new Error('atlas exploded')
        const c: Cart = { x, y, frame, depth: 0, flipX: false, rotation: 0, destroyed: false }
        const api = {
          setDepth: (d: number) => ((c.depth = d), api),
          setFrame: (f: string) => ((c.frame = f), api),
          setPosition: (px: number, py: number) => ((c.x = px), (c.y = py), api),
          setFlipX: (v: boolean) => ((c.flipX = v), api),
          setRotation: (r: number) => ((c.rotation = r), api),
          destroy: () => {
            c.destroyed = true
          },
        }
        carts.push(c)
        return api
      },
    },
  }
  return { scene, carts, emitter }
}

/** A rig that records what was done to it rather than moving a camera. */
function fakeRig() {
  return {
    cam: {
      zoom: 1,
      setZoom(z: number) {
        this.zoom = z
      },
    },
    lookahead: 22,
    lerp: 0.085,
    shakeEnabled: true,
    target: null as unknown,
    shakes: 0,
    snaps: 0,
    follow(t: unknown) {
      this.target = t
    },
    snapTo() {
      this.snaps++
    },
    shake() {
      this.shakes++
    },
    setZoomForViewport() {
      this.cam.setZoom(1)
    },
  }
}

/** Just the four things the runner asks of `GameState`, with a ledger behind them. */
function fakeState() {
  const flags: Record<string, number> = {}
  const facets: [string, boolean][] = []
  const badges: string[] = []
  const purse = { xp: 0 }
  return {
    flags,
    facets,
    badges,
    purse,
    api: {
      ach: {
        unlock: (id: string) => {
          badges.push(id)
          return true
        },
      },
      flag: (k: string) => !!flags[k],
      setFlag: (k: string, v = 1) => {
        flags[k] = v
      },
      unlockFacet: (id: string, announce = true) => {
        facets.push([id, announce])
        return true
      },
      addXp: (n: number) => {
        purse.xp += n
      },
    },
  }
}

function rider() {
  return {
    x: 1616,
    y: 528,
    dir: 'up' as const,
    moving: false,
    visible: true,
    active: true,
    setVisible(v: boolean) {
      this.visible = v
    },
    setActive(v: boolean) {
      this.active = v
    },
  }
}

function bench(sceneOpts: Parameters<typeof fakeScene>[0] = {}) {
  const { scene, carts, emitter } = fakeScene(sceneOpts)
  const rig = fakeRig()
  const st = fakeState()
  const player = rider()
  const panels: { id: string; data?: unknown }[] = []
  const rides: unknown[] = []
  const offs = [events.on('ui:panel', (p) => panels.push(p)), events.on('ride:done', (p) => rides.push(p))]
  const run = (opts: Record<string, unknown> = {}, who: unknown = player) =>
    Coaster.run(
      scene as unknown as Phaser.Scene,
      who as Parameters<typeof Coaster.run>[1],
      rig as unknown as Parameters<typeof Coaster.run>[2],
      st.api as unknown as Parameters<typeof Coaster.run>[3],
      opts as Parameters<typeof Coaster.run>[4],
    )
  const close = () => offs.forEach((off) => off())
  return { scene, carts, emitter, rig, st, player, panels, rides, run, close }
}

/** Let the runner's awaits (fades, promise races) run on to their next stop. */
const settle = async (turns = 8) => {
  for (let i = 0; i < turns; i++) await Promise.resolve()
}

/**
 * Crank the scene's update until the ride resolves. Returns the frame count.
 *
 * The cart stands at every beat until the rider asks for the next one, so this
 * plays a rider who does: one `ride:next` for each card that comes up. Pass
 * `press: false` to sit on your hands and watch the ride wait instead.
 */
async function drive(b: ReturnType<typeof bench>, ride: Promise<void>, opts: { press?: boolean; maxFrames?: number } = {}) {
  const { press = true, maxFrames = 20000 } = opts
  let done = false
  ride.then(
    () => (done = true),
    () => (done = true),
  )
  let n = 0
  let seen = 0
  while (!done && n++ < maxFrames) {
    b.emitter.emit('update', n * 16.6667, 16.6667)
    if (press && cards(b).length > seen) {
      seen = cards(b).length
      events.emit('ride:next', {})
    }
    await Promise.resolve()
  }
  return n
}

/** Crank `n` frames without pressing anything. Returns the frame counter. */
async function frames(b: ReturnType<typeof bench>, n: number, from = 0) {
  for (let i = 0; i < n; i++) {
    b.emitter.emit('update', (from + i) * 16.6667, 16.6667)
    await Promise.resolve()
  }
  return from + n
}

/** Crank until the `k`-th beat's card is on screen (or the ride runs away with itself). */
async function toBeat(b: ReturnType<typeof bench>, k: number, from = 0, max = 20000) {
  let t = from
  while (cards(b).length < k && t - from < max) t = await frames(b, 1, t)
  return t
}

/** What the shared bus is holding for `k` — the phaser mock keeps its own map. */
const listeners = (k: string): number => (events as unknown as { e: { m: Map<string, Set<unknown>> } }).e.m.get(k)?.size ?? 0

const cards = (b: ReturnType<typeof bench>) => b.panels.filter((p) => p.id === 'ridecard' && p.data)
const home = COASTER_PATH[COASTER_PATH.length - 1]

beforeEach(() => {
  document.body.innerHTML = '<div id="ui"></div>'
  document.body.className = ''
  localStorage.clear()
})

describe('the Career Coaster runs', () => {
  it('rides the circuit, captions every beat in path order and pays out once', async () => {
    const b = bench()
    const ride = b.run()
    await drive(b, ride)
    await ride
    b.close()

    expect(cards(b).map((p) => (p.data as { title: string }).title)).toEqual(COASTER_STOPS.map((s) => s.title))
    expect(b.panels[b.panels.length - 1].id).toBe('career')
    expect(b.rides).toEqual([{ id: 'coaster' }])
    expect(b.st.facets).toEqual([
      ['education', false],
      ['experience', false],
    ])
    expect(b.st.badges).toEqual(['ride'])
    expect(b.st.purse.xp).toBe(120)
    expect(b.st.flags.rode_coaster).toBe(1)
  })

  it('parks the cart back on the boarding point and gives the world its camera back', async () => {
    const b = bench()
    const ride = b.run()
    await drive(b, ride)
    await ride
    b.close()

    expect(b.carts).toHaveLength(1)
    expect(b.carts[0].x).toBeCloseTo(COASTER_ORIGIN.tx * 32 + home.x, 3)
    expect(b.carts[0].y).toBeCloseTo(COASTER_ORIGIN.ty * 32 + home.y, 3)
    expect(b.carts[0].destroyed).toBe(true)
    expect(b.player.visible).toBe(true)
    expect(b.player.active).toBe(true)
    expect(b.rig.cam.zoom).toBe(1)
    expect(b.rig.lookahead).toBe(22)
    expect(b.rig.lerp).toBeCloseTo(0.085, 6)
    expect(b.rig.target).toBe(b.player)
    expect(document.body.classList.contains('cutscene')).toBe(false)
  })

  it('shakes on the drops, and does neither that nor the zoom under reduced motion', async () => {
    const loud = bench()
    const a = loud.run()
    await drive(loud, a)
    await a
    loud.close()
    expect(loud.rig.shakes).toBeGreaterThan(0)

    const quiet = bench()
    const c = quiet.run({ reducedMotion: true })
    await drive(quiet, c)
    await c
    quiet.close()
    expect(quiet.rig.shakes).toBe(0)
    expect(cards(quiet)).toHaveLength(COASTER_STOPS.length)
  })

  it('skips to the end on Esc: no cards, every chapter still handed over', async () => {
    const b = bench()
    const ride = b.run()
    b.emitter.emit('update', 16, 16)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    const frames = await drive(b, ride)
    await ride
    b.close()

    expect(frames).toBeLessThan(20)
    expect(cards(b)).toHaveLength(0)
    expect(b.panels.some((p) => p.id === 'career')).toBe(true)
    expect(b.st.facets).toHaveLength(2)
    expect(b.st.purse.xp).toBe(120)
  })

  it('pays a second ride nothing, and still opens the card', async () => {
    const b = bench()
    b.st.flags.rode_coaster = 1
    const ride = b.run()
    b.emitter.emit('update', 16, 16)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await drive(b, ride)
    await ride
    b.close()

    expect(b.st.purse.xp).toBe(0)
    expect(b.st.badges).toEqual(['ride'])
    expect(b.st.facets).toHaveLength(2)
    expect(b.panels.some((p) => p.id === 'career')).toBe(true)
  })
})

/**
 * The ride is the rider's. A coaster that rolls on by itself reads a résumé at
 * you at its own speed; this one lands on a beat, shows its card and stops dead
 * until `ride:next` — the card's own Next button — says go.
 */
describe('the Career Coaster waits for its rider', () => {
  it('stands at a beat for as long as it takes, and rolls on when asked', async () => {
    const b = bench()
    const ride = b.run()
    const t = await toBeat(b, 1)
    expect(cards(b)).toHaveLength(1)

    // Five seconds of frames with nobody pressing anything: not one pixel.
    const at = { x: b.carts[0].x, y: b.carts[0].y }
    const t2 = await frames(b, 300, t)
    expect(b.carts[0].x).toBe(at.x)
    expect(b.carts[0].y).toBe(at.y)
    expect(cards(b)).toHaveLength(1)

    // A Next nobody is waiting for is not a beat, so the stray one below must
    // leave the cart exactly where the first press did.
    events.emit('ride:next', {})
    const t3 = await frames(b, 20, t2)
    expect(Math.hypot(b.carts[0].x - at.x, b.carts[0].y - at.y)).toBeGreaterThan(0)
    const rolled = { x: b.carts[0].x, y: b.carts[0].y }
    events.emit('ride:next', {})
    await frames(b, 1, t3)
    expect(cards(b)).toHaveLength(1)
    expect(b.carts[0].x).not.toBe(rolled.x)

    await drive(b, ride)
    await ride
    b.close()
    expect(cards(b)).toHaveLength(COASTER_STOPS.length)
  })

  it('rides the whole circuit on five presses, and pays out once', async () => {
    const b = bench()
    const asked: unknown[] = []
    const off = events.on('ride:next', (p) => asked.push(p))
    const ride = b.run()
    await drive(b, ride)
    await ride
    off()
    b.close()

    expect(asked).toHaveLength(COASTER_STOPS.length)
    expect(cards(b).map((p) => (p.data as { title: string }).title)).toEqual(COASTER_STOPS.map((s) => s.title))
    expect(b.panels.filter((p) => p.id === 'career')).toHaveLength(1)
    expect(b.rides).toEqual([{ id: 'coaster' }])
    expect(b.st.purse.xp).toBe(120)
  })

  it('waits under reduced motion too — the beat is the content, not the animation', async () => {
    const b = bench()
    const ride = b.run({ reducedMotion: true })
    const t = await toBeat(b, 1)
    const at = { x: b.carts[0].x, y: b.carts[0].y }
    await frames(b, 300, t)
    expect(b.carts[0].x).toBe(at.x)
    await drive(b, ride)
    await ride
    b.close()
    expect(cards(b)).toHaveLength(COASTER_STOPS.length)
  })
})

describe('the Career Coaster survives being interrupted', () => {
  it('seats one train: a second interact joins the ride already running', async () => {
    const b = bench()
    const first = b.run()
    b.emitter.emit('update', 16, 16)
    const second = b.run()
    expect(second).toBe(first)
    await drive(b, first)
    await first
    b.close()

    // One cart, one payout, and — the expensive one — the *world's* camera numbers
    // put back rather than the ride's own, which a second entry would have captured.
    expect(b.carts).toHaveLength(1)
    expect(b.st.purse.xp).toBe(120)
    expect(b.rig.lookahead).toBe(22)
    expect(b.rig.lerp).toBeCloseTo(0.085, 6)
  })

  it('re-opens the station once the ride is over', async () => {
    const a = bench()
    const first = a.run()
    a.emitter.emit('update', 16, 16)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await drive(a, first)
    await first
    a.close()

    const b = bench()
    const second = b.run()
    expect(second).not.toBe(first)
    b.emitter.emit('update', 16, 16)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await drive(b, second)
    await second
    b.close()
    expect(b.st.purse.xp).toBe(120)
  })

  it('grants nothing when the scene is torn out from under it mid-ride', async () => {
    const b = bench()
    const ride = b.run()
    for (let i = 0; i < 60; i++) {
      b.emitter.emit('update', i * 16.6667, 16.6667)
      await Promise.resolve()
    }
    b.emitter.emit('shutdown')
    await ride
    b.close()

    // Nothing is owed for a ride nobody watched, and a Career card over the title
    // screen is the loudest possible way to get that wrong.
    expect(b.st.facets).toEqual([])
    expect(b.st.badges).toEqual([])
    expect(b.st.purse.xp).toBe(0)
    expect(b.panels.some((p) => p.id === 'career')).toBe(false)
    expect(b.rides).toEqual([])
    // The scene's own things are left alone — they are being destroyed anyway…
    expect(b.carts[0].destroyed).toBe(false)
    expect(b.rig.cam.zoom).toBeGreaterThan(1)
    // …but the DOM belongs to nobody's scene, so it always comes back.
    expect(document.body.classList.contains('cutscene')).toBe(false)
  })

  it('takes Esc from a standing start: the ride ends at once, with every grant intact', async () => {
    const b = bench()
    const ride = b.run()
    await toBeat(b, 1)
    expect(cards(b)).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await drive(b, ride, { press: false })
    await ride
    b.close()

    // Esc asked for the ending, not for less of it.
    expect(cards(b)).toHaveLength(1)
    expect(b.panels.some((p) => p.id === 'ridecard' && p.data == null)).toBe(true)
    expect(b.panels.some((p) => p.id === 'career')).toBe(true)
    expect(b.st.facets).toHaveLength(2)
    expect(b.st.badges).toEqual(['ride'])
    expect(b.st.purse.xp).toBe(120)
    expect(listeners('ride:next')).toBe(0)
  })

  it('settles when the scene goes away while a beat is up, and takes its listener with it', async () => {
    const b = bench()
    const before = listeners('ride:next')
    const ride = b.run()
    await toBeat(b, 1)
    // The runner is holding one, and only one: the rider's Next.
    expect(listeners('ride:next')).toBe(before + 1)

    b.emitter.emit('shutdown')
    await ride
    b.close()

    // A ride nobody is watching any more is owed nothing — and must not leave a
    // listener on the shared bus for the next scene to trip over.
    expect(listeners('ride:next')).toBe(before)
    expect(b.st.facets).toEqual([])
    expect(b.st.purse.xp).toBe(0)
    expect(b.panels.some((p) => p.id === 'career')).toBe(false)
    // The caption is DOM, not the scene's: it comes down either way.
    expect(b.panels[b.panels.length - 1]).toEqual({ id: 'ridecard', data: null })
    expect(document.body.classList.contains('cutscene')).toBe(false)
  })

  it('settles when the scene goes away during the opening fade', async () => {
    // `Cutscene.fade` resolves on the camera's callback or on `skip()`. A torn-down
    // camera calls neither, so a shutdown here used to suspend the ride for ever:
    // letterbox up, world locked, and the in-flight guard handing that same dead
    // promise to every later interact for the rest of the session.
    const b = bench({ fadeOut: 'never' })
    const ride = b.run()
    b.emitter.emit('shutdown')
    await ride
    b.close()

    expect(document.body.classList.contains('cutscene')).toBe(false)
    expect(b.carts).toHaveLength(0)
    expect(b.player.visible).toBe(true)
    expect(b.st.facets).toEqual([])
    expect(b.st.purse.xp).toBe(0)
    expect(b.panels.some((p) => p.id === 'career')).toBe(false)

    // …and the station is not wedged shut for the rest of the session.
    const again = bench()
    const next = again.run()
    expect(next).not.toBe(ride)
    await drive(again, next)
    await next
    again.close()
    expect(again.st.purse.xp).toBe(120)
  })

  it('settles when the scene goes away during the fade back in', async () => {
    const b = bench({ fadeIn: 'never' })
    const ride = b.run()
    await settle()
    expect(b.player.visible).toBe(false) // past the first fade, cart on the rails
    expect(b.carts).toHaveLength(1)
    b.emitter.emit('shutdown')
    await ride
    b.close()

    expect(document.body.classList.contains('cutscene')).toBe(false)
    expect(b.st.purse.xp).toBe(0)
    expect(b.panels.some((p) => p.id === 'career')).toBe(false)
    // The rider is *not* handed back: that sprite is going down with the scene, and
    // the world rebuilds its own on the way back in.
    expect(b.player.visible).toBe(false)
  })

  it('gives the player back even if the ride throws on its way out of the station', async () => {
    const b = bench({ throwOnSprite: true })
    const ride = b.run()
    await expect(ride).rejects.toThrow('atlas exploded')
    b.close()

    expect(b.player.visible).toBe(true)
    expect(b.player.active).toBe(true)
    expect(b.rig.lookahead).toBe(22)
    expect(b.rig.lerp).toBeCloseTo(0.085, 6)
    expect(b.rig.cam.zoom).toBe(1)
    expect(document.body.classList.contains('cutscene')).toBe(false)
    expect(b.st.purse.xp).toBe(0)

    const again = bench()
    const next = again.run()
    expect(next).not.toBe(ride)
    again.emitter.emit('update', 16, 16)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await drive(again, next)
    await next
    again.close()
  })

  it('leaves no camera target behind for a rider it cannot follow', async () => {
    const b = bench()
    const plain = { x: 10, y: 20, setVisible() {}, setActive() {} }
    const ride = b.run({}, plain)
    b.emitter.emit('update', 16, 16)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await drive(b, ride)
    await ride
    b.close()

    expect(b.rig.target).toBe(null)
    expect(b.rig.snaps).toBeGreaterThan(0)
  })
})
