// Ambient life near the camera: butterflies, gulls, crabs, fireflies, fish.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { TILE } from '../config'
import type { Rng } from '../core/rng'
import { T, isWater, type Grid } from '../world/terrain'

type Butterfly = { img: Phaser.GameObjects.Image; ax: number; ay: number; t: number; speed: number; frameT: number }
type Crab = { img: Phaser.GameObjects.Image; vx: number; timer: number; frameT: number; hide: number }
type Firefly = { img: Phaser.GameObjects.Image; ax: number; ay: number; t: number; phase: number }
type Gull = { img: Phaser.GameObjects.Image; vx: number; vy: number; frameT: number }

export class Critters {
  private butterflies: Butterfly[] = []
  private crabs: Crab[] = []
  private fireflies: Firefly[] = []
  private gulls: Gull[] = []
  private gullTimer = 12000
  private fishTimer = 5000
  private flowerSpots: { x: number; y: number }[] = []
  private sandSpots: { x: number; y: number }[] = []
  private woodsSpots: { x: number; y: number }[] = []
  onGull: (() => void) | null = null

  constructor(
    private scene: Phaser.Scene,
    private grid: Grid,
    private rng: Rng,
    flowers: { x: number; y: number }[],
    woods: { x: number; y: number }[],
    private reduced: boolean,
  ) {
    this.flowerSpots = flowers
    this.woodsSpots = woods
    for (let y = 0; y < grid.h; y++)
      for (let x = 0; x < grid.w; x++) {
        if (grid.get(x, y) !== T.SAND) continue
        if (x > 60 && x < 100 && y > 95 && rng.chance(0.08)) this.sandSpots.push({ x: x * TILE + 8, y: y * TILE + 8 })
      }
    this.spawnCrabs()
  }

  private spawnCrabs() {
    if (!hasFrame(this.scene, 'crab_0')) return
    const spots = this.rng.shuffle([...this.sandSpots]).slice(0, 7)
    for (const s of spots) {
      const img = this.scene.add.image(s.x, s.y, ATLAS, 'crab_0').setDepth(s.y - 3990)
      this.crabs.push({ img, vx: 0, timer: this.rng.range(500, 2500), frameT: 0, hide: 0 })
    }
  }

