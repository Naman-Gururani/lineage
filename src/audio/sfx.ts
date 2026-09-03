// Generated sound effects (Web Audio, no audio files). Every sound is a few
// oscillators / noise bursts with envelopes, routed through the engine's SFX
// bus. All methods are safe no-ops until `audio.unlock()` has run (first user
// gesture) or when Web Audio is unavailable.
import { audio, noiseBuffer, type NoiseColor } from './engine'

let muted = false
/** Extra local trim on top of the settings-driven SFX bus (kept for API compatibility). */
let trim = 1
let lastStepAt = -1
const STEP_MIN_GAP = 0.09 // seconds — rapid footstep calls do not stack

/** Legacy accessor: unlocks (creates/resumes) the shared context and returns it. */
export function getCtx(): AudioContext | null {
  audio.unlock()
  return audio.ctx
}

type Out = { c: AudioContext; bus: GainNode }
function out(): Out | null {
  const c = audio.ctx
  const bus = audio.sfxBus
  if (!c || !bus || muted) return null
  return { c, bus }
}

type ToneOpts = {
  freq: number
  dur?: number
  type?: OscillatorType
  gain?: number
  slideTo?: number
  delay?: number
  attack?: number
  /** Optional lowpass cutoff for this oscillator. */
  lp?: number
  /** Detune in cents. */
  detune?: number
  /** Vibrato: rate Hz + depth Hz. */
  vib?: { rate: number; depth: number }
  /** Exponential release time constant (default: linear-ish decay to the end). */
  tail?: number
}

function tone(o: ToneOpts, dest?: Out | null) {
  const d = dest === undefined ? out() : dest
  if (!d) return
  const { c, bus } = d
  const { freq, dur = 0.12, type = 'sine', gain = 0.1, slideTo, delay = 0, attack = 0.008, lp, detune = 0, vib, tail } = o
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(1, freq), t0)
  if (detune) osc.detune.setValueAtTime(detune, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur)
  const peak = Math.max(0.0001, gain * trim)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + attack)
  if (tail) g.gain.setTargetAtTime(0.0001, t0 + attack, tail)
  else g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  let tailNode: AudioNode = g
  if (lp) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lp
    g.connect(f)
    tailNode = f
  }
  if (vib) {
    const lfo = c.createOscillator()
    const lg = c.createGain()
    lfo.frequency.value = vib.rate
    lg.gain.value = vib.depth
    lfo.connect(lg)
    lg.connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + dur + 0.5)
  }
  osc.connect(g)
  tailNode.connect(bus)
  osc.start(t0)
  osc.stop(t0 + dur + (tail ? tail * 6 : 0.05))
}

type NoiseOpts = {
  dur?: number
  gain?: number
  delay?: number
  attack?: number
  color?: NoiseColor
  filter?: BiquadFilterType
  freq?: number
  q?: number
  /** Sweep the filter frequency to this value over the duration. */
  slideTo?: number
  tail?: number
}

function noise(o: NoiseOpts, dest?: Out | null) {
  const d = dest === undefined ? out() : dest
  if (!d) return
  const { c, bus } = d
  const { dur = 0.1, gain = 0.1, delay = 0, attack = 0.005, color = 'white', filter, freq = 1000, q = 1, slideTo, tail } = o
  const t0 = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, color)
  src.loop = true
  const g = c.createGain()
  const peak = Math.max(0.0001, gain * trim)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + attack)
  if (tail) g.gain.setTargetAtTime(0.0001, t0 + attack, tail)
  else g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  let head: AudioNode = src
  if (filter) {
    const f = c.createBiquadFilter()
    f.type = filter
    f.Q.value = q
    f.frequency.setValueAtTime(freq, t0)
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(10, slideTo), t0 + dur)
    src.connect(f)
    head = f
  }
  head.connect(g)
  g.connect(bus)
  src.start(t0)
  src.stop(t0 + dur + (tail ? tail * 6 : 0.05))
}

const arp = (notes: number[], step = 0.08, gain = 0.09, type: OscillatorType = 'triangle', dur = 0.16, lastDur = dur) =>
  notes.forEach((f, i) => tone({ freq: f, dur: i === notes.length - 1 ? lastDur : dur, type, gain, delay: i * step }))

const chord = (notes: number[], delay: number, dur: number, gain: number, type: OscillatorType = 'triangle') =>
  notes.forEach((f) => tone({ freq: f, dur, type, gain, delay }))

