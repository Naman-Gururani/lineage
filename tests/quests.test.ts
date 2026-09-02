// The quest and achievement tables as data: every quest is winnable, every
// giver is a villager who exists, and the story quest's steps line up with the
// story spine rather than with a list someone typed out twice.
import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { ZONES } from '../src/data/content'
import { NPC_INFO } from '../src/data/npcs'
import { QUESTS } from '../src/data/quests'
import { STORY_ORDER } from '../src/data/story'
import { QuestLog } from '../src/systems/Quests'
import { BLUEPRINT } from '../src/world/blueprint'

const byId = (id: string) => QUESTS.find((q) => q.id === id)!

describe('quest table', () => {
  it('holds the designed quests and none of the retired ones', () => {
    expect(QUESTS.map((q) => q.id).sort()).toEqual(['beacon', 'crew', 'explore', 'fishing', 'packets', 'shells', 'story'])
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length)
  })

  it('puts the story at the top of the journal, already running', () => {
    expect(QUESTS[0].id).toBe('story')
    expect(QUESTS[0].auto).toBe(true)
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

  it('walks the story quest through the spine, three prizes counting as one chapter', () => {
    const story = byId('story')
    expect(story.steps.map((s) => s.id)).toEqual([...STORY_ORDER])
    expect(story.steps.map((s) => s.target)).toEqual([1, 1, 3, 1, 1, 1])
    expect(story.reward).toEqual({ xp: 200, flag: 'story_done', text: 'You’ve heard the whole story.' })
  })

  it('makes Mira’s dare a single round, paid in the cap', () => {
    const crew = byId('crew')
    expect(crew.giver).toBe('mira')
    expect(crew.auto).toBeUndefined()
    expect(crew.steps.map((s) => s.id)).toEqual(['win'])
    expect(crew.reward.hat).toBe('captain')
    expect(crew.reward.xp).toBe(100)
  })

  it('completes a quest through its single step', () => {
    const log = new QuestLog({}, () => {})
    log.start('beacon')
    log.advance('beacon', byId('beacon').steps[0].id, 1)
    expect(log.isDone('beacon')).toBe(true)
    expect(log.progress('beacon')).toEqual({ done: 1, total: 1 })
  })
})

describe('achievement table', () => {
  it('holds a badge per line of the game, each with a title, a line and an icon', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    expect(ACHIEVEMENTS.length).toBe(23)
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0)
      expect(a.desc.length).toBeGreaterThan(0)
      expect(a.icon.length).toBeGreaterThan(0)
    }
  })

  it('adds one badge per game, one for the set, one for the story, and the fish nobody expects', () => {
    const title = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.title
    expect(title('ach_wordle')).toBe('Five Letters')
    expect(title('ach_claw')).toBe('Prize Winner')
    expect(title('ach_flappy')).toBe('Frequent Flyer')
    expect(title('ach_forge')).toBe('Full Stack')
    expect(title('ach_crew')).toBe('Last Bean Standing')
    expect(title('story')).toBe('The Whole Story')
    expect(title('arcade')).toBe('Arcade Legend')
    expect(title('goldfish')).toBe('One in a Million')
  })

  it('has forgotten the cabinets that are gone', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id))
    for (const id of ['ach_studyhall', 'ach_cargo', 'ach_packetrush', 'ach_climb']) expect(ids.has(id), id).toBe(false)
  })

  it('counts all five games in the badge for the set', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'arcade')!.desc).toContain('five')
  })

  it('keeps the badge ids clear of the quest ids they shadow, bar the one the story hands out', () => {
    // Every game badge is prefixed, so a badge and an errand can never collide
    // by accident. `story` is the deliberate exception: that badge *is* the
    // quest's ending, and naming it twice would only invent a second word for it.
    const quests = new Set(QUESTS.map((q) => q.id))
    expect(ACHIEVEMENTS.filter((a) => quests.has(a.id)).map((a) => a.id)).toEqual(['story'])
  })
})
