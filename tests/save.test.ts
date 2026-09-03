import { describe, expect, it } from 'vitest'
import { clearSave, defaultSave, defaultSettings, hadLegacySave, loadSave, loadSettings, migrate, writeSave, writeSettings } from '../src/core/save'

function memStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

describe('save', () => {
  it('returns null when nothing is saved', () => {
    expect(loadSave(memStorage())).toBeNull()
  })

  it('defaults to a v4 save with no chapter unlocked yet', () => {
    const s = defaultSave()
    expect(s.v).toBe(4)
    expect(s.hats).toEqual([])
    expect(s.minigames).toEqual({})
    expect(s.fish).toEqual({})
    expect(s.welcomeSeen).toBe(false)
    expect(s.unlocked).toEqual([])
  })

  it('round-trips a save', () => {
    const store = memStorage()
    const s = defaultSave()
    s.x = 123
    s.packets.push('p3')
    s.quests.shells = { started: true, done: false, progress: { find: 2 } }
    writeSave(s, store)
    expect(loadSave(store)).toEqual(s)
  })

  it('clears', () => {
    const store = memStorage()
    writeSave(defaultSave(), store)
    clearSave(store)
    expect(loadSave(store)).toBeNull()
  })

  it('clears both stale blobs too, so a reset really is a reset', () => {
    const store = memStorage()
    store.setItem('nw2.save.v1', JSON.stringify({ v: 1 }))
    store.setItem('nw2.save.v2', JSON.stringify({ v: 2 }))
    store.setItem('nw2.save.v3', JSON.stringify({ v: 3 }))
    writeSave(defaultSave(), store)
    clearSave(store)
    expect(hadLegacySave(store)).toBe(false)
    expect(store.getItem('nw2.save.v4')).toBeNull()
  })

  it('migrate rejects unknown versions and corrupt data', () => {
    expect(migrate({ v: 99 })).toBeNull()
    expect(migrate('nonsense')).toBeNull()
    expect(migrate(null)).toBeNull()
  })

  it('migrate rejects every older payload outright', () => {
    expect(migrate({ v: 1, x: 5 })).toBeNull()
    expect(migrate({ v: 2, x: 5 })).toBeNull()
  })

  it('migrate fills missing fields with defaults', () => {
    const m = migrate({ v: 4, x: 5 })
    expect(m).not.toBeNull()
    expect(m!.x).toBe(5)
    expect(m!.packets).toEqual([])
    expect(m!.xp).toBe(0)
    expect(m!.hats).toEqual([])
    expect(m!.minigames).toEqual({})
    expect(m!.fish).toEqual({})
    expect(m!.welcomeSeen).toBe(false)
    expect(m!.unlocked).toEqual([])
  })

  it('migrate keeps the v4 collections', () => {
    const m = migrate({
      v: 4,
      hats: ['crown', 7, 'cap'],
      minigames: { crab: { won: true, best: 12, plays: 3 } },
      fish: { sardine: 2 },
      welcomeSeen: true,
      unlocked: ['experience', 9, 'skills'],
    })
    expect(m!.hats).toEqual(['crown', 'cap'])
    expect(m!.minigames).toEqual({ crab: { won: true, best: 12, plays: 3 } })
    expect(m!.fish).toEqual({ sardine: 2 })
    expect(m!.welcomeSeen).toBe(true)
    expect(m!.unlocked).toEqual(['experience', 'skills'])
  })

  it('ignores an island-shaped save from either older version and reports the upgrade', () => {
    for (const key of ['nw2.save.v1', 'nw2.save.v2', 'nw2.save.v3']) {
      const store = memStorage()
      store.setItem(key, JSON.stringify({ v: Number(key.slice(-1)), x: 900, packets: ['p1'] }))
      expect(loadSave(store), key).toBeNull()
      expect(hadLegacySave(store), key).toBe(true)
    }
  })

  it('reports no upgrade for a clean slate or a v4-only store', () => {
    const store = memStorage()
    expect(hadLegacySave(store)).toBe(false)
    writeSave(defaultSave(), store)
    expect(hadLegacySave(store)).toBe(false)
  })

  it('writes to the v4 key', () => {
    const store = memStorage()
    writeSave(defaultSave(), store)
    expect(store.getItem('nw2.save.v4')).not.toBeNull()
    expect(store.getItem('nw2.save.v3')).toBeNull()
    expect(store.getItem('nw2.save.v2')).toBeNull()
    expect(store.getItem('nw2.save.v1')).toBeNull()
  })

  it('ignores corrupt stored JSON', () => {
    const store = memStorage()
    store.setItem('nw2.save.v4', '{oops')
    expect(loadSave(store)).toBeNull()
  })
})

describe('settings', () => {
  it('runs by default', () => {
    expect(defaultSettings().alwaysRun).toBe(true)
  })

  it('is not muted by default', () => {
    expect(defaultSettings().muted).toBe(false)
  })

  it('defaults and round-trips', () => {
    const store = memStorage()
    expect(loadSettings(store)).toEqual(defaultSettings())
    const s = defaultSettings()
    s.music = 0.2
    s.textSpeed = 'fast'
    writeSettings(s, store)
    expect(loadSettings(store)).toEqual(s)
  })

  it('fills missing settings keys with defaults', () => {
    const store = memStorage()
    store.setItem('nw2.settings.v1', JSON.stringify({ music: 0.5 }))
    const s = loadSettings(store)
    expect(s.music).toBe(0.5)
    expect(s.sfx).toBe(defaultSettings().sfx)
  })

  it('loads an old settings blob with no muted key as unmuted', () => {
    const store = memStorage()
    // Shaped like a settings blob saved before the mute button existed.
    store.setItem(
      'nw2.settings.v1',
      JSON.stringify({ master: 0.5, music: 0.5, sfx: 0.5, textSpeed: 'normal', shake: true, reducedMotion: false, touch: 'auto', minimap: true, alwaysRun: true }),
    )
    expect(loadSettings(store).muted).toBe(false)
  })
})
