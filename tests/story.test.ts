// The story spine as data: six steps, every résumé chapter hung on one of them,
// and a station for Bo to stand at that the island will actually let him reach.
import { describe, expect, it } from 'vitest'
import { ZONES } from '../src/data/content'
import { FACET_STEP, PIER, STATIONS, STORY_HINTS, STORY_ORDER, nextStep, stationSpot } from '../src/data/story'
import { BLUEPRINT } from '../src/world/blueprint'

describe('story spine', () => {
  it('orders six steps and maps every chapter onto one', () => {
    expect(STORY_ORDER).toEqual(['meet', 'experience', 'projects', 'education', 'skills', 'contact'])
    for (const z of ZONES) expect(STORY_ORDER, z.id).toContain(FACET_STEP[z.id])
    for (const z of ZONES) expect(typeof STORY_HINTS[z.id], z.id).toBe('string')
  })

  it('picks the first unfinished step, or null when done', () => {
    expect(nextStep(() => false)).toBe('meet')
    expect(nextStep((s) => s === 'meet' || s === 'experience')).toBe('projects')
    expect(nextStep(() => true)).toBeNull()
  })

  it('stands Bo on a designed spot for every step, and at the pier when done', () => {
    for (const s of STORY_ORDER) {
      expect(BLUEPRINT.storySpots[s], s).toBeDefined()
      expect(stationSpot(s)).toEqual(BLUEPRINT.storySpots[s])
    }
    expect(stationSpot(null)).toEqual(BLUEPRINT.npcSpots.dockmaster)
  })

  it('points every station at a real landmark — except the two held at the pier', () => {
    const ids = new Set<string>(BLUEPRINT.landmarks.map((l) => l.id))
    // Nothing on the island is called `pier`, and that is the point: the map
    // highlights the pin whose id matches the objective's landmark, and the
    // first two chapters happen at Bo's feet rather than at anybody's door.
    expect(ids.has(PIER)).toBe(false)
    for (const st of Object.values(STATIONS)) {
      if (st.step === 'meet' || st.step === 'experience') expect(st.landmark, st.step).toBe(PIER)
      else expect(ids.has(st.landmark), st.landmark).toBe(true)
    }
  })

  it('gives every step a station of its own name and a hint to say out loud', () => {
    for (const s of STORY_ORDER) {
      expect(STATIONS[s].step, s).toBe(s)
      expect(STATIONS[s].hint.length, s).toBeGreaterThan(0)
    }
  })

  it('leaves only Contact without a hint — it is the one chapter never locked', () => {
    const silent = ZONES.filter((z) => STORY_HINTS[z.id] === '').map((z) => z.id)
    expect(silent).toEqual(['contact'])
  })
})
