// Owns the save file and the progression systems; also the dialogue context.
import { events } from '../core/events'
import { defaultSave, writeSave, type Save } from '../core/save'
import { ACHIEVEMENTS } from '../data/achievements'
import { QUESTS } from '../data/quests'
import { Achievements } from './Achievements'
import type { Cond, Ctx, Effect } from './Dialogue'
import { QuestLog } from './Quests'
import { Xp } from './Xp'

export type EffectHandlers = {
  sleep?: (to: 'morning' | 'night') => void
  teleport?: (id: string) => void
  cutscene?: (id: string) => void
  panel?: (id: string) => void
  companion?: (on: boolean) => void
  sfx?: (id: string) => void
  hat?: (id: string) => void
  isNight?: () => boolean
  celebrate?: () => void
}

const ITEM_NAMES: Record<string, string> = { shell: 'Seashell', fish: 'Sunfish', gear: 'Spare gear', coin: 'Coin' }

export class GameState {
  save: Save
  quests: QuestLog
  xp: Xp
  ach: Achievements
  dirty = false
  handlers: EffectHandlers = {}

  constructor(save: Save | null) {
    this.save = save ?? defaultSave()
    this.quests = new QuestLog(this.save.quests, (e) => this.onQuest(e))
    this.xp = new Xp(this.save.xp, (level) => this.onLevel(level))
    this.ach = new Achievements(this.save.achievements, (id) => this.onAchievement(id))
    for (const q of QUESTS) if (q.auto && !this.quests.isStarted(q.id)) this.quests.start(q.id)
  }

  /* ---------- progression events ---------- */

  private onQuest(e: { type: 'started' | 'progress' | 'done'; id: string }) {
    const q = this.quests.def(e.id)!
    this.dirty = true
    if (e.type === 'started') events.emit('ui:toast', { kind: 'quest', icon: '📜', title: 'New quest', sub: q.title })
    else if (e.type === 'progress') {
      const p = this.quests.progress(e.id)
      events.emit('ui:toast', { kind: 'quest', icon: '📜', title: q.title, sub: `${p.done} / ${p.total}` })
    } else {
      events.emit('ui:toast', { kind: 'quest', icon: '✅', title: `Quest complete: ${q.title}`, sub: q.reward.text })
      this.addXp(q.reward.xp)
      if (q.reward.hat) {
        this.save.hat = q.reward.hat
        this.handlers.hat?.(q.reward.hat)
      }
      if (q.reward.item) this.give(q.reward.item[0], q.reward.item[1])
      this.checkComplete()
    }
  }

  private onLevel(level: number) {
    events.emit('ui:toast', { kind: 'xp', icon: '⬆️', title: `Level ${level}!`, sub: 'Explorer rank up' })
    this.handlers.sfx?.('levelup')
  }

  private onAchievement(id: string) {
    const a = ACHIEVEMENTS.find((x) => x.id === id)!
    this.save.achievements = this.ach.list()
    this.dirty = true
    events.emit('ui:toast', { kind: 'ach', icon: a.icon, title: `Achievement: ${a.title}`, sub: a.desc })
    this.handlers.sfx?.('achievement')
    this.addXp(25)
    this.checkComplete()
  }

  addXp(n: number): void {
    this.xp.add(n)
    this.save.xp = this.xp.xp
    this.dirty = true
    if (n >= 10) events.emit('ui:toast', { kind: 'xp', icon: '✦', title: `+${n} XP` })
  }

  checkComplete(): void {
    if (this.ach.has('complete')) return
    const allDisc = this.save.discoveries.length >= 7
    const allQuests = QUESTS.every((q) => this.quests.isDone(q.id))
    const allAch = ACHIEVEMENTS.filter((a) => a.id !== 'complete').every((a) => this.ach.has(a.id))
    if (allDisc && allQuests && allAch) {
      this.ach.unlock('complete')
      this.save.hat = 'crown'
      this.handlers.hat?.('crown')
      this.handlers.celebrate?.()
    }
  }

  /* ---------- inventory / flags ---------- */

  give(item: string, n = 1): void {
    this.save.inventory[item] = (this.save.inventory[item] ?? 0) + n
    this.dirty = true
    if (item === 'coin') return
    events.emit('ui:toast', { kind: 'item', icon: '🎒', title: `Got ${n > 1 ? n + '× ' : ''}${ITEM_NAMES[item] ?? item}` })
  }

  take(item: string, n = 1): boolean {
    if ((this.save.inventory[item] ?? 0) < n) return false
    this.save.inventory[item] -= n
    this.dirty = true
    return true
  }

  has(item: string, n = 1): boolean {
    return (this.save.inventory[item] ?? 0) >= n
  }

