import { describe, expect, it } from 'vitest'
import { ROOMS } from '../src/data/rooms'
import { parseRoom } from '../src/world/rooms'

const INTERIOR_SPRITES = new Set([
  'bed', 'desk_pc', 'bookshelf', 'table', 'chair_l', 'chair_r', 'plant', 'fireplace', 'sofa', 'counter', 'reception', 'elevator', 'console', 'tank',
  'pipe_h', 'pipe_v', 'gear_big', 'workbench', 'toolwall', 'lens', 'stairs', 'mapscreen', 'sos_button', 'crate_covered', 'poster_a', 'poster_b',
  'lamp_table', 'kettle', 'frame_photo', 'whiteboard', 'server_rack', 'cabinet', 'rug_mid', 'rug_edge', 'rug_corner',
])

describe('rooms', () => {
  it('defines the seven landmark rooms', () => {
    expect(Object.keys(ROOMS).sort()).toEqual(['about', 'contact', 'experience', 'lineage', 'safestride', 'skills', 'stealth'])
  })

  for (const [id, def] of Object.entries(ROOMS)) {
    describe(id, () => {
      const room = parseRoom(def)

      it('has consistent row widths and a wall border', () => {
        for (const r of def.rows) expect(r.length).toBe(def.rows[0].length)
        expect(room.w).toBe(def.rows[0].length + 2)
        expect(room.h).toBe(def.rows.length + 3)
      })

      it('spawn and exit are on walkable floor', () => {
        const blocked = (x: number, y: number) => room.solids.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)
        expect(blocked(room.spawn.x, room.spawn.y)).toBe(false)
        expect(blocked(room.exit.x, room.exit.y - 2)).toBe(false)
      })

      it('uses known interior sprites and valid interactions', () => {
        for (const p of room.props) {
          expect(INTERIOR_SPRITES.has(p.sprite), p.sprite).toBe(true)
          if (p.interact) expect(p.interact.startsWith('tree:') || p.interact.startsWith('panel:'), p.interact).toBe(true)
          expect(p.x).toBeGreaterThan(0)
          expect(p.x).toBeLessThan(room.w * 16)
          expect(p.y).toBeGreaterThan(0)
          expect(p.y).toBeLessThan(room.h * 16)
        }
      })

      it('keeps the exit gap open in the bottom wall', () => {
        const gap = room.tiles[room.h - 1][Math.floor(room.exit.x / 16)]
        expect(gap).toBe('exit_door')
      })
    })
  }
})
