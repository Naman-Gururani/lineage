// Environment sprites at HD scale (32px tile).
//
// Organic mass (canopies, bushes, boulders, grass tufts) is procedural: a lobe
// field shaded from one light direction beats typing thousands of leaf pixels,
// and the same painters give every species its own silhouette from a few
// numbers. Props (fences, signs, benches, chests) stay ASCII + legend.
//
// House rules, from art-direction.md:
//  · light from the TOP-LEFT — every mass carries a 1px rim of its ramp's top
//    step on the up/left silhouette and its darkest step on the down/right one;
//  · massed foliage takes NO black outline — the dark ramp step IS the edge;
//    hand-scale props keep the 1px `outline`;
//  · value clusters, not pillow shading: brightness comes from the surface
//    normal plus a canopy-height term, never from distance to a centre;
//  · sparse 2×1 dither only in the transition band between two ramp steps;
//  · nothing bakes a drop shadow — sprites end at their base, the scene draws
//    the ellipse;
//  · anchors are bottom-centre: the wind sways trees by scaling about the
//    anchor, so trunks stand straight and no lean is baked in.
import { paintFoamFrame, paintWaterFrame } from '../tiles'
import type { PalKey } from '../palette'
import type { Legend, SpriteDef } from '../pixel'
import { K, paintBeam, paintCloudShadow, paintDot, paintGlow, paintRipple, paintStrip } from '../procedural'
import { blit, makeRaster, setPx, type RGBA, type Raster } from '../raster'
import { makeRng } from '../../core/rng'

/* ------------------------------------------------------------------ *
 * shading kit
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2
/** Light direction: top-left. */
const LX = -0.55
const LY = -0.83

/** A value ramp, darkest first. Six steps: 0 = form shadow, 5 = rim light. */
type Ramp = readonly RGBA[]
const ramp = (...keys: PalKey[]): Ramp => keys.map((k) => K(k))

const LEAF_COOL = ramp('leaf1', 'leaf2', 'leaf3', 'leaf4', 'leaf5', 'leaf6')
const LEAF_WARM = ramp('grass1', 'grass2', 'grass3', 'grass4', 'grass5', 'grass6')
const NEEDLE = ramp('pine1', 'pine2', 'pine3', 'pine4', 'pine5', 'pine6')
const BARK = ramp('wood1', 'wood2', 'wood3', 'wood4', 'wood5', 'wood7')
const PALM_BARK = ramp('wood1', 'wood2', 'dirt3', 'dirt4', 'dirt5', 'sand6')
const ROCK = ramp('stone1', 'stone2', 'stone3', 'stone4', 'stone6', 'stone7')
const BLADE = ramp('grass1', 'grass2', 'grass3', 'grass4', 'grass5', 'grass6')
const CRYSTAL = ramp('teal1', 'teal2', 'teal3', 'teal4', 'teal6', 'teal7')

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Deterministic 0..1 hash — flat facets on boulders without threading an rng. */
function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35)
  h ^= h >>> 15
  return ((h >>> 0) % 2048) / 2048
}

/**
 * Ramp step for a continuous value. The fractional part is dithered on a 2×1
 * checker, so a mass breaks up only where two steps meet — never a flat screen
 * of dots, never a hard band.
 */
function step(pal: Ramp, f: number, x: number, y: number): RGBA {
  const c = clamp(f, 0, pal.length - 1)
  const lo = Math.floor(c)
  if (lo >= pal.length - 1) return pal[pal.length - 1]
  const frac = c - lo
  const up = frac > 0.7 || (frac > 0.44 && (x + y) % 2 === 0)
  return pal[up ? lo + 1 : lo]
}

/**
 * Close 1px gaps left where thin strokes cross (palm fronds, blades). Without
 * this the silhouette pass reads a pinhole as an edge and freckles the mass
 * with stray rim and shadow pixels. Holes take their darkest neighbour, so a
 * filled gap stays in shadow instead of inventing a colour.
 */
function fillHoles(r: Raster): void {
  const snap = new Uint8ClampedArray(r.data)
  const a = (x: number, y: number) => alphaOf(snap, r.w, r.h, x, y)
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      if (a(x, y)) continue
      let n = 0
      let best: RGBA | null = null
      let dark = Infinity
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (!a(x + dx, y + dy)) continue
        n++
        const i = ((y + dy) * r.w + (x + dx)) * 4
        const lum = snap[i] + snap[i + 1] * 2 + snap[i + 2]
        if (lum < dark) {
          dark = lum
          best = [snap[i], snap[i + 1], snap[i + 2], 255]
        }
      }
      if (n >= 3 && best) setPx(r, x, y, best)
    }
}

const alphaOf = (d: Uint8ClampedArray, w: number, h: number, x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3])

/**
 * Silhouette pass: 1px of the ramp's top step along the up/left edge (rim
 * light), the darkest step along the down/right edge (form shadow, and the
 * dark boundary that lets massed foliage skip a black outline). `rimBelow`
 * stops the rim where the mass turns under and a bright edge would read as fog.
 */
function rim(r: Raster, pal: Ramp, rimBelow: number): void {
  const snap = new Uint8ClampedArray(r.data)
  const a = (x: number, y: number) => alphaOf(snap, r.w, r.h, x, y)
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      if (!a(x, y)) continue
      const up = !a(x, y - 1)
      const left = !a(x - 1, y)
      const down = !a(x, y + 1)
      const right = !a(x + 1, y)
      if ((up || left) && y <= rimBelow) setPx(r, x, y, pal[pal.length - 1])
      else if (down || right) setPx(r, x, y, pal[0])
    }
}

/* ------------------------------------------------------------------ *
 * foliage mass
 * ------------------------------------------------------------------ */

type Lobe = { x: number; y: number; r: number }

/**
 * A canopy as overlapping lobes. Each pixel belongs to the lobe it sits
 * deepest inside; its value comes from that lobe's surface normal (top-left
 * light) plus a global height term, so the mass reads as a lit crown over a
 * shaded belly — three value clusters — instead of a ring-shaded ball. The
 * lobe radius wobbles with angle (coherent, not per-pixel noise) so the
 * silhouette is leafy rather than fuzzy.
 */
