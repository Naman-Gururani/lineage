import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { SONGS, loopLength, noteFreq, parsePattern, stepSeconds, stepsOf, tokensOf } from '../src/audio/songs'

describe('note names', () => {
  it('A4 is 440 Hz and octaves double', () => {
    expect(noteFreq('A4')).toBe(440)
    expect(noteFreq('A5')).toBeCloseTo(880, 6)
    expect(noteFreq('A3')).toBeCloseTo(220, 6)
  })

  it('maps middle C and accidentals', () => {
    expect(noteFreq('C4')).toBeCloseTo(261.63, 1)
    expect(noteFreq('F#4')).toBeCloseTo(369.99, 1)
    expect(noteFreq('Bb3')).toBeCloseTo(noteFreq('A#3'), 9)
    expect(noteFreq('C-1')).toBeCloseTo(8.18, 1)
  })

  it('applies a semitone transpose', () => {
    expect(noteFreq('A4', 12)).toBeCloseTo(880, 6)
    expect(noteFreq('A4', -12)).toBeCloseTo(220, 6)
  })

  it('rejects garbage', () => {
    expect(() => noteFreq('H4')).toThrow()
    expect(() => noteFreq('C')).toThrow()
    expect(() => noteFreq('k')).toThrow()
  })
})

describe('parsePattern', () => {
  it('turns tokens into { step, freq, dur } events', () => {
    const evs = parsePattern('C4 E4 G4 - ')
    expect(evs).toHaveLength(3)
    expect(evs.map((e) => e.step)).toEqual([0, 1, 2])
    expect(evs.every((e) => e.dur === 1)).toBe(true)
    expect(evs[0].freq).toBeCloseTo(261.63, 1)
    expect(evs[2].freq).toBeCloseTo(392, 0)
  })

  it('ties extend the previous note, rests break ties', () => {
    const evs = parsePattern('C4 ~ ~ - E4 ~ - ~')
    expect(evs).toEqual([
      { step: 0, freq: noteFreq('C4'), dur: 3 },
      { step: 4, freq: noteFreq('E4'), dur: 2 },
    ])
  })

  it('ignores a leading tie (it still occupies a step) and bar lines', () => {
    const evs = parsePattern('~ | C4 ~ | E4 |')
    expect(evs).toEqual([
      { step: 1, freq: noteFreq('C4'), dur: 2 },
      { step: 3, freq: noteFreq('E4'), dur: 1 },
    ])
    expect(stepsOf('~ | C4 ~ | E4 |')).toBe(4)
  })

  it('chords start together and share ties', () => {
    const evs = parsePattern('C4+E4+G4 ~ ~ ~')
    expect(evs).toHaveLength(3)
    expect(evs.every((e) => e.step === 0 && e.dur === 4)).toBe(true)
  })

  it('drum tokens become drum events', () => {
    const evs = parsePattern('k - h H s r')
    expect(evs.map((e) => e.drum)).toEqual(['k', 'h', 'H', 's', 'r'])
    expect(evs.map((e) => e.step)).toEqual([0, 2, 3, 4, 5])
    expect(evs.every((e) => e.freq === 0)).toBe(true)
  })

  it('transposes', () => {
    expect(parsePattern('A4', 12)[0].freq).toBeCloseTo(880, 6)
  })

  it('counts steps ignoring bar lines and whitespace', () => {
    expect(stepsOf('C4 - - -')).toBe(4)
    expect(stepsOf('  C4   -\n- - | ')).toBe(4)
    expect(tokensOf('| C4 | - |')).toEqual(['C4', '-'])
  })
})

describe('loop length', () => {
  it('derives seconds from bpm and 16th steps', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125, 9)
    const song = { bpm: 120, loop: true, voices: [{ name: 'a', inst: 'lead' as const, pattern: 'C4 - - - - - - - - - - - - - - -' }] }
    expect(loopLength(song)).toEqual({ steps: 16, bars: 1, seconds: 2 })
  })

  it('day is 16 bars at 104 BPM', () => {
    const l = loopLength(SONGS.day)
    expect(SONGS.day.bpm).toBe(104)
    expect(l.bars).toBe(16)
    expect(l.seconds).toBeCloseTo((256 * 60) / 104 / 4, 6)
  })
})

