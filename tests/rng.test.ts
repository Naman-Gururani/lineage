import { describe, expect, it } from 'vitest'
import { hashString, makeRng } from '../src/core/rng'

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    const sa = Array.from({ length: 100 }, () => a.next())
    const sb = Array.from({ length: 100 }, () => b.next())
    expect(sa).toEqual(sb)
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('produces different sequences for different seeds', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(Array.from({ length: 5 }, () => b.next()))
  })

  it('fork yields independent, reproducible labelled streams', () => {
    const coast = makeRng('world').fork('coast')
    const trees = makeRng('world').fork('trees')
    const coastAgain = makeRng('world').fork('coast')
    const s1 = [coast.next(), coast.next(), coast.next()]
    const s2 = [trees.next(), trees.next(), trees.next()]
    const s1b = [coastAgain.next(), coastAgain.next(), coastAgain.next()]
    expect(s1).toEqual(s1b)
    expect(s1).not.toEqual(s2)
  })

  it('int stays within the inclusive range and covers every value', () => {
    const r = makeRng(7)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      expect(Number.isInteger(v)).toBe(true)
      seen.add(v)
    }
    expect(seen.size).toBe(6)
  })

  it('range, chance and pick behave', () => {
    const r = makeRng('x')
    for (let i = 0; i < 100; i++) {
      const v = r.range(-2, 3)
      expect(v).toBeGreaterThanOrEqual(-2)
      expect(v).toBeLessThan(3)
    }
    expect(r.chance(0)).toBe(false)
    expect(r.chance(1)).toBe(true)
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']))
    const arr = [1, 2, 3, 4, 5]
    const shuffled = r.shuffle(arr)
    expect(shuffled).toBe(arr)
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('hashString', () => {
  it('is deterministic and distinguishes strings', () => {
    expect(hashString('coast')).toBe(hashString('coast'))
    expect(hashString('coast')).not.toBe(hashString('trees'))
    expect(Number.isInteger(hashString('anything'))).toBe(true)
  })
})
