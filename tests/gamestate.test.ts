// @vitest-environment happy-dom
// The save-side wiring: one wardrobe (owned vs worn), the résumé chapters a
// mini-game win hands over and the story steps they credit, and the pause-menu
// rows that surface all of it.
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
import { ARCADE_GAMES, GameState, MINIGAME_XP } from '../src/systems/GameState'
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

/** What `onAchievement` pays for any badge — see `GameState.onAchievement`. */
const ACH_XP = 25

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
    // Pre-wardrobe: the shell errand and Mira's dare both finished, so both caps
    // were earned, but only the last one granted was ever written down — and
    // Chalk Flight was won on top of that.
    const save = defaultSave()
    save.hat = 'captain'
    save.quests.shells = { started: true, done: true, progress: {} }
    save.quests.crew = { started: true, done: true, progress: {} }
    save.minigames.flappy = { won: true, best: 5, plays: 1 }
    const toasts: Toast[] = []
    const unsub = events.on('ui:toast', (t) => toasts.push(t))
    const { state } = mk(save)
    unsub()
    expect(state.save.hats.sort()).toEqual(['captain', 'grad', 'seashell'])
    expect(state.save.hat).toBe('captain') // recovery owns, it never re-dresses you
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

describe('chapters', () => {
  let seen: Events['facet:unlocked'][]
  let unsubFacet: () => void

  beforeEach(() => {
    seen = []
    unsubFacet = events.on('facet:unlocked', (p) => seen.push(p))
  })
  afterEach(() => unsubFacet())

  it('starts with only Contact readable', () => {
    const { state } = mk()
    expect(state.isUnlocked('contact')).toBe(true)
    expect(state.isUnlocked('experience')).toBe(false)
    expect(state.isUnlocked('about')).toBe(false)
  })

  it('unlocks a chapter once, credits its story step and says so', () => {
    const { state } = mk()
    const toasts: Toast[] = []
    const unsub = events.on('ui:toast', (t) => toasts.push(t))
    expect(state.unlockFacet('experience')).toBe(true)
    expect(state.unlockFacet('experience')).toBe(false)
    unsub()
    expect(state.save.unlocked).toEqual(['experience'])
    expect(state.quests.stepProgress('story', 'experience')).toBe(1)
    // The tower lift only runs once you know what happened up there.
    expect(state.flag('tower_express')).toBe(true)
    expect(seen).toEqual([
      { id: 'experience', first: true, announce: true },
      { id: 'experience', first: false, announce: true },
    ])
    expect(toasts.filter((t) => t.icon === '📖' && t.title === 'New chapter: Experience').length).toBe(1)
  })

  it('says nothing about fractions of a story', () => {
    const { state } = mk()
    const toasts: Toast[] = []
    const unsub = events.on('ui:toast', (t) => toasts.push(t))
    state.unlockFacet('about')
    unsub()
    // `progress()` headlines the largest step — the three prizes — so a step
    // toast here would read "0 / 3" over a chapter that has nothing to do with
    // them. The 📖 line is the announcement; the journal holds the detail.
    const title = QUESTS.find((q) => q.id === 'story')!.title
    expect(toasts.filter((t) => t.title === title)).toEqual([])
    expect(toasts.map((t) => t.title)).toContain('New chapter: About')
  })

  it('records a free chapter as read even though it was never locked', () => {
    const { state } = mk()
    expect(state.isUnlocked('contact')).toBe(true)
    expect(state.unlockFacet('contact')).toBe(true)
    expect(state.save.unlocked).toEqual(['contact'])
    expect(state.quests.stepProgress('story', 'contact')).toBe(1)
  })

  it('counts the three prizes toward one story step, without opening three cards', () => {
    const { state } = mk()
    for (const z of ['lineage', 'safestride', 'stealth']) state.unlockFacet(z, false)
    expect(state.quests.stepProgress('story', 'projects')).toBe(3)
    expect(seen.map((p) => p.announce)).toEqual([false, false, false])
  })

  it('names the next station and finishes the story with a flag', () => {
    const { state } = mk()
    const next: (string | null)[] = []
    const unsub = events.on('story:changed', (p) => next.push(p.next))
    expect(state.storyNext()).toBe('meet')
    state.unlockFacet('about')
    expect(state.storyNext()).toBe('experience')
    for (const z of ['experience', 'lineage', 'safestride', 'stealth', 'education', 'skills', 'contact']) state.unlockFacet(z)
    unsub()
    expect(state.storyNext()).toBeNull()
    expect(state.quests.isDone('story')).toBe(true)
    expect(state.flag('story_done')).toBe(true)
    expect(state.ach.has('story')).toBe(true)
    expect(next[next.length - 1]).toBeNull()
  })

  it('throws the fireworks when the last chapter lands, and says which ending it is', () => {
    const { state } = mk()
    const parties: string[] = []
    state.handlers.celebrate = (reason) => parties.push(reason)
    for (const z of ZONES.map((z) => z.id)) state.unlockFacet(z)
    expect(state.quests.isDone('story')).toBe(true)
    // Bo's tour, not the island: the banner that follows must not claim 100%.
    expect(parties).toEqual(['story'])
  })
})

