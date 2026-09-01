// @vitest-environment happy-dom
// The save-side wiring Task 12 adds: one wardrobe (owned vs worn), mini-game
// quests that read the score a round reached, Packet Rush paying out in real
// packets, and the pause-menu rows that surface all of it.
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

import { events, type Events } from '../src/core/events'
import { defaultSave, type Save } from '../src/core/save'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { ZONES } from '../src/data/content'
import { QUESTS } from '../src/data/quests'
import { ARCADE_GAMES, GameState, RUSH_PACKET_IDS } from '../src/systems/GameState'
import { closeAllModals, topModalId } from '../src/ui/modal'
import { FAST_TRAVEL, initMap, openMap } from '../src/ui/map'
import { initPanels } from '../src/ui/panels'
import { initPause, openPause } from '../src/ui/pause'
import { uiState } from '../src/ui/state'
import { BLUEPRINT } from '../src/world/blueprint'

type Toast = Events['ui:toast']

const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const all = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))
const key = (k: string) => {
  const target = (document.activeElement as HTMLElement) ?? document.body
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}

/** A state whose hat effects are observable. */
function mk(save: Save | null = null) {
  const worn: string[] = []
  const state = new GameState(save)
  state.handlers.hat = (id) => worn.push(id)
  return { state, worn }
}

describe('wardrobe', () => {
  it('wears the first hat it is handed and banks the ones after it', () => {
    const { state, worn } = mk()
    expect(state.unlockHat('grad')).toBe(true)
    expect(state.save.hats).toEqual(['grad'])
    expect(state.save.hat).toBe('grad')
    expect(worn).toEqual(['grad'])

    expect(state.unlockHat('captain')).toBe(true)
    expect(state.save.hats).toEqual(['grad', 'captain'])
    expect(state.save.hat).toBe('grad') // a head that is already covered keeps what it wears
    expect(state.unlockHat('captain')).toBe(false) // owning it twice is not news
    expect(state.save.hats).toEqual(['grad', 'captain'])
  })

  it('puts a hat on over the top when the grant insists', () => {
    const { state, worn } = mk()
    state.unlockHat('grad')
    state.unlockHat('crown', true)
    expect(state.save.hat).toBe('crown')
    expect(state.save.hats).toEqual(['grad', 'crown'])
    expect(worn).toEqual(['grad', 'crown'])
  })

  it('equips only what you own, and takes the hat off for ""', () => {
    const { state, worn } = mk()
    state.unlockHat('grad')
    state.unlockHat('captain')
    expect(state.equipHat('captain')).toBe(true)
    expect(state.save.hat).toBe('captain')
    expect(state.equipHat('crown')).toBe(false) // not in the wardrobe
    expect(state.save.hat).toBe('captain')
    expect(state.equipHat('')).toBe(true)
    expect(state.save.hat).toBe('')
    expect(worn).toEqual(['grad', 'captain', ''])
  })

  it('takes in a hat worn before there was a wardrobe to keep it in', () => {
    const save = defaultSave()
    save.hat = 'seashell'
    const { state } = mk(save)
    expect(state.save.hats).toEqual(['seashell'])
    expect(state.save.hat).toBe('seashell')
  })

  it('takes back the hats an old save could only remember one of', () => {
    // Pre-wardrobe: shells and gear both finished, so both caps were earned, but
    // only the last one granted was ever written down — and Study Hall was won.
    const save = defaultSave()
    save.hat = 'hardhat'
    save.quests.shells = { started: true, done: true, progress: {} }
    save.quests.gear = { started: true, done: true, progress: {} }
    save.minigames.studyhall = { won: true, best: 5, plays: 1 }
    const toasts: Toast[] = []
    const unsub = events.on('ui:toast', (t) => toasts.push(t))
    const { state } = mk(save)
    unsub()
    expect(state.save.hats.sort()).toEqual(['grad', 'hardhat', 'seashell'])
    expect(state.save.hat).toBe('hardhat') // recovery owns, it never re-dresses you
    // …and it happens in silence: the only toasts a load may raise are the ones
    // the auto-started errands have always raised.
    expect(toasts.filter((t) => t.kind !== 'quest')).toEqual([])
  })

  it('banks a quest reward instead of swapping the hat off your head, and says where it went', () => {
    const { state } = mk()
    state.unlockHat('grad')
    const toasts: Toast[] = []
    const unsub = events.on('ui:toast', (t) => toasts.push(t))
    state.quests.start('shells')
    state.quests.advance('shells', 'find', 5)
    state.quests.advance('shells', 'return', 1)
    unsub()
    expect(state.quests.isDone('shells')).toBe(true)
    expect(state.hasHat('seashell')).toBe(true)
    expect(state.save.hat).toBe('grad')
    const banked = toasts.find((t) => t.title === 'Seashell crown unlocked')
    expect(banked?.sub).toBe('Added to your hats')
  })

  it('offers a live view of itself to the pause menu', () => {
    const { state } = mk()
    const view = state.wardrobeView()
    expect(view.hats).toEqual([])
    state.unlockHat('grad')
    expect(view.hats).toEqual(['grad']) // the view reads the save, it does not copy it
    expect(view.equipped).toBe('grad')
    state.unlockHat('captain')
    expect(view.equip('captain')).toBe(true)
    expect(state.save.hat).toBe('captain')
    expect(view.equipped).toBe('captain')
  })
})