  count(item: string): number {
    return this.save.inventory[item] ?? 0
  }

  get coins(): number {
    return this.count('coin')
  }

  flag(k: string): boolean {
    return !!this.save.flags[k]
  }

  setFlag(k: string, v = 1): void {
    this.save.flags[k] = v
    this.dirty = true
  }

  /* ---------- collectibles & discoveries ---------- */

  hasPacket(id: string): boolean {
    return this.save.packets.includes(id)
  }

  collectPacket(id: string): boolean {
    if (this.hasPacket(id)) return false
    this.save.packets.push(id)
    this.dirty = true
    this.quests.advance('packets', 'collect', 1)
    this.addXp(8)
    if (this.save.packets.length >= 10) this.ach.unlock('collector')
    if (this.save.packets.length >= 20) this.ach.unlock('archivist')
    return true
  }

  openChest(id: string): boolean {
    if (this.save.chests.includes(id)) return false
    this.save.chests.push(id)
    this.dirty = true
    return true
  }

  discover(zoneId: string): boolean {
    if (this.save.discoveries.includes(zoneId)) return false
    this.save.discoveries.push(zoneId)
    this.dirty = true
    this.quests.advance('explore', 'discover', 1)
    this.addXp(40)
    events.emit('world:discovered', { id: zoneId, first: true })
    return true
  }

  talked(npc: string): void {
    if (!this.save.talked.includes(npc)) {
      this.save.talked.push(npc)
      this.dirty = true
      const all = ['mira', 'tomas', 'pip', 'lou', 'ada', 'ravi', 'sol', 'devi', 'arjun', 'ilse', 'naman']
      if (all.every((n) => this.save.talked.includes(n))) this.ach.unlock('full_house')
    }
  }

  /* ---------- dialogue context ---------- */

  ctx(): Ctx {
    return {
      check: (c?: Cond) => this.check(c),
      apply: (e: Effect[]) => this.apply(e),
    }
  }

  check(c?: Cond): boolean {
    if (!c) return true
    if (c.flag && !this.flag(c.flag)) return false
    if (c.notFlag && this.flag(c.notFlag)) return false
    if (c.questDone && !this.quests.isDone(c.questDone)) return false
    if (c.questActive && !this.quests.isActive(c.questActive)) return false
    if (c.questNotStarted && this.quests.isStarted(c.questNotStarted)) return false
    if (c.item && !this.has(c.item[0], c.item[1])) return false
    if (c.packets !== undefined && this.save.packets.length < c.packets) return false
    if (c.discovered && !this.save.discoveries.includes(c.discovered)) return false
    if (c.night !== undefined && !!this.handlers.isNight?.() !== c.night) return false
    return true
  }

  apply(effects: Effect[]): void {
    for (const e of effects) {
      if (e.setFlag) this.setFlag(e.setFlag)
      if (e.clearFlag) this.setFlag(e.clearFlag, 0)
      if (e.startQuest) this.quests.start(e.startQuest)
      if (e.advanceQuest) this.quests.advance(e.advanceQuest[0], e.advanceQuest[1], e.advanceQuest[2])
      if (e.completeQuest) {
        const q = this.quests.def(e.completeQuest)
        if (q) for (const s of q.steps) this.quests.advance(q.id, s.id, s.target)
      }
      if (e.give) this.give(e.give[0], e.give[1])
      if (e.take) this.take(e.take[0], e.take[1])
      if (e.xp) this.addXp(e.xp)
      if (e.hat) {
        this.save.hat = e.hat
        this.handlers.hat?.(e.hat)
      }
      if (e.achievement) this.ach.unlock(e.achievement)
      if (e.panel) this.handlers.panel?.(e.panel)
      if (e.companion !== undefined) {
        this.setFlag('companion', e.companion ? 1 : 0)
        this.handlers.companion?.(e.companion)
        if (e.companion) this.ach.unlock('cat_person')
      }
      if (e.sleep) this.handlers.sleep?.(e.sleep)
      if (e.teleport) this.handlers.teleport?.(e.teleport)
      if (e.cutscene) this.handlers.cutscene?.(e.cutscene)
      if (e.sfx) this.handlers.sfx?.(e.sfx)
      if (e.toast) events.emit('ui:toast', { kind: 'info', ...e.toast })
    }
    this.dirty = true
  }

  /* ---------- persistence ---------- */

  persist(pos: { x: number; y: number }, scene: string, time: number, weather: Save['weather']): void {
    this.save.x = pos.x
    this.save.y = pos.y
    this.save.scene = scene
    this.save.time = time
    this.save.weather = weather
    this.save.xp = this.xp.xp
    this.save.achievements = this.ach.list()
    writeSave(this.save)
    this.dirty = false
    events.emit('save:changed', {})
  }
}
