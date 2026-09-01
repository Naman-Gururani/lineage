import { describe, expect, it } from 'vitest'
import { BUILDING_DEFS } from '../../src/art/sprites/buildings'
import { type Dims, expectFrame, expectNames, index, itIsAWellFormedPack } from './helpers'

const byName = index(BUILDING_DEFS)

/** Frozen from the v1 (16px) pack: landmark → [width, height]. */
const V1_LANDMARKS: Record<string, [number, number]> = {
  bld_about: [80, 80],
  bld_experience: [96, 140],
  bld_skills: [96, 72],
  bld_lineage: [112, 88],
  bld_stealth: [80, 56],
  bld_safestride: [80, 72],
  bld_contact: [48, 120],
}
const V1_EXTRAS: Dims = { smoke: [8, 8, 1], door_light: [24, 12, 1] }
/** Both extras are centred sprites, not ground-planted ones — pinned exactly. */
const V1_EXTRA_ANCHORS: Record<string, [number, number]> = { smoke: [4, 4], door_light: [12, 6] }
const V1_NAMES = [...Object.keys(V1_LANDMARKS).flatMap((n) => [n, `${n}_night`]), ...Object.keys(V1_EXTRAS)]

/** New landmarks: 6×4 and 4×3 tile footprints at TILE=32, with roof overhang. */
const HD_NEW: Record<string, [number, number]> = { bld_campus: [192, 160], bld_warehouse: [128, 120] }

describe('building pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('buildings')
})

/* ------------------------------------------------------------------ *
 * The v1 (16px) contract block that used to live here was deleted by
 * task-2-buildings, per its own instructions, when the pack was redrawn
 * and the 32px HD block below was un-skipped. V1_LANDMARKS / V1_EXTRAS /
 * V1_EXTRA_ANCHORS above stay as the frozen ×2 baseline the HD block
 * doubles from, so the rename guard and the anchor maths keep their
 * reference point.
 * ------------------------------------------------------------------ */

describe('32px HD contract', () => {
  it('keeps every v1 sprite name (rename guard)', () => {
    expectNames(BUILDING_DEFS, V1_NAMES)
  })

  it('doubles every landmark, keeping the bottom-centre anchor and outline', () => {
    for (const [name, [w, h]] of Object.entries(V1_LANDMARKS)) {
      const d = expectFrame(byName, name, w * 2, h * 2)
      expect(d.anchor, `${name} anchor`).toEqual([w, h * 2])
      expect(d.outline, `${name} outline`).toBe('outline')
    }
  })

  it('doubles every night overlay with its landmark', () => {
    for (const [name, [w, h]] of Object.entries(V1_LANDMARKS)) {
      const d = expectFrame(byName, `${name}_night`, w * 2, h * 2)
      expect(d.anchor, `${name}_night anchor`).toEqual([w, h * 2])
    }
  })

  it('adds the campus at 192×160 and the warehouse at 128×120, anchored and outlined like the rest', () => {
    for (const [name, [w, h]] of Object.entries(HD_NEW)) {
      const d = expectFrame(byName, name, w, h)
      expect(d.anchor, `${name} anchor`).toEqual([w / 2, h])
      expect(d.outline, `${name} outline`).toBe('outline')
    }
  })

  it('gives the new landmarks night overlays matching their size and anchor', () => {
    for (const [name, [w, h]] of Object.entries(HD_NEW)) {
      const d = expectFrame(byName, `${name}_night`, w, h)
      expect(d.anchor, `${name}_night anchor`).toEqual([w / 2, h])
    }
  })

  it('doubles the smoke puff and the door glow, keeping them centred', () => {
    for (const [name, [w, h]] of Object.entries(V1_EXTRAS)) {
      const d = expectFrame(byName, name, w * 2, h * 2)
      const [ax, ay] = V1_EXTRA_ANCHORS[name]
      expect(d.anchor, `${name} anchor`).toEqual([ax * 2, ay * 2])
    }
  })
})
