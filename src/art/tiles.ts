// Per-tile terrain painters. Everything is painted into a Raster so the same
// code runs in the browser (baked into chunk textures) and in Node (previews).
import { TILE } from '../config'
import { makeRng } from '../core/rng'
import { T, isLand, isWater, mask4, mask8, type Grid, type Terrain } from '../world/terrain'
import { PAL } from './palette'
import { hex } from './pixel'
import { fillRect, setPx, type RGBA, type Raster } from './raster'

const C = (k: keyof typeof PAL, alpha?: number): RGBA => {
  const c = hex(PAL[k])
  return alpha === undefined ? c : [c[0], c[1], c[2], alpha]
}

const col = {
  grass: C('grass'),
  grassLight: C('grassLight'),
  grassDark: C('grassDark'),
  grassDeep: C('grassDeep'),
  plateau: hex('#86cc5e') as RGBA,
  plateauLight: hex('#a0dc74') as RGBA,
  sand: C('sand'),
  sandLight: C('sandLight'),
  sandDark: C('sandDark'),
  sandWet: C('sandWet'),
  path: C('path'),
  pathLight: C('pathLight'),
  pathDark: C('pathDark'),
  dirt: C('dirt'),
  dirtDark: C('dirtDark'),
  stone: C('stone'),
  stoneLight: C('stoneLight'),
  stoneDark: C('stoneDark'),
  stoneDeep: C('stoneDeep'),
  cobble: C('cobble'),
  plank: C('plank'),
  plankDark: C('plankDark'),
  woodDark: C('woodDark'),
  woodLight: C('woodLight'),
  metalDark: C('metalDark'),
  shallow: C('shallow', 120),
  riverTint: C('waterLight', 120),
  riverEdge: C('waterDeep', 200),
  deepTint: C('waterDeeper', 110),
  water: C('water'),
  waterLight: C('waterLight'),
  waterDeep: C('waterDeep'),
  foam: C('foam'),
}

const isGrassy = (t: Terrain) => t === T.GRASS || t === T.TALLGRASS || t === T.PLATEAU || t === T.PATH || t === T.PLAZA
const isSandy = (t: Terrain) => t === T.SAND || t === T.DOCK
const isSea = (t: Terrain) => t === T.DEEP || t === T.WATER || t === T.SHALLOW

