// The fair pack's contract (v4 spec §9, plan Task 2).
//
// Everything here is a promise to the world task, which places these sprites by
// name, frame size and anchor: nothing may be renamed, resized or re-anchored
// without a matching edit to `BLUEPRINT`. The gate's clear opening is pinned
// too — the player walks through the middle of a 256px arch, so those columns
// have to stay empty all the way to the ground.
import { describe, expect, it } from 'vitest'
import { rasterize, type SpriteDef } from '../../src/art/pixel'
import { FAIR_DEFS } from '../../src/art/sprites/fair'
import { type Dims, expectFrame, expectNames, frameOf, index, itIsAWellFormedPack, need, opaqueIn } from './helpers'

const byName = index(FAIR_DEFS)

/** name → [frame width, frame height, frames] — pinned by the plan's table. */
const DIMS: Dims = {
  gate_arch: [256, 160, 1],
  ticket_booth: [96, 96, 1],
  turnstile: [64, 48, 1],
  booth_forge: [128, 112, 1],
  board_forge: [64, 48, 1],
  booth_flight: [128, 112, 1],
  booth_guestbook: [96, 96, 1],
  cart_food_0: [64, 64, 1],
  cart_food_1: [64, 64, 1],
  cart_balloons: [64, 80, 1],
  arcade_sign: [96, 32, 1],
  duck_0: [16, 16, 1],
  duck_1: [16, 16, 1],
  duck_2: [16, 16, 1],
  stringlight: [32, 48, 1],
}

/** name → anchor, in frame pixels. Ground-planted props sit at their feet. */
const ANCHORS: Record<string, [number, number]> = {
  gate_arch: [128, 160],
  ticket_booth: [48, 92],
  turnstile: [32, 44],
  booth_forge: [64, 108],
  board_forge: [32, 44],
  booth_flight: [64, 108],
  booth_guestbook: [48, 92],
  cart_food_0: [32, 60],
  cart_food_1: [32, 60],
  cart_balloons: [32, 76],
  arcade_sign: [48, 28],
  duck_0: [8, 8],
  duck_1: [8, 8],
  duck_2: [8, 8],
  stringlight: [16, 44],
}

/** Day defs that carry a `_night` overlay (buildings-pack convention). */
const NIGHT = ['gate_arch', 'booth_forge', 'booth_flight', 'booth_guestbook', 'stringlight'] as const

const DAY_NAMES = Object.keys(DIMS)
const ALL_NAMES = [...DAY_NAMES, ...NIGHT.map((n) => `${n}_night`)]

/** The gate's walkable slot: the middle 128px of the 256px frame. */
const GATE_OPEN = { x0: 64, x1: 191, y0: 100, y1: 159 }

/** Opaque pixels of frame 0 inside a rectangle. */
function opaqueInRect(def: SpriteDef, x0: number, y0: number, x1: number, y1: number): number {
  const r = rasterize(def)
  let n = 0
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (r.data[(y * r.w + x) * 4 + 3] > 0) n++
  return n
}

/** RGBA of every opaque pixel of frame 0, as a joined signature. */
function signature(def: SpriteDef): string {
  const r = rasterize(def)
  return Array.from(r.data).join(',')
}

/** Split a def's paint into fully opaque pixels and soft (alpha-blended) ones. */
function alphas(def: SpriteDef): { solid: number; soft: number } {
  const r = rasterize(def)
  let solid = 0
  let soft = 0
  for (let i = 3; i < r.data.length; i += 4) {
    if (r.data[i] === 255) solid++
    else if (r.data[i] > 0) soft++
  }
  return { solid, soft }
}

describe('fair pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('fair')
})

describe('fair pack contract', () => {
  it('defines exactly the fair sprites the plan names, and nothing else', () => {
    expectNames(FAIR_DEFS, ALL_NAMES)
    expect(FAIR_DEFS.map((d) => d.name).sort(), 'unexpected extra defs in the fair pack').toEqual([...ALL_NAMES].sort())
  })

  it('pins every frame size and frame count', () => {
    for (const [name, [w, h, frames]] of Object.entries(DIMS)) {
      const d = expectFrame(byName, name, w, h)
      expect(frameOf(d).frames, `${name} frames`).toBe(frames)
    }
  })

  it('pins every anchor', () => {
    for (const [name, anchor] of Object.entries(ANCHORS)) {
      expect(need(byName, name).anchor, `${name} anchor`).toEqual(anchor)
    }
  })

  it('gives every night overlay its day def’s size, frame count and anchor', () => {
    for (const name of NIGHT) {
      const [w, h, frames] = DIMS[name]
      const d = expectFrame(byName, `${name}_night`, w, h)
      expect(frameOf(d).frames, `${name}_night frames`).toBe(frames)
      expect(d.anchor, `${name}_night anchor`).toEqual(ANCHORS[name])
    }
  })

  /**
   * A night overlay is drawn OVER its day sprite at full opacity once dusk
   * lands, so anything solid in it hides the art underneath. Haloes may spill
   * well past the sprite (a lamp lights more than its own post), so the budget
   * is on solid paint, not on coverage: lit bulbs, lit glass, lit lettering —
   * and every one of them wrapped in more soft glow than solid core.
   */
  it('draws night overlays as glow, never a second copy of the sprite', () => {
    for (const name of NIGHT) {
      const day = opaqueIn(need(byName, name))
      const { solid, soft } = alphas(need(byName, `${name}_night`))
      expect(solid + soft, `${name}_night is empty`).toBeGreaterThan(0)
      expect(solid / day, `${name}_night paints ${solid} solid px over a ${day}px day sprite`).toBeLessThan(0.35)
      expect(soft, `${name}_night has ${soft} soft px against ${solid} solid — no halo`).toBeGreaterThan(solid)
    }
  })

  it('leaves the middle of the gate arch clear so the player can walk through', () => {
    const gate = need(byName, 'gate_arch')
    const { x0, y0, x1, y1 } = GATE_OPEN
    expect(opaqueInRect(gate, x0, y0, x1, y1), 'paint inside the gate opening').toBe(0)
    expect(opaqueInRect(need(byName, 'gate_arch_night'), x0, y0, x1, y1), 'night glow inside the gate opening').toBe(0)
  })

  it('plants the gate arch on two pillars, in the outer 64px columns', () => {
    const gate = need(byName, 'gate_arch')
    const base = 158
    expect(opaqueInRect(gate, 0, base, 63, base), 'left pillar at the base row').toBeGreaterThan(40)
    expect(opaqueInRect(gate, 192, base, 255, base), 'right pillar at the base row').toBeGreaterThan(40)
  })

  it('spans the arch overhead, so the sign bridges both pillars', () => {
    const gate = need(byName, 'gate_arch')
    expect(opaqueInRect(gate, 64, 0, 191, 60), 'sign band between the pillars').toBeGreaterThan(2000)
  })

  it('draws three different ducks', () => {
    const sigs = ['duck_0', 'duck_1', 'duck_2'].map((n) => signature(need(byName, n)))
    expect(new Set(sigs).size, 'the three duck bobbers are not distinct').toBe(3)
  })

  it('keeps the two food carts distinct', () => {
    expect(signature(need(byName, 'cart_food_0')) === signature(need(byName, 'cart_food_1'))).toBe(false)
  })

  it('draws every sprite well inside its frame (nothing is a stray dot)', () => {
    for (const name of DAY_NAMES) {
      const [w, h] = DIMS[name]
      expect(opaqueIn(need(byName, name)) / (w * h), `${name} coverage`).toBeGreaterThan(0.08)
    }
  })
})
