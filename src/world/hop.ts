// Hop planning: how far a jump carries the player and where it puts them down.
// Pure — no Phaser. The scene supplies two blocked predicates:
//
//   blockedHard  solids the hop cannot pass through at all (buildings, trees,
//                boulders, the sea) — checked along the flight path.
//   blockedAny   everything blockedHard covers *plus* the low things a hop
//                sails over (fences, small stones, the brook) — checked at the
//                landing, because you clear them but cannot stand on them.
import { TILE } from '../config'

/** Where a hop puts the player down, and how far that is along the facing (tiles). */
export type HopPlan = { lx: number; ly: number; dist: 0 | 0.5 | 1 | 1.5 }

/** Seconds a hop takes, ground to ground. */
export const HOP_TIME = 0.38
/** Peak of the visual arc, in pixels. */
export const HOP_ARC = 0.6 * TILE
/** Landing candidates in tiles, longest first. */
export const HOP_DISTS: readonly (1.5 | 1 | 0.5)[] = [1.5, 1, 0.5]
/** Half-extents of the player's collision box (mirrors Player.hw / Player.hh). */
export const HOP_HW = 5
export const HOP_HH = 3
/** A ledge drop is always two tiles, and rides a taller arc than a normal hop. */
export const LEDGE_TILES = 2
export const LEDGE_ARC = TILE

const EPS = 0.001
/** Corners, edge midpoints and centre — enough to catch a solid smaller than the box. */
const OFFSETS: readonly [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
]

/** True when the player box standing at (x, y) touches anything `blocked` reports. */
export function boxBlocked(x: number, y: number, blocked: (x: number, y: number) => boolean): boolean {
  for (const [ox, oy] of OFFSETS) if (blocked(x + ox * (HOP_HW - EPS), y + oy * (HOP_HH - EPS))) return true
  return false
}

/** Hard obstacles between take-off and landing. Low ones are flown over. */
function pathBlocked(px: number, py: number, lx: number, ly: number, blockedHard: (x: number, y: number) => boolean): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(lx - px, ly - py) / (TILE / 4)))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    if (boxBlocked(px + (lx - px) * t, py + (ly - py) * t, blockedHard)) return true
  }
  return false
}

/**
 * Pick the longest hop the ground allows: 1.5 tiles, then 1, then half a tile,
 * then a hop on the spot. Standing still always hops on the spot — the hop
 * carries you forward only when you are already going somewhere.
 */
export function planHop(
  px: number,
  py: number,
  dirX: number,
  dirY: number,
  moving: boolean,
  blockedHard: (x: number, y: number) => boolean,
  blockedAny: (x: number, y: number) => boolean,
): HopPlan {
  const stay: HopPlan = { lx: px, ly: py, dist: 0 }
  const len = Math.hypot(dirX, dirY)
  if (!moving || len < 1e-6) return stay
  const ux = dirX / len
  const uy = dirY / len
  for (const d of HOP_DISTS) {
    const lx = px + ux * d * TILE
    const ly = py + uy * d * TILE
    if (boxBlocked(lx, ly, blockedAny)) continue
    if (pathBlocked(px, py, lx, ly, blockedHard)) continue
    return { lx, ly, dist: d }
  }
  return stay
}
