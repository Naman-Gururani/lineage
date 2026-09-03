// Song data for the step sequencer in music.ts, plus the pure helpers that turn
// readable note strings into events (unit-tested in tests/audio.test.ts).
//
// Pattern grammar — one token per 16th note, whitespace separated:
//   C4 F#3 Bb2   note (A4 = 440 Hz)          -   rest
//   ~            tie: extend the previous note(s) by one step
//   C4+E4+G4     chord: several notes starting on the same step
//   k h H s r    drums: kick, closed hat, open/accented hat, soft snare, rim
//   |            bar line (ignored, purely for readability)

export type TrackId = 'title' | 'day' | 'night' | 'interior' | 'tower' | 'engine' | 'fanfare'

export type DrumKind = 'k' | 'h' | 'H' | 's' | 'r'
export type InstrumentKind = 'lead' | 'bell' | 'bass' | 'sub' | 'pad' | 'pulse' | 'perc'

export type NoteEvent = { step: number; freq: number; dur: number; drum?: DrumKind }

export type Voice = {
  name: string
  inst: InstrumentKind
  pattern: string
  /** Linear gain multiplier for this voice (default 1). */
  gain?: number
  /** Semitone offset applied when parsing. */
  transpose?: number
  /** Override the instrument's lowpass cutoff in Hz (lead/bass/pad/pulse). */
  cutoff?: number
}

export type Song = {
  bpm: number
  /** 0..1 — how far odd 16ths are pushed late (1 = full triplet swing). */
  swing?: number
  loop: boolean
  voices: Voice[]
}

const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/
const DRUM_RE = /^[khHsr]$/
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Note name → frequency in Hz (equal temperament, A4 = 440). Throws on bad names. */
export function noteFreq(name: string, transpose = 0): number {
  const m = NOTE_RE.exec(name)
  if (!m) throw new Error(`bad note "${name}"`)
  const semi = SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  const midi = 12 * (parseInt(m[3], 10) + 1) + semi + transpose
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function tokensOf(pattern: string): string[] {
  return pattern.split(/\s+/).filter((t) => t.length > 0 && t !== '|')
}

/** Number of 16th steps in a pattern. */
export function stepsOf(pattern: string): number {
  return tokensOf(pattern).length
}

/** Parse a pattern into note/drum events. `dur` is in steps (ties add to it). */
export function parsePattern(pattern: string, transpose = 0): NoteEvent[] {
  const events: NoteEvent[] = []
  let last: NoteEvent[] = []
  tokensOf(pattern).forEach((tok, step) => {
    if (tok === '-') {
      last = []
      return
    }
    if (tok === '~') {
      for (const e of last) e.dur++
      return
    }
    if (DRUM_RE.test(tok)) {
      const e: NoteEvent = { step, freq: 0, dur: 1, drum: tok as DrumKind }
      events.push(e)
      last = [e]
      return
    }
    last = tok.split('+').map((n) => ({ step, freq: noteFreq(n, transpose), dur: 1 }))
    events.push(...last)
  })
  return events
}

/** Seconds per 16th step at a tempo. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4
}

/** Loop length of a song (all voices must agree; the first voice is authoritative). */
export function loopLength(song: Song): { steps: number; bars: number; seconds: number } {
  const steps = song.voices.length ? stepsOf(song.voices[0].pattern) : 0
  return { steps, bars: steps / 16, seconds: steps * stepSeconds(song.bpm) }
}

// ---------------------------------------------------------------------------
// Composition helpers (they only build strings; the result is still readable
// pattern text — call `tokensOf` on any voice to see it).

const bars = (...b: string[]) => b.join(' | ')
const rep = (bar: string, n: number) => bars(...new Array<string>(n).fill(bar))
/** One token held for `n` steps. */
const hold = (tok: string, n = 16) => [tok, ...new Array<string>(n - 1).fill('~')].join(' ')

// ---------------------------------------------------------------------------
// DAY — bright & cozy, D major, I–V–vi–IV, 104 BPM. 16 bars: A (8) + B (8).

const D_PAD: Record<string, string> = { D: 'D3+F#3+A3', A: 'C#3+E3+A3', Bm: 'D3+F#3+B3', G: 'D3+G3+B3' }
const D_BASS: Record<string, [string, string]> = { D: ['D2', 'A2'], A: ['A2', 'E2'], Bm: ['B2', 'F#2'], G: ['G2', 'D2'] }
const DAY_CHORDS = ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'A']

