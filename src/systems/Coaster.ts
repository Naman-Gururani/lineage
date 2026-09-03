// The Career Coaster, ridden. Spec §4.
//
// Interacting at the station hands control over here: the world locks, the player
// sprite is put away where it stands, and a cart runs the drawn circuit past five
// résumé beats before parking back on the platform and opening the Career card.
// It stops at every one of those beats and waits there: the card that comes up
// carries a Next button, and until it is pressed (`ride:next`) the cart does not
// move. The ride takes exactly as long as the rider wants to spend reading it.
//
// The thin half of the ride. Everything that can be decided from geometry — where
// the cart is, which way it points, how fast it goes, which beat it has reached —
// is `systems/ridepath.ts`, which is pure and unit-tested. What is left here is
// the part that needs a canvas: a sprite, a camera, four sounds and the cutscene's
// Esc key.
//
// Motion is a fixed-step integration at 120Hz with the sprite interpolated between
// steps, so the ride runs at exactly the same speed on a 60Hz laptop and a 144Hz
// monitor, and a dropped frame costs nothing. There is not a single timer in it:
// the cart's whole state is one number — the distance it has travelled — and one
// flag saying whether it is waiting at a beat.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { sfx } from '../audio/sfx'
import { TILE, pickZoom } from '../config'
import { events } from '../core/events'
import { loadSettings } from '../core/save'
import { COASTER_ORIGIN, COASTER_PATH, COASTER_STOPS, type Stop } from '../data/coaster'
import { Cutscene } from './Cutscene'
import type { CameraRig, Followable } from './CameraRig'
import type { GameState } from './GameState'
import { buildArcTable, sampleAt, speedAt, stopArcs, stopWindow, zoneAt, type RideZone } from './ridepath'

/**
 * All the ride needs of the player: somewhere to stand and a way to be put out of
 * sight. It is never moved — the rider steps off exactly where they got on.
 */
export type RidePlayer = {
  x: number
  y: number
  setVisible(v: boolean): unknown
  setActive?(v: boolean): unknown
}

export type CoasterOpts = {
  /**
   * Render depth for the cart. The default puts it a hair in front of the spans,
   * whose feet sit on the structure's base row — anything the player can walk in
   * front of is drawn by its own `y` and so still passes in front of the cart.
   */
  depth?: number
  /** Reduced motion, if the caller already knows (the scene does). */
  reducedMotion?: boolean
  /** Integration rate; only the tests have any reason to change it. */
  hz?: number
}

/* ---------------- the circuit, measured once ---------------- */

/** World px of the structure's left-bottom corner: the path's frame of reference. */
const ORIGIN_X = COASTER_ORIGIN.tx * TILE
const ORIGIN_Y = COASTER_ORIGIN.ty * TILE

const TABLE = buildArcTable(COASTER_PATH)
const TOTAL = TABLE.length ? TABLE[TABLE.length - 1] : 0
const STOP_S = stopArcs(COASTER_STOPS, TABLE)
const PROFILE = { stops: COASTER_STOPS }

/** The two cart frames: sitting down, and hands in the air. */
const CART_SEATED = 'coaster_cart_0'
const CART_HANDS = 'coaster_cart_1'

/** Camera zoom while riding, and how fast it follows the cart rather than a walker. */
const RIDE_ZOOM = 1.25
const RIDE_LERP = 0.3
/** A chain click every quarter second — the sound of a lift hill. */
const CLICK_MS = 250
/** Ceiling on how fast the cart may be *seen* to turn, whatever the track does. */
const MAX_SPIN = 9 // rad/s
/** XP for the first ride only. */
const RIDE_XP = 120
/** The save flag that remembers the first ride happened. */
const RIDDEN = 'rode_coaster'

/**
 * The ride in progress, if there is one. A coaster seats one train: a second
 * interact while the first is still going round would raise a second cutscene (a
 * second Esc listener, a second `ui:lock`), put a second cart on the rails, and —
 * worst — capture the *ride's* camera settings as the ones to restore, leaving the
 * world permanently zoomed and lookahead-less. Everyone who asks gets the ride
 * that is already running.
 */
let inFlight: Promise<void> | null = null

