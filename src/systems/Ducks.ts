// Hook-a-Duck at the pond: cast the hoop, wait for the nudge, then keep the duck
// inside the hoop by holding E. Rendered with Phaser graphics (no DOM).
//
// This file is the view. Everything it is playing out — the duck table, the bite
// window, the width of the hoop, the tally — is pure, and lives in
// `data/ducks.ts` so the journal (and the tests) can read it without a scene.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { DUCK_FRAMES, DUCK_TINTS, REEL_TOLERANCE, biteWindow, castDuck, type DuckId } from '../data/ducks'
import { events, touchInput } from '../core/events'
import { keys } from '../core/keys'
import type { Rng } from '../core/rng'
import type { Player } from '../entities/Player'

export type DuckResult = 'caught' | 'missed' | 'cancelled'

/** Which duck came up, alongside how the go ended. */
export type DuckOutcome = { result: DuckResult; duck: DuckId | null }

export class Ducks {
  private gfx: Phaser.GameObjects.Graphics
  private bobber: Phaser.GameObjects.Image | Phaser.GameObjects.Arc | null = null
  private line: Phaser.GameObjects.Graphics
  private cancelled = false

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private rng: Rng,
    private sfx: (name: string) => void,
    /** ducks landed so far — the strike window tightens as it climbs */
    private catches = 0,
    /**
     * Where the hoop lands, in world pixels. Handed in by the scene, which reads
     * it off the pond in the blueprint: the stall itself knows nothing about
     * which way the water lies. The pier version had it baked in — the sea was
     * always south of you there — and that is exactly what threw the hoop onto
     * the lawn once the pond moved to the *north* side of the fair's stall.
     */
    private aim: { x: number; y: number },
  ) {
    this.gfx = scene.add.graphics().setDepth(99000)
    this.line = scene.add.graphics().setDepth(player.depth + 1)
  }

  private held(): boolean {
    return keys.any('KeyE', 'Space') || touchInput.aHeld
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.scene.time.delayedCall(ms, r))
  }

  private async pressWithin(ms: number): Promise<boolean> {
    const t0 = this.scene.time.now
    // require a fresh press (not already held)
    let wasDown = this.held()
    while (this.scene.time.now - t0 < ms) {
      if (keys.down('Escape')) {
        this.cancelled = true
        return false
      }
      const down = this.held()
      if (down && !wasDown) return true
      wasDown = down
      await this.wait(16)
    }
    return false
  }

  /**
   * The float on the water. Each kind of duck has its own 16 px sprite in the
   * fair pack; until that pack is painted the stall falls back to the pier's
   * bobber, and failing that to a plain arc — the hoop game plays the same
   * either way, so a missing frame must never be the thing that stops it.
   */
  private float(species: DuckId, x: number, y: number): Phaser.GameObjects.Image | Phaser.GameObjects.Arc {
    for (const frame of [DUCK_FRAMES[species], 'bobber']) {
      if (frame && hasFrame(this.scene, frame)) return this.scene.add.image(x, y, ATLAS, frame)
    }
    return this.scene.add.circle(x, y, 3, 0xe2483f)
  }

  async run(): Promise<DuckOutcome> {
    const p = this.player
    // Rolled at the cast, not at the landing: what is on the hook is decided
    // before the fight, so a fight that goes badly is a duck lost and not a
    // reroll. The wait below still comes off the shared stream, so no two goes
    // feel alike even though the duck on the end of the line is settled.
    const species = castDuck(this.rng, this.catches)
    p.freeze(true)
    // Face the water, whichever way it lies. The direction is read off the aim
    // — dominant axis of you → the landing point — so the one thing that decides
    // where the hoop goes also decides which way you are turned to throw it.
    p.face(this.aim.x, this.aim.y)
    events.emit('ui:hint', { text: 'Hook out… wait for the bob, then press E!' })
    this.sfx('cast')
    // The cast: the hoop lifts off the counter, clears the rim by 26 px and
    // drops onto the water. Both ends of the arc are real positions — the throw
    // *finishes* on the aim rather than snapping there, which is what made the
    // old fixed-offset cast read as a hoop flung at the ground.
    const bx = this.aim.x
    const by = this.aim.y
    const bob = this.float(species, p.x, p.y - 10)
    bob.setDepth(p.depth + 2)
    this.bobber = bob
    // Measured from whichever end is higher, so the lift is always a lift.
    const apex = Math.min(p.y - 10, by) - 26
    await new Promise<void>((r) => {
      this.scene.tweens.add({ targets: bob, x: bx, duration: 520, ease: 'Sine.out' })
      this.scene.tweens.add({
        targets: bob,
        y: apex,
        duration: 260,
        ease: 'Quad.out',
        onComplete: () => {
          this.scene.tweens.add({ targets: bob, y: by, duration: 260, ease: 'Quad.in', onComplete: () => r() })
        },
      })
    })
    bob.setPosition(bx, by)
    this.sfx('splash')
    this.ripple(bx, by)
    // idle bob
    const bobTween = this.scene.tweens.add({ targets: bob, y: by + 1.5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    // nibbles + bite
    const wait = this.rng.range(1600, 4200)
    const t0 = this.scene.time.now
    while (this.scene.time.now - t0 < wait) {
      if (keys.down('Escape')) {
        this.cancelled = true
        break
      }
      await this.wait(16)
      this.drawLine(p.x, p.y - 14, bob.x, bob.y)
    }
    if (this.cancelled) return this.finish('cancelled', bob, null)
    bobTween.stop()
    this.scene.tweens.add({ targets: bob, y: by + 6, duration: 90, yoyo: true, repeat: 2 })
    this.ripple(bx, by)
    this.sfx('reel')
    events.emit('ui:hint', { text: '! Press E !' })
    const hit = await this.pressWithin(biteWindow(this.catches) * 1000)
    if (this.cancelled) return this.finish('cancelled', bob, null)
    if (!hit) {
      events.emit('ui:hint', { text: 'Too slow — it bobbed away.' })
      return this.finish('missed', bob, null)
    }
    // hoop mini-game
    events.emit('ui:hint', { text: 'Hold E to lift the hoop — keep the duck inside!' })
    const ok = await this.reel(bob)
    return this.finish(ok ? 'caught' : 'missed', bob, ok ? species : null)
  }

  private async reel(bob: Phaser.GameObjects.Components.Transform): Promise<boolean> {
    const barX = this.player.x + 26
    const barTop = this.player.y - 40
    const barH = 60
    let duckPos = 0.5 // 0 top .. 1 bottom
    let duckVel = 0
    let zone = 0.5
    let zoneVel = 0
    let progress = 0.35
    let t = 0
    const zoneH = 0.3 * REEL_TOLERANCE
    while (progress > 0 && progress < 1) {
      if (keys.down('Escape')) {
        this.cancelled = true
        return false
      }
      const dt = 1 / 60
      t += dt
      // the duck drifts
      if (this.rng.next() < 0.03) duckVel += this.rng.range(-1.6, 1.6)
      duckVel += Math.sin(t * 2.7) * 0.02
      duckVel *= 0.96
      duckPos = Math.max(0.05, Math.min(0.95, duckPos + duckVel * dt))
      // zone: rises when held, sinks otherwise
      zoneVel += (this.held() ? -2.6 : 2.2) * dt
      zoneVel *= 0.9
      zone = Math.max(zoneH / 2, Math.min(1 - zoneH / 2, zone + zoneVel * dt))
      if (zone === zoneH / 2 || zone === 1 - zoneH / 2) zoneVel = 0
      const inside = Math.abs(duckPos - zone) < zoneH / 2
      progress += (inside ? 0.28 : -0.22) * dt
      if (inside && Math.floor(t * 8) % 8 === 0) this.sfx('reel')
      this.draw(barX, barTop, barH, duckPos, zone, zoneH, progress, inside)
      this.drawLine(this.player.x, this.player.y - 14, bob.x, bob.y)
      await this.wait(16)
    }
    this.gfx.clear()
    return progress >= 1
  }

  private draw(x: number, top: number, h: number, duck: number, zone: number, zoneH: number, progress: number, inside: boolean) {
    const g = this.gfx
    g.clear()
    // frame
    g.fillStyle(0x1b1a2e, 0.9)
    g.fillRect(x - 6, top - 3, 12, h + 6)
    g.fillStyle(0x3e9fd8, 1)
    g.fillRect(x - 4, top - 1, 8, h + 2)
    // zone
    g.fillStyle(inside ? 0x31c7b3 : 0x9b6bf2, 0.85)
    g.fillRect(x - 4, top + (zone - zoneH / 2) * h, 8, zoneH * h)
    // duck marker
    g.fillStyle(0xffd23f, 1)
    g.fillRect(x - 3, top + duck * h - 2, 6, 4)
    // progress
    g.fillStyle(0x1b1a2e, 0.9)
    g.fillRect(x + 8, top - 3, 5, h + 6)
    g.fillStyle(0xf28c28, 1)
    g.fillRect(x + 9, top + h - progress * h, 3, progress * h)
  }

  private drawLine(x0: number, y0: number, x1: number, y1: number) {
    this.line.clear()
    this.line.lineStyle(1, 0xfdfbf4, 0.8)
    this.line.beginPath()
    this.line.moveTo(x0, y0)
    this.line.lineTo(x1, y1 - 2)
    this.line.strokePath()
  }

  private ripple(x: number, y: number) {
    if (!this.scene.anims.exists('ripple')) return
    const r = this.scene.add.sprite(x, y + 2, ATLAS, 'ripple_0').setDepth(this.player.depth + 1)
    r.play('ripple')
    r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy())
  }

  private finish(result: DuckResult, bob: Phaser.GameObjects.GameObject, duck: DuckId | null): DuckOutcome {
    this.scene.tweens.killTweensOf(bob)
    bob.destroy()
    this.gfx.destroy()
    this.line.destroy()
    events.emit('ui:hint', { text: null })
    this.player.freeze(false)
    if (result === 'caught') {
      this.sfx('catch')
      // The duck's own sprite if the fair pack has it; otherwise the pier's
      // jumping fish, tinted, which is what stood in before the pond existed.
      const frame = (duck && DUCK_FRAMES[duck]) ?? ''
      const painted = frame && hasFrame(this.scene, frame)
      if (painted || hasFrame(this.scene, 'fish_jump_1')) {
        // Out of the water and into your hands: it starts at the aim, where the
        // hoop was, not at a fixed spot below you — south of the player is the
        // path at this stall, and a duck cannot be lifted off the path.
        const f = this.scene.add
          .image(this.aim.x, this.aim.y, ATLAS, painted ? frame : 'fish_jump_1')
          .setDepth(this.player.depth + 3)
        if (!painted && duck && DUCK_TINTS[duck]) f.setTint(DUCK_TINTS[duck])
        this.scene.tweens.add({ targets: f, x: this.player.x, y: this.player.y - 24, duration: 420, ease: 'Back.out', onComplete: () => f.destroy() })
      }
    }
    return { result, duck }
  }
}