const walkBass = ([r, f]: [string, string]) => `${r} ~ - - ${r} ~ - - ${f} ~ - - ${r} ~ - -`

const day: Song = {
  bpm: 104,
  loop: true,
  voices: [
    {
      name: 'lead',
      inst: 'lead',
      pattern: bars(
        // A section — the tune
        'F#4 ~ A4 ~ D5 ~ ~ ~ E5 ~ D5 ~ A4 ~ ~ ~', // D
        'E5 ~ C#5 ~ A4 ~ ~ ~ B4 ~ C#5 ~ E5 ~ ~ ~', // A
        'F#5 ~ D5 ~ B4 ~ ~ ~ D5 ~ E5 ~ F#5 ~ ~ ~', // Bm
        'G5 ~ F#5 ~ E5 ~ ~ ~ D5 ~ ~ ~ ~ ~ ~ ~', // G
        'F#4 ~ A4 ~ D5 ~ ~ ~ E5 ~ D5 ~ A4 ~ ~ ~', // D
        'E5 ~ C#5 ~ A4 ~ ~ ~ B4 ~ C#5 ~ E5 ~ F#5 ~', // A
        'G5 ~ F#5 ~ D5 ~ ~ ~ B4 ~ D5 ~ E5 ~ ~ ~', // Bm
        'F#5 ~ E5 ~ D5 ~ E5 ~ D5 ~ ~ ~ ~ ~ ~ ~', // G
        // B section — higher, more lyrical, lands on V for the loop
        'B4 ~ D5 ~ G5 ~ ~ ~ F#5 ~ E5 ~ D5 ~ ~ ~', // G
        'A4 ~ D5 ~ F#5 ~ ~ ~ E5 ~ D5 ~ A4 ~ ~ ~', // D
        'C#5 ~ E5 ~ A5 ~ ~ ~ G5 ~ F#5 ~ E5 ~ ~ ~', // A
        'F#5 ~ ~ ~ D5 ~ ~ ~ B4 ~ ~ ~ ~ ~ ~ ~', // Bm
        'B4 ~ D5 ~ G5 ~ ~ ~ A5 ~ G5 ~ F#5 ~ ~ ~', // G
        'A5 ~ F#5 ~ D5 ~ ~ ~ E5 ~ F#5 ~ A5 ~ ~ ~', // D
        'G5 ~ F#5 ~ E5 ~ ~ ~ C#5 ~ D5 ~ E5 ~ ~ ~', // A
        'E5 ~ ~ ~ ~ ~ ~ ~ C#5 ~ ~ ~ - - - -', // A
      ),
    },
    { name: 'bass', inst: 'bass', gain: 0.9, pattern: bars(...DAY_CHORDS.map((c) => walkBass(D_BASS[c]))) },
    { name: 'pad', inst: 'pad', pattern: bars(...DAY_CHORDS.map((c) => hold(D_PAD[c]))) },
    {
      name: 'perc',
      inst: 'perc',
      gain: 0.8,
      pattern: bars(
        rep('k - h - r - h - k - h - r - h h', 7),
        'k - h - r - h - k - h h r - h H',
        rep('k - h - r - h - k - h - r - h h', 7),
        'k - h - r - h - k - r - r - H -',
      ),
    },
  ],
}

// ---------------------------------------------------------------------------
// NIGHT — the same chords at 84 BPM, pad-led, sparse lead, no drums.

const NIGHT_CHORDS = ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G']
const halfBass = ([r, f]: [string, string]) => `${hold(r, 8)} ${hold(f, 8)}`

