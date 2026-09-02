// Inside a landmark: a small room built from the interior tileset.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { sfx } from '../audio/sfx'
import { soundtrack } from '../systems/Soundtrack'
import { TILE, pickZoom } from '../config'
import { events, touchInput } from '../core/events'
import { hooks } from '../core/hooks'
import { isBound, keys } from '../core/keys'
import { loadSettings, type Settings } from '../core/save'
import { ROOMS } from '../data/rooms'
import { ZONES } from '../data/content'
import { ROOM_HOSTS, greetFlag } from '../data/npcs'
import { NPC_WALK_FRAMES, NPC_WALK_MS, Npc, walkFrameIndex } from '../entities/Npc'
import { Player, type Dir } from '../entities/Player'
import { DialogueRunner, type Tree } from '../systems/Dialogue'
import { getTree, linesTree, npcInfo } from '../systems/DialogueRegistry'
import type { GameState } from '../systems/GameState'
import { InteractSystem } from '../systems/Interact'
import type { Solid } from '../world/collision'
import { planHop } from '../world/hop'
import { parseRoom, type ParsedRoom } from '../world/rooms'
import type { Grid } from '../world/terrain'
import { planRoomExit, type ExitReason } from './transitions'
import type { WorldScene } from './WorldScene'

const NPC_NAMES: Record<string, string> = { naman: 'Naman', ada: 'Ada', ravi: 'Tinker Ravi' }

/** Long enough for the fade-in and the room banner before the host speaks. */
const GREET_DELAY_MS = 420
/** How far a host crosses the floor to say hello. */
const GREET_STEP_TILES = 2
/** An unhurried indoor walking pace, in pixels per second. */
const GREET_SPEED = 44

/**
 * A room floor is flat and every wall is a `Solid`, so `Player.move` never reads
 * a height or a ledge out of the terrain grid indoors — it only needs something
 * shaped like one. Hoisted out of `update`, which used to build this object (and
 * a fresh `Uint8Array`) sixty times a second and throw it away again.
 */
const NO_TERRAIN = { get: () => 10, w: 0, h: 0, cells: new Uint8Array(0), set: () => {}, inb: () => true } as unknown as Grid

export class InteriorScene extends Phaser.Scene {
  private room!: ParsedRoom
  private roomId = ''
  private player!: Player
  private state!: GameState
  private interact = new InteractSystem()
  private solids: Solid[] = []
  private npcs: Npc[] = []
  private windows: Phaser.GameObjects.Image[] = []
  private locked = false
  private leaving = false
  private returnPos = { x: 0, y: 0 }
  private unsub: (() => void)[] = []
  private pendingCutscene: string | null = null
  private settings: Settings = loadSettings()

  constructor() {
    super('interior')
  }

