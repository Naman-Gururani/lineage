import { describe, expect, it } from 'vitest'
import { rasterize, sizeOf } from '../src/art/pixel'
import { NPC_DEFS } from '../src/art/sprites/npcs'

const byName = new Map(NPC_DEFS.map((d) => [d.name, d]))
const NPC_IDS = ['mira', 'tomas', 'pip', 'lou', 'ada', 'ravi', 'sol', 'devi', 'arjun', 'ilse', 'naman']
const DIRS = ['down', 'up', 'left', 'right'] as const

const npcFrames = NPC_IDS.flatMap((id) => [
  ...DIRS.map((d) => `npc_${id}_idle_${d}`),
  ...DIRS.flatMap((d) => [0, 1].map((i) => `npc_${id}_walk_${d}_${i}`)),
])
const faceFrames = [...NPC_IDS.map((id) => `face_${id}`), 'face_hero', 'face_naman_happy', 'face_hero_happy']
const catFrames = [
  ...DIRS.map((d) => `cat_idle_${d}`),
  ...DIRS.flatMap((d) => [0, 1].map((i) => `cat_walk_${d}_${i}`)),
  'cat_sit',
]
const critters: Record<string, { w: number; h: number; frames: number }> = {
  butterfly: { w: 8, h: 8, frames: 2 },
  butterfly_blue: { w: 8, h: 8, frames: 2 },
  gull: { w: 16, h: 10, frames: 2 },
  crab: { w: 12, h: 8, frames: 2 },
  fish_jump: { w: 12, h: 12, frames: 3 },
}

const get = (name: string) => {
  const d = byName.get(name)
  if (!d) throw new Error(`missing sprite def "${name}"`)
  return d
}

describe('npc sprite pack', () => {
  it('has no duplicate names', () => {
    expect(byName.size).toBe(NPC_DEFS.length)
  })

  it('has every npc frame at 16×24 with the hero anchor', () => {
    for (const name of npcFrames) {
      const d = get(name)
      expect(sizeOf(d), name).toEqual({ w: 16, h: 24 })
      expect(d.anchor, name).toEqual([8, 22])
      expect(d.outline, name).toBe('outline')
    }
  })

  it('has every portrait at 32×32, anchored at the bottom centre', () => {
    for (const name of faceFrames) {
      const d = get(name)
      expect(sizeOf(d), name).toEqual({ w: 32, h: 32 })
      expect(d.anchor, name).toEqual([16, 32])
    }
  })

  it('has every cat frame at 16×14', () => {
    for (const name of catFrames) {
      const d = get(name)
      expect(sizeOf(d), name).toEqual({ w: 16, h: 14 })
      expect(d.anchor, name).toEqual([8, 13])
    }
  })

  it('has the critter strips at their frame sizes', () => {
    for (const [name, c] of Object.entries(critters)) {
      const d = get(name)
      expect(d.frames, name).toBe(c.frames)
      expect(sizeOf(d), name).toEqual({ w: c.w * c.frames, h: c.h })
    }
  })

  it('rasterizes every def (valid legends), rows uniform, no frame fully transparent', () => {
    for (const d of NPC_DEFS) {
      const widths = new Set((d.rows ?? []).map((r) => r.length))
      expect(widths.size, `${d.name} row widths`).toBe(1)
      const r = rasterize(d) // throws on any char missing from the legend
      const frames = d.frames ?? 1
      const fw = r.w / frames
      for (let f = 0; f < frames; f++) {
        let opaque = 0
        for (let y = 0; y < r.h; y++)
          for (let x = f * fw; x < (f + 1) * fw; x++) if (r.data[(y * r.w + x) * 4 + 3] > 0) opaque++
        expect(opaque, `${d.name} frame ${f} has pixels`).toBeGreaterThan(0)
      }
    }
  })
})
