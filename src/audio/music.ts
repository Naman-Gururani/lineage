// Music: a 16th-note step sequencer ("tale of two clocks": a JS timer wakes
// every 25 ms and schedules every note that falls inside the next ~100 ms on
// the audio clock). Tracks crossfade; non-looping songs (fanfare) play as an
// overlay that ducks the current loop instead of replacing it.
import { audio, noiseBuffer, onAudioReady } from './engine'
import { SONGS, parsePattern, stepSeconds, stepsOf } from './songs'
import type { DrumKind, InstrumentKind, NoteEvent, Song, TrackId, Voice } from './songs'

export type { TrackId } from './songs'

const LOOKAHEAD = 0.1 // s of audio scheduled ahead when the tab is visible
const LOOKAHEAD_HIDDEN = 1.5 // background tabs throttle timers to ~1 Hz
const TICK_MS = 25
const DEFAULT_FADE = 1200
const DUCK_UNDER_OVERLAY = 0.25

// Peak gains per instrument, before voice/track/bus gains.
const LEVEL = { lead: 0.16, bell: 0.14, bass: 0.085, bassSine: 0.05, sub: 0.1, pad: 0.045, pulse: 0.09 }
const DRUM: Record<DrumKind, number> = { k: 0.14, h: 0.045, H: 0.055, s: 0.09, r: 0.08 }

type PreparedVoice = {
  inst: InstrumentKind
  /** Where notes connect (the voice filter if any, else the voice gain). */
  entry: AudioNode
  byStep: Map<number, NoteEvent[]>
}

type Chain = { filter: BiquadFilterNode; duck: GainNode }

let chain: Chain | null = null
let intensity = 1
let requested: TrackId | null = null
let current: Player | null = null
let overlay: Player | null = null
let visibilityHooked = false

const isHidden = () => typeof document !== 'undefined' && document.hidden === true

function lowpass(c: AudioContext, freq: number, q: number): BiquadFilterNode {
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = freq
  f.Q.value = q
  return f
}

function osc(c: AudioContext, type: OscillatorType, freq: number, detune = 0): OscillatorNode {
  const o = c.createOscillator()
  o.type = type
  o.frequency.value = freq
  if (detune) o.detune.value = detune
  return o
}

function prepareVoice(c: AudioContext, v: Voice, dest: AudioNode): PreparedVoice {
  const out = c.createGain()
  out.gain.value = v.gain ?? 1
  out.connect(dest)
  let filter: BiquadFilterNode | null = null
  switch (v.inst) {
    case 'lead':
      filter = lowpass(c, v.cutoff ?? 2200, 0.7)
      break
    case 'bass':
      filter = lowpass(c, v.cutoff ?? 420, 1)
      break
    case 'pad':
      filter = lowpass(c, v.cutoff ?? 1300, 0.5)
      break
    case 'pulse':
      filter = lowpass(c, v.cutoff ?? 1100, 1.8)
      break
    default:
      filter = null
  }
  if (filter) filter.connect(out)
  const byStep = new Map<number, NoteEvent[]>()
  for (const e of parsePattern(v.pattern, v.transpose ?? 0)) {
    const list = byStep.get(e.step)
    if (list) list.push(e)
    else byStep.set(e.step, [e])
  }
  return { inst: v.inst, entry: filter ?? out, byStep }
}

/** Envelope helper: attack to `peak`, then hand over to the caller. */
function attack(g: GainNode, t: number, peak: number, a: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + a)
}