  create(data: { room: string; returnX: number; returnY: number }) {
    const def = ROOMS[data.room]
    // A door onto a room that has not been built yet bows out rather than
    // crashing: back to the world with a word about it.
    if (!def) {
      this.leaving = true // keeps update() off a room that was never built
      this.returnPos = { x: data.returnX, y: data.returnY }
      events.emit('ui:toast', { kind: 'info', icon: '🚧', title: 'Opening soon.' })
      this.time.delayedCall(0, () => {
        this.scene.wake('world', { x: data.returnX, y: data.returnY })
        this.scene.stop()
      })
      return
    }
    this.roomId = data.room
    this.settings = loadSettings()
    this.room = parseRoom(def)
    this.returnPos = { x: data.returnX, y: data.returnY }
    this.state = this.registry.get('state') as GameState
    this.solids = [...this.room.solids]
    this.leaving = false
    this.locked = false
    this.npcs = []
    this.windows = []
    this.interact = new InteractSystem()
    const cam = this.cameras.main
    cam.setBackgroundColor('#0d0c1a')

    // tiles
    for (let y = 0; y < this.room.h; y++)
      for (let x = 0; x < this.room.w; x++) {
        const fr = this.room.tiles[y][x]
        if (!hasFrame(this, fr)) {
          const g = this.add.graphics().setDepth(-100)
          g.fillStyle(fr.startsWith('wall') ? 0x3d3b5c : fr === 'exit_door' ? 0x1b1a2e : 0xb98a5a, 1)
          g.fillRect(x * TILE, y * TILE, TILE, TILE)
          continue
        }
        const img = this.add.image(x * TILE, y * TILE, ATLAS, fr).setOrigin(0).setDepth(fr.startsWith('window') ? -90 : -100)
        if (fr.startsWith('window')) this.windows.push(img)
      }
    this.refreshWindows()

    // props
    for (const p of this.room.props) {
      if (!hasFrame(this, p.frames > 1 ? `${p.sprite}_0` : p.sprite)) {
        const g = this.add.graphics().setDepth(p.depth)
        g.fillStyle(0x7a4b2c, 1)
        g.fillRect(p.x - 12, p.y - 20, 24, 20)
      } else if (p.frames > 1) {
        const key = `room_${p.sprite}`
        if (!this.anims.exists(key))
          this.anims.create({ key, frames: Array.from({ length: p.frames }, (_, i) => ({ key: ATLAS, frame: `${p.sprite}_${i}` })), frameRate: p.fps, repeat: -1 })
        this.add.sprite(p.x, p.y, ATLAS, `${p.sprite}_0`).setDepth(p.depth).play(key)
      } else this.add.image(p.x, p.y, ATLAS, p.sprite).setDepth(p.depth)
      if (p.light && hasFrame(this, 'glow_warm')) this.add.image(p.x, p.y - 10, ATLAS, 'glow_warm').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(p.depth + 1)
      if (p.interact) {
        const target = p.interact
        this.interact.add({ x: p.x, y: p.y + 6, radius: 24, prompt: p.prompt ?? 'Inspect', onInteract: () => this.use(target, p.data), priority: 1 })
      }
    }
    if (this.roomId === 'skills') this.hangTools()

    // npcs. A host walks over to greet you on your first visit, so both the
    // body it blocks and the spot you press E on follow it across the floor.
    this.npcSolids.clear()
    for (const n of this.room.npcs) {
      const npc = new Npc(this, { id: n.id, name: NPC_NAMES[n.id] ?? npcInfo(n.id).name, x: n.x, y: n.y, behaviour: { kind: 'idle' }, facing: n.facing })
      this.npcs.push(npc)
      const solid: Solid = { x: n.x - 6, y: n.y - 6, w: 12, h: 8 }
      this.solids.push(solid)
      this.npcSolids.set(n.id, solid)
      this.interact.add({
        get x() {
          return npc.x
        },
        get y() {
          return npc.y
        },
        radius: 26,
        prompt: `Talk to ${npc.def.name}`,
        priority: 3,
        onInteract: () => this.talkTo(npc),
      })
    }

    // player + camera
    this.player = new Player(this, this.room.spawn.x, this.room.spawn.y)
    this.player.alwaysRun = this.settings.alwaysRun
    this.player.reducedMotion = this.settings.reducedMotion
    this.player.dir = 'up'
    this.player.idle()
    this.player.setHat(this.state?.save.hat || null)
    this.player.onStep = () => (sfx as unknown as Record<string, (() => void) | undefined>).step_wood?.()
    const rw = this.room.w * TILE
    const rh = this.room.h * TILE
    const fit = () => {
      const z = pickZoom(this.scale.width, this.scale.height)
      cam.setZoom(z)
      const vw = this.scale.width / z
      const vh = this.scale.height / z
      const bx = rw < vw ? (rw - vw) / 2 : 0
      const by = rh < vh ? (rh - vh) / 2 : 0
      cam.setBounds(bx, by, Math.max(rw, vw), Math.max(rh, vh))
    }
    fit()
    // Every room entry adds this listener, so every room exit must drop it
    // again: `unsub` is emptied by the SHUTDOWN handler below.
    this.scale.on('resize', fit)
    this.unsub.push(() => this.scale.off('resize', fit))
    cam.startFollow(this.player, true, 0.12, 0.12)
    cam.setRoundPixels(true)
    cam.fadeIn(300, 0, 0, 0)

    const onKey = (e: KeyboardEvent) => {
      if (!this.scene.isActive() || document.body.classList.contains('modal-open')) return
      if (isBound(e, 'jump')) this.onJump()
      else if (e.code === 'KeyE' || e.code === 'Enter') this.onAction()
      else if (e.code === 'Escape') setTimeout(() => !this.locked && events.emit('ui:panel', { id: 'pause' }), 0)
      else if (e.code === 'KeyM') !this.locked && events.emit('ui:panel', { id: 'map' })
      else if (e.code === 'KeyJ') !this.locked && events.emit('ui:panel', { id: 'journal' })
    }
    this.unsub.push(keys.onDown(onKey))
    this.unsub.push(events.on('ui:lock', ({ locked }) => this.setLocked(locked)))
    // Settings changed from the pause menu apply here and now, not on re-entry.
    this.unsub.push(events.on('settings:changed', () => this.applySettings()))
    this.unsub.push(
      events.on('world:action', ({ action }) =>
        action === 'interact'
          ? this.onAction()
          : action === 'jump'
            ? this.onJump()
            : action === 'menu'
              ? events.emit('ui:panel', { id: 'pause' })
              : events.emit('ui:panel', { id: action }),
      ),
    )
    this.unsub.push(events.on('world:travel', () => this.leave('travel')))
    // Back to Title: `WorldScene` hears this too and restarts itself into the
    // attract screen, so the room only stands down. See `planRoomExit`.
    this.unsub.push(events.on('game:title', () => this.leave('title')))
    const anyEvents = events as unknown as { on(k: string, fn: (p: { frame: number }) => void): () => void }
    this.unsub.push(anyEvents.on('room:window', ({ frame }) => this.setSkyFrame(frame)))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u()
      this.unsub = []
      if (this.state) {
        this.state.handlers.cutscene = this.prevCutsceneHandler
        this.state.handlers.hat = this.prevHatHandler
      }
    })

    // intercept cutscene effects while inside
    this.prevCutsceneHandler = this.state?.handlers.cutscene
    if (this.state) this.state.handlers.cutscene = (id) => this.queueCutscene(id)
    // …and hats, so a cap won at the chalkboard or the pallet lands on the head
    // standing in this room, not only on the one waiting outside.
    // `prev` is captured, not read back off the field: re-entering a room would
    // otherwise leave the wrapper calling whatever the field holds later — which
    // can be the wrapper itself.
    const prevHat = this.state?.handlers.hat
    this.prevHatHandler = prevHat
    if (this.state)
      this.state.handlers.hat = (id) => {
        prevHat?.(id)
        this.player?.setHat(id)
      }

    soundtrack.room(def.music)
    events.emit('ui:hud', { visible: true })
    events.emit('ui:banner', { title: def.name })
    this.maybeGreetHost()
  }

  private prevCutsceneHandler: ((id: string) => void) | undefined
  private prevHatHandler: ((id: string) => void) | undefined
  private npcSolids = new Map<string, Solid>()

  /* ---------------- the host's welcome ---------------- */

  /**
   * First visit to a room: its host crosses the floor and says where you are.
   * Once only — `greet_<room>` remembers it — and skippable exactly like every
   * other conversation. Rooms whose host stands outdoors (Arjun at the Safe
   * Stride clinic, Ilse at the lamp room) still get the greeting; there is
   * simply nobody to walk it over.
   */
  private maybeGreetHost() {
    const hostId = ROOM_HOSTS[this.roomId]
    if (!hostId || !this.state || this.state.flag(greetFlag(this.roomId))) return
    const tree = getTree(hostId)
    if (!tree?.nodes.intro) return
    // Hold the player still through the fade-in, or they can reach the host and
    // press E before the welcome lands — and hear the second line first.
    this.setLocked(true)
    this.time.delayedCall(GREET_DELAY_MS, () => {
      if (this.leaving || !this.scene.isActive()) return
      void this.greet(hostId, tree)
    })
  }

  private async greet(hostId: string, tree: Tree) {
    const npc = this.npcs.find((n) => n.def.id === hostId) ?? null
    this.setLocked(true)
    if (npc) await this.stepOver(npc)
    if (this.leaving) return
    // A greeting is a conversation: it counts toward Full House exactly as
    // walking up and pressing E does, and keeps save.talked agreeing with met_*.
    this.state.talked(hostId)
    // `intro` is the auto-greet node: deliberately absent from `tree.entry`, so
    // talking to the same villager outdoors never opens with an indoor line.
    await this.runDialogue({ ...tree, entry: [{ node: 'intro' }] }, hostId)
    npc?.talkEnd()
  }

  /** Walk a host up to two tiles toward the player, then turn to face them. */
  private stepOver(npc: Npc): Promise<void> {
    const dx = this.player.x - npc.x
    const dy = this.player.y - npc.y
    const dist = Math.hypot(dx, dy) || 1
    // stop a tile short: a greeting, not a shove
    const step = Math.min(GREET_STEP_TILES * TILE, dist - TILE)
    npc.talking = true // idle fidgeting must not fight the tween
    if (step < 4 || this.settings.reducedMotion) {
      npc.talkStart(this.player.x, this.player.y)
      return Promise.resolve()
    }
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
    npc.dir = dir
    const frames = Array.from({ length: NPC_WALK_FRAMES }, (_, i) => `npc_${npc.def.id}_walk_${dir}_${i}`)
    const animated = frames.every((f) => hasFrame(this, f))
    return new Promise<void>((resolve) => {
      let f = 0
      const cycle = this.time.addEvent({
        delay: NPC_WALK_MS,
        loop: true,
        callback: () => {
          if (animated) npc.sprite.setTexture(ATLAS, frames[walkFrameIndex(f++)])
        },
      })
      this.tweens.add({
        targets: npc,
        x: npc.x + (dx / dist) * step,
        y: npc.y + (dy / dist) * step,
        duration: (step / GREET_SPEED) * 1000,
        onUpdate: () => npc.setDepth(npc.y),
        onComplete: () => {
          cycle.remove()
          npc.talkStart(this.player.x, this.player.y)
          const solid = this.npcSolids.get(npc.def.id)
          if (solid) {
            solid.x = npc.x - 6
            solid.y = npc.y - 6
          }
          resolve()
        },
      })
    })
  }

  private hangTools() {
    const zone = ZONES.find((z) => z.id === 'skills')
    if (!zone?.content.groups) return
    const map: Record<string, string> = {
      Java: 'tool_java',
      'Spring Boot': 'tool_spring',
      Python: 'tool_python',
      'C++': 'tool_cpp',
      SQL: 'tool_sql',
      'Apache Kafka': 'tool_kafka',
      'Apache Flink': 'tool_flink',
      'Kafka Streams': 'tool_kstreams',
      'IBM MQ': 'tool_mq',
      Redis: 'tool_redis',
      DynamoDB: 'tool_dynamo',
      Docker: 'tool_docker',
      Linux: 'tool_linux',
      Git: 'tool_git',
    }
    const boards = this.room.props.filter((p) => p.sprite === 'toolwall')
    boards.forEach((b, gi) => {
      const g = zone.content.groups![gi]
      if (!g) return
      g.items.forEach((item, i) => {
        const fr = map[item]
        if (!fr || !hasFrame(this, fr)) return
        const col = i % 3
        const row = Math.floor(i / 3)
        this.add.image(b.x - 20 + col * 20, b.y - 30 + row * 16, ATLAS, fr).setDepth(b.depth + 1)
      })
    })
  }

  private refreshWindows() {
    const world = this.scene.get('world') as WorldScene | null
    const night = !!world?.dayNight?.isNight
    for (const w of this.windows) {
      if (w.frame.name.startsWith('window_sky')) continue
      const fr = night ? 'window_night' : 'window_day'
      if (hasFrame(this, fr)) w.setFrame(fr)
    }
  }

  private setSkyFrame(frame: number) {
    for (const w of this.windows) if (w.frame.name.startsWith('window_sky') && hasFrame(this, `window_sky_${frame}`)) w.setFrame(`window_sky_${frame}`)
  }

  /** Mirrors WorldScene.applySettings — the pace and motion rules are the same inside. */
  private applySettings() {
    this.settings = loadSettings()
    if (this.player) {
      this.player.alwaysRun = this.settings.alwaysRun
      this.player.reducedMotion = this.settings.reducedMotion
    }
  }

  private setLocked(v: boolean) {
    this.locked = v
    this.player?.freeze(v)
    if (v) this.interact.hide()
  }

  private onAction() {
    if (this.locked || this.leaving) return
    if (!this.interact.trigger()) void this.player.swing()
  }

  /** Indoors a hop is pure flourish: nowhere to jump to, so it stays on the spot. */
  private onJump() {
    if (this.locked || this.leaving || !this.player) return
    const plan = planHop(
      this.player.x,
      this.player.y,
      0,
      0,
      true,
      () => true,
      () => true,
    )
    if (this.player.startHop(plan.lx, plan.ly)) sfx.hop()
  }

  private use(target: string, data?: unknown) {
    // `minigame:<id>` hands off to the host, which opens the game over this
    // room: the scene keeps drawing behind the dialog but stops taking input.
    if (target.startsWith('minigame:')) {
      sfx.open()
      events.emit('ui:panel', { id: 'minigame', data: target.slice(9) })
      return
    }
    if (target.startsWith('panel:')) {
      const id = target.slice(6)
      sfx.open()
      events.emit('ui:panel', { id, data })
      return
    }
    if (target.startsWith('tree:')) {
      const id = target.slice(5)
      const tree = getTree(id) ?? linesTree(id, 'You', [`You look at the ${id}.`])
      void this.runDialogue(tree)
    }
  }

  private async talkTo(npc: Npc) {
    const tree = getTree(npc.def.id) ?? linesTree(npc.def.id, npc.def.name, ['Hello there.'])
    npc.talkStart(this.player.x, this.player.y)
    this.player.face(npc.x, npc.y)
    this.state?.talked(npc.def.id)
    await this.runDialogue(tree, npc.def.id)
    npc.talkEnd()
  }

  private async runDialogue(tree: Tree, npcId?: string) {
    if (!this.state) return
    const runner = new DialogueRunner(tree, this.state.ctx())
    if (npcId) {
      const info = npcInfo(npcId)
      for (const n of Object.values(tree.nodes)) for (const l of n.lines) if (!l.face && l.who === info.name) l.face = info.face
    }
    this.setLocked(true)
    if (hooks.openDialogue) await hooks.openDialogue(runner)
    else
      while (!runner.ended) {
        console.log(`[${runner.line.who}] ${runner.line.text}`)
        if (runner.advance() === 'choice') runner.choose(0)
      }
    // A tree whose closing effect opened a card (`effectsAtEnd` — the lighthouse
    // lens ends on `panel: zone:contact`) ends with that card still up and
    // owning the keyboard; releasing the room here would let the hero walk about
    // behind it. The modal layer's own `ui:lock false` lets go when it closes.
    // `WorldScene.runDialogue` holds the same line — the two must not disagree.
    this.setLocked(document.body.classList.contains('modal-open'))
    if (this.pendingCutscene) this.leave()
  }

  private queueCutscene(id: string) {
    this.pendingCutscene = id
    if (id === 'beacon') this.cameras.main.flash(600, 255, 244, 190)
  }

  private leave(reason: ExitReason = 'door') {
    if (this.leaving) return
    this.leaving = true
    this.setLocked(true)
    const plan = planRoomExit(reason, this.returnPos, this.pendingCutscene)
    this.pendingCutscene = null
    // Nothing to hand back: the world is restarting itself, and a wake queued
    // behind a fade would land on the title screen a quarter of a second later.
    if (!plan.wakeWorld) {
      this.scene.stop()
      return
    }
    ;(sfx as unknown as Record<string, (() => void) | undefined>).door?.()
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(plan.fadeMs, () => {
      this.scene.wake('world', plan.data)
      this.scene.stop()
    })
  }

  update(_t: number, dms: number) {
    if (this.leaving) return
    const dt = Math.min(dms, 50) / 1000
    let dx = 0
    let dy = 0
    let paceMod = false
    if (!this.locked) {
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
    }
    this.player.move(dx, dy, paceMod, dt, () => false, this.solids, NO_TERRAIN)
    if (!this.locked) this.interact.update(this.player.x, this.player.y)
    for (const n of this.npcs) n.update(dms, () => false, this.solids)
    if (this.player.y > this.room.exit.y - 4 && Math.abs(this.player.x - this.room.exit.x) < 14) this.leave()
  }
}
