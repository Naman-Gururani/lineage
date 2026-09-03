import Phaser from 'phaser'
import { ATLAS } from '../art/atlas'
import type { Interactable } from '../systems/Interact'

export class Chest {
  readonly sprite: Phaser.GameObjects.Image
  readonly interactable: Interactable
  opened: boolean

  constructor(
    readonly scene: Phaser.Scene,
    readonly id: string,
    readonly x: number,
    readonly y: number,
    opened: boolean,
    onOpen: (c: Chest) => void,
  ) {
    this.opened = opened
    this.sprite = scene.add.image(x, y, ATLAS, opened ? 'chest_open' : 'chest_closed').setDepth(y)
    this.interactable = {
      x,
      y,
      radius: 22,
      prompt: 'Open the prize box',
      enabled: () => !this.opened,
      onInteract: () => {
        if (this.opened) return
        this.opened = true
        this.sprite.setFrame('chest_open')
        scene.tweens.add({ targets: this.sprite, scaleY: 0.85, scaleX: 1.15, duration: 90, yoyo: true })
        onOpen(this)
      },
      priority: 1,
    }
  }
}
