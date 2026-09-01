// Inside a landmark: a small room built from the interior tileset.
import Phaser from 'phaser'
import { ATLAS, hasFrame } from '../art/atlas'
import { sfx } from '../audio/sfx'
import { soundtrack } from '../systems/Soundtrack'
import { TILE, pickZoom } from '../config'
import { events, touchInput } from '../core/events'
import { hooks } from '../core/hooks'
import { keys } from '../core/keys'
import { ROOMS } from '../data/rooms'
import { ZONES } from '../data/content'
import { Npc } from '../entities/Npc'
import { Player } from '../entities/Player'
import { DialogueRunner, type Tree } from '../systems/Dialogue'
import { getTree, linesTree, npcInfo } from '../systems/DialogueRegistry'
import type { GameState } from '../systems/GameState'
import { InteractSystem } from '../systems/Interact'
import type { Solid } from '../world/collision'
import { parseRoom, type ParsedRoom } from '../world/rooms'
import type { WorldScene } from './WorldScene'

const NPC_NAMES: Record<string, string> = { naman: 'Naman', ada: 'Ada', ravi: 'Tinker Ravi' }

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

  constructor() {
    super('interior')
  }

  create(data: { room: string; returnX: number; returnY: number }) {
    const def = ROOMS[data.room]
    this.roomId = data.room
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

    // npcs
    for (const n of this.room.npcs) {
      const npc = new Npc(this, { id: n.id, name: NPC_NAMES[n.id] ?? npcInfo(n.id).name, x: n.x, y: n.y, behaviour: { kind: 'idle' }, facing: n.facing })
      this.npcs.push(npc)
      this.solids.push({ x: n.x - 6, y: n.y - 6, w: 12, h: 8 })
      this.interact.add({ x: n.x, y: n.y, radius: 26, prompt: `Talk to ${npc.def.name}`, priority: 3, onInteract: () => this.talkTo(npc) })
    }

    // player + camera
    this.player = new Player(this, this.room.spawn.x, this.room.spawn.y)
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
    this.scale.on('resize', fit)
    cam.startFollow(this.player, true, 0.12, 0.12)
    cam.setRoundPixels(true)
    cam.fadeIn(300, 0, 0, 0)

    const onKey = (e: KeyboardEvent) => {
      if (!this.scene.isActive() || document.body.classList.contains('modal-open')) return
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') this.onAction()
      else if (e.code === 'Escape') setTimeout(() => !this.locked && events.emit('ui:panel', { id: 'pause' }), 0)
      else if (e.code === 'KeyM') !this.locked && events.emit('ui:panel', { id: 'map' })
      else if (e.code === 'KeyJ') !this.locked && events.emit('ui:panel', { id: 'journal' })
    }
    this.unsub.push(keys.onDown(onKey))
    this.unsub.push(events.on('ui:lock', ({ locked }) => this.setLocked(locked)))
    this.unsub.push(events.on('world:action', ({ action }) => (action === 'interact' ? this.onAction() : action === 'menu' ? events.emit('ui:panel', { id: 'pause' }) : events.emit('ui:panel', { id: action }))))
    this.unsub.push(events.on('world:travel', () => this.leave(true)))
    this.unsub.push(events.on('game:title', () => this.leave()))
    const anyEvents = events as unknown as { on(k: string, fn: (p: { frame: number }) => void): () => void }
    this.unsub.push(anyEvents.on('room:window', ({ frame }) => this.setSkyFrame(frame)))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u()
      this.unsub = []
      if (this.state) this.state.handlers.cutscene = this.prevCutsceneHandler
    })

    // intercept cutscene effects while inside
    this.prevCutsceneHandler = this.state?.handlers.cutscene
    if (this.state) this.state.handlers.cutscene = (id) => this.queueCutscene(id)

    soundtrack.room(def.music)
    events.emit('ui:hud', { visible: true })
    events.emit('ui:banner', { title: def.name })
  }

  private prevCutsceneHandler: ((id: string) => void) | undefined

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

  private setLocked(v: boolean) {
    this.locked = v
    this.player?.freeze(v)
    if (v) this.interact.hide()
  }

  private onAction() {
    if (this.locked || this.leaving) return
    if (!this.interact.trigger()) void this.player.swing()
  }

  private use(target: string, data?: unknown) {
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
    this.setLocked(false)
    if (this.pendingCutscene) this.leave()
  }

  private queueCutscene(id: string) {
    this.pendingCutscene = id
    if (id === 'beacon') this.cameras.main.flash(600, 255, 244, 190)
  }

  private leave(keepWorldPosition = false) {
    if (this.leaving) return
    this.leaving = true
    this.setLocked(true)
    ;(sfx as unknown as Record<string, (() => void) | undefined>).door?.()
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => {
      const data = keepWorldPosition
        ? { cutscene: this.pendingCutscene ?? undefined }
        : { x: this.returnPos.x, y: this.returnPos.y, cutscene: this.pendingCutscene ?? undefined }
      this.pendingCutscene = null
      this.scene.wake('world', data)
      this.scene.stop()
    })
  }

  update(_t: number, dms: number) {
    if (this.leaving) return
    const dt = Math.min(dms, 50) / 1000
    let dx = 0
    let dy = 0
    let run = false
    if (!this.locked) {
      if (keys.any('ArrowLeft', 'KeyA')) dx -= 1
      if (keys.any('ArrowRight', 'KeyD')) dx += 1
      if (keys.any('ArrowUp', 'KeyW')) dy -= 1
      if (keys.any('ArrowDown', 'KeyS')) dy += 1
      run = keys.any('ShiftLeft', 'ShiftRight') || touchInput.run
      if (touchInput.active) {
        dx += touchInput.x
        dy += touchInput.y
      }
    }
    this.player.move(dx, dy, run, dt, () => false, this.solids, { get: () => 10, w: 0, h: 0, cells: new Uint8Array(0), set: () => {}, inb: () => true } as unknown as import('../world/terrain').Grid)
    if (!this.locked) this.interact.update(this.player.x, this.player.y)
    for (const n of this.npcs) n.update(dms, () => false, this.solids)
    if (this.player.y > this.room.exit.y - 4 && Math.abs(this.player.x - this.room.exit.x) < 14) this.leave()
  }
}
