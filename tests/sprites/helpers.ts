// Shared harness for the six per-pack sprite suites.
//
// Everything here is deliberately resolution-agnostic: it passes against the
// current 16px defs and must keep passing once a pack is redrawn at 32px, so
// six pack agents can work in parallel without touching this file. Anything
// that pins a size or a name belongs in the pack's own test file.
import { expect, it } from 'vitest'
import { PAL } from '../../src/art/palette'
import { rasterize, sizeOf, type SpriteDef } from '../../src/art/pixel'
import { BUILDING_DEFS } from '../../src/art/sprites/buildings'
import { ENV_DEFS } from '../../src/art/sprites/env'
import { HERO_DEFS } from '../../src/art/sprites/hero'
import { INTERIOR_DEFS } from '../../src/art/sprites/interior'
import { NPC_DEFS } from '../../src/art/sprites/npcs'
import { PROP_DEFS } from '../../src/art/sprites/props'

export type PackName = 'hero' | 'npcs' | 'env' | 'props' | 'buildings' | 'interior'

export const PACKS: Record<PackName, SpriteDef[]> = {
  hero: HERO_DEFS,
  npcs: NPC_DEFS,
  env: ENV_DEFS,
  props: PROP_DEFS,
  buildings: BUILDING_DEFS,
  interior: INTERIOR_DEFS,
}

/** name → [frame width, height, frame count] — the shape of every dimension table below. */
export type Dims = Record<string, [number, number, number]>

export const index = (defs: SpriteDef[]): Map<string, SpriteDef> => new Map(defs.map((d) => [d.name, d]))

/** Size of ONE frame (strips hold `frames` frames side by side). */
export function frameOf(def: SpriteDef): { w: number; h: number; frames: number } {
  const { w, h } = sizeOf(def)
  const frames = def.frames ?? 1
  return { w: w / frames, h, frames }
}

/** Look a def up, failing with the sprite name rather than a null deref. */
export function need(defs: SpriteDef[] | Map<string, SpriteDef>, name: string): SpriteDef {
  const map = defs instanceof Map ? defs : index(defs)
  const d = map.get(name)
  expect(d, `missing sprite def "${name}"`).toBeDefined()
  return d!
}

/** Opaque pixel count inside frame `f` of a rasterized def. */
export function opaqueIn(def: SpriteDef, f = 0): number {
  const r = rasterize(def)
  const frames = def.frames ?? 1
  const fw = r.w / frames
  let n = 0
  for (let y = 0; y < r.h; y++) for (let x = f * fw; x < (f + 1) * fw; x++) if (r.data[(y * r.w + x) * 4 + 3] > 0) n++
  return n
}

/* ------------------------------------------------------------------ */
/* assertions the per-pack contract blocks call inline                  */
/* ------------------------------------------------------------------ */

/** `name` exists at exactly `w`×`h` per frame. */
export function expectFrame(defs: SpriteDef[] | Map<string, SpriteDef>, name: string, w: number, h: number): SpriteDef {
  const d = need(defs, name)
  const f = frameOf(d)
  expect([f.w, f.h], `${name} frame size`).toEqual([w, h])
  return d
}

/** `name` exists and is at least `w`×`h` per frame (used where the spec sets a floor, not a value). */
export function expectAtLeast(defs: SpriteDef[] | Map<string, SpriteDef>, name: string, w: number, h: number): SpriteDef {
  const d = need(defs, name)
  const f = frameOf(d)
  expect(f.w, `${name} frame width`).toBeGreaterThanOrEqual(w)
  expect(f.h, `${name} frame height`).toBeGreaterThanOrEqual(h)
  return d
}

/** Rename guard: every frozen name is still defined (extra names are fine). */
export function expectNames(defs: SpriteDef[], frozen: readonly string[]): void {
  const have = new Set(defs.map((d) => d.name))
  const gone = frozen.filter((n) => !have.has(n))
  expect(gone, 'sprites renamed or dropped').toEqual([])
}

/** Every listed def is at least `k`× its frozen v1 frame size. */
export function expectScaledBy(defs: SpriteDef[], v1: Dims, k: number, names: readonly string[]): void {
  const map = index(defs)
  for (const name of names) {
    const [w, h] = v1[name]
    expectAtLeast(map, name, w * k, h * k)
  }
}

/* ------------------------------------------------------------------ */
/* the generic validity suite every pack runs, at any resolution        */
/* ------------------------------------------------------------------ */

/**
 * Registers the checks a pack must satisfy whatever size it is drawn at.
 * Call once from inside a `describe()` in the pack's test file.
 */
export function itIsAWellFormedPack(pack: PackName): void {
  const defs = PACKS[pack]

  it('defines at least one sprite', () => {
    expect(defs.length).toBeGreaterThan(0)
  })

  it('has no duplicate names', () => {
    const seen = new Set<string>()
    const dupes = defs.filter((d) => (seen.has(d.name) ? true : (seen.add(d.name), false))).map((d) => d.name)
    expect(dupes).toEqual([])
  })

  it('does not collide with the other packs (the atlas is one flat namespace)', () => {
    const mine = new Set(defs.map((d) => d.name))
    for (const [other, otherDefs] of Object.entries(PACKS)) {
      if (other === pack) continue
      const clash = otherDefs.filter((d) => mine.has(d.name)).map((d) => d.name)
      expect(clash, `names also defined by the ${other} pack`).toEqual([])
    }
  })

  it('every legend entry resolves to a palette key, a literal colour or transparent', () => {
    for (const d of defs)
      for (const [ch, v] of Object.entries(d.legend)) {
        const ok = v === 'transparent' || v in PAL || v.startsWith('#') || v.startsWith('rgb')
        expect(ok, `${d.name} legend "${ch}" → "${v}" is not a palette key`).toBe(true)
      }
  })

  it('rows are rectangular (every row is the full sprite width)', () => {
    for (const d of defs) {
      if (!d.rows) continue
      const { w } = sizeOf(d)
      d.rows.forEach((row, y) => expect(row.length, `${d.name} row ${y}`).toBe(w))
    }
  })

  it('procedural defs declare w and h', () => {
    for (const d of defs)
      if (d.paint) {
        expect(d.w, `${d.name} w`).toBeGreaterThan(0)
        expect(d.h, `${d.name} h`).toBeGreaterThan(0)
      }
  })

  it('strips split into whole frames', () => {
    for (const d of defs) {
      const { w } = sizeOf(d)
      const frames = d.frames ?? 1
      expect(frames, `${d.name} frame count`).toBeGreaterThan(0)
      expect(w % frames, `${d.name} width ${w} must divide into ${frames} frames`).toBe(0)
    }
  })

  it('every def rasterizes (no unknown legend characters)', () => {
    for (const d of defs) expect(() => rasterize(d), d.name).not.toThrow()
  })

  it('no frame rasterizes fully transparent', () => {
    for (const d of defs) {
      const frames = d.frames ?? 1
      for (let f = 0; f < frames; f++) expect(opaqueIn(d, f), `${d.name} frame ${f}`).toBeGreaterThan(0)
    }
  })

  it('anchors sit inside the frame', () => {
    for (const d of defs) {
      if (!d.anchor) continue
      const { w, h } = frameOf(d)
      const [ax, ay] = d.anchor
      expect(ax >= 0 && ax <= w, `${d.name} anchor x ${ax} outside 0..${w}`).toBe(true)
      expect(ay >= 0 && ay <= h, `${d.name} anchor y ${ay} outside 0..${h}`).toBe(true)
    }
  })
}