function canopy(r: Raster, lobes: Lobe[], pal: Ramp, seed: number, floor = Infinity): void {
  const rng = makeRng(seed)
  const ph = lobes.map(() => [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)])
  let top = Infinity
  let bottom = -Infinity
  for (const l of lobes) {
    top = Math.min(top, l.y - l.r)
    bottom = Math.max(bottom, l.y + l.r)
  }
  const span = Math.max(1, bottom - top)
  const y0 = Math.max(0, Math.floor(top - 2))
  const y1 = Math.min(r.h - 1, Math.min(floor, Math.ceil(bottom + 2)))
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < r.w; x++) {
      let owner = -1
      let best = 0
      for (let i = 0; i < lobes.length; i++) {
        const l = lobes[i]
        const dx = x - l.x
        const dy = y - l.y
        const d = Math.hypot(dx, dy)
        if (d > l.r * 1.3) continue
        const th = Math.atan2(dy, dx)
        const edge = l.r * (1 + 0.11 * Math.sin(3 * th + ph[i][0]) + 0.07 * Math.sin(5 * th + ph[i][1]) + 0.045 * Math.sin(11 * th + ph[i][2]))
        if (d > edge) continue
        const t = 1 - d / edge
        if (t > best) {
          best = t
          owner = i
        }
      }
      if (owner < 0) continue
      const l = lobes[owner]
      const n = ((x - l.x) * LX + (y - l.y) * LY) / l.r
      const gy = (y - top) / span
      const f = 2.35 + n * 2.15 + (gy < 0.3 ? 0.6 : gy > 0.66 ? -1 : 0)
      setPx(r, x, y, step(pal, f, x, y))
    }
}

/** Leaf texture: a few 2px highlight clusters up-left, shade clusters down-right. */
function speckle(r: Raster, pal: Ramp, seed: number, n = 9): void {
  const rng = makeRng(seed)
  const a = (x: number, y: number) => alphaOf(r.data, r.w, r.h, x, y)
  for (let i = 0; i < n; i++) {
    const x = rng.int(1, r.w - 2)
    const y = rng.int(1, r.h - 2)
    if (!a(x, y) || !a(x + 1, y) || !a(x, y + 1)) continue
    const light = rng.chance(0.55)
    const c = light ? pal[4] : pal[1]
    setPx(r, x, y, c)
    setPx(r, x + 1, y + (light ? -1 : 1), c)
  }
}

type TrunkSpec = { cx: number; top: number; bottom: number; wTop: number; wBot: number; ao?: [number, number]; pal?: Ramp }

/** Trunk: left rim, two vertical bark streaks, root flare, dark contact row. */
function trunk(r: Raster, o: TrunkSpec): void {
  const pal = o.pal ?? BARK
  const span = Math.max(1, o.bottom - o.top)
  for (let y = o.top; y <= o.bottom; y++) {
    const t = (y - o.top) / span
    const flare = t > 0.88 ? ((t - 0.88) / 0.12) ** 1.7 : 0
    const w = Math.max(3, Math.round(o.wTop + (o.wBot - o.wTop) * t + flare * 5))
    const x0 = Math.round(o.cx - w / 2)
    const ao = o.ao && y >= o.ao[0] && y <= o.ao[1] ? 1.6 * (1 - (y - o.ao[0]) / Math.max(1, o.ao[1] - o.ao[0])) : 0
    for (let i = 0; i < w; i++) {
      if (y >= o.bottom - 1) {
        setPx(r, x0 + i, y, pal[y >= o.bottom ? 0 : 1]) // solid contact, never dithered
        continue
      }
      const u = i / (w - 1)
      let f = u < 0.12 ? 5 : u < 0.3 ? 4 : u < 0.62 ? 3 : u < 0.82 ? 2 : 1
      if (((u > 0.33 && u < 0.43) || (u > 0.56 && u < 0.66)) && (y * 7 + i * 3) % 5 < 3) f -= 1
      f -= ao
      setPx(r, x0 + i, y, step(pal, f, x0 + i, y))
    }
  }
}

type TreeSpec = { pal: Ramp; trunk: TrunkSpec; lobes: Lobe[]; rimBelow: number }

/** Round-crowned broadleaf. */
const OAK: TreeSpec = {
  pal: LEAF_COOL,
  trunk: { cx: 32, top: 24, bottom: 70, wTop: 9, wBot: 12, ao: [42, 54] },
  lobes: [
    { x: 32, y: 24, r: 19 },
    { x: 13, y: 30, r: 10.5 },
    { x: 50, y: 28, r: 11 },
    { x: 31, y: 16, r: 12.5 },
    { x: 18, y: 18, r: 9.5 },
    { x: 45, y: 17, r: 9.5 },
    { x: 32, y: 36, r: 10 },
  ],
  rimBelow: 30,
}

/** Looser, warmer, top-heavy sibling — the second species in the woods. */
const WILLOW: TreeSpec = {
  pal: LEAF_WARM,
  trunk: { cx: 32, top: 28, bottom: 70, wTop: 8, wBot: 11, ao: [44, 56] },
  lobes: [
    { x: 32, y: 22, r: 17 },
    { x: 15, y: 26, r: 11.5 },
    { x: 49, y: 27, r: 11 },
    { x: 30, y: 12, r: 11 },
    { x: 20, y: 15, r: 10 },
    { x: 43, y: 15, r: 10 },
    { x: 33, y: 36, r: 10.5 },
    { x: 46, y: 34, r: 7.5 },
  ],
  rimBelow: 28,
}

/** Broadleaf, 64×72, base at y=70. */
function broadleaf(r: Raster, v: number): void {
  const spec = v % 2 ? WILLOW : OAK
  trunk(r, spec.trunk)
  const c = makeRaster(r.w, r.h)
  canopy(c, spec.lobes, spec.pal, 1200 + v * 37)
  speckle(c, spec.pal, 1700 + v * 37, 11)
  rim(c, spec.pal, spec.rimBelow)
  blit(r, c, 0, 0)
}

/** Conifer tier: [apex y, base y, half width]. */
type Tier = [number, number, number]

/**
 * Conifer tiers, walked column by column: each column knows where the cone
 * face starts and how far its branch hangs, so the skirt of every tier is
 * ragged with needle tips instead of ruled off flat.
 */
