// The fairground. Runs in 'title' mode (attract camera, no player) and 'play'
// mode. There are no interiors: every attraction is an outdoor booth with a door
// tile, and the door hands off to a mini-game, a card, the ride, or Bo.
import Phaser from 'phaser'
import { ATLAS, frameDataURL, hasFrame } from '../art/atlas'
import { sfx } from '../audio/sfx'
import { soundtrack } from '../systems/Soundtrack'
import { uiState, type Objective } from '../ui/state'
import { TILE, WORLD_H, WORLD_SEED, WORLD_W } from '../config'
import { events, touchInput } from '../core/events'
import { hooks } from '../core/hooks'
import { isBound, keys } from '../core/keys'
import { makeRng, type Rng } from '../core/rng'
import { hadLegacySave, loadSave, loadSettings, type Save, type Settings } from '../core/save'
import { Chest } from '../entities/Chest'
import { Companion } from '../entities/Companion'
import { Critters } from '../entities/Critters'
import { Grass } from '../entities/Grass'
import { Lamp } from '../entities/Lamp'
import { Npc, type NpcDef } from '../entities/Npc'
import { Packet } from '../entities/Packet'
import { Player } from '../entities/Player'
import { Sign } from '../entities/Sign'
import { restore } from '../games/forge'
import { ZONES } from '../data/content'
import { DUCK_NAMES, landDuck } from '../data/ducks'
import { greetFlag } from '../data/npcs'
import { signById } from '../data/signs'
import { STATIONS, stationSpot, type StoryStep } from '../data/story'
import { CameraRig } from '../systems/CameraRig'
import { Coaster } from '../systems/Coaster'
import { Cutscene } from '../systems/Cutscene'
import { DayNight } from '../systems/DayNight'
import { DialogueRunner, type Tree } from '../systems/Dialogue'
import { getTree, linesTree, npcInfo } from '../systems/DialogueRegistry'
import { Ducks } from '../systems/Ducks'
import { GameState } from '../systems/GameState'
import { InteractSystem, type Interactable } from '../systems/Interact'
import { minigames } from '../systems/Minigame'
import { Water } from '../systems/Water'
import { Weather } from '../systems/Weather'
import { Wind } from '../systems/Wind'
import { BLUEPRINT, attractionSolids, boundarySolids, type Attraction, type Rect, type Structure } from '../world/blueprint'
import type { Blocked, Solid } from '../world/collision'
import { planHop } from '../world/hop'
import { regionAt, type Vec2 } from '../world/regions'
import type { Decor } from '../world/scatter'
import { HOPPABLE_TERRAIN, LOW_KINDS, isWalkable, type Grid } from '../world/terrain'
import type { WorldData } from './BootScene'
import type { Dir } from '../entities/Player'

/** How the world scene is running: the attract screen, or an actual run. */
export type Mode = 'title' | 'play'

/** Unit step per facing, so a hop reads the way you are pointed. */
const FACING: Record<Dir, { sx: number; sy: number }> = {
  up: { sx: 0, sy: -1 },
  right: { sx: 1, sy: 0 },
  down: { sx: 0, sy: 1 },
  left: { sx: -1, sy: 0 },
}

/**
 * The midway fountain, in world pixels — where the fair throws its own party.
 * Read off the prop so a nudged layout takes the fireworks with it; the middle
 * of the paving is a decent fallback if the fountain is ever taken out.
 */
function fountainAt(): { x: number; y: number } {
  const p = BLUEPRINT.props.find((q) => q.kind === 'fountain')
  return p ? { x: (p.x + 0.5) * TILE, y: p.y * TILE } : { x: 35.5 * TILE, y: 41 * TILE }
}

/**
 * Where every lit overlay goes. `DayNight` lays its darkness veil at 90000 and
 * its light pools at 90500, so anything that is meant to *glow* has to be drawn
 * over both — a night frame sorted with its own structure is simply graded dark
 * along with it. Only the lit pixels of a `_night` frame are opaque, so nothing
 * of the world is hidden by this.
 */
const NIGHT_GLOW_DEPTH = 91000

/** Play a sound by name if the audio module provides it (some land later). */
const play = (name: string, fallback?: string) => {
  const table = sfx as unknown as Record<string, (() => void) | undefined>
  const fn = table[name] ?? (fallback ? table[fallback] : undefined)
  fn?.()
}

// Only the kinds `world/scatter.ts` actually emits on the fairground. The
// island's palms, pines, rocks, mushrooms, shells, stumps and logs went with the
// coastline; a kind with no entry here simply is not drawn.
const DECOR_FRAME: Record<string, (v: number) => string> = {
  tree: (v) => `tree_${v % 2}`,
  bush: (v) => `bush_${v % 2}`,
  flower: (v) => `flower_${v % 4}`,
  fence: (v) => (v === 0 ? 'fence_h' : v === 1 ? 'fence_v' : 'fence_post'),
  lamp: () => 'lamp',
  bench: () => 'bench',
  lily: (v) => `lily_${v % 2}`,
  reed: (v) => `reed_${v % 2}`,
  flowerbed: () => 'flowerbed',
  /** Triangle flags strung between two lamp posts — one 96×24 def, hung on its rope line. */
  bunting: () => 'bunting',
}

const SOLID_BOX: Record<string, { w: number; h: number }> = {
  tree: { w: 12, h: 8 },
  bush: { w: 14, h: 8 },
  fence: { w: 16, h: 6 },
  lamp: { w: 6, h: 5 },
  bench: { w: 22, h: 8 },
}

// Everybody who works the fair stands on it: there are no rooms to hide a host
// in any more. Bo is idle by design — he holds his station until the story
// moves it (`relocateBo`).
const NPC_CAST: NpcDef[] = [
  { id: 'dockmaster', name: 'Bo', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'professor', name: 'Prof. Iyer', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'sol', name: 'Operator Sol', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'ravi', name: 'Tinker Ravi', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'arjun', name: 'Arjun', x: 0, y: 0, behaviour: { kind: 'wander', radius: 36 } },
  { id: 'mira', name: 'Captain Mira', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'tomas', name: 'Old Tomas', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'pip', name: 'Pip', x: 0, y: 0, behaviour: { kind: 'wander', radius: 48 } },
  { id: 'ilse', name: 'Keeper Ilse', x: 0, y: 0, behaviour: { kind: 'wander', radius: 20 } },
]

/**
 * The guide's pace, in px/s — near enough the hero's own, because every walk Bo
 * takes is one you are watching or following. The villager amble (38) is for
 * people who are staying put.
 */
const BO_WALK_SPEED = 110
/** The same legs on the arrival walk-on, where a `Cutscene` drives them. */
const BO_ARRIVAL_SPEED = 130

/** Errands you can be handed, and the stall keeper who hands each one over. */
const QUEST_GIVERS: Record<string, string> = { pip: 'balloons', tomas: 'ducks', ilse: 'lights' }

type Cullable = { obj: Phaser.GameObjects.Components.Visible; x0: number; y0: number; x1: number; y1: number }

/** A structure that stands until its flag is set — the two turnstiles, so far. */
type Gate = { flag: string; open: boolean; imgs: Phaser.GameObjects.Image[]; solids: Solid[] }

export class WorldScene extends Phaser.Scene {
  mode: Mode = 'title'
  grid!: Grid
  decor: Decor[] = []
  /** Everything you cannot walk through. */
  solids: Solid[] = []
  /** The subset a hop cannot clear — the perimeter wall, every booth, the rides. */
  hardSolids: Solid[] = []
  player!: Player
  rig!: CameraRig
  state!: GameState
  settings!: Settings
  dayNight!: DayNight
  weather!: Weather
  wind!: Wind
  water!: Water
  critters!: Critters
  interact = new InteractSystem()
  private rng!: Rng
  private cullables: Cullable[] = []
  private cullTimer = 0
  private locked = false
  private stopDrift: (() => void) | null = null
  private regionId = ''
  private unsub: (() => void)[] = []
  private packets: Packet[] = []
  private grasses: Grass[] = []
  private signs: Sign[] = []
  private chests: Chest[] = []
  private npcs: Npc[] = []
  private companion: Companion | null = null
  /** Door interactable per attraction id — the map's travel target resolves through these. */
  private doors = new Map<string, Interactable>()
  private gates: Gate[] = []
  /** The `stringlight_night` overlays: lit only once Ilse's switch has been thrown. */
  private lightGlow: Phaser.GameObjects.Image[] = []
  private tintables: Phaser.GameObjects.Components.Tint[] = []
  private flowerSpots: { x: number; y: number }[] = []
  private woodsSpots: { x: number; y: number }[] = []
  private autosaveT = 0
  private stateT = 0
  private playT = 0
  private stepAcc = 0
  private runAcc = 0
  private reduced = false
  /** Directional input was held this frame — a hop reads it rather than actual travel. */
  private wantsMove = false
  private inCutscene = false
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter
  private grassBits!: Phaser.GameObjects.Particles.ParticleEmitter

  constructor() {
    super('world')
  }

