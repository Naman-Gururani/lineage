// Web Audio engine core: one lazily-created AudioContext (only ever created
// inside `audio.unlock()`, which must be called from a user gesture), a small
// bus graph and the settings → gain mapping. Nothing here throws or logs when
// Web Audio is unavailable (tests run in Node) or before the first gesture —
// every entry point is a no-op until `unlock()` has succeeded.
//
//   musicBus ─┐
//             ├─► master ─► compressor ─► destination
//   sfxBus  ──┘

export type Volumes = { master: number; music: number; sfx: number }

export type AudioEngine = {
  unlock(): void
  readonly ctx: AudioContext | null
  setVolumes(s: Volumes): void
  /**
   * The one place "mute" lives: gates the master bus (which both the music and
   * sfx buses feed into) without touching the stored `volumes`. `setVolumes`
   * always re-applies through this same gate, so no caller — including a
   * settings re-read that only knows the raw sliders — can un-mute by calling
   * it; only `setMuted(false)` can.
   */
  setMuted(m: boolean): void
  readonly master: GainNode | null
  readonly musicBus: GainNode | null
  readonly sfxBus: GainNode | null
  now(): number
}

export type NoiseColor = 'white' | 'pink' | 'brown'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let volumes: Volumes = { master: 0.8, music: 0.6, sfx: 0.8 }
let muted = false
let ready = false
const readyFns: Array<(c: AudioContext) => void> = []
const noiseCache = new Map<string, AudioBuffer>()

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/** Slider position (0..1) → gain. Quadratic: gentle near the bottom, ~-6 dB at 0.7. */
export const volumeCurve = (v: number): number => {
  const c = clamp01(v)
  return c * c
}

function findContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext || w.webkitAudioContext
}

/** Pushes `volumes` to the three gain nodes, gating the master bus while `muted`. */
function applyGains() {
  if (!ctx || !master || !musicBus || !sfxBus) return
  try {
    const t = ctx.currentTime
    master.gain.setTargetAtTime(muted ? 0 : volumeCurve(volumes.master), t, 0.03)
    musicBus.gain.setTargetAtTime(volumeCurve(volumes.music), t, 0.03)
    sfxBus.gain.setTargetAtTime(volumeCurve(volumes.sfx), t, 0.03)
  } catch {
    /* ignore */
  }
}

function buildGraph(c: AudioContext) {
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 12
  comp.ratio.value = 4
  comp.attack.value = 0.004
  comp.release.value = 0.22

  master = c.createGain()
  musicBus = c.createGain()
  sfxBus = c.createGain()
  // A gesture can unlock the context after `muted` was already restored from a
  // stored setting (settings load and apply well before any gesture can land)
  // — so the very first graph built must honour it too, not just later calls.
  master.gain.value = muted ? 0 : volumeCurve(volumes.master)
  musicBus.gain.value = volumeCurve(volumes.music)
  sfxBus.gain.value = volumeCurve(volumes.sfx)

  musicBus.connect(master)
  sfxBus.connect(master)
  master.connect(comp)
  comp.connect(c.destination)
}

function kickSilently(c: AudioContext) {
  // iOS historically needs an actual (silent) buffer played inside the gesture.
  try {
    const b = c.createBuffer(1, 1, c.sampleRate)
    const s = c.createBufferSource()
    s.buffer = b
    s.connect(c.destination)
    s.start(0)
  } catch {
    /* ignore */
  }
}

export const audio: AudioEngine = {
  unlock() {
    try {
      if (!ctx) {
        const AC = findContextCtor()
        if (!AC) return
        ctx = new AC()
        buildGraph(ctx)
        kickSilently(ctx)
      }
      if (ctx.state !== 'running') {
        const p = ctx.resume()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }
      if (!ready) {
        ready = true
        const c = ctx
        for (const fn of readyFns.splice(0)) {
          try {
            fn(c)
          } catch {
            /* a listener failing must not break the engine */
          }
        }
      }
    } catch {
      /* keep silent: audio is a nicety, never a crash */
    }
  },
  get ctx() {
    return ctx
  },
  setVolumes(s) {
    volumes = { master: clamp01(s.master), music: clamp01(s.music), sfx: clamp01(s.sfx) }
    applyGains()
  },
  setMuted(m) {
    muted = m
    applyGains()
  },
  get master() {
    return master
  },
  get musicBus() {
    return musicBus
  },
  get sfxBus() {
    return sfxBus
  },
  now() {
    return ctx ? ctx.currentTime : 0
  },
}

/** Run `fn` once the context exists (immediately if it already does). */
export function onAudioReady(fn: (c: AudioContext) => void): void {
  if (ready && ctx) {
    try {
      fn(ctx)
    } catch {
      /* ignore */
    }
  } else readyFns.push(fn)
}

/** Shared looping noise buffers (cached per colour + sample rate). */
export function noiseBuffer(c: AudioContext, color: NoiseColor, seconds = 2): AudioBuffer {
  const key = `${color}:${c.sampleRate}:${seconds}`
  const hit = noiseCache.get(key)
  if (hit) return hit
  const len = Math.max(1, Math.floor(c.sampleRate * seconds))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  if (color === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  } else if (color === 'pink') {
    // Paul Kellet's economy pink filter.
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  } else {
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  noiseCache.set(key, buf)
  return buf
}
