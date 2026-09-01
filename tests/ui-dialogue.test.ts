// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  type Fn = (p: unknown) => void
  class EventEmitter {
    private m = new Map<string, Set<Fn>>()
    on(k: string, fn: Fn) {
      let s = this.m.get(k)
      if (!s) {
        s = new Set()
        this.m.set(k, s)
      }
      s.add(fn)
      return this
    }
    once(k: string, fn: Fn) {
      const w: Fn = (p) => {
        this.off(k, w)
        fn(p)
      }
      return this.on(k, w)
    }
    off(k: string, fn: Fn) {
      this.m.get(k)?.delete(fn)
      return this
    }
    emit(k: string, p: unknown) {
      for (const fn of Array.from(this.m.get(k) ?? [])) fn(p)
      return true
    }
  }
  return { default: { Events: { EventEmitter } } }
})

import { sfx } from '../src/audio/sfx'
import { events } from '../src/core/events'
import { DialogueRunner, type Ctx, type Tree } from '../src/systems/Dialogue'
import { isDialogueOpen, openDialogue } from '../src/ui/dialogue'
import { uiState } from '../src/ui/state'

const ctx: Ctx = { check: () => true, apply: () => {} }

const tree: Tree = {
  id: 't',
  entry: [{ node: 'first' }],
  nodes: {
    first: {
      lines: [
        { who: 'Mira', text: 'Hello!' },
        { who: 'Mira', text: 'Tour?', face: 'face_mira', emote: 'happy' },
      ],
      choices: [
        { text: 'Yes', next: 'yes' },
        { text: 'No', next: 'no' },
      ],
    },
    yes: { lines: [{ who: 'Mira', text: 'Come.' }] },
    no: { lines: [{ who: 'Mira', text: 'Bye.' }] },
  },
}

const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

/** End any dangling session so tests stay independent. */
const flushDialogue = () => {
  const r = new DialogueRunner({ id: 'x', entry: [{ node: 'a' }], nodes: { a: { lines: [{ who: 'x', text: 'y' }] } } }, ctx)
  r.advance()
  void openDialogue(r) // an already-ended runner finishes immediately (and any previous session with it)
}

describe('dialogue box', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ui"></div>'
    uiState.settings.reducedMotion = true // synchronous hide on finish (typewriter still runs)
    uiState.settings.textSpeed = 'fast' // 12ms per char
    uiState.faces = () => ''
    vi.useFakeTimers()
    for (const k of ['open', 'close', 'select', 'pickup'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
  })

  afterEach(() => {
    flushDialogue()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('types, blips, advances, offers choices and resolves at the end', async () => {
    const blip = vi.spyOn(sfx, 'blip').mockImplementation(() => {})
    const locks: boolean[] = []
    const unsub = events.on('ui:lock', ({ locked }) => locks.push(locked))

    const runner = new DialogueRunner(tree, ctx)
    let resolved = false
    const p = openDialogue(runner, { npc: 'mira' }).then(() => (resolved = true))

    const root = document.querySelector('.dlg')!
    expect(root.classList.contains('hidden')).toBe(false)
    expect(isDialogueOpen()).toBe(true)
    expect(locks).toEqual([true])
    expect(document.querySelector('.dlg-who')!.textContent).toBe('Mira')
    // screen readers get the whole line at once
    expect(document.querySelector('.dlg-live')!.textContent).toContain('Hello!')

    const typed = document.querySelector('.dlg-typed')!
    expect(typed.textContent).toBe('')
    vi.advanceTimersByTime(12 * 3 + 1) // 3 typewriter ticks at 'fast'
    expect(typed.textContent).toBe('Hel')
    expect(blip.mock.calls.length).toBeGreaterThanOrEqual(1)

    key('e') // typing → complete the line, don't advance
    expect(typed.textContent).toBe('Hello!')
    expect(document.querySelector('.dlg-who')!.textContent).toBe('Mira')

    key('Enter') // next line
    vi.advanceTimersByTime(1000)
    expect(typed.textContent).toBe('Tour?')
    expect((document.querySelector('.dlg-emote') as HTMLElement).hidden).toBe(false)

    key(' ') // advance → choices
    const choices = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.dlg-choice'))
    expect(choices().map((c) => c.textContent)).toEqual(['Yes', 'No'])
    expect(choices()[0].classList.contains('sel')).toBe(true)

    key('ArrowDown')
    expect(choices()[1].classList.contains('sel')).toBe(true)
    key('ArrowUp')
    expect(choices()[0].classList.contains('sel')).toBe(true)

    key('Enter') // choose "Yes"
    vi.advanceTimersByTime(1000)
    expect(typed.textContent).toBe('Come.')

    key('e') // last line → end
    await p
    expect(resolved).toBe(true)
    expect(isDialogueOpen()).toBe(false)
    expect(root.classList.contains('hidden')).toBe(true)
    expect(locks).toEqual([true, false])
    unsub()
  })

  it('clicking the box completes typing, then advances', async () => {
    const runner = new DialogueRunner(
      { id: 'c', entry: [{ node: 'a' }], nodes: { a: { lines: [{ who: 'Sol', text: 'Hi.' }, { who: 'Sol', text: 'Bye.' }] } } },
      ctx,
    )
    const p = openDialogue(runner)
    const box = document.querySelector('.dlg-box') as HTMLElement
    const typed = document.querySelector('.dlg-typed')!
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(typed.textContent).toBe('Hi.')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    vi.advanceTimersByTime(1000)
    expect(typed.textContent).toBe('Bye.')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await p
    expect(isDialogueOpen()).toBe(false)
  })

  it('respects the configured text speed', () => {
    uiState.settings.textSpeed = 'slow' // 40ms per char
    const runner = new DialogueRunner(
      { id: 's', entry: [{ node: 'a' }], nodes: { a: { lines: [{ who: 'Pip', text: 'Shells' }] } } },
      ctx,
    )
    void openDialogue(runner)
    const typed = document.querySelector('.dlg-typed')!
    vi.advanceTimersByTime(12 * 3 + 1) // not enough at slow speed
    expect(typed.textContent).toBe('')
    vi.advanceTimersByTime(40 * 3)
    expect(typed.textContent?.length).toBeGreaterThanOrEqual(3)
    flushDialogue()
  })
})