  update(dtMs: number, view: Phaser.Geom.Rectangle, daylight: number, darkness: number, player: { x: number; y: number }, inWoods: boolean, nearCoast: boolean): void {
    const dt = dtMs / 1000
    const inView = (x: number, y: number, pad = 40) => x > view.x - pad && x < view.right + pad && y > view.y - pad && y < view.bottom + pad

    // ---- butterflies (day, near flowers in view) ----
    if (hasFrame(this.scene, 'butterfly_0')) {
      const want = daylight > 0.5 && !this.reduced ? 6 : 0
      if (this.butterflies.length < want) {
        const candidates = this.flowerSpots.filter((f) => inView(f.x, f.y, -20))
        if (candidates.length) {
          const f = this.rng.pick(candidates)
          const blue = this.rng.chance(0.3) && hasFrame(this.scene, 'butterfly_blue_0')
          const img = this.scene.add.image(f.x, f.y - 10, ATLAS, blue ? 'butterfly_blue_0' : 'butterfly_0').setDepth(60000)
          img.setData('blue', blue)
          this.butterflies.push({ img, ax: f.x, ay: f.y - 10, t: this.rng.range(0, 100), speed: this.rng.range(0.8, 1.4), frameT: 0 })
        }
      }
      for (let i = this.butterflies.length - 1; i >= 0; i--) {
        const b = this.butterflies[i]
        b.t += dt * b.speed
        b.img.x = b.ax + Math.sin(b.t * 1.3) * 22 + Math.sin(b.t * 0.4) * 10
        b.img.y = b.ay + Math.sin(b.t * 2.1) * 8 + Math.cos(b.t * 0.7) * 6
        b.frameT += dtMs
        if (b.frameT > 90) {
          b.frameT = 0
          const blue = b.img.getData('blue') as boolean
          const cur = b.img.frame.name.endsWith('_0') ? 1 : 0
          b.img.setFrame(`${blue ? 'butterfly_blue' : 'butterfly'}_${cur}`)
        }
        b.img.setFlipX(Math.cos(b.t * 1.3) < 0)
        if (!inView(b.img.x, b.img.y, 80) || daylight < 0.4) {
          b.img.destroy()
          this.butterflies.splice(i, 1)
        }
      }
    }

    // ---- crabs ----
    for (const c of this.crabs) {
      if (!inView(c.img.x, c.img.y, 60)) continue
      const near = Math.hypot(player.x - c.img.x, player.y - c.img.y) < 30
      c.timer -= dtMs
      if (near) {
        c.vx = (c.img.x < player.x ? -1 : 1) * 45
        c.timer = 400
      } else if (c.timer <= 0) {
        c.timer = this.rng.range(600, 2400)
        c.vx = this.rng.chance(0.5) ? 0 : this.rng.pick([-18, 18])
      }
      if (c.vx !== 0) {
        const nx = c.img.x + c.vx * dt
        const t = this.grid.get(Math.floor(nx / TILE), Math.floor(c.img.y / TILE))
        if (t === T.SAND) c.img.x = nx
        else c.vx = -c.vx
        c.frameT += dtMs
        if (c.frameT > 110) {
          c.frameT = 0
          c.img.setFrame(c.img.frame.name === 'crab_0' ? 'crab_1' : 'crab_0')
        }
      }
    }

    // ---- fireflies (night, woods) ----
    if (hasFrame(this.scene, 'firefly')) {
      const want = darkness > 0.3 && inWoods && !this.reduced ? 18 : 0
      if (this.fireflies.length < want) {
        const candidates = this.woodsSpots.filter((f) => inView(f.x, f.y, -10))
        if (candidates.length) {
          const f = this.rng.pick(candidates)
          const img = this.scene.add.image(f.x, f.y - 12, ATLAS, 'firefly').setBlendMode(Phaser.BlendModes.ADD).setDepth(60001)
          this.fireflies.push({ img, ax: f.x, ay: f.y - 12, t: this.rng.range(0, 100), phase: this.rng.range(0, 6) })
        }
      }
      for (let i = this.fireflies.length - 1; i >= 0; i--) {
        const f = this.fireflies[i]
        f.t += dt
        f.img.x = f.ax + Math.sin(f.t * 0.9 + f.phase) * 18
        f.img.y = f.ay + Math.cos(f.t * 1.3 + f.phase) * 10
        f.img.setAlpha(0.35 + 0.65 * Math.max(0, Math.sin(f.t * 2.2 + f.phase)))
        if (!inView(f.img.x, f.img.y, 80) || want === 0) {
          f.img.destroy()
          this.fireflies.splice(i, 1)
        }
      }
    }

    // ---- gulls (fly-bys near the coast, daytime) ----
    if (hasFrame(this.scene, 'gull_0') && !this.reduced) {
      this.gullTimer -= dtMs
      if (this.gullTimer <= 0 && nearCoast && daylight > 0.3) {
        this.gullTimer = this.rng.range(14000, 30000)
        const fromLeft = this.rng.chance(0.5)
        const x = fromLeft ? view.x - 30 : view.right + 30
        const y = view.y + this.rng.range(20, view.height * 0.6)
        const img = this.scene.add.image(x, y, ATLAS, 'gull_0').setDepth(95000).setFlipX(!fromLeft)
        this.gulls.push({ img, vx: (fromLeft ? 1 : -1) * this.rng.range(55, 80), vy: this.rng.range(-6, 6), frameT: 0 })
        this.onGull?.()
      }
      for (let i = this.gulls.length - 1; i >= 0; i--) {
        const g = this.gulls[i]
        g.img.x += g.vx * dt
        g.img.y += g.vy * dt + Math.sin(g.img.x * 0.05) * 0.3
        g.frameT += dtMs
        if (g.frameT > 160) {
          g.frameT = 0
          g.img.setFrame(g.img.frame.name === 'gull_0' ? 'gull_1' : 'gull_0')
        }
        if (!inView(g.img.x, g.img.y, 120)) {
          g.img.destroy()
          this.gulls.splice(i, 1)
        }
      }
    }

    // ---- fish jumps ----
    if (hasFrame(this.scene, 'fish_jump_0') && !this.reduced) {
      this.fishTimer -= dtMs
      if (this.fishTimer <= 0) {
        this.fishTimer = this.rng.range(6000, 14000)
        for (let tries = 0; tries < 12; tries++) {
          const x = view.x + this.rng.next() * view.width
          const y = view.y + this.rng.next() * view.height
          const tx = Math.floor(x / TILE)
          const ty = Math.floor(y / TILE)
          if (!this.grid.inb(tx, ty)) continue
          const t = this.grid.get(tx, ty)
          if (t !== T.POND && t !== T.WATER && t !== T.SHALLOW) continue
          const s = this.scene.add.sprite(x, y, ATLAS, 'fish_jump_0').setDepth(-9600)
          if (this.scene.anims.exists('fish_jump')) {
            s.play('fish_jump')
            s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy())
          } else this.scene.time.delayedCall(500, () => s.destroy())
          if (hasFrame(this.scene, 'ripple_0') && this.scene.anims.exists('ripple')) {
            const r = this.scene.add.sprite(x, y + 4, ATLAS, 'ripple_0').setDepth(-9650)
            r.play('ripple')
            r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy())
          }
          break
        }
      }
    }
  }
}
