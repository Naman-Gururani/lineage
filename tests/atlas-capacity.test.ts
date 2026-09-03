// Atlas capacity guard.
//
// `buildAtlas` shelf-packs every sprite def into one 4096px-wide canvas
// (src/art/atlas.ts: `buildSheet(allDefs(), 4096)`). Six packs were redrawn at
// 2x for the HD pass, so this suite is the early-warning that the budget still
// holds — it fails in CI long before a browser would fail to allocate the
// texture.
//
// Deliberately canvas-free: it imports the DEF arrays directly rather than
// atlas.ts, which pulls in Phaser. `sizeOf`/`rasterize` from src/art/pixel.ts
// are the pure half of the painter and need no DOM, so this runs in the default
// Node environment.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rasterize, sizeOf, type SpriteDef } from '../src/art/pixel'
import { BUILDING_DEFS } from '../src/art/sprites/buildings'
import { ENV_DEFS } from '../src/art/sprites/env'
import { HERO_DEFS } from '../src/art/sprites/hero'
import { NPC_DEFS } from '../src/art/sprites/npcs'
import { PROP_DEFS } from '../src/art/sprites/props'
import { FAIR_DEFS } from '../src/art/sprites/fair'
import { RIDE_DEFS } from '../src/art/sprites/rides'

/** The budget passed to `buildSheet` in src/art/atlas.ts. */
const MAX = 4096
/**
 * Packing-feasibility bound. A shelf packer wastes the gap between the tallest
 * item on a shelf and the shorter ones beside it, so padded area well under
 * half the square is the conservative signal that a 4096 sheet is still
 * comfortable. Raising this is not the fix for a failure here — resizing art or
 * splitting the atlas is.
 */
const BUDGET = 0.55
const BUDGET_PCT = (BUDGET * 100).toFixed(0)

/**
 * The same composition `allDefs()` performs, in the same order. `extraPacks`
 * (registerPack) is empty — nothing in src/ calls it today — so these seven packs
 * are the whole atlas. The source guard below fails if that stops being true.
 */
const ALL_DEFS: SpriteDef[] = [
  ...HERO_DEFS,
  ...ENV_DEFS,
  ...NPC_DEFS,
  ...PROP_DEFS,
  ...BUILDING_DEFS,
  ...FAIR_DEFS,
  ...RIDE_DEFS,
]

/** Padding-inclusive footprint of one def's placed rectangle (packSheet leaves a 1px gutter). */
const paddedArea = (w: number, h: number) => (w + 2) * (h + 2)

const totalArea = ALL_DEFS.reduce((sum, d) => {
  const { w, h } = sizeOf(d)
  return sum + paddedArea(w, h)
}, 0)
const utilization = totalArea / (MAX * MAX)
const pct = (utilization * 100).toFixed(2)

describe('atlas source guard', () => {
  const src = readFileSync(new URL('../src/art/atlas.ts', import.meta.url), 'utf8')

  it('still builds the sheet at the budget this suite checks', () => {
    expect(src, `atlas.ts no longer calls buildSheet(allDefs(), ${MAX})`).toContain(`buildSheet(allDefs(), ${MAX})`)
  })

  it('still composes exactly the seven packs this suite sums', () => {
    const packs = ['HERO_DEFS', 'ENV_DEFS', 'NPC_DEFS', 'PROP_DEFS', 'BUILDING_DEFS', 'FAIR_DEFS', 'RIDE_DEFS']
    const line = src.split('\n').find((l) => l.includes('...HERO_DEFS')) ?? ''
    for (const p of packs) expect(line, `allDefs() no longer spreads ${p}`).toContain(`...${p}`)
    // An eighth static pack would make this suite under-count the atlas.
    const spreads = line.match(/\.\.\.[A-Z_]+/g) ?? []
    expect(spreads.sort(), 'allDefs() gained or lost a static pack').toEqual(packs.map((p) => `...${p}`).sort())
  })
})

describe('atlas capacity', () => {
  it('has defs to measure', () => {
    expect(ALL_DEFS.length).toBeGreaterThan(0)
  })

  /**
   * The packer places the WHOLE strip, then slices it into frames, and it grows
   * the sheet past `maxW` for any item wider than the budget — so the strip, not
   * the frame, is the dimension that has to fit. Checking it covers (a) for
   * single frames too, since a frame is never wider than its strip.
   */
  it('keeps every placed rectangle inside the 4096 budget in both dimensions', () => {
    for (const d of ALL_DEFS) {
      const { w, h } = sizeOf(d)
      expect(w, `${d.name} strip width`).toBeLessThanOrEqual(MAX)
      expect(h, `${d.name} height`).toBeLessThanOrEqual(MAX)
      expect(w, `${d.name} strip width`).toBeGreaterThan(0)
      expect(h, `${d.name} height`).toBeGreaterThan(0)
    }
  })

  it('keeps every individual frame inside the budget', () => {
    for (const d of ALL_DEFS) {
      const { w, h } = sizeOf(d)
      const frames = d.frames ?? 1
      expect(w / frames, `${d.name} frame width`).toBeLessThanOrEqual(MAX)
      expect(h, `${d.name} frame height`).toBeLessThanOrEqual(MAX)
    }
  })

  it('rasterizes every def to the size the packer reserved for it', () => {
    // The auto-outline runs inside rasterize; it must not grow the frame past
    // the rectangle packSheet reserved from sizeOf, or frames would overlap.
    for (const d of ALL_DEFS) {
      const { w, h } = sizeOf(d)
      const r = rasterize(d)
      expect([r.w, r.h], `${d.name} rasterized size`).toEqual([w, h])
    }
  })

  it(`fits the packed area inside ${BUDGET_PCT}% of the 4096 sheet (currently ${pct}%)`, () => {
    expect(
      utilization,
      `padded sprite area is ${totalArea}px² = ${pct}% of ${MAX}² — over the ${BUDGET_PCT}% ` +
        `packing-feasibility bound. Do NOT raise the atlas budget to fix this; shrink art or split the atlas.`,
    ).toBeLessThanOrEqual(BUDGET)
  })

  it('reports the atlas utilization', () => {
    // Printed so a run can be quoted directly in the task report.
    console.log(`atlas capacity: ${ALL_DEFS.length} defs, ${totalArea}px² padded = ${pct}% of ${MAX}x${MAX}`)
    expect(Number(pct)).toBeGreaterThan(0)
  })
})
