// The quest and achievement tables as data: every quest is winnable, every
// giver is a villager who exists, and the mini-game quests line up with the
// games (five boards, six levels) rather than with a number someone typed twice.
import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { ZONES } from '../src/data/content'
import { NPC_INFO } from '../src/data/npcs'
import { QUESTS } from '../src/data/quests'
import { STUDY_BOARDS } from '../src/games/lightsout'
import { CARGO_LEVELS } from '../src/games/sokoban'
import { QuestLog } from '../src/systems/Quests'
import { BLUEPRINT } from '../src/world/blueprint'

const byId = (id: string) => QUESTS.find((q) => q.id === id)!

describe('quest table', () => {
  it('holds the ten designed quests', () => {
    expect(QUESTS.map((q) => q.id).sort()).toEqual(
      ['beacon', 'cargo', 'climb', 'explore', 'fishing', 'gear', 'packetrush', 'packets', 'shells', 'studyhall'].sort(),
    )
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length)
  })

  it('gives every quest a reward, a step and a target above zero', () => {
    for (const q of QUESTS) {
      expect(q.reward.xp).toBeGreaterThan(0)
      expect(q.reward.text.length).toBeGreaterThan(0)
      expect(q.steps.length).toBeGreaterThan(0)
      expect(new Set(q.steps.map((s) => s.id)).size).toBe(q.steps.length)
      for (const s of q.steps) expect(s.target).toBeGreaterThan(0)
    }
  })

  it('names only villagers who exist as givers', () => {
    for (const q of QUESTS) if (q.giver) expect(NPC_INFO[q.giver]).toBeTruthy()
  })

  it('asks the explorer for all eight landmarks', () => {
    const explore = byId('explore')
    expect(explore.steps[0].target).toBe(8)
    expect(explore.steps[0].target).toBe(ZONES.length)
    expect(explore.steps[0].target).toBe(BLUEPRINT.landmarks.filter((l) => !l.minor).length)
    expect(explore.desc.toLowerCase()).toContain('eight')
  })

  it('leaves the packet errand asking for the twenty that lie about the island', () => {
    expect(byId('packets').steps[0].target).toBe(20)
    expect(BLUEPRINT.packetSpots.length).toBe(20)
  })

  it('sizes the mini-game quests to the games themselves', () => {
    expect(byId('studyhall').giver).toBe('professor')
    expect(byId('studyhall').steps[0].target).toBe(STUDY_BOARDS.length)
    expect(byId('studyhall').reward.hat).toBe('grad')

    expect(byId('cargo').giver).toBe('dockmaster')
    expect(byId('cargo').steps[0].target).toBe(CARGO_LEVELS.length)
    expect(byId('cargo').reward.hat).toBe('captain')

    expect(byId('packetrush').giver).toBe('sol')
    expect(byId('packetrush').steps[0].target).toBe(30)
    expect(byId('packetrush').reward.hat).toBe('goggles')
    expect(byId('packetrush').reward.text).toContain('5 packets')

    expect(byId('climb').giver).toBe('ada')
    expect(byId('climb').steps[0].target).toBe(1)
    expect(byId('climb').reward.hat).toBe('hardhat')
    expect(byId('climb').reward.flag).toBe('tower_express')
    expect(byId('climb').reward.text).toContain('Tower Express')
    // Ravi's errand may have paid the hard hat already: the line promises the
    // route, and the wardrobe announces the cap only when it is genuinely new.
    expect(byId('climb').reward.text.toLowerCase()).not.toContain('hard hat')
  })

  it('starts none of the mini-game quests on its own — the cabinet hands them out', () => {
    for (const id of ['studyhall', 'cargo', 'packetrush', 'climb']) expect(byId(id).auto).toBeFalsy()
  })

  // `GameState.creditMinigameQuest` credits `steps[0]` and nothing else.
  it('keeps every mini-game errand to a single step', () => {
    for (const id of ['studyhall', 'cargo', 'packetrush', 'climb']) expect(byId(id).steps.length).toBe(1)
  })

  it('completes a mini-game quest through its single step', () => {
    const log = new QuestLog({}, () => {})
    log.start('cargo')
    log.advance('cargo', byId('cargo').steps[0].id, 6)
    expect(log.isDone('cargo')).toBe(true)
    expect(log.progress('cargo')).toEqual({ done: 6, total: 6 })
  })
})

describe('achievement table', () => {
  it('holds twenty-one badges, each with a title, a line and an icon', () => {
    expect(ACHIEVEMENTS.length).toBe(21)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0)
      expect(a.desc.length).toBeGreaterThan(0)
      expect(a.icon.length).toBeGreaterThan(0)
    }
  })

  it('adds one badge per cabinet, one for the set, and the fish nobody expects', () => {
    const title = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.title
    expect(title('ach_studyhall')).toBe("Dean's List")
    expect(title('ach_cargo')).toBe('Shipshape')
    expect(title('ach_packetrush')).toBe('Backpressure? Never')
    expect(title('ach_climb')).toBe('Corner Office')
    expect(title('arcade')).toBe('Arcade Legend')
    expect(title('goldfish')).toBe('One in a Million')
  })

  it('keeps the badge ids clear of the quest ids they shadow', () => {
    const quests = new Set(QUESTS.map((q) => q.id))
    for (const a of ACHIEVEMENTS) expect(quests.has(a.id)).toBe(false)
  })
})
