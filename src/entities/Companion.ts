// Byte the cat: follows the hero along their trail, sits when bored.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import type { Dir } from './Player'

export class Companion extends Phaser.GameObjects.Container {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly shadow: Phaser.GameObjects.Image
  private trail: { x: number; y: number }[] = []
  private idleMs = 0
  private animT = 0
  private frameIdx = 0
  dir: Dir = 'down'
  readonly hasArt: boolean

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    this.hasArt = hasFrame(scene, 'cat_idle_down')
    this.shadow = scene.add.image(0, 1, ATLAS, 'shadow').setScale(0.8, 0.7)
    this.sprite = scene.add.sprite(0, 0, ATLAS, this.hasArt ? 'cat_idle_down' : 'hero_idle_down')
    if (!this.hasArt) this.sprite.setScale(0.6).setTint(0x9fd8d0)
    this.add([this.shadow, this.sprite])
    scene.add.existing(this)
    this.setDepth(y)
  }

  private frame(kind: 'idle' | 'walk' | 'sit', dir: Dir, i = 0): string {
    if (!this.hasArt) return kind === 'walk' ? `hero_walk_${dir}_${i}` : `hero_idle_${dir}`
    if (kind === 'sit') return 'cat_sit'
    return kind === 'idle' ? `cat_idle_${dir}` : `cat_walk_${dir}_${i}`
  }

  update(dtMs: number, target: { x: number; y: number; moving: boolean }): void {
    // record the hero's trail
    const last = this.trail[this.trail.length - 1]
    if (!last || Math.hypot(last.x - target.x, last.y - target.y) > 4) this.trail.push({ x: target.x, y: target.y })
    while (this.trail.length > 40) this.trail.shift()
    // the cat aims at a point ~26px back along the trail
    let goal = { x: target.x, y: target.y }
    let acc = 0
    for (let i = this.trail.length - 1; i > 0; i--) {
      acc += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y)
      if (acc >= 26) {
        goal = this.trail[i - 1]
        break
      }
    }
    const dx = goal.x - this.x
    const dy = goal.y - this.y
    const d = Math.hypot(dx, dy)
    if (d > 6) {
      this.idleMs = 0
      const speed = Math.min(150, 60 + d * 2)
      const step = Math.min(d, speed * (dtMs / 1000))
      this.x += (dx / d) * step
      this.y += (dy / d) * step
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
      else this.dir = dy < 0 ? 'up' : 'down'
      this.animT += dtMs
      if (this.animT > 140) {
        this.animT = 0
        this.frameIdx = (this.frameIdx + 1) % 4
      }
      const f = this.frameIdx
      this.sprite.setTexture(ATLAS, f === 1 || f === 3 ? this.frame('idle', this.dir) : this.frame('walk', this.dir, f === 0 ? 0 : 1))
      this.setDepth(this.y)
    } else {
      this.idleMs += dtMs
      this.sprite.setTexture(ATLAS, this.idleMs > 3000 ? this.frame('sit', this.dir) : this.frame('idle', this.dir))
    }
  }
}