function conifer(r: Raster, cx: number, tiers: Tier[], pal: Ramp, seed: number): void {
  const rng = makeRng(seed)
  tiers.forEach(([apex, base, hw], ti) => {
    const p = rng.range(0, TAU)
    const span = Math.max(1, base - apex)
    const half = Math.ceil(hw)
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / hw
      if (Math.abs(u) > 1) continue
      const yTop = apex + Math.pow(Math.abs(u), 1 / 0.72) * span
      const hang = Math.round(1.4 * Math.sin(x * 0.8 + p) + 1.1 * Math.sin(x * 2.3 + p * 2))
      const yBot = base + clamp(hang, -2, 2)
      for (let y = Math.ceil(yTop); y <= yBot; y++) {
        const t = (y - apex) / span
        let f = 3.05 - u * 1.8 - t * 0.55
        if (y - yTop < 2.5) f -= 1.5 // the tier above casts onto this one
        if (yBot - y < 2) f -= 1.6 // the branch's own shaded underside: what layers the tiers
        setPx(r, x, y, step(pal, f, x, y))
      }
    }
  })
}

const PINE_A: Tier[] = [
  [3, 20, 8],
  [13, 32, 12],
  [25, 45, 15],
  [37, 58, 18],
]
const PINE_B: Tier[] = [
  [2, 16, 6.5],
  [10, 26, 10],
  [20, 36, 12.5],
  [30, 47, 15],
  [40, 60, 17.5],
]

/** Conifer, 40×72, base at y=70 — tall and narrow, the island's vertical accent. */
function pineTree(r: Raster, v: number): void {
  trunk(r, { cx: 20, top: 50, bottom: 70, wTop: 7, wBot: 9 })
  const c = makeRaster(r.w, r.h)
  conifer(c, 20, v % 2 ? PINE_B : PINE_A, NEEDLE, 2200 + v * 41)
  speckle(c, NEEDLE, 2600 + v * 41, 7)
  rim(c, NEEDLE, 62)
  blit(r, c, 0, 0)
}

/**
 * One palm frond: an arc of spine with leaflets combing down from it. `lit` is
 * the frond's base ramp value — fronds thrown up and left catch the light,
 * fronds falling right and away sit in the crown's shadow.
 */
function frond(r: Raster, cx: number, cy: number, deg: number, len: number, droop: number, pal: Ramp, lit: number): void {
  const a = (deg * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a) * 0.8
  const side = dx < 0 ? -1 : 1
  for (let k = 1; k <= len; k++) {
    const t = k / len
    const x = Math.round(cx + dx * k)
    const y = Math.round(cy + dy * k + droop * t * t)
    setPx(r, x, y, step(pal, lit + 0.7 + t * 0.5, x, y))
    if (k > 1 && k < len - 2) setPx(r, x, y - 1, step(pal, lit + 1.2 + t * 0.4, x, y - 1))
    // leaflets comb off the rib in serrated teeth — gaps are what keep two
    // neighbouring fronds from fusing into one mushroom cap
    if (k % 2) continue
    const teeth = Math.round(1 + 4.2 * Math.sin(Math.PI * Math.min(1, t * 1.02)))
    for (let j = 1; j <= teeth; j++) {
      const lx = x + Math.round(j * 0.42 * side)
      const ly = y + j
      setPx(r, lx, ly, step(pal, lit + 0.45 - j * 0.36 + t * 0.3, lx, ly))
    }
  }
}

const FRONDS: [number, number, number, number][] = [
  [-179, 22, 13, 3.0],
  [-150, 24, 11, 3.4],
  [-121, 21, 7, 3.6],
  [-92, 17, 4, 3.3],
  [-63, 21, 8, 2.6],
  [-34, 24, 12, 2.1],
  [-5, 22, 13, 1.7],
]

/** Palm, 56×72, base at y=70. The trunk bows but starts and ends on the anchor. */
function palmTree(r: Raster, v: number): void {
  const bow = v % 2 ? -1 : 1
  const baseY = 70
  const topY = 21
  const span = baseY - topY
  for (let y = baseY; y >= topY; y--) {
    const t = (baseY - y) / span
    const cx = 28 + bow * Math.sin(t * Math.PI) * 3.4
    const w = Math.max(4, Math.round(7 - t * 2))
    const x0 = Math.round(cx - w / 2)
    for (let i = 0; i < w; i++) {
      const u = i / (w - 1)
      let f = u < 0.16 ? 5 : u < 0.36 ? 4 : u < 0.68 ? 3 : u < 0.86 ? 2 : 1
      if ((baseY - y) % 5 === 0 && u > 0.25) f -= 0.9 // stacked frond scars
      if (y >= baseY - 1) f = 0.5
      setPx(r, x0 + i, y, step(PALM_BARK, f, x0 + i, y))
    }
  }
  const c = makeRaster(r.w, r.h)
  // crown heart first, so the fronds spring out of a dark centre
  canopy(c, [{ x: 28, y: topY + 2, r: 4.5 }], LEAF_COOL, 3300 + v)
  for (const [deg, len, droop, lit] of FRONDS) frond(c, 28, topY, deg, len, droop, LEAF_COOL, lit)
  fillHoles(c)
  rim(c, LEAF_COOL, 20)
  blit(r, c, 0, 0)
  // coconuts last, so the rim pass leaves their values alone
  for (const [nx, ny] of [
    [22, 26],
    [31, 27],
    [26, 30],
  ]) {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        if ((x + y === 0) || (x === 3 && y === 0) || (x === 3 && y === 3) || (x === 0 && y === 3)) continue
        setPx(r, nx + x, ny + y, PALM_BARK[x + y === 1 ? 5 : x + y > 4 ? 0 : 2])
      }
  }
}

/** Bush, 40×32 — a mound flattened at the ground line. */
function bushMass(r: Raster, v: number): void {
  const lobes: Lobe[] = v
    ? [
        { x: 13, y: 19, r: 10 },
        { x: 27, y: 18, r: 10.5 },
        { x: 20, y: 12, r: 9 },
        { x: 34, y: 23, r: 6.5 },
        { x: 6, y: 24, r: 6 },
      ]
    : [
        { x: 12, y: 20, r: 9.5 },
        { x: 26, y: 19, r: 10 },
        { x: 19, y: 13, r: 8.5 },
        { x: 33, y: 24, r: 6 },
      ]
  const c = makeRaster(r.w, r.h)
  canopy(c, lobes, LEAF_COOL, 4400 + v * 29, 30)
  speckle(c, LEAF_COOL, 4800 + v * 29, 8)
  rim(c, LEAF_COOL, 18)
  blit(r, c, 0, 0)
  if (v !== 1) return
  const rng = makeRng(4900)
  for (let i = 0; i < 8; i++) {
    const x = rng.int(5, 33)
    const y = rng.int(8, 25)
    if (!alphaOf(r.data, r.w, r.h, x + 1, y + 1)) continue
    setPx(r, x, y, K('red5'))
    setPx(r, x + 1, y, K('red4'))
    setPx(r, x, y + 1, K('red4'))
    setPx(r, x + 1, y + 1, K('red3'))
  }
}

