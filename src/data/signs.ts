// Finger posts. Each junction carries a post whose arms name a real place and
// point at it: `SIGN_TARGETS` holds the as-built world anchor behind every
// label, and `tests/signs.test.ts` checks each arm's heading is within ±45° of
// the true bearing, so an arrow never lies about where a road goes.
//
//   harbor        — the harbor green, where the plaza road meets the warehouse spur
//   plaza_w       — west side of the village plaza (roads to the Heights and the Fairground)
//   plaza_e       — east side of the village plaza (roads to the campus and the fields)
//   campus        — the campus gate, where the workshop road forks off
//   bridge_tower  — the upper bridge over the Stream
//   bridge_engine — the lower bridge, on the Fairground road
//   ridge         — foot of the Stone Ridge ramp, below the Vault
//   willow        — the Willow Fields road, between the brook and Safe Stride

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
    id: 'harbor',
    tx: 50,
    ty: 57,
    arms: [
      { dir: 'N', label: 'Village Plaza' },
      { dir: 'S', label: 'Harbor · your boat' },
      { dir: 'W', label: 'Harbor Arcade', note: "Mira's crew game" },
      { dir: 'E', label: 'Willow Fields' },
    ],
  },
  {
    id: 'plaza_w',
    tx: 43,
    ty: 40,
    arms: [
      { dir: 'NW', label: 'Barclays Tower — Experience' },
      { dir: 'SW', label: "The Fairground — Sol's Prize Tent", note: 'his projects, as prizes' },
      { dir: 'S', label: 'Harbor' },
    ],
  },
  {
    id: 'plaza_e',
    tx: 53,
    ty: 40,
    arms: [
      { dir: 'NE', label: 'SRM Campus — Education' },
      { dir: 'E', label: 'Safe Stride & The Point' },
      { dir: 'N', label: 'Stone Ridge — The Vault' },
    ],
  },
  {
    id: 'campus',
    tx: 62,
    ty: 32,
    arms: [
      { dir: 'NE', label: 'The Workshop — Skills' },
      { dir: 'SW', label: 'Village Plaza' },
      { dir: 'N', label: 'Whispering Woods' },
    ],
  },
  {
    id: 'bridge_tower',
    tx: 30,
    ty: 37,
    arms: [
      { dir: 'NW', label: 'Tower Heights (ramp ahead)' },
      { dir: 'SE', label: 'Village Plaza' },
    ],
  },
  {
    id: 'bridge_engine',
    tx: 26,
    ty: 51,
    arms: [
      { dir: 'W', label: 'The Fairground' },
      { dir: 'E', label: 'Village Plaza & Harbor' },
    ],
  },
  {
    id: 'ridge',
    tx: 48,
    ty: 17,
    arms: [
      { dir: 'N', label: 'The Vault (sealed?)' },
      { dir: 'S', label: 'The Cottage — About Naman' },
    ],
  },
  {
    id: 'willow',
    tx: 70,
    ty: 54,
    arms: [
      { dir: 'E', label: 'The Point — Lighthouse · Contact' },
      { dir: 'W', label: 'Village Plaza' },
      // The as-built brook is a straight north–south channel at x=66, so from
      // this post the crossing lies north-*west*, not north (controller ruling).
      { dir: 'NW', label: 'the brook — try jumping it' },
    ],
  },
]

/**
 * Where each arm actually points, in tiles. Landmark labels anchor on the
 * building's door; region labels anchor on a spot inside the region that the
 * roads lead to, not its centroid — a post points down a road, not at an
 * average.
 */
export const SIGN_TARGETS: Record<string, { tx: number; ty: number }> = {
  'Village Plaza': { tx: 48, ty: 40 }, // the fountain
  'Village Plaza & Harbor': { tx: 48, ty: 40 },
  Harbor: { tx: 48, ty: 59 }, // the pier head
  'Harbor · your boat': { tx: 48, ty: 63 }, // your boat, moored halfway down the pier
  'Harbor Arcade': { tx: 44, ty: 58 }, // warehouse door
  'Willow Fields': { tx: 74, ty: 48 }, // the fields, north of Safe Stride
  'Whispering Woods': { tx: 66, ty: 17 }, // the near stand of the woods, above the campus
  'Tower Heights (ramp ahead)': { tx: 23, ty: 21 }, // Barclays Tower door, top of the ramp
  'Barclays Tower — Experience': { tx: 23, ty: 21 },
  'The Fairground': { tx: 19, ty: 52 }, // the door of the prize tent
  "The Fairground — Sol's Prize Tent": { tx: 19, ty: 52 },
  'SRM Campus — Education': { tx: 60, ty: 30 }, // campus door
  'The Workshop — Skills': { tx: 71, ty: 20 }, // workshop door
  'Safe Stride & The Point': { tx: 73, ty: 52 }, // Safe Stride door, first stop on that road
  'Stone Ridge — The Vault': { tx: 49, ty: 11 }, // the Vault door on the ridge
  'The Vault (sealed?)': { tx: 49, ty: 11 },
  'The Cottage — About Naman': { tx: 48, ty: 34 }, // cottage door
  'The Point — Lighthouse · Contact': { tx: 88, ty: 64 }, // lighthouse door
  'the brook — try jumping it': { tx: 66, ty: 48 }, // where the fields road meets the brook
}

/** The post standing at `id`, or undefined. */
export function signById(id: string): SignDef | undefined {
  return SIGNS.find((s) => s.id === id)
}
