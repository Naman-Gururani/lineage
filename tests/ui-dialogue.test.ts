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
import { initDialogue, isDialogueOpen, openDialogue } from '../src/ui/dialogue'
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

// Wire the anchor listener once, up front: the anchor tests emit before any box
// has opened, and the wiring is idempotent.
initDialogue()

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

  // B1: the arrival apron is on the world's bottom row, so the camera clamps
  // there and the player and Bo stand in the last tenth of the viewport — behind
  // the box, for the whole intro. The scene reports where the speaker is and the
  // box docks at the top instead.
  describe('getting out of the speaker’s way', () => {
    const anchor = (y: number) => events.emit('ui:dialogue-anchor', { y })
    const open = () => {
      const runner = new DialogueRunner({ id: 'a', entry: [{ node: 'a' }], nodes: { a: { lines: [{ who: 'Bo', text: 'Hi' }] } } }, ctx)
      void openDialogue(runner)
      return document.querySelector('.dlg')!
    }

    it('docks at the top only once the speaker is in the bottom third', () => {
      for (const [y, top] of [
        [0, false],
        [0.5, false],
        [0.66, false],
        [2 / 3, true],
        [0.9, true],
        [1, true],
      ] as const) {
        anchor(y)
        expect(open().classList.contains('top'), `anchor ${y}`).toBe(top)
        flushDialogue()
      }
    })

    it('forgets the anchor after one conversation — the next box is where it always was', () => {
      anchor(0.95)
      expect(open().classList.contains('top')).toBe(true)
      flushDialogue()
      // Nothing reported a position this time (a panel, a test, a cutscene beat
      // with no camera behind it), so the box goes back to the bottom.
      expect(open().classList.contains('top')).toBe(false)
      flushDialogue()
    })

    it('docks below the HUD cluster when there is one, and forgets the offset with the anchor', () => {
      const ui = document.getElementById('ui')!
      const hudRoot = document.createElement('div')
      hudRoot.className = 'hud'
      const cluster = document.createElement('div')
      cluster.className = 'hud-cluster'
      cluster.getBoundingClientRect = () => ({ bottom: 90, top: 8, left: 8, right: 400, width: 392, height: 82, x: 8, y: 8, toJSON: () => ({}) }) as DOMRect
      hudRoot.appendChild(cluster)
      ui.appendChild(hudRoot)
      anchor(0.95)
      const box = open()
      expect(box.classList.contains('top')).toBe(true)
      expect((box as HTMLElement).style.top).toBe('100px') // the cluster's bottom edge plus a small gap
      flushDialogue()
      // A hidden HUD (title screen, cutscene fade) leaves the stylesheet's own `top`.
      hudRoot.classList.add('hidden')
      anchor(0.95)
      expect((open() as HTMLElement).style.top).toBe('')
      flushDialogue()
      // And a bottom-docked box carries no inline offset at all.
      anchor(0.2)
      expect((open() as HTMLElement).style.top).toBe('')
      flushDialogue()
    })

    it('shrugs at an anchor that is not a number', () => {
      anchor(Number.NaN)
      expect(open().classList.contains('top')).toBe(false)
      flushDialogue()
    })
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
