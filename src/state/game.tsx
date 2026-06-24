import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { ModuleId } from '../data/content'
import { useReducedMotion } from '../lib/useReducedMotion'
import { sound } from '../lib/sound'

const GATED: ModuleId[] = ['experience', 'skills', 'projects']
const ALL: ModuleId[] = [...GATED, 'contact']
const KEY = 'naman.sys.v1'

type Saved = { unlocked?: ModuleId[]; muted?: boolean; started?: boolean }
function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Saved
  } catch {
    return {}
  }
}

type GameValue = {
  unlocked: Set<ModuleId>
  isUnlocked: (id: ModuleId) => boolean
  unlock: (id: ModuleId) => void
  revealAll: () => void
  reset: () => void
  muted: boolean
  toggleMute: () => void
  started: boolean
  start: () => void
  access: number
  reduced: boolean
}

const GameContext = createContext<GameValue>(null as unknown as GameValue)
export const useGame = () => useContext(GameContext)

export function GameProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const [unlocked, setUnlocked] = useState<Set<ModuleId>>(() => new Set(load().unlocked ?? []))
  const [muted, setMuted] = useState<boolean>(() => Boolean(load().muted))
  const [started, setStarted] = useState<boolean>(() => Boolean(load().started))

  useEffect(() => {
    sound.setMuted(muted)
  }, [muted])

  // contact opens automatically once the three gated modules are unlocked
  useEffect(() => {
    if (GATED.every((g) => unlocked.has(g)) && !unlocked.has('contact')) {
      setUnlocked((s) => new Set(s).add('contact'))
    }
  }, [unlocked])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ unlocked: [...unlocked], muted, started }))
    } catch {
      /* ignore */
    }
  }, [unlocked, muted, started])

  const unlock = useCallback((id: ModuleId) => {
    setUnlocked((s) => {
      if (s.has(id)) return s
      const n = new Set(s)
      n.add(id)
      return n
    })
  }, [])

  const revealAll = useCallback(() => setUnlocked(new Set(ALL)), [])
  const reset = useCallback(() => {
    setUnlocked(new Set())
    setStarted(false)
  }, [])
  const toggleMute = useCallback(() => setMuted((m) => !m), [])
  const start = useCallback(() => {
    sound.resume()
    setStarted(true)
  }, [])

  const access = GATED.filter((g) => unlocked.has(g)).length / GATED.length

  return (
    <GameContext.Provider
      value={{
        unlocked,
        isUnlocked: (id) => unlocked.has(id),
        unlock,
        revealAll,
        reset,
        muted,
        toggleMute,
        started,
        start,
        access,
        reduced,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
