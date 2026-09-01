// The in-game day: a pure model of time-of-day → phase / light / colour.
// One day is 480 s: dawn 45 s, day 240 s, dusk 45 s, night 150 s.

export const DAY_LENGTH = 480

export type Phase = 'dawn' | 'day' | 'dusk' | 'night'

export const PHASES: { phase: Phase; start: number; end: number }[] = [
  { phase: 'dawn', start: 0, end: 45 },
  { phase: 'day', start: 45, end: 285 },
  { phase: 'dusk', start: 285, end: 330 },
  { phase: 'night', start: 330, end: 480 },
]

export function wrap(t: number): number {
  return ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH
}

export function phaseAt(t: number): Phase {
  const w = wrap(t)
  for (const p of PHASES) if (w >= p.start && w < p.end) return p.phase
  return 'night'
}

const smooth = (a: number) => a * a * (3 - 2 * a)

/** 0..1 amount of sunlight. */
export function daylight(t: number): number {
  const w = wrap(t)
  if (w < 45) return smooth(w / 45)
  if (w < 285) return 1
  if (w < 330) return 1 - smooth((w - 285) / 45)
  return 0
}

/** Clock display: the day starts at 05:00 and one second is three minutes. */
export function clockOf(t: number): { h: number; m: number; label: string } {
  const minutes = 5 * 60 + Math.floor(wrap(t) * 3)
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { h, m, label: `${pad(h)}:${pad(m)}` }
}

type Key = { t: number; tint: number; dark: number }
const NIGHT = 0x6f7fc0
const DAWN = 0xffe0c8
const DAY = 0xffffff
const DUSK = 0xffc9a0
const KEYS: Key[] = [
  { t: 0, tint: NIGHT, dark: 0.72 },
  { t: 22, tint: DAWN, dark: 0.3 },
  { t: 45, tint: DAY, dark: 0 },
  { t: 285, tint: DAY, dark: 0 },
  { t: 307, tint: DUSK, dark: 0.3 },
  { t: 330, tint: NIGHT, dark: 0.72 },
  { t: 480, tint: NIGHT, dark: 0.72 },
]

export function lerpColor(a: number, b: number, f: number): number {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  const r = Math.round(ar + (br - ar) * f)
  const g = Math.round(ag + (bg - ag) * f)
  const bl = Math.round(ab + (bb - ab) * f)
  return (r << 16) | (g << 8) | bl
}

/** Colour grading for the current time: sprite tint, overlay darkness, lamp warmth. */
export function ambientAt(t: number): { tint: number; darkness: number; warmth: number } {
  const w = wrap(t)
  let i = 0
  while (i < KEYS.length - 2 && w >= KEYS[i + 1].t) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const f = b.t === a.t ? 0 : (w - a.t) / (b.t - a.t)
  const tint = lerpColor(a.tint, b.tint, f)
  const darkness = a.dark + (b.dark - a.dark) * f
  const phase = phaseAt(w)
  const warmth = Math.min(1, Math.max(0, 1 - daylight(w) + (phase === 'dusk' ? 0.15 : 0)))
  return { tint, darkness: Math.round(darkness * 1000) / 1000, warmth }
}
