import { describe, expect, it } from 'vitest'
import { BUILDING_DEFS } from '../src/art/sprites/buildings'
import { rasterize, sizeOf } from '../src/art/pixel'

const EXPECTED: Record<string, [number, number]> = {
  bld_about: [80, 80],
  bld_experience: [96, 140],
  bld_skills: [96, 72],
  bld_lineage: [112, 88],
  bld_stealth: [80, 56],
  bld_safestride: [80, 72],
  bld_contact: [48, 120],
}

const byName = new Map(BUILDING_DEFS.map((d) => [d.name, d]))

describe('BUILDING_DEFS', () => {
  it('has unique names', () => {
    expect(byName.size).toBe(BUILDING_DEFS.length)
  })

  it('every def rasterizes (all legend chars and colours are valid)', () => {
    for (const def of BUILDING_DEFS) expect(() => rasterize(def), def.name).not.toThrow()
  })

  it('no def is fully transparent', () => {
    for (const def of BUILDING_DEFS) {
      const r = rasterize(def)
      let opaque = 0
      for (let i = 3; i < r.data.length; i += 4) if (r.data[i] > 0) opaque++
      expect(opaque, def.name).toBeGreaterThan(0)
    }
  })

  it('rows are rectangular (every row padded to the sprite width)', () => {
    for (const def of BUILDING_DEFS) {
      if (!def.rows) continue
      const { w } = sizeOf(def)
      for (const row of def.rows) expect(row.length, def.name).toBe(w)
    }
  })

  it('the seven landmarks exist with the agreed sizes and bottom-centre anchors', () => {
    for (const [name, [w, h]] of Object.entries(EXPECTED)) {
      const def = byName.get(name)
      expect(def, name).toBeDefined()
      expect(sizeOf(def!), name).toEqual({ w, h })
      expect(def!.anchor, name).toEqual([w / 2, h])
      expect(def!.outline, name).toBe('outline')
    }
  })

  it('each landmark has a night overlay matching its size and anchor', () => {
    for (const [name, [w, h]] of Object.entries(EXPECTED)) {
      const night = byName.get(name + '_night')
      expect(night, name + '_night').toBeDefined()
      expect(sizeOf(night!), name + '_night').toEqual({ w, h })
      expect(night!.anchor, name + '_night').toEqual([w / 2, h])
    }
  })

  it('includes the smoke puff and the warm door glow', () => {
    const smoke = byName.get('smoke')
    expect(smoke).toBeDefined()
    expect(sizeOf(smoke!)).toEqual({ w: 8, h: 8 })
    expect(smoke!.anchor).toEqual([4, 4])
    const glow = byName.get('door_light')
    expect(glow).toBeDefined()
    expect(sizeOf(glow!)).toEqual({ w: 24, h: 12 })
    expect(glow!.anchor).toEqual([12, 6])
  })
})
