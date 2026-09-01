// Bakes the terrain grid into chunk rasters (CHUNK px square, 1024 today) and a
// minimap raster. Pure: rasters only; the scene turns them into textures.
import { paintTile, terrainColor } from '../art/tiles'
import { fillRect, makeRaster, type Raster } from '../art/raster'
import { CHUNK, TILE, WORLD_H, WORLD_W } from '../config'
import type { Grid } from './terrain'

export type ChunkRaster = { cx: number; cy: number; x: number; y: number; raster: Raster }

export const CHUNKS_X = Math.ceil(WORLD_W / CHUNK)
export const CHUNKS_Y = Math.ceil(WORLD_H / CHUNK)

export function bakeChunk(grid: Grid, cx: number, cy: number): ChunkRaster {
  const x0 = cx * CHUNK
  const y0 = cy * CHUNK
  const w = Math.min(CHUNK, WORLD_W - x0)
  const h = Math.min(CHUNK, WORLD_H - y0)
  const raster = makeRaster(w, h)
  const tx0 = x0 / TILE
  const ty0 = y0 / TILE
  const tw = w / TILE
  const th = h / TILE
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++) paintTile(raster, tx * TILE, ty * TILE, grid, tx0 + tx, ty0 + ty)
  return { cx, cy, x: x0, y: y0, raster }
}

export function chunkList(): { cx: number; cy: number }[] {
  const out: { cx: number; cy: number }[] = []
  for (let cy = 0; cy < CHUNKS_Y; cy++) for (let cx = 0; cx < CHUNKS_X; cx++) out.push({ cx, cy })
  return out
}

export function bakeAll(grid: Grid): ChunkRaster[] {
  return chunkList().map(({ cx, cy }) => bakeChunk(grid, cx, cy))
}

/** Whole world in one raster (previews only — 3072×2304 at 96×72 tiles of 32px). */
export function bakeWorld(grid: Grid): Raster {
  const r = makeRaster(WORLD_W, WORLD_H)
  for (let ty = 0; ty < grid.h; ty++) for (let tx = 0; tx < grid.w; tx++) paintTile(r, tx * TILE, ty * TILE, grid, tx, ty)
  return r
}

export function bakeMinimap(grid: Grid, scale = 2): Raster {
  const r = makeRaster(grid.w * scale, grid.h * scale)
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) fillRect(r, x * scale, y * scale, scale, scale, terrainColor(grid.get(x, y)))
  return r
}
