// Generated environmental ambience: waves, birds, crickets, wind and rain,
// each faded by a 0..1 mix value with ~1 s ramps. `interior` muffles and
// lowers the whole bed. Routed into the SFX bus so the world stays audible
// when music is turned down. No-op until the engine is unlocked.
import { audio, noiseBuffer, onAudioReady } from './engine'

export type AmbienceMix = { coast: number; woods: number; night: number; rain: number; interior: number; wind: number }

const RAMP = 0.3 // setTargetAtTime time constant → ~1 s to settle
const LEVEL = { waves: 0.5, foam: 0.12, birds: 1, crickets: 0.03, wind: 0.09, rain: 0.13 }

const clamp01 = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

let mix: AmbienceMix = { coast: 0, woods: 0, night: 0, rain: 0, interior: 0, wind: 0 }
let stopped = true
let teardownTimer: ReturnType<typeof setTimeout> | null = null

type Bed = {
  c: AudioContext
  bus: GainNode
  filter: BiquadFilterNode
  waves: GainNode
  foam: GainNode
  birds: GainNode
  crickets: GainNode
  wind: GainNode
  rain: GainNode
  sources: AudioScheduledSourceNode[]
  timers: Array<ReturnType<typeof setTimeout>>
  alive: boolean
}
let bed: Bed | null = null

function lfo(c: AudioContext, rate: number, depth: number, target: AudioParam, bed: Bed, type: OscillatorType = 'sine') {
  const o = c.createOscillator()
  o.type = type
  o.frequency.value = rate
  const g = c.createGain()
  g.gain.value = depth
  o.connect(g)
  g.connect(target)
  o.start()
  bed.sources.push(o)
}

function loopNoise(c: AudioContext, color: 'white' | 'pink' | 'brown', bed: Bed): AudioBufferSourceNode {
  const s = c.createBufferSource()
  s.buffer = noiseBuffer(c, color, 3)
  s.loop = true
  s.start()
  bed.sources.push(s)
  return s
}

function gainNode(c: AudioContext, v = 0): GainNode {
  const g = c.createGain()
  g.gain.value = v
  return g
}

function build(c: AudioContext, sfxBus: GainNode): Bed {
  const bus = gainNode(c, 1)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 20000
  filter.Q.value = 0.5
  bus.connect(filter)
  filter.connect(sfxBus)

  const b: Bed = {
    c,
    bus,
    filter,
    waves: gainNode(c),
    foam: gainNode(c),
    birds: gainNode(c),
    crickets: gainNode(c),
    wind: gainNode(c),
    rain: gainNode(c),
    sources: [],
    timers: [],
    alive: true,
  }

  // --- waves: brown noise, lowpassed, swelling slowly (two LFOs for irregularity)
  {
    const src = loopNoise(c, 'brown', b)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 480
    const swell = gainNode(c, 0.45)
    lfo(c, 0.11, 0.32, swell.gain, b)
    lfo(c, 0.043, 0.18, swell.gain, b)
    src.connect(lp)
    lp.connect(swell)
    swell.connect(b.waves)
    b.waves.connect(bus)
    // foam: a little broadband hiss that swells with a slightly different rhythm
    const foamSrc = loopNoise(c, 'pink', b)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const foamSwell = gainNode(c, 0.35)
    lfo(c, 0.13, 0.33, foamSwell.gain, b)
    foamSrc.connect(hp)
    hp.connect(foamSwell)
    foamSwell.connect(b.foam)
    b.foam.connect(bus)
  }

  // --- crickets: high sine, amplitude-modulated fast (trill) and slow (chirp groups)
  for (const [freq, trill, group] of [
    [4300, 27, 1.1],
    [3900, 23, 0.8],
  ]) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const am = gainNode(c, 0.5)
    lfo(c, trill, 0.5, am.gain, b)
    const grp = gainNode(c, 0.5)
    lfo(c, group, 0.5, grp.gain, b)
    o.connect(am)
    am.connect(grp)
    grp.connect(b.crickets)
    o.start()
    b.sources.push(o)
  }
  b.crickets.connect(bus)

  // --- wind: pink noise through a wandering bandpass
  {
    const src = loopNoise(c, 'pink', b)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 450
    bp.Q.value = 0.6
    lfo(c, 0.09, 220, bp.frequency, b)
    const gust = gainNode(c, 0.6)
    lfo(c, 0.14, 0.38, gust.gain, b)
    src.connect(bp)
    bp.connect(gust)
    gust.connect(b.wind)
    b.wind.connect(bus)
  }

  // --- rain: white noise, lowpassed, gently varying
  {
    const src = loopNoise(c, 'white', b)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200
    lfo(c, 0.21, 600, lp.frequency, b)
    src.connect(lp)
    lp.connect(b.rain)
    b.rain.connect(bus)
  }

  b.birds.connect(bus)
  scheduleBirds(b)
  scheduleGulls(b)
  scheduleDrips(b)
  return b
}

function pan(c: AudioContext, node: AudioNode, amount: number, dest: AudioNode) {
  const ctor = (c as unknown as { createStereoPanner?: () => StereoPannerNode }).createStereoPanner
  if (typeof ctor === 'function') {
    const p = c.createStereoPanner()
    p.pan.value = amount
    node.connect(p)
    p.connect(dest)
  } else node.connect(dest)
}