/** Boulder, 40×32. Faceted rather than round: flat plates read as stone. */
function boulder(r: Raster, v: number): void {
  const rng = makeRng(5500 + v * 17)
  const p0 = rng.range(0, TAU)
  const p1 = rng.range(0, TAU)
  const cx = v ? 19 : 20
  const baseY = 30
  const rx = v ? 17 : 13
  const ry = v ? 13.5 : 10
  const cy = baseY - ry * 0.76
  const c = makeRaster(r.w, r.h)
  for (let y = 0; y <= baseY; y++)
    for (let x = 0; x < r.w; x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const d = Math.hypot(nx, ny)
      const th = Math.atan2(ny, nx)
      const edge = 1 + 0.09 * Math.sin(3 * th + p0) + 0.055 * Math.sin(7 * th + p1)
      if (d > edge) continue
      const facet = (hash2(Math.floor((x + y * 0.6) / 6), Math.floor((y - x * 0.3) / 5)) - 0.5) * 0.95
      const n = -nx * 0.55 - ny * 0.83
      let f = 2.9 + n * 1.9 + facet
      if (y > baseY - 3) f -= 1.5
      setPx(c, x, y, step(ROCK, f, x, y))
    }
  // a chipped crack: dark line with a lit lip beside it
  const kx = Math.round(cx - rx * 0.25)
  const ky = Math.round(cy - ry * 0.3)
  for (let i = 0; i < Math.round(ry * 0.9); i++) {
    const x = kx + Math.round(i * 0.55)
    const y = ky + i
    if (!alphaOf(c.data, c.w, c.h, x, y)) continue
    setPx(c, x, y, ROCK[1])
    if (alphaOf(c.data, c.w, c.h, x - 1, y)) setPx(c, x - 1, y, ROCK[4])
  }
  rim(c, ROCK, Math.round(cy))
  blit(r, c, 0, 0)
  if (v !== 1) return
  // moss caps the weather side: a run down from the top silhouette, not specks
  const moss = makeRng(5700)
  for (let x = 3; x < 26; x++) {
    let y = 0
    while (y < baseY && !alphaOf(r.data, r.w, r.h, x, y)) y++
    if (y >= baseY) continue
    const depth = Math.round(1 + 3 * Math.sin((Math.PI * (x - 3)) / 23) * (0.6 + moss.next() * 0.6))
    for (let j = 0; j < depth; j++) setPx(r, x, y + j, K(j === 0 ? 'grass4' : j < 2 ? 'grass3' : 'grass2'))
  }
}

/** One tuft of tall grass. `bend` leans every blade for the wind frame. */
function tuft(r: Raster, ox: number, bend: number, seed: number): void {
  const rng = makeRng(seed)
  const baseY = 19
  for (let i = 0; i < 24; i++) {
    const x0 = 16 + rng.int(-10, 10)
    const h = rng.int(7, 18)
    const dir = rng.chance(0.5) ? 1 : -1
    const curve = rng.range(2.4, 5.6) * dir + bend * rng.range(0.7, 1.4)
    const fat = h > 10
    for (let k = 0; k <= h; k++) {
      const t = k / h
      const x = Math.round(ox + x0 + curve * t * t)
      const y = baseY - k
      setPx(r, x, y, step(BLADE, 1.5 + t * 3.2, x, y))
      if (fat && t < 0.72) setPx(r, x - dir, y, step(BLADE, 1.1 + t * 2.4, x - dir, y))
    }
  }
  // the clump the blades grow out of, so the tuft has weight at the ground
  for (let y = baseY - 2; y <= baseY; y++)
    for (let x = ox + 6; x <= ox + 25; x++) {
      const t = Math.abs(x - (ox + 15.5)) / 10
      if (t > 1 - (y - baseY + 2) * 0.14) continue
      setPx(r, x, y, step(BLADE, 1.6 - t, x, y))
    }
}

function grassTuft(r: Raster): void {
  tuft(r, 0, 0, 6100)
  tuft(r, 32, 3.4, 6100)
}

/** Reeds, 16×32: sword leaves plus a cattail or two. Base at y=26. */
function reeds(r: Raster, v: number): void {
  const rng = makeRng(6500 + v * 13)
  const baseY = 26
  const heads: [number, number][] = v ? [[10, 3], [4, 9]] : [[4, 2], [11, 7]]
  for (let i = 0; i < 9; i++) {
    const x0 = 8 + rng.int(-5, 5)
    const h = rng.int(12, 24)
    const dir = rng.chance(0.5) ? 1 : -1
    const curve = rng.range(1.6, 4.2) * dir
    for (let k = 0; k <= h; k++) {
      const t = k / h
      const x = Math.round(x0 + curve * t * t)
      const y = baseY - k
      setPx(r, x, y, step(BLADE, 1.6 + t * 2.8, x, y))
      if (t < 0.66) setPx(r, x - dir, y, step(BLADE, 1.2 + t * 2.2, x - dir, y))
    }
  }
  // cattails: a stalk up to a felted brown head
  for (const [hx, hy] of heads) {
    for (let y = hy + 7; y <= baseY; y++) setPx(r, hx + 1, y, step(BLADE, 2.4, hx + 1, y))
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 3; x++) {
        if ((y === 0 || y === 6) && x !== 1) continue
        setPx(r, hx + x, hy + y, BARK[x === 0 ? 4 : x === 1 ? 2 : 1])
      }
  }
}

