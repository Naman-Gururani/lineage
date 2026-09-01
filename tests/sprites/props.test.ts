import { describe, expect, it } from 'vitest'
import { rasterize, type SpriteDef } from '../../src/art/pixel'
import { PROP_DEFS } from '../../src/art/sprites/props'
import { type Dims, expectFrame, expectNames, expectScaledBy, frameOf, index, itIsAWellFormedPack, need } from './helpers'

const byName = index(PROP_DEFS)

/** Rows of frame 0 that actually carry paint (the 1px outline counts). */
function drawnHeight(def: SpriteDef): number {
  const r = rasterize(def)
  const fw = r.w / (def.frames ?? 1)
  let top = -1
  let bottom = -1
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < fw; x++)
      if (r.data[(y * r.w + x) * 4 + 3] > 0) {
        if (top < 0) top = y
        bottom = y
        break
      }
  return top < 0 ? 0 : bottom - top + 1
}

/** Frozen from the v1 (16px) pack: name → [frame width, height, frames]. */
const V1_DIMS: Dims = {
  fountain: [48, 48, 3],
  windmill: [48, 80, 1],
  windmill_blades: [48, 48, 4],
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
const V1_NAMES = Object.keys(V1_DIMS)

/** Particle-scale bits the renderer never places on the tile grid. */
const FX = ['firework', 'rod_tip']
const PLACED = V1_NAMES.filter((n) => !FX.includes(n))

/** Added for the campus / village signage pass (spec §Task 2). */
const HD_NEW: Dims = {
  sign_finger: [40, 56, 1],
  prop_chalkboard: [56, 40, 1],
  prop_noticeboard: [48, 40, 1],
}

describe('prop pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('props')
})

/* ------------------------------------------------------------------ *
 * The v1 (16px) contract that used to live here was deleted when the
 * pack was redrawn at 32px, exactly as its comment instructed. The HD
 * block below supersedes it and still guards every v1 name.
 * ------------------------------------------------------------------ */
describe('32px HD contract', () => {
  it('keeps every v1 sprite name (rename guard)', () => {
    expectNames(PROP_DEFS, V1_NAMES)
  })

  it('keeps every v1 frame count (animation strips still line up)', () => {
    for (const [name, [, , frames]] of Object.entries(V1_DIMS)) expect(frameOf(need(byName, name)).frames, name).toBe(frames)
  })

  it('doubles every prop that stands in the world', () => {
    expectScaledBy(PROP_DEFS, V1_DIMS, 2, PLACED)
  })

  it('adds the finger post at 40×56', () => {
    expectFrame(byName, 'sign_finger', 40, 56)
  })

  it('adds the chalkboard at 56×40 and the noticeboard at 48×40', () => {
    expectFrame(byName, 'prop_chalkboard', 56, 40)
    expectFrame(byName, 'prop_noticeboard', 48, 40)
  })

  it('anchors the new signage bottom-centre so it plants on the ground', () => {
    for (const [name, [w, h]] of Object.entries(HD_NEW)) expect(need(byName, name).anchor, `${name} anchor`).toEqual([w / 2, h])
  })

  /*
   * Added by the props redraw (recorded reason): v2.5 makes small furniture
   * HOPPABLE, and the hop only reads if the prop's drawn mass stays low even
   * though its frame doubled. The frame is 32×32 but the crate itself must not
   * fill it — 20px of art plus the 1px outline top and bottom.
   */
  it('keeps hoppable furniture low enough that a hop clears it', () => {
    expect(drawnHeight(need(byName, 'crate')), 'crate drawn height').toBeLessThanOrEqual(22)
  })
})
