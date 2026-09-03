import { describe, expect, it } from 'vitest'
import { TILE, WORLD_SEED } from '../src/config'
import { makeRng } from '../src/core/rng'
import { BLUEPRINT, fenceRing, footprintContains, inRect, rasterizeBlueprint } from '../src/world/blueprint'
import { regionAt } from '../src/world/regions'
import { scatterDecor } from '../src/world/scatter'
import { LOW_KINDS, T, isLand } from '../src/world/terrain'

describe('scatterDecor', () => {
  const grid = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))
  const decor = scatterDecor(grid, BLUEPRINT, makeRng(WORLD_SEED).fork('scatter'))
  const tx = (d: { x: number }) => Math.floor(d.x / TILE)
  const ty = (d: { y: number }) => Math.floor(d.y / TILE)
  const tileOf = (d: { x: number; y: number }) => grid.get(tx(d), ty(d))
  const of = (kind: string) => decor.filter((d) => d.kind === kind)
  const fence = BLUEPRINT.fence
  const outside = (x: number, y: number) => x < fence.x || y < fence.y || x >= fence.x + fence.w || y >= fence.y + fence.h

  it('produces a rich, deterministic set', () => {
    expect(decor.length).toBeGreaterThan(600)
    const again = scatterDecor(grid, BLUEPRINT, makeRng(WORLD_SEED).fork('scatter'))
    expect(again).toEqual(decor)
  })

  it('fences the park in, leaving only the gate open', () => {
    const posted = new Set(of('fence').map((d) => `${tx(d)},${ty(d)}`))
    // every boundary tile the gate arch does not cover carries a fence piece
    const covered = (x: number, y: number) => BLUEPRINT.attractions.some((a) => footprintContains(a, x, y))
    const wanted = fenceRing(BLUEPRINT, covered)
    expect(wanted.length).toBeGreaterThan(200)
    for (const t of wanted) expect(posted.has(`${t.x},${t.y}`), `no fence at ${t.x},${t.y}`).toBe(true)
    expect(posted.size).toBe(wanted.length)
    for (const d of of('fence')) {
      expect(d.solid, 'the fence has to stop you').toBe(true)
      expect(inRect(BLUEPRINT.gateOpening, tx(d), ty(d)), `fence across the gate at ${tx(d)},${ty(d)}`).toBe(false)
    }
    // hedges grow on the outside of it
    expect(of('bush').length).toBeGreaterThan(60)
    for (const d of of('bush')) expect(outside(tx(d), ty(d)) || ty(d) === fence.y - 1, `hedge inside the park at ${tx(d)},${ty(d)}`).toBe(true)
  })

  it('plants the picnic lawn: the fair has trees inside the fence, not only round it', () => {
    // The regions used to leave `picnic` 115 tiles inside the fence, so the park
    // itself was bare. 30 is the floor; the layout as it stands gives 40.
    const inside = of('tree').filter((d) => !outside(tx(d), ty(d)))
    expect(inside.length).toBeGreaterThanOrEqual(30)
    for (const d of inside) expect(regionAt(BLUEPRINT.regions, tx(d) + 0.5, ty(d) + 0.5)?.id, `tree inside the fence at ${tx(d)},${ty(d)}`).toBe('picnic')
  })

  it('keeps trees out of the fair — beyond the fence and on the picnic lawns only', () => {
    const trees = of('tree')
    expect(trees.length).toBeGreaterThan(40)
    for (const d of trees) {
      const x = tx(d)
      const y = ty(d)
      const region = regionAt(BLUEPRINT.regions, x + 0.5, y + 0.5)?.id
      expect(outside(x, y) || region === 'picnic', `tree in ${region} at ${x},${y}`).toBe(true)
      expect(region, `tree on the midway at ${x},${y}`).not.toBe('midway')
      // never within two tiles of somewhere people walk or something they visit
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (!grid.inb(x + dx, y + dy)) continue
          const t = grid.get(x + dx, y + dy)
          expect(t === T.PATH || t === T.PLAZA, `tree ${x},${y} crowds paving at ${x + dx},${y + dy}`).toBe(false)
          for (const a of BLUEPRINT.attractions) expect(footprintContains(a, x + dx, y + dy), `tree ${x},${y} crowds ${a.id}`).toBe(false)
        }
    }
    // the island's woodland kinds are gone
    for (const k of ['pine', 'palm', 'rock', 'rock_s', 'shell', 'mushroom', 'stump', 'log']) expect(of(k).length, k).toBe(0)
  })

  it('lights the midway and the avenue, with bunting between the posts', () => {
    const lamps = of('lamp')
    expect(lamps.length).toBeGreaterThanOrEqual(12)
    expect(lamps.every((d) => d.solid)).toBe(true)
    // posts stand on the midway or the avenue, never on the gravel
    for (const d of lamps) expect(tileOf(d), `lamp on gravel at ${tx(d)},${ty(d)}`).not.toBe(T.PATH)
    const midway = lamps.filter((d) => tx(d) >= 24 && tx(d) < 48 && ty(d) >= 38 && ty(d) < 47)
    expect(midway.length).toBeGreaterThanOrEqual(6)
    const bunting = of('bunting')
    expect(bunting.length).toBeGreaterThanOrEqual(4)
    // strung overhead: never solid, and always level with a row of posts
    for (const d of bunting) {
      expect(d.solid).toBe(false)
      expect(lamps.some((l) => ty(l) === ty(d)), `bunting at ${tx(d)},${ty(d)} hangs off nothing`).toBe(true)
    }
    expect(of('bench').length).toBeGreaterThanOrEqual(2)
    expect(of('flowerbed').length).toBeGreaterThanOrEqual(6)
  })

  it('never lands soft decor on water, roads or paving', () => {
    const banned = new Set<number>([T.PATH, T.PLAZA])
    const furniture = new Set(['lamp', 'bench', 'bunting', 'fence'])
    for (const d of decor) {
      const t = tileOf(d)
      if (d.kind === 'lily' || d.kind === 'reed') continue
      expect(isLand(t), `${d.kind} at ${d.x},${d.y}`).toBe(true)
      if (!furniture.has(d.kind)) expect(banned.has(t), `${d.kind} on ${t} at ${d.x},${d.y}`).toBe(false)
    }
  })

  it('keeps attraction footprints, doors and spots clear', () => {
    for (const a of BLUEPRINT.attractions) {
      for (const d of decor) {
        if (d.kind === 'fence') continue // the fence line meets the gate arch by design
        expect(footprintContains(a, tx(d), ty(d), 1), `${d.kind} inside ${a.id}`).toBe(false)
        expect(tx(d) === a.door.x && (ty(d) === a.door.y || ty(d) === a.door.y + 1), `${d.kind} in the doorway of ${a.id}`).toBe(false)
      }
    }
    const spots = [...Object.values(BLUEPRINT.npcSpots), ...Object.values(BLUEPRINT.storySpots), BLUEPRINT.spawn, BLUEPRINT.fishingSpot]
    for (const s of spots) for (const d of decor) expect(tx(d) === s.x && ty(d) === s.y, `${d.kind} standing on ${s.x},${s.y}`).toBe(false)
  })

  it('scatters nothing under a structure', () => {
    // The rides are drawn over their whole footprint: decor beneath one is decor
    // nobody will ever see, and a solid one would be a wall in mid-air.
    for (const s of BLUEPRINT.structures)
      for (const d of decor) {
        if (d.kind === 'fence') continue // the fence line runs through the turnstiles' row by design
        expect(footprintContains(s, tx(d), ty(d)), `${d.kind} under ${s.sprite} at ${tx(d)},${ty(d)}`).toBe(false)
      }
  })

  it('leaves the balloons to the scene and the pond to the ducks', () => {
    // shells became balloon pickups, placed from `shellSpots` by WorldScene
    expect(of('shell').length).toBe(0)
    expect(of('lily').length).toBeGreaterThan(2)
    for (const d of of('lily')) expect(tileOf(d)).toBe(T.POND)
    for (const d of of('reed')) {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid.get(tx(d) + dx, ty(d) + dy) === T.POND)
      expect(near, `reed away from the pond at ${tx(d)},${ty(d)}`).toBe(true)
    }
  })

  it('marks blocking decor solid and soft decor not', () => {
    for (const k of ['tree', 'bush', 'fence', 'lamp', 'bench']) expect(of(k).every((d) => d.solid), k).toBe(true)
    for (const k of ['flower', 'grass', 'flowerbed', 'bunting', 'lily', 'reed']) expect(of(k).every((d) => !d.solid), k).toBe(true)
    // the fence and the hedge are low enough to hop; a tree is not
    expect(LOW_KINDS.has('fence')).toBe(true)
    expect(LOW_KINDS.has('bush')).toBe(true)
    expect(LOW_KINDS.has('tree')).toBe(false)
  })

  it('keeps trees spaced apart', () => {
    const trees = of('tree')
    for (let i = 0; i < trees.length; i++)
      for (let j = i + 1; j < trees.length; j++) {
        const dist = Math.hypot(trees[i].x - trees[j].x, trees[i].y - trees[j].y)
        expect(dist, `trees at ${trees[i].x},${trees[i].y} and ${trees[j].x},${trees[j].y}`).toBeGreaterThanOrEqual(40)
      }
  })
})
