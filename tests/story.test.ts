// The story spine as data: five steps, every résumé chapter hung on one of
// them, and a station for Bo to stand at that the fair will actually let him
// reach.
import { describe, expect, it } from 'vitest'
import { ZONES } from '../src/data/content'
import { FACET_STEP, STATIONS, STORY_HINTS, STORY_ORDER, nextStep, stationSpot } from '../src/data/story'
import { BLUEPRINT, type AttractionId } from '../src/world/blueprint'

/**
 * The eight attractions, pinned at compile time: a station may only point at
 * one of them, and renaming an attraction has to break this line first.
 */
const EVERY_ATTRACTION: Record<AttractionId, true> = {
  gate: true,
  coaster: true,
  prizetent: true,
  forge: true,
  flight: true,
  arcade: true,
  duckpond: true,
  guestbook: true,
}

describe('story spine', () => {
  it('orders five steps and maps every chapter onto one', () => {
    expect(STORY_ORDER).toEqual(['ticket', 'ride', 'prizes', 'toolkit', 'guestbook'])
    for (const z of ZONES) expect(STORY_ORDER, z.id).toContain(FACET_STEP[z.id])
    for (const z of ZONES) expect(typeof STORY_HINTS[z.id], z.id).toBe('string')
  })

  it('rides the coaster for both career chapters and the tent for all three projects', () => {
    expect(FACET_STEP.about).toBe('ticket')
    expect(FACET_STEP.experience).toBe('ride')
    expect(FACET_STEP.education).toBe('ride')
    expect(FACET_STEP.lineage).toBe('prizes')
    expect(FACET_STEP.safestride).toBe('prizes')
    expect(FACET_STEP.stealth).toBe('prizes')
    expect(FACET_STEP.skills).toBe('toolkit')
    expect(FACET_STEP.contact).toBe('guestbook')
  })

  it('picks the first unfinished step, or null when done', () => {
    expect(nextStep(() => false)).toBe('ticket')
    expect(nextStep((s) => s === 'ticket' || s === 'ride')).toBe('prizes')
    expect(nextStep(() => true)).toBeNull()
  })

  it('stands Bo on a designed spot for every step, and at the gate when done', () => {
    for (const s of STORY_ORDER) {
      expect(BLUEPRINT.storySpots[s], s).toBeDefined()
      expect(stationSpot(s)).toEqual(BLUEPRINT.storySpots[s])
    }
    expect(stationSpot(null)).toEqual(BLUEPRINT.npcSpots.dockmaster)
  })

  it('points every station at an attraction that stands at the fair', () => {
    expect(Object.values(STATIONS).map((st) => st.landmark)).toEqual(['gate', 'coaster', 'prizetent', 'forge', 'guestbook'])
    for (const st of Object.values(STATIONS)) {
      expect(EVERY_ATTRACTION[st.landmark as AttractionId], `${st.step} → ${st.landmark}`).toBe(true)
      expect(
        BLUEPRINT.attractions.some((a) => a.id === st.landmark),
        `${st.step} → no attraction "${st.landmark}" in the blueprint`,
      ).toBe(true)
    }
  })

  it('gives every step a station of its own name and a hint to say out loud', () => {
    for (const s of STORY_ORDER) {
      expect(STATIONS[s].step, s).toBe(s)
      expect(STATIONS[s].hint.length, s).toBeGreaterThan(0)
    }
    expect(STATIONS.ticket.hint).toBe('Get your ticket from Bo at the gate')
    expect(STATIONS.ride.hint).toBe('Ride the Career Coaster — north, up the avenue')
    expect(STATIONS.prizes.hint).toBe('Win the prizes at the Prize Tent — west side of the midway')
    expect(STATIONS.toolkit.hint).toBe('Spell the toolkit at the Word Forge — east side of the midway')
    expect(STATIONS.guestbook.hint).toBe('Sign the guestbook — by the exit')
  })

  it('tells a locked card where its game is played, and nothing else', () => {
    expect(STORY_HINTS.about).toBe('Bo introduces Naman at the ticket booth.')
    expect(STORY_HINTS.experience).toBe('Ride the Career Coaster.')
    expect(STORY_HINTS.education).toBe('Ride the Career Coaster.')
    expect(STORY_HINTS.lineage).toBe('Win it at the Prize Tent.')
    expect(STORY_HINTS.safestride).toBe('Win it at the Prize Tent.')
    expect(STORY_HINTS.stealth).toBe('Win it at the Prize Tent.')
    expect(STORY_HINTS.skills).toBe('Spell the toolkit at the Word Forge booth.')
  })

  it('leaves only Contact without a hint — it is the one chapter never locked', () => {
    const silent = ZONES.filter((z) => STORY_HINTS[z.id] === '').map((z) => z.id)
    expect(silent).toEqual(['contact'])
  })

  it('has forgotten the pier sentinel — every station now names a real door', () => {
    // v3 held the first two chapters at Bo's feet on the pier and pointed them
    // at a `PIER` sentinel no landmark answered to. The fair has a gate.
    expect(Object.values(STATIONS).some((st) => st.landmark === 'pier')).toBe(false)
  })
})