const night: Song = {
  bpm: 84,
  loop: true,
  voices: [
    {
      name: 'lead',
      inst: 'lead',
      gain: 0.7,
      cutoff: 1400,
      pattern: bars(
        'A4 ~ ~ ~ ~ ~ ~ ~ F#4 ~ ~ ~ ~ ~ ~ ~', // D
        'E4 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ - - - -', // A
        'D5 ~ ~ ~ ~ ~ B4 ~ ~ ~ ~ ~ ~ ~ ~ ~', // Bm
        'A4 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ - - - -', // G
        'F#4 ~ ~ ~ ~ ~ ~ ~ A4 ~ ~ ~ D5 ~ ~ ~', // D
        'C#5 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ - - - -', // A
        'B4 ~ ~ ~ D5 ~ ~ ~ F#5 ~ ~ ~ ~ ~ ~ ~', // Bm
        'E5 ~ ~ ~ ~ ~ ~ ~ D5 ~ ~ ~ ~ ~ ~ ~', // G
      ),
    },
    { name: 'bass', inst: 'sub', gain: 0.8, pattern: bars(...NIGHT_CHORDS.map((c) => halfBass(D_BASS[c]))) },
    { name: 'pad', inst: 'pad', gain: 1.15, pattern: bars(...NIGHT_CHORDS.map((c) => hold(D_PAD[c]))) },
  ],
}

// ---------------------------------------------------------------------------
// INTERIOR — music box in C, 96 BPM. Bell melody over a bell arpeggio.

const interior: Song = {
  bpm: 96,
  loop: true,
  voices: [
    {
      name: 'lead',
      inst: 'bell',
      pattern: bars(
        'G5 ~ E5 ~ C6 ~ ~ ~ E6 ~ D6 ~ C6 ~ ~ ~', // C
        'B5 ~ G5 ~ E6 ~ ~ ~ D6 ~ B5 ~ G5 ~ ~ ~', // Em
        'A5 ~ F5 ~ C6 ~ ~ ~ A5 ~ ~ ~ F5 ~ ~ ~', // F
        'G5 ~ B5 ~ D6 ~ ~ ~ B5 ~ ~ ~ ~ ~ ~ ~', // G
        'E6 ~ ~ ~ D6 ~ C6 ~ G5 ~ ~ ~ E5 ~ ~ ~', // C
        'A5 ~ C6 ~ E6 ~ ~ ~ D6 ~ C6 ~ B5 ~ ~ ~', // Am
        'C6 ~ A5 ~ F5 ~ ~ ~ A5 ~ B5 ~ C6 ~ ~ ~', // F
        'B5 ~ ~ ~ D6 ~ ~ ~ G5 ~ ~ ~ ~ ~ ~ ~', // G
      ),
    },
    {
      name: 'arp',
      inst: 'bell',
      gain: 0.45,
      pattern: bars(
        'C4 ~ E4 ~ G4 ~ E4 ~ C4 ~ E4 ~ G4 ~ E4 ~', // C
        'E4 ~ G4 ~ B4 ~ G4 ~ E4 ~ G4 ~ B4 ~ G4 ~', // Em
        'F4 ~ A4 ~ C5 ~ A4 ~ F4 ~ A4 ~ C5 ~ A4 ~', // F
        'G4 ~ B4 ~ D5 ~ B4 ~ G4 ~ B4 ~ D5 ~ B4 ~', // G
        'C4 ~ E4 ~ G4 ~ E4 ~ C4 ~ E4 ~ G4 ~ E4 ~', // C
        'A4 ~ C5 ~ E5 ~ C5 ~ A4 ~ C5 ~ E5 ~ C5 ~', // Am
        'F4 ~ A4 ~ C5 ~ A4 ~ F4 ~ A4 ~ C5 ~ A4 ~', // F
        'G4 ~ B4 ~ D5 ~ B4 ~ G4 ~ B4 ~ D5 ~ B4 ~', // G
      ),
    },
  ],
}

// ---------------------------------------------------------------------------
// TOWER — soft lounge bossa, 112 BPM, light swing. IV–V–iii–vi / IV–V–I–I in C.

