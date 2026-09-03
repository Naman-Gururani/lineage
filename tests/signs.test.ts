// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import { WORLD_SEED } from '../src/config'
import { events } from '../src/core/events'
import { makeRng } from '../src/core/rng'
import { SIGNS, SIGN_TARGETS, type SignDir } from '../src/data/signs'
import { closeAllModals } from '../src/ui/modal'
import { initPanels } from '../src/ui/panels'
import { uiState } from '../src/ui/state'
import { BLUEPRINT, rasterizeBlueprint, type Attraction } from '../src/world/blueprint'
import { isWalkable } from '../src/world/terrain'

const grid = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))

/** A tile inside an attraction's footprint — the stall itself, not its door. */
const inside = (a: Attraction, x: number, y: number): boolean => x >= a.tx && x < a.tx + a.w && y >= a.ty && y < a.ty + a.h

const DIRS: SignDir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/**
 * Compass bearing from one tile to another in degrees clockwise from North.
 * Screen coordinates: y grows southward, so North is -y.
 */
function bearing(fx: number, fy: number, tx: number, ty: number): number {
  return ((Math.atan2(tx - fx, -(ty - fy)) * 180) / Math.PI + 360) % 360
}

/** Smallest angle between an arm's 8-way sector centre and an actual bearing. */
function offBy(dir: SignDir, deg: number): number {
  const d = Math.abs(deg - DIRS.indexOf(dir) * 45) % 360
  return d > 180 ? 360 - d : d
}

describe('bearing helpers', () => {
  it('measures 8-way sectors clockwise from North with y pointing south', () => {
    expect(bearing(10, 10, 10, 0)).toBe(0) // straight up the screen is North
    expect(bearing(10, 10, 20, 10)).toBe(90)
    expect(bearing(10, 10, 10, 20)).toBe(180)
    expect(bearing(10, 10, 0, 10)).toBe(270)
    expect(bearing(10, 10, 20, 0)).toBe(45) // up and right is North-East
    expect(offBy('NW', 350)).toBe(35)
    expect(offBy('N', 350)).toBe(10)
  })
})

describe('SIGNS data', () => {
  it('has the six authored junction posts with unique ids and 2–4 arms each', () => {
    expect(SIGNS.map((s) => s.id)).toEqual(['gate', 'midway_w', 'midway_e', 'hill', 'pond', 'wheel'])
    expect(new Set(SIGNS.map((s) => s.id)).size).toBe(SIGNS.length)
    for (const s of SIGNS) {
      expect(s.arms.length, `${s.id} arms`).toBeGreaterThanOrEqual(2)
      expect(s.arms.length, `${s.id} arms`).toBeLessThanOrEqual(4)
      // one arrow per direction: two arms never share a heading
      expect(new Set(s.arms.map((a) => a.dir)).size, `${s.id} duplicate heading`).toBe(s.arms.length)
      for (const a of s.arms) {
        expect(DIRS, `${s.id} dir ${a.dir}`).toContain(a.dir)
        expect(a.label.trim().length, `${s.id} empty label`).toBeGreaterThan(0)
        expect(a.label.length, `${s.id} label too long: ${a.label}`).toBeLessThanOrEqual(44)
        if (a.note !== undefined) expect(a.note.trim().length, `${s.id} empty note`).toBeGreaterThan(0)
      }
    }
  })

  it('resolves every arm label through SIGN_TARGETS', () => {
    for (const s of SIGNS)
      for (const a of s.arms) expect(SIGN_TARGETS[a.label], `sign "${s.id}" arm "${a.label}"`).toBeDefined()
    // no dead entries: every target is pointed at by some arm
    const used = new Set(SIGNS.flatMap((s) => s.arms.map((a) => a.label)))
    for (const label of Object.keys(SIGN_TARGETS)) expect(used.has(label), `unused SIGN_TARGETS entry "${label}"`).toBe(true)
  })

  it('anchors every target on the fairground, on a door rather than inside a stall', () => {
    for (const [label, t] of Object.entries(SIGN_TARGETS)) {
      expect(grid.inb(t.tx, t.ty), `target "${label}" off the map`).toBe(true)
      for (const a of BLUEPRINT.attractions) expect(inside(a, t.tx, t.ty), `target "${label}" inside ${a.id}`).toBe(false)
    }
  })

  it('points at every attraction door the fair has a name for', () => {
    // The arms are the only signposting the fair has; each of the eight
    // attractions is named on at least one of them, at its own door tile.
    const doors = new Map(BLUEPRINT.attractions.map((a) => [`${a.door.x},${a.door.y}`, a.id]))
    const named = new Set(Object.values(SIGN_TARGETS).map((t) => doors.get(`${t.tx},${t.ty}`)).filter(Boolean))
    for (const a of BLUEPRINT.attractions) expect(named.has(a.id), `no arm points at "${a.id}"`).toBe(true)
  })

  it('points every arm within ±45° of its target', () => {
    for (const s of SIGNS)
      for (const a of s.arms) {
        const t = SIGN_TARGETS[a.label]
        const deg = bearing(s.tx, s.ty, t.tx, t.ty)
        expect(offBy(a.dir, deg), `sign "${s.id}" arm ${a.dir} "${a.label}" bears ${deg.toFixed(1)}°`).toBeLessThanOrEqual(45)
      }
  })

  it('stands every post on a tile you can walk up to', () => {
    for (const s of SIGNS) {
      expect(grid.inb(s.tx, s.ty), `sign "${s.id}" off the map`).toBe(true)
      let adjacent = false
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          if (grid.inb(s.tx + dx, s.ty + dy) && isWalkable(grid.get(s.tx + dx, s.ty + dy))) adjacent = true
        }
      expect(adjacent, `sign "${s.id}" at ${s.tx},${s.ty} has no walkable neighbour`).toBe(true)
      for (const a of BLUEPRINT.attractions) expect(inside(a, s.tx, s.ty), `sign "${s.id}" inside ${a.id}`).toBe(false)
    }
  })

  it('is placed in the blueprint as a sign_finger prop at the same tile', () => {
    const posts = BLUEPRINT.props.filter((p) => p.kind === 'sign_finger')
    expect(posts.length).toBe(SIGNS.length)
    for (const s of SIGNS) {
      const prop = posts.find((p) => p.id === s.id)
      expect(prop, `no sign_finger prop for "${s.id}"`).toBeDefined()
      expect([prop!.x, prop!.y], `prop "${s.id}" moved away from its SignDef`).toEqual([s.tx, s.ty])
      expect(prop!.solid, `sign "${s.id}" should not block the road`).toBeUndefined()
    }
  })
})