describe('songs', () => {
  const ids = Object.keys(SONGS)
  it('has every track', () => {
    expect(ids.sort()).toEqual(['day', 'engine', 'fanfare', 'interior', 'night', 'title', 'tower'].sort())
  })

  for (const id of ids) {
    const song = SONGS[id as keyof typeof SONGS]
    it(`${id}: every voice parses and has the same whole-bar length`, () => {
      expect(song.voices.length).toBeGreaterThan(0)
      const lengths = song.voices.map((v) => stepsOf(v.pattern))
      expect(new Set(lengths).size).toBe(1)
      expect(lengths[0] % 16).toBe(0)
      expect(lengths[0]).toBeGreaterThan(0)
      for (const v of song.voices) {
        const evs = parsePattern(v.pattern, v.transpose ?? 0)
        expect(evs.length).toBeGreaterThan(0)
        for (const e of evs) {
          expect(e.step).toBeGreaterThanOrEqual(0)
          expect(e.step + e.dur).toBeLessThanOrEqual(lengths[0])
          if (v.inst === 'perc') expect(e.drum).toBeDefined()
          else {
            expect(e.drum).toBeUndefined()
            expect(e.freq).toBeGreaterThan(30)
            expect(e.freq).toBeLessThan(5000)
          }
        }
      }
    })
  }

  it('only fanfare is one-shot, and it is short', () => {
    for (const id of ids) expect(SONGS[id as keyof typeof SONGS].loop).toBe(id !== 'fanfare')
    expect(loopLength(SONGS.fanfare).seconds).toBeLessThan(4.5)
    expect(loopLength(SONGS.fanfare).seconds).toBeGreaterThan(2.5)
  })
})

const SOUND_NAMES = [
  'step_grass',
  'step_sand',
  'step_wood',
  'step_stone',
  'splash',
  'swing',
  'grass',
  'coin',
  'packet',
  'chest',
  'door',
  'blip',
  'select',
  'back',
  'elevator',
  'ding',
  'bell',
  'bonk',
  'levelup',
  'discover',
  'quest',
  'achievement',
  'cast',
  'reel',
  'catch',
  'meow',
  'gull',
  'firework',
  'rain_start',
  'hop',
  'error',
  'open',
  'close',
  'pickup',
  'step',
  'bump',
] as const