export class Coaster {
  /**
   * Run the ride. Resolves once the cart has parked, the player is back and the
   * Career card has been asked for.
   *
   * Everything it grants is idempotent, so a second ride costs the player nothing
   * and gives them nothing but the card again. A ride abandoned by a scene
   * shutdown (quit to the title) grants nothing at all — it can be taken again.
   */
  static run(scene: Phaser.Scene, player: RidePlayer, rig: CameraRig, state: GameState, opts: CoasterOpts = {}): Promise<void> {
    if (inFlight) return inFlight
    const ride = new Coaster(scene, player, rig, state, opts).run()
    inFlight = ride
    const clear = () => {
      if (inFlight === ride) inFlight = null
    }
    // Both arms, so a rejected ride cannot wedge the station shut — and so the
    // rejection is handled here rather than surfacing as an unhandled one.
    ride.then(clear, clear)
    return ride
  }

  private readonly reduced: boolean
  private readonly hz: number
  private readonly depth: number
  private cart: Phaser.GameObjects.Sprite | null = null
  private proxy: Followable = { x: 0, y: 0, dir: 'left', moving: true }
  /** The cart's displayed heading, rate-limited towards the track's tangent. */
  private angle = 0
  private flipped = false
  private frame = CART_SEATED
  private cardUp = false
  private clickT = 0
  private lastZone: RideZone = 'station'
  /** The scene went away under the ride: touch nothing of its, grant nothing. */
  private dead = false