/** Bell-like strike: a fundamental plus two decaying partials. */
function bell(freq: number, gain: number, tail: number, delay = 0) {
  tone({ freq, type: 'sine', gain, tail, dur: tail * 4, delay, attack: 0.003 })
  tone({ freq: freq * 2, type: 'sine', gain: gain * 0.4, tail: tail * 0.6, dur: tail * 3, delay, attack: 0.003 })
  tone({ freq: freq * 2.76, type: 'sine', gain: gain * 0.18, tail: tail * 0.3, dur: tail * 2, delay, attack: 0.002 })
}

function footstep(kind: 'grass' | 'sand' | 'wood' | 'stone') {
  const d = out()
  if (!d) return
  const now = d.c.currentTime
  if (now - lastStepAt < STEP_MIN_GAP) return
  lastStepAt = now
  stepFlip = !stepFlip
  const v = stepFlip ? 1 : 0.92 // alternate feet
  switch (kind) {
    case 'grass':
      noise({ dur: 0.07, gain: 0.14 * v, color: 'pink', filter: 'lowpass', freq: 700, q: 0.7 }, d)
      tone({ freq: 130 * v, slideTo: 80, dur: 0.05, type: 'sine', gain: 0.08 }, d)
      break
    case 'sand':
      noise({ dur: 0.1, gain: 0.1 * v, color: 'pink', filter: 'bandpass', freq: 900, q: 0.6, attack: 0.015 }, d)
      noise({ dur: 0.05, gain: 0.05, color: 'white', filter: 'highpass', freq: 3000, delay: 0.02 }, d)
      break
    case 'wood':
      tone({ freq: 190 * v, slideTo: 120, dur: 0.06, type: 'sine', gain: 0.16, attack: 0.002 }, d)
      noise({ dur: 0.03, gain: 0.08, color: 'white', filter: 'bandpass', freq: 1200, q: 3 }, d)
      break
    case 'stone':
      noise({ dur: 0.035, gain: 0.12 * v, color: 'white', filter: 'highpass', freq: 2500, attack: 0.001 }, d)
      noise({ dur: 0.05, gain: 0.07, color: 'white', filter: 'bandpass', freq: 3200 * v, q: 4, attack: 0.001 }, d)
      break
  }
}

let stepFlip = false

