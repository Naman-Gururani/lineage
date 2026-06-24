import Phaser from 'phaser'
import { generateAssets } from '../game/art'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create() {
    generateAssets(this)

    this.anims.create({
      key: 'walk_down',
      frames: [{ key: 'hero_down_0' }, { key: 'hero_down_1' }],
      frameRate: 7,
      repeat: -1,
    })
    this.anims.create({
      key: 'walk_up',
      frames: [{ key: 'hero_up_0' }, { key: 'hero_up_1' }],
      frameRate: 7,
      repeat: -1,
    })
    this.anims.create({
      key: 'walk_side',
      frames: [{ key: 'hero_side_0' }, { key: 'hero_side_1' }],
      frameRate: 7,
      repeat: -1,
    })

    this.scene.start('world')
  }
}
