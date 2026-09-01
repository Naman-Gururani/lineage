import { describe, expect, it } from 'vitest'
import { DialogueRunner, type Cond, type Ctx, type Effect, type Tree } from '../src/systems/Dialogue'

function ctx(flags: Record<string, boolean> = {}, applied: Effect[] = []): Ctx {
  return {
    check: (c?: Cond) => {
      if (!c) return true
      if (c.flag && !flags[c.flag]) return false
      if (c.notFlag && flags[c.notFlag]) return false
      return true
    },
    apply: (e) => applied.push(...e),
  }
}

const tree: Tree = {
  id: 't',
  entry: [
    { when: { flag: 'met' }, node: 'again' },
    { node: 'first' },
  ],
  nodes: {
    first: {
      lines: [
        { who: 'Mira', text: 'Welcome!' },
        { who: 'Mira', text: 'Need a tour?' },
      ],
      choices: [
        { text: 'Yes', next: 'tour' },
        { text: 'No', next: 'bye' },
      ],
      effects: [{ setFlag: 'met' }],
    },
    tour: { lines: [{ who: 'Mira', text: 'Follow me.' }], next: 'bye' },
    bye: { lines: [{ who: 'Mira', text: 'See you.' }] },
    again: { lines: [{ who: 'Mira', text: 'Back already?' }] },
  },
}

describe('DialogueRunner', () => {
  it('walks lines, offers choices, follows next and ends', () => {
    const applied: Effect[] = []
    const r = new DialogueRunner(tree, ctx({}, applied))
    expect(r.line.text).toBe('Welcome!')
    expect(applied).toEqual([{ setFlag: 'met' }])
    expect(r.advance()).toBe('line')
    expect(r.line.text).toBe('Need a tour?')
    expect(r.advance()).toBe('choice')
    expect(r.atChoice).toBe(true)
    expect(r.choices.map((c) => c.text)).toEqual(['Yes', 'No'])
    r.choose(0)
    expect(r.line.text).toBe('Follow me.')
    expect(r.advance()).toBe('line')
    expect(r.line.text).toBe('See you.')
    expect(r.advance()).toBe('end')
    expect(r.ended).toBe(true)
  })

  it('picks the first entry whose condition passes', () => {
    const r = new DialogueRunner(tree, ctx({ met: true }))
    expect(r.line.text).toBe('Back already?')
    expect(r.advance()).toBe('end')
  })

  it('filters choices by condition', () => {
    const t2: Tree = {
      id: 'c',
      entry: [{ node: 'a' }],
      nodes: {
        a: { lines: [{ who: 'X', text: 'Hi' }], choices: [{ text: 'secret', next: 'b', when: { flag: 'vip' } }, { text: 'ok', next: 'b' }] },
        b: { lines: [{ who: 'X', text: 'Bye' }] },
      },
    }
    const r = new DialogueRunner(t2, ctx())
    r.advance()
    expect(r.choices.map((c) => c.text)).toEqual(['ok'])
  })

  it('applies effects once per node entry', () => {
    const applied: Effect[] = []
    const r = new DialogueRunner(tree, ctx({}, applied))
    r.advance()
    r.advance()
    r.choose(1)
    expect(applied.length).toBe(1)
  })
})
