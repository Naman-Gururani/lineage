// What floats on Tomas's pond: the duck table, how long a bite window stays
// open, how wide the hoop is, and the journal's line about it all.
//
// Pure — no Phaser, no scene, no DOM. `systems/Ducks.ts` is the view that plays
// these rules out at the water's edge; `ui/journal.ts` only wants the summary,
// and must not drag a renderer in behind it to get one.
//
// This is the pier's fishing table re-skinned for the fair, mechanics and
// numbers untouched: the ducks are what the hook comes up with now, and the
// save keeps counting them in the field it always used.
import type { Rng } from '../core/rng'
import type { Save } from '../core/save'

export type DuckId = 'rubber' | 'spotted' | 'golden'

/**
 * What is on the water, commonest first. The chances add to exactly one and the
 * roll walks the table in order, so adding a duck is a matter of editing the
 * list — there is no second place that has to agree with it.
 */
export const DUCK_TABLE: { id: DuckId; p: number }[] = [
  { id: 'rubber', p: 0.62 },
  { id: 'spotted', p: 0.33 },
  { id: 'golden', p: 0.05 },
]

export const DUCK_NAMES: Record<string, string> = { rubber: 'Rubber duck', spotted: 'Spotted duck', golden: 'Golden duck' }

/** One painted duck per kind, from the fair pack; the stall falls back to a bobber. */
export const DUCK_FRAMES: Record<string, string> = { rubber: 'duck_0', spotted: 'duck_1', golden: 'duck_2' }

/** The tint the leaping duck takes when its own frame has not been painted yet. */
export const DUCK_TINTS: Record<string, number> = { rubber: 0xffd23f, spotted: 0xe6eef7, golden: 0xffb703 }

/** Seconds to strike after the tug: 1.6 to begin with, tightening to 0.9 by the tenth duck. */
export const BITE = { BASE: 1.6, PER_CATCH: 0.07, CAP: 10, FLOOR: 0.9 } as const

/** The hoop got 15% wider than the first draft, which was a fight and not a game. */
export const REEL_TOLERANCE = 1.15

/** How long the strike window stays open for someone who has landed `catches` already. */
export function biteWindow(catches: number): number {
  const n = Math.min(BITE.CAP, Math.max(0, Math.floor(catches) || 0))
  return Math.max(BITE.FLOOR, BITE.BASE - BITE.PER_CATCH * n)
}

/** Set by `?duck=gold`, which is how the golden one is demonstrated on request. */
let forced: DuckId | null = null

export function setForcedDuck(id: DuckId | null): void {
  forced = id
}

export function forcedDuck(): DuckId | null {
  return forced
}

/** `?duck=gold` — the only value that means anything — read the way `?fresh` is. */
export function parseDuckFlag(search: string): DuckId | null {
  try {
    return new URLSearchParams(search).get('duck') === 'gold' ? 'golden' : null
  } catch {
    return null
  }
}

/** Pick a duck from a roll in [0, 1). The forced flag, when set, wins outright. */
export function rollDuck(roll: number): DuckId {
  if (forced) return forced
  let acc = 0
  for (const d of DUCK_TABLE) {
    acc += d.p
    if (roll < acc) return d.id
  }
  return DUCK_TABLE[DUCK_TABLE.length - 1].id
}

/**
 * What is on the hook this go.
 *
 * Off a fork of its own rather than the next number in the scene's stream: on
 * the shared stream the very first hook of every save drew the same value, so
 * every player at the fair landed the same first duck. One fork per catch count
 * instead — which also means a duck that got away is the same duck waiting on
 * the next go, since the fork does not care where the parent stream has got to.
 * `?duck=gold` still wins outright.
 */
export function castDuck(rng: Rng, catches: number): DuckId {
  return rollDuck(rng.fork(`duck:${catches}`).next())
}

/**
 * Write one catch into the save: the per-kind tally and the total the journal
 * has always shown. Returns true when it was the golden one, which is the badge.
 *
 * The field is still called `fish` — the save's names are frozen across the
 * rebuild (only the labels changed), so an old file keeps counting into the
 * same place a new one does.
 */
export function landDuck(save: Save, id: DuckId): boolean {
  if (!save.fish) save.fish = {}
  save.fish[id] = (save.fish[id] ?? 0) + 1
  save.stats.fishCaught += 1
  return id === 'golden'
}

/**
 * The journal's line: how many of the three kinds have been hooked, and how many
 * of each, commonest first. Lives beside the table so the table stays the only
 * list.
 */
export function duckSummary(ducks: Record<string, number>): string {
  const landed = DUCK_TABLE.filter((d) => (ducks?.[d.id] ?? 0) > 0)
  if (!landed.length) return 'None yet'
  return `${landed.length} / ${DUCK_TABLE.length} — ${landed.map((d) => `${DUCK_NAMES[d.id]} ×${ducks[d.id]}`).join(' · ')}`
}
