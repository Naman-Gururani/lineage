import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { DECRYPT } from '../data/content'
import { sound } from '../lib/sound'
import { burstFrom } from '../lib/particles'
import { useGame } from '../state/game'

const A = 'A'.charCodeAt(0)
const STEPS = 26
const caesar = (str: string, shift: number) =>
  str.replace(/[A-Z]/g, (ch) =>
    String.fromCharCode((((ch.charCodeAt(0) - A + shift) % 26) + 26) % 26 + A),
  )

export function DecryptGame({ onWin }: { onWin: () => void }) {
  const { reduced } = useGame()
  const plain = DECRYPT.plain.toUpperCase()
  const k = useMemo(() => 1 + ((Math.random() * 24) | 0), [])
  const encrypted = useMemo(() => caesar(plain, k), [plain, k])
  const [d, setD] = useState(0)
  const [solved, setSolved] = useState(false)
  const dialRef = useRef<HTMLDivElement>(null)

  const display = caesar(encrypted, (STEPS - (d % STEPS)) % STEPS)

  const commit = (nd: number) => {
    if (solved) return
    const v = (((nd % STEPS) + STEPS) % STEPS)
    setD(v)
    if (v === k) {
      setSolved(true)
      sound.correct()
      if (!reduced) burstFrom(dialRef.current, { count: 64, power: 10 })
      window.setTimeout(onWin, 1150)
    } else {
      sound.type()
    }
  }

  const rotate = (delta: number) => commit(d + delta)

  const onPointer = (e: RPointerEvent) => {
    if (solved || e.buttons === 0) return
    const el = dialRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const ang = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
    let norm = (ang + Math.PI / 2) / (Math.PI * 2)
    norm = ((norm % 1) + 1) % 1
    commit(Math.round(norm * STEPS))
  }

  return (
    <div className={`decrypt ${solved ? 'is-solved' : ''}`}>
      <p className="game-intro">
        Rotate the dial to decode the intercepted string. Drag the ring, tap ◀ ▶, or use the arrow
        keys.
      </p>

      <div className={`decrypt-readout ${solved ? 'ok' : ''}`} aria-live="polite">
        <span className="decrypt-text mono">{display}</span>
        {solved && <span className="decrypt-stamp pixel t-green">DECRYPTED</span>}
      </div>

      <div className="decrypt-dialwrap">
        <button type="button" className="decrypt-arrow" onClick={() => rotate(-1)} aria-label="Rotate left">
          ◀
        </button>

        <div
          className="decrypt-dial"
          ref={dialRef}
          role="slider"
          tabIndex={0}
          aria-label="Cipher dial — rotate to decode"
          aria-valuemin={0}
          aria-valuemax={25}
          aria-valuenow={d}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault()
              rotate(-1)
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault()
              rotate(1)
            }
          }}
        >
          <svg viewBox="0 0 200 200" className="decrypt-svg">
            <circle cx="100" cy="100" r="86" className="dial-ring" />
            {Array.from({ length: STEPS }).map((_, i) => {
              const a = (i / STEPS) * Math.PI * 2 - Math.PI / 2
              return (
                <line
                  key={i}
                  x1={100 + Math.cos(a) * 78}
                  y1={100 + Math.sin(a) * 78}
                  x2={100 + Math.cos(a) * 86}
                  y2={100 + Math.sin(a) * 86}
                  className={`dial-tick ${i === d ? 'on' : ''}`}
                />
              )
            })}
            <g className="dial-needle" transform={`rotate(${(d / STEPS) * 360} 100 100)`}>
              <line x1="100" y1="100" x2="100" y2="24" />
              <circle cx="100" cy="24" r="7" />
            </g>
            <circle cx="100" cy="100" r="11" className="dial-hub" />
          </svg>
          <span className="dial-num pixel">{String(d).padStart(2, '0')}</span>
        </div>

        <button type="button" className="decrypt-arrow" onClick={() => rotate(1)} aria-label="Rotate right">
          ▶
        </button>
      </div>

      <p className="decrypt-hint mono">hint — {DECRYPT.hint}</p>
    </div>
  )
}
