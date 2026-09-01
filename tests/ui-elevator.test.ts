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
import { initElevator, splitRoles } from '../src/ui/elevator'
import { closeAllModals } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'

const experience = ZONES.find((z) => z.id === 'experience')!

describe('splitRoles', () => {
  it('splits the two roles at the ⭐ / 🛠️ markers', () => {
    const { sde, intern } = splitRoles(experience.content.body!)
    expect(sde.head).toContain('Software Development Engineer')
    expect(sde.head).toContain('Aug 2024')
    expect(sde.head.startsWith('⭐')).toBe(false)
    expect(sde.text).toContain('750M')
    expect(sde.text).toContain('lineage engine')

    expect(intern.head).toContain('DevOps Intern')
    expect(intern.head).toContain('2023')
    expect(intern.head.startsWith('🛠')).toBe(false)
    expect(intern.text).toContain('OAuth 2.0')
    expect(intern.text).not.toContain('750M')
  })

  it('is robust to missing markers', () => {
    expect(splitRoles([])).toEqual({ sde: { head: '', text: '' }, intern: { head: '', text: '' } })
    const only = splitRoles(['⭐ Solo role', 'Did things.'])
    expect(only.sde).toEqual({ head: 'Solo role', text: 'Did things.' })
    expect(only.intern).toEqual({ head: '', text: '' })
  })
})

describe('elevator panel', () => {
  let frames: number[]
  let unsub: () => void

  beforeEach(() => {
    document.body.innerHTML = '<div id="ui"></div>'
    document.body.className = ''
    vi.useFakeTimers()
    for (const k of ['open', 'close', 'select', 'blip', 'pickup'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    initPanels()
    initElevator()
    frames = []
    unsub = events.on('room:window', ({ frame }) => frames.push(frame))
  })

  afterEach(() => {
    closeAllModals()
    unsub()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('rides to a floor, emits room:window and shows the right card', () => {
    uiState.settings.reducedMotion = false
    events.emit('ui:panel', { id: 'elevator', data: undefined })
    const box = document.querySelector('.elev')!
    const card = document.querySelector('.elev-card')!
    expect(card.textContent).toContain('Welcome to Barclays Tower')
    expect(frames).toEqual([])

    // floor index 2 = "5 · Software Development Engineer" (level 5, window frame 2)
    ;(document.querySelector('[data-floor="2"]') as HTMLButtonElement).click()
    expect(box.classList.contains('moving')).toBe(true)
    expect(frames).toEqual([]) // not arrived yet
    vi.advanceTimersByTime(130 * 5 + 220 + 20)
    expect(box.classList.contains('moving')).toBe(false)
    expect(frames).toEqual([2])
    expect(card.textContent).toContain('Software Development Engineer')
    expect(card.textContent).toContain('750M')
    expect(card.textContent).not.toContain('OAuth 2.0')
    expect((document.querySelector('.elev-window') as HTMLElement).dataset.frame).toBe('2')

    // rooftop shows the stack as badges
    ;(document.querySelector('[data-floor="3"]') as HTMLButtonElement).click()
    vi.advanceTimersByTime(130 * 2 + 220 + 20)
    expect(frames).toEqual([2, 3])
    expect(document.querySelectorAll('.badge').length).toBe(experience.content.chips!.length)
  })

  it('arrives instantly under reduced motion, intern floor shows the internship', () => {
    uiState.settings.reducedMotion = true
    events.emit('ui:panel', { id: 'elevator', data: undefined })
    const card = document.querySelector('.elev-card')!
    ;(document.querySelector('[data-floor="1"]') as HTMLButtonElement).click()
    expect(frames).toEqual([1])
    expect(card.textContent).toContain('DevOps Intern')
    expect(card.textContent).toContain('OAuth 2.0')
  })
})
