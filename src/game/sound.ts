// Tiny generated-sound engine (Web Audio) — no audio files.
let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) ctx = new AC()
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume()
  return ctx
}

type Tone = { freq: number; dur?: number; type?: OscillatorType; gain?: number; slideTo?: number; delay?: number }
function tone({ freq, dur = 0.12, type = 'sine', gain = 0.05, slideTo, delay = 0 }: Tone) {
  const c = getCtx()
  if (!c || muted) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}
const arp = (notes: number[], step = 0.08, gain = 0.05, type: OscillatorType = 'triangle') =>
  notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type, gain, delay: i * step }))

let stepFlip = false
export const sfx = {
  setMuted(m: boolean) {
    muted = m
  },
  isMuted() {
    return muted
  },
  resume() {
    getCtx()
  },
  step() {
    stepFlip = !stepFlip
    tone({ freq: stepFlip ? 150 : 130, dur: 0.05, type: 'triangle', gain: 0.025 })
  },
  pickup() {
    tone({ freq: 880, dur: 0.06, type: 'sine', gain: 0.05 })
    tone({ freq: 1320, dur: 0.1, type: 'sine', gain: 0.045, delay: 0.05 })
  },
  open() {
    arp([523, 659, 784], 0.06, 0.05)
  },
  close() {
    tone({ freq: 440, dur: 0.08, type: 'sine', gain: 0.04 })
  },
  discover() {
    arp([523, 659, 784, 1047], 0.09, 0.055)
  },
  bump() {
    tone({ freq: 120, dur: 0.08, type: 'sine', gain: 0.03, slideTo: 80 })
  },
}
