import { describe, expect, it } from 'vitest'
import { TripEntityService } from '@cockpit/shared/api'
import { baseTrip } from '../bookings/test-fixtures'
import { coversDate, tripDurationMinutes, vehicleTypeColor } from './planning-status'

describe('vehicleTypeColor', () => {
  it('returns the dedicated color for a known category', () => {
    expect(vehicleTypeColor('Business', ['Business'])).toBe('#eab308')
    expect(vehicleTypeColor('SUV', ['SUV'])).toBe('#2563eb')
  })

  it('falls back to the cycling palette, keyed by position among uncolored types', () => {
    const names = ['Business', 'Custom A', 'Custom B']
    expect(vehicleTypeColor('Custom A', names)).toBe('#2563eb')
    expect(vehicleTypeColor('Custom B', names)).toBe('#16a34a')
  })

  it('cycles the fallback palette once every known color is used up', () => {
    const names = Array.from({ length: 10 }, (_, i) => `Custom ${i}`)
    // 8-entry palette: the 9th unknown type (index 8) wraps back to index 0's color.
    expect(vehicleTypeColor('Custom 0', names)).toBe(vehicleTypeColor('Custom 8', names))
  })

  it('treats a missing vehicleType as the "—" key', () => {
    expect(vehicleTypeColor(null, [])).toBe(vehicleTypeColor('—', []))
  })
})

describe('tripDurationMinutes', () => {
  it('defaults every non-ASD service to a fixed 1h block', () => {
    expect(tripDurationMinutes(baseTrip({ service: TripEntityService.TSF, hours: null }))).toBe(60)
    expect(tripDurationMinutes(baseTrip({ service: TripEntityService.SPEC, hours: null }))).toBe(60)
  })

  it('uses hours*60 for an ASD trip', () => {
    expect(tripDurationMinutes(baseTrip({ service: TripEntityService.ASD, hours: 4 }))).toBe(240)
  })

  it('falls back to 60 for an ASD trip with no usable hours', () => {
    expect(tripDurationMinutes(baseTrip({ service: TripEntityService.ASD, hours: null }))).toBe(60)
    expect(tripDurationMinutes(baseTrip({ service: TripEntityService.ASD, hours: 0 }))).toBe(60)
  })
})

describe('coversDate', () => {
  it('returns false when there is no unavailability', () => {
    expect(coversDate(null, '2026-06-05')).toBe(false)
    expect(coversDate(undefined, '2026-06-05')).toBe(false)
  })

  it('matches a single-date window (driver OFF) exactly, ignoring time-of-day', () => {
    expect(coversDate({ date: '2026-06-05T00:00:00.000Z' }, '2026-06-05')).toBe(true)
    expect(coversDate({ date: '2026-06-05T00:00:00.000Z' }, '2026-06-06')).toBe(false)
  })

  it('matches inside a start/end range (driver HOLIDAYS/SICK, or any vehicle unavailability)', () => {
    const window = { startDate: '2026-06-01T00:00:00.000Z', endDate: '2026-06-10T00:00:00.000Z' }
    expect(coversDate(window, '2026-06-01')).toBe(true)
    expect(coversDate(window, '2026-06-05')).toBe(true)
    expect(coversDate(window, '2026-06-10')).toBe(true)
    expect(coversDate(window, '2026-05-31')).toBe(false)
    expect(coversDate(window, '2026-06-11')).toBe(false)
  })
})
