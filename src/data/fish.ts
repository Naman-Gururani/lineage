// What lives under the pier: the species table, how long a bite window stays
// open, how wide the net is, and the journal's line about it all.
//
// Pure — no Phaser, no scene, no DOM. `systems/Fishing.ts` is the view that
// plays these rules out at the water's edge; `ui/journal.ts` only wants the
// summary, and must not drag a renderer in behind it to get one.
import type { Rng } from '../core/rng'
import type { Save } from '../core/save'

export type FishId = 'sardine' | 'parrot' | 'golden'

/**
 * What is in the water, commonest first. The chances add to exactly one and the
 * roll walks the table in order, so adding a species is a matter of editing the
 * list — there is no second place that has to agree with it.
 */
export const FISH_TABLE: { id: FishId; p: number }[] = [
  { id: 'sardine', p: 0.62 },
  { id: 'parrot', p: 0.33 },
  { id: 'golden', p: 0.05 },
]

export const FISH_NAMES: Record<string, string> = { sardine: 'Sardine', parrot: 'Parrotfish', golden: 'Goldfish' }

/** The one jumping-fish sprite, tinted per species. */
export const FISH_TINTS: Record<string, number> = { sardine: 0xbcd7ea, parrot: 0x59f3a6, golden: 0xffd23f }

/** Seconds to strike after the tug: 1.6 to begin with, tightening to 0.9 by the tenth fish. */
export const BITE = { BASE: 1.6, PER_CATCH: 0.07, CAP: 10, FLOOR: 0.9 } as const

/** The net got 15% wider than the first draft, which was a fight and not a game. */
export const REEL_TOLERANCE = 1.15

/** How long the strike window stays open for someone who has landed `catches` already. */
export function biteWindow(catches: number): number {
  const n = Math.min(BITE.CAP, Math.max(0, Math.floor(catches) || 0))
  return Math.max(BITE.FLOOR, BITE.BASE - BITE.PER_CATCH * n)
}

/** Set by `?fish=gold`, which is how the golden one is demonstrated on request. */
let forced: FishId | null = null

export function setForcedFish(id: FishId | null): void {
  forced = id
}

export function forcedFish(): FishId | null {
  return forced
}

/** `?fish=gold` — the only value that means anything — read the way `?fresh` is. */
export function parseFishFlag(search: string): FishId | null {
  try {
    return new URLSearchParams(search).get('fish') === 'gold' ? 'golden' : null
  } catch {
    return null
  }
}

/** Pick a species from a roll in [0, 1). The forced flag, when set, wins outright. */
export function rollFish(roll: number): FishId {
  if (forced) return forced
  let acc = 0
  for (const f of FISH_TABLE) {
    acc += f.p
    if (roll < acc) return f.id
  }
  return FISH_TABLE[FISH_TABLE.length - 1].id
}

/**
 * What is on the hook this cast.
 *
 * Off a fork of its own rather than the next number in the scene's stream: on
 * the shared stream the very first cast of every save drew the same value, so
 * every player on the island landed the same first fish. One fork per catch
 * count instead — which also means a fish that got away is the same fish waiting
 * on the next cast, since the fork does not care where the parent stream has got
 * to. `?fish=gold` still wins outright.
 */
export function castSpecies(rng: Rng, catches: number): FishId {
  return rollFish(rng.fork(`fish:${catches}`).next())
}

/**
 * Write one catch into the save: the per-species tally and the total the journal
 * has always shown. Returns true when it was the golden one, which is the badge.
 */
export function landFish(save: Save, id: FishId): boolean {
  if (!save.fish) save.fish = {}
  save.fish[id] = (save.fish[id] ?? 0) + 1
  save.stats.fishCaught += 1
  return id === 'golden'
}

/**
 * The journal's line: how many of the three species have been landed, and how
 * many of each, commonest first. Lives beside the table so the table stays the
 * only list.
 */
export function fishSummary(fish: Record<string, number>): string {
  const landed = FISH_TABLE.filter((f) => (fish?.[f.id] ?? 0) > 0)
  if (!landed.length) return 'None yet'
  return `${landed.length} / ${FISH_TABLE.length} — ${landed.map((f) => `${FISH_NAMES[f.id]} ×${fish[f.id]}`).join(' · ')}`
}
