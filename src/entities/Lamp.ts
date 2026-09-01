// A lamp post: lights up (overlay + soft light) as the day fades.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import type { DayNight } from '../systems/DayNight'

export class Lamp {
  readonly lit: Phaser.GameObjects.Image | null
  readonly glow: Phaser.GameObjects.Image | null

  constructor(scene: Phaser.Scene, x: number, y: number, dayNight: DayNight) {
    // Centre of the glass pane on the 80px lamp (32×80, anchored [16, 74]):
    // the pane runs rows 7..17, so its middle sits 62px above the footing.
    const headY = y - 62
    this.lit = hasFrame(scene, 'lamp_lit') ? scene.add.image(x, headY, ATLAS, 'lamp_lit').setDepth(y + 1).setAlpha(0) : null
    // the halo hangs just under the pane, sized to the taller lantern
    this.glow = hasFrame(scene, 'glow_warm')
      ? scene.add.image(x, headY + 3, ATLAS, 'glow_warm').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(y + 2).setScale(1.6)
      : null
    // the warm pool stays low enough to reach the ground the post stands on
    dayNight.addLight({ x, y: headY + 30, r: 54, flicker: true, color: 0xffc070 })
    dayNight.onWarmth((w) => {
      this.lit?.setAlpha(w)
      this.glow?.setAlpha(w * 0.55)
    })
  }
}