  private constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: RidePlayer,
    private readonly rig: CameraRig,
    private readonly state: GameState,
    opts: CoasterOpts,
  ) {
    this.reduced = opts.reducedMotion ?? loadSettings().reducedMotion
    this.hz = opts.hz ?? 120
    this.depth = opts.depth ?? ORIGIN_Y + 4
  }

  private async run(): Promise<void> {
    const cs = new Cutscene(this.scene)
    // Captured before anything is changed, so the `finally` always has the world's
    // own numbers to put back — not the ride's.
    const keepLook = this.rig.lookahead
    const keepLerp = this.rig.lerp

    // Armed before the very first `await`, because the two fades are awaits too.
    // `Cutscene.fade` resolves on the camera's own callback or on `skip()`, and a
    // camera that has been torn down calls neither: a scene shutdown during either
    // fade would leave this method suspended for ever — letterbox up, world locked,
    // and the in-flight guard handing that same dead promise to every later
    // interact for the rest of the session. `skip()` settles whatever the cutscene
    // has pending; `gone` settles the awaits around it.
    let onGone = () => {}
    const gone = new Promise<void>((resolve) => (onGone = resolve))
    const onShutdown = () => {
      this.dead = true
      cs.skip()
      onGone()
    }
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown)
    /** Wait for `p`, or give up the moment the scene goes away. */
    const until = (p: Promise<unknown>): Promise<unknown> => Promise.race([p, gone])

    try {
      cs.begin()
      await until(cs.fade(true, 260))

      if (!this.dead) {
        // The rider gets in where they are standing — no teleport, so stepping off
        // puts them back at the station door they walked to.
        this.player.setVisible(false)
        this.player.setActive?.(false)

        const start = sampleAt(COASTER_PATH, TABLE, 0)
        if (hasFrame(this.scene, CART_SEATED)) {
          this.cart = this.scene.add.sprite(ORIGIN_X + start.x, ORIGIN_Y + start.y, ATLAS, CART_SEATED).setDepth(this.depth)
        }
        this.angle = Math.atan2(-start.dy, -start.dx)
        this.flipped = start.dx < 0

        // The camera rides the cart through a proxy: a coaster is not a walker, so
        // it gets no facing look-ahead and a tighter follow than the world's own.
        this.rig.lookahead = 0
        this.rig.lerp = RIDE_LERP
        this.place(0, 0)
        this.rig.follow(this.proxy, true)
        this.zoom()

        await until(cs.fade(false, 320))
      }
      if (!this.dead) await this.ride(cs, gone)
    } finally {
      // A ride that ended properly must not be reachable by a later shutdown.
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown)
      // Whatever happened — a finished ride, an Esc, a shutdown, a throw — the
      // rider is never left invisible behind a locked world with no way out.
      this.hideCard()
      if (!this.dead) {
        // Park: the cart comes to rest on the platform it left from, the rider gets
        // out, and the camera hands back.
        this.cart?.destroy()
        this.player.setVisible(true)
        this.player.setActive?.(true)
        this.rig.lookahead = keepLook
        this.rig.lerp = keepLerp
        this.rig.setZoomForViewport()
        this.refollow()
      }
      this.cart = null
      // The letterbox and the input lock are the DOM's, not the scene's, so they
      // come off even when the scene has gone.
      cs.end()
    }
    // A ride the scene was torn out from under pays nothing: the camera and the
    // cart it would restore no longer exist, and a Career card opening over the
    // title screen is the loudest possible way to say so. It can be ridden again.
    if (this.dead) return
    this.grant()
  }

  /* ---------------- the ride itself ---------------- */

  /**
   * One promise over the scene's update: fixed steps of `1/hz` seconds, with the
   * sprite drawn at the interpolated position between the last two of them.
   *
   * The cart stops at every beat and stays there until the rider asks for the
   * next one. Nothing about that is on a timer — a résumé read at the ride's
   * speed is the ride reading it to you — so the hold is a flag, and the only
   * thing that clears it is `ride:next` from the card's own Next button.
   */
  private ride(cs: Cutscene, gone: Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      const step = 1 / this.hz
      let acc = 0
      let prev = 0
      let cur = 0
      let next = 0
      let done = false
      /** Standing at a beat with its card up, waiting on the rider. */
      let held = false

      // A Next nobody is waiting for is not a beat: the guard makes a stray press
      // (a double-tap, a key held over the card's own dismissal) cost nothing.
      const offNext = events.on('ride:next', () => {
        if (done || !held) return
        held = false
        this.hideCard()
      })

      const finish = () => {
        if (done) return
        done = true
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, tick)
        // However the ride ended — parked, Esc'd, or torn down under a card — the
        // bus is shared and outlives every scene, so this comes off with it.
        offNext()
        resolve()
      }

      const tick = (_t: number, dms: number) => {
        // Nothing of the scene's is safe to touch once it has gone.
        if (this.dead) {
          finish()
          return
        }
        // Esc asked for the ending, not for less of it: the cart is parked where
        // it was going anyway and every reward below still lands. Checked before
        // the hold, so Esc reads a beat's card as an ending too.
        if (cs.skipped) {
          prev = cur = TOTAL
          this.place(TOTAL, 0)
          finish()
          return
        }
        const dt = Math.min(dms, 100) / 1000
        // Standing at a beat: no integration, and no accumulator either. A hold
        // that banked its deltas would spend them all in the frame the rider
        // pressed Next, and the cart would leave the beat with a jump.
        if (held) {
          acc = 0
          prev = cur
          this.place(cur, dt)
          this.zoom()
          return
        }
        acc += dt
        // A tab that was in the background can hand back a huge delta; the clamp
        // above caps it, and this caps the catch-up loop itself.
        let guard = 0
        while (acc >= step && !done && !held && guard++ < 400) {
          acc -= step
          prev = cur
          cur += speedAt(COASTER_PATH, TABLE, cur, PROFILE) * step
          if (next < STOP_S.length && cur >= STOP_S[next]) {
            // Land *on* the beat rather than a cart-length past it, and stay:
            // `held` also ends this frame's catch-up, so a slow frame cannot
            // integrate straight through a beat the rider has not read yet. The
            // flag goes up before the card does, so the ride is already waiting
            // by the time anything downstream can answer.
            const beat = COASTER_STOPS[next]
            cur = STOP_S[next]
            next++
            held = true
            this.showCard(beat)
          }
          this.cues(cur, step)
          if (cur >= TOTAL) {
            prev = cur = TOTAL
            finish()
            break
          }
        }
        if (this.dead) return
        // A frame that arrived at a beat draws the cart *on* it, not at whatever
        // fraction of the step is left over: the card is up, and the cart it
        // captions must not creep the last tenth of a pixel afterwards.
        this.place(prev + (cur - prev) * (done || held ? 1 : Math.min(1, acc / step)), dt)
        // Re-asserted every frame: the rig puts the world's own zoom back on a
        // viewport resize, and a ride that lost its close-up half way round would
        // never get it back.
        this.zoom()
      }

      this.scene.events.on(Phaser.Scenes.Events.UPDATE, tick)
      // Quitting to the title tears the scene down mid-ride. `run()` owns that
      // listener — it has to be armed before the opening fade, which is an await
      // this method never gets to — and hands the news down as `gone`. There will
      // be no further ticks once the scene has stopped, so this is the only thing
      // that can end the ride from here.
      void gone.then(finish)
    })
  }

  /** Put the cart (and the camera's proxy) at arc length `s`. */
  private place(s: number, dt: number): void {
    const p = sampleAt(COASTER_PATH, TABLE, s)
    const x = ORIGIN_X + p.x
    const y = ORIGIN_Y + p.y
    this.proxy.x = x
    this.proxy.y = y
    this.proxy.dir = Math.abs(p.dx) > Math.abs(p.dy) ? (p.dx < 0 ? 'left' : 'right') : p.dy < 0 ? 'up' : 'down'
    this.proxy.moving = true
    if (!this.cart) return

    // The cart art faces right, and the first third of the circuit runs left along
    // the transfer track: mirror it there and rotate the *reversed* tangent, so the
    // body stays the right way up while it runs backwards to the lift. Inside the
    // loop the mirror is dropped — an inversion is the one place the cart really is
    // upside down, and the full tangent is what says so. Both rules agree at the
    // loop's mouth (the track runs rightwards there), so the change is invisible.
    const zone = zoneAt(COASTER_PATH, TABLE, s)
    const flip = zone !== 'loop' && p.dx < 0
    const target = flip ? Math.atan2(-p.dy, -p.dx) : Math.atan2(p.dy, p.dx)
    if (flip !== this.flipped) {
      // A turnaround, not a corner: the cart mirrors, it does not spin through.
      this.flipped = flip
      this.angle = target
    } else {
      let d = target - this.angle
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      const limit = MAX_SPIN * Math.max(dt, 1 / 240)
      this.angle += Math.abs(d) > limit ? Math.sign(d) * limit : d
    }
    // Hands up on the drops and through the loop, back in the seat everywhere else.
    const want = zone === 'drop' || zone === 'loop' ? CART_HANDS : CART_SEATED
    if (want !== this.frame) {
      this.frame = want
      if (hasFrame(this.scene, want)) this.cart.setFrame(want)
    }
    this.cart.setPosition(x, y)
    this.cart.setFlipX(this.flipped)
    this.cart.setRotation(this.angle)
  }

  /**
   * Chain clicks on the hill, a whoosh and a nudge at the head of every drop.
   *
   * Silent inside a beat's own window: two of the five beats sit exactly on a
   * crest, and a whoosh played while the cart is crawling past its card at 40 px/s
   * is a promise the next half second does not keep. Held back that way, the cue
   * lands on the far side of the card as the cart tips over — which is where it
   * was always meant to be.
   */
  private cues(s: number, dt: number): void {
    if (stopWindow(COASTER_STOPS, TABLE, s) >= 0) return
    const zone = zoneAt(COASTER_PATH, TABLE, s)
    if (zone === 'lift') {
      this.clickT += dt * 1000
      if (this.clickT >= CLICK_MS) {
        this.clickT = 0
        sfx.blip()
      }
    } else this.clickT = CLICK_MS
    if (zone === 'drop' && this.lastZone !== 'drop') {
      sfx.swing()
      if (!this.reduced) this.rig.shake(0.003, 180)
    }
    this.lastZone = zone
  }

  private zoom(): void {
    if (this.reduced) return
    const want = pickZoom(this.scene.scale.width, this.scene.scale.height) * RIDE_ZOOM
    if (this.rig.cam.zoom !== want) this.rig.cam.setZoom(want)
  }

  /** Hand the camera back to whoever it was on — the player, if it can follow one. */
  private refollow(): void {
    const f = this.player as Partial<Followable>
    if (typeof f.dir === 'string' && typeof f.moving === 'boolean') {
      this.rig.follow(this.player as unknown as Followable, false)
      return
    }
    // Nothing to follow: park the camera where the rider is standing and drop the
    // target, or the rig would go on lerping towards a proxy that stopped being
    // updated the moment the ride ended.
    this.rig.target = null
    this.rig.snapTo(this.player.x, this.player.y)
  }

  /* ---------------- the cards ---------------- */

  private showCard(stop: Stop): void {
    this.cardUp = true
    events.emit('ui:panel', { id: 'ridecard', data: stop })
  }

  private hideCard(): void {
    if (!this.cardUp) return
    this.cardUp = false
    events.emit('ui:panel', { id: 'ridecard', data: null })
  }

  /* ---------------- the payout ---------------- */

  /**
   * Two chapters, a badge and — the first time only — the XP. `announce: false` on
   * both chapters: the Career card *is* the announcement, and a pair of "new
   * chapter" cards opening over it would say the same thing twice and worse.
   */
  private grant(): void {
    const first = !this.state.flag(RIDDEN)
    this.state.unlockFacet('education', false)
    this.state.unlockFacet('experience', false)
    this.state.ach.unlock('ride')
    if (first) {
      this.state.setFlag(RIDDEN)
      this.state.addXp(RIDE_XP)
    }
    events.emit('ui:panel', { id: 'career' })
    events.emit('ride:done', { id: 'coaster' })
  }
}