describe('mini-game credit', () => {
  let toasts: Toast[]
  let unsub: () => void

  beforeEach(() => {
    toasts = []
    unsub = events.on('ui:toast', (t) => toasts.push(t))
  })
  afterEach(() => unsub())

  it('hands the quest out at the cabinet and keeps the best run', () => {
    const { state } = mk()
    expect(state.quests.isStarted('studyhall')).toBe(false)
    state.minigamePlayed('studyhall', 3)
    expect(state.quests.isStarted('studyhall')).toBe(true)
    expect(state.quests.progress('studyhall')).toEqual({ done: 3, total: 5 })
    state.minigamePlayed('studyhall', 1) // a worse run never takes progress away
    expect(state.quests.progress('studyhall')).toEqual({ done: 3, total: 5 })
    expect(state.quests.isDone('studyhall')).toBe(false)
  })

  it('finishes the quest, the badge and the cap on the winning run', () => {
    const { state } = mk()
    state.minigameWon('studyhall', 5)
    expect(state.quests.isDone('studyhall')).toBe(true)
    expect(state.ach.has('ach_studyhall')).toBe(true)
    expect(state.hasHat('grad')).toBe(true)
    expect(state.save.hat).toBe('grad')
  })

  it('says nothing about a quest for a score that has not moved', () => {
    const { state } = mk()
    toasts.length = 0 // the auto-started errands announce themselves at construction
    state.minigamePlayed('cargo', 0)
    expect(state.quests.isStarted('cargo')).toBe(true)
    expect(state.quests.progress('cargo')).toEqual({ done: 0, total: 6 })
    expect(toasts.filter((t) => t.kind === 'quest').map((t) => t.title)).toEqual(['New quest'])
  })

  it('will not let a quit answer a yes/no step, however far up the tower it got', () => {
    const { state } = mk()
    state.minigamePlayed('climb', 3) // three floors climbed, then a dismissal
    expect(state.quests.isStarted('climb')).toBe(true) // the errand is still handed out
    expect(state.quests.isDone('climb')).toBe(false)
    expect(state.quests.progress('climb')).toEqual({ done: 0, total: 1 })
    expect(state.hasHat('hardhat')).toBe(false)
    expect(state.flag('tower_express')).toBe(false)

    state.minigameWon('climb', 0) // a win answers it, whatever number it reports
    expect(state.quests.isDone('climb')).toBe(true)
    expect(state.flag('tower_express')).toBe(true)
  })

  it('still credits a part-finished run of a counted game', () => {
    const { state } = mk()
    state.minigamePlayed('packetrush', 12)
    expect(state.quests.progress('packetrush')).toEqual({ done: 12, total: 30 })
    expect(state.quests.isDone('packetrush')).toBe(false)
  })

  it('survives a win from a game that has not been built yet', () => {
    const { state } = mk()
    expect(() => state.minigameWon('climb', 1)).not.toThrow()
    expect(state.quests.isDone('climb')).toBe(true)
    expect(state.ach.has('ach_climb')).toBe(true)
    expect(state.hasHat('hardhat')).toBe(true) // the quest reward, not a game payout
    expect(state.flag('tower_express')).toBe(true) // …and the route it opens
  })

  it('crowns the arcade only once all four cabinets are beaten', () => {
    const { state } = mk()
    for (const id of ARCADE_GAMES.slice(0, 3)) state.minigameWon(id, 30)
    expect(state.ach.has('arcade')).toBe(false)
    state.minigameWon(ARCADE_GAMES[3], 30)
    expect(state.ach.has('arcade')).toBe(true)
  })

  it('leaves an unknown mini-game alone', () => {
    const { state } = mk()
    expect(() => state.minigameWon('pinball', 9)).not.toThrow()
    expect(state.save.minigames.pinball.won).toBe(true)
    expect(state.ach.has('arcade')).toBe(false)
  })
})