describe('sign card', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    for (const k of ['open', 'close', 'select', 'blip'] as const) vi.spyOn(sfx, k).mockImplementation(() => {})
    closeAllModals()
    initPanels()
  })

  const openGate = () => {
    events.emit('ui:panel', { id: 'sign', data: 'gate' })
    return document.querySelector('.signcard') as HTMLElement
  }

  it('opens from ui:panel with one row per arm, an arrow glyph and a bold label', () => {
    const card = openGate()
    expect(card).not.toBeNull()
    const sign = SIGNS.find((s) => s.id === 'gate')!
    const rows = card.querySelectorAll('.sign-arm')
    expect(rows.length).toBe(sign.arms.length)
    const ARROW: Record<SignDir, string> = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' }
    sign.arms.forEach((arm, i) => {
      const row = rows[i]
      expect(row.querySelector('.sign-arrow')!.textContent).toBe(ARROW[arm.dir])
      expect(row.querySelector('.sign-label')!.textContent).toBe(arm.label)
      const note = row.querySelector('.sign-note')
      if (arm.note) expect(note!.textContent).toBe(arm.note)
      else expect(note).toBeNull()
    })
    // the direction is spelled out for screen readers, not left as a glyph
    expect(rows[0].querySelector('.sign-arrow')!.getAttribute('aria-hidden')).toBe('true')
    expect(rows[0].textContent).toContain('North')
  })

  it('labels the dialog for assistive tech and holds the world-input lock', () => {
    const locks: boolean[] = []
    const off = events.on('ui:lock', ({ locked }) => locks.push(locked))
    openGate()
    const panel = document.querySelector('.modal-panel') as HTMLElement
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(panel.getAttribute('aria-label')).toMatch(/sign/i)
    expect(locks).toEqual([true])
    off()
  })

  it('closes on Escape and on E', () => {
    for (const key of ['Escape', 'e']) {
      openGate()
      expect(document.querySelector('.signcard')).not.toBeNull()
      // E walks on only once the press that opened the card has ended, so the
      // dialog has to see a release first — as it does from any real key press.
      // `tests/ui-sign.test.ts` drives that whole ordering properly.
      document.activeElement?.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      expect(document.querySelector('.signcard'), `${key} did not close the card`).toBeNull()
    }
  })

  it('ignores an unknown sign id', () => {
    events.emit('ui:panel', { id: 'sign', data: 'nowhere' })
    expect(document.querySelector('.signcard')).toBeNull()
  })
})
