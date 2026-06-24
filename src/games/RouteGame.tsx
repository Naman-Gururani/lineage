import { useMemo, useRef, useState } from 'react'
import { sound } from '../lib/sound'
import { burstFrom } from '../lib/particles'
import { useGame } from '../state/game'

type CellType = 'src' | 'sink' | 'straight' | 'elbow' | 'empty'
type Cell = { type: CellType; rot: number; fixed: boolean }

const COLS = 5
const ROWS = 3
const DELTA: [number, number][] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] // N E S W
const OPP = [2, 3, 0, 1]
const BASE: Record<CellType, number[]> = {
  src: [1],
  sink: [3],
  straight: [1, 3],
  elbow: [0, 1],
  empty: [],
}
const openings = (type: CellType, rot: number) => BASE[type].map((d) => (d + rot) % 4)

const LAYOUT: CellType[][] = [
  ['elbow', 'elbow', 'straight', 'elbow', 'empty'],
  ['src', 'elbow', 'straight', 'elbow', 'sink'],
  ['empty', 'elbow', 'straight', 'elbow', 'empty'],
]

const rndRot = () => (Math.random() * 4) | 0

function makeCells(): Cell[][] {
  return LAYOUT.map((row) =>
    row.map((type) => {
      const fixed = type === 'src' || type === 'sink' || type === 'empty'
      return { type, rot: fixed ? 0 : rndRot(), fixed }
    }),
  )
}

function connectedSet(cells: Cell[][]): Set<string> {
  let sr = -1
  let sc = -1
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (cells[r][c].type === 'src') ((sr = r), (sc = c))
  const seen = new Set<string>()
  if (sr < 0) return seen
  const q: [number, number][] = [[sr, sc]]
  seen.add(sr + ',' + sc)
  while (q.length) {
    const [r, c] = q.shift()!
    for (const d of openings(cells[r][c].type, cells[r][c].rot)) {
      const nr = r + DELTA[d][0]
      const nc = c + DELTA[d][1]
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue
      const key = nr + ',' + nc
      if (seen.has(key)) continue
      if (openings(cells[nr][nc].type, cells[nr][nc].rot).includes(OPP[d])) {
        seen.add(key)
        q.push([nr, nc])
      }
    }
  }
  return seen
}

function isSolved(cells: Cell[][]): boolean {
  const set = connectedSet(cells)
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (cells[r][c].type === 'sink') return set.has(r + ',' + c)
  return false
}

function Pipe({ type, rot, lit }: { type: CellType; rot: number; lit: boolean }) {
  const ops = openings(type, rot)
  const end: Record<number, [number, number]> = {
    0: [50, 6],
    1: [94, 50],
    2: [50, 94],
    3: [6, 50],
  }
  const big = type === 'src' || type === 'sink'
  return (
    <svg viewBox="0 0 100 100" className={`pipe ${lit ? 'lit' : ''} pipe-${type}`}>
      {ops.map((d) => (
        <line key={d} x1="50" y1="50" x2={end[d][0]} y2={end[d][1]} />
      ))}
      <circle cx="50" cy="50" r={big ? 17 : 8} className="pipe-core" />
      {big && (
        <text x="50" y="53" className="pipe-label">
          {type === 'src' ? 'IN' : 'OUT'}
        </text>
      )}
    </svg>
  )
}

export function RouteGame({ onWin }: { onWin: () => void }) {
  const { reduced } = useGame()
  const [cells, setCells] = useState<Cell[][]>(() => {
    let c = makeCells()
    let tries = 0
    while (isSolved(c) && tries++ < 40) c = makeCells()
    return c
  })
  const [solved, setSolved] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const lit = useMemo(() => connectedSet(cells), [cells])

  const rotate = (r: number, c: number) => {
    if (solved || cells[r][c].fixed) return
    sound.rotate()
    setCells((prev) => {
      const next = prev.map((row) => row.slice())
      next[r][c] = { ...next[r][c], rot: (next[r][c].rot + 1) % 4 }
      if (isSolved(next)) {
        setSolved(true)
        sound.correct()
        if (!reduced) burstFrom(gridRef.current, { count: 70, power: 11 })
        window.setTimeout(onWin, 1150)
      }
      return next
    })
  }

  return (
    <div className={`route ${solved ? 'is-solved' : ''}`}>
      <p className="game-intro">
        Rotate the pipes so the <b className="t-cyan">source</b> connects to the{' '}
        <b className="t-gold">sink</b>. Tap a pipe to turn it 90°.
      </p>
      <div className="route-grid" ref={gridRef}>
        {cells.map((row, r) =>
          row.map((cell, c) => {
            const key = r + '-' + c
            const isLit = lit.has(r + ',' + c)
            if (cell.type === 'empty') return <div key={key} className="route-cell empty" />
            if (cell.fixed)
              return (
                <div key={key} className={`route-cell node ${cell.type} ${isLit ? 'lit' : ''}`}>
                  <Pipe type={cell.type} rot={cell.rot} lit={isLit} />
                </div>
              )
            return (
              <button
                key={key}
                type="button"
                className={`route-cell pipe-btn ${isLit ? 'lit' : ''}`}
                onClick={() => rotate(r, c)}
                aria-label={`Pipe at row ${r + 1}, column ${c + 1}${isLit ? ', connected' : ''}. Rotate.`}
              >
                <Pipe type={cell.type} rot={cell.rot} lit={isLit} />
              </button>
            )
          }),
        )}
      </div>
      <p className="game-status pixel" aria-live="polite">
        {solved ? (
          <span className="t-green">CONNECTED ✓</span>
        ) : (
          <span className="t-dim">NOT CONNECTED</span>
        )}
      </p>
    </div>
  )
}
