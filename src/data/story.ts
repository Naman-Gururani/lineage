// The story spine: the order Bo tells Naman's story in, where he stands while
// he waits for you to reach the next chapter, and the one line a locked card is
// allowed to say about how to open it.
//
// Suggestion, not enforcement. Every attraction works whenever you get there;
// the order only decides which one the guide points at next.
import { BLUEPRINT } from '../world/blueprint'
import type { Vec2 } from '../world/regions'

export type StoryStep = 'ticket' | 'ride' | 'prizes' | 'toolkit' | 'guestbook'

/** The order the story is *offered* in — the `story` quest's steps, in the same order. */
export const STORY_ORDER: readonly StoryStep[] = ['ticket', 'ride', 'prizes', 'toolkit', 'guestbook']

/** A stop on the tour: where the guide waits, and what he is waiting for. */
export type Station = { step: StoryStep; landmark: string; hint: string }

/**
 * `landmark` is an `AttractionId` — the fair's stalls are the only doors there
 * are, so every station names one and the map pin, the objective chip and the
 * marker all light the same thing. (v3 needed a `PIER` sentinel here because
 * two of its chapters happened at Bo's feet rather than at anybody's door; the
 * fair has a gate, and the gate is an attraction.)
 */
export const STATIONS: Record<StoryStep, Station> = {
  ticket: { step: 'ticket', landmark: 'gate', hint: 'Get your ticket from Bo at the gate' },
  ride: { step: 'ride', landmark: 'coaster', hint: 'Ride the Career Coaster — north, up the avenue' },
  prizes: { step: 'prizes', landmark: 'prizetent', hint: 'Win the prizes at the Prize Tent — west side of the midway' },
  toolkit: { step: 'toolkit', landmark: 'forge', hint: 'Spell the toolkit at the Word Forge — east side of the midway' },
  guestbook: { step: 'guestbook', landmark: 'guestbook', hint: 'Sign the guestbook — by the exit' },
}

/**
 * What a locked chapter card is allowed to say: where the game that opens it is
 * played, and nothing about what the chapter holds. Contact is never locked, so
 * it has nothing to say.
 */
export const STORY_HINTS: Record<string, string> = {
  about: 'Bo introduces Naman at the ticket booth.',
  experience: 'Ride the Career Coaster.',
  education: 'Ride the Career Coaster.',
  lineage: 'Win it at the Prize Tent.',
  safestride: 'Win it at the Prize Tent.',
  stealth: 'Win it at the Prize Tent.',
  skills: 'Spell the toolkit at the Word Forge booth.',
  contact: '',
}

/**
 * Which step a chapter counts toward. The ride tells two chapters in one go
 * (the coaster's hills *are* the career), and the three prizes share one.
 */
export const FACET_STEP: Record<string, StoryStep> = {
  about: 'ticket',
  experience: 'ride',
  education: 'ride',
  lineage: 'prizes',
  safestride: 'prizes',
  stealth: 'prizes',
  skills: 'toolkit',
  contact: 'guestbook',
}

/** The first step still outstanding, or null once the story is told. */
export function nextStep(done: (s: StoryStep) => boolean): StoryStep | null {
  return STORY_ORDER.find((s) => !done(s)) ?? null
}

/** Where the guide stands for a step — and back at the gate when there is none. */
export function stationSpot(step: StoryStep | null): Vec2 {
  return (step && BLUEPRINT.storySpots[step]) || BLUEPRINT.npcSpots.dockmaster
}
