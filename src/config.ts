export const TILE = 16
export const WORLD_TW = 160
export const WORLD_TH = 120
export const WORLD_W = TILE * WORLD_TW
export const WORLD_H = TILE * WORLD_TH
export const WORLD_SEED = 20240816
export const CHUNK = 512

/** Integer camera zoom for a viewport (crisp pixels; roughly 26–40 tiles wide). */
export function pickZoom(viewW: number, viewH: number): number {
  const m = Math.min(viewW, viewH * 1.78)
  if (m >= 2400) return 4
  if (m >= 1100) return 3
  return 2
}

export const WALK_SPEED = 80
export const RUN_SPEED = 136
