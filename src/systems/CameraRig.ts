// Smooth follow camera with facing look-ahead, integer zoom, shake and focus.
import Phaser from 'phaser'
import { WORLD_H, WORLD_W, pickZoom } from '../config'

export type Followable = { x: number; y: number; dir: 'down' | 'up' | 'left' | 'right'; moving: boolean }

export class CameraRig {
  readonly cam: Phaser.Cameras.Scene2D.Camera
  target: Followable | null = null
  lookahead = 22
  lerp = 0.085
  private fx = 0
  private fy = 0
  private focusTween: Phaser.Tweens.Tween | null = null
  private following = true
  private lookX = 0
  private lookY = 0
  shakeEnabled = true

  constructor(private scene: Phaser.Scene) {
    this.cam = scene.cameras.main
    this.cam.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cam.setRoundPixels(true)
    this.setZoomForViewport()
    scene.scale.on('resize', () => this.setZoomForViewport())
  }

  setZoomForViewport(): void {
    const z = pickZoom(this.scene.scale.width, this.scene.scale.height)
    if (this.cam.zoom !== z) this.cam.setZoom(z)
  }

  snapTo(x: number, y: number): void {
    this.fx = x
    this.fy = y
    this.cam.centerOn(Math.round(x), Math.round(y))
  }

  follow(t: Followable, snap = true): void {
    this.target = t
    this.following = true
    if (snap) this.snapTo(t.x, t.y - 8)
  }

  update(dt: number): void {
    if (!this.following || !this.target) return
    const t = this.target
    const lx = t.dir === 'left' ? -this.lookahead : t.dir === 'right' ? this.lookahead : 0
    const ly = t.dir === 'up' ? -this.lookahead : t.dir === 'down' ? this.lookahead : 0
    const k = t.moving ? 0.04 : 0.02
    this.lookX += (lx - this.lookX) * k
    this.lookY += (ly - this.lookY) * k
    const dx = t.x + this.lookX
    const dy = t.y - 8 + this.lookY
    const f = 1 - Math.pow(1 - this.lerp, dt * 60)
    this.fx += (dx - this.fx) * f
    this.fy += (dy - this.fy) * f
    this.cam.centerOn(Math.round(this.fx), Math.round(this.fy))
  }

  shake(intensity = 0.004, ms = 160): void {
    if (!this.shakeEnabled) return
    this.cam.shake(ms, intensity)
  }

  punchZoom(amount = 0.06, ms = 220): void {
    const base = pickZoom(this.scene.scale.width, this.scene.scale.height)
    this.scene.tweens.add({ targets: this.cam, zoom: base * (1 + amount), duration: ms / 2, yoyo: true, ease: 'Sine.out', onComplete: () => this.cam.setZoom(base) })
  }

  /** Pan to a point (stops following). Resolves when there. */
  focus(x: number, y: number, ms = 900): Promise<void> {
    this.following = false
    this.focusTween?.stop()
    return new Promise((resolve) => {
      const start = { x: this.fx, y: this.fy }
      this.focusTween = this.scene.tweens.add({
        targets: start,
        x,
        y,
        duration: ms,
        ease: 'Sine.inOut',
        onUpdate: () => {
          this.fx = start.x
          this.fy = start.y
          this.cam.centerOn(Math.round(this.fx), Math.round(this.fy))
        },
        onComplete: () => resolve(),
      })
    })
  }

  release(): void {
    this.focusTween?.stop()
    this.following = true
  }

  /** Attract-mode drift along waypoints (title screen). */
  drift(points: { x: number; y: number }[], msPerLeg = 9000): () => void {
    this.following = false
    let i = 0
    let alive = true
    const leg = () => {
      if (!alive) return
      const p = points[i % points.length]
      i++
      this.focus(p.x, p.y, msPerLeg).then(() => {
        if (alive) leg()
      })
    }
    this.snapTo(points[0].x, points[0].y)
    i = 1
    leg()
    return () => {
      alive = false
      this.focusTween?.stop()
    }
  }

  get view(): Phaser.Geom.Rectangle {
    return this.cam.worldView
  }
}