function playNote(c: AudioContext, v: PreparedVoice, e: NoteEvent, t: number, dur: number) {
  const entry = v.entry
  switch (v.inst) {
    case 'lead': {
      const end = t + Math.max(0.05, dur - 0.03)
      const o = osc(c, 'triangle', e.freq)
      const g = c.createGain()
      attack(g, t, LEVEL.lead, 0.012)
      g.gain.setTargetAtTime(LEVEL.lead * 0.7, t + 0.012, 0.08)
      g.gain.setTargetAtTime(0.0001, end, 0.03)
      o.connect(g)
      g.connect(entry)
      o.start(t)
      o.stop(end + 0.25)
      break
    }
    case 'bell': {
      // Sine fundamental plus two decaying partials; rings past the step like a music box.
      const partials: [number, number, number][] = [
        [1, 1, 0.28],
        [2, 0.35, 0.16],
        [2.76, 0.12, 0.07],
      ]
      for (const [ratio, amp, tau] of partials) {
        const o = osc(c, 'sine', e.freq * ratio)
        const g = c.createGain()
        attack(g, t, LEVEL.bell * amp, 0.003)
        g.gain.setTargetAtTime(0.0001, t + 0.003, tau)
        o.connect(g)
        g.connect(entry)
        o.start(t)
        o.stop(t + tau * 7)
      }
      break
    }
    case 'bass': {
      const end = t + Math.max(0.04, dur - 0.02)
      const sq = osc(c, 'square', e.freq)
      const sn = osc(c, 'sine', e.freq)
      const g = c.createGain()
      const sg = c.createGain()
      sg.gain.value = LEVEL.bassSine / LEVEL.bass
      attack(g, t, LEVEL.bass, 0.006)
      g.gain.setTargetAtTime(0.0001, end, 0.03)
      sq.connect(g)
      sn.connect(sg)
      sg.connect(g)
      g.connect(entry)
      sq.start(t)
      sn.start(t)
      sq.stop(end + 0.2)
      sn.stop(end + 0.2)
      break
    }
    case 'sub': {
      const end = t + Math.max(0.05, dur - 0.05)
      const o = osc(c, 'sine', e.freq)
      const g = c.createGain()
      attack(g, t, LEVEL.sub, 0.02)
      g.gain.setTargetAtTime(0.0001, end, 0.08)
      o.connect(g)
      g.connect(entry)
      o.start(t)
      o.stop(end + 0.6)
      break
    }
    case 'pad': {
      const end = t + dur
      const a = Math.min(0.35, dur / 2)
      for (const det of [-7, 7]) {
        const o = osc(c, 'triangle', e.freq, det)
        const g = c.createGain()
        attack(g, t, LEVEL.pad, a)
        g.gain.setTargetAtTime(0.0001, end, 0.3)
        o.connect(g)
        g.connect(entry)
        o.start(t)
        o.stop(end + 1.5)
      }
      break
    }
    case 'pulse': {
      const o = osc(c, 'square', e.freq)
      const g = c.createGain()
      attack(g, t, LEVEL.pulse, 0.003)
      g.gain.setTargetAtTime(0.0001, t + 0.003, 0.05)
      o.connect(g)
      g.connect(entry)
      o.start(t)
      o.stop(t + 0.35)
      break
    }
    case 'perc':
      if (e.drum) playDrum(c, e.drum, t, entry)
      break
  }
}

function playDrum(c: AudioContext, kind: DrumKind, t: number, entry: AudioNode) {
  const g = c.createGain()
  g.connect(entry)
  const level = DRUM[kind]
  switch (kind) {
    case 'k': {
      const o = osc(c, 'sine', 150)
      o.frequency.setValueAtTime(150, t)
      o.frequency.exponentialRampToValueAtTime(45, t + 0.08)
      attack(g, t, level, 0.002)
      g.gain.setTargetAtTime(0.0001, t + 0.002, 0.06)
      o.connect(g)
      o.start(t)
      o.stop(t + 0.4)
      break
    }
    case 'h':
    case 'H': {
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(c, 'white')
      const f = c.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = 7000
      attack(g, t, level, 0.001)
      g.gain.setTargetAtTime(0.0001, t + 0.001, kind === 'H' ? 0.05 : 0.012)
      src.connect(f)
      f.connect(g)
      src.start(t)
      src.stop(t + (kind === 'H' ? 0.4 : 0.12))
      break
    }
    case 's': {
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(c, 'white')
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 1600
      f.Q.value = 0.8
      attack(g, t, level, 0.001)
      g.gain.setTargetAtTime(0.0001, t + 0.001, 0.045)
      src.connect(f)
      f.connect(g)
      src.start(t)
      src.stop(t + 0.35)
      const o = osc(c, 'sine', 190)
      const og = c.createGain()
      attack(og, t, level * 0.7, 0.002)
      og.gain.setTargetAtTime(0.0001, t + 0.002, 0.04)
      o.connect(og)
      og.connect(entry)
      o.start(t)
      o.stop(t + 0.3)
      break
    }
    case 'r': {
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(c, 'white')
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 2600
      f.Q.value = 7
      attack(g, t, level, 0.001)
      g.gain.setTargetAtTime(0.0001, t + 0.001, 0.008)
      src.connect(f)
      f.connect(g)
      src.start(t)
      src.stop(t + 0.1)
      break
    }
  }
}

