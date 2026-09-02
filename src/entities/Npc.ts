// Villagers: idle / wander / patrol, face the player when talked to, show a
// bubble when they have something new to say.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { moveAndSlide, type Blocked, type Solid } from '../world/collision'
import type { Vec2 } from '../world/regions'
import type { Dir } from './Player'

export type NpcBehaviour = { kind: 'idle' } | { kind: 'wander'; radius: number } | { kind: 'patrol'; pts: Vec2[] }

export type NpcDef = { id: string; name: string; x: number; y: number; behaviour: NpcBehaviour; facing?: Dir }

/** Frames in the villager walk cycle: contact–down–contact–up (`npc_*_walk_{dir}_{0..3}`). */
export const NPC_WALK_FRAMES = 4
/** Milliseconds each walk frame is held. */
export const NPC_WALK_MS = 150

/**
 * Walk frame for a monotonically increasing animation tick: 0 → 1 → 2 → 3 → 0…
 * Pure (no Phaser, no state) so the cycle is unit-testable on its own.
 */
export function walkFrameIndex(tick: number): number {
  const i = Math.floor(tick) % NPC_WALK_FRAMES
  return i < 0 ? i + NPC_WALK_FRAMES : i
}

export class Npc extends Phaser.GameObjects.Container {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly shadow: Phaser.GameObjects.Image
  readonly bubble: Phaser.GameObjects.Image | null
  dir: Dir
  moving = false
  talking = false
  private target: Vec2 | null = null
  private timer = 0
  private animT = 0
  private frameIdx = 0
  private patrolIdx = 0
  readonly home: Vec2
  readonly hasArt: boolean

  constructor(
    scene: Phaser.Scene,
    readonly def: NpcDef,
  ) {
    super(scene, def.x, def.y)
    this.home = { x: def.x, y: def.y }
    this.dir = def.facing ?? 'down'
    this.hasArt = hasFrame(scene, `npc_${def.id}_idle_down`)
    this.shadow = scene.add.image(0, 1, ATLAS, 'shadow')
    this.sprite = scene.add.sprite(0, 0, ATLAS, this.hasArt ? `npc_${def.id}_idle_${this.dir}` : 'hero_idle_down')
    if (!this.hasArt) this.sprite.setTint(0xffb0b0)
    this.bubble = hasFrame(scene, 'bubble_excl') ? scene.add.image(0, -30, ATLAS, 'bubble_excl').setVisible(false) : null
    this.add([this.shadow, this.sprite])
    if (this.bubble) this.add(this.bubble)
    scene.add.existing(this)
    this.setDepth(def.y)
  }

  setBubble(kind: 'excl' | 'quest' | 'dots' | 'heart' | null): void {
    if (!this.bubble) return
    if (!kind) {
      this.bubble.setVisible(false)
      return
    }
    const fr = `bubble_${kind}`
    if (hasFrame(this.scene, fr)) this.bubble.setFrame(fr).setVisible(true)
  }

  private frame(kind: 'idle' | 'walk', dir: Dir, i = 0): string {
    if (!this.hasArt) return kind === 'idle' ? `hero_idle_${dir}` : `hero_walk_${dir}_${i}`
    return kind === 'idle' ? `npc_${this.def.id}_idle_${dir}` : `npc_${this.def.id}_walk_${dir}_${i}`
  }

  face(x: number, y: number): void {
    const dx = x - this.x
    const dy = y - this.y
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
    else this.dir = dy < 0 ? 'up' : 'down'
    this.sprite.setTexture(ATLAS, this.frame('idle', this.dir))
  }

  talkStart(px: number, py: number): void {
    this.talking = true
    this.moving = false
    this.target = null
    this.face(px, py)
    this.setBubble(null)
  }

  talkEnd(): void {
    this.talking = false
    this.timer = 1500
  }

  /**
   * Move the villager's whole life somewhere else: new home, new position, no
   * errand in hand. The guide's station changes as the story does, and this is
   * how he takes it up — only ever called while he is off-camera, so nobody
   * sees him jump.
   */
  rehome(x: number, y: number): void {
    this.home.x = x
    this.home.y = y
    this.target = null
    this.moving = false
    this.setPosition(x, y)
    this.setDepth(y)
    this.sprite.setTexture(ATLAS, this.frame('idle', this.dir))
  }

  /** Send the villager to a spot on foot. Cleared the moment he arrives. */
  walkTo(x: number, y: number): void {
    this.target = { x, y }
  }

  update(dtMs: number, blocked: Blocked, solids: Solid[]): void {
    if (this.talking) return
    const b = this.def.behaviour
    this.timer -= dtMs
    // An idle villager picks no destinations of his own — but he still walks one
    // handed to him (`walkTo`), which is how the guide leaves for his next
    // station. Without a target he only shifts his gaze.
    if (b.kind === 'idle' && !this.target) {
      if (this.timer <= 0) {
        this.timer = 3000 + Math.random() * 4000
        if (Math.random() < 0.3) {
          const dirs: Dir[] = ['down', 'left', 'right']
          this.dir = dirs[Math.floor(Math.random() * dirs.length)]
          this.sprite.setTexture(ATLAS, this.frame('idle', this.dir))
        } else {
          this.dir = this.def.facing ?? 'down'
          this.sprite.setTexture(ATLAS, this.frame('idle', this.dir))
        }
      }
      return
    }
    if (b.kind !== 'idle' && !this.target && this.timer <= 0) {
      if (b.kind === 'wander') {
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * b.radius
        this.target = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r }
      } else {
        this.patrolIdx = (this.patrolIdx + 1) % b.pts.length
        this.target = { x: b.pts[this.patrolIdx].x, y: b.pts[this.patrolIdx].y }
      }
      this.timer = 2000 + Math.random() * 3000
    }
    if (this.target) {
      const dx = this.target.x - this.x
      const dy = this.target.y - this.y
      const d = Math.hypot(dx, dy)
      if (d < 3) {
        this.target = null
        this.moving = false
        this.sprite.setTexture(ATLAS, this.frame('idle', this.dir))
        return
      }
      const speed = 38
      const dt = dtMs / 1000
      const r = moveAndSlide({ x: this.x, y: this.y, hw: 5, hh: 3 }, (dx / d) * speed * dt, (dy / d) * speed * dt, blocked, solids)
      const moved = Math.hypot(r.x - this.x, r.y - this.y)
      if (moved < 0.05) {
        this.target = null
        this.moving = false
        this.sprite.setTexture(ATLAS, this.frame('idle', this.dir))
        return
      }
      this.x = r.x
      this.y = r.y
      this.moving = true
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
      else this.dir = dy < 0 ? 'up' : 'down'
      this.animT += dtMs
      if (this.animT > NPC_WALK_MS) {
        this.animT = 0
        this.frameIdx++
      }
      // Walk the full four-frame cycle. (The idle pose is still shown whenever
      // the villager is standing still — see the `target` reset paths above.)
      this.sprite.setTexture(ATLAS, this.frame('walk', this.dir, walkFrameIndex(this.frameIdx)))
      this.setDepth(this.y)
    }
  }
}
