// Day/night: advances time, colour-grades the world, and lays a darkness veil
// with additive light pools (simple, reliable primitives — no render textures).
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { DAY_LENGTH, ambientAt, daylight, phaseAt, wrap, type Phase } from '../core/time'

export type Light = { x: number; y: number; r: number; color?: number; flicker?: boolean; on?: () => boolean }

type LightSprite = { light: Light; img: Phaser.GameObjects.Image | null }

export class DayNight {
  time: number
  speed = 1
  private veil: Phaser.GameObjects.Rectangle
  private lights: LightSprite[] = []
  private tinted: Phaser.GameObjects.Components.Tint[] = []
  private lastTint = -1
  private warmthSubs: ((w: number) => void)[] = []
  private stars: Phaser.GameObjects.Image[] = []
  private extraDark = 0
  private accum = 0
  private lastPhase: Phase | null = null
  onPhase: ((p: Phase) => void) | null = null
  ambient = ambientAt(60)

  constructor(
    private scene: Phaser.Scene,
    time: number,
    private reduced: boolean,
  ) {
    this.time = time
    this.veil = scene.add.rectangle(0, 0, 64, 64, 0x0b1030, 1).setOrigin(0).setDepth(90000).setAlpha(0)
    this.lastPhase = phaseAt(time)
  }

  /** Extra darkness (rain) 0..0.3 */
  setExtraDark(v: number): void {
    this.extraDark = v
  }

  addLight(l: Light): Light {
    let img: Phaser.GameObjects.Image | null = null
    if (hasFrame(this.scene, 'light_soft')) {
      img = this.scene.add
        .image(l.x, l.y, ATLAS, 'light_soft')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(90500)
        .setScale((l.r * 2) / 64)
        .setTint(l.color ?? 0xffc584)
        .setAlpha(0)
    }
    this.lights.push({ light: l, img })
    return l
  }

  removeLight(l: Light): void {
    const i = this.lights.findIndex((x) => x.light === l)
    if (i >= 0) {
      this.lights[i].img?.destroy()
      this.lights.splice(i, 1)
    }
  }

  onWarmth(fn: (w: number) => void): void {
    this.warmthSubs.push(fn)
  }

  registerTinted(objs: Phaser.GameObjects.Components.Tint[]): void {
    this.tinted.push(...objs)
  }

  placeStars(points: { x: number; y: number }[]): void {
    if (!hasFrame(this.scene, 'star')) return
    for (const p of points) {
      const s = this.scene.add.image(p.x, p.y, ATLAS, 'star').setDepth(-9000).setAlpha(0)
      s.setData('phase', Math.random() * Math.PI * 2)
      this.stars.push(s)
    }
  }

  get isNight(): boolean {
    return daylight(this.time) < 0.35
  }

  get phase(): Phase {
    return phaseAt(this.time)
  }

  setTime(t: number): void {
    this.time = wrap(t)
    this.lastTint = -1
  }

  /** Fast-forward to morning (t=60) or night (t=350). */
  skipTo(to: 'morning' | 'night'): void {
    this.setTime(to === 'morning' ? 60 : 350)
  }

  update(dtSeconds: number, dtMs: number): void {
    this.time = wrap(this.time + dtSeconds * this.speed)
    const phase = phaseAt(this.time)
    if (phase !== this.lastPhase) {
      this.lastPhase = phase
      this.onPhase?.(phase)
    }
    const amb = ambientAt(this.time)
    this.ambient = amb
    const dark = Math.min(0.85, amb.darkness + this.extraDark)

    // tints + warmth subscribers at ~4 Hz
    this.accum += dtMs
    if (this.accum > 250 || this.lastTint < 0) {
      this.accum = 0
      let tint = amb.tint
      if (this.extraDark > 0) tint = Phaser.Display.Color.ValueToColor(tint).darken(Math.round(this.extraDark * 40)).color
      if (tint !== this.lastTint) {
        this.lastTint = tint
        for (const o of this.tinted) o.setTint(tint)
      }
      for (const fn of this.warmthSubs) fn(amb.warmth)
    }

    // darkness veil follows the camera view (world-space, zoom-agnostic)
    const view = this.scene.cameras.main.worldView
    this.veil.setPosition(Math.floor(view.x) - 2, Math.floor(view.y) - 2)
    this.veil.setSize(Math.ceil(view.width) + 4, Math.ceil(view.height) + 4)
    this.veil.setAlpha(dark * 0.82)

    // light pools
    const t = this.scene.time.now
    const inView = (x: number, y: number, r: number) => x + r > view.x && x - r < view.right && y + r > view.y && y - r < view.bottom
    for (const { light: l, img } of this.lights) {
      if (!img) continue
      if ((l.on && !l.on()) || amb.warmth <= 0.02 || !inView(l.x, l.y, l.r)) {
        img.setAlpha(0)
        continue
      }
      const flick = l.flicker && !this.reduced ? 1 + Math.sin(t * 0.011 + l.x) * 0.06 + Math.sin(t * 0.023 + l.y) * 0.05 : 1
      img.setAlpha(Math.min(1, amb.warmth * 0.6 * flick) * Math.min(1, dark * 1.6 + 0.25))
      img.setScale(((l.r * 2) / 64) * flick)
    }

    // stars
    if (this.stars.length) {
      const a = Math.max(0, (dark - 0.35) / 0.4)
      const st = t * 0.002
      for (const s of this.stars) s.setAlpha(a * (0.55 + 0.45 * Math.sin(st + (s.getData('phase') as number))))
    }
  }

  get dayFraction(): number {
    return this.time / DAY_LENGTH
  }
}
