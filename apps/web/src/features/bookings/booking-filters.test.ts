import { describe, expect, it } from 'vitest'
import { TripEntityService } from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'
import { applyBookingFilters, defaultBookingFilters } from './booking-filters'
import { baseClient, baseTrip } from './test-fixtures'

describe('applyBookingFilters', () => {
  // The date-window/Events-client bounding (previously periodMatches/
  // baseVisibility/isEventClientTrip, tested here with fake timers) moved
  // server-side into TripsService.list() — see apps/api/test/trips.e2e-spec.ts's
  // "GET /api/trips — server-side date-window filtering" for that coverage now.
  // applyBookingFilters only narrows an already-bounded set further.
  function trip(overrides: Partial<TripEntity> = {}): TripEntity {
    return baseTrip({ pickupAt: '2026-09-02T10:00:00.000Z', ...overrides })
  }

  it('searches ref, account name, passenger and driver — never pickup/drop-off text', () => {
    const target = trip({
      ref: 'R-CI1-26-42',
      client: baseClient({ acronym: null, company: 'Riviera Transfers' }),
      passengerName: 'Sophie Durand',
      pickupLocation: 'A very distinctive airport name',
    })
    const others = [
      trip({ ref: 'R-OTHER-1', client: baseClient({ acronym: null, company: 'Someone Else' }), passengerName: 'Bob' }),
    ]

    expect(applyBookingFilters([target, ...others], { ...defaultBookingFilters(), search: 'r-ci1-26-42' })).toEqual([target])
    expect(applyBookingFilters([target, ...others], { ...defaultBookingFilters(), search: 'riviera' })).toEqual([target])
    expect(applyBookingFilters([target, ...others], { ...defaultBookingFilters(), search: 'sophie' })).toEqual([target])
    // Deliberately not searched — matches the legacy's renderTrips() (verified manually in session 2).
    expect(applyBookingFilters([target, ...others], { ...defaultBookingFilters(), search: 'distinctive airport' })).toEqual([])
  })

  it('applies the client/driver/vehicleType/service exact-match filters', () => {
    const match = trip({
      client: baseClient({ ref: 'CI1' }),
      vehicleType: { id: 'vt-1', name: 'Business' } as TripEntity['vehicleType'],
      service: TripEntityService.ASD,
    })
    const mismatch = trip({
      client: baseClient({ ref: 'CI2' }),
      vehicleType: { id: 'vt-2', name: 'Van' } as TripEntity['vehicleType'],
      service: TripEntityService.TSF,
    })

    expect(applyBookingFilters([match, mismatch], { ...defaultBookingFilters(), clientRef: 'CI1' })).toEqual([match])
    expect(applyBookingFilters([match, mismatch], { ...defaultBookingFilters(), vehicleType: 'Business' })).toEqual([match])
    expect(applyBookingFilters([match, mismatch], { ...defaultBookingFilters(), service: TripEntityService.ASD })).toEqual([
      match,
    ])
  })

  it('never reorders — the server (pickupAt ascending) is the sort authority', () => {
    const later = trip({ ref: 'R-LATER', pickupAt: '2026-09-03T10:00:00.000Z' })
    const earlier = trip({ ref: 'R-EARLIER', pickupAt: '2026-09-02T10:00:00.000Z' })
    // Fed in "wrong" (later-first) order — a real sort would flip this; a
    // pure narrowing filter must preserve it exactly as given.
    const result = applyBookingFilters([later, earlier], defaultBookingFilters())
    expect(result.map((t) => t.ref)).toEqual(['R-LATER', 'R-EARLIER'])
  })
})
