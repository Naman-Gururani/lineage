// Interior rooms: an ASCII floor plan + legend → tiles, solids, props, npcs.
import { TILE } from '../config'
import type { Solid } from './collision'

export type RoomPropDef = {
  sprite: string
  /** footprint in tiles (default 1×1) */
  w?: number
  h?: number
  solid?: boolean
  /** flat things (rugs, pipes) draw under the walking layer */
  flat?: boolean
  /** posters/photos hang on the back wall above the tile */
  wall?: boolean
  /** anchor at the sprite centre instead of bottom-centre */
  center?: boolean
  interact?: string
  prompt?: string
  frames?: number
  fps?: number
  light?: boolean
  npc?: string
  facing?: 'down' | 'up' | 'left' | 'right'
  data?: unknown
}

export type RoomDef = {
  id: string
  name: string
  floor: 'wood' | 'stone' | 'tile' | 'metal' | 'carpet'
  wallFace?: 'wall_face' | 'wall_face_stone' | 'wall_face_metal'
  rows: string[]
  legend: Record<string, RoomPropDef>
  /** interior columns on the back wall that hold windows */
  windows?: number[]
  /** 'sky' windows show the elevator view frames instead of day/night */
  windowKind?: 'day' | 'sky'
  exit: number // interior column of the exit gap
  spawn: { x: number; y: number } // interior tile coords
  music: 'interior' | 'tower' | 'engine'
}

export type RoomProp = {
  sprite: string
  x: number
  y: number
  depth: number
  interact?: string
  prompt?: string
  frames: number
  fps: number
  light: boolean
  data?: unknown
}

export type ParsedRoom = {
  w: number
  h: number
  tiles: string[][]
  solids: Solid[]
  props: RoomProp[]
  npcs: { id: string; x: number; y: number; facing?: 'down' | 'up' | 'left' | 'right' }[]
  windows: { x: number; y: number; col: number }[]
  spawn: { x: number; y: number }
  exit: { x: number; y: number }
  floorFrame: string
}

const FLOOR: Record<RoomDef['floor'], string> = { wood: 'floor_wood', stone: 'floor_stone', tile: 'floor_tile', metal: 'floor_metal', carpet: 'floor_carpet' }

export function parseRoom(def: RoomDef): ParsedRoom {
  const cols = def.rows[0]?.length ?? 0
  const rows = def.rows.length
  const w = cols + 2
  const h = rows + 3
  const floorFrame = FLOOR[def.floor]
  const wallFace = def.wallFace ?? (def.floor === 'metal' ? 'wall_face_metal' : def.floor === 'stone' ? 'wall_face_stone' : 'wall_face')
  const tiles: string[][] = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      if (y === 0) row.push('wall_top')
      else if (y === 1) row.push(x === 0 || x === w - 1 ? 'wall_top' : wallFace)
      else if (y === h - 1) row.push(x === def.exit + 1 ? 'exit_door' : 'wall_top')
      else if (x === 0 || x === w - 1) row.push('wall_top')
      else row.push((x * 7 + y * 13) % 5 === 0 && def.floor === 'wood' ? 'floor_wood_alt' : floorFrame)
    }
    tiles.push(row)
  }
  const windows: ParsedRoom['windows'] = []
  for (const c of def.windows ?? []) {
    const frame = def.windowKind === 'sky' ? 'window_sky_0' : 'window_day'
    tiles[1][c + 1] = frame
    windows.push({ x: (c + 1) * TILE, y: TILE, col: c })
  }

  const solids: Solid[] = [
    { x: 0, y: 0, w: w * TILE, h: 2 * TILE }, // back wall
    { x: 0, y: 0, w: TILE, h: h * TILE }, // left
    { x: (w - 1) * TILE, y: 0, w: TILE, h: h * TILE }, // right
  ]
  // bottom wall with the exit gap
  const exitX = def.exit + 1
  if (exitX > 1) solids.push({ x: TILE, y: (h - 1) * TILE, w: (exitX - 1) * TILE, h: TILE })
  if (exitX < w - 2) solids.push({ x: (exitX + 1) * TILE, y: (h - 1) * TILE, w: (w - 2 - exitX) * TILE, h: TILE })

  const props: RoomProp[] = []
  const npcs: ParsedRoom['npcs'] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = def.rows[r][c]
      if (ch === '.' || ch === ' ') continue
      const p = def.legend[ch]
      if (!p) throw new Error(`Room "${def.id}": unknown legend char "${ch}"`)
      const tx = c + 1
      const ty = r + 2
      if (p.npc) {
        npcs.push({ id: p.npc, x: (tx + 0.5) * TILE, y: (ty + 0.9) * TILE, facing: p.facing })
        continue
      }
      const fw = p.w ?? 1
      const fh = p.h ?? 1
      let x = (tx + fw / 2) * TILE
      let y = (ty + fh) * TILE
      let depth = y
      if (p.wall) {
        y = 2 * TILE
        depth = -40
      } else if (p.flat) depth = -50
      if (p.center) y -= (fh * TILE) / 2
      props.push({ sprite: p.sprite, x, y, depth, interact: p.interact, prompt: p.prompt, frames: p.frames ?? 1, fps: p.fps ?? 4, light: !!p.light, data: p.data })
      if (p.solid !== false && !p.flat && !p.wall) solids.push({ x: tx * TILE, y: ty * TILE, w: fw * TILE, h: fh * TILE })
    }
  }
  return {
    w,
    h,
    tiles,
    solids,
    props,
    npcs,
    windows,
    spawn: { x: (def.spawn.x + 1.5) * TILE, y: (def.spawn.y + 2.9) * TILE },
    exit: { x: (exitX + 0.5) * TILE, y: (h - 1) * TILE + 8 },
    floorFrame,
  }
}
