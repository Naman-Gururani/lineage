// The hero: container with shadow, body sprite and optional hat.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { RUN_SPEED, TILE, WALK_SPEED } from '../config'
import { loadSettings } from '../core/save'
import { moveAndSlide, type Blocked, type Solid } from '../world/collision'
import { HOP_ARC, HOP_TIME } from '../world/hop'
import { T, type Grid } from '../world/terrain'

export type Dir = 'down' | 'up' | 'left' | 'right'
export type Surface = 'grass' | 'sand' | 'wood' | 'stone' | 'water'

/** How high above the feet the hat rides. The frame's skirt does the rest. */
const HAT_Y = -19
/**
 * The airborne frames draw the body higher inside the frame than the standing
 * ones do — 4px on the tuck, 6px on the stretch — so the hat has to climb with
 * it or it slides off the head mid-hop.
 */
const HOP_LIFT = [4, 6]

export class Player extends Phaser.GameObjects.Container {
  dir: Dir = 'down'
  running = false
  moving = false
  frozen = false
  swinging = false
  /** Airborne: input is ignored and the body rides the arc until it lands. */
  hopping = false
  surface: Surface = 'grass'
  /** Base pace. With always-run on, the modifier key asks for the careful walk. */
  alwaysRun: boolean
  reducedMotion: boolean
  readonly hw = 5
  readonly hh = 3
  readonly sprite: Phaser.GameObjects.Sprite
  readonly shadow: Phaser.GameObjects.Image
  readonly hat: Phaser.GameObjects.Image
  private bobY = 0
  private stepDist = 0
  private hopFrom = { x: 0, y: 0 }
  private hopTo = { x: 0, y: 0 }
  private hopT = 0
  private hopDur = HOP_TIME
  private hopArc = HOP_ARC
  private hopFramed = false
  onStep: ((surface: Surface) => void) | null = null
  /** Fired the moment the feet touch down again (dust, thud, camera). */
  onHopLand: (() => void) | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    const s = loadSettings()
    this.alwaysRun = s.alwaysRun
    this.reducedMotion = s.reducedMotion
    this.shadow = scene.add.image(0, 1, ATLAS, 'shadow')
    this.sprite = scene.add.sprite(0, 0, ATLAS, 'hero_idle_down')
    this.hat = scene.add.image(0, HAT_Y, ATLAS, 'hat_crown').setVisible(false)
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

  /**
   * Move by input axes (−1..1) for `dt` seconds. `paceMod` is the modifier key,
   * not a speed: with always-run on it asks for the careful walk, otherwise it
   * asks for the run. A hop in flight swallows the input until it lands.
   */
  move(dx: number, dy: number, paceMod: boolean, dt: number, blocked: Blocked, solids: Solid[], grid: Grid): void {
    if (this.hopping) {
      this.stepHop(dt, grid)
      return
    }
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
    this.running = this.alwaysRun ? !paceMod : paceMod
    const speed = this.running ? RUN_SPEED : WALK_SPEED
    const r = moveAndSlide({ x: this.x, y: this.y, hw: this.hw, hh: this.hh }, dx * speed * dt, dy * speed * dt, blocked, solids)
    const moved = Math.hypot(r.x - this.x, r.y - this.y)
    this.x = r.x
    this.y = r.y
    this.moving = moved > 0.01
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
    else this.dir = dy < 0 ? 'up' : 'down'
    if (this.moving) {
      this.sprite.play(`hero_walk_${this.dir}`, true)
      this.sprite.anims.msPerFrame = this.running ? 70 : 115
      this.stepDist += moved
      if (this.stepDist > (this.running ? 22 : 18)) {
        this.stepDist = 0
        this.onStep?.(this.surface)
      }
    } else this.idle()
    this.readSurface(grid)
    // walk bob: frames 0 and 2 lift the body a pixel
    const f = this.sprite.anims.currentFrame?.index ?? 0
    this.bobY = this.moving && (f === 1 || f === 3) ? -1 : 0
    this.sprite.y = this.bobY
    this.hat.y = HAT_Y + this.bobY
    this.setDepth(this.y)
  }

