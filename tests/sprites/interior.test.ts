import { describe, expect, it } from 'vitest'
import { INTERIOR_DEFS } from '../../src/art/sprites/interior'
import { type Dims, expectAtLeast, expectFrame, expectNames, frameOf, index, itIsAWellFormedPack, need } from './helpers'

// NB: the `hat_*` defs live in the hero pack, so the hat contract
// (hat_goggles / hat_captain / hat_grad) is in tests/sprites/hero.test.ts.

const byName = index(INTERIOR_DEFS)

const TOOLS = ['java', 'spring', 'python', 'cpp', 'sql', 'kafka', 'flink', 'kstreams', 'mq', 'redis', 'dynamo', 'docker', 'linux', 'git'].map((t) => `tool_${t}`)

/** Frozen from the v1 (16px) pack: name → [frame width, height, frames]. */
const V1_DIMS: Dims = {
  floor_wood: [16, 16, 1],
  floor_wood_alt: [16, 16, 1],
  floor_stone: [16, 16, 1],
  floor_tile: [16, 16, 1],
  floor_metal: [16, 16, 1],
  floor_carpet: [16, 16, 1],
  rug_mid: [16, 16, 1],
  rug_edge: [16, 16, 1],
  rug_corner: [16, 16, 1],
  wall_top: [16, 16, 1],
  wall_face: [16, 16, 1],
  wall_face_stone: [16, 16, 1],
  wall_face_metal: [16, 16, 1],
  door_mat: [16, 16, 1],
  exit_door: [16, 16, 1],
  window_day: [16, 16, 1],
  window_night: [16, 16, 1],
  window_sky: [16, 16, 4],
  bed: [32, 40, 1],
  desk_pc: [32, 24, 2],
  bookshelf: [32, 40, 1],
  table: [32, 24, 1],
  chair_l: [16, 20, 1],
  chair_r: [16, 20, 1],
  plant: [16, 28, 1],
  fireplace: [32, 32, 2],
  sofa: [40, 24, 1],
  counter: [48, 24, 1],
  reception: [48, 32, 1],
  elevator: [32, 48, 3],
  console: [48, 32, 2],
  tank: [24, 40, 1],
  pipe_h: [16, 16, 1],
  pipe_v: [16, 16, 1],
  gear_big: [24, 24, 4],
  workbench: [48, 28, 1],
  toolwall: [64, 40, 1],
  ...Object.fromEntries(TOOLS.map((t) => [t, [12, 12, 1] as [number, number, number]])),
  lens: [32, 32, 2],
  stairs: [32, 32, 1],
  mapscreen: [32, 24, 2],
  sos_button: [16, 16, 1],
  crate_covered: [40, 32, 1],
  poster_a: [16, 20, 1],
  poster_b: [16, 20, 1],
  lamp_table: [12, 20, 1],
  kettle: [12, 12, 1],
  frame_photo: [12, 12, 1],
  whiteboard: [40, 28, 1],
  server_rack: [24, 40, 2],
  cabinet: [24, 32, 1],
}
const V1_NAMES = Object.keys(V1_DIMS)

/** Tiles: laid on the room grid, so they anchor top-left and carry no outline. */
const TILE_NAMES = [
  'floor_wood', 'floor_wood_alt', 'floor_stone', 'floor_tile', 'floor_metal', 'floor_carpet',
  'rug_mid', 'rug_edge', 'rug_corner',
  'wall_top', 'wall_face', 'wall_face_stone', 'wall_face_metal',
  'door_mat', 'exit_door', 'window_day', 'window_night', 'window_sky',
]
/** Free-floating icons: anchored at the centre of their (square) frame. */
const CENTRED = ['gear_big', ...TOOLS]

/** New rooms opened by the campus and warehouse landmarks (spec §Task 2). */
const HD_NEW = ['int_desk', 'int_lectern', 'int_bookrow', 'int_cratestack', 'int_pallet', 'int_ropecoil']

/**
 * The prize-tent and arcade set (Story Isle spec §9): name → [w, h, frames, anchor].
 * These five are the exception to the bottom-centre rule below, so their anchors
 * are pinned individually — each sits 4px above the frame foot so the cabinet
 * front / shelf underside overlaps the cell in front of it instead of stopping
 * dead on the grid line.
 */
const FAIR: Record<string, [number, number, number, [number, number]]> = {
  int_claw: [64, 96, 2, [32, 92]],
  int_prizeshelf: [96, 48, 1, [48, 44]],
  int_cabinet: [48, 80, 2, [24, 76]],
  int_bunting: [96, 16, 1, [48, 12]],
  int_balloons: [32, 48, 1, [16, 44]],
}

/** Anchor + outline conventions. Resolution-agnostic: derived from each def's own frame. */
function expectConventions(): void {
  for (const d of INTERIOR_DEFS) {
    const f = frameOf(d)
    if (TILE_NAMES.includes(d.name)) {
      expect(d.anchor, `${d.name} anchor`).toEqual([0, 0])
      expect(d.outline, `${d.name} outline`).toBeUndefined()
    } else {
      expect(d.outline, `${d.name} outline`).toBe('outline')
      const pinned = FAIR[d.name]
      expect(d.anchor, `${d.name} anchor`).toEqual(
        pinned ? pinned[3] : CENTRED.includes(d.name) ? [f.w / 2, f.w / 2] : [f.w / 2, f.h],
      )
    }
  }
}

describe('interior pack — structural validity (any resolution)', () => {
  itIsAWellFormedPack('interior')

  it('follows the tile / furniture anchor and outline conventions', () => {
    expectConventions()
  })
})

describe('32px HD contract', () => {
  it('keeps every v1 sprite name (rename guard)', () => {
    expectNames(INTERIOR_DEFS, V1_NAMES)
  })

  it('doubles every v1 def to the 32px cell, frame counts unchanged', () => {
    for (const [name, [w, h, frames]] of Object.entries(V1_DIMS)) {
      const f = frameOf(need(byName, name))
      expect([f.w, f.h, f.frames], name).toEqual([w * 2, h * 2, frames])
    }
  })

  it('lays every room tile out on a 32×32 cell', () => {
    for (const name of TILE_NAMES) expectFrame(byName, name, 32, 32)
  })

  it('adds the campus set (desk, lectern, bookshelf row)', () => {
    for (const name of ['int_desk', 'int_lectern', 'int_bookrow']) need(byName, name)
  })

  it('adds the warehouse set (crate stack, pallet, rope coil)', () => {
    for (const name of ['int_cratestack', 'int_pallet', 'int_ropecoil']) need(byName, name)
  })

  it('draws the new furniture at least one 32px cell wide', () => {
    for (const name of HD_NEW) expectAtLeast(byName, name, 32, 16)
  })

  it('adds the prize-tent and arcade set at its pinned size, frame count and anchor', () => {
    for (const [name, [w, h, frames, anchor]] of Object.entries(FAIR)) {
      const d = expectFrame(byName, name, w, h)
      expect(frameOf(d).frames, `${name} frames`).toBe(frames)
      expect(d.anchor, `${name} anchor`).toEqual(anchor)
    }
  })

  it('still follows the tile / furniture anchor and outline conventions', () => {
    expectConventions()
  })
})