describe('Packet Rush credit', () => {
  let toasts: Toast[]
  let unsub: () => void

  beforeEach(() => {
    toasts = []
    unsub = events.on('ui:toast', (t) => toasts.push(t))
  })
  afterEach(() => unsub())

  it('pays five real packets down the same pathway a world packet takes', () => {
    const { state } = mk()
    state.minigameWon('packetrush', 30)
    expect(state.save.packets).toEqual([...RUSH_PACKET_IDS])
    expect(state.quests.progress('packets')).toEqual({ done: 5, total: 20 })
    expect(state.xp.xp).toBeGreaterThan(0)
    // one line about the five, not five lines about one
    expect(toasts.filter((t) => t.title === '5 packets recovered').length).toBe(1)
  })

  it('never pays the same synthetic packet twice', () => {
    const { state } = mk()
    state.minigameWon('packetrush', 30)
    state.minigameWon('packetrush', 40)
    expect(state.save.packets.length).toBe(5)
    expect(state.quests.progress('packets').done).toBe(5)
  })

  it('leaves twenty-five packets on the table for the twenty the Vault wants', () => {
    expect(BLUEPRINT.packetSpots.length + RUSH_PACKET_IDS.length).toBe(25)
    expect(QUESTS.find((q) => q.id === 'packets')!.steps[0].target).toBe(20)
    const { state } = mk()
    for (let i = 0; i < 15; i++) state.collectPacket(`p${i}`)
    expect(state.ach.has('archivist')).toBe(false)
    state.minigameWon('packetrush', 30) // 15 + 5 = the twenty the seal counts
    expect(state.save.packets.length).toBe(20)
    expect(state.ach.has('archivist')).toBe(true)
    expect(state.quests.isDone('packets')).toBe(true)
  })
})

describe('100%', () => {
  const everything = (): Save => {
    const save = defaultSave()
    save.discoveries = ZONES.map((z) => z.id)
    for (const q of QUESTS) save.quests[q.id] = { started: true, done: true, progress: {} }
    save.achievements = ACHIEVEMENTS.filter((a) => a.id !== 'complete').map((a) => a.id)
    return save
  }

  it('wants all eight landmarks, not seven', () => {
    const save = everything()
    save.discoveries = save.discoveries.slice(0, 7)
    const { state } = mk(save)
    state.checkComplete()
    expect(state.ach.has('complete')).toBe(false)

    const done = mk(everything())
    done.state.checkComplete()
    expect(done.state.ach.has('complete')).toBe(true)
  })

  it('puts the crown on and keeps it in the wardrobe', () => {
    const { state, worn } = mk(everything())
    state.checkComplete()
    expect(state.save.hat).toBe('crown')
    expect(state.hasHat('crown')).toBe(true)
    expect(worn).toEqual(['crown'])
  })

  it('counts the badge list rather than a number typed into the code', () => {
    const save = everything()
    save.achievements = save.achievements.slice(0, -1) // one badge short
    const { state } = mk(save)
    state.checkComplete()
    expect(state.ach.has('complete')).toBe(false)
  })
})

describe('loading a save', () => {
  it('raises no toast for badges earned in an earlier session', () => {
    const save = defaultSave()
    save.achievements = ACHIEVEMENTS.map((a) => a.id)
    for (const q of QUESTS) save.quests[q.id] = { started: true, done: false, progress: {} }
    const toasts: Toast[] = []
    const unsub = events.on('ui:toast', (t) => toasts.push(t))
    new GameState(save)
    unsub()
    expect(toasts).toEqual([])
  })
})

