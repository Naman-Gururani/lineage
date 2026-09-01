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
import { ZONES } from '../src/data/content'
import { initPanels } from '../src/ui/panels'
import { closeReader, initReader, isReaderOpen } from '../src/ui/reader'
import { uiState } from '../src/ui/state'

describe('reader mode', () => {
  let locks: boolean[]
  let closed: string[]
  let unsubs: (() => void)[]

  beforeEach(() => {
    document.body.innerHTML = '<div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    locks = []
    closed = []
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initReader()
    unsubs = [
      events.on('ui:lock', ({ locked }) => locks.push(locked)),
      events.on('ui:closed', ({ id }) => closed.push(id)),
    ]
  })

  afterEach(() => {
    closeReader()
    for (const u of unsubs) u()
    vi.restoreAllMocks()
  })

  it('renders every zone title with a TOC, opened via ui:panel', () => {
    events.emit('ui:panel', { id: 'reader', data: undefined })
    const reader = document.querySelector('.reader')!
    expect(reader).toBeTruthy()
    expect(isReaderOpen()).toBe(true)
    expect(reader.getAttribute('role')).toBe('document')
    expect(document.body.classList.contains('reader-open')).toBe(true)
    expect(locks).toEqual([true])

    const text = reader.textContent ?? ''
    for (const z of ZONES) expect(text).toContain(z.content.title)

    expect(reader.querySelectorAll('.reader-zone').length).toBe(ZONES.length)
    expect(reader.querySelectorAll('.reader-toc a').length).toBe(ZONES.length)
    for (const z of ZONES) {
      expect(reader.querySelector(`#reader-${z.id}`)).toBeTruthy()
      expect(reader.querySelector(`#reader-h-${z.id}`)).toBeTruthy()
    }
    expect(reader.querySelector('.skip')).toBeTruthy()
    expect(reader.querySelector('#reader-main')).toBeTruthy()
  })

  it('closes from the back button and releases the lock', () => {
    events.emit('game:reader', {})
    expect(isReaderOpen()).toBe(true)
    const back = document.querySelector('.reader-back') as HTMLButtonElement
    back.click()
    expect(isReaderOpen()).toBe(false)
    expect(document.querySelector('.reader')).toBeNull()
    expect(document.body.classList.contains('reader-open')).toBe(false)
    expect(locks).toEqual([true, false])
    expect(closed).toEqual(['reader'])
  })

  it('closes on Escape', () => {
    events.emit('game:reader', {})
    expect(isReaderOpen()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(isReaderOpen()).toBe(false)
  })
})
