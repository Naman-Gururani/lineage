// Preview generated art from Node: `npm run preview:art -- sheet hero` or
// `npm run preview:art -- world [tx ty tw th] [scale]`. Writes PNGs to ./scratch.
import { mkdirSync, writeFileSync } from 'node:fs'
import { encodePNG } from './png'
import { packSheet, rasterize, type SpriteDef } from '../src/art/pixel'
import { blit, fillRect, makeRaster, type Raster } from '../src/art/raster'
import { makeRng } from '../src/core/rng'
import { TILE, WORLD_SEED, WORLD_TH, WORLD_TW } from '../src/config'
import { BLUEPRINT, rasterizeBlueprint } from '../src/world/blueprint'
import { bakeWorld, bakeMinimap } from '../src/world/bake'
import { scatterDecor } from '../src/world/scatter'

function scale(r: Raster, k: number): Raster {
  const out = makeRaster(r.w * k, r.h * k)
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4
      fillRect(out, x * k, y * k, k, k, [r.data[i], r.data[i + 1], r.data[i + 2], r.data[i + 3]])
    }
  return out
}

function crop(r: Raster, x: number, y: number, w: number, h: number): Raster {
  const out = makeRaster(w, h)
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const si = ((y + yy) * r.w + (x + xx)) * 4
      const di = (yy * w + xx) * 4
      out.data[di] = r.data[si]
      out.data[di + 1] = r.data[si + 1]
      out.data[di + 2] = r.data[si + 2]
      out.data[di + 3] = r.data[si + 3]
    }
  return out
}

function save(name: string, r: Raster) {
  mkdirSync('scratch', { recursive: true })
  const file = `scratch/${name}.png`
  writeFileSync(file, encodePNG(r.w, r.h, r.data))
  console.log(`wrote ${file} (${r.w}×${r.h})`)
}

/**
 * The sprite packs `sheet` knows about — one entry per `src/art/sprites/*.ts`
 * that exports a def array. Kept explicit so a typo reports the packs that do
 * exist instead of dying inside a dynamic import.
 */
const PACKS = ['hero', 'npcs', 'env', 'props', 'buildings', 'fair', 'rides'] as const

async function sheet(name: string, k = 4) {
  if (!(PACKS as readonly string[]).includes(name)) {
    console.log(`unknown pack "${name}" — try one of: ${PACKS.join(', ')}`)
    return
  }
  const mod = (await import(`../src/art/sprites/${name}.ts`)) as Record<string, SpriteDef[]>
  const defs = Object.values(mod).find((v) => Array.isArray(v)) as SpriteDef[]
  const pack = packSheet(defs, 512)
  const r = makeRaster(pack.w, Math.max(1, pack.h))
  fillRect(r, 0, 0, r.w, r.h, [60, 60, 70, 255])
  for (const d of defs) {
    const p = pack.place[d.name]
    blit(r, rasterize(d), p.x, p.y)
  }
  save(name, scale(r, k))
}

function world(tx = 0, ty = 0, tw = WORLD_TW, th = WORLD_TH, k = 1, withDecor = true) {
  const rng = makeRng(WORLD_SEED)
  const grid = rasterizeBlueprint(BLUEPRINT, rng)
  const full = bakeWorld(grid)
  // sea backdrop so transparent water reads
  const bg = makeRaster(full.w, full.h)
  fillRect(bg, 0, 0, bg.w, bg.h, [62, 159, 216, 255])
  blit(bg, full, 0, 0)
  if (withDecor) {
    const decor = scatterDecor(grid, BLUEPRINT, makeRng(WORLD_SEED).fork('scatter'))
    const dot: Record<string, [number, number, number, number]> = {
      tree: [47, 122, 62, 255],
      pine: [30, 82, 56, 255],
      palm: [79, 174, 79, 255],
      bush: [79, 174, 79, 255],
      rock: [95, 103, 118, 255],
      lamp: [255, 210, 63, 255],
      fence: [122, 75, 44, 255],
      flower: [255, 143, 176, 255],
      grass: [63, 138, 59, 255],
      shell: [253, 251, 244, 255],
    }
    for (const d of decor) {
      const c = dot[d.kind] ?? [200, 200, 200, 255]
      const s = d.kind === 'tree' || d.kind === 'pine' || d.kind === 'palm' ? 6 : 3
      fillRect(bg, Math.round(d.x - s / 2), Math.round(d.y - s / 2), s, s, c)
    }
    // Footprint in red, door tile in white. This drew `landmarks` until the fair
    // replaced them; `attractions` carry the same four fields and a door.
    for (const a of BLUEPRINT.attractions) {
      fillRect(bg, a.tx * TILE, a.ty * TILE, a.w * TILE, a.h * TILE, [226, 72, 63, 200])
      fillRect(bg, a.door.x * TILE + 4, a.door.y * TILE + 4, 8, 8, [255, 255, 255, 255])
    }
    for (const p of BLUEPRINT.packetSpots) fillRect(bg, p.x * TILE + 5, p.y * TILE + 5, 6, 6, [49, 199, 179, 255])
    for (const [, p] of Object.entries(BLUEPRINT.npcSpots)) fillRect(bg, p.x * TILE + 4, p.y * TILE + 4, 8, 8, [155, 107, 242, 255])
    fillRect(bg, BLUEPRINT.spawn.x * TILE + 3, BLUEPRINT.spawn.y * TILE + 3, 10, 10, [255, 255, 255, 255])
  }
  const c = crop(bg, tx * TILE, ty * TILE, tw * TILE, th * TILE)
  save('world', k === 1 ? c : scale(c, k))
  save('minimap', scale(bakeMinimap(grid, 2), 2))
}

const [mode, ...rest] = process.argv.slice(2)
if (mode === 'sheet') void sheet(rest[0], Number(rest[1] ?? 4))
else if (mode === 'world') {
  const n = rest.map(Number)
  if (n.length >= 4) world(n[0], n[1], n[2], n[3], n[4] ?? 1)
  else world(0, 0, WORLD_TW, WORLD_TH, n[0] ?? 1)
} else console.log(`usage: preview sheet <${PACKS.join('|')}> [scale] | world [tx ty tw th] [scale]`)