class Player {
  readonly gain: GainNode
  onDone: (() => void) | null = null
  disposed = false
  private voices: PreparedVoice[] = []
  private steps: number
  private stepDur: number
  private swing: number
  private loop: boolean
  private startAt = 0
  private next = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private doneTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private c: AudioContext,
    song: Song,
    dest: AudioNode,
  ) {
    this.gain = c.createGain()
    this.gain.gain.value = 0
    this.gain.connect(dest)
    this.steps = Math.max(1, song.voices.length ? stepsOf(song.voices[0].pattern) : 1)
    this.stepDur = stepSeconds(song.bpm)
    this.swing = song.swing ?? 0
    this.loop = song.loop
    for (const v of song.voices) this.voices.push(prepareVoice(c, v, this.gain))
  }

  begin() {
    this.startAt = this.c.currentTime + 0.05
    this.tick()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  fadeTo(v: number, ms: number) {
    const t = this.c.currentTime
    const g = this.gain.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(v, t + Math.max(0.01, ms / 1000))
  }

  private timeOf(n: number) {
    return this.startAt + n * this.stepDur + (n & 1 ? (this.swing * this.stepDur) / 3 : 0)
  }

  tick() {
    if (this.disposed) return
    const horizon = this.c.currentTime + (isHidden() ? LOOKAHEAD_HIDDEN : LOOKAHEAD)
    while (this.timeOf(this.next) < horizon) {
      if (!this.loop && this.next >= this.steps) {
        this.finish()
        return
      }
      this.scheduleStep(this.next)
      this.next++
    }
  }

  private scheduleStep(n: number) {
    const s = n % this.steps
    const t = this.timeOf(n)
    for (const v of this.voices) {
      const evs = v.byStep.get(s)
      if (!evs) continue
      for (const e of evs) playNote(this.c, v, e, t, e.dur * this.stepDur)
    }
  }

  private finish() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    const tail = Math.max(0, this.timeOf(this.steps) - this.c.currentTime) + 1
    this.doneTimer = setTimeout(() => {
      this.doneTimer = null
      if (!this.disposed && this.onDone) this.onDone()
    }, tail * 1000)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.timer) clearInterval(this.timer)
    if (this.doneTimer) clearTimeout(this.doneTimer)
    this.timer = null
    this.doneTimer = null
    try {
      this.gain.disconnect()
    } catch {
      /* ignore */
    }
  }
}

function ensureChain(): { c: AudioContext; chain: Chain } | null {
  const c = audio.ctx
  const bus = audio.musicBus
  if (!c || !bus) return null
  if (!chain) {
    const filter = lowpass(c, 20000, 0.4)
    const duck = c.createGain()
    duck.gain.value = 1
    filter.connect(duck)
    duck.connect(bus)
    chain = { filter, duck }
    applyIntensity(c, chain, 0)
    hookVisibility()
  }
  return { c, chain }
}