function chirp(b: Bed) {
  const { c } = b
  const t0 = c.currentTime + 0.02
  const notes = 2 + Math.floor(Math.random() * 2)
  const base = 2400 + Math.random() * 1800
  const g = c.createGain()
  g.gain.value = 1
  pan(c, g, Math.random() * 1.2 - 0.6, b.birds)
  for (let i = 0; i < notes; i++) {
    const t = t0 + i * (0.09 + Math.random() * 0.05)
    const f0 = base * (1 + (Math.random() - 0.5) * 0.2)
    const f1 = f0 * (Math.random() < 0.5 ? 1.25 : 0.8)
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.07)
    const e = c.createGain()
    e.gain.setValueAtTime(0.0001, t)
    e.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.02, t + 0.012)
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    o.connect(e)
    e.connect(g)
    o.start(t)
    o.stop(t + 0.1)
  }
}

function gullCall(b: Bed) {
  const { c } = b
  const k = 0.85 + Math.random() * 0.3
  const g = c.createGain()
  g.gain.value = 1
  pan(c, g, Math.random() * 1.4 - 0.7, b.birds)
  for (let i = 0; i < 2; i++) {
    const t0 = c.currentTime + 0.02 + i * 0.3
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1600 * k
    f.Q.value = 3
    const e = c.createGain()
    e.gain.setValueAtTime(0.0001, t0)
    e.gain.linearRampToValueAtTime(0.045, t0 + 0.04)
    e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26)
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(1100 * k, t0)
    o.frequency.exponentialRampToValueAtTime(1450 * k, t0 + 0.04)
    o.frequency.exponentialRampToValueAtTime(900 * k, t0 + 0.26)
    o.connect(f)
    f.connect(e)
    e.connect(g)
    o.start(t0)
    o.stop(t0 + 0.3)
  }
}

function drip(b: Bed) {
  const { c } = b
  const t0 = c.currentTime + 0.01
  const o = c.createOscillator()
  o.type = 'sine'
  const f0 = 1500 + Math.random() * 2500
  o.frequency.setValueAtTime(f0, t0)
  o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t0 + 0.03)
  const e = c.createGain()
  e.gain.setValueAtTime(0.0001, t0)
  e.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.012, t0 + 0.003)
  e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035)
  o.connect(e)
  e.connect(b.rain)
  o.start(t0)
  o.stop(t0 + 0.05)
}

function later(b: Bed, ms: number, fn: () => void) {
  const t = setTimeout(() => {
    b.timers = b.timers.filter((x) => x !== t)
    if (b.alive) fn()
  }, ms)
  b.timers.push(t)
}

function scheduleBirds(b: Bed) {
  later(b, 1500 + Math.random() * 4000, () => {
    if (!stopped && 1 - mix.night > 0.05) chirp(b)
    scheduleBirds(b)
  })
}

function scheduleGulls(b: Bed) {
  later(b, 6000 + Math.random() * 12000, () => {
    if (!stopped && mix.coast * (1 - mix.night) > 0.2) gullCall(b)
    scheduleGulls(b)
  })
}

function scheduleDrips(b: Bed) {
  const r = stopped ? 0 : mix.rain
  later(b, r > 0.05 ? 40 + Math.random() * 260 / r : 400, () => {
    if (!stopped && mix.rain > 0.05) drip(b)
    scheduleDrips(b)
  })
}

function apply(b: Bed) {
  const t = b.c.currentTime
  const set = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, RAMP)
  const m = stopped ? { coast: 0, woods: 0, night: 0, rain: 0, interior: 0, wind: 0 } : mix
  const day = 1 - m.night
  set(b.waves.gain, m.coast * LEVEL.waves)
  set(b.foam.gain, m.coast * LEVEL.foam)
  set(b.birds.gain, day * (0.6 + 0.4 * m.woods) * LEVEL.birds)
  set(b.crickets.gain, m.night * LEVEL.crickets)
  set(b.wind.gain, Math.max(m.woods * 0.8, m.wind) * LEVEL.wind)
  set(b.rain.gain, m.rain * LEVEL.rain)
  // interior: muffle + lower the whole bed
  set(b.filter.frequency, 20000 * Math.pow(650 / 20000, m.interior))
  set(b.bus.gain, 1 - 0.65 * m.interior)
}

function teardown() {
  const b = bed
  if (!b) return
  bed = null
  b.alive = false
  for (const t of b.timers) clearTimeout(t)
  for (const s of b.sources) {
    try {
      s.stop()
    } catch {
      /* already stopped */
    }
  }
  try {
    b.filter.disconnect()
    b.bus.disconnect()
  } catch {
    /* ignore */
  }
}

function ensure(): Bed | null {
  const c = audio.ctx
  const bus = audio.sfxBus
  if (!c || !bus) return null
  if (!bed) bed = build(c, bus)
  return bed
}

export const ambience = {
  /** Update any subset of the mix (0..1 each); unspecified keys keep their value. */
  set(m: Partial<AmbienceMix>): void {
    try {
      const next = { ...mix }
      for (const k of Object.keys(next) as (keyof AmbienceMix)[]) if (k in m) next[k] = clamp01(m[k])
      mix = next
      stopped = false
      if (teardownTimer) {
        clearTimeout(teardownTimer)
        teardownTimer = null
      }
      const b = ensure()
      if (b) apply(b)
    } catch {
      /* never let audio break the game */
    }
  },
  /** Fade everything out and release the nodes shortly after. */
  stop(): void {
    try {
      stopped = true
      const b = bed
      if (!b) return
      apply(b)
      if (teardownTimer) clearTimeout(teardownTimer)
      teardownTimer = setTimeout(() => {
        teardownTimer = null
        if (stopped) teardown()
      }, 1800)
    } catch {
      /* ignore */
    }
  },
  /** Current mix (for debugging / tests). */
  get mix(): AmbienceMix {
    return { ...mix }
  },
}

// If the world set a mix before the first gesture, start it once audio exists.
onAudioReady(() => {
  if (!stopped) {
    const b = ensure()
    if (b) apply(b)
  }
})
