// Tall grass: sways in the wind, can be cut with a swing, regrows later.
import Phaser from 'phaser'
import { ATLAS } from '../art/atlas'

export class Grass {
  readonly sprite: Phaser.GameObjects.Image
  cut = false
  private regrowAt = 0

  constructor(
    readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly v: number,
  ) {
    this.sprite = scene.add.image(x, y, ATLAS, 'grass_tall_0').setDepth(y - 4000)
  }

  /** hit test against a point (the swing point) */
  hit(px: number, py: number): boolean {
    return !this.cut && Math.abs(px - this.x) < 12 && Math.abs(py - (this.y - 5)) < 10
  }

  doCut(now: number): void {
    this.cut = true
    this.regrowAt = now + 90000
    this.sprite.setVisible(false)
  }

  update(now: number, windPhase: number): void {
    if (this.cut) {
      if (now >= this.regrowAt) {
        this.cut = false
        this.sprite.setVisible(true).setScale(0.4)
        this.scene.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.out' })
      }
      return
    }
    if (!this.sprite.visible) return
    const f = Math.sin(windPhase + this.x * 0.045 + this.v) > 0.15 ? 1 : 0
    this.sprite.setFrame(`grass_tall_${f}`)
  }
}
