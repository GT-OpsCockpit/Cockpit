import { describe, expect, it } from 'vitest'
import { DriverUnavailabilityEntityType } from '@cockpit/shared/api'
import type { DriverUnavailabilityEntity } from '@cockpit/shared/api'
import { defaultDriverFilters, driverOptionLabel, isPartner, unavailabilityLabel } from './driver-status'
import { baseDriver as driver } from './test-fixtures'

function unavailability(overrides: Partial<DriverUnavailabilityEntity> = {}): DriverUnavailabilityEntity {
  return {
    id: 'u1',
    driverId: 'd1',
    type: DriverUnavailabilityEntityType.OFF,
    date: '2026-06-01T00:00:00.000Z',
    startDate: null,
    endDate: null,
    ...overrides,
  }
}

describe('defaultDriverFilters', () => {
  it('starts with no search and inactive drivers hidden', () => {
    expect(defaultDriverFilters()).toEqual({ search: '', showInactive: false })
  })
})

describe('driverOptionLabel', () => {
  it('names an internal chauffeur, then their ref', () => {
    expect(driverOptionLabel(driver())).toBe('John Smith (D-FR-INT-001)')
  })

  it('falls back to the company for a partner with nobody named on file', () => {
    expect(
      driverOptionLabel(
        driver({ ref: 'D-XX-XX-MAN-001', name: '', firstName: null, lastName: null, company: 'Manual Test Partners' }),
      ),
    ).toBe('Manual Test Partners (D-XX-XX-MAN-001)')
  })

  it('falls back to the ref alone when there is neither', () => {
    expect(driverOptionLabel(driver({ ref: 'D-XX-XX-ANON-1', name: '', firstName: null, lastName: null }))).toBe(
      'D-XX-XX-ANON-1',
    )
  })
})

describe('isPartner', () => {
  it('is false for an internal driver (no company)', () => {
    expect(isPartner(driver({ company: null }))).toBe(false)
  })

  it('is true once a company is set', () => {
    expect(isPartner(driver({ company: 'Uber' }))).toBe(true)
  })
})

// Wording and shape are the legacy's (UNAVAILABILITY_LABELS + unavailabilityLine,
// common.js:3001-3004 / 3498-3506) — and the same the Vehicles table already
// used. The driver labels used to say "Off"/"Sick" and, for a window, only its
// end date: when it *started* appeared nowhere in the list.
describe('unavailabilityLabel', () => {
  it('returns null when there is none', () => {
    expect(unavailabilityLabel(null)).toBeNull()
  })

  it('labels a day off by its date', () => {
    expect(unavailabilityLabel(unavailability({ type: DriverUnavailabilityEntityType.OFF, date: '2026-06-01T00:00:00.000Z' }))).toBe(
      'Day off — 01/06/2026',
    )
  })

  it('labels holidays by their full date range, not just the end', () => {
    const label = unavailabilityLabel(
      unavailability({
        type: DriverUnavailabilityEntityType.HOLIDAYS,
        date: null,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-10T00:00:00.000Z',
      }),
    )
    expect(label).toBe('Holidays — 01/06/2026 → 10/06/2026')
  })

  it('labels sick leave by its full date range', () => {
    const label = unavailabilityLabel(
      unavailability({
        type: DriverUnavailabilityEntityType.SICK,
        date: null,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-10T00:00:00.000Z',
      }),
    )
    expect(label).toBe('Sickness leave — 01/06/2026 → 10/06/2026')
  })
})
