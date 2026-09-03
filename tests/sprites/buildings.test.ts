import { describe, expect, it } from 'vitest'
import { BUILDING_DEFS } from '../../src/art/sprites/buildings'
import { type Dims, expectFrame, expectNames, frameOf, index, itIsAWellFormedPack } from './helpers'

const byName = index(BUILDING_DEFS)

/**
 * task-9 (fair cleanup) deleted the seven other v1 landmarks (about,
 * experience, skills, lineage, stealth, safestride, contact) — their
 * interiors, rooms and transitions went with Task 7's scene rewrite, and
 * nothing outside src/art/sprites/ referenced their bld_* names any more.
 * The warehouse (Arcade) is the only v1 landmark still standing; the extras
 * (chimney smoke, door glow) are generic effects, not landmark-specific, so
 * they stay frozen at their v1 size too.
 */
const V1_EXTRAS: Dims = { smoke: [8, 8, 1], door_light: [24, 12, 1] }
/** Both extras are centred sprites, not ground-planted ones — pinned exactly. */
const V1_EXTRA_ANCHORS: Record<string, [number, number]> = { smoke: [4, 4], door_light: [12, 6] }
const V1_NAMES = Object.keys(V1_EXTRAS)

/** New landmark: 4×3 tile footprint at TILE=32, with roof overhang. */
const HD_NEW: Record<string, [number, number]> = { bld_warehouse: [128, 120] }

/**
 * Story Isle (v3, spec §9): Sol's Prize Tent takes over the Engine landmark's
 * 6×4-tile plot, so it is pinned to the plot exactly — 192×128 with no roof
 * overhang, because the tent's guy ropes already sit inside the footprint and
 * the door has to land on footprint column 3.
 */
const FAIR: Record<string, [number, number]> = { bld_fair: [192, 128] }

describe('building pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('buildings')
})

/* ------------------------------------------------------------------ *
 * The v1 (16px) contract block that used to live here was deleted by
 * task-2-buildings, per its own instructions, when the pack was redrawn
 * and the 32px HD block below was un-skipped. V1_EXTRAS / V1_EXTRA_ANCHORS
 * above stay as the frozen ×2 baseline the HD block doubles from, so the
 * rename guard and the anchor maths keep their reference point. The v1
 * landmark tables themselves went with task-9's cleanup, once their bld_*
 * defs were deleted alongside the interiors they used to lead into.
 * ------------------------------------------------------------------ */

describe('32px HD contract', () => {
  it('keeps every v1 sprite name (rename guard)', () => {
    expectNames(BUILDING_DEFS, V1_NAMES)
  })

  it('adds the warehouse at 128×120, anchored and outlined like the rest', () => {
    for (const [name, [w, h]] of Object.entries(HD_NEW)) {
      const d = expectFrame(byName, name, w, h)
      expect(d.anchor, `${name} anchor`).toEqual([w / 2, h])
      expect(d.outline, `${name} outline`).toBe('outline')
    }
  })

  it('gives the new landmark a night overlay matching its size and anchor', () => {
    for (const [name, [w, h]] of Object.entries(HD_NEW)) {
      const d = expectFrame(byName, `${name}_night`, w, h)
      expect(d.anchor, `${name}_night anchor`).toEqual([w / 2, h])
    }
  })

  it('adds the fair tent at 192×128, bottom-centre anchored and outlined like the rest', () => {
    for (const [name, [w, h]] of Object.entries(FAIR)) {
      const d = expectFrame(byName, name, w, h)
      expect(frameOf(d).frames, `${name} frames`).toBe(1)
      expect(d.anchor, `${name} anchor`).toEqual([w / 2, h])
      expect(d.outline, `${name} outline`).toBe('outline')
    }
  })

  it('gives the fair tent a night overlay matching its size and anchor', () => {
    for (const [name, [w, h]] of Object.entries(FAIR)) {
      const d = expectFrame(byName, `${name}_night`, w, h)
      expect(frameOf(d).frames, `${name}_night frames`).toBe(1)
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
