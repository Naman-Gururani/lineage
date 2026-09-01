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

/**
 * What each mini-game pins on your head the first time you finish it. `climb`
 * and Ravi's spare-gear errand both pay the hard hat; `unlockHat` returns false
 * the second time, so whichever lands first is the one that gets announced.
 */
export const MINIGAME_HATS: Record<string, string> = { studyhall: 'grad', cargo: 'captain', packetrush: 'goggles', climb: 'hardhat' }
/** Coins paid out for a first clear (Cargo Cove is honest dock work). */
export const MINIGAME_COINS: Record<string, number> = { cargo: 40 }

/**
 * The four cabinets, for the "all of them" badge. Kept here rather than imported
 * from `systems/Minigame` on purpose: that module is the DOM-side host, and the
 * save layer must not drag the whole panel stack in behind it. `minigame.test.ts`
 * pins the two lists together.
 */
export const ARCADE_GAMES = ['studyhall', 'cargo', 'packetrush', 'climb'] as const

/**
 * Packet Rush pays out in real packets. Five synthetic ids, collected down the
 * same pathway a packet in the grass takes, so the count, the quest, the seal on
 * the Ridge and the badges all agree without any of them learning a new rule.
 * The island still hides twenty and the Vault still wants twenty: these five are
 * a second route to some of them, not five more to find.
 */
export const RUSH_PACKET_IDS = ['pr_1', 'pr_2', 'pr_3', 'pr_4', 'pr_5'] as const

/** Landmarks that must be found before the island calls it a day. */
export const DISCOVERIES_FOR_100 = 8

export const HAT_NAMES: Record<string, string> = {
  grad: 'Graduation cap',
  captain: "Captain's cap",
  hardhat: 'Hard hat',
  goggles: 'Goggles',
  seashell: 'Seashell crown',
  catears: 'Cat ears',
  crown: 'Crown',
}

export function hatName(id: string): string {
  return HAT_NAMES[id] ?? id
}

/**
 * The wardrobe as the pause menu sees it: a live read of the save, so a hat won
 * while the panel was shut is simply there the next time it opens.
 */
export type WardrobeView = {
  readonly hats: string[]
  readonly equipped: string
  equip(id: string): boolean
}

export class GameState {
  save: Save
  quests: QuestLog
  xp: Xp
  ach: Achievements
  dirty = false
  handlers: EffectHandlers = {}
  /**
   * While set, per-step quest toasts are held back. A batch of credits — the
   * five packets a Packet Rush run is worth — says its piece once at the end
   * instead of pushing four other toasts off the stack.
   */
  private batching = false

  constructor(save: Save | null) {
    this.save = save ?? defaultSave()
    this.recoverHats()
    this.quests = new QuestLog(this.save.quests, (e) => this.onQuest(e))
    this.xp = new Xp(this.save.xp, (level) => this.onLevel(level))
    this.ach = new Achievements(this.save.achievements, (id) => this.onAchievement(id))
    for (const q of QUESTS) if (q.auto && !this.quests.isStarted(q.id)) this.quests.start(q.id)
  }

  /**
   * Rebuild the wardrobe for a save written before there was one.
   *
   * Those saves kept only the hat being worn, so a player who finished the shell
   * errand *and* the gear errand came back owning one hat instead of two. Take
   * back everything the save can still prove: the hat on your head, the reward
   * of every finished quest, and the cap for every mini-game already beaten.
   * Ownership only — nothing is put on, and nothing is announced: this runs at
   * load, where no toast may fire.
   */
  private recoverHats(): void {
    const own = (id?: string) => {
      if (id && !this.save.hats.includes(id)) this.save.hats.push(id)
    }
    own(this.save.hat)
    for (const q of QUESTS) if (this.save.quests[q.id]?.done) own(q.reward.hat)
    for (const [game, hat] of Object.entries(MINIGAME_HATS)) if (this.save.minigames[game]?.won) own(hat)
  }

  /* ---------- progression events ---------- */

