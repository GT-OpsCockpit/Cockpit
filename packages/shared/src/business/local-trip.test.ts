import { describe, expect, it } from 'vitest'
import { isLocalTrip } from './local-trip.js'

describe('isLocalTrip', () => {
  it('matches a known local area name, case/whitespace-insensitive', () => {
    expect(isLocalTrip({ area: 'Nice' })).toBe(true)
    expect(isLocalTrip({ area: ' CANNES ' })).toBe(true)
    expect(isLocalTrip({ area: 'Saint-Tropez' })).toBe(true)
  })

  it('matches Monaco by country code regardless of area', () => {
    expect(isLocalTrip({ area: 'Somewhere else', countryCode: 'MC' })).toBe(true)
  })

  it('matches when a local area name appears inside the pickup/drop-off text', () => {
    expect(
      isLocalTrip(
        { area: 'Other', countryCode: 'FR', pickupLocation: 'Nice Côte d\'Azur Airport', dropoffLocation: 'Villa' },
      ),
    ).toBe(true)
  })

  it('is false for an unrelated area with no local keyword anywhere', () => {
    expect(
      isLocalTrip({ area: 'Berlin', countryCode: 'DE', pickupLocation: 'Berlin Airport', dropoffLocation: 'Hotel Adlon' }),
    ).toBe(false)
  })
})