/** Lost packet: a teal data crystal, 24×24 × 4 pulse frames. */
function packetCrystal(r: Raster, frames = 4): void {
  const fw = r.w / frames
  for (let f = 0; f < frames; f++) {
    const pulse = [0.5, 0.78, 1, 0.78][f % 4]
    const ox = f * fw
    const cx = fw / 2 - 0.5
    const cy = r.h / 2 - 0.5
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < fw; x++) {
        const dx = x - cx
        const dy = y - cy
        const d = Math.abs(dx) + Math.abs(dy)
        if (d <= 8.5) {
          const n = (-dx * 0.5 - dy * 0.85) / 8
          setPx(r, ox + x, y, step(CRYSTAL, 2.6 + n * 2.4 + (d < 3 ? 1.4 : 0), x, y))
        } else if (d <= 11 + pulse * 2) {
          const a = Math.round(70 * pulse * (1 - (d - 8.5) / (4 + pulse * 2)))
          if (a > 0) setPx(r, ox + x, y, [143, 240, 224, a])
        }
      }
    const hx = ox + Math.round(cx) - 2
    const hy = Math.round(cy) - 3
    setPx(r, hx, hy, K('white'))
    setPx(r, hx + 1, hy, K('white'))
    setPx(r, hx, hy + 1, K('white'))
  }
}

/* ------------------------------------------------------------------ *
 * def helpers
 * ------------------------------------------------------------------ */

const proc = (name: string, w: number, h: number, paint: SpriteDef['paint'], anchor?: [number, number]): SpriteDef => ({
  name,
  w,
  h,
  legend: {},
  paint,
  anchor,
})

const strip = (name: string, w: number, h: number, frames: number, paint: SpriteDef['paint'], anchor: [number, number]): SpriteDef => ({
  name,
  w,
  h,
  frames,
  legend: {},
  paint,
  anchor,
})

/**
 * Pad authored rows out to an exact w×h box, so a def's declared size comes
 * from its frame — not from however far the last row happened to be typed.
 */
function box(w: number, h: number, rows: string[]): string[] {
  if (rows.length > h) throw new Error(`${rows.length} rows authored, frame is ${h} tall`)
  const out = rows.map((row, y) => {
    if (row.length > w) throw new Error(`row ${y} is ${row.length} wide, frame is ${w}`)
    return row.padEnd(w, '.')
  })
  while (out.length < h) out.push('.'.repeat(w))
  return out
}

const ascii = (name: string, w: number, h: number, rows: string[], legend: Legend, opts: Partial<SpriteDef> = {}): SpriteDef => ({
  name,
  rows: box(w, h, rows),
  legend,
  outline: 'outline',
  ...opts,
})

/* ------------------------------------------------------------------ *
 * legends
 * ------------------------------------------------------------------ */

/** Timber props: a → k runs light → dark down the wood ramp. */
const WOOD: Legend = {
  a: 'wood7',
  W: 'wood6',
  w: 'wood5',
  n: 'wood4',
  d: 'wood3',
  D: 'wood2',
  k: 'wood1',
  L: 'metal5',
  M: 'metal4',
  m: 'metal2',
  i: 'ink3',
  y: 'yellow5',
}

const LAMP: Legend = {
  H: 'metal6',
  L: 'metal5',
  M: 'metal4',
  m: 'metal2',
  k: 'metal1',
  g: 'glass6',
  G: 'glass5',
  b: 'glass4',
}

/* ------------------------------------------------------------------ *
 * ASCII art — every block is authored against its frame's column grid
 * ------------------------------------------------------------------ */

// 32×32. Post at x4..9 so a run of tiles posts every tile; rails bleed to both
// frame edges and meet seamlessly (the outline pass can't paint off-frame).
const FENCE_H = [
  '',
  '',
  '....aaaaaa',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  'aaaaaWnndDaaaaaaaaaaaaaaaaaaaaaa',
  'WWWWaWnndDWWWWWdWWWWWWWdWWWWWWWd',
  'wwwwaWnndDwwwwwdwwwwwwwdwwwwwwwd',
  'DDDDaWnndDkDDDDDDDDDDDDDDDDDDDDD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  'aaaaaWnndDaaaaaaaaaaaaaaaaaaaaaa',
  'WWWWaWnndDWWWWWdWWWWWWWdWWWWWWWd',
  'wwwwaWnndDwwwwwdwwwwwwwdwwwwwwwd',
  'DDDDaWnndDkDDDDDDDDDDDDDDDDDDDDD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  '....aWnndD',
  '....kkkkkk',
]

// 32×32. The same fence running away from camera: post centred, rails foreshortened.
const FENCE_V = [
  '',
  '.............aaaaaa',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '........aaaaaaWnndDaaaaa',
  '........WWWWWaWnndDWWWWW',
  '........wwwwwaWnndDwwwww',
  '........DDDDDaWnndDkDDDD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '........aaaaaaWnndDaaaaa',
  '........WWWWWaWnndDWWWWW',
  '........wwwwwaWnndDwwwww',
  '........DDDDDaWnndDkDDDD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............kkkkkk',
]

// 32×32.
const FENCE_POST = [
  '',
  '',
  '............aaaaaaaa',
  '............aWWnnddD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnnkD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '............kkkkkkkk',
]

// 32×80. Lantern x9..22, pole x14..17, footing x8..23, base row 73.
const LAMP_ROWS = [
  '...............mm',
  '..............mLLm',
  '..............mLLm',
  '............mmLLLLmm',
  '..........mLLLLLLLLLLm',
  '.........mLLHHHHHHHHLLm',
  '.........Lmmmmmmmmmmmmk',
  '.........LMggggMmGGGGmk',
  '.........LMggggMmGGGGmk',
  '.........LMggggMmGGGGmk',
  '.........LMgggGMmGGGbmk',
  '.........LMggGGMmGGbbmk',
  '.........LMgGGGMmGbbbmk',
  '.........LMGGGGMmbbbbmk',
  '.........LMGGGbMmbbbbmk',
  '.........LMGGbbMmbbbbmk',
  '.........LMGbbbMmbbbbmk',
  '.........LMbbbbMmbbbbmk',
  '.........Lmmmmmmmmmmmmk',
  '..........mLLLLLLLLLLm',
  '...........mMMMMMMMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '...........LLMMMMmm',
  '...........LLMMMMmm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '.............LMMm',
  '...........LLMMMMmm',
  '..........LLMMMMMMmm',
  '.........LLMMMMMMMMmm',
  '........LLMMMMMMMMMMmm',
  '.......LLMMMMMMMMMMMMmm',
  '.......kkkkkkkkkkkkkkkk',
]

