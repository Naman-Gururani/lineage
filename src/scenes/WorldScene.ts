// The island. Runs in 'title' mode (attract camera, no player) and 'play' mode.
import Phaser from 'phaser'
import { ATLAS, frameDataURL, hasFrame } from '../art/atlas'
import { sfx } from '../audio/sfx'
import { soundtrack } from '../systems/Soundtrack'
import { uiState } from '../ui/state'
import { TILE, WORLD_H, WORLD_SEED, WORLD_W } from '../config'
import { events, touchInput } from '../core/events'
import { hooks } from '../core/hooks'
import { keys } from '../core/keys'
import { makeRng, type Rng } from '../core/rng'
import { loadSave, loadSettings, type Save, type Settings } from '../core/save'
import { Chest } from '../entities/Chest'
import { Companion } from '../entities/Companion'
import { Critters } from '../entities/Critters'
import { makeDoor } from '../entities/Door'
import { Grass } from '../entities/Grass'
import { Lamp } from '../entities/Lamp'
import { Npc, type NpcDef } from '../entities/Npc'
import { Packet } from '../entities/Packet'
import { Player } from '../entities/Player'
import { Sign } from '../entities/Sign'
import { CameraRig } from '../systems/CameraRig'
import { Cutscene } from '../systems/Cutscene'
import { Fishing } from '../systems/Fishing'
import { DayNight } from '../systems/DayNight'
import { DialogueRunner, type Tree } from '../systems/Dialogue'
import { getTree, linesTree, npcInfo } from '../systems/DialogueRegistry'
import { GameState } from '../systems/GameState'
import { InteractSystem, type Interactable } from '../systems/Interact'
import { Water } from '../systems/Water'
import { Weather } from '../systems/Weather'
import { Wind } from '../systems/Wind'
import { BLUEPRINT, type Landmark } from '../world/blueprint'
import type { Blocked, Solid } from '../world/collision'
import { regionAt } from '../world/regions'
import type { Decor } from '../world/scatter'
import { T, isWalkable, isWater, type Grid } from '../world/terrain'
import type { WorldData } from './BootScene'
import { ZONES } from '../data/content'

type Mode = 'title' | 'play'

/** Play a sound by name if the audio module provides it (some land later). */
const play = (name: string, fallback?: string) => {
  const table = sfx as unknown as Record<string, (() => void) | undefined>
  const fn = table[name] ?? (fallback ? table[fallback] : undefined)
  fn?.()
}

const DECOR_FRAME: Record<string, (v: number) => string> = {
  tree: (v) => `tree_${v % 2}`,
  pine: (v) => `pine_${v % 2}`,
  palm: (v) => `palm_${v % 2}`,
  bush: (v) => `bush_${v % 2}`,
  rock: (v) => `rock_${v % 2}`,
  flower: (v) => `flower_${v % 4}`,
  mushroom: (v) => `mushroom_${v % 2}`,
  shell: (v) => `shell_${v % 2}`,
  fence: (v) => (v === 0 ? 'fence_h' : v === 1 ? 'fence_v' : 'fence_post'),
  lamp: () => 'lamp',
  bench: () => 'bench',
  lily: (v) => `lily_${v % 2}`,
  reed: (v) => `reed_${v % 2}`,
  stump: () => 'stump',
  log: () => 'log',
  flowerbed: () => 'flowerbed',
}

const SOLID_BOX: Record<string, { w: number; h: number }> = {
  tree: { w: 12, h: 8 },
  pine: { w: 10, h: 8 },
  palm: { w: 8, h: 6 },
  bush: { w: 14, h: 8 },
  rock: { w: 14, h: 8 },
  fence: { w: 16, h: 6 },
  lamp: { w: 6, h: 5 },
  bench: { w: 22, h: 8 },
  stump: { w: 12, h: 6 },
  log: { w: 18, h: 6 },
}

