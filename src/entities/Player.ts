// The hero: container with shadow, body sprite and optional hat.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { RUN_SPEED, TILE, WALK_SPEED } from '../config'
import { moveAndSlide, type Blocked, type Solid } from '../world/collision'
import { T, type Grid } from '../world/terrain'

export type Dir = 'down' | 'up' | 'left' | 'right'
export type Surface = 'grass' | 'sand' | 'wood' | 'stone' | 'water'

export class Player extends Phaser.GameObjects.Container {
  dir: Dir = 'down'
  running = false
  moving = false
  frozen = false
  swinging = false
  surface: Surface = 'grass'
  readonly hw = 5
  readonly hh = 3
  readonly sprite: Phaser.GameObjects.Sprite
  readonly shadow: Phaser.GameObjects.Image
  readonly hat: Phaser.GameObjects.Image
  private bobY = 0
  private stepDist = 0
  onStep: ((surface: Surface) => void) | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    this.shadow = scene.add.image(0, 1, ATLAS, 'shadow')
    this.sprite = scene.add.sprite(0, 0, ATLAS, 'hero_idle_down')
    this.hat = scene.add.image(0, -19, ATLAS, 'hat_crown').setVisible(false)
    this.add([this.shadow, this.sprite, this.hat])
    scene.add.existing(this)
    this.setDepth(y)
  }

  get feet(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }

  facingPoint(dist = 14): { x: number; y: number } {
    const d = this.dir
    return {
      x: this.x + (d === 'left' ? -dist : d === 'right' ? dist : 0),
      y: this.y + (d === 'up' ? -dist : d === 'down' ? dist : 0) - 2,
    }
  }

  setHat(id: string | null): void {
    if (!id || !hasFrame(this.scene, `hat_${id}`)) {
      this.hat.setVisible(false)
      return
    }
    this.hat.setTexture(ATLAS, `hat_${id}`).setVisible(true)
  }

  /** Move by input axes (−1..1) for `dt` seconds. Returns whether a step sound is due. */
  move(dx: number, dy: number, run: boolean, dt: number, blocked: Blocked, solids: Solid[], grid: Grid): void {
    if (this.frozen || this.swinging) {
      this.moving = false
      this.idle()
      return
    }
    const len = Math.hypot(dx, dy)
    if (len < 0.15) {
      this.moving = false
      this.idle()
      return
    }
    if (len > 1) {
      dx /= len
      dy /= len
    }
    this.running = run
    const speed = run ? RUN_SPEED : WALK_SPEED
    const r = moveAndSlide({ x: this.x, y: this.y, hw: this.hw, hh: this.hh }, dx * speed * dt, dy * speed * dt, blocked, solids)
    const moved = Math.hypot(r.x - this.x, r.y - this.y)
    this.x = r.x
    this.y = r.y
    this.moving = moved > 0.01
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
    else this.dir = dy < 0 ? 'up' : 'down'
    if (this.moving) {
      this.sprite.play(`hero_walk_${this.dir}`, true)
      this.sprite.anims.msPerFrame = run ? 70 : 115
      this.stepDist += moved
      if (this.stepDist > (run ? 22 : 18)) {
        this.stepDist = 0
        this.onStep?.(this.surface)
      }
    } else this.idle()
    const t = grid.get(Math.floor(this.x / TILE), Math.floor(this.y / TILE))
    this.surface =
      t === T.SAND ? 'sand' : t === T.DOCK || t === T.BRIDGE ? 'wood' : t === T.PLAZA || t === T.CLIFF ? 'stone' : t === T.SHALLOW ? 'water' : 'grass'
    // walk bob: frames 0 and 2 lift the body a pixel
    const f = this.sprite.anims.currentFrame?.index ?? 0
    this.bobY = this.moving && (f === 1 || f === 3) ? -1 : 0
    this.sprite.y = this.bobY
    this.hat.y = -19 + this.bobY
    this.setDepth(this.y)
  }

  idle(): void {
    if (this.swinging) return
    this.sprite.anims.stop()
    this.sprite.setTexture(ATLAS, `hero_idle_${this.dir}`)
    this.sprite.y = 0
    this.hat.y = -19
  }

  /** Swing the wrench in the facing direction. */
  swing(): Promise<void> {
    if (this.swinging) return Promise.resolve()
    this.swinging = true
    this.moving = false
    return new Promise((resolve) => {
      this.sprite.play(`hero_swing_${this.dir}`, true)
      this.scene.time.delayedCall(240, () => {
        this.swinging = false
        this.idle()
        resolve()
      })
    })
  }

  /** Little hop with squash & stretch (docking, ledges). */
  hop(height = 10, ms = 320): Promise<void> {
    this.frozen = true
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.sprite,
        y: -height,
        duration: ms / 2,
        yoyo: true,
        ease: 'Quad.out',
        onStart: () => this.sprite.setScale(0.9, 1.15),
        onYoyo: () => this.sprite.setScale(1, 1),
        onComplete: () => {
          this.sprite.setScale(1.18, 0.82)
          this.scene.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.out' })
          this.frozen = false
          resolve()
        },
      })
    })
  }

  freeze(f: boolean): void {
    this.frozen = f
    if (f) {
      this.moving = false
      this.idle()
    }
  }

  face(x: number, y: number): void {
    const dx = x - this.x
    const dy = y - this.y
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
    else this.dir = dy < 0 ? 'up' : 'down'
    this.idle()
  }
}