// 28×10 — the warm pane overlay the night cycle fades in over the lantern.
const LAMP_LIT = [
  '........yyyyyyyyyyyy',
  '.....yyYYYYYYYYYYYYYYyy',
  '...yyYYYYGGGGGGGGYYYYYYyy',
  '..yYYYYGGGGGGGGGGGGYYYYYYy',
  '..yYYYGGGGGGGGGGGGGGYYYYYy',
  '..yYYYGGGGGGGGGGGGGGYYYYYy',
  '..yYYYYGGGGGGGGGGGGYYYYYYy',
  '...yyYYYYGGGGGGGGYYYYYYyy',
  '.....yyYYYYYYYYYYYYYYyy',
  '........yyyyyyyyyyyy',
]

// 48×52. Post x21..26; upper board x20..46, lower board x2..28.
const SIGNPOST = [
  '',
  '',
  '....................aaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '....................aWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '....................aWiiiWWiiWWiiiiWWiiiWWWWWnD',
  '....................aWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '....................aWiiWWiiiWWiiWWiiiiWWWWWWnD',
  '....................aWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '....................anwwwwwwwwwwwwwwwwwwwwwwwnD',
  '....................anwwwwwwwwwwwwwwwwwwwwwwwnD',
  '....................adddddddddddddddddddddddddD',
  '....................aDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '..aaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '..aWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '..aWiiiWWiiWWiiiiWWiiiWWWWWnD',
  '..aWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '..aWiiWWiiiWWiiWWiiiWWWWWWWnD',
  '..aWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '..anwwwwwwwwwwwwwwwwwwwwwwwnD',
  '..anwwwwwwwwwwwwwwwwwwwwwwwnD',
  '..adddddddddddddddddddddddddD',
  '..aDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '.....................aWnndD',
  '....................kkkkkkkk',
]

// 32×32. Board x2..29, post x13..18.
const SIGN_SMALL = [
  '',
  '..aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '..aWWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '..aWiiiWWiiWWiiiWWiiWWiiiWWWnD',
  '..aWWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '..aWiiWWiiiWWiiWWiiiiWWWWWWWnD',
  '..aWWWWWWWWWWWWWWWWWWWWWWWWWnD',
  '..anwwwwwwwwwwwwwwwwwwwwwwwwnD',
  '..addddddddddddddddddddddddddD',
  '..aDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '.............aWnndD',
  '............kkkkkkkk',
]

// 48×24. Back rails x2..45, seat x1..46, legs x3..8 and x39..44.
const BENCH = [
  '..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '..aWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwnD',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..aDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '....aWnD..................................aWnD',
  '....aWnD..................................aWnD',
  '..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '..aWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwnD',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..aDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '.aWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwnD',
  '.aWnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '.aDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '...LMMMMm..............................LMMMMm',
  '...LMMMMm..............................LMMMMm',
  '....LMMm................................LMMm',
  '....LMMm................................LMMm',
  '....LMMm................................LMMm',
  '....LMMm................................LMMm',
  '...LMMMMm..............................LMMMMm',
  '...kkkkkk..............................kkkkkk',
]

// 32×24. Fresh cut face x2..29 rows 0..10 (light), bark wall below, roots at 19.
const STUMP = [
  '.........dddddddddddd',
  '......dddWWWWWWWWWWWWddd',
  '....ddWWaaaaaaaaaaaaaaWWDD',
  '...dWWaaaaawwwwwwaaaaaaWWDD',
  '..dWWaaaaawwwnnnnwwwaaaaaWWDD',
  '..dWaaaaawwnnddddnnwwaaaaaaWDD',
  '..dWaaaaawwnnddddnnwwaaaaaaWDD',
  '..dWWaaaaawwwnnnnwwwaaaaaWWDDD',
  '...dWWaaaaawwwwwwaaaaaaWWDDDD',
  '....ddWWaaaaaaaaaaaaaaWWDDDD',
  '....dWWWWWWWWWWWWWWWWWWDDDDD',
  '....aWnddDddDddDddDddDdDDDDD',
  '....aWnddDddDddDddDddDdDDDDD',
  '....aWnddDddDddDddDddDdDDDDD',
  '....aWnddDddDkkDddDddDdDDDDD',
  '....aWnddDddDkkDddDddDdDDDDD',
  '....aWnddDddDddDddDddDdDDDDD',
  '...aaWnddDddDddDddDddDdDDDDDD',
  '..aaWWnddDddDddDddDddDdDDDDDDD',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
]

// 40×20. Cylinder, base row 12: cut end with rings at the left, bark to the right.
const LOG = [
  '',
  '',
  '......aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '...adWaWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWa',
  '..adWaWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWa',
  '.adWaWWnnnnnnnnnnnnnnnnnnnnnnnnnnnnnna',
  '.adWaWnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnna',
  '.adWaWdddddddddddddddddddddddddddddddd',
  '.adWaWdddddddddddddddddddddddddddddddD',
  '..adWDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '..addDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
]

// 32×28. Body x2..29, lid crown rows 0..4, base row 21.
const CHEST_CLOSED = [
  '.......aaaaaaaaaaaaaaaaaa',
  '.....aaWWWWWWWWWWWWWWWWWWaa',
  '....aWWwwwwwwwwwwwwwwwwwwWWD',
  '...aWwwwwwwwwwwwwwwwwwwwwwwWD',
  '..aWwwwwwwwwwwwwwwwwwwwwwwwwWD',
  '..LMMMMMMMMMMMMMMMMMMMMMMMMMMm',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..LMMMMMMMMMMMMMMMMMMMMMMMMMMm',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..aWnnnnnnnnnnLMMMMnnnnnnnnnnD',
  '..aWnnnnnnnnnnMyyyMnnnnnnnnnnD',
  '..aWnnnnnnnnnnMyyyMnnnnnnnnnnD',
  '..aWnnnnnnnnnnLMMMMnnnnnnnnnnD',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..aWdddddddddddddddddddddddddD',
  '..aWdddddddddddddddddddddddddD',
  '..aDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '..kkDDDDDDDDDDDDDDDDDDDDDDDDkk',
  '..kk......................kk',
]

