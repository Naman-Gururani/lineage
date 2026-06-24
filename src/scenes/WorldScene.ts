import Phaser from 'phaser'
import { ZONES, SPAWN, type Zone } from '../data/content'
import { TILE, WORLD_W, WORLD_H, buildIsland } from '../game/art'
import { bus } from '../game/bus'
import { touch } from '../game/input-state'
import { sfx } from '../game/sound'

type Rect = { x: number; y: number; w: number; h: number }
type Marker = { zone: Zone; ring: Phaser.GameObjects.Image; bx: number; by: number; visited: boolean }

const INTERACT_R = 86
const KIND_TEX: Record<string, string> = {
  home: 'lm_home',
  tower: 'lm_tower',
  workshop: 'lm_workshop',
  engine: 'lm_engine',
  vault: 'lm_vault',
  cottage: 'lm_cottage',
  lighthouse: 'lm_lighthouse',
}

export class WorldScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Sprite
  private isLand!: (x: number, y: number) => boolean
  private solids: Rect[] = []
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private facing: 'down' | 'up' | 'side' = 'down'
  private flip = false
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter
  private spark!: Phaser.GameObjects.Particles.ParticleEmitter
  private stepT = 0
  private nearZone: Zone | null = null
  private markers: Marker[] = []
  private orbs: Phaser.GameObjects.Image[] = []
  private orbTotal = 0
  private orbGot = 0
  private locked = false

  constructor() {
    super('world')
  }

  create() {
    const { isLand } = buildIsland(this, ZONES, SPAWN)
    this.isLand = isLand

    this.add.image(0, 0, 'island').setOrigin(0, 0).setDepth(-100000)
    const cam = this.cameras.main
    cam.setBounds(0, 0, WORLD_W, WORLD_H)
    cam.setBackgroundColor('#57a9dd')

    this.scatterDecor()
    this.placeLandmarks()
    this.scatterOrbs()

    const sx = SPAWN.tx * TILE + TILE / 2
    const sy = SPAWN.ty * TILE + TILE / 2
    this.hero = this.add.sprite(sx, sy, 'hero_down_0').setOrigin(0.5, 0.92)
    this.hero.setDepth(sy)

    this.dust = this.add
      .particles(0, 0, 'dust', {
        lifespan: 360,
        speed: { min: 6, max: 22 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.7, end: 0 },
        quantity: 1,
        emitting: false,
      })
      .setDepth(sy - 1)
    this.spark = this.add
      .particles(0, 0, 'spark', {
        lifespan: 520,
        speed: { min: 30, max: 90 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        quantity: 1,
        emitting: false,
      })
      .setDepth(120000)

    cam.startFollow(this.hero, true, 0.12, 0.12)
    cam.setZoom(this.pickZoom())
    this.scale.on('resize', () => cam.setZoom(this.pickZoom()))

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.keys = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>
    this.input.keyboard!.on('keydown-E', () => this.tryInteract())
    this.input.keyboard!.on('keydown-SPACE', () => this.tryInteract())

    bus.on('travel', (z: Zone) => this.travelTo(z))
    bus.on('interact', () => this.tryInteract())
    bus.on('lock', (v: boolean) => {
      this.locked = v
      if (v) this.setNear(null)
    })

    bus.emit('orbs', this.orbGot, this.orbTotal)
    this.time.delayedCall(60, () => bus.emit('ready'))
  }

  private pickZoom() {
    const w = this.scale.width
    return w < 560 ? 1.35 : w < 1000 ? 1.6 : 1.8
  }

  private placeLandmarks() {
    for (const z of ZONES) {
      const wx = z.tx * TILE + TILE / 2
      const wy = z.ty * TILE + TILE / 2
      const img = this.add.image(wx, wy, KIND_TEX[z.kind]).setOrigin(0.5, 1).setDepth(wy)
      const bw = img.width * 0.62
      this.solids.push({ x: wx - bw / 2, y: wy - 22, w: bw, h: 22 })
      const ring = this.add
        .image(wx, wy + 5, 'ring')
        .setDepth(wy - 1)
        .setTint(z.accent)
      this.tweens.add({
        targets: ring,
        scale: { from: 0.78, to: 1.18 },
        alpha: { from: 0.85, to: 0.25 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
      const label = this.makeLabel(wx, wy - img.height - 6, z.name)
      this.tweens.add({
        targets: label,
        y: label.y - 5,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
      this.markers.push({ zone: z, ring, bx: wx, by: wy, visited: false })
    }
  }

  private makeLabel(x: number, y: number, text: string) {
    const t = this.add
      .text(0, 0, text, { fontFamily: 'Fredoka, sans-serif', fontSize: '15px', color: '#3a2a1a' })
      .setOrigin(0.5, 1)
    const pad = 6
    const bg = this.add.graphics()
    bg.fillStyle(0xfff6e0, 0.96)
    bg.fillRoundedRect(-t.width / 2 - pad, -t.height - pad, t.width + pad * 2, t.height + pad * 2, 7)
    bg.fillTriangle(-5, -1, 5, -1, 0, 5)
    return this.add.container(x, y, [bg, t]).setDepth(120001)
  }

  private nearLand(x: number, y: number) {
    return this.isLand(x, y)
  }

  private scatterDecor() {
    const near = (x: number, y: number, d: number) =>
      ZONES.some((z) => Phaser.Math.Distance.Between(x, y, z.tx * TILE, z.ty * TILE) < d) ||
      Phaser.Math.Distance.Between(x, y, SPAWN.tx * TILE, SPAWN.ty * TILE) < 90
    const kinds = ['tree', 'tree', 'tree', 'bush', 'flowers', 'flowers', 'rock'] as const
    let placed = 0
    let tries = 0
    while (placed < 230 && tries < 4000) {
      tries++
      const x = 40 + Math.random() * (WORLD_W - 80)
      const y = 40 + Math.random() * (WORLD_H - 80)
      if (!this.nearLand(x, y)) continue
      // bias trees toward the coast (where a neighbour is water)
      const coast = !this.isLand(x + 70, y) || !this.isLand(x - 70, y) || !this.isLand(x, y + 70) || !this.isLand(x, y - 70)
      const kind = coast && Math.random() < 0.7 ? 'tree' : kinds[(Math.random() * kinds.length) | 0]
      if (near(x, y, kind === 'tree' ? 86 : 60)) continue
      this.add.image(x, y, kind).setOrigin(0.5, 0.9).setDepth(kind === 'flowers' ? y - 200 : y)
      placed++
    }
  }

  private scatterOrbs() {
    let placed = 0
    let tries = 0
    while (placed < 16 && tries < 2000) {
      tries++
      const x = 60 + Math.random() * (WORLD_W - 120)
      const y = 60 + Math.random() * (WORLD_H - 120)
      if (!this.isLand(x, y)) continue
      if (Phaser.Math.Distance.Between(x, y, SPAWN.tx * TILE, SPAWN.ty * TILE) < 60) continue
      const orb = this.add.image(x, y, 'orb').setDepth(y).setData('got', false)
      this.tweens.add({ targets: orb, y: y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      this.orbs.push(orb)
      placed++
    }
    this.orbTotal = this.orbs.length
  }

  private walkable(x: number, y: number) {
    if (!this.isLand(x, y)) return false
    for (const s of this.solids) {
      if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return false
    }
    return true
  }

  private setNear(z: Zone | null) {
    if (this.nearZone?.id === z?.id) return
    this.nearZone = z
    bus.emit('prompt', z)
  }

  private tryInteract() {
    if (this.locked || !this.nearZone) return
    this.openZone(this.nearZone)
  }

  private openZone(z: Zone) {
    const m = this.markers.find((mm) => mm.zone.id === z.id)
    const first = m && !m.visited
    if (m) {
      m.visited = true
      m.ring.setTint(0x9be38a)
      bus.emit('visited', z.id)
    }
    sfx.open()
    if (first) sfx.discover()
    bus.emit('open', z)
  }

  private travelTo(z: Zone) {
    this.hero.setPosition(z.tx * TILE + TILE / 2, z.ty * TILE + TILE / 2 + 34)
    this.cameras.main.flash(220, 255, 255, 255)
    this.openZone(z)
  }

  private checkOrbs() {
    for (const orb of this.orbs) {
      if (orb.getData('got')) continue
      if (Phaser.Math.Distance.Between(this.hero.x, this.hero.y, orb.x, orb.y) < 26) {
        orb.setData('got', true)
        this.spark.emitParticleAt(orb.x, orb.y, 8)
        this.tweens.add({ targets: orb, scale: 1.8, alpha: 0, duration: 220, onComplete: () => orb.destroy() })
        this.orbGot++
        sfx.pickup()
        bus.emit('orbs', this.orbGot, this.orbTotal)
      }
    }
  }

  update(_t: number, dms: number) {
    if (this.locked) {
      this.hero.anims.stop()
      return
    }
    const dt = Math.min(dms, 32) / 1000
    let dx = 0
    let dy = 0
    const c = this.cursors
    const k = this.keys
    if (c.left.isDown || k.A.isDown) dx -= 1
    if (c.right.isDown || k.D.isDown) dx += 1
    if (c.up.isDown || k.W.isDown) dy -= 1
    if (c.down.isDown || k.S.isDown) dy += 1
    if (touch.active) {
      dx += touch.x
      dy += touch.y
    }
    const len = Math.hypot(dx, dy)
    if (len > 0.16) {
      dx /= len
      dy /= len
      const speed = 158
      const nx = this.hero.x + dx * speed * dt
      const ny = this.hero.y + dy * speed * dt
      if (this.walkable(nx, this.hero.y)) this.hero.x = nx
      if (this.walkable(this.hero.x, ny)) this.hero.y = ny

      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = 'side'
        this.flip = dx < 0
      } else {
        this.facing = dy < 0 ? 'up' : 'down'
      }
      this.hero.setFlipX(this.facing === 'side' && this.flip)
      this.hero.play('walk_' + this.facing, true)

      this.stepT -= dt
      if (this.stepT <= 0) {
        this.stepT = 0.28
        this.dust.emitParticleAt(this.hero.x, this.hero.y + 2)
        sfx.step()
      }
    } else {
      this.hero.anims.stop()
      this.hero.setTexture('hero_' + this.facing + '_0')
      this.hero.setFlipX(this.facing === 'side' && this.flip)
    }
    this.hero.setDepth(this.hero.y)
    this.dust.setDepth(this.hero.y - 1)

    // proximity to nearest landmark
    let best: Zone | null = null
    let bestD = INTERACT_R
    for (const m of this.markers) {
      const d = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, m.bx, m.by)
      if (d < bestD) {
        bestD = d
        best = m.zone
      }
    }
    this.setNear(best)

    this.checkOrbs()
  }
}