  create(data: { mode?: Mode; save?: Save | null }) {
    this.resetBuild()
    this.mode = data.mode ?? 'title'
    this.settings = loadSettings()
    this.reduced = this.settings.reducedMotion
    const world = this.registry.get('world') as WorldData
    this.grid = world.grid
    this.decor = world.decor
    this.rng = makeRng(WORLD_SEED).fork('scene')

    this.buildGround(world)
    this.dayNight = new DayNight(this, 60, this.reduced)
    this.wind = new Wind(this, this.reduced)
    // Structures first, attractions second: the coaster station shares a bottom
    // edge with `coaster_span_2`, and at equal depth Phaser keeps the order they
    // were added in — so the station has to be the later of the two.
    this.buildStructures()
    this.buildAttractions()
    this.buildBoundary()
    this.buildDecor()
    this.buildStringLights()
    this.buildProps()
    this.buildParticles()
    this.water = new Water(this, this.grid, BLUEPRINT.river.pts, this.rng.fork('water'), this.reduced)
    this.weather = new Weather(this, this.grid, this.rng.fork('weather'), this.reduced)
    this.critters = new Critters(this, this.grid, this.rng.fork('critters'), this.flowerSpots, this.woodsSpots, this.reduced)
    this.dayNight.registerTinted(this.tintables)
    this.rig = new CameraRig(this)
    this.rig.shakeEnabled = this.settings.shake && !this.reduced

    const onKey = (e: KeyboardEvent) => {
      if (!this.scene.isActive() || document.body.classList.contains('modal-open')) return
      if (isBound(e, 'jump')) this.onJump()
      else if (e.code === 'KeyE' || e.code === 'Enter') this.onAction()
      else if (e.code === 'Escape') setTimeout(() => this.onMenu(), 0) // defer past the modal layer's same-event Escape handling
      else if (e.code === 'KeyM') this.onPanel('map')
      else if (e.code === 'KeyJ') this.onPanel('journal')
    }
    this.unsub.push(keys.onDown(onKey))

    this.unsub.push(events.on('ui:lock', ({ locked }) => this.setLocked(locked)))
    this.unsub.push(events.on('game:new', () => this.startPlay(null, true)))
    this.unsub.push(events.on('game:continue', () => this.startPlay(loadSave(), false)))
    this.unsub.push(events.on('game:title', () => this.backToTitle()))
    this.unsub.push(events.on('world:travel', ({ id }) => this.travelTo(id)))
    this.unsub.push(
      events.on('world:action', ({ action }) =>
        action === 'interact' ? this.onAction() : action === 'jump' ? this.onJump() : action === 'menu' ? this.onMenu() : this.onPanel(action),
      ),
    )
    this.unsub.push(events.on('settings:changed', () => this.applySettings()))
    // The story moved on: re-point the chip and send Bo to his new station.
    this.unsub.push(
      events.on('story:changed', () => {
        this.refreshObjective()
        this.relocateBo()
      }),
    )
    this.unsub.push(events.on('facet:unlocked', () => this.refreshObjective()))
    this.unsub.push(events.on('game:reader', () => this.state?.ach.unlock('well_read')))
    // The ticket is the one thing that changes the shape of the park, so the
    // turnstiles are checked the moment a cabinet shuts rather than on the tick.
    this.unsub.push(events.on('ui:closed', ({ id }) => id === 'minigame' && this.syncGates(true)))
    // Phaser leaves scene-level listeners in place across `restart()`, so the
    // shutdown hook has to take them off by hand.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u()
      this.unsub = []
    })

    if (this.mode === 'title') this.enterTitle()
    else this.startPlay(data.save ?? null, false)
  }

  /* ---------------- construction ---------------- */

  /**
   * Phaser reuses the scene instance across `restart()` (title → play → title),
   * so every list the build pushes into has to start empty or the second pass
   * doubles the fair and keeps hold of destroyed sprites.
   */
  private resetBuild() {
    this.solids = []
    this.hardSolids = []
    this.cullables = []
    this.tintables = []
    this.packets = []
    this.grasses = []
    this.signs = []
    this.chests = []
    this.npcs = []
    this.flowerSpots = []
    this.woodsSpots = []
    this.doors.clear()
    this.gates = []
    this.lightGlow = []
    this.interact = new InteractSystem()
    this.companion = null
    this.regionId = ''
    this.inCutscene = false
    this.locked = false
    // The hero and the run go with the old scene: keeping them would let a
    // later ui:lock (opening Settings from the title, say) call freeze() on a
    // destroyed Player, whose anims Phaser has already nulled. `backToTitle`
    // persists the save before restarting, so nothing is lost here.
    this.player = undefined!
    this.state = undefined!
  }

  private buildGround(world: WorldData) {
    for (const c of world.chunks) {
      const img = this.add.image(c.x, c.y, c.key).setOrigin(0).setDepth(-10000)
      this.cullables.push({ obj: img, x0: c.x, y0: c.y, x1: c.x + img.width, y1: c.y + img.height })
      this.tintables.push(img)
    }
  }

  /** Tile rectangle → world pixels. */
  private pxRect(r: Rect): Solid {
    return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE }
  }

  /**
   * Draw a thing placed by footprint — a structure or an attraction. Centred on
   * the footprint and standing on its bottom edge, so a sprite that is taller
   * than `h` tiles grows upward and one that is wider than its plot (the pond
   * stall) overhangs evenly. `${sprite}_night` is the lit overlay, faded in with
   * the warmth exactly as the island's buildings were.
   */
  private drawFootprint(sprite: string, tx: number, ty: number, w: number, h: number): Phaser.GameObjects.Image[] {
    const out: Phaser.GameObjects.Image[] = []
    if (!hasFrame(this, sprite)) return out
    const x = (tx + w / 2) * TILE
    const y = (ty + h) * TILE
    const img = this.add.image(x, y, ATLAS, sprite).setOrigin(0.5, 1).setDepth(y)
    out.push(img)
    this.cullables.push({ obj: img, x0: img.x - img.width, y0: img.y - img.height, x1: img.x + img.width, y1: img.y + 8 })
    this.tintables.push(img)
    if (hasFrame(this, `${sprite}_night`)) {
      // Above `DayNight`'s veil (depth 90000) and out of `tintables`: an overlay
      // under the veil is graded down by the very darkness it is meant to break,
      // which is a lit coaster you cannot see. Same treatment the island gave
      // its buildings.
      const night = this.add.image(x, y, ATLAS, `${sprite}_night`).setOrigin(0.5, 1).setDepth(NIGHT_GLOW_DEPTH).setAlpha(0)
      this.dayNight.onWarmth((warm) => night.setAlpha(warm))
      out.push(night)
    }
    return out
  }

  /**
   * The rides, the booth and the two turnstiles. A `gate` structure is standing
   * only while its flag is unset; the solids are registered either way and
   * `syncGates` lifts them the moment the flag flips (there is no `GameState`
   * yet at build time — the title screen has no save at all).
   */
  private buildStructures() {
    for (const s of BLUEPRINT.structures) {
      const imgs = this.drawFootprint(s.sprite, s.tx, s.ty, s.w, s.h)
      if (s.sprite === 'ferris_wheel') this.buildFerrisRim(s)
      const solids = s.solid.map((r) => this.pxRect(r))
      for (const solid of solids) this.addSolid(solid)
      if (s.gate) this.gates.push({ flag: s.gate, open: false, imgs, solids })
    }
  }

  /**
   * The wheel itself, turning behind its A-frame. The base def is 256×320 with
   * the axle at (128,128), and the base is drawn centred on its footprint
   * standing on the bottom edge — so the hub is one half-width in and 192 px up.
   */
  private buildFerrisRim(s: Structure) {
    if (!hasFrame(this, 'ferris_rim_0')) return
    const x = (s.tx + s.w / 2) * TILE
    const y = (s.ty + s.h) * TILE
    if (!this.anims.exists('ferris_rim')) {
      this.anims.create({ key: 'ferris_rim', frames: [0, 1, 2, 3].map((i) => ({ key: ATLAS, frame: `ferris_rim_${i}` })), frameRate: 3, repeat: -1 })
    }
    const rim = this.add.sprite(x, y - 192, ATLAS, 'ferris_rim_0').setDepth(y - 1)
    rim.play('ferris_rim')
    this.cullables.push({ obj: rim, x0: rim.x - rim.width, y0: rim.y - rim.height, x1: rim.x + rim.width, y1: rim.y + rim.height })
    this.tintables.push(rim)
  }

  /**
   * The eight attractions: sprite, footprint solids, and one door interactable
   * apiece. Everything the fair has to say is behind one of these doors, so the
   * dispatch (`Attraction.interact`) is the whole content routing table.
   */
  private buildAttractions() {
    for (const a of BLUEPRINT.attractions) {
      this.drawFootprint(a.sprite, a.tx, a.ty, a.w, a.h)
      for (const r of attractionSolids(a)) this.addSolid(this.pxRect(r))
      const dx = a.door.x * TILE + TILE / 2
      const dy = a.door.y * TILE + TILE / 2
      this.dayNight.addLight({ x: dx, y: dy - 10, r: 34, color: 0xffc070 })
      const door: Interactable = {
        x: dx,
        y: dy,
        radius: 26,
        prompt: a.name,
        // One rung above the cast: a keeper who wanders onto the door tile must
        // not swallow the door (Ilse stood on the guestbook's step and E talked
        // to her instead of opening the book). Within a door's reach the door
        // wins; a step to the side, beside the keeper, and you talk to them.
        priority: 4,
        onInteract: () => void this.useAttraction(a),
      }
      this.interact.add(door)
      this.doors.set(a.id, door)
    }
  }

  /**
   * The perimeter. This — not the `fence` decor along the same line — is what
   * encloses the park: hard, full-tile rectangles that no hop clears. The
   * carpentry stays low so hopping a fence still reads inside the park.
   */
  private buildBoundary() {
    for (const r of boundarySolids(BLUEPRINT)) this.addSolid(this.pxRect(r))
  }

  private buildDecor() {
    for (const d of this.decor) {
      if (d.kind === 'grass') {
        const g = new Grass(this, d.x, d.y, d.v)
        this.grasses.push(g)
        this.tintables.push(g.sprite)
        continue
      }
      const fn = DECOR_FRAME[d.kind]
      const fr = fn ? fn(d.v) : null
      if (!fr || !hasFrame(this, fr)) continue
      const img = this.add.image(Math.round(d.x), Math.round(d.y), ATLAS, fr)
      const flat = d.kind === 'flower' || d.kind === 'lily' || d.kind === 'flowerbed'
      img.setDepth(flat ? d.y - 4000 : d.y)
      if (d.kind === 'tree') {
        img.setFlipX(d.v === 1)
        this.wind.registerTree(img)
      }
      this.cullables.push({ obj: img, x0: img.x - img.width, y0: img.y - img.height, x1: img.x + img.width, y1: img.y + 8 })
      this.tintables.push(img)
      if (d.kind === 'flower') this.flowerSpots.push({ x: d.x, y: d.y })
      if (d.kind === 'tree' && regionAt(BLUEPRINT.regions, d.x / TILE, d.y / TILE)?.id === 'picnic') this.woodsSpots.push({ x: d.x, y: d.y })
      if (d.kind === 'lamp') new Lamp(this, d.x, d.y, this.dayNight)
      if (d.solid) {
        const b = SOLID_BOX[d.kind] ?? { w: 10, h: 6 }
        this.addSolid({ x: d.x - b.w / 2, y: d.y - b.h + 1, w: b.w, h: b.h }, LOW_KINDS.has(d.kind))
      }
    }
  }

  /**
   * A light pole under every string of bunting. The poles stand all season; the
   * bulbs only burn once Ilse's switch has been thrown, and then only after
   * dark — which is exactly what her errand is for.
   */
  private buildStringLights() {
    if (!hasFrame(this, 'stringlight')) return
    for (const d of this.decor) {
      if (d.kind !== 'bunting') continue
      const x = Math.round(d.x)
      const y = Math.round(d.y)
      const pole = this.add.image(x, y, ATLAS, 'stringlight').setDepth(d.y - 2)
      this.cullables.push({ obj: pole, x0: pole.x - pole.width, y0: pole.y - pole.height, x1: pole.x + pole.width, y1: pole.y + 8 })
      this.tintables.push(pole)
      if (!hasFrame(this, 'stringlight_night')) continue
      const glow = this.add.image(x, y, ATLAS, 'stringlight_night').setDepth(NIGHT_GLOW_DEPTH).setAlpha(0)
      this.dayNight.onWarmth((warm) => glow.setAlpha(this.state?.flag('lights') ? warm : 0))
      this.lightGlow.push(glow)
    }
  }

  /** Register a solid. Low ones block walking but a hop sails over them. */
  private addSolid(s: Solid, low = false) {
    this.solids.push(s)
    if (!low) this.hardSolids.push(s)
  }

  private removeSolid(s: Solid) {
    const i = this.solids.indexOf(s)
    if (i >= 0) this.solids.splice(i, 1)
    const j = this.hardSolids.indexOf(s)
    if (j >= 0) this.hardSolids.splice(j, 1)
  }

  private buildProps() {
    for (const p of BLUEPRINT.props) {
      const x = p.x * TILE + TILE / 2
      const y = (p.y + 1) * TILE
      let img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | null = null
      if (p.kind === 'fountain' && hasFrame(this, 'fountain_0')) {
        const s = this.add.sprite(x, y, ATLAS, 'fountain_0').setDepth(y)
        if (this.anims.exists('fountain')) s.play('fountain')
        img = s
      } else if (hasFrame(this, p.kind)) img = this.add.image(x, y, ATLAS, p.kind).setDepth(y)
      if (img) {
        this.cullables.push({ obj: img, x0: img.x - img.width, y0: img.y - img.height, x1: img.x + img.width, y1: img.y + 8 })
        this.tintables.push(img)
      }
      if (p.solid) this.addSolid(this.pxRect(p.solid), LOW_KINDS.has(p.kind))
      const signDef = p.kind === 'sign_finger' ? signById(p.id ?? '') : undefined
      if (signDef) {
        const s = new Sign(this, img ?? this.add.image(x, y, ATLAS, 'sign_finger').setDepth(y), signDef, (id) => this.readSign(id))
        this.signs.push(s)
        this.interact.add(s.interactable)
      } else if (p.kind === 'board_forge') {
        // The booth's prize board: what the bench has spelled so far, read from
        // outside without starting a round.
        //
        // The interact point is the *centre of the tile below the board*, not
        // the board's own foot: the board's tile is solid, so a point on its
        // edge leaves only a half-tile band of standing positions that can reach
        // it and the prompt never appears. The doors do the same thing at r=26.
        this.interact.add({ x, y: y + TILE / 2, radius: 28, prompt: 'Read the board', onInteract: () => this.openPanel('forgeboard') })
      }
    }
    // lost tickets & prize boxes
    for (let i = 0; i < BLUEPRINT.packetSpots.length; i++) {
      const p = BLUEPRINT.packetSpots[i]
      this.packets.push(new Packet(this, `p${i}`, p.x * TILE + 8, p.y * TILE + 12, this.reduced))
    }
    BLUEPRINT.chestSpots.forEach((c, i) => {
      const ch = new Chest(this, `c${i}`, c.x * TILE + 8, c.y * TILE + 14, false, (chest) => this.openChest(chest))
      this.chests.push(ch)
      this.interact.add(ch.interactable)
      this.addSolid({ x: ch.x - 7, y: ch.y - 6, w: 14, h: 6 })
      this.tintables.push(ch.sprite)
    })
    // stray balloons — Pip's errand, the shell pickup under a fairground name
    BLUEPRINT.shellSpots.forEach((s, i) => this.makeBalloonPickup(`b${i}`, s))
    // the pond edge: where the hoop actually goes in the water
    const f = BLUEPRINT.fishingSpot
    this.interact.add({
      x: f.x * TILE + TILE / 2,
      y: f.y * TILE + TILE / 2,
      radius: 28,
      prompt: 'Hook a duck',
      onInteract: () => void this.hookADuck(),
      enabled: () => !!this.state && this.state.quests.isStarted('ducks'),
    })
    // The turnstiles, while they are still standing. One line, and it is always
    // the same line: the way in is a ticket, and Bo sells the tickets. Placed on
    // the apron side of the gateway (radius 34 reaches the row you queue on but
    // not the arch's own door tile behind you), and gone with the flag.
    const gap = BLUEPRINT.gateOpening
    this.interact.add({
      x: (gap.x + gap.w / 2) * TILE,
      y: (gap.y + 1) * TILE,
      radius: 34,
      prompt: 'Turnstile',
      priority: 1,
      enabled: () => !!this.state && !this.state.flag('ticket'),
      onInteract: () => {
        const tree = getTree('gate')
        if (tree) void this.runDialogue(tree)
        else play('bonk', 'bump')
      },
    })
    // Ilse's switch, on the east wall of Bo's ticket booth — read off the booth
    // itself, so a layout nudge moves the switch with it rather than stranding
    // her errand somewhere unreachable. The booth stands *within* the fence (Bo
    // serves the window across it), so the apron side is no good: the switch has
    // to be reachable from the park, and the east wall faces the gate arch's
    // pillar down a one-tile corridor. Radius 26 covers the two tiles of that
    // corridor beside the wall, and nothing else.
    const booth = BLUEPRINT.structures.find((s) => s.sprite === 'ticket_booth')
    if (booth)
      this.interact.add({
        x: (booth.tx + booth.w) * TILE,
        y: (booth.ty + booth.h - 1) * TILE,
        radius: 26,
        prompt: 'Fair lights',
        priority: 1,
        enabled: () => !!this.state && this.state.quests.isStarted('lights') && !this.state.quests.isDone('lights'),
        onInteract: () => this.throwLightSwitch(),
      })
  }

  private makeBalloonPickup(id: string, spot: Vec2) {
    const x = spot.x * TILE + TILE / 2
    const y = spot.y * TILE + TILE / 2
    const flag = `balloon_${id}`
    const img = hasFrame(this, 'balloons') ? this.add.image(x, y, ATLAS, 'balloons').setDepth(y) : null
    if (img) {
      this.cullables.push({ obj: img, x0: img.x - img.width, y0: img.y - img.height, x1: img.x + img.width, y1: img.y + 8 })
      this.tintables.push(img)
    }
    const it: Interactable = {
      x,
      y,
      radius: 20,
      prompt: 'Take the balloon',
      enabled: () => !!this.state && !this.state.flag(flag),
      onInteract: () => {
        if (!this.state || this.state.flag(flag)) return
        this.state.setFlag(flag)
        this.state.give('shell', 1)
        this.state.quests.advance('balloons', 'find', 1)
        sfx.pickup()
        this.sparks.emitParticleAt(x, y - 4, 6)
        events.emit('ui:toast', { kind: 'item', icon: '🎈', title: 'Stray balloon' })
        if (img) this.tweens.add({ targets: img, y: img.y - 18, alpha: 0, duration: 300, onComplete: () => img.destroy() })
        this.interact.remove(it)
      },
    }
    this.interact.add(it)
    // A balloon already taken in an earlier session is simply not there.
    this.time.delayedCall(0, () => {
      if (this.state?.flag(flag)) {
        img?.destroy()
        this.interact.remove(it)
      }
    })
  }

  private buildParticles() {
    this.dust = this.add.particles(0, 0, ATLAS, { frame: 'dust', lifespan: 380, speed: { min: 6, max: 22 }, scale: { start: 1, end: 0 }, alpha: { start: 0.8, end: 0 }, quantity: 1, frequency: -1 }).setDepth(-3000)
    this.sparks = this.add.particles(0, 0, ATLAS, { frame: 'spark', lifespan: 520, speed: { min: 30, max: 90 }, scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 }, quantity: 1, frequency: -1 }).setDepth(70000)
    this.grassBits = this.add.particles(0, 0, ATLAS, { frame: 'leaf', lifespan: 480, speed: { min: 20, max: 70 }, gravityY: 120, rotate: { start: 0, end: 180 }, alpha: { start: 1, end: 0 }, quantity: 1, frequency: -1 }).setDepth(69000)
  }

  private buildNpcs() {
    for (const def of NPC_CAST) {
      const spot = BLUEPRINT.npcSpots[def.id]
      if (!spot) continue
      const npc = new Npc(this, { ...def, x: spot.x * TILE + 8, y: spot.y * TILE + 12 })
      // Bo is the only one of them going anywhere: the story moves his station
      // across the whole fair (`relocateBo`) and the player is meant to be able
      // to follow him there. At the villager amble that walk was a trudge, so
      // the guide gets a stride of his own; everybody else keeps the default.
      if (def.id === 'dockmaster') npc.walkSpeed = BO_WALK_SPEED
      this.npcs.push(npc)
      this.tintables.push(npc.sprite)
      this.interact.add({
        get x() {
          return npc.x
        },
        get y() {
          return npc.y
        },
        radius: 26,
        prompt: `Talk to ${def.name}`,
        priority: 3,
        onInteract: () => this.talkTo(npc),
      })
    }
  }

  /* ---------------- modes ---------------- */

  private enterTitle() {
    // A lap of the fairground, well inside the 72×56 map so the camera never
    // parks against a bound: gate → midway → prize row → coaster hill → the
    // wheel → back down the east side.
    const pts = [
      { x: 36 * TILE, y: 50 * TILE },
      { x: 22 * TILE, y: 42 * TILE },
      { x: 16 * TILE, y: 28 * TILE },
      { x: 34 * TILE, y: 14 * TILE },
      { x: 56 * TILE, y: 20 * TILE },
      { x: 52 * TILE, y: 44 * TILE },
    ]
    this.stopDrift = this.rig.drift(pts, 12000)
    soundtrack.title()
    events.emit('ui:hud', { visible: false })
    events.emit('ui:title', { hasSave: !!loadSave() })
  }

  private startPlay(save: Save | null, fresh: boolean) {
    if (this.mode === 'play' && this.player) return
    this.mode = 'play'
    this.stopDrift?.()
    this.stopDrift = null
    this.rig.release()
    this.state = new GameState(save)
    this.registry.set('state', this.state)
    // The mini-game host lives in the DOM layer and has no registry to read:
    // hand it the save the moment there is one, so its rewards land.
    minigames.state = this.state
    uiState.quests = this.state.quests
    uiState.achievements = this.state.ach
    uiState.xp = this.state.xp
    // Live views, not copies: the wardrobe panel reads whatever the save says at
    // the moment it opens.
    uiState.wardrobe = this.state.wardrobeView()
    uiState.flags = this.state.save.flags
    uiState.faces = (f) => frameDataURL(f, 3)
    const minimapSrc = this.textures.exists('minimap') ? (this.textures.get('minimap').getSourceImage() as HTMLCanvasElement) : null
    if (minimapSrc && minimapSrc.toDataURL) uiState.minimapURL = minimapSrc.toDataURL()
    this.state.handlers = {
      sleep: (to) => this.sleep(to),
      // A dialogue that offers a game opens the cabinet through the panel layer;
      // the host mounts it and hands the reward back to this same save.
      minigame: (id) => events.emit('ui:panel', { id: 'minigame', data: id }),
      teleport: (id) => this.travelTo(id),
      cutscene: (id) => void this.runCutscene(id),
      panel: (id) => this.openPanel(id),
      companion: (on) => this.setCompanion(on),
      sfx: (id) => (sfx as unknown as Record<string, (() => void) | undefined>)[id]?.(),
      hat: (id) => this.player?.setHat(id),
      isNight: () => this.dayNight.isNight,
      // Two endings, one set of fireworks. Finishing Bo's tour is not finishing
      // the fair, and the banner has to say so — otherwise the last chapter
      // congratulates you on a hundred per cent you have not reached. The story
      // fireworks go up over the midway fountain, wherever you happen to be.
      celebrate: (reason) => {
        const banner =
          reason === 'story'
            ? { title: 'The whole story', sub: 'Gate to guestbook. Stay as long as you like.' }
            : { title: '100%', sub: 'You found everything. Thank you for exploring!' }
        events.emit('ui:banner', banner)
        // Over the midway fountain, as the fair's own celebration — and over
        // the player too, because the last chapter is signed at the guestbook
        // twenty tiles away and a firework you cannot see is not a finale.
        if (reason === 'story') {
          const f = fountainAt()
          this.setFireworks(f.x, f.y)
        }
        this.setFireworks(this.player?.x ?? 35 * TILE, (this.player?.y ?? 42 * TILE) - 30)
        soundtrack.fanfare()
      },
    }
    this.dayNight.setTime(save ? save.time : 60)
    this.weather.set(save?.weather ?? 'clear', true)
    this.weather.onChange = (s) => {
      if (s === 'rain') {
        this.state.ach.unlock('rain_dancer')
        play('rain_start')
      }
      this.dayNight.setExtraDark(s === 'rain' ? 0.18 : 0)
      this.wind.strength = this.weather.windStrength
      this.refreshSoundtrack()
      this.emitState()
    }
    this.wind.strength = this.weather.windStrength
    this.dayNight.onPhase = (p) => {
      if (p === 'dawn') this.weather.roll()
      if (p === 'night') this.state.ach.unlock('night_owl')
      this.refreshSoundtrack()
    }
    const sx = save && save.scene !== 'title' && save.x > 0 ? save.x : BLUEPRINT.spawn.x * TILE + TILE / 2
    const sy = save && save.scene !== 'title' && save.y > 0 ? save.y : BLUEPRINT.spawn.y * TILE + TILE / 2
    this.player = new Player(this, sx, sy)
    this.player.alwaysRun = this.settings.alwaysRun
    this.player.reducedMotion = this.reduced
    this.player.setHat(this.state.save.hat || null)
    this.player.onStep = (surface) => {
      const fn = (sfx as unknown as Record<string, (() => void) | undefined>)[`step_${surface}`] ?? sfx.step
      fn()
      if (this.player.running && !this.reduced) this.dust.emitParticleAt(this.player.x, this.player.y + 1, 1)
    }
    this.buildNpcs()
    // The guide stands where the save says the story got to — no walk, nobody
    // watching yet.
    this.relocateBo(true)
    this.refreshObjective()
    // A returning ticket-holder walks straight in: no turnstile, no tween.
    this.syncGates(false)
    // open already-opened prize boxes, remove collected tickets
    for (const c of this.chests)
      if (this.state.save.chests.includes(c.id)) {
        c.opened = true
        c.sprite.setFrame('chest_open')
      }
    for (const p of this.packets) if (this.state.hasPacket(p.id)) p.destroy()
    this.packets = this.packets.filter((p) => !this.state.hasPacket(p.id))
    if (this.state.flag('companion')) this.setCompanion(true)
    this.rig.follow(this.player)
    events.emit('ui:hud', { visible: true })
    hooks.faces = (f) => frameDataURL(f, 3)
    this.emitState()
    this.refreshSoundtrack()
    this.greetReturningPlayer()
    if (fresh) void this.runCutscene('arrival')
    else this.state.ach.unlock('first_steps')
  }

  /** Saves from before the fairground are gone; say so once rather than silently. */
  private greetReturningPlayer() {
    if (WorldScene.greeted || this.state.save.welcomeSeen || !hadLegacySave()) return
    WorldScene.greeted = true
    events.emit('ui:toast', { kind: 'info', icon: '🎡', title: 'The island became a fairground — fresh start!' })
  }

  private static greeted = false

  private backToTitle() {
    if (this.state && this.player) this.state.persist(this.player.feet, 'world', this.dayNight.time, this.weather.state)
    // The mini-game host is the one system that holds the save outside the
    // registry; hand it back before `startPlay` builds a new one, or a game
    // finished on the next save would pay into the file we just left.
    minigames.detach()
    this.scene.restart({ mode: 'title' })
  }

  private applySettings() {
    this.settings = loadSettings()
    this.reduced = this.settings.reducedMotion
    this.rig.shakeEnabled = this.settings.shake && !this.reduced
    if (this.player) {
      this.player.alwaysRun = this.settings.alwaysRun
      this.player.reducedMotion = this.reduced
    }
  }

  /**
   * Whether this scene still owns a run. `resetBuild()` drops both the hero and
   * the save on the way to the title, so anything that resumes across a scene
   * restart — a settled wait, a queued callback — asks here before touching them.
   */
  private get running(): boolean {
    return !!this.state && !!this.player
  }

  private setLocked(v: boolean) {
    this.locked = v
    if (v) {
      this.player?.freeze(true)
      this.interact.hide()
    } else this.player?.freeze(false)
  }

  /* ---------------- the gate ---------------- */

  /**
   * The turnstiles come out the moment the ticket is won: their solids are
   * dropped and the two sprites slide down out of the arch. Called on every
   * mini-game close, on the state tick, and once at load (silently, for a save
   * that already holds a ticket).
   */
  private syncGates(animate: boolean) {
    let opened = false
    for (const g of this.gates) {
      if (g.open || !this.state?.flag(g.flag)) continue
      g.open = true
      opened = true
      for (const s of g.solids) this.removeSolid(s)
      for (const img of g.imgs) {
        this.cullables = this.cullables.filter((c) => c.obj !== img)
        if (animate && !this.reduced) this.tweens.add({ targets: img, y: img.y + 22, alpha: 0, duration: 420, ease: 'Quad.in', onComplete: () => img.destroy() })
        else img.destroy()
      }
    }
    if (opened && animate) {
      play('door', 'open')
      this.rig.punchZoom(0.03, 240)
    }
  }

  /* ---------------- attractions ---------------- */

  /** First arrival at a door: the badge, the banner, the journal line. */
  private discoverAttraction(a: Attraction) {
    if (!this.state?.discover(a.id)) return
    sfx.discover()
    this.rig.punchZoom(0.05, 300)
    const zone = ZONES.find((z) => z.id === a.zones[0])
    events.emit('ui:banner', { title: `Discovered: ${a.name}`, sub: zone?.label })
  }

  /**
   * The whole content routing table: `Attraction.interact` says what is behind
   * the door, and nothing else in the scene needs to know which stall is which.
   */
  private async useAttraction(a: Attraction): Promise<void> {
    if (this.locked || this.inCutscene) return
    this.discoverAttraction(a)
    const target = a.interact
    if (target === 'booth:bo') {
      const bo = this.bo
      if (bo) await this.talkTo(bo)
      return
    }
    if (target === 'ride:coaster') return this.rideCoaster()
    if (target === 'duckpond') return this.duckPond()
    if (target.startsWith('minigame:')) {
      sfx.open()
      events.emit('ui:panel', { id: 'minigame', data: target.slice('minigame:'.length) })
      return
    }
    if (target.startsWith('panel:')) {
      const id = target.slice('panel:'.length)
      // A chapter that was never locked is told by being *read*: opening Contact
      // at the guestbook is what credits the story's last step.
      const zoneId = id.startsWith('zone:') ? id.slice('zone:'.length) : ''
      if (zoneId && this.state.isUnlocked(zoneId)) this.state.unlockFacet(zoneId, false)
      sfx.open()
      this.openPanel(id)
    }
  }

  /**
   * The Career Coaster. Prof. Iyer works the platform and says his piece the
   * first time you climb the steps; after that the station is a turnstile of its
   * own and the ride runs straight away.
   */
  private async rideCoaster(): Promise<void> {
    const greeted = greetFlag('coaster')
    if (this.state && !this.state.flag(greeted)) {
      this.state.setFlag(greeted)
      const tree = getTree('professor')
      const npc = this.npcs.find((n) => n.def.id === 'professor') ?? null
      if (tree) {
        npc?.talkStart(this.player.x, this.player.y)
        this.state.talked('professor')
        // `intro` is run by hand, exactly as a room host's greeting was: walking
        // up to the operator later must not re-open with the platform speech.
        await this.runDialogue({ ...tree, entry: [{ node: 'intro' }] }, 'professor')
        npc?.talkEnd()
      }
      await this.waitForModals()
    }
    this.inCutscene = true
    try {
      // The runner would read `loadSettings()` itself; handing it the live flag
      // means the ride tracks the in-game toggle rather than storage. The cart's
      // default depth (516) already sits in front of the spans, which this scene
      // draws at their foot (512), so it needs no `depth` of its own.
      await Coaster.run(this, this.player, this.rig, this.state, { reducedMotion: this.reduced })
    } finally {
      this.inCutscene = false
    }
  }

  /** Tomas lends the pole; without his errand the stall is just a man and a pond. */
  private async duckPond(): Promise<void> {
    if (!this.state.quests.isStarted('ducks')) {
      const tomas = this.npcs.find((n) => n.def.id === 'tomas')
      if (tomas) await this.talkTo(tomas)
      return
    }
    await this.hookADuck()
  }

  /**
   * Where the hoop should land, in world pixels: the middle of the duck pond,
   * pulled a little back toward the stall so it sits on open water rather than
   * against the far rim.
   *
   * Read off `BLUEPRINT.ponds`, never written out as a number — the pier's cast
   * was a fixed offset south of the player, and the day the water moved north
   * of the counter that offset started throwing the hoop onto the grass. Move
   * the pond in the blueprint and the cast follows it.
   */
  private duckAim(): { x: number; y: number } {
    const p = this.player
    const pond = BLUEPRINT.ponds[0]
    let aim =
      pond && pond.kind === 'ellipse'
        ? { x: pond.cx * TILE, y: (pond.cy + pond.ry * 0.35) * TILE }
        : // No pond to read (or one drawn as a polygon): two tiles ahead of the
          // hero, which is at least never behind him.
          { x: p.x, y: p.y - 2 * TILE }
    // Never cast into your own feet. If the stall's interact point ever creeps
    // onto the water, push the landing point out along the same line instead of
    // dropping the hoop where the player is standing.
    const dx = aim.x - p.x
    const dy = aim.y - p.y
    const d = Math.hypot(dx, dy)
    const min = 1.5 * TILE
    if (d < min) aim = d < 0.001 ? { x: p.x, y: p.y - min } : { x: p.x + (dx / d) * min, y: p.y + (dy / d) * min }
    return aim
  }

  private async hookADuck(): Promise<void> {
    if (this.locked || this.inCutscene) return
    // Through `setLocked`, not the field: the flag and `player.frozen` have to
    // move together, or a `ui:lock` arriving mid-round (a card opening over the
    // pond) unfreezes the hero the moment the hoop is put down. Handing the
    // world back reads the same answer `runDialogue` does — a modal that is
    // still up keeps the lock until its own `ui:lock false`.
    this.setLocked(true)
    const stall = new Ducks(this, this.player, this.rng, (n) => play(n), this.state.save.stats.fishCaught, this.duckAim())
    const { result, duck } = await stall.run()
    this.setLocked(document.body.classList.contains('modal-open'))
    if (result === 'caught' && duck) {
      // The errand counts ducks, not species: one inventory `fish` whatever came
      // up, and the tally beside it is what the journal reads.
      this.state.give('fish', 1)
      const golden = landDuck(this.state.save, duck)
      this.state.dirty = true
      this.state.quests.advance('ducks', 'hook', 1)
      this.state.ach.unlock('fisher')
      if (golden) this.state.ach.unlock('goldfish')
      this.state.addXp(golden ? 40 : 12)
      events.emit('ui:toast', {
        kind: golden ? 'ach' : 'item',
        icon: golden ? '🏆' : '🦆',
        title: `Hooked a ${DUCK_NAMES[duck] ?? 'duck'}!`,
        sub: golden ? 'One in a million.' : undefined,
      })
    } else if (result === 'missed') events.emit('ui:toast', { kind: 'info', icon: '🎣', title: 'It got away…' })
    this.emitState()
  }

  /** Ilse's errand: the fair's string lights, thrown on after dark. */
  private throwLightSwitch() {
    if (!this.state) return
    if (!this.dayNight.isNight) {
      events.emit('ui:toast', { kind: 'info', icon: '💡', title: 'Not until dusk.', sub: 'Come back when the lamps are on.' })
      return
    }
    this.state.setFlag('lights')
    this.state.quests.advance('lights', 'switch', 1)
    this.state.ach.unlock('keeper')
    play('achievement', 'chest')
    soundtrack.fanfare()
    for (const g of this.lightGlow) this.tweens.add({ targets: g, alpha: this.dayNight.ambient.warmth, duration: 600 })
    const fountain = fountainAt()
    this.setFireworks(fountain.x, fountain.y)
    events.emit('ui:banner', { title: 'Lights on', sub: 'The whole midway, all at once.' })
    this.emitState()
  }

  /* ---------------- actions ---------------- */

  private onAction() {
    if (this.mode !== 'play' || this.locked || this.inCutscene) return
    if (this.interact.trigger()) return
    void this.swing()
  }

  /* ---------------- hopping ---------------- */

  /** Solids near a point, so a hop does not walk the whole fair's list. */
  private solidsNear(list: Solid[], x: number, y: number, pad: number): Solid[] {
    return list.filter((s) => s.x < x + pad && s.x + s.w > x - pad && s.y < y + pad && s.y + s.h > y - pad)
  }

  private pointIn(list: Solid[], x: number, y: number): boolean {
    for (const s of list) if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true
    return false
  }

  /** Terrain a hop cannot cross — the duck pond, and the edge of the world. */
  private hardTerrain(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE)
    const ty = Math.floor(y / TILE)
    if (!this.grid.inb(tx, ty)) return true
    const t = this.grid.get(tx, ty)
    return !isWalkable(t) && !HOPPABLE_TERRAIN.has(t)
  }

  private onJump() {
    if (this.mode !== 'play' || !this.player || this.locked || this.inCutscene) return
    if (this.player.hopping || this.player.frozen || this.player.swinging) return
    const p = this.player
    const f = FACING[p.dir]
    // held input, not actual travel: pressed up against a fence you have stopped
    // moving, and that is exactly the moment you want the hop to carry you over
    const going = this.wantsMove
    const pad = 3 * TILE
    const near = this.solidsNear(this.solids, p.x, p.y, pad)
    const nearHard = this.solidsNear(this.hardSolids, p.x, p.y, pad)
    const plan = planHop(
      p.x,
      p.y,
      f.sx,
      f.sy,
      going,
      (x, y) => this.hardTerrain(x, y) || this.pointIn(nearHard, x, y),
      (x, y) => this.blocked(x, y) || this.pointIn(near, x, y),
    )
    this.doHop(plan.lx, plan.ly)
  }

  private doHop(lx: number, ly: number) {
    if (!this.player.startHop(lx, ly)) return
    play('hop')
    this.player.onHopLand = () => {
      const fn = (sfx as unknown as Record<string, (() => void) | undefined>)[`step_${this.player.surface}`] ?? sfx.step
      fn()
      if (!this.reduced) this.dust.emitParticleAt(this.player.x, this.player.y + 1, 3)
    }
  }

  private onMenu() {
    if (this.mode !== 'play' || this.inCutscene) return
    if (!this.locked) this.openPanel('pause')
  }

  private onPanel(id: 'map' | 'journal') {
    if (this.mode !== 'play' || this.locked || this.inCutscene) return
    this.openPanel(id)
  }

  /**
   * The panel router. Most panels find what they need in `uiState`; the prize
   * board deliberately does not — it owns no state and renders exactly what the
   * payload says has been forged — so the one place that knows the save hands it
   * over here, and every route to the board (the prop, a dialogue's
   * `panel:forgeboard`) is fed the same way.
   */
  private openPanel(id: string) {
    const data = id === 'forgeboard' ? this.state?.save.minigames.forge?.progress : undefined
    events.emit('ui:panel', { id, data })
  }

  private async swing() {
    play('swing')
    const p = this.player.facingPoint(12)
    let hit = false
    for (const g of this.grasses)
      if (g.hit(p.x, p.y)) {
        g.doCut(this.time.now)
        hit = true
        if (!this.reduced) this.grassBits.emitParticleAt(g.x, g.y - 6, 6)
        this.state.save.grassCut++
        if (this.state.save.grassCut >= 50) this.state.ach.unlock('grass_whisperer')
        if (this.rng.chance(0.3)) {
          this.state.give('coin', this.rng.int(1, 3))
          play('coin')
          this.sparks.emitParticleAt(g.x, g.y - 8, 4)
        }
        play('grass')
      }
    for (const s of this.signs)
      if (s.hit(p.x, p.y)) {
        s.bonk()
        hit = true
        this.state.save.stats.bonks++
        if (this.state.save.stats.bonks >= 10) this.state.ach.unlock('bonk')
        play('bonk')
        this.rig.shake(0.003, 120)
      }
    if (hit) this.state.dirty = true
    await this.player.swing()
  }

  /** Finger posts open a card of arms, not a dialogue: the roads speak for themselves. */
  private readSign(id: string) {
    events.emit('ui:panel', { id: 'sign', data: id })
  }

  /**
   * `force` is for the arrival alone: it has already waited for every modal to
   * close, and a stray lock silently swallowing Bo's last line would leave the
   * player standing on the apron with no idea where to go.
   */
  private async talkTo(npc: Npc, force = false) {
    if (this.locked && !force) return
    const tree = getTree(npc.def.id) ?? linesTree(npc.def.id, npc.def.name, ['...', 'Grand day for the fair.'])
    npc.talkStart(this.player.x, this.player.y)
    this.player.face(npc.x, npc.y)
    this.state.talked(npc.def.id)
    await this.runDialogue(tree, npc.def.id)
    npc.talkEnd()
  }

  private async runDialogue(tree: Tree, npcId?: string): Promise<void> {
    const runner = new DialogueRunner(tree, this.state.ctx())
    if (npcId) {
      const info = npcInfo(npcId)
      for (const n of Object.values(tree.nodes)) for (const l of n.lines) if (!l.face && l.who === info.name) l.face = info.face
    }
    this.setLocked(true)
    // Where the speaker is on screen, before the box appears. The player is
    // always within a tile of whoever they are talking to, so their own place in
    // the viewport is the speaker's; on the arrival apron the camera is clamped
    // to the world's bottom edge and both of them stand behind the box.
    const view = this.cameras.main.worldView
    const anchor = view.height > 0 ? (this.player.y - view.y) / view.height : 0.5
    events.emit('ui:dialogue-anchor', { y: Math.min(1, Math.max(0, anchor)) })
    if (hooks.openDialogue) await hooks.openDialogue(runner)
    else {
      // no dialogue UI yet: log lines
      while (!runner.ended) {
        console.log(`[${runner.line.who}] ${runner.line.text}`)
        if (runner.advance() === 'choice') runner.choose(0)
      }
    }
    // A tree whose closing effect opened a card or a cabinet (`effectsAtEnd`)
    // ends with that modal still up and owning the keyboard — releasing the
    // world here would let the hero walk off while the player types. The modal
    // layer's own `ui:lock false` lets go when it closes.
    this.setLocked(document.body.classList.contains('modal-open'))
    this.emitState()
  }

  private openChest(chest: Chest) {
    if (!this.state.openChest(chest.id)) return
    play('chest')
    this.rig.shake(0.002, 100)
    this.sparks.emitParticleAt(chest.x, chest.y - 8, 10)
    const coins = 10 + this.rng.int(0, 15)
    this.state.give('coin', coins)
    events.emit('ui:toast', { kind: 'item', icon: '🎁', title: 'Prize box', sub: `+${coins} coins` })
    this.state.addXp(15)
    this.emitState()
  }

  /** The map's only trip: to the door of an attraction you have already found. */
  private travelTo(id: string) {
    const a = BLUEPRINT.attractions.find((x) => x.id === id)
    if (!a || !this.player) return
    const x = a.door.x * TILE + TILE / 2
    const y = a.door.y * TILE + TILE / 2
    this.cameras.main.fadeOut(180, 0, 0, 0)
    this.time.delayedCall(200, () => {
      this.player.setPosition(x, y)
      this.player.dir = 'up'
      this.player.idle()
      this.rig.follow(this.player)
      this.cameras.main.fadeIn(260)
      sfx.discover()
    })
  }

  private sleep(to: 'morning' | 'night') {
    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.time.delayedCall(600, () => {
      this.dayNight.skipTo(to)
      this.cameras.main.fadeIn(600)
      events.emit('ui:toast', { kind: 'info', icon: to === 'morning' ? '🌅' : '🌙', title: to === 'morning' ? 'A new morning' : 'Night falls' })
    })
  }

  private setCompanion(on: boolean) {
    if (on && !this.companion && this.player) {
      this.companion = new Companion(this, this.player.x - 12, this.player.y + 4)
      this.tintables.push(this.companion.sprite)
      const cat = this.companion
      this.interact.add({
        get x() {
          return cat.x
        },
        get y() {
          return cat.y
        },
        radius: 18,
        prompt: 'Pet Byte',
        onInteract: () => {
          play('meow')
          this.tweens.add({ targets: cat.sprite, scaleY: 0.8, scaleX: 1.2, duration: 100, yoyo: true })
          const tree = getTree('cat')
          if (tree) void this.runDialogue(tree)
        },
      })
    } else if (!on && this.companion) {
      this.companion.destroy()
      this.companion = null
    }
  }

  /* ---------------- the guide ---------------- */

  /** Bo — the one member of the cast the story moves about the fair. */
  private get bo(): Npc | null {
    return this.npcs.find((n) => n.def.id === 'dockmaster') ?? null
  }

  /**
   * The step the guide is on.
   *
   * Not quite `storyNext()`: the About card Bo hands over on the apron credits
   * the *ticket* step (`FACET_STEP.about`), so a player who says "maybe later"
   * to the puzzle would be pointed up the avenue while the turnstiles are still
   * shut — and Bo would set off through them without her. Nothing inside the
   * fence is reachable without a ticket, so the guide holds at the gate until
   * there is one.
   */
  private storyStep(): StoryStep | null {
    if (this.state && !this.state.flag('ticket')) return 'ticket'
    return this.state?.storyNext() ?? null
  }

  /** Where the guide should be standing right now, in world pixels. */
  private boStation(): Vec2 {
    const t = stationSpot(this.storyStep())
    return { x: t.x * TILE + 8, y: t.y * TILE + 12 }
  }

  /**
   * Keep Bo at the station the story is pointing at — without ever being seen
   * to jump. Off-camera (the view plus two tiles) he simply is somewhere else;
   * on-camera he sets off walking and the snap happens once he is out of sight.
   */
  private relocateBo(force = false) {
    const bo = this.bo
    // Mid-conversation he belongs exactly where he is standing.
    if (!bo || !this.state || bo.talking) return
    const s = this.boStation()
    if (bo.home.x === s.x && bo.home.y === s.y) return
    const v = this.cameras.main.worldView
    const pad = 2 * TILE
    const seen = bo.x > v.x - pad && bo.x < v.right + pad && bo.y > v.y - pad && bo.y < v.bottom + pad
    const dx = s.x - bo.x
    const dy = s.y - bo.y
    const d = Math.hypot(dx, dy)
    // Arrived under his own steam, or nobody is looking: take up the station.
    if (force || !seen || d < 2) {
      this.boWalk = null
      bo.rehome(s.x, s.y)
      return
    }
    // If the last errand left him exactly where it found him, walking him at the
    // same station again only makes him twitch on the spot twice a second: let
    // him stand and wait for the camera to look away.
    const last = this.boWalk
    if (last && last.sx === s.x && last.sy === s.y && Math.hypot(bo.x - last.x, bo.y - last.y) < 1) return
    // A few tiles at a time, recomputed twice a second: he heads off the way you
    // are being sent, and stops being your problem the moment he leaves frame.
    const step = Math.min(4 * TILE, d)
    this.boWalk = { x: bo.x, y: bo.y, sx: s.x, sy: s.y }
    bo.walkTo(bo.x + (dx / d) * step, bo.y + (dy / d) * step)
  }

  /**
   * The chip's text and the tile it points at, for the step the story is on.
   * Every station names an attraction — the fair has a gate, and the gate is an
   * attraction — so the chip, the map pin and the marker all light one door.
   */
  private objectiveFor(step: StoryStep | null): Objective | null {
    // `story_done` is the story's own full stop — the reward flag the last step
    // pays out. It wins over the step bookkeeping: once the finale banner has
    // gone up there is no next station, so the chip hides and the map's ring
    // comes off the Guestbook rather than sending the player back to a door
    // they have already been through.
    if (!step || this.state?.flag('story_done')) return null
    const st = STATIONS[step]
    const spot = BLUEPRINT.attractions.find((a) => a.id === st.landmark)?.door ?? BLUEPRINT.npcSpots.dockmaster
    return { step, text: st.hint, landmark: st.landmark, tx: spot.x, ty: spot.y }
  }

  /**
   * Hand the panels the chapter list and the next stop, as the save has them.
   *
   * A copy, not the save's own array: the panel layer treats `uiState` as its
   * own scratch space and pushes into it, and a chapter invented there must
   * never end up in the file.
   */
  private refreshObjective() {
    if (!this.state) return
    uiState.unlocked = [...this.state.save.unlocked]
    uiState.objective = this.objectiveFor(this.storyStep())
  }

  /**
   * Resolve once nothing is holding the screen. One modal routinely opens
   * another — a mini-game closes and the chapter it just unlocked opens over
   * the world — and a conversation started in that gap would be swallowed by
   * the lock the new card takes.
   */
  private waitForModals(): Promise<void> {
    const open = () => document.body.classList.contains('modal-open')
    if (!open()) return Promise.resolve()
    return new Promise((resolve) => {
      const done = this.settleOnShutdown(resolve)
      const off = events.on('ui:closed', () => {
        // A step later: whatever follows this close has opened by then.
        setTimeout(() => {
          if (open()) return
          off()
          done()
        }, 0)
      })
      // A scene shutdown mid-wait (title screen) must not leave it listening.
      this.unsub.push(off)
    })
  }

  /** Resolve once the panel layer says that modal has closed. */
  private waitForClose(id: string): Promise<void> {
    return new Promise((resolve) => {
      const done = this.settleOnShutdown(resolve)
      const off = events.on('ui:closed', (e) => {
        if (e.id !== id) return
        off()
        done()
      })
      this.unsub.push(off)
    })
  }

  /**
   * Wrap a wait's `resolve` so a scene shutdown settles it instead of stranding
   * it.
   *
   * Quitting to the title mid-arrival tears down every listener these waits hang
   * on, and an await that can never return takes the rest of its function with
   * it — including `arrival()`'s `finally { bo.talkEnd() }`, the one thing that
   * hands the guide back to the world. Resolving on the way out is safe:
   * everything downstream of these waits is guarded on a scene `resetBuild()`
   * has already emptied.
   */
  private settleOnShutdown(resolve: () => void): () => void {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, done)
    return () => {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, done)
      done()
    }
  }

  /* ---------------- cutscenes ---------------- */

  private async runCutscene(id: string): Promise<void> {
    if (id === 'arrival') return this.arrival()
  }

  /**
   * Arriving at the fair. You start on the apron outside the fence, facing the
   * arch; Bo leaves the ticket window and walks over. Esc skips the *walk* —
   * Bo simply arrives — never the booth: the introduction, the About card and
   * the puzzle that buys the ticket are the game, not its overture.
   */
  private async arrival(): Promise<void> {
    const cs = new Cutscene(this)
    this.inCutscene = true
    cs.begin()
    this.player.dir = 'up'
    this.player.idle()
    this.rig.follow(this.player, false)
    await cs.wait(500)
    const bo = this.bo
    if (bo) {
      bo.talkStart(this.player.x, this.player.y)
      // Alongside on the tarmac, not a tile in front: at HD sprite heights a
      // greeter standing above the hero simply covers him up.
      const to = { x: this.player.x - 26, y: this.player.y - 8 }
      // The tween carries him; his legs are ours. He is held in `talking` for
      // this whole stretch, so `Npc.update` returns at its first line and would
      // never turn the walk cycle over — which is what had him gliding on in his
      // standing pose. Same `walkTick` scaling as a walked leg, so the stride
      // matches the pace.
      await cs.moveTo(bo, to.x, to.y, BO_ARRIVAL_SPEED, () => {
        bo.setDepth(bo.y)
        bo.walkTick(this.game.loop.delta, BO_ARRIVAL_SPEED, to)
      })
      // And he stops: `face` puts the standing pose back as he looks up at you.
      bo.face(this.player.x, this.player.y)
      this.player.face(bo.x, bo.y)
    }
    cs.end()
    // The Esc that skipped the walk is still in flight: the world defers its own
    // menu by a tick (see `create`), and that tick must still find a cutscene
    // running or skipping would drop the player into the pause panel.
    if (cs.skipped) setTimeout(() => (this.inCutscene = false), 0)
    else this.inCutscene = false
    // The badge for arriving is awarded at the *end* of this script, not here:
    // over Bo's walk-on it was one more card in a stack, and its XP a second.
    // Who Naman is, is given rather than won — and it has to be on the record
    // before the tree flushes its `panel: zone:about` effect, or the first card
    // the player ever sees is the locked one.
    this.state.unlockFacet('about', false)
    if (bo) {
      // Everything from here to his follow-up is one exchange, and he is held in
      // it (`talking`) so the story cannot walk him off mid-sentence. The
      // `finally` is what guarantees he is handed back: an exchange that threw,
      // or one the world lock cut short, would otherwise leave him frozen for
      // the rest of the run — `Npc.update` and `relocateBo` both skip a talker.
      try {
        const tree = getTree('dockmaster')
        if (tree) {
          bo.talkStart(this.player.x, this.player.y)
          this.player.face(bo.x, bo.y)
          this.state.talked('dockmaster')
          // `intro` is deliberately absent from the entry ladder, so that walking
          // up to Bo later never re-opens with the arrival speech.
          await this.runDialogue({ ...tree, entry: [{ node: 'intro' }] }, 'dockmaster')
        }
        // "Let's solve it" opened the cabinet as the dialogue ended. His follow-up
        // is about the ticket, so it waits for the puzzle — and then for the
        // chapter card the win opens over the top of it.
        if (minigames.openId === 'wordle') await this.waitForClose('minigame')
        await this.waitForModals()
        // Quitting to the title while that card was up settles both waits (see
        // `settleOnShutdown`) and lands here on a scene `resetBuild()` has
        // already emptied. The `finally` below still hands Bo back — that is
        // the whole point of settling — and there is nothing else worth saying
        // to a run that no longer exists.
        if (!this.running) return
        // The ticket, if it was won: the turnstiles come out before he speaks,
        // so his line about going in has somewhere to point.
        this.syncGates(true)
        // One more line, from the entry ladder: won → up the avenue to the
        // coaster; not won → the puzzle keeps. Forced past the world lock:
        // nothing is on screen by now, and the arrival's last line must not be
        // dropped in silence.
        await this.talkTo(bo, true)
      } finally {
        bo.talkEnd()
      }
    }
    if (!this.running) return
    // "Through the Gate", now that there is a clear screen to hand it to. It was
    // unlocked the moment Bo finished walking over, which put a badge and its XP
    // on top of his greeting; the badge is for arriving, and this is the beat the
    // arrival actually ends on. (Quitting mid-arrival returns above without it —
    // and the next Continue unlocks it on the spot, see `startPlay`.)
    this.state.ach.unlock('first_steps')
    // Standing at the window while Bo does the honours *is* finding the gate:
    // waiting for the door interact would leave the first attraction unfound by
    // the only player who has already been shown round it.
    const gate = BLUEPRINT.attractions.find((a) => a.id === 'gate')
    if (gate) this.discoverAttraction(gate)
    events.emit('ui:hint', { text: 'WASD / arrows to move · Space to hop · E to talk' })
    events.emit('ui:banner', { title: 'The Gate', sub: "Naman's World Fair" })
    this.state.save.tutorialDone = true
    this.state.dirty = true
  }

  private setFireworks(x: number, y: number) {
    if (this.reduced) return
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 380, () => {
        this.sparks.emitParticleAt(x + this.rng.range(-80, 80), y - this.rng.range(20, 90), 24)
        play('firework')
      })
    }
  }

  /* ---------------- state ---------------- */

  refreshSoundtrack() {
    if (this.mode !== 'play' || !this.player) return
    const r = regionAt(BLUEPRINT.regions, this.player.x / TILE, this.player.y / TILE)
    // The 'coast' bed is the crowd: a fairground murmur, loudest on the paved
    // midway and thinning out over the lawns.
    const crowd = r?.id === 'midway' ? 0.9 : r?.id === 'apron' ? 0.6 : r?.id === 'west' || r?.id === 'east' ? 0.45 : r?.id === 'hill' ? 0.3 : 0.12
    // …and the 'woods' bed is the leaves, which only the picnic lawn and the
    // pond corner have any of.
    const leaves = r?.id === 'picnic' ? 0.7 : r?.id === 'pond' ? 0.45 : 0.1
    soundtrack.world({ night: this.dayNight.isNight, rain: this.weather.rainAmount, coast: crowd, woods: leaves })
  }

  private bubbleT = 0
  /** Twice a second is often enough to notice the guide has somewhere else to be. */
  private boT = 0
  /** Where the last walk order left from, and for which station — see `relocateBo`. */
  private boWalk: { x: number; y: number; sx: number; sy: number } | null = null

  /** Quest givers show ! when they have a quest, ? when you can turn in. */
  private refreshBubbles() {
    if (!this.state) return
    const q = this.state.quests
    const turnIn: Record<string, () => boolean> = {
      pip: () => q.isActive('balloons') && this.state.has('shell', 5),
      tomas: () => q.isActive('ducks') && this.state.has('fish', 3),
    }
    for (const n of this.npcs) {
      const id = n.def.id
      if (turnIn[id]?.()) n.setBubble('quest')
      else if (QUEST_GIVERS[id] && !q.isStarted(QUEST_GIVERS[id])) n.setBubble('excl')
      else n.setBubble(null)
    }
  }

  private emitState() {
    if (!this.state) return
    this.refreshObjective()
    const st = this.state.save
    uiState.stats.steps = st.stats.steps
    uiState.stats.playSeconds = st.stats.playSeconds
    uiState.stats.fishCaught = st.stats.fishCaught
    uiState.stats.fish = st.fish ?? {}
    uiState.stats.bonks = st.stats.bonks
    uiState.stats.grassCut = st.grassCut
    // Every lost ticket is one of the ones lying about the fair now, so the tally
    // and the total agree; the clamp is only there so a save carrying an id the
    // blueprint no longer has cannot read as more than there are to find.
    const packets = Math.min(st.packets.length, BLUEPRINT.packetSpots.length)
    uiState.stats.packets = packets
    uiState.stats.discoveries = st.discoveries
    // The journal's other two counts, live rather than one autosave stale.
    uiState.stats.chests = st.chests.length
    uiState.stats.forged = restore(st.minigames.forge?.progress).found.length
    uiState.visitedRegions = st.visitedRegions
    const r = this.player ? regionAt(BLUEPRINT.regions, this.player.x / TILE, this.player.y / TILE) : null
    events.emit('world:state', {
      packets,
      packetsTotal: BLUEPRINT.packetSpots.length,
      xp: this.state.xp.xp,
      level: this.state.xp.level,
      levelPct: this.state.xp.pct,
      time: this.dayNight.time,
      weather: this.weather.state,
      coins: this.state.coins,
      region: r?.name ?? '',
      px: this.player?.x,
      py: this.player?.y,
    })
  }

  /* ---------------- per frame ---------------- */

  private readonly blocked: Blocked = (px, py) => {
    const tx = Math.floor(px / TILE)
    const ty = Math.floor(py / TILE)
    if (!this.grid.inb(tx, ty)) return true
    return !isWalkable(this.grid.get(tx, ty))
  }

  private cull() {
    const v = this.cameras.main.worldView
    const pad = 32
    const l = v.x - pad
    const r = v.right + pad
    const t = v.y - pad
    const b = v.bottom + pad
    for (const c of this.cullables) c.obj.setVisible(c.x1 > l && c.x0 < r && c.y1 > t && c.y0 < b)
  }

  update(_t: number, dms: number) {
    const dt = Math.min(dms, 50) / 1000
    const cam = this.cameras.main
    const view = cam.worldView

    this.cullTimer += dms
    if (this.cullTimer > 200) {
      this.cullTimer = 0
      this.cull()
    }

    const day = this.dayNight.ambient
    const playerPos = this.player ? { x: this.player.x, y: this.player.y } : { x: view.centerX, y: view.centerY }
    const region = regionAt(BLUEPRINT.regions, playerPos.x / TILE, playerPos.y / TILE)
    // The picnic lawn is the only place inside the fence with trees over you.
    const underTrees = region?.id === 'picnic'

    this.dayNight.update(this.mode === 'play' ? dt : dt * 0.25, dms)
    this.weather.update(dms)
    this.wind.update(dms, view, underTrees)
    this.water.update(dms, view, 1 - day.darkness, day.darkness)
    this.critters.update(dms, view, 1 - day.darkness, day.darkness, playerPos, underTrees, false)
    const windPhase = this.wind.phase
    for (const g of this.grasses) if (g.sprite.visible || g.cut) g.update(this.time.now, windPhase)

    if (this.mode === 'play' && this.player) {
      let dx = 0
      let dy = 0
      // the pace modifier, not a speed: Player inverts it when always-run is on
      let paceMod = false
      if (!this.locked && !this.inCutscene) {
        if (keys.any('ArrowLeft', 'KeyA')) dx -= 1
        if (keys.any('ArrowRight', 'KeyD')) dx += 1
        if (keys.any('ArrowUp', 'KeyW')) dy -= 1
        if (keys.any('ArrowDown', 'KeyS')) dy += 1
        paceMod = keys.any('ShiftLeft', 'ShiftRight')
        if (touchInput.active) {
          dx += touchInput.x
          dy += touchInput.y
          // a full tilt asks for the quick pace — when always-run is on it already is one
          if (!this.settings.alwaysRun && Math.hypot(touchInput.x, touchInput.y) > 0.9) paceMod = true
        }
        const pad = this.input.gamepad?.getPad(0)
        if (pad) {
          if (Math.abs(pad.leftStick.x) > 0.2) dx += pad.leftStick.x
          if (Math.abs(pad.leftStick.y) > 0.2) dy += pad.leftStick.y
          if (pad.B) paceMod = true
          if (pad.A && this.time.now - ((pad as unknown as { _lastA?: number })._lastA ?? 0) > 300) {
            ;(pad as unknown as { _lastA?: number })._lastA = this.time.now
            this.onAction()
          }
          if (pad.X && this.time.now - ((pad as unknown as { _lastX?: number })._lastX ?? 0) > 300) {
            ;(pad as unknown as { _lastX?: number })._lastX = this.time.now
            this.onJump()
          }
        }
      }
      this.wantsMove = Math.hypot(dx, dy) > 0.15
      const px0 = this.player.x
      const py0 = this.player.y
      this.player.move(dx, dy, paceMod, dt, this.blocked, this.solids, this.grid)
      const moved = Math.hypot(this.player.x - px0, this.player.y - py0)
      if (moved > 0) {
        this.stepAcc += moved
        if (this.stepAcc >= TILE) {
          this.stepAcc -= TILE
          this.state.save.stats.steps++
          if (this.player.running) {
            this.runAcc++
            if (this.runAcc >= 200) this.state.ach.unlock('sprinter')
          }
        }
        // pond splash ring
        if (this.player.surface === 'water' && !this.reduced && this.rng.chance(0.06) && this.anims.exists('ripple')) {
          const r = this.add.sprite(this.player.x, this.player.y + 2, ATLAS, 'ripple_0').setDepth(this.player.y - 1)
          r.play('ripple')
          r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy())
        }
      }
      if (!this.locked && !this.inCutscene) this.interact.update(this.player.x, this.player.y)
      // A ticket is picked up a couple of dozen times in a whole playthrough, so
      // the list only has to be rebuilt on the frames one actually was: the
      // unconditional `filter` was allocating a fresh array sixty times a second
      // to say nothing had changed.
      let picked = false
      for (const p of this.packets)
        if (p.near(this.player.x, this.player.y)) {
          p.collect()
          picked = true
          this.sparks.emitParticleAt(p.x, p.y - 6, 12)
          play('packet', 'pickup')
          this.state.collectPacket(p.id)
          events.emit('ui:toast', { kind: 'item', icon: '🎟️', title: 'Lost ticket' })
          this.rig.punchZoom(0.03, 200)
          this.emitState()
        }
      if (picked) this.packets = this.packets.filter((p) => !p.collected)

      for (const n of this.npcs) {
        const near = Math.abs(n.x - view.centerX) < view.width && Math.abs(n.y - view.centerY) < view.height
        if (near) n.update(dms, this.blocked, this.solids)
      }
      this.companion?.update(dms, { x: this.player.x, y: this.player.y, moving: this.player.moving })

      if (region && region.id !== this.regionId) {
        this.regionId = region.id
        if (!this.inCutscene) events.emit('ui:banner', { title: region.name })
        this.refreshSoundtrack()
        if (!this.state.save.visitedRegions.includes(region.id)) {
          this.state.save.visitedRegions.push(region.id)
          this.state.addXp(10)
        }
        this.emitState()
      }

      this.playT += dms
      if (this.playT >= 1000) {
        this.playT -= 1000
        this.state.save.stats.playSeconds++
      }
      this.stateT += dms
      if (this.stateT > 500) {
        this.stateT = 0
        this.syncGates(true)
        this.emitState()
      }
      this.bubbleT += dms
      if (this.bubbleT > 1200) {
        this.bubbleT = 0
        this.refreshBubbles()
      }
      this.boT += dms
      if (this.boT > 500) {
        this.boT = 0
        this.relocateBo()
      }
      this.autosaveT += dms
      if (this.autosaveT > 10000) {
        this.autosaveT = 0
        if (this.state.dirty || this.state.save.stats.steps % 5 === 0) this.state.persist(this.player.feet, 'world', this.dayNight.time, this.weather.state)
      }
    }

    this.rig.update(dt)
  }

  get worldBounds() {
    return { w: WORLD_W, h: WORLD_H }
  }
}
