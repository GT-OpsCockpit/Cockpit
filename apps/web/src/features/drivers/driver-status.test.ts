import { describe, expect, it } from 'vitest'
import { DriverUnavailabilityEntityType } from '@cockpit/shared/api'
import type { DriverUnavailabilityEntity } from '@cockpit/shared/api'
import { defaultDriverFilters, isPartner, unavailabilityLabel } from './driver-status'
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

describe('isPartner', () => {
  it('is false for an internal driver (no company)', () => {
    expect(isPartner(driver({ company: null }))).toBe(false)
  })

  it('is true once a company is set', () => {
    expect(isPartner(driver({ company: 'Uber' }))).toBe(true)
  })
})

describe('unavailabilityLabel', () => {
  it('returns null when there is none', () => {
    expect(unavailabilityLabel(null)).toBeNull()
  })

  it('labels a day off by its date', () => {
    expect(unavailabilityLabel(unavailability({ type: DriverUnavailabilityEntityType.OFF, date: '2026-06-01T00:00:00.000Z' }))).toBe(
      'Off 01/06/2026',
    )
  })

  it('labels holidays by their end date', () => {
    const label = unavailabilityLabel(
      unavailability({
        type: DriverUnavailabilityEntityType.HOLIDAYS,
        date: null,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-10T00:00:00.000Z',
      }),
    )
    expect(label).toBe('Holidays until 10/06/2026')
  })

  it('labels sick leave by its end date', () => {
    const label = unavailabilityLabel(
      unavailability({
        type: DriverUnavailabilityEntityType.SICK,
        date: null,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-10T00:00:00.000Z',
      }),
    )
    expect(label).toBe('Sick until 10/06/2026')
  })
})
