// A lamp post: lights up (overlay + soft light) as the day fades.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import type { DayNight } from '../systems/DayNight'

export class Lamp {
  readonly lit: Phaser.GameObjects.Image | null
  readonly glow: Phaser.GameObjects.Image | null

  constructor(scene: Phaser.Scene, x: number, y: number, dayNight: DayNight) {
    const headY = y - 32
    this.lit = hasFrame(scene, 'lamp_lit') ? scene.add.image(x, headY, ATLAS, 'lamp_lit').setDepth(y + 1).setAlpha(0) : null
    this.glow = hasFrame(scene, 'glow_warm')
      ? scene.add.image(x, headY + 2, ATLAS, 'glow_warm').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(y + 2).setScale(1.4)
      : null
    dayNight.addLight({ x, y: headY + 4, r: 44, flicker: true, color: 0xffc070 })
    dayNight.onWarmth((w) => {
      this.lit?.setAlpha(w)
      this.glow?.setAlpha(w * 0.55)
    })
  }
}