function tileRng(x: number, y: number) {
  return makeRng((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995)
}

function speckle(r: Raster, px: number, py: number, rng: ReturnType<typeof makeRng>, n: number, colors: RGBA[]) {
  for (let i = 0; i < n; i++) setPx(r, px + rng.int(0, 15), py + rng.int(0, 15), rng.pick(colors))
}

export function paintTile(r: Raster, px: number, py: number, grid: Grid, x: number, y: number): void {
  const t = grid.get(x, y)
  const rng = tileRng(x, y)
  const nb = (dx: number, dy: number): Terrain => (grid.inb(x + dx, y + dy) ? grid.get(x + dx, y + dy) : T.DEEP)

  switch (t) {
    case T.GRASS:
    case T.TALLGRASS:
    case T.PLATEAU: {
      const base = t === T.PLATEAU ? col.plateau : col.grass
      const light = t === T.PLATEAU ? col.plateauLight : col.grassLight
      fillRect(r, px, py, TILE, TILE, base)
      speckle(r, px, py, rng, rng.int(2, 5), [light, col.grassDark])
      if (rng.chance(0.18)) {
        const tx = px + rng.int(2, 12)
        const ty = py + rng.int(3, 12)
        setPx(r, tx, ty, col.grassDark)
        setPx(r, tx, ty + 1, col.grassDark)
        setPx(r, tx + 1, ty + 1, col.grassDark)
        setPx(r, tx, ty - 1, light)
      }
      // sand edges (scalloped)
      const m = mask8(grid, x, y, (n) => !isSandy(n) && !isSea(n) && n !== T.RIVER && n !== T.POND)
      const edge = (side: 'n' | 'e' | 's' | 'w') => {
        for (let i = 0; i < TILE; i++) {
          const wob = (i + x * 3 + y * 5) % 4 === 0 ? 1 : 0
          const sandC = rng.chance(0.5) ? col.sand : col.sandDark
          if (side === 'n') {
            setPx(r, px + i, py, sandC)
            setPx(r, px + i, py + 1, wob ? sandC : col.grassDark)
            if (wob) setPx(r, px + i, py + 2, col.grassDark)
          } else if (side === 's') {
            setPx(r, px + i, py + 15, sandC)
            setPx(r, px + i, py + 14, wob ? sandC : col.grassDark)
            if (wob) setPx(r, px + i, py + 13, col.grassDark)
          } else if (side === 'w') {
            setPx(r, px, py + i, sandC)
            setPx(r, px + 1, py + i, wob ? sandC : col.grassDark)
            if (wob) setPx(r, px + 2, py + i, col.grassDark)
          } else {
            setPx(r, px + 15, py + i, sandC)
            setPx(r, px + 14, py + i, wob ? sandC : col.grassDark)
            if (wob) setPx(r, px + 13, py + i, col.grassDark)
          }
        }
      }
      if (!(m & 1)) edge('n')
      if (!(m & 4)) edge('e')
      if (!(m & 16)) edge('s')
      if (!(m & 64)) edge('w')
      // outer corners
      if (m & 1 && m & 4 && !(m & 2)) fillRect(r, px + 14, py, 2, 2, col.sandDark)
      if (m & 4 && m & 16 && !(m & 8)) fillRect(r, px + 14, py + 14, 2, 2, col.sandDark)
      if (m & 16 && m & 64 && !(m & 32)) fillRect(r, px, py + 14, 2, 2, col.sandDark)
      if (m & 64 && m & 1 && !(m & 128)) fillRect(r, px, py, 2, 2, col.sandDark)
      // river / pond banks
      const bank = (dx: number, dy: number) => {
        const n = nb(dx, dy)
        return n === T.RIVER || n === T.POND
      }
      if (bank(0, -1)) fillRect(r, px, py, TILE, 1, col.dirt)
      if (bank(0, 1)) fillRect(r, px, py + 14, TILE, 2, col.dirtDark)
      if (bank(-1, 0)) fillRect(r, px, py, 1, TILE, col.dirt)
      if (bank(1, 0)) fillRect(r, px + 15, py, 1, TILE, col.dirt)
      break
    }
    case T.SAND: {
      fillRect(r, px, py, TILE, TILE, col.sand)
      speckle(r, px, py, rng, rng.int(3, 6), [col.sandLight, col.sandDark, col.sandDark])
      const m = mask4(grid, x, y, (n) => !isSea(n))
      if (!(m & 1)) fillRect(r, px, py, TILE, 3, col.sandWet)
      if (!(m & 4)) fillRect(r, px, py + 13, TILE, 3, col.sandWet)
      if (!(m & 8)) fillRect(r, px, py, 3, TILE, col.sandWet)
      if (!(m & 2)) fillRect(r, px + 13, py, 3, TILE, col.sandWet)
      break
    }
    case T.PATH: {
      fillRect(r, px, py, TILE, TILE, col.path)
      // worn, uneven surface: light patches + dark grit
      for (let i = 0; i < 5; i++) fillRect(r, px + rng.int(0, 13), py + rng.int(0, 13), rng.int(2, 4), rng.int(1, 3), col.pathLight)
      speckle(r, px, py, rng, rng.int(3, 6), [col.pathDark, col.pathDark, col.dirt])
      if (rng.chance(0.3)) {
        const sx = px + rng.int(2, 12)
        const sy = py + rng.int(2, 12)
        setPx(r, sx, sy, col.stoneLight)
        setPx(r, sx + 1, sy, col.stone)
      }
      const m = mask8(grid, x, y, (n) => n === T.PATH || n === T.PLAZA || n === T.BRIDGE || n === T.DOCK)
      const grassEdge = (side: 'n' | 'e' | 's' | 'w', gc: RGBA) => {
        for (let i = 0; i < TILE; i++) {
          const wob = (i + x * 7 + y * 3) % 3 === 0
          if (side === 'n') {
            setPx(r, px + i, py, wob ? gc : col.pathDark)
            if (wob) setPx(r, px + i, py + 1, col.pathDark)
          } else if (side === 's') {
            setPx(r, px + i, py + 15, wob ? gc : col.pathDark)
            if (wob) setPx(r, px + i, py + 14, col.pathDark)
          } else if (side === 'w') {
            setPx(r, px, py + i, wob ? gc : col.pathDark)
            if (wob) setPx(r, px + 1, py + i, col.pathDark)
          } else {
            setPx(r, px + 15, py + i, wob ? gc : col.pathDark)
            if (wob) setPx(r, px + 14, py + i, col.pathDark)
          }
        }
      }
      const neighbourColor = (dx: number, dy: number) => {
        const n = nb(dx, dy)
        return isSandy(n) ? col.sand : n === T.PLATEAU ? col.plateau : col.grass
      }
      if (!(m & 1)) grassEdge('n', neighbourColor(0, -1))
      if (!(m & 4)) grassEdge('e', neighbourColor(1, 0))
      if (!(m & 16)) grassEdge('s', neighbourColor(0, 1))
      if (!(m & 64)) grassEdge('w', neighbourColor(-1, 0))
      break
    }
    case T.PLAZA: {
      fillRect(r, px, py, TILE, TILE, col.cobble)
      // offset cobbles
      for (let cy = 0; cy < TILE; cy += 4) {
        const off = (cy / 4) % 2 ? 2 : 0
        for (let cx = -2; cx < TILE; cx += 4) {
          const sx = px + cx + off
          const sy = py + cy
          fillRect(r, sx, sy, 4, 1, col.stoneDark)
          fillRect(r, sx, sy, 1, 4, col.stoneDark)
          if (rng.chance(0.35)) setPx(r, sx + 1, sy + 1, col.stoneLight)
          if (rng.chance(0.15)) fillRect(r, sx + 1, sy + 1, 3, 3, col.stone)
        }
      }
      fillRect(r, px, py, TILE, 1, col.stoneDark)
      fillRect(r, px, py, 1, TILE, col.stoneDark)
      break
    }
    case T.DOCK: {
      fillRect(r, px, py, TILE, TILE, col.plank)
      for (let py2 = 0; py2 < TILE; py2 += 4) fillRect(r, px, py + py2, TILE, 1, col.plankDark)
      for (let py2 = 2; py2 < TILE; py2 += 8) {
        setPx(r, px + 2, py + py2, col.metalDark)
        setPx(r, px + 13, py + py2, col.metalDark)
      }
      const m = mask4(grid, x, y, (n) => n === T.DOCK || isLand(n))
      if (!(m & 8)) fillRect(r, px, py, 2, TILE, col.woodDark)
      if (!(m & 2)) fillRect(r, px + 14, py, 2, TILE, col.woodDark)
      if (!(m & 4)) fillRect(r, px, py + 14, TILE, 2, col.woodDark)
      if (!(m & 1)) fillRect(r, px, py, TILE, 1, col.woodLight)
      break
    }
    case T.BRIDGE: {
      fillRect(r, px, py, TILE, TILE, col.plank)
      for (let px2 = 0; px2 < TILE; px2 += 4) fillRect(r, px + px2, py, 1, TILE, col.plankDark)
      const m = mask4(grid, x, y, (n) => n !== T.RIVER && n !== T.POND)
      if (!(m & 1)) {
        fillRect(r, px, py, TILE, 3, col.woodDark)
        fillRect(r, px, py, TILE, 1, col.woodLight)
      }
      if (!(m & 4)) {
        fillRect(r, px, py + 13, TILE, 3, col.woodDark)
        fillRect(r, px, py + 13, TILE, 1, col.woodLight)
      }
      break
    }
    case T.CLIFF: {
      fillRect(r, px, py, TILE, TILE, col.stone)
      speckle(r, px, py, rng, rng.int(3, 6), [col.stoneLight, col.stoneDark])
      const up = nb(0, -1)
      const down = nb(0, 1)
      if (up === T.PLATEAU || up === T.CLIFF) fillRect(r, px, py, TILE, 2, col.stoneLight)
      else fillRect(r, px, py, TILE, 2, col.plateauLight)
      if (down !== T.CLIFF && down !== T.PLATEAU) {
        fillRect(r, px, py + 12, TILE, 4, col.stoneDark)
        fillRect(r, px, py + 15, TILE, 1, col.stoneDeep)
      }
      // cracks
      const cx = px + rng.int(2, 12)
      const cy = py + rng.int(3, 10)
      setPx(r, cx, cy, col.stoneDeep)
      setPx(r, cx + 1, cy + 1, col.stoneDeep)
      setPx(r, cx + 1, cy + 2, col.stoneDark)
      if (nb(-1, 0) !== T.CLIFF && nb(-1, 0) !== T.PLATEAU) fillRect(r, px, py, 1, TILE, col.stoneDark)
      if (nb(1, 0) !== T.CLIFF && nb(1, 0) !== T.PLATEAU) fillRect(r, px + 15, py, 1, TILE, col.stoneDark)
      break
    }
    case T.RIVER:
    case T.POND: {
      fillRect(r, px, py, TILE, TILE, col.riverTint)
      const m = mask4(grid, x, y, (n) => isWater(n))
      if (!(m & 1)) fillRect(r, px, py, TILE, 1, col.riverEdge)
      if (!(m & 4)) fillRect(r, px, py + 15, TILE, 1, col.riverEdge)
      if (!(m & 8)) fillRect(r, px, py, 1, TILE, col.riverEdge)
      if (!(m & 2)) fillRect(r, px + 15, py, 1, TILE, col.riverEdge)
      break
    }
    case T.SHALLOW: {
      fillRect(r, px, py, TILE, TILE, col.shallow)
      break
    }
    case T.DEEP: {
      fillRect(r, px, py, TILE, TILE, col.deepTint)
      break
    }
    default:
      break
  }
}

/** 64×64 seamless animated ocean tile (4 frames). */
export function paintWaterFrame(r: Raster, ox: number, oy: number, frame: number): void {
  fillRect(r, ox, oy, 64, 64, col.water)
  const rng = makeRng(991)
  for (let i = 0; i < 26; i++) {
    const x0 = rng.int(0, 63)
    const y0 = rng.int(0, 63)
    const len = rng.int(3, 8)
    const dark = rng.chance(0.35)
    const phase = (frame + (i % 4)) % 4
    const dy = phase === 1 ? 1 : phase === 3 ? -1 : 0
    for (let k = 0; k < len; k++) {
      const x = (x0 + k + frame * 2) % 64
      const y = (y0 + dy + 64) % 64
      setPx(r, ox + x, oy + y, dark ? col.waterDeep : col.waterLight)
    }
    if (!dark && phase === 2) setPx(r, ox + (x0 + frame * 2) % 64, oy + (y0 + 63) % 64, col.foam)
  }
}

/** 16×16 foam edge (north side) animated over 4 frames. */
export function paintFoamFrame(r: Raster, ox: number, oy: number, frame: number): void {
  for (let x = 0; x < 16; x++) {
    const wave = Math.round(Math.sin((x / 16) * Math.PI * 2 + frame * (Math.PI / 2)) * 1.2)
    const y = 2 + wave
    setPx(r, ox + x, oy + y, col.foam)
    if ((x + frame) % 3 === 0) setPx(r, ox + x, oy + y + 1, [232, 248, 255, 140])
    if ((x + frame) % 5 === 0) setPx(r, ox + x, oy + y - 1, [232, 248, 255, 120])
  }
}

/** Minimap: 2 px per tile, terrain colours. */
export function terrainColor(t: Terrain): RGBA {
  switch (t) {
    case T.DEEP:
      return col.waterDeep
    case T.WATER:
      return col.water
    case T.SHALLOW:
      return C('shallow')
    case T.SAND:
      return col.sand
    case T.GRASS:
    case T.TALLGRASS:
      return col.grass
    case T.PLATEAU:
      return col.plateau
    case T.PATH:
      return col.path
    case T.CLIFF:
      return col.stone
    case T.RIVER:
    case T.POND:
      return col.waterLight
    case T.BRIDGE:
    case T.DOCK:
      return col.plank
    case T.PLAZA:
      return col.cobble
    default:
      return col.grass
  }
}
