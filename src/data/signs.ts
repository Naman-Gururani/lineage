// Finger posts. Each junction carries a post whose arms name a real attraction
// and point at it: `SIGN_TARGETS` holds the as-built world anchor behind every
// label, and `tests/signs.test.ts` checks each arm's heading is within ±45° of
// the true bearing, so an arrow never lies about where a path goes.
//
//   gate      — just inside the turnstile, where the avenue meets the apron
//   midway_w  — west end of the Midway (Prize Row: the tent, the chalk booth)
//   midway_e  — east end of the Midway (Game Row: the forge, the arcade)
//   hill      — halfway up the avenue, under Coaster Hill
//   pond      — the Duck Pond path, west corner
//   wheel     — the Wheel Lawn, east side

export type SignDir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export type SignArm = {
  dir: SignDir
  /** The destination as it is written on the arm; the key into `SIGN_TARGETS`. */
  label: string
  /** Small print under the label — a hint or an aside. */
  note?: string
}

export type SignDef = {
  id: string
  /** tile the post stands on (matches its `sign_finger` prop in the blueprint) */
  tx: number
  ty: number
  arms: SignArm[]
}

export const SIGNS: SignDef[] = [
  {
    id: 'gate',
    // Just inside the turnstile and clear of the arch's own footprint, which
    // runs y 48–51: Task 1 nudged the post one row further up the avenue.
    tx: 35,
    ty: 47,
    arms: [
      { dir: 'N', label: 'The Midway', note: 'stalls, games and the fountain' },
      { dir: 'E', label: 'Guestbook', note: 'say hello on your way out' },
      { dir: 'NW', label: 'Duck Pond' },
      { dir: 'S', label: 'The Gate', note: 'the way out' },
    ],
  },
  {
    id: 'midway_w',
    tx: 25,
    ty: 41,
    arms: [
      { dir: 'NE', label: 'Career Coaster', note: 'a hill for every year' },
      { dir: 'W', label: 'Prize Tent', note: 'his projects, as prizes' },
      { dir: 'SW', label: 'Chalk Flight' },
      { dir: 'NW', label: 'Duck Pond', note: 'hook a duck' },
    ],
  },
  {
    id: 'midway_e',
    tx: 46,
    ty: 41,
    arms: [
      { dir: 'N', label: 'Word Forge', note: 'spell out the toolkit' },
      { dir: 'NE', label: 'Ferris Wheel' },
      { dir: 'SE', label: 'Arcade', note: "Mira's crew game" },
      { dir: 'W', label: 'The Midway' },
    ],
  },
  {
    id: 'hill',
    tx: 35,
    ty: 22,
    arms: [
      { dir: 'E', label: 'Career Coaster', note: 'the station is at the foot' },
      { dir: 'SE', label: 'Ferris Wheel' },
      { dir: 'S', label: 'The Midway' },
    ],
  },
  {
    id: 'pond',
    tx: 16,
    ty: 32,
    arms: [
      { dir: 'NW', label: 'Duck Pond' },
      { dir: 'E', label: 'Career Coaster' },
      { dir: 'SE', label: 'The Midway' },
      { dir: 'S', label: 'Chalk Flight', note: 'mind the gaps' },
    ],
  },
  {
    id: 'wheel',
    tx: 54,
    ty: 30,
    arms: [
      { dir: 'E', label: 'Ferris Wheel', note: 'not running this year' },
      { dir: 'N', label: 'Career Coaster' },
      { dir: 'S', label: 'Guestbook' },
      { dir: 'SW', label: 'The Midway' },
    ],
  },
]

/**
 * Where each arm actually points, in tiles. Attraction labels anchor on the
 * door tile you interact from; the Midway anchors on the fountain, which is
 * what the paving leads to — a post points down a path, not at an average.
 */
export const SIGN_TARGETS: Record<string, { tx: number; ty: number }> = {
  'Career Coaster': { tx: 50, ty: 16 }, // the station door, at the foot of the structure
  'Prize Tent': { tx: 21, ty: 40 },
  'Word Forge': { tx: 46, ty: 40 },
  'Chalk Flight': { tx: 14, ty: 46 },
  Arcade: { tx: 54, ty: 45 },
  'Duck Pond': { tx: 15, ty: 31 }, // the hook-a-duck stall on the pond's edge
  Guestbook: { tx: 57, ty: 49 },
  'The Gate': { tx: 35, ty: 53 }, // the gate arch's own door tile, on the apron
  'Ferris Wheel': { tx: 61, ty: 32 }, // the Wheel Lawn the paths lead onto; the ride itself stands over it
  'The Midway': { tx: 35, ty: 42 }, // the fountain in the middle of the paving
}

/** The post standing at `id`, or undefined. */
export function signById(id: string): SignDef | undefined {
  return SIGNS.find((s) => s.id === id)
}