const T_CHORDS = ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C']
const T_PAD: Record<string, string> = { F: 'A3+C4+E4', G: 'B3+D4+F4', Em: 'G3+B3+D4', Am: 'C4+E4+G4', C: 'E3+G3+B3' }
const T_BASS: Record<string, [string, string]> = {
  F: ['F2', 'C3'],
  G: ['G2', 'D3'],
  Em: ['E2', 'B2'],
  Am: ['A2', 'E3'],
  C: ['C2', 'G2'],
}
const bossaBass = ([r, f]: [string, string]) => `${r} ~ ~ ~ ~ ~ ${r} ~ ${f} ~ ~ ~ ~ ~ ${f} ~`

const tower: Song = {
  bpm: 112,
  swing: 0.35,
  loop: true,
  voices: [
    {
      name: 'lead',
      inst: 'lead',
      gain: 0.8,
      cutoff: 1300,
      pattern: bars(
        '- - A4 ~ C5 ~ E5 ~ ~ ~ ~ ~ D5 ~ C5 ~', // Fmaj7
        'B4 ~ ~ ~ ~ ~ ~ ~ - - D5 ~ B4 ~ G4 ~', // G7
        'G4 ~ ~ ~ B4 ~ D5 ~ ~ ~ ~ ~ E5 ~ D5 ~', // Em7
        'C5 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ - - - -', // Am7
        '- - A4 ~ C5 ~ E5 ~ ~ ~ ~ ~ F5 ~ E5 ~', // Fmaj7
        'D5 ~ ~ ~ ~ ~ ~ ~ - - B4 ~ D5 ~ F5 ~', // G7
        'E5 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ C5 ~ D5 ~', // Cmaj7
        'E5 ~ ~ ~ ~ ~ ~ ~ - - - - - - - -', // Cmaj7
      ),
    },
    { name: 'bass', inst: 'bass', gain: 0.8, pattern: bars(...T_CHORDS.map((c) => bossaBass(T_BASS[c]))) },
    { name: 'pad', inst: 'pad', gain: 0.9, pattern: bars(...T_CHORDS.map((c) => hold(T_PAD[c]))) },
    { name: 'rim', inst: 'perc', gain: 0.6, pattern: rep('r - - r - - r - - - r - r - - -', 8) },
    { name: 'hat', inst: 'perc', gain: 0.5, pattern: rep('h - h - h - h - h - h - h - h -', 8) },
  ],
}

// ---------------------------------------------------------------------------
// ENGINE — steady mechanical pulse, E minor, 120 BPM, filtered square arpeggio.

const E_CHORDS = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'D']
const E_PAD: Record<string, string> = { Em: 'E3+G3+B3', C: 'C3+E3+G3', D: 'D3+F#3+A3' }
const E_ROOT: Record<string, string> = { Em: 'E2', C: 'C2', D: 'D2' }
const E_ARP_UP: Record<string, string> = {
  Em: 'E3 B3 E4 G4 B4 G4 E4 B3 E3 B3 E4 G4 B4 G4 E4 B3',
  C: 'C3 G3 C4 E4 G4 E4 C4 G3 C3 G3 C4 E4 G4 E4 C4 G3',
  D: 'D3 A3 D4 F#4 A4 F#4 D4 A3 D3 A3 D4 F#4 A4 F#4 D4 A3',
}
const E_ARP_DOWN: Record<string, string> = {
  Em: 'B4 G4 E4 B3 E3 B3 E4 G4 B4 G4 E4 B3 E3 B3 E4 G4',
  C: 'G4 E4 C4 G3 C3 G3 C4 E4 G4 E4 C4 G3 C3 G3 C4 E4',
  D: 'A4 F#4 D4 A3 D3 A3 D4 F#4 A4 F#4 D4 A3 D3 A3 D4 F#4',
}
const pulseBass = (r: string) => `${r} - ${r} - ${r} - ${r} - ${r} - ${r} - ${r} - ${r} -`

const engine: Song = {
  bpm: 120,
  loop: true,
  voices: [
    {
      name: 'arp',
      inst: 'pulse',
      pattern: bars(...E_CHORDS.map((c, i) => (i < 4 ? E_ARP_UP[c] : E_ARP_DOWN[c]))),
    },
    { name: 'bass', inst: 'bass', gain: 0.9, pattern: bars(...E_CHORDS.map((c) => pulseBass(E_ROOT[c]))) },
    { name: 'pad', inst: 'pad', gain: 0.6, pattern: bars(...E_CHORDS.map((c) => hold(E_PAD[c]))) },
    { name: 'perc', inst: 'perc', gain: 0.9, pattern: rep('k - h - s - h - k - h - s - h -', 8) },
  ],
}