export const sfx = {
  // ---- control ---------------------------------------------------------
  setMuted(m: boolean) {
    muted = m
  },
  isMuted() {
    return muted
  },
  /** Local linear trim (multiplies the settings-driven SFX bus). */
  setVolume(v: number) {
    trim = Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 1
  },
  /** Unlock/resume the audio context — call from a user gesture. */
  resume() {
    audio.unlock()
  },

  // ---- movement --------------------------------------------------------
  step_grass: () => footstep('grass'),
  step_sand: () => footstep('sand'),
  step_wood: () => footstep('wood'),
  step_stone: () => footstep('stone'),
  step: () => footstep('grass'),
  hop() {
    tone({ freq: 340, slideTo: 720, dur: 0.11, type: 'triangle', gain: 0.07 })
  },
  bump() {
    tone({ freq: 120, slideTo: 70, dur: 0.09, type: 'sine', gain: 0.1 })
  },
  splash() {
    noise({ dur: 0.32, gain: 0.22, color: 'white', filter: 'lowpass', freq: 3200, slideTo: 450, attack: 0.01 })
    tone({ freq: 360, slideTo: 110, dur: 0.16, type: 'sine', gain: 0.09 })
    for (let i = 0; i < 3; i++) tone({ freq: 1400 - i * 250, slideTo: 800, dur: 0.035, gain: 0.03, delay: 0.14 + i * 0.06 })
  },

  // ---- actions ---------------------------------------------------------
  swing() {
    noise({ dur: 0.14, gain: 0.16, color: 'white', filter: 'bandpass', freq: 350, slideTo: 1900, q: 0.8, attack: 0.02 })
  },
  grass() {
    noise({ dur: 0.06, gain: 0.13, color: 'white', filter: 'bandpass', freq: 2200, q: 1.2 })
    noise({ dur: 0.07, gain: 0.1, color: 'white', filter: 'bandpass', freq: 2900, q: 1.2, delay: 0.055 })
  },
  cast() {
    noise({ dur: 0.2, gain: 0.12, color: 'white', filter: 'bandpass', freq: 600, slideTo: 2400, q: 1, attack: 0.03 })
    tone({ freq: 1200, slideTo: 500, dur: 0.06, gain: 0.06, delay: 0.45 })
    noise({ dur: 0.05, gain: 0.05, color: 'white', filter: 'lowpass', freq: 1500, delay: 0.46 })
  },
  reel() {
    for (let i = 0; i < 8; i++)
      noise({ dur: 0.012, gain: 0.07, color: 'white', filter: 'bandpass', freq: 2600 + i * 60, q: 6, delay: i * 0.032, attack: 0.001 })
  },
  catch() {
    tone({ freq: 300, slideTo: 660, dur: 0.12, type: 'triangle', gain: 0.08 })
    noise({ dur: 0.12, gain: 0.08, color: 'white', filter: 'lowpass', freq: 2000, slideTo: 500, delay: 0.02 })
    ;[659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: i === 2 ? 0.3 : 0.14, type: 'triangle', gain: 0.08, delay: 0.16 + i * 0.07 }))
  },

  // ---- pickups & rewards -----------------------------------------------
  coin() {
    tone({ freq: 988, dur: 0.07, type: 'triangle', gain: 0.09 })
    tone({ freq: 1319, dur: 0.26, type: 'triangle', gain: 0.09, delay: 0.06 })
  },
  pickup() {
    tone({ freq: 880, dur: 0.06, type: 'sine', gain: 0.09 })
    tone({ freq: 1320, dur: 0.1, type: 'sine', gain: 0.08, delay: 0.05 })
  },
  packet() {
    const notes = [1047, 1319, 1568, 2093, 2637]
    notes.forEach((f, i) => {
      tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.065, delay: i * 0.04 })
      tone({ freq: f, dur: 0.2, type: 'sine', gain: 0.03, delay: i * 0.04, detune: 9 })
    })
    tone({ freq: 3136, dur: 0.3, type: 'sine', gain: 0.03, delay: 0.2, tail: 0.08 })
  },
  chest() {
    noise({ dur: 0.02, gain: 0.1, color: 'white', filter: 'bandpass', freq: 3000, q: 5, attack: 0.001 })
    tone({ freq: 180, slideTo: 300, dur: 0.16, type: 'triangle', gain: 0.045, lp: 900, delay: 0.03 })
    ;[1047, 1319, 1568].forEach((f, i) => bell(f, 0.06, 0.14, 0.2 + i * 0.07))
  },
  discover() {
    arp([523, 659, 784], 0.09, 0.1, 'triangle', 0.16)
    tone({ freq: 1047, dur: 0.45, type: 'triangle', gain: 0.1, delay: 0.27 })
    tone({ freq: 2093, dur: 0.45, type: 'sine', gain: 0.03, delay: 0.27 })
  },
  levelup() {
    const notes = [523, 587, 659, 784, 880, 1047]
    notes.forEach((f, i) => tone({ freq: f, dur: i === 5 ? 0.45 : 0.14, type: 'triangle', gain: 0.09, delay: i * 0.065 }))
    tone({ freq: 1319, dur: 0.45, type: 'triangle', gain: 0.06, delay: 5 * 0.065 })
  },
  quest() {
    tone({ freq: 587, dur: 0.1, type: 'triangle', gain: 0.09 })
    tone({ freq: 784, dur: 0.32, type: 'triangle', gain: 0.09, delay: 0.09 })
    tone({ freq: 988, dur: 0.3, type: 'triangle', gain: 0.07, delay: 0.18 })
    tone({ freq: 392, dur: 0.36, type: 'sine', gain: 0.05, delay: 0.09 })
  },
  achievement() {
    chord([587, 740, 880], 0, 0.18, 0.07)
    chord([784, 988, 1175, 1568], 0.2, 0.7, 0.065)
    chord([784, 1175], 0.2, 0.7, 0.015, 'square')
  },

  // ---- world objects ---------------------------------------------------
  door() {
    noise({ dur: 0.08, gain: 0.25, color: 'brown', filter: 'lowpass', freq: 350, attack: 0.003 })
    tone({ freq: 85, slideTo: 50, dur: 0.1, type: 'sine', gain: 0.14, attack: 0.003 })
    noise({ dur: 0.015, gain: 0.08, color: 'white', filter: 'bandpass', freq: 2500, q: 4, delay: 0.09, attack: 0.001 })
  },
  open() {
    arp([523, 659, 784], 0.06, 0.09)
  },
  close() {
    tone({ freq: 659, dur: 0.07, type: 'sine', gain: 0.08 })
    tone({ freq: 440, dur: 0.1, type: 'sine', gain: 0.07, delay: 0.06 })
  },
  ding() {
    bell(1568, 0.09, 0.3)
  },
  bell() {
    bell(784, 0.1, 0.5)
    bell(1175, 0.03, 0.35, 0.01)
  },
  bonk() {
    tone({ freq: 150, slideTo: 60, dur: 0.12, type: 'sine', gain: 0.16, attack: 0.003 })
    noise({ dur: 0.025, gain: 0.08, color: 'white', filter: 'lowpass', freq: 800, attack: 0.001 })
    tone({ freq: 240, dur: 0.4, type: 'triangle', gain: 0.07, lp: 900, vib: { rate: 9, depth: 45 }, delay: 0.02 })
  },
  firework() {
    tone({ freq: 400, slideTo: 1400, dur: 0.5, type: 'sine', gain: 0.03, attack: 0.05, vib: { rate: 20, depth: 30 } })
    noise({ dur: 0.55, gain: 0.3, color: 'brown', filter: 'lowpass', freq: 260, delay: 0.55, attack: 0.004 })
    tone({ freq: 95, slideTo: 35, dur: 0.35, type: 'sine', gain: 0.18, delay: 0.55, attack: 0.004 })
    for (let i = 0; i < 6; i++) {
      const f = 1500 + ((i * 733) % 2000)
      tone({ freq: f, dur: 0.05, type: 'sine', gain: 0.03, delay: 0.66 + i * 0.06 })
    }
  },
  rain_start() {
    noise({ dur: 1.4, gain: 0.1, color: 'pink', filter: 'lowpass', freq: 2500, attack: 0.5 })
  },

  // ---- creatures -------------------------------------------------------
  meow() {
    const d = out()
    if (!d) return
    const { c, bus } = d
    const t0 = c.currentTime
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 1900
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.085 * trim, t0 + 0.04)
    g.gain.setValueAtTime(0.085 * trim, t0 + 0.28)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.46)
    const mk = (type: OscillatorType, gain: number) => {
      const o = c.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(520, t0)
      o.frequency.exponentialRampToValueAtTime(900, t0 + 0.13)
      o.frequency.exponentialRampToValueAtTime(430, t0 + 0.45)
      const og = c.createGain()
      og.gain.value = gain
      o.connect(og)
      og.connect(f)
      o.start(t0)
      o.stop(t0 + 0.5)
      return o
    }
    const a = mk('triangle', 1)
    mk('sawtooth', 0.22)
    const lfo = c.createOscillator()
    const lg = c.createGain()
    lfo.frequency.value = 6.5
    lg.gain.value = 14
    lfo.connect(lg)
    lg.connect(a.frequency)
    lfo.start(t0)
    lfo.stop(t0 + 0.5)
    f.connect(g)
    g.connect(bus)
  },
  gull() {
    for (let i = 0; i < 2; i++) {
      const delay = i * 0.27
      const k = i === 0 ? 1 : 0.9
      const d = out()
      if (!d) return
      const { c, bus } = d
      const t0 = c.currentTime + delay
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 1700 * k
      f.Q.value = 2.5
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(0.12 * trim, t0 + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
      for (const [type, amt] of [
        ['triangle', 1],
        ['square', 0.35],
      ] as [OscillatorType, number][]) {
        const o = c.createOscillator()
        o.type = type
        o.frequency.setValueAtTime(1150 * k, t0)
        o.frequency.exponentialRampToValueAtTime(1500 * k, t0 + 0.03)
        o.frequency.exponentialRampToValueAtTime(950 * k, t0 + 0.22)
        const og = c.createGain()
        og.gain.value = amt
        o.connect(og)
        og.connect(f)
        o.start(t0)
        o.stop(t0 + 0.25)
      }
      f.connect(g)
      g.connect(bus)
    }
  },

  // ---- UI --------------------------------------------------------------
  blip() {
    tone({ freq: 720, dur: 0.04, type: 'square', gain: 0.035 })
  },
  select() {
    arp([660, 880], 0.05, 0.07)
  },
  back() {
    arp([700, 520], 0.05, 0.06)
  },
  error() {
    tone({ freq: 110, slideTo: 100, dur: 0.22, type: 'square', gain: 0.05, lp: 500 })
    tone({ freq: 116, slideTo: 105, dur: 0.22, type: 'square', gain: 0.05, lp: 500 })
  },
}

/*
 * Listening harness (browser, Vite dev server running):
 *   const { sfx } = await import('/lineage/src/audio/sfx.ts')
 *   sfx.resume()                                // inside a click handler / after a click
 *   for (const k of Object.keys(sfx)) if (typeof sfx[k] === 'function' && !/^(set|is|resume)/.test(k)) {
 *     await new Promise(r => setTimeout(r, 700)); console.log(k); sfx[k]()
 *   }
 */
