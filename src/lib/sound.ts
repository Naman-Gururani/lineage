/* Tiny generated-sound engine (Web Audio) — no audio files.
   Lazily creates an AudioContext on the first user gesture. */

let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) ctx = new AC()
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume()
  return ctx
}

type ToneOpts = {
  freq: number
  dur?: number
  type?: OscillatorType
  gain?: number
  slideTo?: number
  delay?: number
}

function tone({ freq, dur = 0.12, type = 'square', gain = 0.06, slideTo, delay = 0 }: ToneOpts) {
  const c = getCtx()
  if (!c || muted) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

const arp = (notes: number[], step = 0.08, gain = 0.06, type: OscillatorType = 'square') =>
  notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type, gain, delay: i * step }))

export const sound = {
  setMuted(m: boolean) {
    muted = m
  },
  isMuted() {
    return muted
  },
  resume() {
    getCtx()
  },
  click() {
    tone({ freq: 420, dur: 0.05, gain: 0.045 })
  },
  move() {
    tone({ freq: 300, dur: 0.035, gain: 0.03 })
  },
  rotate() {
    tone({ freq: 520, dur: 0.05, type: 'triangle', gain: 0.05 })
  },
  type() {
    tone({ freq: 360 + Math.random() * 80, dur: 0.025, gain: 0.022 })
  },
  correct() {
    tone({ freq: 660, dur: 0.08, gain: 0.055 })
    tone({ freq: 988, dur: 0.1, gain: 0.05, delay: 0.06 })
  },
  wrong() {
    tone({ freq: 200, dur: 0.2, type: 'sawtooth', gain: 0.055, slideTo: 90 })
  },
  coin() {
    tone({ freq: 988, dur: 0.06, gain: 0.05 })
    tone({ freq: 1319, dur: 0.12, gain: 0.05, delay: 0.06 })
  },
  start() {
    tone({ freq: 330, dur: 0.1, gain: 0.06 })
    tone({ freq: 660, dur: 0.16, gain: 0.06, delay: 0.1 })
  },
  unlock() {
    arp([523, 659, 784, 1047])
  },
  win() {
    arp([523, 659, 784, 1047, 1319], 0.1)
  },
}
