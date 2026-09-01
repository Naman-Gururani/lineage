import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { QUESTS } from '../src/data/quests'
import { Achievements } from '../src/systems/Achievements'
import { QuestLog } from '../src/systems/Quests'
import { LEVELS, Xp } from '../src/systems/Xp'

describe('QuestLog', () => {
  it('starts, advances with clamping, and completes once', () => {
    const fired: string[] = []
    const log = new QuestLog({}, (e) => fired.push(`${e.type}:${e.id}`))
    expect(log.isActive('shells')).toBe(false)
    log.start('shells')
    expect(log.isActive('shells')).toBe(true)
    log.advance('shells', 'find', 3)
    expect(log.progress('shells')).toEqual({ done: 3, total: 5 })
    log.advance('shells', 'find', 10)
    expect(log.progress('shells')).toEqual({ done: 5, total: 5 })
    expect(log.isDone('shells')).toBe(false)
    log.advance('shells', 'return', 1)
    expect(log.isDone('shells')).toBe(true)
    log.advance('shells', 'return', 1)
    expect(fired.filter((f) => f === 'done:shells').length).toBe(1)
    expect(fired[0]).toBe('started:shells')
  })

  it('ignores unknown quests and persists state', () => {
    const log = new QuestLog({}, () => {})
    log.start('nope')
    expect(log.isActive('nope')).toBe(false)
    log.start('packets')
    log.advance('packets', 'collect', 4)
    const again = new QuestLog(log.state, () => {})
    expect(again.progress('packets').done).toBe(4)
  })

  // The full table — ids, givers, targets — is pinned in `quests.test.ts`.
  it('keeps the six village errands, each with a reward', () => {
    const ids = new Set(QUESTS.map((q) => q.id))
    for (const id of ['beacon', 'explore', 'fishing', 'gear', 'packets', 'shells']) expect(ids.has(id)).toBe(true)
    for (const q of QUESTS) expect(q.reward.xp).toBeGreaterThan(0)
  })
})

describe('Xp', () => {
  it('levels at the thresholds and reports progress', () => {
    const levels: number[] = []
    const xp = new Xp(0, (l) => levels.push(l))
    expect(xp.level).toBe(1)
    xp.add(LEVELS[1])
    expect(xp.level).toBe(2)
    expect(levels).toEqual([2])
    xp.add(LEVELS[3] - LEVELS[1])
    expect(xp.level).toBe(4)
    expect(levels).toEqual([2, 3, 4])
    expect(xp.pct).toBeGreaterThanOrEqual(0)
    expect(xp.pct).toBeLessThan(1)
  })

  it('caps at the top level', () => {
    const xp = new Xp(99999, () => {})
    expect(xp.level).toBe(LEVELS.length)
    expect(xp.pct).toBe(1)
  })
})

describe('Achievements', () => {
  it('unlocks once and counts', () => {
    const got: string[] = []
    const a = new Achievements([], (id) => got.push(id))
    expect(a.unlock('first_steps')).toBe(true)
    expect(a.unlock('first_steps')).toBe(false)
    expect(a.has('first_steps')).toBe(true)
    expect(a.count()).toBe(1)
    expect(got).toEqual(['first_steps'])
    expect(a.unlock('bogus')).toBe(false)
  })

  it('lists the designed achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(14)
    expect(ACHIEVEMENTS.find((x) => x.id === 'complete')).toBeTruthy()
  })
})
