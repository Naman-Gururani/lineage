// Scripted sequences: letterbox, moves, waits, camera pans — all skippable.
import Phaser from 'phaser'
import { events } from '../core/events'

export class Cutscene {
  skipped = false
  private onSkip: (() => void)[] = []
  private keyHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(private scene: Phaser.Scene) {}

  begin(): void {
    this.skipped = false
    document.body.classList.add('cutscene')
    events.emit('ui:lock', { locked: true })
    events.emit('ui:hint', { text: 'Esc — skip' })
    this.keyHandler = (e) => {
      if (e.key === 'Escape') this.skip()
    }
    window.addEventListener('keydown', this.keyHandler)
  }

  end(): void {
    document.body.classList.remove('cutscene')
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler)
    this.keyHandler = null
    events.emit('ui:hint', { text: null })
    events.emit('ui:lock', { locked: false })
  }

  skip(): void {
    if (this.skipped) return
    this.skipped = true
    for (const fn of this.onSkip) fn()
    this.onSkip = []
  }

  wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve()
    return new Promise((resolve) => {
      const ev = this.scene.time.delayedCall(ms, resolve)
      this.onSkip.push(() => {
        ev.remove(false)
        resolve()
      })
    })
  }

  /** Tween a game object to (x,y) at `speed` px/s. */
  moveTo(obj: { x: number; y: number }, x: number, y: number, speed: number, onUpdate?: () => void): Promise<void> {
    if (this.skipped) {
      obj.x = x
      obj.y = y
      return Promise.resolve()
    }
    const dist = Math.hypot(x - obj.x, y - obj.y)
    return new Promise((resolve) => {
      const tw = this.scene.tweens.add({
        targets: obj,
        x,
        y,
        duration: Math.max(1, (dist / speed) * 1000),
        ease: 'Sine.inOut',
        onUpdate,
        onComplete: () => resolve(),
      })
      this.onSkip.push(() => {
        tw.stop()
        obj.x = x
        obj.y = y
        resolve()
      })
    })
  }

  fade(out: boolean, ms = 400): Promise<void> {
    const cam = this.scene.cameras.main
    if (this.skipped) {
      if (out) cam.fadeOut(1)
      else cam.fadeIn(1)
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      if (out) cam.fadeOut(ms, 0, 0, 0, (_c: unknown, p: number) => p >= 1 && resolve())
      else cam.fadeIn(ms, 0, 0, 0, (_c: unknown, p: number) => p >= 1 && resolve())
      this.onSkip.push(() => resolve())
    })
  }
}
