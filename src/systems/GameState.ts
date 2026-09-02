// Owns the save file and the progression systems; also the dialogue context.
import { events } from '../core/events'
import { defaultSave, writeSave, type Save } from '../core/save'
import { ACHIEVEMENTS } from '../data/achievements'
import { ZONES } from '../data/content'
import { QUESTS } from '../data/quests'
import { FACET_STEP, nextStep, type StoryStep } from '../data/story'
import { Achievements } from './Achievements'
import type { Cond, Ctx, Effect } from './Dialogue'
import { QuestLog } from './Quests'
import { Xp } from './Xp'

export type EffectHandlers = {
  sleep?: (to: 'morning' | 'night') => void
  teleport?: (id: string) => void
  cutscene?: (id: string) => void
  minigame?: (id: string) => void
  panel?: (id: string) => void
  companion?: (on: boolean) => void
  sfx?: (id: string) => void
  hat?: (id: string) => void
  isNight?: () => boolean
  /**
   * Fireworks, and the banner that says what they are for. The island has two
   * endings and they are not the same one: `story` is Bo's tour finished (there
   * is still an island to roam), `complete` is every discovery, quest and badge.
   */
  celebrate?: (reason: 'story' | 'complete') => void
}

const ITEM_NAMES: Record<string, string> = { shell: 'Seashell', fish: 'Sunfish', coin: 'Coin' }

/**
 * What each game pins on your head the first time you finish it. Bo's word
 * puzzle is the one with nothing to give: it hands over a whole chapter instead.
 */
export const MINIGAME_HATS: Record<string, string> = { claw: 'goggles', flappy: 'grad', forge: 'hardhat', crew: 'captain' }

/**
 * The five games, for the "all of them" badge. Kept here rather than imported
 * from `systems/Minigame` on purpose: that module is the DOM-side host, and the
 * save layer must not drag the whole panel stack in behind it. `minigame.test.ts`
 * pins the two lists together.
 */
export const ARCADE_GAMES = ['wordle', 'claw', 'flappy', 'forge', 'crew'] as const

/**
 * The résumé chapters a win hands over. This is the whole gating rule: the games
 * know nothing about the story, and the story knows nothing about how a game is
 * played. Crew Drop is missing on purpose — the arcade gates no chapter.
 */
export const MINIGAME_FACETS: Record<string, string[]> = {
  wordle: ['experience'],
  claw: ['lineage', 'safestride', 'stealth'],
  flappy: ['education'],
  forge: ['skills'],
}

/** Chapters nothing has to be won for. Reaching Naman is never a prize. */
export const FREE_FACETS = ['contact']

