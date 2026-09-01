// Signposts: readable with E, bonk-able with a swing.
import Phaser from 'phaser'
import type { Interactable } from '../systems/Interact'

export class Sign {
  readonly interactable: Interactable
  private wobbling = false

  constructor(
    readonly scene: Phaser.Scene,
    readonly sprite: Phaser.GameObjects.Image,
    readonly id: string,
    onRead: () => void,
  ) {
    this.interactable = {
      x: sprite.x,
      y: sprite.y,
      radius: 22,
      prompt: 'Read sign',
      onInteract: onRead,
      priority: 1,
    }
  }

  hit(px: number, py: number): boolean {
    return Math.abs(px - this.sprite.x) < 12 && Math.abs(py - (this.sprite.y - 10)) < 16
  }

  bonk(): void {
    if (this.wobbling) return
    this.wobbling = true
    const s = this.sprite
    this.scene.tweens.add({
      targets: s,
      angle: { from: -8, to: 8 },
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
      onComplete: () => {
        s.setAngle(0)
        this.wobbling = false
      },
    })
  }
}
