// Shore foam, sun sparkles, the Stream's flowing motes and cloud shadows.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { TILE } from '../config'
import type { Rng } from '../core/rng'
import type { Vec2 } from '../world/regions'
import { T, isWater, type Grid } from '../world/terrain'

export class Water {
  private foam: Phaser.GameObjects.Image[] = []
  private foamFrame = 0
  private foamTimer = 0
  private motes: { img: Phaser.GameObjects.Image; t: number; speed: number; off: number }[] = []
  private riverLen = 0
  private riverPts: { x: number; y: number; d: number }[] = []
  private clouds: Phaser.GameObjects.Image[] = []
  private sparkles: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private sparkleTimer = 0

  constructor(
    private scene: Phaser.Scene,
    private grid: Grid,
    river: Vec2[],
    rng: Rng,
    private reduced: boolean,
  ) {
    this.buildFoam()
    this.buildRiver(river)
    this.buildMotes(rng)
    this.buildClouds(rng)
    if (hasFrame(scene, 'spark') && !reduced) {
      this.sparkles = scene.add
        .particles(0, 0, ATLAS, { frame: 'spark', lifespan: 600, scale: { start: 0.9, end: 0 }, alpha: { start: 0.9, end: 0 }, quantity: 1, frequency: -1 })
        .setDepth(-9500)
    }
  }

  private buildFoam() {
    if (!hasFrame(this.scene, 'foam_0')) return
    const g = this.grid
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (g.get(x, y) !== T.SHALLOW) continue
        const px = x * TILE + 8
        const py = y * TILE + 8
        const sides: [number, number, number][] = [
          [0, -1, 0],
          [1, 0, 90],
          [0, 1, 180],
          [-1, 0, 270],
        ]
        let n = 0
        for (const [dx, dy, ang] of sides) {
          if (!g.inb(x + dx, y + dy)) continue
          const t = g.get(x + dx, y + dy)
          if (isWater(t) || t === T.DOCK) continue
          if (n++ >= 2) break
          const img = this.scene.add.image(px, py, ATLAS, 'foam_0').setAngle(ang).setDepth(-9800).setAlpha(0.85)
          this.foam.push(img)
        }
      }
  }

  private buildRiver(river: Vec2[]) {
    let d = 0
    for (let i = 0; i < river.length; i++) {
      const p = { x: river[i].x * TILE + 8, y: river[i].y * TILE + 8 }
      if (i > 0) d += Math.hypot(p.x - this.riverPts[i - 1].x, p.y - this.riverPts[i - 1].y)
      this.riverPts.push({ ...p, d })
    }
    this.riverLen = d
  }

  private pointAt(dist: number): { x: number; y: number } {
    const pts = this.riverPts
    for (let i = 1; i < pts.length; i++) {
      if (dist <= pts[i].d) {
        const a = pts[i - 1]
        const b = pts[i]
        const f = (dist - a.d) / Math.max(1, b.d - a.d)
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
      }
    }
    const l = pts[pts.length - 1]
    return { x: l.x, y: l.y }
  }

  private buildMotes(rng: Rng) {
    if (!hasFrame(this.scene, 'mote') || this.riverLen === 0) return
    for (let i = 0; i < 44; i++) {
      const img = this.scene.add.image(0, 0, ATLAS, 'mote').setBlendMode(Phaser.BlendModes.ADD).setDepth(-9700).setAlpha(0.7)
      this.motes.push({ img, t: rng.next() * this.riverLen, speed: 20 + rng.next() * 14, off: rng.range(-10, 10) })
    }
  }

  private buildClouds(rng: Rng) {
    if (!hasFrame(this.scene, 'cloud_shadow')) return
    for (let i = 0; i < 7; i++) {
      const c = this.scene.add
        .image(rng.range(0, this.grid.w * TILE), rng.range(0, this.grid.h * TILE), ATLAS, 'cloud_shadow')
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setAlpha(0.42)
        .setScale(rng.range(1.6, 2.6), rng.range(1.2, 1.8))
        .setDepth(80000)
      c.setData('vx', rng.range(5, 9))
      c.setData('vy', rng.range(1, 3))
      this.clouds.push(c)
    }
  }

  update(dtMs: number, view: Phaser.Geom.Rectangle, daylight: number, darkness: number): void {
    // foam animation (visible only)
    this.foamTimer += dtMs
    if (this.foamTimer > 210) {
      this.foamTimer = 0
      this.foamFrame = (this.foamFrame + 1) % 4
      const fr = `foam_${this.foamFrame}`
      const l = view.x - 16
      const r = view.right + 16
      const t = view.y - 16
      const b = view.bottom + 16
      for (const f of this.foam) if (f.x > l && f.x < r && f.y > t && f.y < b) f.setFrame(fr)
    }
    // motes flow along the stream
    const dt = dtMs / 1000
    const moteAlpha = 0.45 + darkness * 0.55
    for (const m of this.motes) {
      m.t += m.speed * dt
      if (m.t > this.riverLen) m.t -= this.riverLen
      const p = this.pointAt(m.t)
      const wob = Math.sin(m.t * 0.05 + m.off) * 6
      m.img.setPosition(p.x + wob, p.y + m.off * 0.6).setAlpha(moteAlpha)
    }
    // clouds drift
    if (!this.reduced) {
      const W = this.grid.w * TILE
      const H = this.grid.h * TILE
      for (const c of this.clouds) {
        c.x += (c.getData('vx') as number) * dt
        c.y += (c.getData('vy') as number) * dt
        if (c.x > W + 200) c.x = -200
        if (c.y > H + 150) c.y = -150
        c.setAlpha(0.42 * daylight)
      }
    }
    // sparkles at high sun over water in view
    if (this.sparkles && daylight > 0.85) {
      this.sparkleTimer -= dtMs
      if (this.sparkleTimer <= 0) {
        this.sparkleTimer = 120
        const x = view.x + Math.random() * view.width
        const y = view.y + Math.random() * view.height
        const tx = Math.floor(x / TILE)
        const ty = Math.floor(y / TILE)
        if (this.grid.inb(tx, ty) && isWater(this.grid.get(tx, ty))) this.sparkles.emitParticleAt(x, y, 1)
      }
    }
  }
}
