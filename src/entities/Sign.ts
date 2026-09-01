// Finger posts: readable with E, bonk-able with a swing.
import Phaser from 'phaser'
import type { SignDef } from '../data/signs'
import type { Interactable } from '../systems/Interact'

/** The `sign_finger` sprite is 40×56 anchored at its base, arms and all. */
const HALF_W = 18
const TOP = 52
const FOOT = 4

export class Sign {
  readonly interactable: Interactable
  private wobbling = false

  constructor(
    readonly scene: Phaser.Scene,
    readonly sprite: Phaser.GameObjects.Image,
    readonly def: SignDef,
    onRead: (id: string) => void,
  ) {
    this.interactable = {
      x: sprite.x,
      y: sprite.y,
      radius: 24,
      prompt: 'Read the sign',
      onInteract: () => onRead(def.id),
      priority: 1,
    }
  }

  get id(): string {
    return this.def.id
  }

  /** True when a swing at `px,py` lands anywhere on the post or its arms. */
  hit(px: number, py: number): boolean {
    const dy = this.sprite.y - py
    return Math.abs(px - this.sprite.x) <= HALF_W && dy >= FOOT && dy <= TOP
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
