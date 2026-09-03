// Builds the single texture atlas (every generated sprite) and the animations.
import Phaser from 'phaser'
import { buildSheet, type Sheet, type SpriteDef } from './pixel'
import { ENV_DEFS } from './sprites/env'
import { HERO_DEFS } from './sprites/hero'
import { BUILDING_DEFS } from './sprites/buildings'
import { NPC_DEFS } from './sprites/npcs'
import { PROP_DEFS } from './sprites/props'
import { FAIR_DEFS } from './sprites/fair'
import { RIDE_DEFS } from './sprites/rides'

export const ATLAS = 'atlas'

const extraPacks: SpriteDef[][] = []
/** Sprite packs registered by other modules (buildings, npcs, interiors…). */
export function registerPack(defs: SpriteDef[]): void {
  extraPacks.push(defs)
}

export function allDefs(): SpriteDef[] {
  return [...HERO_DEFS, ...ENV_DEFS, ...NPC_DEFS, ...PROP_DEFS, ...BUILDING_DEFS, ...FAIR_DEFS, ...RIDE_DEFS, ...extraPacks.flat()]
}

let sheet: Sheet | null = null

export function buildAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS)) return
  sheet = buildSheet(allDefs(), 4096)
  const tex = scene.textures.addCanvas(ATLAS, sheet.canvas)
  if (!tex) throw new Error('atlas texture could not be created')
  for (const [name, f] of Object.entries(sheet.frames)) {
    const fr = tex.add(name, 0, f.x, f.y, f.w, f.h)
    if (fr) {
      fr.customPivot = true
      fr.pivotX = f.ax / f.w
      fr.pivotY = f.ay / f.h
    }
  }
}

export function frame(name: string): { key: string; frame: string } {
  return { key: ATLAS, frame: name }
}

export function hasFrame(scene: Phaser.Scene, name: string): boolean {
  return scene.textures.exists(ATLAS) && scene.textures.get(ATLAS).has(name)
}

/** Data URL of one atlas frame scaled up (for DOM HUD icons/portraits). */
export function frameDataURL(name: string, scale = 3): string {
  if (!sheet) return ''
  const f = sheet.frames[name]
  if (!f) return ''
  const c = document.createElement('canvas')
  c.width = f.w * scale
  c.height = f.h * scale
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sheet.canvas, f.x, f.y, f.w, f.h, 0, 0, c.width, c.height)
  return c.toDataURL()
}

export function createAnims(scene: Phaser.Scene): void {
  const anims = scene.anims
  const mk = (key: string, frames: string[], frameRate: number, repeat = -1) => {
    if (anims.exists(key)) return
    const valid = frames.filter((f) => hasFrame(scene, f))
    if (valid.length !== frames.length) return
    anims.create({ key, frames: valid.map((f) => ({ key: ATLAS, frame: f })), frameRate, repeat })
  }
  for (const d of ['down', 'up', 'left', 'right']) {
    mk(`hero_walk_${d}`, [0, 1, 2, 3].map((i) => `hero_walk_${d}_${i}`), 8)
    mk(`hero_swing_${d}`, [`hero_swing_${d}_0`, `hero_swing_${d}_1`], 12, 0)
  }
  mk('packet', [0, 1, 2, 3].map((i) => `packet_${i}`), 6)
  mk('ripple', [0, 1, 2].map((i) => `ripple_${i}`), 10, 0)
  mk('foam', [0, 1, 2, 3].map((i) => `foam_${i}`), 5)
  mk('fish_jump', [0, 1, 2].map((i) => `fish_jump_${i}`), 8, 0)
  mk('fountain', [0, 1, 2].map((i) => `fountain_${i}`), 4)
  mk('windmill_blades', [0, 1, 2, 3].map((i) => `windmill_blades_${i}`), 6)
  // packs registered later may add their own animations via registerAnims
  for (const fn of animHooks) fn(scene, mk)
}

type Mk = (key: string, frames: string[], frameRate: number, repeat?: number) => void
const animHooks: ((scene: Phaser.Scene, mk: Mk) => void)[] = []
export function registerAnims(fn: (scene: Phaser.Scene, mk: Mk) => void): void {
  animHooks.push(fn)
}
