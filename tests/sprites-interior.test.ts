import { describe, expect, it } from 'vitest'
import { PAL } from '../src/art/palette'
import { rasterize, sizeOf } from '../src/art/pixel'
import { INTERIOR_DEFS } from '../src/art/sprites/interior'

// name -> [sheet width, height, frames]; the game reads `${name}_0..n` for strips.
const EXPECT: Record<string, [number, number, number]> = {
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
  window_sky: [64, 16, 4],
  bed: [32, 40, 1],
  desk_pc: [64, 24, 2],
  bookshelf: [32, 40, 1],
  table: [32, 24, 1],
  chair_l: [16, 20, 1],
  chair_r: [16, 20, 1],
  plant: [16, 28, 1],
  fireplace: [64, 32, 2],
  sofa: [40, 24, 1],
  counter: [48, 24, 1],
  reception: [48, 32, 1],
  elevator: [96, 48, 3],
  console: [96, 32, 2],
  tank: [24, 40, 1],
  pipe_h: [16, 16, 1],
  pipe_v: [16, 16, 1],
  gear_big: [96, 24, 4],
  workbench: [48, 28, 1],
  toolwall: [64, 40, 1],
  tool_java: [12, 12, 1],
  tool_spring: [12, 12, 1],
  tool_python: [12, 12, 1],
  tool_cpp: [12, 12, 1],
  tool_sql: [12, 12, 1],
  tool_kafka: [12, 12, 1],
  tool_flink: [12, 12, 1],
  tool_kstreams: [12, 12, 1],
  tool_mq: [12, 12, 1],
  tool_redis: [12, 12, 1],
  tool_dynamo: [12, 12, 1],
  tool_docker: [12, 12, 1],
  tool_linux: [12, 12, 1],
  tool_git: [12, 12, 1],
  lens: [64, 32, 2],
  stairs: [32, 32, 1],
  mapscreen: [64, 24, 2],
  sos_button: [16, 16, 1],
  crate_covered: [40, 32, 1],
  poster_a: [16, 20, 1],
  poster_b: [16, 20, 1],
  lamp_table: [12, 20, 1],
  kettle: [12, 12, 1],
  frame_photo: [12, 12, 1],
  whiteboard: [40, 28, 1],
  server_rack: [48, 40, 2],
  cabinet: [24, 32, 1],
}

const TILE_NAMES = [
  'floor_wood',
  'floor_wood_alt',
  'floor_stone',
  'floor_tile',
  'floor_metal',
  'floor_carpet',
  'rug_mid',
  'rug_edge',
  'rug_corner',
  'wall_top',
  'wall_face',
  'wall_face_stone',
  'wall_face_metal',
  'door_mat',
  'exit_door',
  'window_day',
  'window_night',
  'window_sky',
]

describe('INTERIOR_DEFS', () => {
  const byName = new Map(INTERIOR_DEFS.map((d) => [d.name, d]))

  it('contains every expected sprite exactly once, and nothing unexpected', () => {
    const names = INTERIOR_DEFS.map((d) => d.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of Object.keys(EXPECT)) expect(byName.has(name), `missing ${name}`).toBe(true)
    for (const name of names) expect(EXPECT[name], `unexpected def ${name}`).toBeDefined()
  })

  it('every def has the exact size and frame count the room builder expects', () => {
    for (const d of INTERIOR_DEFS) {
      const { w, h } = sizeOf(d)
      expect([w, h, d.frames ?? 1], d.name).toEqual(EXPECT[d.name])
    }
  })

  it('rows are uniform length and legends resolve to palette keys', () => {
    for (const d of INTERIOR_DEFS) {
      expect(d.rows, `${d.name} should be row-authored`).toBeDefined()
      for (const r of d.rows!) expect(r.length, `${d.name} row width`).toBe(d.rows![0].length)
      for (const [ch, v] of Object.entries(d.legend))
        if (v !== 'transparent') expect(v in PAL, `${d.name} legend "${ch}" -> ${v}`).toBe(true)
    }
  })

  it('no frame rasterizes fully transparent', () => {
    for (const d of INTERIOR_DEFS) {
      const r = rasterize(d)
      const frames = d.frames ?? 1
      const fw = r.w / frames
      for (let f = 0; f < frames; f++) {
        let opaque = 0
        for (let y = 0; y < r.h; y++)
          for (let x = 0; x < fw; x++) if (r.data[(y * r.w + f * fw + x) * 4 + 3] > 0) opaque++
        expect(opaque, `${d.name} frame ${f}`).toBeGreaterThan(0)
      }
    }
  })

  it('tiles anchor at the top-left and draw with no outline', () => {
    for (const name of TILE_NAMES) {
      const d = byName.get(name)!
      expect(d.anchor, name).toEqual([0, 0])
      expect(d.outline, name).toBeUndefined()
    }
  })

  it('furniture is outlined and anchored bottom-centre (gear and tools centred)', () => {
    for (const d of INTERIOR_DEFS) {
      if (TILE_NAMES.includes(d.name)) continue
      expect(d.outline, d.name).toBe('outline')
      const [w, h] = EXPECT[d.name]
      const fw = w / (d.frames ?? 1)
      if (d.name === 'gear_big' || d.name.startsWith('tool_')) expect(d.anchor, d.name).toEqual([fw / 2, fw / 2])
      else expect(d.anchor, d.name).toEqual([fw / 2, h])
    }
  })
})