  private readSurface(grid: Grid): void {
    const t = grid.get(Math.floor(this.x / TILE), Math.floor(this.y / TILE))
    this.surface =
      t === T.SAND ? 'sand' : t === T.DOCK || t === T.BRIDGE ? 'wood' : t === T.PLAZA || t === T.CLIFF ? 'stone' : t === T.SHALLOW ? 'water' : 'grass'
  }

  idle(): void {
    if (this.swinging || this.hopping) return
    this.sprite.anims.stop()
    this.sprite.setTexture(ATLAS, `hero_idle_${this.dir}`)
    this.sprite.y = 0
    this.hat.y = HAT_Y
  }

  /** Swing the wrench in the facing direction. */
  swing(): Promise<void> {
    // mid-hop the wrench animation would fight stepHop for the sprite's frame
    if (this.swinging || this.hopping) return Promise.resolve()
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

  /**
   * Start a planned hop to (lx, ly). The logical position lerps there while the
   * body rides an arc above it — the shadow stays on the ground the whole way.
   * Returns false when the player is in no state to jump.
   */
  startHop(lx: number, ly: number, opts: { arc?: number; time?: number } = {}): boolean {
    if (this.hopping || this.frozen || this.swinging) return false
    this.hopping = true
    this.moving = false
    this.hopFrom = { x: this.x, y: this.y }
    this.hopTo = { x: lx, y: ly }
    this.hopT = 0
    // Reduced motion: the same hop, but flat and quick — no arc, no squash.
    this.hopArc = this.reducedMotion ? 0 : (opts.arc ?? HOP_ARC)
    this.hopDur = this.reducedMotion ? 0.12 : (opts.time ?? HOP_TIME)
    this.scene.tweens.killTweensOf(this.sprite)
    this.sprite.setScale(1)
    this.sprite.anims.stop()
    this.hopFramed = hasFrame(this.scene, 'hero_hop_0') && hasFrame(this.scene, 'hero_hop_1')
    if (this.hopFramed) this.sprite.setTexture(ATLAS, 'hero_hop_0')
    return true
  }

  /** Advance an in-flight hop by `dt` seconds. */
  private stepHop(dt: number, grid: Grid): void {
    this.hopT = Math.min(1, this.hopT + dt / this.hopDur)
    const t = this.hopT
    this.x = this.hopFrom.x + (this.hopTo.x - this.hopFrom.x) * t
    this.y = this.hopFrom.y + (this.hopTo.y - this.hopFrom.y) * t
    this.readSurface(grid) // so the landing thud matches the ground it lands on
    const h = this.hopArc * 4 * t * (1 - t) // parabola: 0 at both ends, arc at the peak
    const stretched = this.hopArc > 0 && t >= 0.5
    this.sprite.y = -h
    this.hat.y = HAT_Y - h - (this.hopFramed ? HOP_LIFT[stretched ? 1 : 0] : 0)
    if (this.hopArc > 0) {
      // the shadow stays put on the ground and shrinks as the body climbs
      this.shadow.setScale(1 - (h / this.hopArc) * 0.3)
      if (this.hopFramed) this.sprite.setTexture(ATLAS, stretched ? 'hero_hop_1' : 'hero_hop_0')
    }
    this.setDepth(this.y)
    if (t >= 1) this.land(!this.reducedMotion)
  }

  /** Put the feet down, optionally with the squash-and-stretch flourish. */
  private land(squash: boolean): void {
    if (!this.hopping) return
    this.hopping = false
    this.x = this.hopTo.x
    this.y = this.hopTo.y
    this.sprite.y = 0
    this.hat.y = HAT_Y
    this.shadow.setScale(1)
    this.idle()
    this.setDepth(this.y)
    if (squash) {
      this.sprite.setScale(1.18, 0.82)
      this.scene.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.out' })
    }
    this.onHopLand?.()
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
    // a hop in flight is snapped down first, so nothing is left hanging mid-air
    if (f && this.hopping) this.land(false)
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
