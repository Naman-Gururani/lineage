// The story spine: the order Bo tells Naman's story in, where he stands while
// he waits for you to reach the next chapter, and the one line a locked card is
// allowed to say about how to open it.
//
// Suggestion, not enforcement. Every venue works whenever you get there; the
// order only decides which one the guide points at next.
import { BLUEPRINT } from '../world/blueprint'
import type { Vec2 } from '../world/regions'

export type StoryStep = 'meet' | 'experience' | 'projects' | 'education' | 'skills' | 'contact'

/** The order the story is *offered* in — the `story` quest's steps, in the same order. */
export const STORY_ORDER: readonly StoryStep[] = ['meet', 'experience', 'projects', 'education', 'skills', 'contact']

/** A stop on the tour: where the guide waits, and what he is waiting for. */
export type Station = { step: StoryStep; landmark: string; hint: string }

/**
 * The landmark a station points at is also the map pin the objective lights up.
 * The first two chapters happen at Bo's feet on the pier, which is not a
 * building at all — `PIER` is a sentinel no landmark answers to, so the map
 * marks the spot and leaves every pin alone. (It used to say `warehouse`, and
 * lit the arcade's pin for two chapters that have nothing to do with it.)
 */
export const PIER = 'pier'

export const STATIONS: Record<StoryStep, Station> = {
  meet: { step: 'meet', landmark: PIER, hint: 'Talk to Bo at the pier' },
  experience: { step: 'experience', landmark: PIER, hint: "Solve Bo's word puzzle at the pier" },
  projects: { step: 'projects', landmark: 'lineage', hint: "Sol's Prize Tent — west along the shore" },
  education: { step: 'education', landmark: 'education', hint: 'SRM Campus — north, on the green' },
  skills: { step: 'skills', landmark: 'skills', hint: 'The Workshop — north-east, past the woods' },
  contact: { step: 'contact', landmark: 'contact', hint: 'The Lighthouse — east, on the Point' },
}

/**
 * What a locked chapter card is allowed to say: where the game that opens it is
 * played, and nothing about what the chapter holds. Contact is never locked, so
 * it has nothing to say.
 */
export const STORY_HINTS: Record<string, string> = {
  about: 'Bo introduces Naman at the pier.',
  experience: "Solve Bo's word puzzle at the pier.",
  lineage: "Win it at Sol's Prize Tent on the fairground.",
  safestride: "Win it at Sol's Prize Tent on the fairground.",
  stealth: "Win the mystery box at Sol's Prize Tent.",
  education: 'Fly the chalkboard course at SRM Campus.',
  skills: 'Spell the toolkit at the Workshop bench.',
  contact: '',
}

/** Which step a chapter counts toward. The three projects share one. */
export const FACET_STEP: Record<string, StoryStep> = {
  about: 'meet',
  experience: 'experience',
  lineage: 'projects',
  safestride: 'projects',
  stealth: 'projects',
  education: 'education',
  skills: 'skills',
  contact: 'contact',
}

/** The first step still outstanding, or null once the story is told. */
export function nextStep(done: (s: StoryStep) => boolean): StoryStep | null {
  return STORY_ORDER.find((s) => !done(s)) ?? null
}

/** Where the guide stands for a step — and back at the pier when there is none. */
export function stationSpot(step: StoryStep | null): Vec2 {
  return (step && BLUEPRINT.storySpots[step]) || BLUEPRINT.npcSpots.dockmaster
}
