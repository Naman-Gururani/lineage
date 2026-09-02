// @vitest-environment happy-dom
//
// The shared on-screen d-pad. Every game has to be playable with taps — the
// world's own joystick is inert under a modal — so this is the only way to steer
// Crew Drop on a phone. Ported out of the retired Cargo Cove renderer.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The pad builds its element with `el()` from ui/modal, which reaches the event
// bus, which constructs a Phaser emitter at import time — and Phaser's canvas
// feature probe dies against happy-dom's stub. The bus is never used here, so an
// empty emitter is enough (the same stand-in the other ui/ suites install).
vi.mock('phaser', () => ({ default: { Events: { EventEmitter: class {} } } }))

import { mountPad, type PadDir } from '../src/ui/minigames/pad'

let root: HTMLElement

beforeEach(() => {
  document.body.innerHTML = ''
  root = document.createElement('div')
  document.body.append(root)
})

const btn = (pad: HTMLElement, dir: PadDir) => pad.querySelector<HTMLButtonElement>(`[data-dir="${dir}"]`)!

/** A pointer event that behaves like the real one: pointer events bubble. */
const pointer = (type: string) => new PointerEvent(type, { bubbles: true })

describe('mountPad', () => {
  it('mounts a labelled group of four direction buttons into the root', () => {
    const pad = mountPad(root, vi.fn())
    expect(pad.parentElement).toBe(root)
    expect(pad.className).toBe('mg-pad')
    expect(pad.getAttribute('role')).toBe('group')
    expect(pad.getAttribute('aria-label')).toBe('Direction pad')

    const buttons = pad.querySelectorAll<HTMLButtonElement>('button.mg-padbtn')
    expect([...buttons].map((b) => b.dataset.dir)).toEqual(['up', 'left', 'down', 'right'])
    for (const b of buttons) {
      // `type="button"` keeps a pad inside a form from submitting it, and every
      // button needs a name of its own — the glyph alone reads as "left arrow".
      expect(b.type).toBe('button')
      expect(b.getAttribute('aria-label')).toBeTruthy()
    }
  })

  it('gives each button the class panels.css lays the grid out by', () => {
    // `.mg-padbtn.up { grid-column: 2 }` and friends: without the direction
    // class the four buttons collapse into one unusable row.
    const pad = mountPad(root, vi.fn())
    for (const dir of ['up', 'left', 'down', 'right'] as PadDir[]) {
      expect(btn(pad, dir).classList.contains(dir)).toBe(true)
    }
  })

  it('reports the direction of a clicked button', () => {
    const onDir = vi.fn()
    const pad = mountPad(root, onDir)
    for (const dir of ['up', 'left', 'down', 'right'] as PadDir[]) {
      btn(pad, dir).click()
      expect(onDir).toHaveBeenLastCalledWith(dir)
    }
    expect(onDir).toHaveBeenCalledTimes(4)
  })

  it('ignores a click on the gap between buttons', () => {
    const onDir = vi.fn()
    const pad = mountPad(root, onDir)
    pad.dispatchEvent(new Event('click', { bubbles: true }))
    expect(onDir).not.toHaveBeenCalled()
  })

  it('tracks a held button down and up for games that move continuously', () => {
    const held = vi.fn<(d: PadDir | null) => void>()
    const pad = mountPad(root, vi.fn(), { held })
    const left = btn(pad, 'left')

    left.dispatchEvent(pointer('pointerdown'))
    expect(held).toHaveBeenLastCalledWith('left')
    left.dispatchEvent(pointer('pointerup'))
    expect(held).toHaveBeenLastCalledWith(null)
    expect(held).toHaveBeenCalledTimes(2)
  })

  it('releases the hold when the pointer is cancelled or slides off the pad', () => {
    const held = vi.fn<(d: PadDir | null) => void>()
    const pad = mountPad(root, vi.fn(), { held })

    btn(pad, 'up').dispatchEvent(pointer('pointerdown'))
    btn(pad, 'up').dispatchEvent(pointer('pointercancel'))
    expect(held).toHaveBeenLastCalledWith(null)

    held.mockClear()
    btn(pad, 'down').dispatchEvent(pointer('pointerdown'))
    // a thumb dragged off the pad: no pointerup ever lands on the button
    pad.dispatchEvent(new PointerEvent('pointerleave'))
    expect(held).toHaveBeenLastCalledWith(null)
  })

  it('reports the release once, however many events end the press', () => {
    const held = vi.fn<(d: PadDir | null) => void>()
    const pad = mountPad(root, vi.fn(), { held })

    btn(pad, 'right').dispatchEvent(pointer('pointerdown'))
    btn(pad, 'right').dispatchEvent(pointer('pointerup'))
    pad.dispatchEvent(new PointerEvent('pointerleave'))
    expect(held.mock.calls).toEqual([['right'], [null]])
  })

  it('still fires onDir for a tap when a game also listens for holds', () => {
    // Touch produces the whole pointer sequence *and* a click; a held-aware game
    // must not lose the single-hop tap.
    const onDir = vi.fn()
    const held = vi.fn<(d: PadDir | null) => void>()
    const pad = mountPad(root, onDir, { held })
    const up = btn(pad, 'up')
    up.dispatchEvent(pointer('pointerdown'))
    up.dispatchEvent(pointer('pointerup'))
    up.click()
    expect(onDir).toHaveBeenCalledWith('up')
  })

  it('survives a press when the game asked for no hold tracking', () => {
    const onDir = vi.fn()
    const pad = mountPad(root, onDir)
    expect(() => btn(pad, 'left').dispatchEvent(pointer('pointerdown'))).not.toThrow()
    btn(pad, 'left').click()
    expect(onDir).toHaveBeenCalledWith('left')
  })
})
