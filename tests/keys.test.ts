// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { BINDINGS, keys } from '../src/core/keys'

function press(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent('keydown', init))
}
function release(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent('keyup', init))
}

describe('key bindings', () => {
  it('binds jump to Space', () => {
    expect(BINDINGS.jump).toContain('Space')
  })
})

describe('key tracking', () => {
  it('tracks Space by code', () => {
    press({ code: 'Space', key: ' ' })
    expect(keys.down('Space')).toBe(true)
    expect(keys.any(...BINDINGS.jump)).toBe(true)
    release({ code: 'Space', key: ' ' })
    expect(keys.down('Space')).toBe(false)
  })

  it("tracks Space from key ' ' when no code is reported", () => {
    press({ key: ' ' })
    expect(keys.down('Space')).toBe(true)
    release({ key: ' ' })
    expect(keys.down('Space')).toBe(false)
  })

  it("answers queries written as ' ' too", () => {
    press({ code: 'Space', key: ' ' })
    expect(keys.down(' ')).toBe(true)
    expect(keys.any(' ')).toBe(true)
    release({ code: 'Space', key: ' ' })
    expect(keys.down(' ')).toBe(false)
  })

  it('still tracks ordinary movement keys', () => {
    press({ code: 'KeyW', key: 'w' })
    expect(keys.any('ArrowUp', 'KeyW')).toBe(true)
    release({ code: 'KeyW', key: 'w' })
    expect(keys.any('ArrowUp', 'KeyW')).toBe(false)
  })

  it('clears held keys when the window blurs', () => {
    press({ code: 'Space', key: ' ' })
    window.dispatchEvent(new Event('blur'))
    expect(keys.down('Space')).toBe(false)
  })
})