// 32×28. Lid thrown back; same base row so the swap doesn't jump.
const CHEST_OPEN = [
  '...aaaaaaaaaaaaaaaaaaaaaaaaaa',
  '..aWWWWWWWWWWWWWWWWWWWWWWWWWWD',
  '..aWwwwwwwwwwwwwwwwwwwwwwwwwwD',
  '..LMMMMMMMMMMMMMMMMMMMMMMMMMMm',
  '..akkkkkkkkkkkkkkkkkkkkkkkkkkD',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkk',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkk',
  '..LMMMMMMMMMMMMMMMMMMMMMMMMMMm',
  '..aWyyyyyyyyywwwwwwyyyyyyyyynD',
  '..aWyyyyyyyyywwwwwwyyyyyyyyynD',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..LMMMMMMMMMMMMMMMMMMMMMMMMMMm',
  '..aWnnnnnnnnnnnnnnnnnnnnnnnnnD',
  '..aWnnnnnnnnnnLMMMMnnnnnnnnnnD',
  '..aWnnnnnnnnnnMyyyMnnnnnnnnnnD',
  '..aWnnnnnnnnnnLMMMMnnnnnnnnnnD',
  '..aWdddddddddddddddddddddddddD',
  '..aWdddddddddddddddddddddddddD',
  '..aDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '..kkDDDDDDDDDDDDDDDDDDDDDDDDkk',
  '..kk......................kk',
]

// 12×24. Piling with two rope bands.
const DOCK_POST = [
  '..dddddd',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '.ccccccc',
  '.cCCCCcc',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '.ccccccc',
  '.cCCCCcc',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..aWnndD',
  '..kkkkkk',
]

// 16×16. Shared by the four flower colours: P/p/q are that colour's ramp.
const FLOWER = [
  '',
  '......qqq',
  '....qqpppqq',
  '...qppYYYppP',
  '...qppYoYppP',
  '...qpppYpppP',
  '....PppppPP',
  '.....PPPP',
  '.......sS',
  '.......sS',
  '....llLsS',
  '.....llsS',
  '.......sSll',
  '.......sSLl',
  '.......sS',
  '.......sS',
]

// 32×12.
const FLOWERBED = [
  '',
  '.....q......Y......v......q',
  '...qqpqq..YYyYY..vvpvv..qqpqq',
  '..DqppqD..DYYYD..DvvvD..DqppqD',
  '.DDDsDDDDDDDsDDDDDDsDDDDDDsDDD',
  'EDDDDDDDDDDDDDDDDDDDDDDDDDDDDDE',
  'EEDDDDDDDDDDDDDDDDDDDDDDDDDDDEE',
  '.EEDDDDDDDDDDDDDDDDDDDDDDDDDEE',
  '.EEEEDDDDDDDDDDDDDDDDDDDDDEEEE',
  '..EEEEEEEEEEEEEEEEEEEEEEEEEEE',
  '...EEEEEEEEEEEEEEEEEEEEEEEEE',
]

// 16×12.
const SHELL_0 = [
  '',
  '.....pppp',
  '...pqcqcqpp',
  '..pqcqcqcqcp',
  '.pqcqcqcqcqcp',
  '.pqqcqqcqqcqp',
  '..pqqqqqqqqp',
  '...ppppppp',
  '....pp.pp',
]

const SHELL_1 = [
  '',
  '.....WWWW',
  '...WcCcCcWW',
  '..WcCcCcCcCW',
  '.WcCcCcCcCcCW',
  '.WCCcCCcCCcCW',
  '..WCCCCCCCCW',
  '...WWWWWWW',
  '....WW.WW',
]

// 16×16.
const MUSHROOM_0 = [
  '',
  '.....RRRRRR',
  '...RRwwRRRwRR',
  '..RwwwRRRRwwwR',
  '.RRRRRRRRRRRRRR',
  '.RwwRRRRRwwRRrr',
  '.RRwwRRRRRwwRrr',
  '..rRRRRRRRRRrr',
  '....CCCCCCC',
  '....CcccCCC',
  '....CcccCCC',
  '....CcccCCC',
  '...CCcccCCCC',
  '..CCCcccCCCCC',
  '..CCCCCCCCCCC',
]

const MUSHROOM_1 = [
  '',
  '',
  '.....nnnnnn',
  '...nnwwwwwnnn',
  '..nwwwwwwwwnnn',
  '.nnnnnnnnnnnnDD',
  '.nnnnnnnnnnnnDD',
  '..DDDDDDDDDDDD',
  '....CCCCCCC',
  '....CcccCCC',
  '....CcccCCC',
  '...CCcccCCCC',
  '..CCCCCCCCCCC',
]

// 16×12. Floating pads: the anchor sits in the middle, not at a base.
const LILY_0 = [
  '',
  '....gggggg',
  '..gggggggggg',
  '.ggggggg..lll',
  'gggggg.....lll',
  'ggggggg....lll',
  '.llllllll.llll',
  '..lllllllllll',
  '....llllll',
]

const LILY_1 = [
  '',
  '....gggggg',
  '..gggqPqgggg',
  '.gggPPYPPg.ll',
  'ggggqPPq...lll',
  'gggggqq....lll',
  '.llllllll.llll',
  '..lllllllllll',
  '....llllll',
]

/* ------------------------------------------------------------------ *
 * the pack
 * ------------------------------------------------------------------ */

const petals = (dark: PalKey, mid: PalKey, light: PalKey, heart: PalKey, core: PalKey): Legend => ({
  P: dark,
  p: mid,
  q: light,
  Y: heart,
  o: core,
  l: 'grass4',
  L: 'grass2',
  s: 'grass4',
  S: 'grass3',
})

const FLOWER_COLOURS: [PalKey, PalKey, PalKey, PalKey, PalKey][] = [
  ['pink3', 'pink4', 'pink5', 'yellow5', 'yellow3'],
  ['yellow3', 'yellow4', 'yellow5', 'orange4', 'orange3'],
  ['purple2', 'purple3', 'purple4', 'yellow5', 'yellow3'],
  ['cream3', 'cream4', 'cream5', 'yellow5', 'orange3'],
]

