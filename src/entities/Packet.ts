// A lost packet: a bobbing, pulsing collectible.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'

export class Packet {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly glow: Phaser.GameObjects.Image | null
  collected = false

  constructor(
    readonly scene: Phaser.Scene,
    readonly id: string,
    readonly x: number,
    readonly y: number,
    reduced: boolean,
  ) {
    this.sprite = scene.add.sprite(x, y - 6, ATLAS, 'packet_0').setDepth(y)
    if (scene.anims.exists('packet')) this.sprite.play('packet')
    this.glow = hasFrame(scene, 'glow_cool') ? scene.add.image(x, y - 6, ATLAS, 'glow_cool').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(y - 1) : null
    if (!reduced) {
      scene.tweens.add({ targets: [this.sprite, this.glow].filter(Boolean), y: y - 11, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      if (this.glow) scene.tweens.add({ targets: this.glow, alpha: 0.6, scale: 1.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
  }

  near(px: number, py: number, r = 16): boolean {
    return !this.collected && Math.hypot(px - this.x, py - (this.y - 6)) < r
  }

  collect(): void {
    if (this.collected) return
    this.collected = true
    this.scene.tweens.killTweensOf([this.sprite, this.glow].filter(Boolean))
    this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 18, scale: 1.6, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: () => this.sprite.destroy() })
    if (this.glow) this.scene.tweens.add({ targets: this.glow, scale: 3, alpha: 0, duration: 320, onComplete: () => this.glow?.destroy() })
  }

  destroy(): void {
    this.sprite.destroy()
    this.glow?.destroy()
  }
}