  private onQuest(e: { type: 'started' | 'progress' | 'done'; id: string }) {
    const q = this.quests.def(e.id)!
    this.dirty = true
    if (e.type === 'started') events.emit('ui:toast', { kind: 'quest', icon: '📜', title: 'New quest', sub: q.title })
    else if (e.type === 'progress') {
      if (this.batching) return
      const p = this.quests.progress(e.id)
      events.emit('ui:toast', { kind: 'quest', icon: '📜', title: q.title, sub: `${p.done} / ${p.total}` })
    } else {
      events.emit('ui:toast', { kind: 'quest', icon: '✅', title: `Quest complete: ${q.title}`, sub: q.reward.text })
      this.addXp(q.reward.xp)
      // Into the wardrobe, not straight onto your head: a reward hat never
      // knocks off the one you chose to wear. A hat that goes to the rack rather
      // than to your head says where it went, in the same words the mini-games
      // use — the quest line alone would read as a hat you never see.
      if (q.reward.hat && this.unlockHat(q.reward.hat) && this.save.hat !== q.reward.hat) this.announceHat(q.reward.hat)
      if (q.reward.flag) this.setFlag(q.reward.flag)
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
    const allDisc = this.save.discoveries.length >= DISCOVERIES_FOR_100
    const allQuests = QUESTS.every((q) => this.quests.isDone(q.id))
    const allAch = ACHIEVEMENTS.filter((a) => a.id !== 'complete').every((a) => this.ach.has(a.id))
    if (allDisc && allQuests && allAch) {
      this.ach.unlock('complete')
      // The one hat that overrules whatever you were wearing.
      this.unlockHat('crown', true)
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

  /* ---------- wardrobe ---------- */

  /**
   * Add a hat to the wardrobe. An empty head puts it straight on — the first
   * hat you earn should be visible without going looking for a menu — and
   * `wear` insists on it for the grants that are the whole point (the crown, a
   * hat handed to you in a conversation). Returns true only the first time.
   *
   * Every hat the game gives out comes through here, so `hats` (owned) and
   * `hat` (worn) can never drift apart.
   */
  unlockHat(id: string, wear = false): boolean {
    const isNew = !this.save.hats.includes(id)
    if (isNew) this.save.hats.push(id)
    if (wear || !this.save.hat) this.equipHat(id)
    this.dirty = true
    return isNew
  }

  /**
   * Wear a hat out of the wardrobe, or `''` for bare-headed. Refuses anything
   * you do not own, so the pause menu cannot conjure one.
   */
  equipHat(id: string): boolean {
    if (id && !this.hasHat(id)) return false
    this.save.hat = id
    this.dirty = true
    this.handlers.hat?.(id)
    return true
  }

  hasHat(id: string): boolean {
    return this.save.hats.includes(id)
  }

  /** The one line a newly won hat gets, wherever it came from. */
  private announceHat(id: string): void {
    events.emit('ui:toast', {
      kind: 'item',
      icon: '🎩',
      title: `${hatName(id)} unlocked`,
      sub: this.save.hat === id ? 'You are wearing it' : 'Added to your hats',
    })
  }

  /** A live handle on the wardrobe for the DOM side (see `WardrobeView`). */
  wardrobeView(): WardrobeView {
    const st = this
    return {
      get hats() {
        return st.save.hats
      },
      get equipped() {
        return st.save.hat
      },
      equip: (id: string) => st.equipHat(id),
    }
  }

  /* ---------- mini-games ---------- */

  /** Record an attempt: one more play, and the best score so far (higher is better). */
  minigamePlayed(id: string, score = 0): void {
    this.recordPlay(id, score)
    this.creditMinigameQuest(id, score)
  }

  private recordPlay(id: string, score: number): void {
    const rec = this.save.minigames[id] ?? { won: false, best: 0, plays: 0 }
    rec.plays += 1
    rec.best = Math.max(rec.best, score)
    this.save.minigames[id] = rec
    this.dirty = true
  }

  /**
   * Move the errand attached to a cabinet to the score the round reached.
   *
   * Each mini-game quest shares the game's id, so the whole hook-up is a lookup
   * — no table to keep in step with the games. Only `steps[0]` is credited,
   * which is every one of them today: all four are single-step. A mini-game
   * quest that grows a second step needs a rule for it here first.
   *
   * **The contract a renderer signs.** The score it reports *is* the progress —
   * boards cleared, pallets stacked, points — and it is a high-water mark, so
   * quitting halfway still counts and a worse second run never takes it back.
   *
   * **Except when the step is a yes/no.** A step with `target: 1` asks a
   * question ("did you reach the roof?") that only a win may answer: a quit
   * score measures how far you got — floors climbed, metres — and `min(1, …)`
   * would read one floor as the whole tower and pay the reward for it. So a
   * one-target step moves on `minigameWon` alone. Sitting down at the cabinet
   * still hands the errand out either way; the step toast is left to the game,
   * which just showed you the number on its own scoreboard.
   */
  private creditMinigameQuest(id: string, score: number, won = false): void {
    const def = this.quests.def(id)
    if (!def) return
    if (!this.quests.isStarted(id)) this.quests.start(id)
    const step = def.steps[0]
    if (step.target === 1 && !won) return
    // A win answers a yes/no step outright, whatever number the game reports.
    const reached = step.target === 1 && won ? step.target : Math.min(step.target, Math.floor(score))
    const gained = reached - this.quests.stepProgress(id, step.id)
    if (gained <= 0) return
    this.batching = true
    try {
      this.quests.advance(id, step.id, gained)
    } finally {
      this.batching = false
    }
  }

  /**
   * Packet Rush hands back real packets: five synthetic ids down the ordinary
   * collect pathway, so the quest, the seal on the Ridge and the badges all move
   * without learning a special case. Already-held ids are skipped, so a second
   * clear pays nothing, and the batch speaks once rather than five times.
   */
  private creditRushPackets(): void {
    const before = this.save.packets.length
    this.batching = true
    try {
      for (const id of RUSH_PACKET_IDS) this.collectPacket(id)
    } finally {
      this.batching = false
    }
    const got = this.save.packets.length - before
    if (!got) return
    const p = this.quests.progress('packets')
    events.emit('ui:toast', { kind: 'item', icon: '◈', title: `${got} packets recovered`, sub: `${p.done} / ${p.total} to the Engine` })
  }

  /**
   * A finished mini-game: records the play, then pays out once — the hat into
   * the wardrobe, coins where the game earns them, and a line about it.
   *
   * The game's own payout comes first and the errand it also finishes last, so
   * the cap is announced as the cap and the quest gets the closing word. A
   * repeat clear still credits the quest: a save from before these errands
   * existed has a `won` game and an untouched quest.
   */
  minigameWon(id: string, score = 0): void {
    const first = !this.save.minigames[id]?.won
    this.recordPlay(id, score)
    this.save.minigames[id].won = true
    this.dirty = true
    // One badge per cabinet, one for the set. `unlock` shrugs at an id it does
    // not know, so a game with no badge — or none yet — costs nothing here.
    this.ach.unlock(`ach_${id}`)
    if (ARCADE_GAMES.every((g) => this.save.minigames[g]?.won)) this.ach.unlock('arcade')
    if (id === 'packetrush') this.creditRushPackets()
    if (!first) {
      events.emit('ui:toast', { kind: 'info', icon: '🎮', title: 'Cleared it again.' })
      this.handlers.sfx?.('pickup')
      this.creditMinigameQuest(id, score, true)
      return
    }
    this.handlers.sfx?.('achievement')
    const hat = MINIGAME_HATS[id]
    // A hat already in the wardrobe (won elsewhere, or granted by a quest) is
    // not news: no second "unlocked".
    if (hat && this.unlockHat(hat)) this.announceHat(hat)
    const coins = MINIGAME_COINS[id]
    if (coins) {
      this.give('coin', coins)
      events.emit('ui:toast', { kind: 'item', icon: '🪙', title: `+${coins} coins`, sub: 'Dock work pays' })
    }
    this.creditMinigameQuest(id, score, true)
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
      // Every villager the badge claims — the campus and warehouse hosts
      // included, or "Talk to every villager" would be a lie you could earn
      // without meeting them. Both greet on room entry (InteriorScene.greet
      // calls talked()), so the badge stays reachable without a detour.
      const all = ['mira', 'tomas', 'pip', 'lou', 'ada', 'ravi', 'sol', 'devi', 'arjun', 'ilse', 'naman', 'professor', 'dockmaster']
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
      // A hat handed over in a conversation goes on: it is the beat of the scene.
      if (e.hat) this.unlockHat(e.hat, true)
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
