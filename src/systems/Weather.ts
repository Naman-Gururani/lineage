// Weather: clear / breezy / rain. Rain = particles over the view, puddle
// ripples, darker ambient and a wind boost. Rolls once per day at dawn.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import type { Rng } from '../core/rng'
import { isLand, type Grid } from '../world/terrain'
import { TILE } from '../config'

export type WeatherState = 'clear' | 'breezy' | 'rain'

export class Weather {
  state: WeatherState = 'clear'
  private rain: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private rippleTimer = 0
  private zone: Phaser.Geom.Rectangle
  private intensity = 0
  onChange: ((s: WeatherState) => void) | null = null

  constructor(
    private scene: Phaser.Scene,
    private grid: Grid,
    private rng: Rng,
    private reduced: boolean,
    initial: WeatherState = 'clear',
  ) {
    this.zone = new Phaser.Geom.Rectangle(0, 0, 100, 100)
    if (hasFrame(scene, 'rain') && !reduced) {
      this.rain = scene.add
        .particles(0, 0, ATLAS, {
          frame: 'rain',
          lifespan: 900,
          speedY: { min: 240, max: 320 },
          speedX: { min: -60, max: -30 },
          quantity: 0,
          frequency: 16,
          alpha: { start: 0.9, end: 0.4 },
          emitZone: { type: 'random', source: this.zone as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
        })
        .setDepth(85000)
      this.rain.stop()
    }
    this.set(initial, true)
  }

  /** Roll the day's weather. */
  roll(): void {
    const r = this.rng.next()
    this.set(r < 0.55 ? 'clear' : r < 0.8 ? 'breezy' : 'rain')
  }

  set(s: WeatherState, instant = false): void {
    if (s === this.state && !instant) return
    this.state = s
    if (this.rain) {
      if (s === 'rain') {
        this.rain.start()
        this.rain.quantity = 3 as unknown as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType
      } else this.rain.stop()
    }
    this.onChange?.(s)
  }

  /** 0..1 how rainy it looks right now (smoothed) */
  get rainAmount(): number {
    return this.intensity
  }

  get windStrength(): number {
    return this.state === 'rain' ? 1 : this.state === 'breezy' ? 0.7 : 0.3
  }

  update(dtMs: number): void {
    const target = this.state === 'rain' ? 1 : 0
    this.intensity += (target - this.intensity) * Math.min(1, dtMs / 1500)
    const cam = this.scene.cameras.main
    const v = cam.worldView
    this.zone.setTo(v.x - 40, v.y - 60, v.width + 120, 40)
    if (this.state !== 'rain' || this.reduced || !hasFrame(this.scene, 'ripple_0')) return
    this.rippleTimer -= dtMs
    if (this.rippleTimer > 0) return
    this.rippleTimer = 90
    for (let i = 0; i < 2; i++) {
      const x = v.x + this.rng.next() * v.width
      const y = v.y + this.rng.next() * v.height
      const t = this.grid.get(Math.floor(x / TILE), Math.floor(y / TILE))
      if (!this.grid.inb(Math.floor(x / TILE), Math.floor(y / TILE)) || !isLand(t)) continue
      const r = this.scene.add.sprite(x, y, ATLAS, 'ripple_0').setDepth(y - 3999).setAlpha(0.7)
      r.play('ripple')
      r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy())
    }
  }
}