const NPC_CAST: NpcDef[] = [
  { id: 'mira', name: 'Captain Mira', x: 0, y: 0, behaviour: { kind: 'wander', radius: 28 }, facing: 'down' },
  { id: 'tomas', name: 'Old Tomas', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'pip', name: 'Pip', x: 0, y: 0, behaviour: { kind: 'wander', radius: 48 } },
  { id: 'lou', name: 'Baker Lou', x: 0, y: 0, behaviour: { kind: 'wander', radius: 24 } },
  { id: 'sol', name: 'Operator Sol', x: 0, y: 0, behaviour: { kind: 'wander', radius: 30 } },
  { id: 'devi', name: 'Nana Devi', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' },
  { id: 'arjun', name: 'Arjun', x: 0, y: 0, behaviour: { kind: 'wander', radius: 36 } },
  { id: 'ilse', name: 'Keeper Ilse', x: 0, y: 0, behaviour: { kind: 'wander', radius: 20 } },
]

type Cullable = { obj: Phaser.GameObjects.Components.Visible; x0: number; y0: number; x1: number; y1: number }

export class WorldScene extends Phaser.Scene {
  mode: Mode = 'title'
  grid!: Grid
  decor: Decor[] = []
  solids: Solid[] = []
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
  private ocean!: Phaser.GameObjects.TileSprite
  private oceanFrame = 0
  private oceanTimer = 0
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
  private landmarkImgs = new Map<string, { img: Phaser.GameObjects.Image | null; night: Phaser.GameObjects.Image | null; door: Interactable }>()
  private tintables: Phaser.GameObjects.Components.Tint[] = []
  private flowerSpots: { x: number; y: number }[] = []
  private woodsSpots: { x: number; y: number }[] = []
  private autosaveT = 0
  private stateT = 0
  private playT = 0
  private stepAcc = 0
  private runAcc = 0
  private reduced = false
  private inCutscene = false
  private beam: Phaser.GameObjects.Image | null = null
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter
  private grassBits!: Phaser.GameObjects.Particles.ParticleEmitter

  constructor() {
    super('world')
  }

  create(data: { mode?: Mode; save?: Save | null }) {
    this.mode = data.mode ?? 'title'
    this.settings = loadSettings()
    this.reduced = this.settings.reducedMotion
    const world = this.registry.get('world') as WorldData
    this.grid = world.grid
    this.decor = world.decor
    this.rng = makeRng(WORLD_SEED).fork('scene')

    this.buildOcean()
    this.buildGround(world)
    this.dayNight = new DayNight(this, 60, this.reduced)
    this.wind = new Wind(this, this.reduced)
    this.buildLandmarks()
    this.buildDecor()
    this.buildProps()
    this.buildParticles()
    this.water = new Water(this, this.grid, BLUEPRINT.river.pts, this.rng.fork('water'), this.reduced)
    this.weather = new Weather(this, this.grid, this.rng.fork('weather'), this.reduced)
    this.critters = new Critters(this, this.grid, this.rng.fork('critters'), this.flowerSpots, this.woodsSpots, this.reduced)
    this.critters.onGull = () => play('gull')
    this.placeStars()
    this.dayNight.registerTinted(this.tintables)
    this.rig = new CameraRig(this)
    this.rig.shakeEnabled = this.settings.shake && !this.reduced

    const onKey = (e: KeyboardEvent) => {
      if (!this.scene.isActive() || document.body.classList.contains('modal-open')) return
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') this.onAction()
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
    this.unsub.push(events.on('world:action', ({ action }) => (action === 'interact' ? this.onAction() : action === 'menu' ? this.onMenu() : this.onPanel(action))))
    this.unsub.push(events.on('settings:changed', () => this.applySettings()))
    this.unsub.push(events.on('game:reader', () => this.state?.ach.unlock('well_read')))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u()
      this.unsub = []
    })
    this.events.on(Phaser.Scenes.Events.WAKE, (_s: unknown, d?: { x: number; y: number }) => this.onWake(d))

    if (this.mode === 'title') this.enterTitle()
    else this.startPlay(data.save ?? null, false)
  }

  /* ---------------- construction ---------------- */

  private buildOcean() {
    const cam = this.cameras.main
    this.ocean = this.add.tileSprite(0, 0, cam.width, cam.height, ATLAS, 'water_0').setOrigin(0).setScrollFactor(0).setDepth(-20000)
    this.scale.on('resize', () => this.ocean.setSize(this.scale.width, this.scale.height))
    this.tintables.push(this.ocean)
  }

  private buildGround(world: WorldData) {
    for (const c of world.chunks) {
      const img = this.add.image(c.x, c.y, c.key).setOrigin(0).setDepth(-10000)
      this.cullables.push({ obj: img, x0: c.x, y0: c.y, x1: c.x + img.width, y1: c.y + img.height })
      this.tintables.push(img)
    }
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
      const flat = d.kind === 'flower' || d.kind === 'shell' || d.kind === 'lily' || d.kind === 'flowerbed' || d.kind === 'mushroom'
      img.setDepth(flat ? d.y - 4000 : d.y)
      if (d.kind === 'tree' || d.kind === 'palm') img.setFlipX(d.v === 1)
      if (d.kind === 'tree' || d.kind === 'pine' || d.kind === 'palm') this.wind.registerTree(img)
      this.cullables.push({ obj: img, x0: img.x - img.width, y0: img.y - img.height, x1: img.x + img.width, y1: img.y + 8 })
      this.tintables.push(img)
      if (d.kind === 'flower') this.flowerSpots.push({ x: d.x, y: d.y })
      if ((d.kind === 'tree' || d.kind === 'pine') && regionAt(BLUEPRINT.regions, d.x / TILE, d.y / TILE)?.id === 'woods') this.woodsSpots.push({ x: d.x, y: d.y })
      if (d.kind === 'lamp') new Lamp(this, d.x, d.y, this.dayNight)
      if (d.kind === 'shell' && d.v === 1) this.makeShellPickup(img, d)
      if (d.solid) {
        const b = SOLID_BOX[d.kind] ?? { w: 10, h: 6 }
        this.solids.push({ x: d.x - b.w / 2, y: d.y - b.h + 1, w: b.w, h: b.h })
      }
    }
  }

  private makeShellPickup(img: Phaser.GameObjects.Image, d: Decor) {
    const id = `shell_${Math.round(d.x)}_${Math.round(d.y)}`
    const it: Interactable = {
      x: d.x,
      y: d.y,
      radius: 18,
      prompt: 'Pick up shell',
      enabled: () => !this.state?.flag(id),
      onInteract: () => {
        if (!this.state || this.state.flag(id)) return
        this.state.setFlag(id)
        this.state.give('shell', 1)
        this.state.quests.advance('shells', 'find', 1)
        sfx.pickup()
        this.sparks.emitParticleAt(d.x, d.y - 4, 6)
        this.tweens.add({ targets: img, y: img.y - 14, alpha: 0, duration: 260, onComplete: () => img.destroy() })
        this.interact.remove(it)
      },
    }
    this.interact.add(it)
  }

  private buildLandmarks() {
    for (const lm of BLUEPRINT.landmarks) {
      const bx = (lm.tx + lm.w / 2) * TILE
      const by = (lm.ty + lm.h) * TILE
      let img: Phaser.GameObjects.Image | null = null
      let night: Phaser.GameObjects.Image | null = null
      if (hasFrame(this, lm.sprite)) {
        img = this.add.image(bx, by, ATLAS, lm.sprite).setDepth(by)
        this.cullables.push({ obj: img, x0: img.x - img.width, y0: img.y - img.height, x1: img.x + img.width, y1: img.y + 8 })
        this.tintables.push(img)
        if (hasFrame(this, `${lm.sprite}_night`)) {
          night = this.add.image(bx, by, ATLAS, `${lm.sprite}_night`).setDepth(91000).setAlpha(0)
          this.dayNight.onWarmth((w) => night!.setAlpha(w))
        }
      } else this.placeholderBuilding(lm, bx, by)
      this.solids.push({ x: lm.tx * TILE, y: lm.ty * TILE, w: lm.w * TILE, h: lm.h * TILE })
      const dx = lm.door.x * TILE + 8
      const dy = lm.door.y * TILE + 8
      const zone = ZONES.find((z) => z.id === lm.id)!
      this.dayNight.addLight({ x: dx, y: dy - 10, r: 34, color: 0xffc070 })
      const door = makeDoor(
        dx,
        dy,
        zone.name,
        () => lm.id !== 'stealth' || !this.state || this.state.save.packets.length >= 20,
        () => this.enterLandmark(lm),
        () => `Sealed — ${this.state?.save.packets.length ?? 0}/20 packets`,
        () => {
          play('bonk', 'bump')
          this.rig.shake(0.002, 100)
          const tree = getTree('vault_door')
          if (tree) void this.runDialogue(tree)
        },
      )
      this.interact.add(door)
      this.landmarkImgs.set(lm.id, { img, night, door })
    }
  }

  private placeholderBuilding(lm: Landmark, bx: number, by: number) {
    const w = lm.w * TILE
    const h = lm.h * TILE + 28
    const g = this.add.graphics().setDepth(by)
    g.fillStyle(0xf1e2c4, 1)
    g.fillRect(bx - w / 2, by - h + 12, w, h - 12)
    g.fillStyle(0xd8574a, 1)
    g.fillTriangle(bx - w / 2 - 6, by - h + 14, bx + w / 2 + 6, by - h + 14, bx, by - h - 10)
    g.fillStyle(0x7a4b2c, 1)
    g.fillRect(bx - 6, by - 16, 12, 16)
    g.lineStyle(1, 0x2a2340, 1)
    g.strokeRect(bx - w / 2, by - h + 12, w, h - 12)
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
      } else if (p.kind === 'windmill' && hasFrame(this, 'windmill')) {
        img = this.add.image(x, y, ATLAS, 'windmill').setDepth(y)
        if (hasFrame(this, 'windmill_blades_0')) {
          const b = this.add.sprite(x, y - 60, ATLAS, 'windmill_blades_0').setDepth(y + 1)
          if (this.anims.exists('windmill_blades')) b.play('windmill_blades')
          this.tintables.push(b)
        }
      } else if (hasFrame(this, p.kind)) img = this.add.image(x, y, ATLAS, p.kind).setDepth(y)
      if (img) {
        this.cullables.push({ obj: img, x0: img.x - img.width, y0: img.y - img.height, x1: img.x + img.width, y1: img.y + 8 })
        this.tintables.push(img)
      }
      if (p.solid) this.solids.push({ x: p.solid.x * TILE, y: p.solid.y * TILE, w: p.solid.w * TILE, h: p.solid.h * TILE })
      if (p.kind === 'signpost') {
        const s = new Sign(this, img ?? this.add.image(x, y, ATLAS, 'signpost').setDepth(y), p.id ?? 'sign', () => this.readSign(p.id ?? 'sign'))
        this.signs.push(s)
        this.interact.add(s.interactable)
      } else if (p.kind === 'telescope' || p.kind === 'well' || p.kind === 'stall' || p.kind === 'boat' || p.kind === 'mailbox' || p.kind === 'bell' || p.kind === 'fountain') {
        const kind = p.kind
        this.interact.add({ x, y, radius: 22, prompt: kind === 'bell' ? 'Ring bell' : kind === 'telescope' ? 'Look through telescope' : `Inspect ${kind}`, onInteract: () => this.talkObject(kind) })
      }
    }
    // packets & chests
    for (let i = 0; i < BLUEPRINT.packetSpots.length; i++) {
      const p = BLUEPRINT.packetSpots[i]
      this.packets.push(new Packet(this, `p${i}`, p.x * TILE + 8, p.y * TILE + 12, this.reduced))
    }
    BLUEPRINT.chestSpots.forEach((c, i) => {
      const ch = new Chest(this, `c${i}`, c.x * TILE + 8, c.y * TILE + 14, false, (chest) => this.openChest(chest))
      this.chests.push(ch)
      this.interact.add(ch.interactable)
      this.solids.push({ x: ch.x - 7, y: ch.y - 6, w: 14, h: 6 })
      this.tintables.push(ch.sprite)
    })
    // fishing spot
    const f = BLUEPRINT.fishingSpot
    this.interact.add({ x: f.x * TILE + 8, y: f.y * TILE + 8, radius: 20, prompt: 'Fish', onInteract: () => this.fish(), enabled: () => !!this.state && this.state.quests.isStarted('fishing') })
    // viewpoint
    const v = BLUEPRINT.viewpoint
    this.interact.add({ x: v.x * TILE + 8, y: v.y * TILE + 8, radius: 26, prompt: 'Take in the view', onInteract: () => this.talkObject('telescope'), priority: -1 })
  }

  private buildParticles() {
    this.dust = this.add.particles(0, 0, ATLAS, { frame: 'dust', lifespan: 380, speed: { min: 6, max: 22 }, scale: { start: 1, end: 0 }, alpha: { start: 0.8, end: 0 }, quantity: 1, frequency: -1 }).setDepth(-3000)
    this.sparks = this.add.particles(0, 0, ATLAS, { frame: 'spark', lifespan: 520, speed: { min: 30, max: 90 }, scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 }, quantity: 1, frequency: -1 }).setDepth(70000)
    this.grassBits = this.add.particles(0, 0, ATLAS, { frame: 'leaf', lifespan: 480, speed: { min: 20, max: 70 }, gravityY: 120, rotate: { start: 0, end: 180 }, alpha: { start: 1, end: 0 }, quantity: 1, frequency: -1 }).setDepth(69000)
  }

  private placeStars() {
    const pts: { x: number; y: number }[] = []
    const r = this.rng.fork('stars')
    let tries = 0
    while (pts.length < 90 && tries++ < 3000) {
      const x = r.int(0, this.grid.w - 1)
      const y = r.int(0, this.grid.h - 1)
      const t = this.grid.get(x, y)
      if (t === T.DEEP || t === T.WATER) pts.push({ x: x * TILE + r.int(0, 15), y: y * TILE + r.int(0, 15) })
    }
    this.dayNight.placeStars(pts)
  }

  private buildNpcs() {
    for (const def of NPC_CAST) {
      const spot = BLUEPRINT.npcSpots[def.id]
      if (!spot) continue
      const npc = new Npc(this, { ...def, x: spot.x * TILE + 8, y: spot.y * TILE + 12 })
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
    const pts = [
      { x: 80 * TILE, y: 66 * TILE },
      { x: 80 * TILE, y: 100 * TILE },
      { x: 140 * TILE, y: 100 * TILE },
      { x: 120 * TILE, y: 34 * TILE },
      { x: 40 * TILE, y: 34 * TILE },
      { x: 34 * TILE, y: 88 * TILE },
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
    uiState.quests = this.state.quests
    uiState.achievements = this.state.ach
    uiState.xp = this.state.xp
    uiState.faces = (f) => frameDataURL(f, 3)
    const minimapSrc = this.textures.exists('minimap') ? (this.textures.get('minimap').getSourceImage() as HTMLCanvasElement) : null
    if (minimapSrc && minimapSrc.toDataURL) uiState.minimapURL = minimapSrc.toDataURL()
    this.state.handlers = {
      sleep: (to) => this.sleep(to),
      teleport: (id) => this.travelTo(id),
      cutscene: (id) => void this.runCutscene(id),
      panel: (id) => this.openPanel(id),
      companion: (on) => this.setCompanion(on),
      sfx: (id) => (sfx as unknown as Record<string, (() => void) | undefined>)[id]?.(),
      hat: (id) => this.player?.setHat(id),
      isNight: () => this.dayNight.isNight,
      celebrate: () => {
        events.emit('ui:banner', { title: '100%', sub: 'You found everything. Thank you for exploring!' })
        this.setFireworks(this.player?.x ?? 80 * TILE, (this.player?.y ?? 66 * TILE) - 30)
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
    this.player.setHat(this.state.save.hat || null)
    this.player.onStep = (surface) => {
      const fn = (sfx as unknown as Record<string, (() => void) | undefined>)[`step_${surface}`] ?? sfx.step
      fn()
      if (this.player.running && !this.reduced) this.dust.emitParticleAt(this.player.x, this.player.y + 1, 1)
    }
    this.buildNpcs()
    // open already-opened chests, remove collected packets
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
    if (fresh) void this.runCutscene('arrival')
    else this.state.ach.unlock('first_steps')
  }

  private backToTitle() {
    if (this.state && this.player) this.state.persist(this.player.feet, 'world', this.dayNight.time, this.weather.state)
    this.scene.restart({ mode: 'title' })
  }

  private applySettings() {
    this.settings = loadSettings()
    this.reduced = this.settings.reducedMotion
    this.rig.shakeEnabled = this.settings.shake && !this.reduced
  }

  private setLocked(v: boolean) {
    this.locked = v
    if (v) {
      this.player?.freeze(true)
      this.interact.hide()
    } else this.player?.freeze(false)
  }

  private onWake(d?: { x?: number; y?: number; cutscene?: string }) {
    if (d && this.player && typeof d.x === 'number' && typeof d.y === 'number') {
      this.player.setPosition(d.x, d.y)
      this.player.dir = 'down'
      this.player.idle()
      this.rig.follow(this.player)
    }
    this.cameras.main.fadeIn(300, 0, 0, 0)
    events.emit('ui:hud', { visible: true })
    this.setLocked(false)
    this.refreshSoundtrack()
    this.registry.set('state', this.state)
    if (d?.cutscene) void this.runCutscene(d.cutscene)
  }

  /* ---------------- actions ---------------- */

  private onAction() {
    if (this.mode !== 'play' || this.locked || this.inCutscene) return
    if (this.interact.trigger()) return
    void this.swing()
  }

  private onMenu() {
    if (this.mode !== 'play' || this.inCutscene) return
    if (!this.locked) this.openPanel('pause')
  }

  private onPanel(id: 'map' | 'journal') {
    if (this.mode !== 'play' || this.locked || this.inCutscene) return
    this.openPanel(id)
  }

  private openPanel(id: string) {
    events.emit('ui:panel', { id })
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

  private readSign(id: string) {
    const tree = getTree(`sign_${id}`) ?? linesTree(`sign_${id}`, 'Signpost', this.signLines(id))
    void this.runDialogue(tree)
  }

  private signLines(id: string): string[] {
    const mod = (window as unknown as { __signs?: Record<string, string[]> }).__signs
    return mod?.[id] ?? ['A weathered signpost.', 'The paint has faded.']
  }

  private talkObject(kind: string) {
    if (kind === 'telescope') this.state.ach.unlock('summit')
    if (kind === 'bell') play('bell')
    const tree = getTree(kind) ?? linesTree(kind, kind.charAt(0).toUpperCase() + kind.slice(1), [`You inspect the ${kind}.`])
    void this.runDialogue(tree)
  }

  private async talkTo(npc: Npc) {
    if (this.locked) return
    const tree = getTree(npc.def.id) ?? linesTree(npc.def.id, npc.def.name, ['...', 'Lovely weather on the isle today.'])
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
    if (hooks.openDialogue) await hooks.openDialogue(runner)
    else {
      // no dialogue UI yet: log lines
      while (!runner.ended) {
        console.log(`[${runner.line.who}] ${runner.line.text}`)
        if (runner.advance() === 'choice') runner.choose(0)
      }
    }
    this.setLocked(false)
    this.emitState()
  }

  private openChest(chest: Chest) {
    if (!this.state.openChest(chest.id)) return
    play('chest')
    this.rig.shake(0.002, 100)
    this.sparks.emitParticleAt(chest.x, chest.y - 8, 10)
    const coins = 10 + this.rng.int(0, 15)
    this.state.give('coin', coins)
    events.emit('ui:toast', { kind: 'item', icon: '🪙', title: `+${coins} coins` })
    this.state.addXp(15)
  }

  private enterLandmark(lm: Landmark) {
    const zone = ZONES.find((z) => z.id === lm.id)!
    const first = this.state.discover(lm.id)
    if (first) {
      sfx.discover()
      this.rig.punchZoom(0.05, 300)
      events.emit('ui:banner', { title: `Discovered: ${zone.name}`, sub: zone.label })
    }
    if (this.scene.get('interior')) {
      this.state.persist(this.player.feet, 'world', this.dayNight.time, this.weather.state)
      this.registry.set('state', this.state)
      this.setLocked(true)
      play('door')
      this.cameras.main.fadeOut(220, 0, 0, 0)
      this.time.delayedCall(240, () => {
        this.interact.hide()
        this.scene.launch('interior', { room: lm.room, returnX: lm.door.x * TILE + 8, returnY: lm.door.y * TILE + 20 })
        this.scene.sleep()
      })
    } else {
      sfx.open()
      this.openPanel(`zone:${lm.id}`)
    }
  }

  private travelTo(id: string) {
    const lm = BLUEPRINT.landmarks.find((l) => l.id === id)
    if (!lm || !this.player) return
    const x = lm.door.x * TILE + 8
    const y = lm.door.y * TILE + 22
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

  private async fish() {
    if (this.locked || this.inCutscene) return
    this.locked = true
    this.interact.hide()
    const f = new Fishing(this, this.player, this.rng, (n) => play(n))
    const result = await f.run()
    this.locked = false
    if (result === 'caught') {
      this.state.give('fish', 1)
      this.state.save.stats.fishCaught++
      this.state.quests.advance('fishing', 'catch', 1)
      this.state.ach.unlock('fisher')
      this.state.addXp(12)
      events.emit('ui:toast', { kind: 'item', icon: '🐟', title: 'Caught a Sunfish!' })
    } else if (result === 'missed') events.emit('ui:toast', { kind: 'info', icon: '🎣', title: 'It got away…' })
    this.emitState()
  }

  /* ---------------- cutscenes ---------------- */

  private async runCutscene(id: string): Promise<void> {
    if (id === 'arrival') return this.arrival()
    if (id === 'beacon') return this.beacon()
  }

  private async arrival(): Promise<void> {
    const cs = new Cutscene(this)
    this.inCutscene = true
    cs.begin()
    this.player.setVisible(false)
    const dockX = BLUEPRINT.fishingSpot.x * TILE + 8
    const dockEndY = BLUEPRINT.fishingSpot.y * TILE + 8
    const boat = hasFrame(this, 'boat') ? this.add.image(dockX + 30, dockEndY + 220, ATLAS, 'boat').setDepth(dockEndY + 40) : null
    this.rig.snapTo(dockX, dockEndY + 60)
    const wake = hasFrame(this, 'ripple_0') && !this.reduced ? this.add.particles(0, 0, ATLAS, { frame: 'foam_0', lifespan: 700, scale: { start: 0.6, end: 1.2 }, alpha: { start: 0.7, end: 0 }, quantity: 1, frequency: -1 }).setDepth(-9500) : null
    if (boat) {
      await cs.moveTo(boat, dockX + 30, dockEndY + 18, 70, () => {
        wake?.emitParticleAt(boat.x, boat.y + 10, 1)
      })
    } else await cs.wait(600)
    this.player.setPosition(dockX + (boat ? 30 : 0), dockEndY + 12).setVisible(true)
    this.player.dir = 'up'
    this.player.idle()
    this.rig.follow(this.player, false)
    await cs.wait(300)
    if (!cs.skipped) {
      await this.player.hop(12, 360)
      this.player.setPosition(dockX, dockEndY - 6)
      play('hop')
    } else this.player.setPosition(dockX, dockEndY - 6)
    await cs.wait(400)
    wake?.destroy()
    // Mira walks over
    const mira = this.npcs.find((n) => n.def.id === 'mira')
    if (mira) {
      mira.talkStart(this.player.x, this.player.y)
      await cs.moveTo(mira, this.player.x - 4, this.player.y - 26, 60, () => {
        mira.setDepth(mira.y)
      })
      mira.face(this.player.x, this.player.y)
      this.player.face(mira.x, mira.y)
    }
    cs.end()
    this.inCutscene = false
    this.state.ach.unlock('first_steps')
    if (mira) await this.talkTo(mira)
    else events.emit('ui:hint', { text: 'WASD / arrows to walk · Shift to run · E to talk' })
    events.emit('ui:banner', { title: 'Harbor', sub: 'Lineage Isle' })
    this.state.save.tutorialDone = true
    this.state.dirty = true
  }

  private ensureBeam() {
    if (this.beam || !hasFrame(this, 'beam')) return
    const lm = BLUEPRINT.landmarks.find((l) => l.id === 'contact')!
    const x = (lm.tx + lm.w / 2) * TILE
    const y = lm.ty * TILE - 88
    this.beam = this.add.image(x, y, ATLAS, 'beam').setBlendMode(Phaser.BlendModes.ADD).setDepth(95000).setAlpha(0)
    this.beam.setOrigin(0, 0.5)
  }

  private async beacon(): Promise<void> {
    this.state.quests.advance('beacon', 'light', 1)
    this.state.ach.unlock('keeper')
    soundtrack.fanfare()
    this.ensureBeam()
    const lm = BLUEPRINT.landmarks.find((l) => l.id === 'contact')!
    this.setFireworks((lm.tx + lm.w / 2) * TILE, lm.ty * TILE - 60)
    this.openPanel('zone:contact')
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
    const coast = r?.id === 'harbor' || r?.id === 'point' ? 0.85 : r?.id === 'engine' || r?.id === 'fields' ? 0.45 : 0.2
    const woods = r?.id === 'woods' ? 0.8 : r?.id === 'heights' || r?.id === 'ridge' ? 0.4 : 0.1
    soundtrack.world({ night: this.dayNight.isNight, rain: this.weather.rainAmount, coast, woods })
  }

  private bubbleT = 0

  /** Quest givers show ! when they have a quest, ? when you can turn in. */
  private refreshBubbles() {
    if (!this.state) return
    const q = this.state.quests
    const turnIn: Record<string, () => boolean> = {
      pip: () => q.isActive('shells') && this.state.has('shell', 5),
      tomas: () => q.isActive('fishing') && this.state.has('fish', 3),
      ravi: () => q.isActive('gear') && this.state.has('gear', 1),
      sol: () => q.isActive('gear') && !this.state.flag('gotGear'),
    }
    const gives: Record<string, string> = { pip: 'shells', tomas: 'fishing', ilse: 'beacon' }
    for (const n of this.npcs) {
      const id = n.def.id
      if (turnIn[id]?.()) n.setBubble('quest')
      else if (gives[id] && !q.isStarted(gives[id])) n.setBubble('excl')
      else if (id === 'ravi' && !q.isStarted('gear')) n.setBubble('excl')
      else n.setBubble(null)
    }
  }

  private emitState() {
    if (!this.state) return
    const st = this.state.save
    uiState.stats.steps = st.stats.steps
    uiState.stats.playSeconds = st.stats.playSeconds
    uiState.stats.fishCaught = st.stats.fishCaught
    uiState.stats.bonks = st.stats.bonks
    uiState.stats.grassCut = st.grassCut
    uiState.stats.packets = st.packets.length
    uiState.stats.discoveries = st.discoveries
    uiState.visitedRegions = st.visitedRegions
    const r = this.player ? regionAt(BLUEPRINT.regions, this.player.x / TILE, this.player.y / TILE) : null
    events.emit('world:state', {
      packets: this.state.save.packets.length,
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

  update(t: number, dms: number) {
    const dt = Math.min(dms, 50) / 1000
    const cam = this.cameras.main
    const view = cam.worldView

    // ocean drift + animation
    this.oceanTimer += dms
    if (this.oceanTimer > 260) {
      this.oceanTimer = 0
      this.oceanFrame = (this.oceanFrame + 1) % 4
      this.ocean.setFrame(`water_${this.oceanFrame}`)
    }
    this.ocean.tilePositionX = cam.scrollX + t * 0.004
    this.ocean.tilePositionY = cam.scrollY + Math.sin(t * 0.0007) * 3

    this.cullTimer += dms
    if (this.cullTimer > 200) {
      this.cullTimer = 0
      this.cull()
    }

    const day = this.dayNight.ambient
    const playerPos = this.player ? { x: this.player.x, y: this.player.y } : { x: view.centerX, y: view.centerY }
    const region = regionAt(BLUEPRINT.regions, playerPos.x / TILE, playerPos.y / TILE)
    const inWoods = region?.id === 'woods'
    const nearCoast = region?.id === 'harbor' || region?.id === 'point' || region?.id === 'engine'

    this.dayNight.update(this.mode === 'play' ? dt : dt * 0.25, dms)
    this.weather.update(dms)
    this.wind.update(dms, view, inWoods)
    this.water.update(dms, view, 1 - day.darkness, day.darkness)
    this.critters.update(dms, view, 1 - day.darkness, day.darkness, playerPos, inWoods, nearCoast)
    const windPhase = this.wind.phase
    for (const g of this.grasses) if (g.sprite.visible || g.cut) g.update(this.time.now, windPhase)

    if (this.mode === 'play' && this.player) {
      let dx = 0
      let dy = 0
      let run = false
      if (!this.locked && !this.inCutscene) {
        if (keys.any('ArrowLeft', 'KeyA')) dx -= 1
        if (keys.any('ArrowRight', 'KeyD')) dx += 1
        if (keys.any('ArrowUp', 'KeyW')) dy -= 1
        if (keys.any('ArrowDown', 'KeyS')) dy += 1
        run = keys.any('ShiftLeft', 'ShiftRight') || touchInput.run
        if (touchInput.active) {
          dx += touchInput.x
          dy += touchInput.y
          if (Math.hypot(touchInput.x, touchInput.y) > 0.9) run = true
        }
        const pad = this.input.gamepad?.getPad(0)
        if (pad) {
          if (Math.abs(pad.leftStick.x) > 0.2) dx += pad.leftStick.x
          if (Math.abs(pad.leftStick.y) > 0.2) dy += pad.leftStick.y
          if (pad.B) run = true
          if (pad.A && this.time.now - ((pad as unknown as { _lastA?: number })._lastA ?? 0) > 300) {
            ;(pad as unknown as { _lastA?: number })._lastA = this.time.now
            this.onAction()
          }
        }
      }
      const px0 = this.player.x
      const py0 = this.player.y
      this.player.move(dx, dy, run, dt, this.blocked, this.solids, this.grid)
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
        // shallows splash ring
        if (this.player.surface === 'water' && !this.reduced && this.rng.chance(0.06) && this.anims.exists('ripple')) {
          const r = this.add.sprite(this.player.x, this.player.y + 2, ATLAS, 'ripple_0').setDepth(this.player.y - 1)
          r.play('ripple')
          r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy())
        }
      }
      if (!this.locked && !this.inCutscene) this.interact.update(this.player.x, this.player.y)
      for (const p of this.packets)
        if (p.near(this.player.x, this.player.y)) {
          p.collect()
          this.sparks.emitParticleAt(p.x, p.y - 6, 12)
          play('packet', 'pickup')
          this.state.collectPacket(p.id)
          this.rig.punchZoom(0.03, 200)
          this.emitState()
        }
      this.packets = this.packets.filter((p) => !p.collected)

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
        this.emitState()
      }
      this.bubbleT += dms
      if (this.bubbleT > 1200) {
        this.bubbleT = 0
        this.refreshBubbles()
      }
      this.autosaveT += dms
      if (this.autosaveT > 10000) {
        this.autosaveT = 0
        if (this.state.dirty || this.state.save.stats.steps % 5 === 0) this.state.persist(this.player.feet, 'world', this.dayNight.time, this.weather.state)
      }
    }

    if (this.state?.quests.isDone('beacon')) {
      this.ensureBeam()
      if (this.beam) {
        this.beam.rotation += dt * 0.45
        this.beam.setAlpha(Math.min(0.9, 0.15 + day.darkness))
      }
    }

    this.rig.update(dt)
  }

  get worldBounds() {
    return { w: WORLD_W, h: WORLD_H }
  }

  isSea(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE)
    const ty = Math.floor(y / TILE)
    return this.grid.inb(tx, ty) && isWater(this.grid.get(tx, ty))
  }
}