// ---------------------------------------------------------------------------
// TITLE — dreamy pad + slow bell arpeggio, D major, 72 BPM.

const TI_CHORDS = ['Dmaj7', 'F#m7', 'Gmaj7', 'A', 'Dmaj7', 'F#m7', 'Gmaj7', 'Asus']
const TI_PAD: Record<string, string> = {
  Dmaj7: 'F#3+A3+C#4',
  'F#m7': 'F#3+A3+C#4',
  Gmaj7: 'B3+D4+F#4',
  A: 'A3+C#4+E4',
  Asus: 'A3+D4+E4',
}
const TI_ROOT: Record<string, string> = { Dmaj7: 'D2', 'F#m7': 'F#2', Gmaj7: 'G2', A: 'A2', Asus: 'A2' }
const TI_ARP: Record<string, string> = {
  Dmaj7: 'D4 ~ F#4 ~ A4 ~ C#5 ~ D5 ~ C#5 ~ A4 ~ F#4 ~',
  'F#m7': 'F#4 ~ A4 ~ C#5 ~ E5 ~ F#5 ~ E5 ~ C#5 ~ A4 ~',
  Gmaj7: 'G4 ~ B4 ~ D5 ~ F#5 ~ G5 ~ F#5 ~ D5 ~ B4 ~',
  A: 'A4 ~ C#5 ~ E5 ~ A5 ~ E5 ~ C#5 ~ A4 ~ E4 ~',
  Asus: 'A4 ~ D5 ~ E5 ~ A5 ~ ~ ~ ~ ~ ~ ~ ~ ~',
}

const title: Song = {
  bpm: 72,
  loop: true,
  voices: [
    { name: 'arp', inst: 'bell', gain: 0.55, pattern: bars(...TI_CHORDS.map((c) => TI_ARP[c])) },
    { name: 'pad', inst: 'pad', gain: 1.2, pattern: bars(...TI_CHORDS.map((c) => hold(TI_PAD[c]))) },
    { name: 'bass', inst: 'sub', gain: 0.7, pattern: bars(...TI_CHORDS.map((c) => hold(TI_ROOT[c]))) },
  ],
}

// ---------------------------------------------------------------------------
// FANFARE — one triumphant phrase (~3.5 s at 128 BPM), plays once.

const fanfare: Song = {
  bpm: 128,
  loop: false,
  voices: [
    {
      name: 'lead',
      inst: 'lead',
      cutoff: 3200,
      pattern: bars('D5 ~ - - D5 ~ - - D5 ~ ~ ~ F#5 ~ ~ ~', 'A5 ~ ~ ~ ~ ~ ~ ~ D6 ~ ~ ~ ~ ~ ~ ~'),
    },
    {
      name: 'harmony',
      inst: 'lead',
      gain: 0.5,
      cutoff: 2600,
      pattern: bars('- - - - - - - - - - - - A4 ~ ~ ~', 'F#5 ~ ~ ~ ~ ~ ~ ~ A5 ~ ~ ~ ~ ~ ~ ~'),
    },
    { name: 'pad', inst: 'pad', pattern: bars(hold('D3+F#3+A3'), `${hold('G3+B3+D4', 8)} ${hold('D4+F#4+A4', 8)}`) },
    { name: 'bass', inst: 'bass', pattern: bars('D2 ~ ~ ~ - - - - D2 ~ ~ ~ - - - -', 'G2 ~ ~ ~ ~ ~ ~ ~ D2 ~ ~ ~ ~ ~ ~ ~') },
    { name: 'perc', inst: 'perc', pattern: bars('k - - - k - - - k - h - k - h -', 'k - - - - - - - k - - - - - - -') },
  ],
}

export const SONGS: Record<TrackId, Song> = { title, day, night, interior, tower, engine, fanfare }
