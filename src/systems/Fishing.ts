// Fishing at the pier: cast, wait for the bite, then keep the fish inside the
// catch zone by holding E. Rendered with Phaser graphics (no DOM).
//
// This file is the view. Everything it is playing out — the species table, the
// bite window, the width of the net, the tally — is pure, and lives in
// `data/fish.ts` so the journal (and the tests) can read it without a scene.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { FISH_TINTS, REEL_TOLERANCE, biteWindow, castSpecies, type FishId } from '../data/fish'
import { events, touchInput } from '../core/events'
import { keys } from '../core/keys'
import type { Rng } from '../core/rng'
import type { Player } from '../entities/Player'

export type FishingResult = 'caught' | 'missed' | 'cancelled'

/** Which species came up, alongside how the cast ended. */
export type FishingOutcome = { result: FishingResult; fish: FishId | null }

export class Fishing {
  private gfx: Phaser.GameObjects.Graphics
  private bobber: Phaser.GameObjects.Image | Phaser.GameObjects.Arc | null = null
  private line: Phaser.GameObjects.Graphics
  private cancelled = false

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private rng: Rng,
    private sfx: (name: string) => void,
    /** fish landed so far — the strike window tightens as it climbs */
    private catches = 0,
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

  async run(): Promise<FishingOutcome> {
    const p = this.player
    // Rolled at the cast, not at the landing: what is on the hook is decided
    // before the fight, so a fight that goes badly is a fish lost and not a
    // reroll. The wait below still comes off the shared stream, so no two casts
    // feel alike even though the fish on the end of the line is settled.
    const species = castSpecies(this.rng, this.catches)
    p.freeze(true)
    p.dir = 'down'
    p.idle()
    events.emit('ui:hint', { text: 'Casting… wait for the tug, then press E!' })
    this.sfx('cast')
    // cast: bobber flies out in an arc
    const bx = p.x + 6
    const by = p.y + 34
    const bob = hasFrame(this.scene, 'bobber') ? this.scene.add.image(p.x, p.y - 10, ATLAS, 'bobber') : this.scene.add.circle(p.x, p.y - 10, 3, 0xe2483f)
    bob.setDepth(p.depth + 2)
    this.bobber = bob
    await new Promise<void>((r) => {
      this.scene.tweens.add({ targets: bob, x: bx, duration: 520, ease: 'Sine.out' })
      this.scene.tweens.add({ targets: bob, y: by - 26, duration: 260, ease: 'Quad.out', yoyo: true, onComplete: () => r() })
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
      events.emit('ui:hint', { text: 'Too slow — it swam off.' })
      return this.finish('missed', bob, null)
    }
    // reel mini-game
    events.emit('ui:hint', { text: 'Hold E to lift the net — keep the fish inside!' })
    const ok = await this.reel(bob)
    return this.finish(ok ? 'caught' : 'missed', bob, ok ? species : null)
  }

  private async reel(bob: Phaser.GameObjects.Components.Transform): Promise<boolean> {
    const barX = this.player.x + 26
    const barTop = this.player.y - 40
    const barH = 60
    let fishPos = 0.5 // 0 top .. 1 bottom
    let fishVel = 0
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
      // fish wanders
      if (this.rng.next() < 0.03) fishVel += this.rng.range(-1.6, 1.6)
      fishVel += Math.sin(t * 2.7) * 0.02
      fishVel *= 0.96
      fishPos = Math.max(0.05, Math.min(0.95, fishPos + fishVel * dt))
      // zone: rises when held, sinks otherwise
      zoneVel += (this.held() ? -2.6 : 2.2) * dt
      zoneVel *= 0.9
      zone = Math.max(zoneH / 2, Math.min(1 - zoneH / 2, zone + zoneVel * dt))
      if (zone === zoneH / 2 || zone === 1 - zoneH / 2) zoneVel = 0
      const inside = Math.abs(fishPos - zone) < zoneH / 2
      progress += (inside ? 0.28 : -0.22) * dt
      if (inside && Math.floor(t * 8) % 8 === 0) this.sfx('reel')
      this.draw(barX, barTop, barH, fishPos, zone, zoneH, progress, inside)
      this.drawLine(this.player.x, this.player.y - 14, bob.x, bob.y)
      await this.wait(16)
    }
    this.gfx.clear()
    return progress >= 1
  }

  private draw(x: number, top: number, h: number, fish: number, zone: number, zoneH: number, progress: number, inside: boolean) {
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
    // fish marker
    g.fillStyle(0xffd23f, 1)
    g.fillRect(x - 3, top + fish * h - 2, 6, 4)
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

  private finish(result: FishingResult, bob: Phaser.GameObjects.GameObject, fish: FishId | null): FishingOutcome {
    this.scene.tweens.killTweensOf(bob)
    bob.destroy()
    this.gfx.destroy()
    this.line.destroy()
    events.emit('ui:hint', { text: null })
    this.player.freeze(false)
    if (result === 'caught') {
      this.sfx('catch')
      if (hasFrame(this.scene, 'fish_jump_1')) {
        const f = this.scene.add.image(this.player.x + 6, this.player.y + 30, ATLAS, 'fish_jump_1').setDepth(this.player.depth + 3)
        // One sprite, three fish: the tint is what tells a parrotfish from a
        // goldfish as it flips out of the water.
        if (fish && FISH_TINTS[fish]) f.setTint(FISH_TINTS[fish])
        this.scene.tweens.add({ targets: f, x: this.player.x, y: this.player.y - 24, duration: 420, ease: 'Back.out', onComplete: () => f.destroy() })
      }
    }
    return { result, fish }
  }
}
