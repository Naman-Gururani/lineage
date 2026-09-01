export const TILE = 32
export const WORLD_TW = 96
export const WORLD_TH = 72
export const WORLD_W = TILE * WORLD_TW
export const WORLD_H = TILE * WORLD_TH
export const WORLD_SEED = 20240816
export const CHUNK = 1024

/**
 * Camera zoom for a viewport. HD art is authored at 1x, so 1 is the native
 * scale and bigger screens step up in halves (roughly 26–40 tiles wide).
 */
export function pickZoom(viewW: number, viewH: number): number {
  const m = Math.min(viewW, viewH * 1.78)
  if (m >= 2400) return 2
  if (m >= 1400) return 1.5
  return 1
}

export const WALK_SPEED = 144 // 4.5 tiles/s
export const RUN_SPEED = 224 // 7 tiles/s
