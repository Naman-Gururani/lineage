// The quest and achievement tables as data: every quest is winnable, every
// giver is a stallholder who exists, and the story quest's steps line up with
// the story spine rather than with a list someone typed out twice.
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
  it('holds the seven designed quests and none of the retired ones', () => {
    expect(QUESTS.map((q) => q.id).sort()).toEqual(['balloons', 'crew', 'ducks', 'explore', 'lights', 'story', 'tickets'])
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length)
    // The island's errands went with the island.
    for (const gone of ['packets', 'shells', 'fishing', 'beacon']) expect(byId(gone), gone).toBeUndefined()
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

  it('names only stallholders who exist as givers', () => {
    for (const q of QUESTS) if (q.giver) expect(NPC_INFO[q.giver], q.id).toBeTruthy()
    expect(byId('balloons').giver).toBe('pip')
    expect(byId('ducks').giver).toBe('tomas')
    expect(byId('lights').giver).toBe('ilse')
    expect(byId('crew').giver).toBe('mira')
  })

  it('asks the explorer for all eight attractions', () => {
    const explore = byId('explore')
    expect(explore.steps[0].target).toBe(8)
    expect(explore.steps[0].target).toBe(ZONES.length)
    expect(explore.desc.toLowerCase()).toContain('eight')
    expect(explore.auto).toBe(true)
  })

  it('leaves the ticket hunt asking for the twenty that lie about the fair', () => {
    const tickets = byId('tickets')
    expect(tickets.steps[0].target).toBe(20)
    expect(BLUEPRINT.packetSpots.length).toBe(20)
    expect(tickets.auto).toBe(true)
    expect(tickets.reward.xp).toBe(150)
    expect(tickets.reward.flag).toBe('vip')
    expect(tickets.reward.text).toBe('A VIP stub — worth something one day.')
  })

  it('walks the story quest through the spine, three prizes counting as one chapter', () => {
    const story = byId('story')
    expect(story.steps.map((s) => s.id)).toEqual([...STORY_ORDER])
    expect(story.steps.map((s) => s.target)).toEqual([1, 1, 3, 1, 1])
    expect(story.reward).toEqual({ xp: 200, flag: 'story_done', text: 'You’ve seen the whole fair.' })
  })

  it('runs Pip’s balloons and Tomas’s ducks as find-then-hand-over errands', () => {
    const balloons = byId('balloons')
    expect(balloons.steps.map((s) => [s.id, s.target])).toEqual([
      ['find', 5],
      ['return', 1],
    ])
    expect(balloons.reward.hat).toBe('seashell')
    expect(BLUEPRINT.shellSpots.length).toBe(5)

    const ducks = byId('ducks')
    expect(ducks.steps.map((s) => [s.id, s.target])).toEqual([
      ['hook', 3],
      ['return', 1],
    ])
    expect(ducks.reward.text).toBe('The fair’s cat follows you now.')
  })

  it('makes Ilse’s lights a single switch', () => {
    const lights = byId('lights')
    expect(lights.steps.map((s) => s.id)).toEqual(['switch'])
    expect(lights.reward.xp).toBe(100)
    expect(lights.reward.text).toBe('The fair lights are on.')
    expect(lights.auto).toBeUndefined()
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
    log.start('lights')
    log.advance('lights', byId('lights').steps[0].id, 1)
    expect(log.isDone('lights')).toBe(true)
    expect(log.progress('lights')).toEqual({ done: 1, total: 1 })
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

  it('adds one badge per game, one for the set, one for the story, and the duck nobody expects', () => {
    const title = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.title
    expect(title('ach_wordle')).toBe('Five Letters')
    expect(title('ach_claw')).toBe('Prize Winner')
    expect(title('ach_flappy')).toBe('Frequent Flyer')
    expect(title('ach_forge')).toBe('Full Stack')
    expect(title('ach_crew')).toBe('Last Bean Standing')
    expect(title('story')).toBe('The Whole Fair')
    expect(title('arcade')).toBe('Arcade Legend')
    expect(title('goldfish')).toBe('Golden Duck')
  })

  it('re-themes the island badges for the fair', () => {
    const badge = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!
    expect(badge('first_steps').title).toBe('Through the Gate')
    expect(badge('collector').title).toBe('Ticket Stub')
    expect(badge('archivist').title).toBe('Full Book')
    expect(badge('ride').title).toBe('Front Seat')
    expect(badge('ride').desc).toBe('Ride the Career Coaster.')
    expect(badge('fisher').title).toBe('Hook, Line')
    expect(badge('fisher').desc).toBe('Hook a duck.')
    expect(badge('keeper').title).toBe('Lights On')
    expect(badge('keeper').desc).toBe('Switch on the fair lights.')
    expect(badge('goldfish').secret).toBe(true)
  })

  it('has forgotten the cabinets and the summit that are gone', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id))
    for (const id of ['ach_studyhall', 'ach_cargo', 'ach_packetrush', 'ach_climb', 'summit']) expect(ids.has(id), id).toBe(false)
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
