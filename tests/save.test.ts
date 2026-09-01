import { describe, expect, it } from 'vitest'
import { clearSave, defaultSave, defaultSettings, loadSave, loadSettings, migrate, writeSave, writeSettings } from '../src/core/save'

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

  it('migrate rejects unknown versions and corrupt data', () => {
    expect(migrate({ v: 99 })).toBeNull()
    expect(migrate('nonsense')).toBeNull()
    expect(migrate(null)).toBeNull()
  })

  it('migrate fills missing fields with defaults', () => {
    const m = migrate({ v: 1, x: 5 })
    expect(m).not.toBeNull()
    expect(m!.x).toBe(5)
    expect(m!.packets).toEqual([])
    expect(m!.xp).toBe(0)
  })

  it('ignores corrupt stored JSON', () => {
    const store = memStorage()
    store.setItem('nw2.save.v1', '{oops')
    expect(loadSave(store)).toBeNull()
  })
})

describe('settings', () => {
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
})
