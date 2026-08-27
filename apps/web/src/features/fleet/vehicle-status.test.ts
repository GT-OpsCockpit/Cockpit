import { describe, expect, it } from 'vitest'
import { FleetUnavailabilityEntityType } from '@cockpit/shared/api'
import type { FleetUnavailabilityEntity } from '@cockpit/shared/api'
import { defaultFleetPax, defaultVehicleFilters, unavailabilityLabel } from './vehicle-status'

function unavailability(overrides: Partial<FleetUnavailabilityEntity> = {}): FleetUnavailabilityEntity {
  return {
    id: 'u1',
    fleetVehicleId: 'v1',
    type: FleetUnavailabilityEntityType.REPAIR,
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-06-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('defaultVehicleFilters', () => {
  it('starts with no search and inactive vehicles hidden', () => {
    expect(defaultVehicleFilters()).toEqual({ search: '', showInactive: false })
  })
})

describe('unavailabilityLabel', () => {
  it('returns null when there is none', () => {
    expect(unavailabilityLabel(null)).toBeNull()
  })

  it('labels a repair shop window by its date range', () => {
    expect(unavailabilityLabel(unavailability({ type: FleetUnavailabilityEntityType.REPAIR }))).toBe(
      'Repair shop — 01/06/2026 → 10/06/2026',
    )
  })

  it('labels a manufacturer service window by its date range', () => {
    expect(unavailabilityLabel(unavailability({ type: FleetUnavailabilityEntityType.SERVICE }))).toBe(
      'Manufacturer service — 01/06/2026 → 10/06/2026',
    )
  })

  it('labels a bodywork window by its date range', () => {
    expect(unavailabilityLabel(unavailability({ type: FleetUnavailabilityEntityType.BODYWORK }))).toBe(
      'Bodywork — 01/06/2026 → 10/06/2026',
    )
  })
})

describe('defaultFleetPax', () => {
  it('caps SUV at 3', () => {
    expect(defaultFleetPax('SUV', 'GLE')).toBe(3)
  })

  it('gives Van 7', () => {
    expect(defaultFleetPax('Van', 'V-Class')).toBe(7)
  })

  it('gives E-Van 5 for the VLE model', () => {
    expect(defaultFleetPax('E-Van', 'VLE')).toBe(5)
  })

  it('gives E-Van 7 for any other model (EQV)', () => {
    expect(defaultFleetPax('E-Van', 'EQV')).toBe(7)
  })

  it('gives Sprinter 15, Coach 35 35, Coach 50 50', () => {
    expect(defaultFleetPax('Sprinter', 'Sprinter')).toBe(15)
    expect(defaultFleetPax('Coach 35', 'Coach 35')).toBe(35)
    expect(defaultFleetPax('Coach 50', 'Coach 50')).toBe(50)
  })

  it('gives Lugg. 0', () => {
    expect(defaultFleetPax('Lugg.', 'Luggage Van')).toBe(0)
  })

  it('defaults everything else (Business, E-Business, First, Luxe, Excep.) to 3', () => {
    expect(defaultFleetPax('Business', 'E-Class')).toBe(3)
    expect(defaultFleetPax('First', 'S-Class')).toBe(3)
    expect(defaultFleetPax('Excep.', 'Phantom')).toBe(3)
  })
})