function hookVisibility() {
  if (visibilityHooked || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return
  visibilityHooked = true
  document.addEventListener('visibilitychange', () => {
    // Fill the buffer before the throttled background timers take over.
    if (document.hidden) {
      current?.tick()
      overlay?.tick()
    }
  })
}

function applyIntensity(c: AudioContext, ch: Chain, ramp: number) {
  const t = c.currentTime
  const cutoff = 700 * Math.pow(20000 / 700, intensity)
  if (ramp <= 0) {
    ch.duck.gain.value = 0.3 + 0.7 * intensity
    ch.filter.frequency.value = cutoff
  } else {
    ch.duck.gain.setTargetAtTime(0.3 + 0.7 * intensity, t, ramp)
    ch.filter.frequency.setTargetAtTime(cutoff, t, ramp)
  }
}

function fadeOut(p: Player, ms: number) {
  p.fadeTo(0, ms)
  setTimeout(() => p.dispose(), ms + 150)
}

function startLoop(song: Song, fadeMs: number, c: AudioContext, ch: Chain) {
  const old = current
  const p = new Player(c, song, ch.filter)
  p.begin()
  p.fadeTo(1, old ? fadeMs : Math.min(fadeMs, 600))
  if (old) fadeOut(old, fadeMs)
  current = p
}

function playOverlay(song: Song, c: AudioContext, ch: Chain) {
  if (overlay) {
    fadeOut(overlay, 100)
    overlay = null
  }
  const p = new Player(c, song, ch.filter)
  p.begin()
  p.fadeTo(1, 30)
  const under = current
  if (under) under.fadeTo(DUCK_UNDER_OVERLAY, 200)
  p.onDone = () => {
    if (overlay === p) overlay = null
    if (under && under === current && !under.disposed) under.fadeTo(1, 700)
    p.dispose()
  }
  overlay = p
}

export const music = {
  /** Crossfade to a track (default 1200 ms). Non-looping tracks play once over the current one. */
  play(id: TrackId, fadeMs: number = DEFAULT_FADE): void {
    try {
      const song = SONGS[id]
      if (!song) return
      const ms = Number.isFinite(fadeMs) ? Math.max(0, fadeMs) : DEFAULT_FADE
      if (!song.loop) {
        const r = ensureChain()
        if (r) playOverlay(song, r.c, r.chain)
        return
      }
      if (requested === id && current && !current.disposed) return
      requested = id
      const r = ensureChain()
      if (!r) return // starts on unlock (see onAudioReady below)
      startLoop(song, ms, r.c, r.chain)
    } catch {
      /* never let audio break the game */
    }
  },
  stop(fadeMs: number = DEFAULT_FADE): void {
    try {
      requested = null
      const ms = Number.isFinite(fadeMs) ? Math.max(0, fadeMs) : DEFAULT_FADE
      if (current) fadeOut(current, ms)
      current = null
      if (overlay) fadeOut(overlay, Math.min(ms, 300))
      overlay = null
    } catch {
      /* ignore */
    }
  },
  /** The looping track that is playing (or will start once audio is unlocked). */
  get current(): TrackId | null {
    return requested
  },
  /** 0..1 — lower values duck and soften (lowpass) the music, e.g. during dialogue. */
  setIntensity(v: number): void {
    intensity = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
    const c = audio.ctx
    if (c && chain) {
      try {
        applyIntensity(c, chain, 0.15)
      } catch {
        /* ignore */
      }
    }
  },
}

onAudioReady(() => {
  if (requested && !current) {
    const id = requested
    requested = null
    music.play(id, 600)
  }
})

/*
 * Listening harness (browser, Vite dev server running):
 *   const { music } = await import('/lineage/src/audio/music.ts')
 *   const { audio } = await import('/lineage/src/audio/engine.ts')
 *   audio.unlock()                      // after a click on the page
 *   music.play('day')                   // then try 'night', 'interior', 'tower', 'engine', 'title'
 *   music.play('fanfare')               // overlays + ducks the current loop
 *   music.setIntensity(0.3)             // dialogue duck; setIntensity(1) to restore
 */