describe('mini-game payout', () => {
  let toasts: Toast[]
  let unsub: () => void

  beforeEach(() => {
    toasts = []
    unsub = events.on('ui:toast', (t) => toasts.push(t))
  })
  afterEach(() => unsub())

  it('records a play and keeps the best run, without paying for it', () => {
    const { state } = mk()
    state.minigamePlayed('flappy', 3)
    state.minigamePlayed('flappy', 1) // a worse run never takes the best away
    expect(state.save.minigames.flappy).toEqual({ won: false, best: 3, plays: 2 })
    expect(state.isUnlocked('education')).toBe(false)
    expect(state.save.hats).toEqual([])
  })

  it('a Wordle win unlocks Experience, pays XP and the badge, and no hat', () => {
    const { state } = mk()
    const before = state.xp.xp
    state.minigameWon('wordle', 5)
    expect(state.isUnlocked('experience')).toBe(true)
    expect(state.ach.has('ach_wordle')).toBe(true)
    // Exactly the round's XP plus the flat twenty-five a badge is worth — an
    // extra payout down some second path would show up here as a bigger number.
    expect(state.xp.xp - before).toBe(MINIGAME_XP.wordle + ACH_XP)
    expect(state.save.hats).toEqual([]) // the pier puzzle pays in chapters, not caps
  })

  it('hands over the chapter and the cap each of the other two games is worth', () => {
    const { state } = mk()
    state.minigameWon('flappy', 1)
    expect(state.isUnlocked('education')).toBe(true)
    expect(state.hasHat('grad')).toBe(true)
    expect(state.quests.stepProgress('story', 'education')).toBe(1)

    state.minigameWon('forge', 1)
    expect(state.isUnlocked('skills')).toBe(true)
    expect(state.hasHat('hardhat')).toBe(true)
    expect(state.quests.stepProgress('story', 'skills')).toBe(1)
  })

  it('pays the XP once, and says so the second time round', () => {
    const { state } = mk()
    state.minigameWon('wordle', 5)
    const banked = state.xp.xp
    toasts.length = 0
    state.minigameWon('wordle', 5)
    expect(state.xp.xp).toBe(banked)
    expect(state.save.minigames.wordle.plays).toBe(2)
    expect(toasts.map((t) => t.title)).toContain('Cleared it again.')
  })

  it('a claw win unlocks whatever prizes are still locked', () => {
    const { state } = mk()
    state.unlockFacet('lineage', false) // the claw opens each prize card as it is caught
    state.minigameWon('claw', 3)
    for (const z of ['lineage', 'safestride', 'stealth']) expect(state.isUnlocked(z), z).toBe(true)
    expect(state.quests.stepProgress('story', 'projects')).toBe(3)
    expect(state.hasHat('goggles')).toBe(true)
  })

  it('Crew Drop hands out and finishes Mira’s dare', () => {
    const { state } = mk()
    expect(state.quests.isStarted('crew')).toBe(false)
    state.minigamePlayed('crew', 0)
    expect(state.quests.isActive('crew')).toBe(true)
    expect(state.quests.isDone('crew')).toBe(false)
    state.minigameWon('crew', 1)
    expect(state.quests.isDone('crew')).toBe(true)
    expect(state.hasHat('captain')).toBe(true)
    expect(state.ach.has('ach_crew')).toBe(true)
  })

  it('hands Mira’s dare out on a win too, for the player who never quit one', () => {
    const { state } = mk()
    state.minigameWon('crew', 1)
    expect(state.quests.isDone('crew')).toBe(true)
  })

  it('gates no chapter behind the arcade game', () => {
    const { state } = mk()
    state.minigameWon('crew', 1)
    expect(state.save.unlocked).toEqual([])
  })

  it('crowns the arcade only once all five games are beaten', () => {
    const { state } = mk()
    for (const id of ARCADE_GAMES.slice(0, -1)) state.minigameWon(id, 1)
    expect(state.ach.has('arcade')).toBe(false)
    state.minigameWon(ARCADE_GAMES[ARCADE_GAMES.length - 1], 1)
    expect(state.ach.has('arcade')).toBe(true)
  })

  it('leaves an unknown mini-game alone', () => {
    const { state } = mk()
    expect(() => state.minigameWon('pinball', 9)).not.toThrow()
    expect(state.save.minigames.pinball.won).toBe(true)
    expect(state.ach.has('arcade')).toBe(false)
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

  it('throws the other fireworks — the ones that really are a hundred per cent', () => {
    const { state } = mk(everything())
    const parties: string[] = []
    state.handlers.celebrate = (reason) => parties.push(reason)
    state.checkComplete()
    expect(state.ach.has('complete')).toBe(true)
    expect(parties).toEqual(['complete'])
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

  it('registers the Tower Express against the flag the Experience chapter sets', () => {
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