export const ENV_DEFS: SpriteDef[] = [
  // ---- foliage & stone (procedural mass) ----
  proc('tree_0', 64, 72, (r) => broadleaf(r, 0), [32, 70]),
  proc('tree_1', 64, 72, (r) => broadleaf(r, 1), [32, 70]),
  proc('pine_0', 40, 72, (r) => pineTree(r, 0), [20, 70]),
  proc('pine_1', 40, 72, (r) => pineTree(r, 1), [20, 70]),
  proc('palm_0', 56, 72, (r) => palmTree(r, 0), [28, 70]),
  proc('palm_1', 56, 72, (r) => palmTree(r, 1), [28, 70]),
  proc('bush_0', 40, 32, (r) => bushMass(r, 0), [20, 30]),
  proc('bush_1', 40, 32, (r) => bushMass(r, 1), [20, 30]),
  proc('rock_0', 40, 32, (r) => boulder(r, 0), [20, 30]),
  proc('rock_1', 40, 32, (r) => boulder(r, 1), [20, 30]),

  // ---- flowers ----
  ...FLOWER_COLOURS.map(([dark, mid, light, heart, core], i) => ascii(`flower_${i}`, 16, 16, FLOWER, petals(dark, mid, light, heart, core), { outline: undefined, anchor: [8, 16] })),
  ascii('flowerbed', 32, 12, FLOWERBED, { q: 'pink5', p: 'pink4', Y: 'yellow5', y: 'yellow3', v: 'purple4', s: 'grass3', D: 'dirt4', E: 'dirt3' }, { anchor: [16, 12] }),

  // ---- tall grass (2-frame sway) ----
  strip('grass_tall', 64, 32, 2, (r) => grassTuft(r), [16, 20]),

  // ---- fences ----
  ascii('fence_h', 32, 32, FENCE_H, WOOD, { anchor: [16, 26] }),
  ascii('fence_v', 32, 32, FENCE_V, WOOD, { anchor: [16, 30] }),
  ascii('fence_post', 32, 32, FENCE_POST, WOOD, { anchor: [16, 26] }),

  // ---- lamp post (the glass lights up at night via lamp_lit + glow_warm) ----
  ascii('lamp', 32, 80, LAMP_ROWS, LAMP, { anchor: [16, 74] }),
  ascii('lamp_lit', 28, 10, LAMP_LIT, { y: 'yellow5', Y: 'yellow6', G: 'yellow7' }, { outline: undefined, anchor: [14, 4] }),

  // ---- signs ----
  ascii('signpost', 48, 52, SIGNPOST, WOOD, { anchor: [24, 48] }),
  ascii('sign_small', 32, 32, SIGN_SMALL, WOOD, { anchor: [16, 26] }),

  // ---- bench ----
  ascii('bench', 48, 24, BENCH, WOOD, { anchor: [24, 22] }),

  // ---- small things ----
  ascii('shell_0', 16, 12, SHELL_0, { p: 'pink4', q: 'pink5', c: 'cream5' }, { anchor: [8, 10] }),
  ascii('shell_1', 16, 12, SHELL_1, { W: 'cream3', C: 'cream6', c: 'cream2' }, { anchor: [8, 10] }),
  ascii('mushroom_0', 16, 16, MUSHROOM_0, { R: 'red4', r: 'red3', w: 'cream6', C: 'cream4', c: 'cream5' }, { anchor: [8, 15] }),
  ascii('mushroom_1', 16, 16, MUSHROOM_1, { n: 'wood5', w: 'wood7', D: 'wood3', C: 'cream4', c: 'cream5' }, { anchor: [8, 13] }),
  ascii('stump', 32, 24, STUMP, WOOD, { anchor: [16, 20] }),
  ascii('log', 40, 20, LOG, WOOD, { anchor: [20, 12] }),
  ascii('lily_0', 16, 12, LILY_0, { g: 'leaf4', l: 'leaf3' }, { outline: undefined, anchor: [8, 6] }),
  ascii('lily_1', 16, 12, LILY_1, { g: 'leaf4', l: 'leaf3', P: 'pink4', q: 'pink5', Y: 'yellow5' }, { outline: undefined, anchor: [8, 6] }),
  proc('reed_0', 16, 32, (r) => reeds(r, 0), [8, 26]),
  proc('reed_1', 16, 32, (r) => reeds(r, 1), [8, 26]),

  // ---- chest ----
  ascii('chest_closed', 32, 28, CHEST_CLOSED, WOOD, { anchor: [16, 22] }),
  ascii('chest_open', 32, 28, CHEST_OPEN, WOOD, { anchor: [16, 22] }),
  ascii('dock_post', 12, 24, DOCK_POST, { ...WOOD, c: 'sand5', C: 'sand7' }, { anchor: [6, 23] }),

  // ---- collectibles, particles, fx (renderer-tuned sizes stay put) ----
  strip('packet', 96, 24, 4, (r) => packetCrystal(r, 4), [12, 12]),
  proc('mote', 4, 4, (r) => paintDot(r, K('tealLight')), [2, 2]),
  proc('dust', 6, 6, (r) => paintDot(r, [230, 214, 170, 220]), [3, 3]),
  proc('spark', 4, 4, (r) => paintDot(r, [255, 247, 200, 255]), [2, 2]),
  proc('star', 3, 3, (r) => paintDot(r, [255, 255, 240, 230]), [1, 1]),
  proc('leaf', 4, 3, (r) => paintDot(r, K('leafLight')), [2, 1]),
  proc('rain', 2, 11, (r) => paintDot(r, [208, 235, 255, 215]), [1, 5]),
  proc('firefly', 3, 3, (r) => paintDot(r, [255, 240, 140, 255]), [1, 1]),
  strip('ripple', 36, 6, 3, (r) => paintRipple(r), [6, 3]),
  proc('light_soft', 64, 64, (r) => paintGlow(r, [255, 255, 255, 255], 1.4), [32, 32]),
  proc('glow_warm', 48, 48, (r) => paintGlow(r, [255, 205, 120, 255], 2.2), [24, 24]),
  proc('glow_cool', 32, 32, (r) => paintGlow(r, [150, 240, 220, 255], 2), [16, 16]),
  proc('cloud_shadow', 128, 96, (r) => paintCloudShadow(r), [64, 48]),
  proc('beam', 160, 48, (r) => paintBeam(r), [0, 24]),
  strip('water', 256, 64, 4, (r) => paintStrip(r, 4, (rr, ox, f) => paintWaterFrame(rr, ox, 0, f)), [0, 0]),
  strip('foam', 64, 16, 4, (r) => paintStrip(r, 4, (rr, ox, f) => paintFoamFrame(rr, ox, 0, f)), [8, 8]),
]