describe('without Web Audio (plain Node)', () => {
  it('exposes the full sfx surface and every call is a silent no-op', async () => {
    const { audio } = await import('../src/audio/engine')
    const { sfx, getCtx } = await import('../src/audio/sfx')
    const { music } = await import('../src/audio/music')
    const { ambience } = await import('../src/audio/ambience')

    expect(audio.ctx).toBeNull()
    expect(audio.master).toBeNull()
    expect(audio.now()).toBe(0)
    expect(() => audio.unlock()).not.toThrow()
    expect(audio.ctx).toBeNull()
    expect(() => audio.setVolumes({ master: 1, music: 0.5, sfx: 0.5 })).not.toThrow()
    expect(getCtx()).toBeNull()

    for (const name of SOUND_NAMES) {
      const fn = (sfx as Record<string, unknown>)[name]
      expect(typeof fn, name).toBe('function')
      expect(() => (fn as () => void)(), name).not.toThrow()
    }
    expect(() => sfx.resume()).not.toThrow()
    sfx.setMuted(true)
    expect(sfx.isMuted()).toBe(true)
    sfx.setMuted(false)
    expect(sfx.isMuted()).toBe(false)
    expect(() => sfx.setVolume(0.5)).not.toThrow()

    expect(music.current).toBeNull()
    expect(() => music.play('day')).not.toThrow()
    expect(music.current).toBe('day')
    expect(() => music.play('fanfare')).not.toThrow()
    expect(() => music.setIntensity(0.4)).not.toThrow()
    expect(() => music.stop()).not.toThrow()
    expect(music.current).toBeNull()

    expect(() => ambience.set({ coast: 1 })).not.toThrow()
    expect(ambience.mix.coast).toBe(1)
    expect(() => ambience.set({ night: 2, rain: -1 })).not.toThrow()
    expect(ambience.mix.night).toBe(1)
    expect(ambience.mix.rain).toBe(0)
    expect(() => ambience.stop()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// A tiny fake AudioContext so the real code paths (graph building, envelopes,
// the scheduler) run in Node. It validates the mistakes browsers reject.

const stats = { oscStarted: 0, srcStarted: 0, rampErrors: 0 }

class FakeParam {
  value: number
  constructor(v = 0) {
    this.value = v
  }
  setValueAtTime(v: number, _t: number) {
    this.value = v
    return this
  }
  linearRampToValueAtTime(v: number, _t: number) {
    this.value = v
    return this
  }
  exponentialRampToValueAtTime(v: number, _t: number) {
    if (!(v > 0)) {
      stats.rampErrors++
      throw new RangeError('exponentialRampToValueAtTime: value must be > 0')
    }
    this.value = v
    return this
  }
  setTargetAtTime(_v: number, _t: number, _tc: number) {
    return this
  }
  cancelScheduledValues(_t: number) {
    return this
  }
}
class FakeNode {
  connected: unknown[] = []
  connect(dest: unknown) {
    this.connected.push(dest)
    return dest
  }
  disconnect() {
    this.connected = []
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam(1)
}
class FakeBiquad extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam(350)
  Q = new FakeParam(1)
  gain = new FakeParam(0)
}
class FakeOsc extends FakeNode {
  type = 'sine'
  frequency = new FakeParam(440)
  detune = new FakeParam(0)
  private started = false
  start(_t?: number) {
    if (this.started) throw new Error('InvalidStateError: start() called twice')
    this.started = true
    stats.oscStarted++
  }
  stop(_t?: number) {
    if (!this.started) throw new Error('InvalidStateError: stop() before start()')
  }
}
class FakeSource extends FakeNode {
  buffer: unknown = null
  loop = false
  playbackRate = new FakeParam(1)
  private started = false
  start(_t?: number) {
    if (!this.buffer) throw new Error('buffer source started without a buffer')
    if (this.started) throw new Error('InvalidStateError: start() called twice')
    this.started = true
    stats.srcStarted++
  }
  stop(_t?: number) {
    if (!this.started) throw new Error('InvalidStateError: stop() before start()')
  }
}
class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24)
  knee = new FakeParam(30)
  ratio = new FakeParam(12)
  attack = new FakeParam(0.003)
  release = new FakeParam(0.25)
}
class FakePanner extends FakeNode {
  pan = new FakeParam(0)
}
class FakeAudioContext {
  currentTime = 0
  sampleRate = 48000
  state: 'suspended' | 'running' = 'suspended'
  destination = new FakeNode()
  resume() {
    this.state = 'running'
    return Promise.resolve()
  }
  createGain() {
    return new FakeGain()
  }
  createOscillator() {
    return new FakeOsc()
  }
  createBiquadFilter() {
    return new FakeBiquad()
  }
  createBufferSource() {
    return new FakeSource()
  }
  createDynamicsCompressor() {
    return new FakeCompressor()
  }
  createStereoPanner() {
    return new FakePanner()
  }
  createBuffer(_ch: number, len: number, sr: number) {
    const data = new Float32Array(len)
    return { length: len, sampleRate: sr, getChannelData: () => data }
  }
}

describe('with a fake AudioContext', () => {
  type Mods = {
    audio: typeof import('../src/audio/engine').audio
    sfx: typeof import('../src/audio/sfx').sfx
    music: typeof import('../src/audio/music').music
    ambience: typeof import('../src/audio/ambience').ambience
  }
  let m: Mods
  let ctx: FakeAudioContext
  const g = globalThis as unknown as { window?: unknown }

  beforeAll(async () => {
    vi.resetModules()
    g.window = { AudioContext: FakeAudioContext }
    vi.useFakeTimers()
    m = {
      audio: (await import('../src/audio/engine')).audio,
      sfx: (await import('../src/audio/sfx')).sfx,
      music: (await import('../src/audio/music')).music,
      ambience: (await import('../src/audio/ambience')).ambience,
    }
  })
  afterAll(() => {
    vi.useRealTimers()
    delete g.window
    vi.resetModules()
  })

  /** Advance both clocks together, like a browser would. */
  const advance = (ms: number) => {
    const slices = Math.ceil(ms / 10)
    for (let i = 0; i < slices; i++) {
      ctx.currentTime += 0.01
      vi.advanceTimersByTime(10)
    }
  }

  it('unlock builds master → compressor and the two buses, and resumes', () => {
    expect(m.audio.ctx).toBeNull()
    m.music.play('title') // requested before the gesture: must start after unlock
    m.audio.unlock()
    ctx = m.audio.ctx as unknown as FakeAudioContext
    expect(ctx).toBeInstanceOf(FakeAudioContext)
    expect(ctx.state).toBe('running')
    expect(m.audio.master).toBeTruthy()
    expect(m.audio.musicBus).toBeTruthy()
    expect(m.audio.sfxBus).toBeTruthy()
    const master = m.audio.master as unknown as FakeGain
    expect((m.audio.musicBus as unknown as FakeGain).connected).toContain(master)
    expect((m.audio.sfxBus as unknown as FakeGain).connected).toContain(master)
    expect(master.connected[0]).toBeInstanceOf(FakeCompressor)
    expect((master.connected[0] as FakeCompressor).connected).toContain(ctx.destination)
    // quadratic curve on the defaults
    expect(master.gain.value).toBeCloseTo(0.64, 6)
    expect((m.audio.musicBus as unknown as FakeGain).gain.value).toBeCloseTo(0.36, 6)
    m.audio.setVolumes({ master: 1, music: 0, sfx: 0.5 })
    expect(m.audio.unlock).not.toThrow()
    // the title track requested before unlock is now the current one
    expect(m.music.current).toBe('title')
  })

  it('every sfx runs its synthesis without throwing', () => {
    for (const name of SOUND_NAMES) {
      const before = stats.oscStarted + stats.srcStarted
      ctx.currentTime += 0.5 // clear the footstep rate limit
      expect(() => (m.sfx as unknown as Record<string, () => void>)[name](), name).not.toThrow()
      expect(stats.oscStarted + stats.srcStarted, `${name} made a sound`).toBeGreaterThan(before)
    }
    expect(stats.rampErrors).toBe(0)
  })

  it('rate-limits footsteps', () => {
    ctx.currentTime += 1
    const before = stats.oscStarted + stats.srcStarted
    m.sfx.step_grass()
    const one = stats.oscStarted + stats.srcStarted
    expect(one).toBeGreaterThan(before)
    m.sfx.step_grass()
    m.sfx.step_stone()
    expect(stats.oscStarted + stats.srcStarted).toBe(one)
    ctx.currentTime += 0.2
    m.sfx.step_wood()
    expect(stats.oscStarted + stats.srcStarted).toBeGreaterThan(one)
  })

  it('muting silences sfx', () => {
    ctx.currentTime += 1
    m.sfx.setMuted(true)
    const before = stats.oscStarted + stats.srcStarted
    m.sfx.coin()
    m.sfx.step_grass()
    expect(stats.oscStarted + stats.srcStarted).toBe(before)
    m.sfx.setMuted(false)
  })

  it('the sequencer keeps scheduling notes ahead of the audio clock', () => {
    m.music.play('day', 100)
    expect(m.music.current).toBe('day')
    const before = stats.oscStarted + stats.srcStarted
    advance(2000) // ~3.5 beats of the day track
    const after = stats.oscStarted + stats.srcStarted
    expect(after - before).toBeGreaterThan(30)
    // keeps going: another 2 s schedules more
    advance(2000)
    expect(stats.oscStarted + stats.srcStarted).toBeGreaterThan(after)
    expect(stats.rampErrors).toBe(0)
  })

  it('crossfades, overlays the fanfare, and stops cleanly', () => {
    m.music.play('night')
    expect(m.music.current).toBe('night')
    m.music.play('fanfare')
    expect(m.music.current).toBe('night') // the one-shot does not replace the loop
    advance(6000) // fanfare (3.75 s) + tail: its onDone restores the loop
    expect(m.music.current).toBe('night')
    m.music.setIntensity(0.2)
    m.music.setIntensity(1)
    m.music.stop(200)
    expect(m.music.current).toBeNull()
    advance(1000)
    const idle = stats.oscStarted + stats.srcStarted
    advance(1000)
    expect(stats.oscStarted + stats.srcStarted).toBe(idle) // nothing scheduled after stop
    expect(stats.rampErrors).toBe(0)
  })

  it('ambience builds its bed on demand, chirps by day, and tears down after stop', () => {
    const before = stats.srcStarted + stats.oscStarted
    m.ambience.set({ coast: 1, woods: 0.5, night: 0, rain: 1, interior: 0.5 })
    expect(stats.srcStarted + stats.oscStarted).toBeGreaterThan(before)
    const bedStarted = stats.srcStarted + stats.oscStarted
    advance(20000) // birds / gulls / drips are randomised; 20 s is plenty for at least one
    expect(stats.oscStarted + stats.srcStarted).toBeGreaterThan(bedStarted)
    m.ambience.set({ night: 1 })
    m.ambience.stop()
    advance(2500)
    const quiet = stats.oscStarted + stats.srcStarted
    advance(5000)
    expect(stats.oscStarted + stats.srcStarted).toBe(quiet)
    // and it can come back
    m.ambience.set({ wind: 1 })
    expect(stats.oscStarted + stats.srcStarted).toBeGreaterThan(quiet)
    m.ambience.stop()
    advance(3000)
    expect(stats.rampErrors).toBe(0)
  })
})
