import { describe, expect, it } from 'vitest'
import { rasterize, sizeOf } from '../src/art/pixel'
import { ENV_DEFS } from '../src/art/sprites/env'
import { HERO_DEFS } from '../src/art/sprites/hero'
import { PROP_DEFS } from '../src/art/sprites/props'

/** name → [sheet width, height, frames] */
const EXPECTED: Record<string, [number, number, number]> = {
  fountain: [144, 48, 3],
  windmill: [48, 80, 1],
  windmill_blades: [192, 48, 4],
  boat: [56, 32, 1],
  well: [28, 32, 1],
  stall: [56, 44, 1],
  crate: [16, 16, 1],
  barrel: [16, 20, 1],
  telescope: [24, 32, 1],
  mailbox: [12, 22, 1],
  bell: [20, 28, 1],
  item_gear: [12, 12, 1],
  item_fish: [14, 8, 1],
  item_shell: [10, 10, 1],
  bobber: [6, 8, 1],
  rod_tip: [4, 4, 1],
  bubble_excl: [12, 14, 1],
  bubble_quest: [12, 14, 1],
  bubble_dots: [14, 12, 1],
  bubble_heart: [12, 12, 1],
  bubble_zzz: [12, 12, 1],
  firework: [6, 6, 1],
}

describe('PROP_DEFS', () => {
  it('defines every expected sprite exactly once, with exact size and frame count', () => {
    for (const [name, [w, h, frames]] of Object.entries(EXPECTED)) {
      const matches = PROP_DEFS.filter((d) => d.name === name)
      expect(matches, `sprite "${name}" should exist once`).toHaveLength(1)
      const def = matches[0]
      const size = sizeOf(def)
      expect(size.w, `${name} width`).toBe(w)
      expect(size.h, `${name} height`).toBe(h)
      expect(def.frames ?? 1, `${name} frames`).toBe(frames)
    }
  })

  it('keeps every ASCII row the exact sprite width', () => {
    for (const def of PROP_DEFS) {
      if (!def.rows) continue
      const { w } = sizeOf(def)
      def.rows.forEach((row, y) => {
        expect(row.length, `${def.name} row ${y} width`).toBe(w)
      })
    }
  })

  it('splits strips into whole frames', () => {
    for (const def of PROP_DEFS) {
      const frames = def.frames ?? 1
      const { w } = sizeOf(def)
      expect(w % frames, `${def.name} frame width must divide the strip`).toBe(0)
    }
  })

  it('rasterizes every def (legend covers all chars) with no fully transparent frame', () => {
    for (const def of PROP_DEFS) {
      const r = rasterize(def) // throws on unknown chars or colours
      const frames = def.frames ?? 1
      const fw = r.w / frames
      for (let f = 0; f < frames; f++) {
        let opaque = 0
        for (let y = 0; y < r.h; y++)
          for (let x = f * fw; x < (f + 1) * fw; x++) if (r.data[(y * r.w + x) * 4 + 3] > 0) opaque++
        expect(opaque, `${def.name} frame ${f} should have visible pixels`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps anchors inside the frame', () => {
    for (const def of PROP_DEFS) {
      if (!def.anchor) continue
      const { w, h } = sizeOf(def)
      const fw = w / (def.frames ?? 1)
      expect(def.anchor[0], `${def.name} anchor x`).toBeGreaterThanOrEqual(0)
      expect(def.anchor[0], `${def.name} anchor x`).toBeLessThanOrEqual(fw)
      expect(def.anchor[1], `${def.name} anchor y`).toBeGreaterThanOrEqual(0)
      expect(def.anchor[1], `${def.name} anchor y`).toBeLessThanOrEqual(h)
    }
  })

  it('does not collide with the env or hero packs', () => {
    const taken = new Set([...ENV_DEFS, ...HERO_DEFS].map((d) => d.name))
    for (const def of PROP_DEFS) expect(taken.has(def.name), `${def.name} already exists in another pack`).toBe(false)
  })
})
