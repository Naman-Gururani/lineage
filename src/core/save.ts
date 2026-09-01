// Save game + settings persistence. Pure over a Storage-like object so it can
// be tested in Node; defaults to localStorage in the browser.

export type QuestSave = { started: boolean; done: boolean; progress: Record<string, number> }

export type MinigameSave = { won: boolean; best: number; plays: number }

export type Save = {
  v: 2
  x: number
  y: number
  scene: string
  time: number
  weather: 'clear' | 'breezy' | 'rain'
  discoveries: string[]
  packets: string[]
  chests: string[]
  grassCut: number
  quests: Record<string, QuestSave>
  achievements: string[]
  xp: number
  hat: string
  flags: Record<string, number>
  inventory: Record<string, number>
  visitedRegions: string[]
  talked: string[]
  stats: { steps: number; playSeconds: number; fishCaught: number; bonks: number }
  tutorialDone: boolean
  /** every hat unlocked so far; `hat` is the one being worn */
  hats: string[]
  minigames: Record<string, MinigameSave>
  /** species id → how many of it have been landed */
  fish: Record<string, number>
  welcomeSeen: boolean
}

export type Settings = {
  master: number
  music: number
  sfx: number
  textSpeed: 'slow' | 'normal' | 'fast'
  shake: boolean
  reducedMotion: boolean
  touch: 'auto' | 'on' | 'off'
  minimap: boolean
  alwaysRun: boolean
}

const SAVE_KEY = 'nw2.save.v2'
/** v1 islands were a different shape; saves from them are dropped, not migrated. */
const LEGACY_SAVE_KEY = 'nw2.save.v1'
const SETTINGS_KEY = 'nw2.settings.v1'

function store(s?: Storage): Storage | null {
  if (s) return s
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function defaultSave(): Save {
  return {
    v: 2,
    x: 0,
    y: 0,
    scene: 'world',
    time: 60,
    weather: 'clear',
    discoveries: [],
    packets: [],
    chests: [],
    grassCut: 0,
    quests: {},
    achievements: [],
    xp: 0,
    hat: '',
    flags: {},
    inventory: {},
    visitedRegions: [],
    talked: [],
    stats: { steps: 0, playSeconds: 0, fishCaught: 0, bonks: 0 },
    tutorialDone: false,
    hats: [],
    minigames: {},
    fish: {},
    welcomeSeen: false,
  }
}

export function defaultSettings(): Settings {
  let reduced = false
  try {
    reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false
  } catch {
    reduced = false
  }
  return {
    master: 0.8,
    music: 0.6,
    sfx: 0.8,
    textSpeed: 'normal',
    shake: true,
    reducedMotion: reduced,
    touch: 'auto',
    minimap: true,
    alwaysRun: true,
  }
}

const isArr = (v: unknown) => Array.isArray(v)
const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)

export function migrate(raw: unknown): Save | null {
  if (!isObj(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.v !== 2) return null
  const d = defaultSave()
  const out: Save = { ...d }
  const num = (k: keyof Save) => {
    if (typeof r[k] === 'number' && isFinite(r[k] as number)) (out as unknown as Record<string, unknown>)[k] = r[k]
  }
  const str = (k: keyof Save) => {
    if (typeof r[k] === 'string') (out as unknown as Record<string, unknown>)[k] = r[k]
  }
  const arr = (k: keyof Save) => {
    if (isArr(r[k])) (out as unknown as Record<string, unknown>)[k] = (r[k] as unknown[]).filter((v) => typeof v === 'string')
  }
  const obj = (k: keyof Save) => {
    if (isObj(r[k])) (out as unknown as Record<string, unknown>)[k] = r[k]
  }
  num('x')
  num('y')
  num('time')
  num('grassCut')
  num('xp')
  str('scene')
  str('hat')
  if (r.weather === 'clear' || r.weather === 'breezy' || r.weather === 'rain') out.weather = r.weather
  arr('discoveries')
  arr('packets')
  arr('chests')
  arr('achievements')
  arr('visitedRegions')
  arr('talked')
  arr('hats')
  obj('quests')
  obj('flags')
  obj('inventory')
  obj('minigames')
  obj('fish')
  if (isObj(r.stats)) out.stats = { ...d.stats, ...(r.stats as Save['stats']) }
  if (typeof r.tutorialDone === 'boolean') out.tutorialDone = r.tutorialDone
  if (typeof r.welcomeSeen === 'boolean') out.welcomeSeen = r.welcomeSeen
  return out
}

/**
 * True when a pre-reshape save is still sitting in storage. The island changed
 * shape, so those saves are dropped — the world greets the player with a
 * "fresh start" toast instead of silently losing their progress.
 */
export function hadV1Save(s?: Storage): boolean {
  const st = store(s)
  if (!st) return false
  try {
    return st.getItem(LEGACY_SAVE_KEY) !== null
  } catch {
    return false
  }
}

export function loadSave(s?: Storage): Save | null {
  const st = store(s)
  if (!st) return null
  const raw = st.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    return migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeSave(save: Save, s?: Storage): void {
  const st = store(s)
  if (!st) return
  try {
    st.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    /* quota / private mode: ignore */
  }
}

export function clearSave(s?: Storage): void {
  const st = store(s)
  if (!st) return
  st.removeItem(SAVE_KEY)
  st.removeItem(LEGACY_SAVE_KEY)
}

export function loadSettings(s?: Storage): Settings {
  const d = defaultSettings()
  const st = store(s)
  if (!st) return d
  const raw = st.getItem(SETTINGS_KEY)
  if (!raw) return d
  try {
    const parsed = JSON.parse(raw)
    return isObj(parsed) ? { ...d, ...(parsed as Partial<Settings>) } : d
  } catch {
    return d
  }
}

export function writeSettings(settings: Settings, s?: Storage): void {
  const st = store(s)
  if (!st) return
  try {
    st.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}