describe('pause menu', () => {
  let state: GameState

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    initPanels()
    initPause()
    initMap()
    state = new GameState(null)
    uiState.wardrobe = state.wardrobeView()
    uiState.flags = state.save.flags
    uiState.stats.discoveries = state.save.discoveries
  })
  afterEach(() => closeAllModals())

  const rows = () => all<HTMLButtonElement>('.pause .mbtn').map((b) => b.dataset.act)

  it('offers a wardrobe and the credits', () => {
    openPause()
    expect(rows()).toEqual(['resume', 'map', 'journal', 'wardrobe', 'settings', 'reader', 'controls', 'credits', 'title'])
  })

  it('opens the credits panel that nothing used to reach', () => {
    openPause()
    q<HTMLButtonElement>('[data-act="credits"]')!.click()
    expect(topModalId()).toBe('credits')
    expect(q('.credits')).toBeTruthy()
  })

  it('opens the wardrobe', () => {
    openPause()
    q<HTMLButtonElement>('[data-act="wardrobe"]')!.click()
    expect(topModalId()).toBe('wardrobe')
  })
})

describe('wardrobe panel', () => {
  let state: GameState
  let worn: string[]

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    initPanels()
    initPause()
    const made = mk()
    state = made.state
    worn = made.worn
    state.unlockHat('grad')
    state.unlockHat('captain')
    uiState.wardrobe = state.wardrobeView()
    events.emit('ui:panel', { id: 'wardrobe' })
  })
  afterEach(() => closeAllModals())

  const options = () => all<HTMLButtonElement>('.wr-opt')

  it('lists bare-headed first, then every hat you own', () => {
    expect(options().map((b) => b.dataset.hat)).toEqual(['', 'grad', 'captain'])
    expect(options()[1].textContent).toContain('Graduation cap')
  })

  it('marks the hat you are wearing', () => {
    expect(options().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
  })

  it('equips the hat you pick', () => {
    options()[2].click()
    expect(state.save.hat).toBe('captain')
    expect(worn).toEqual(['grad', 'captain'])
    expect(options().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
  })

  it('takes the hat off again', () => {
    options()[0].click()
    expect(state.save.hat).toBe('')
    expect(options()[0].getAttribute('aria-pressed')).toBe('true')
  })

  it('walks the rack with the arrows and equips with Enter', () => {
    expect(document.activeElement).toBe(options()[1]) // the worn hat has the focus
    key('ArrowDown')
    expect(document.activeElement).toBe(options()[2])
    key('Enter')
    expect(state.save.hat).toBe('captain')
    key('ArrowUp')
    key('ArrowUp')
    expect(document.activeElement).toBe(options()[0])
  })

  it('says so when there is nothing on the rack yet', () => {
    closeAllModals()
    const bare = new GameState(null)
    uiState.wardrobe = bare.wardrobeView()
    events.emit('ui:panel', { id: 'wardrobe' })
    expect(options().map((b) => b.dataset.hat)).toEqual([''])
    expect(q('.wr-empty')?.textContent).toContain('hat')
  })
})

describe('map fast travel', () => {
  let state: GameState

  beforeEach(() => {
    document.body.innerHTML = '<div id="game-root"></div><div id="ui"></div>'
    document.body.className = ''
    uiState.settings.reducedMotion = true
    initPanels()
    initMap()
    state = new GameState(null)
    uiState.flags = state.save.flags
    uiState.stats.discoveries = state.save.discoveries
  })
  afterEach(() => closeAllModals())

  it('registers the Tower Express against a flag the climb will set', () => {
    const express = FAST_TRAVEL.find((f) => f.flag === 'tower_express')!
    expect(express.label).toBe('Tower Express')
    expect(BLUEPRINT.landmarks.some((l) => l.id === express.id)).toBe(true)
  })

  it('hides the route until the flag lands', () => {
    openMap()
    expect(all('.map-express-btn').length).toBe(0)
  })

  it('offers the route once the flag lands, and travels on it', () => {
    state.setFlag('tower_express')
    const seen: string[] = []
    const unsub = events.on('world:travel', ({ id }) => seen.push(id))
    openMap()
    const btn = all<HTMLButtonElement>('.map-express-btn')
    expect(btn.length).toBe(1)
    expect(btn[0].textContent).toContain('Tower Express')
    btn[0].click()
    unsub()
    expect(seen).toEqual([FAST_TRAVEL[0].id])
  })
})
