import { describe, expect, it } from 'vitest'
import { ENV_DEFS } from '../../src/art/sprites/env'
import { type Dims, expectAtLeast, expectScaledBy, expectNames, frameOf, index, itIsAWellFormedPack, need } from './helpers'

const byName = index(ENV_DEFS)

/** Frozen from the v1 (16px) pack: name → [frame width, height, frames]. */
const V1_DIMS: Dims = {
  tree_0: [32, 40, 1],
  tree_1: [32, 40, 1],
  pine_0: [24, 40, 1],
  pine_1: [24, 40, 1],
  palm_0: [32, 48, 1],
  palm_1: [32, 48, 1],
  bush_0: [20, 16, 1],
  bush_1: [20, 16, 1],
  rock_0: [20, 16, 1],
  rock_1: [20, 16, 1],
  flower_0: [8, 8, 1],
  flower_1: [8, 8, 1],
  flower_2: [8, 8, 1],
  flower_3: [8, 8, 1],
  flowerbed: [16, 6, 1],
  grass_tall: [16, 16, 2],
  fence_h: [16, 16, 1],
  fence_v: [16, 16, 1],
  fence_post: [16, 16, 1],
  lamp: [16, 40, 1],
  lamp_lit: [14, 5, 1],
  signpost: [24, 26, 1],
  sign_small: [16, 16, 1],
  bench: [24, 12, 1],
  shell_0: [8, 6, 1],
  shell_1: [8, 6, 1],
  mushroom_0: [8, 8, 1],
  mushroom_1: [8, 8, 1],
  stump: [16, 12, 1],
  log: [20, 10, 1],
  lily_0: [8, 6, 1],
  lily_1: [8, 6, 1],
  reed_0: [8, 16, 1],
  reed_1: [8, 16, 1],
  chest_closed: [16, 14, 1],
  chest_open: [16, 14, 1],
  dock_post: [6, 12, 1],
  packet: [12, 12, 4],
  mote: [4, 4, 1],
  dust: [6, 6, 1],
  spark: [4, 4, 1],
  star: [3, 3, 1],
  leaf: [4, 3, 1],
  rain: [2, 11, 1],
  firefly: [3, 3, 1],
  ripple: [12, 6, 3],
  light_soft: [64, 64, 1],
  glow_warm: [48, 48, 1],
  glow_cool: [32, 32, 1],
  cloud_shadow: [128, 96, 1],
  beam: [160, 48, 1],
  water: [64, 64, 4],
  foam: [16, 16, 4],
}
const V1_NAMES = Object.keys(V1_DIMS)

/** Particles, glows and the water/foam tile strips are sized by the renderer,
 *  not by the art scale — they stay put when the island is redrawn at 32px. */
const FX = ['mote', 'dust', 'spark', 'star', 'leaf', 'rain', 'firefly', 'ripple', 'light_soft', 'glow_warm', 'glow_cool', 'cloud_shadow', 'beam', 'water', 'foam']
/** Canopy size floors are set per species (controller ruling), not by the blanket
 *  ×2 rule — pines stay tall and narrow, palms wide and short. */
const CANOPY: Record<string, [number, number]> = { tree_: [64, 72], pine_: [40, 72], palm_: [48, 64] }
const isCanopy = (n: string) => Object.keys(CANOPY).some((p) => n.startsWith(p))
/** Everything else that stands in the world scales with the tile. */
const WORLD_OBJECTS = V1_NAMES.filter((n) => !FX.includes(n) && !isCanopy(n))
/** WorldScene's DECOR_FRAME builds these names — renaming any of them drops the decor. */
const DECOR_FRAMES = ['tree_0', 'tree_1', 'pine_0', 'pine_1', 'palm_0', 'palm_1', 'bush_0', 'bush_1', 'rock_0', 'rock_1', 'flower_0', 'flower_1', 'flower_2', 'flower_3', 'mushroom_0', 'mushroom_1', 'shell_0', 'shell_1', 'fence_h', 'fence_v', 'fence_post', 'lamp', 'bench', 'lily_0', 'lily_1', 'reed_0', 'reed_1', 'stump', 'log', 'flowerbed']

describe('env pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('env')
})

/* ------------------------------------------------------------------ *
 * The v1 (16px) contract that used to sit here was deleted when the pack
 * was redrawn (task-2-env), as its header instructed — it is superseded
 * by the HD contract below, which is now live.
 * ------------------------------------------------------------------ */
describe('env pack — 32px HD contract', () => {
  it('keeps every v1 sprite name (rename guard)', () => {
    expectNames(ENV_DEFS, V1_NAMES)
  })

  it('still answers every name WorldScene.DECOR_FRAME builds', () => {
    for (const name of DECOR_FRAMES) need(byName, name)
  })

  it('draws each canopy species at its own HD floor (tree ≥64×72, pine ≥40×72, palm ≥48×64)', () => {
    for (const [prefix, [w, h]] of Object.entries(CANOPY)) {
      const species = ENV_DEFS.filter((d) => d.name.startsWith(prefix))
      expect(species.length, `${prefix}* defs`).toBeGreaterThanOrEqual(2)
      for (const d of species) expectAtLeast(byName, d.name, w, h)
    }
  })

  /* Added with the redraw (task-2-env). The controller's ruling for this pack
   * is that canopies pivot bottom-centre, because `Wind.update` sways a tree by
   * scaling it about its anchor — an anchor off the base or off centre makes the
   * whole tree slide sideways in the breeze, and no other assertion here would
   * catch it (`itIsAWellFormedPack` only checks the anchor is inside the frame). */
  it('pivots every canopy bottom-centre, where the wind sways it from', () => {
    for (const d of ENV_DEFS.filter((x) => isCanopy(x.name))) {
      const f = frameOf(d)
      expect(d.anchor, `${d.name} has no anchor`).toBeDefined()
      const [ax, ay] = d.anchor!
      expect(Math.abs(ax - f.w / 2) <= 1, `${d.name} anchor x ${ax} is not centred in ${f.w}`).toBe(true)
      expect(ay >= f.h - 4, `${d.name} anchor y ${ay} is not at the base of ${f.h}`).toBe(true)
    }
  })

  it('draws grass, bushes, rocks and flowers at 32px-cell scale', () => {
    expectScaledBy(ENV_DEFS, V1_DIMS, 2, ['grass_tall', 'bush_0', 'bush_1', 'rock_0', 'rock_1', 'flower_0', 'flower_1', 'flower_2', 'flower_3', 'flowerbed'])
    expectAtLeast(byName, 'grass_tall', 32, 32)
  })

  it('doubles every other object that stands in the world', () => {
    expectScaledBy(ENV_DEFS, V1_DIMS, 2, WORLD_OBJECTS)
  })

  it('leaves particles, glows and the water/foam strips at their renderer-tuned sizes', () => {
    for (const name of FX) {
      const f = frameOf(need(byName, name))
      const [w, h, frames] = V1_DIMS[name]
      expect([f.w, f.h, f.frames], name).toEqual([w, h, frames])
    }
  })
})
