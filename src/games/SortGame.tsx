import { useEffect, useReducer, useRef, useState } from 'react'
import { SKILLS, SKILL_CATS, type SkillCat } from '../data/content'
import { sound } from '../lib/sound'
import { burst } from '../lib/particles'
import { useGame } from '../state/game'

type Token = { id: number; name: string; cat: SkillCat; y: number }

const TARGET = 10
const CATS = SKILL_CATS.map((c) => c.key)

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function SortGame({ onWin }: { onWin: () => void }) {
  const { reduced } = useGame()
  const [score, setScore] = useState(0)
  const [lag, setLag] = useState(0)
  const [collected, setCollected] = useState<Set<string>>(new Set())
  const [won, setWon] = useState(false)
  const [flash, setFlash] = useState<SkillCat | null>(null)

  // --- motion version state ---
  const tokensRef = useRef<Token[]>([])
  const elMap = useRef(new Map<number, HTMLDivElement | null>())
  const fieldRef = useRef<HTMLDivElement>(null)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const gv = useRef({ spawnT: 0, idSeq: 1, queue: shuffled(SKILLS), qi: 0, speed: 90, won: false })
  const scoreRef = useRef(0)

  // --- reduced-motion (static) version state ---
  const [queue] = useState(() => shuffled(SKILLS))
  const [qi, setQi] = useState(0)

  const winNow = () => {
    setWon(true)
    gv.current.won = true
    sound.win()
    const f = fieldRef.current
    if (f) {
      const r = f.getBoundingClientRect()
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 80, power: 12 })
    }
    window.setTimeout(onWin, 1200)
  }

  const award = (name: string) => {
    setCollected((s) => new Set(s).add(name))
    setScore((s) => s + 1)
  }

  useEffect(() => {
    scoreRef.current = score
    if (score >= TARGET && !won) winNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score])

  const pop = (cat: SkillCat) => {
    setFlash(cat)
    window.setTimeout(() => setFlash(null), 200)
  }

  // ---------- MOTION VERSION ----------
  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = 0
    const remove = (id: number) => {
      tokensRef.current = tokensRef.current.filter((t) => t.id !== id)
      elMap.current.delete(id)
      force()
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (gv.current.won) return
      if (!last) last = now
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const field = fieldRef.current
      const H = field ? field.clientHeight : 360
      const binLine = H - 66
      gv.current.speed = 88 + scoreRef.current * 7

      // spawn
      gv.current.spawnT -= dt * 1000
      if (gv.current.spawnT <= 0 && tokensRef.current.length < 4) {
        const q = gv.current.queue
        const s = q[gv.current.qi % q.length]
        gv.current.qi++
        tokensRef.current.push({ id: gv.current.idSeq++, name: s.name, cat: s.cat, y: -10 })
        gv.current.spawnT = Math.max(620, 1180 - scoreRef.current * 55)
        force()
      }

      // advance + miss
      for (const t of tokensRef.current.slice()) {
        t.y += gv.current.speed * dt
        const el = elMap.current.get(t.id)
        if (el) el.style.transform = `translate(-50%, ${t.y}px)`
        if (t.y > binLine) {
          remove(t.id)
          setLag((l) => l + 1)
          sound.wrong()
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const classifyMotion = (cat: SkillCat) => {
    if (gv.current.won || !tokensRef.current.length) return
    // active = lowest token
    const active = tokensRef.current.reduce((a, b) => (b.y > a.y ? b : a))
    const el = elMap.current.get(active.id)
    tokensRef.current = tokensRef.current.filter((t) => t.id !== active.id)
    elMap.current.delete(active.id)
    force()
    if (active.cat === cat) {
      sound.correct()
      pop(cat)
      if (el) {
        const r = el.getBoundingClientRect()
        if (!reduced) burst(r.left + r.width / 2, r.top + r.height / 2, { count: 16, power: 6 })
      }
      award(active.name)
    } else {
      sound.wrong()
      setLag((l) => l + 1)
      setFlash(cat)
      window.setTimeout(() => setFlash(null), 220)
    }
  }

  // ---------- STATIC (reduced-motion) VERSION ----------
  const current = queue[qi % queue.length]
  const classifyStatic = (cat: SkillCat) => {
    if (won) return
    if (current.cat === cat) {
      sound.correct()
      pop(cat)
      award(current.name)
    } else {
      sound.wrong()
      setLag((l) => l + 1)
      setFlash(cat)
      window.setTimeout(() => setFlash(null), 220)
    }
    setQi((i) => i + 1)
  }

  const classify = reduced ? classifyStatic : classifyMotion

  // keyboard 1/2/3
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, a: 0, s: 1, d: 2 }
      const idx = map[e.key.toLowerCase()]
      if (idx !== undefined) {
        e.preventDefault()
        classify(CATS[idx])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, won, qi, score])

  return (
    <div className="sort">
      <div className="sort-hud">
        <span className="pixel">
          PROCESSED <span className="t-gold">{String(score).padStart(2, '0')}</span>/{TARGET}
        </span>
        <span className="sort-lag" aria-label={`Backpressure ${lag}`}>
          <span className="pixel t-coral">LAG</span>
          <span className="sort-lagbar">
            <span style={{ width: `${Math.min(100, (lag / 6) * 100)}%` }} />
          </span>
        </span>
      </div>

      <p className="game-intro">
        {reduced
          ? 'Send each token to its correct lane. Tap a lane or press 1 / 2 / 3.'
          : 'Route the stream in real time — send each falling token to its lane before it drops. Tap a lane or press 1 / 2 / 3.'}
      </p>

      <div className={`sort-field ${reduced ? 'is-static' : ''}`} ref={fieldRef}>
        {reduced ? (
          <div className="sort-static-token" key={qi}>
            {!won && <span className="token">{current.name}</span>}
          </div>
        ) : (
          tokensRef.current.map((t) => (
            <div
              key={t.id}
              className="token"
              ref={(el) => {
                elMap.current.set(t.id, el)
                if (el) el.style.transform = `translate(-50%, ${t.y}px)`
              }}
            >
              {t.name}
            </div>
          ))
        )}
        {won && <div className="sort-win pixel t-green">STREAM CLEARED ✓</div>}
      </div>

      <div className="sort-bins" role="group" aria-label="Lanes">
        {SKILL_CATS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            className={`sort-bin bin-${c.key} ${flash === c.key ? 'flash' : ''}`}
            onClick={() => classify(c.key)}
            aria-label={`Lane ${c.label}`}
          >
            <span className="sort-bin-key pixel">{i + 1}</span>
            <span className="sort-bin-label">{c.short}</span>
            <span className="sort-bin-count mono">
              {[...collected].filter((n) => SKILLS.find((s) => s.name === n)?.cat === c.key).length}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
