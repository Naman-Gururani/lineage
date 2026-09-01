// Wind: a travelling gust field that sways trees, plus leaves in the woods.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'

export class Wind {
  strength = 0.3
  phase = 0
  private trees: Phaser.GameObjects.Image[] = []
  private leaves: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private leafTimer = 0

  constructor(
    private scene: Phaser.Scene,
    private reduced: boolean,
  ) {
    if (hasFrame(scene, 'leaf') && !reduced) {
      this.leaves = scene.add
        .particles(0, 0, ATLAS, {
          frame: 'leaf',
          lifespan: { min: 1800, max: 3200 },
          speedX: { min: 20, max: 60 },
          speedY: { min: -6, max: 18 },
          rotate: { start: 0, end: 360 },
          alpha: { start: 1, end: 0 },
          quantity: 1,
          frequency: -1,
        })
        .setDepth(70000)
    }
  }

  registerTree(img: Phaser.GameObjects.Image): void {
    this.trees.push(img)
  }

  update(dtMs: number, view: Phaser.Geom.Rectangle, inWoods: boolean): void {
    this.phase += dtMs * 0.0022 * (0.6 + this.strength)
    if (this.reduced) return
    const amp = 0.012 + this.strength * 0.022
    const t = this.phase
    for (const tr of this.trees) {
      if (!tr.visible) continue
      tr.scaleX = (tr.flipX ? -1 : 1) * (1 + Math.sin(t + tr.x * 0.02 + tr.y * 0.01) * amp)
    }
    if (this.leaves && inWoods && this.strength > 0.5) {
      this.leafTimer -= dtMs
      if (this.leafTimer <= 0) {
        this.leafTimer = 260 / this.strength
        this.leaves.emitParticleAt(view.x + Math.random() * view.width, view.y + Math.random() * view.height, 1)
      }
    }
  }
}
