import { describe, expect, it } from 'vitest'
import { HERO_DEFS } from '../../src/art/sprites/hero'
import { type Dims, expectAtLeast, expectFrame, expectNames, expectScaledBy, index, itIsAWellFormedPack, need } from './helpers'

const byName = index(HERO_DEFS)

/** Engine direction tokens. The spec writes these as {n,e,s,w}; Player.ts and
 *  atlas.ts build frame names from {up,right,down,left}, so those are the ones
 *  the pack must ship — renaming would break every hero animation. */
const DIRS = ['down', 'up', 'left', 'right'] as const

/* Frozen from the v1 (16px) pack — the rename guard for the HD redraw. */
const RIG: string[] = DIRS.flatMap((d) => [
  `hero_idle_${d}`,
  ...[0, 1, 2, 3].map((i) => `hero_walk_${d}_${i}`),
  `hero_swing_${d}_0`,
  `hero_swing_${d}_1`,
])
const HATS: string[] = ['hat_hardhat', 'hat_seashell', 'hat_catears', 'hat_crown']
const V1_NAMES: string[] = [...RIG, ...HATS, 'shadow']

/* HD-only poses. Not part of the v1 rename guard, but they are rig frames and
 * must carry the same frame size, anchor and outline as the rest of the rig. */
const HOP: string[] = ['hero_hop_0', 'hero_hop_1']
const FISH: string[] = ['hero_fish_cast', 'hero_fish_reel']

const at = (names: string[], w: number, h: number): Dims =>
  Object.fromEntries(names.map((n) => [n, [w, h, 1] as [number, number, number]]))
const V1_DIMS: Dims = { ...at(RIG, 16, 24), ...at(HATS, 12, 8), shadow: [16, 3, 1] }

describe('hero pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('hero')
})

describe('32px HD contract', () => {
  it('keeps every v1 sprite name (rename guard)', () => {
    expectNames(HERO_DEFS, V1_NAMES)
  })

  it('at least doubles every v1 frame', () => {
    expectScaledBy(HERO_DEFS, V1_DIMS, 2, V1_NAMES)
  })

  it('draws the character rig at 32×48, anchored bottom-centre at [16, 46]', () => {
    for (const name of [...RIG, ...HOP, ...FISH]) {
      const d = expectFrame(byName, name, 32, 48)
      expect(d.anchor, `${name} anchor`).toEqual([16, 46])
      expect(d.outline, `${name} outline`).toBe('outline')
    }
  })

  it('has a 4-frame walk cycle and an idle pose per direction', () => {
    for (const d of DIRS) {
      expectFrame(byName, `hero_idle_${d}`, 32, 48)
      for (const i of [0, 1, 2, 3]) expectFrame(byName, `hero_walk_${d}_${i}`, 32, 48)
    }
  })

  it('has the hop pair (airborne tuck + stretch) at rig size', () => {
    for (const name of HOP) expectFrame(byName, name, 32, 48)
  })

  it('has the fishing poses at rig size', () => {
    for (const name of FISH) expectFrame(byName, name, 32, 48)
  })

  it('has the 48×48 welcome-card portrait', () => {
    expectFrame(byName, 'portrait_naman', 48, 48)
  })

  it('adds the three new hats and scales every hat to the 32×48 rig', () => {
    for (const name of ['hat_goggles', 'hat_captain', 'hat_grad']) need(byName, name)
    // hats sit on the rig's head, so they at least double with it
    for (const d of HERO_DEFS.filter((x) => x.name.startsWith('hat_'))) expectAtLeast(byName, d.name, 24, 16)
  })

  it('scales the ground shadow with the rig', () => {
    expectAtLeast(byName, 'shadow', 32, 6)
  })
})
