import { describe, expect, it } from 'vitest'
import { NPC_DEFS } from '../../src/art/sprites/npcs'
import { NPC_INFO } from '../../src/data/npcs'
import {
  type Dims,
  expectAtLeast,
  expectFrame,
  expectNames,
  frameOf,
  index,
  itIsAWellFormedPack,
  need,
} from './helpers'

const byName = index(NPC_DEFS)

/** Engine direction tokens (see the note in hero.test.ts). */
const DIRS = ['down', 'up', 'left', 'right'] as const
/**
 * Controller ruling (task 2b): the HD rig walks on FOUR frames
 * (contact–down–contact–up). Frames 2 and 3 are new art; Npc.ts still drives
 * indices 0..1 today and a later task widens the anim registration.
 */
const WALK = [0, 1, 2, 3] as const
/**
 * Byte is a quadruped, not a member of the humanoid rig, so she keeps her
 * two-frame scamper (Companion.ts drives indices 0..1).
 */
const CAT_WALK = [0, 1] as const

/* Frozen from the v1 (16px) pack — the rename guard for the HD redraw. */
const V1_IDS = ['mira', 'tomas', 'pip', 'lou', 'ada', 'ravi', 'sol', 'devi', 'arjun', 'ilse', 'naman']
const rigFrames = (ids: string[]) =>
  ids.flatMap((id) => DIRS.flatMap((d) => [`npc_${id}_idle_${d}`, ...WALK.map((i) => `npc_${id}_walk_${d}_${i}`)]))
const V1_RIG = rigFrames(V1_IDS)
const V1_FACES = [...V1_IDS.map((id) => `face_${id}`), 'face_hero', 'face_naman_happy', 'face_hero_happy']
const V1_CAT = [...DIRS.flatMap((d) => [`cat_idle_${d}`, ...CAT_WALK.map((i) => `cat_walk_${d}_${i}`)]), 'cat_sit']
const V1_CRITTERS: Dims = {
  butterfly: [8, 8, 2],
  butterfly_blue: [8, 8, 2],
  gull: [16, 10, 2],
  crab: [12, 8, 2],
  fish_jump: [12, 12, 3],
}
const V1_NAMES: string[] = [...V1_RIG, ...V1_FACES, ...V1_CAT, ...Object.keys(V1_CRITTERS)]

/**
 * HD critter strips: exact [frame width, frame height, frame count]. Frame
 * COUNTS are load-bearing — the ambient spawner cycles them — so they are
 * pinned here, not just floor-checked against the v1 sizes.
 */
const HD_CRITTERS: Dims = {
  butterfly: [16, 16, 2],
  butterfly_blue: [16, 16, 2],
  gull: [32, 20, 2],
  crab: [24, 16, 2],
  fish_jump: [24, 24, 3],
}

/**
 * Byte's ground line. Her paw art ends on row 26 of a 28-row frame and the
 * anchor sits one row below it — the same rule as the 32×48 rig (feet end on
 * row 45, anchor [16,46]). A literal ×2 of v1's [8,13] would be [16,26], which
 * puts the origin ON the last paw row and sinks her 1px into the ground plane
 * relative to every other HD character, so [16,27] is the intended value.
 */
const CAT_ANCHOR: [number, number] = [16, 27]

/**
 * Everyone who needs a walking rig once the campus and warehouse open.
 * Byte is excluded by the controller's ruling: her body is not a 32×48 humanoid
 * rig, only her portrait (`face_cat`) belongs to this contract.
 *
 * `V1_IDS` is folded in because the art outlives the cast: Lou and Devi were
 * cut from `NPC_INFO` in v3 but their sprites stay in the pack (the rename
 * guard above still wants them), and a rig nobody speaks for is still a rig
 * this contract covers.
 */
const HD_IDS = [...new Set([...Object.keys(NPC_INFO).filter((id) => id !== 'cat'), ...V1_IDS, 'professor', 'dockmaster'])]

describe('npc pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('npcs')
})

describe('32px HD contract', () => {
  it('keeps every v1 sprite name (rename guard)', () => {
    expectNames(NPC_DEFS, V1_NAMES)
  })

  it('gives every cast member a 32×48 rig anchored at [16, 46]', () => {
    for (const id of HD_IDS)
      for (const name of rigFrames([id])) {
        const d = expectFrame(byName, name, 32, 48)
        expect(d.anchor, `${name} anchor`).toEqual([16, 46])
        expect(d.outline, `${name} outline`).toBe('outline')
      }
  })

  it('covers the new campus and warehouse cast', () => {
    for (const id of ['professor', 'dockmaster']) need(byName, `npc_${id}_idle_down`)
  })

  // Controller amendment (supersedes the brief's 24×24): portraits stay 32×32.
  it('draws every portrait at 32×32, anchored bottom-centre', () => {
    for (const d of NPC_DEFS.filter((x) => x.name.startsWith('face_'))) {
      expectFrame(byName, d.name, 32, 32)
      expect(d.anchor, `${d.name} anchor`).toEqual([16, 32])
    }
  })

  it('has a 32×32 portrait for everyone the dialogue can name (including Byte the cat)', () => {
    for (const id of [...HD_IDS, 'cat']) expectFrame(byName, `face_${id}`, 32, 32)
    for (const name of ['face_hero', 'face_naman_happy', 'face_hero_happy']) expectFrame(byName, name, 32, 32)
  })

  it('scales the cat and the critters with the rest of the island', () => {
    for (const name of V1_CAT) expectAtLeast(byName, name, 32, 28)
    for (const [name, [w, h]] of Object.entries(V1_CRITTERS)) expectAtLeast(byName, name, w * 2, h * 2)
  })

  it('anchors every cat frame on the ground line one row below her paws ([16, 27])', () => {
    for (const name of V1_CAT) {
      const d = need(byName, name)
      expect(d.anchor, `${name} anchor`).toEqual(CAT_ANCHOR)
      expect(d.outline, `${name} outline`).toBe('outline')
    }
  })

  it('pins each critter strip to an exact frame size and frame count', () => {
    for (const [name, dims] of Object.entries(HD_CRITTERS)) {
      const f = frameOf(need(byName, name))
      expect([f.w, f.h, f.frames], name).toEqual(dims)
    }
  })
})