/** What a first clear is worth. Harder games pay more; none of them pay twice. */
export const MINIGAME_XP: Record<string, number> = { wordle: 90, claw: 110, flappy: 100, forge: 110, crew: 100 }

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
   * errand *and* Mira's dare came back owning one hat instead of two. Take
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
      // The story is announced a chapter at a time by `unlockFacet`, and it is
      // the only quest whose steps are not all the same shape: `progress()`
      // headlines the largest step (the three prizes), so a step toast here
      // would put a fraction of the prizes against every chapter you open.
      if (e.id === 'story') return
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
      // The story is the island's ending, so it gets the island's ending: the
      // badge that says you heard all of it, and the fireworks over the harbor.
      if (q.id === 'story') {
        this.ach.unlock('story')
        this.handlers.celebrate?.('story')
      }
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
      this.handlers.celebrate?.('complete')
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
    if (id === 'crew') this.offerCrewDare()
  }

  private recordPlay(id: string, score: number): void {
    const rec = this.save.minigames[id] ?? { won: false, best: 0, plays: 0 }
    rec.plays += 1
    rec.best = Math.max(rec.best, score)
    this.save.minigames[id] = rec
    this.dirty = true
  }

  /**
   * Mira's dare is the one errand a game owns, so her cabinet hands it out the
   * first time you sit down at it. Everything else a game is worth is a chapter,
   * and chapters are not errands.
   */
  private offerCrewDare(): void {
    if (!this.quests.isStarted('crew')) this.quests.start('crew')
  }

  /**
   * A finished game: records the clear, then pays out once — the badge, the XP,
   * the cap into the wardrobe — and hands over the chapters it was guarding.
   *
   * The chapters are handed over on *every* clear, not just the first: handing
   * one over twice is a no-op, and a save written before a chapter hung off this
   * game has a `won` game with no chapter to show for it.
   */
  minigameWon(id: string, score = 0): void {
    const first = !this.save.minigames[id]?.won
    this.recordPlay(id, score)
    this.save.minigames[id].won = true
    this.dirty = true
    // One badge per game, one for the set. `unlock` shrugs at an id it does not
    // know, so a game with no badge — or none yet — costs nothing here.
    this.ach.unlock(`ach_${id}`)
    if (ARCADE_GAMES.every((g) => this.save.minigames[g]?.won)) this.ach.unlock('arcade')
    // Mira's dare closes before the payout below, so the order you read is the
    // order it happened: the errand's own line first, then the badge and the XP.
    if (id === 'crew') {
      this.offerCrewDare()
      this.quests.advance('crew', 'win', 1)
    }
    if (first) {
      this.handlers.sfx?.('achievement')
      const xp = MINIGAME_XP[id]
      if (xp) this.addXp(xp)
      const hat = MINIGAME_HATS[id]
      // A hat already in the wardrobe (won elsewhere, or granted by a quest) is
      // not news: no second "unlocked".
      if (hat && this.unlockHat(hat)) this.announceHat(hat)
    } else {
      events.emit('ui:toast', { kind: 'info', icon: '🎮', title: 'Cleared it again.' })
      this.handlers.sfx?.('pickup')
    }
    for (const zone of MINIGAME_FACETS[id] ?? []) this.unlockFacet(zone)
  }

  /* ---------- résumé chapters ---------- */

  /** A free chapter is readable from the first minute; every other one is won. */
  isUnlocked(zoneId: string): boolean {
    return FREE_FACETS.includes(zoneId) || this.save.unlocked.includes(zoneId)
  }

  /**
   * Hand a résumé chapter over: write it down, credit the story step it belongs
   * to, and say so. Returns true only the first time.
   *
   * A free chapter is recorded here like any other — `FREE_FACETS` decides what
   * you may *read*, never what the story has heard. Contact is readable on
   * arrival and still has to be opened before the story is told.
   *
   * `announce` is for whoever is listening, not for the credit: a game that
   * shows the card itself (the claw, one prize at a time) passes false so the
   * panel layer does not open a second one over the top of it.
   */
  unlockFacet(zoneId: string, announce = true): boolean {
    const first = !this.save.unlocked.includes(zoneId)
    if (first) {
      this.save.unlocked.push(zoneId)
      const step = FACET_STEP[zoneId]
      if (step) this.quests.advance('story', step, 1)
      const zone = ZONES.find((z) => z.id === zoneId)
      if (zone) events.emit('ui:toast', { kind: 'info', icon: '📖', title: `New chapter: ${zone.label}` })
    }
    // Reading what Naman did at the tower is what puts the lift on the map.
    if (zoneId === 'experience') this.setFlag('tower_express')
    this.dirty = true
    events.emit('facet:unlocked', { id: zoneId, first, announce })
    events.emit('story:changed', { next: this.storyNext() })
    return first
  }

  /** The step the guide is waiting on, or null once the story has been told. */
  storyNext(): StoryStep | null {
    const def = this.quests.def('story')
    return nextStep((s) => {
      const step = def?.steps.find((x) => x.id === s)
      return !!step && this.quests.stepProgress('story', s) >= step.target
    })
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
      const all = ['dockmaster', 'tomas', 'pip', 'ada', 'ravi', 'sol', 'arjun', 'ilse', 'naman', 'professor', 'mira']
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
    if (c.unlocked && !this.isUnlocked(c.unlocked)) return false
    if (c.locked && this.isUnlocked(c.locked)) return false
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
      if (e.minigame) this.handlers.minigame?.(e.minigame)
      if (e.unlockFacet) this.unlockFacet(e.unlockFacet)
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
