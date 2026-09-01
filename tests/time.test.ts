import { describe, expect, it } from 'vitest'
import { DAY_LENGTH, ambientAt, clockOf, daylight, phaseAt, wrap } from '../src/core/time'

describe('day cycle', () => {
  it('is 480 seconds long', () => {
    expect(DAY_LENGTH).toBe(480)
  })

  it('maps time to phases', () => {
    expect(phaseAt(10)).toBe('dawn')
    expect(phaseAt(100)).toBe('day')
    expect(phaseAt(300)).toBe('dusk')
    expect(phaseAt(400)).toBe('night')
  })

  it('daylight is full at midday, zero at night, and rises through dawn', () => {
    expect(daylight(150)).toBe(1)
    expect(daylight(400)).toBe(0)
    expect(daylight(0)).toBeLessThanOrEqual(daylight(20))
    expect(daylight(20)).toBeLessThanOrEqual(daylight(44))
    expect(daylight(44)).toBeLessThanOrEqual(1)
    expect(daylight(300)).toBeLessThan(daylight(280))
  })

  it('formats a 24h clock starting at 05:00', () => {
    expect(clockOf(0).label).toBe('05:00')
    expect(clockOf(20).label).toBe('06:00')
    expect(clockOf(480).label).toBe('05:00')
    expect(clockOf(100).h).toBe(10)
  })

  it('ambient is neutral by day and dark at night', () => {
    const noon = ambientAt(150)
    expect(noon.darkness).toBe(0)
    expect(noon.tint).toBe(0xffffff)
    const night = ambientAt(400)
    expect(night.darkness).toBeGreaterThan(0.6)
    expect(night.warmth).toBeGreaterThan(0.9)
    expect(ambientAt(300).warmth).toBeGreaterThan(0)
  })

  it('wraps time into a day', () => {
    expect(wrap(490)).toBe(10)
    expect(wrap(-10)).toBe(470)
    expect(wrap(480)).toBe(0)
  })
})
