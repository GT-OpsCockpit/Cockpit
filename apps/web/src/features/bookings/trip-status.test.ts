import { describe, expect, it } from 'vitest'
import { TripEntityService, TripStepEntityStep } from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'
import {
  applyBookingFilters,
  currentStatus,
  defaultBookingFilters,
  dispatchButtonState,
  isBeforeArrival,
  isLocalTrip,
  isStatusAdvanceable,
  isStatusLocked,
} from './trip-status'
import { baseClient, baseTrip, step } from './test-fixtures'

describe('currentStatus', () => {
  it('is null when no step has been recorded', () => {
    expect(currentStatus(baseTrip())).toBeNull()
  })

  it('is the latest step in STEP_ORDER, regardless of insertion order', () => {
    const trip = baseTrip({
      steps: [step(TripStepEntityStep.ACCEPTED), step(TripStepEntityStep.TRANSMITTED), step(TripStepEntityStep.RECEIVED)],
    })
    expect(currentStatus(trip)).toBe(TripStepEntityStep.ACCEPTED)
  })

  it('reaches DROPPED once every step is present', () => {
    const trip = baseTrip({
      steps: Object.values(TripStepEntityStep).map((s) => step(s)),
    })
    expect(currentStatus(trip)).toBe(TripStepEntityStep.DROPPED)
  })

  it('is CANCELLED when the assignment was pulled, even with steps already recorded', () => {
    const trip = baseTrip({
      assignmentCancelled: true,
      steps: [step(TripStepEntityStep.TRANSMITTED), step(TripStepEntityStep.RECEIVED)],
    })
    expect(currentStatus(trip)).toBe('CANCELLED')
  })
})

describe('isStatusLocked', () => {
  it('is locked for a sub-contracted trip with no partner on file yet', () => {
    expect(isStatusLocked(baseTrip({ subContractor: true, partnerId: null }))).toBe(true)
  })

  it('is not locked once a partner is assigned', () => {
    expect(isStatusLocked(baseTrip({ subContractor: true, partnerId: 'partner-1' }))).toBe(false)
  })

  it('is never locked for a non-sub-contracted trip', () => {
    expect(isStatusLocked(baseTrip({ subContractor: false, partnerId: null }))).toBe(false)
  })
})

describe('isStatusAdvanceable', () => {
  it('is false with no step recorded yet', () => {
    expect(isStatusAdvanceable(baseTrip())).toBe(false)
  })

  it('is true from an intermediate step', () => {
    const trip = baseTrip({ steps: [step(TripStepEntityStep.ENROUTE)] })
    expect(isStatusAdvanceable(trip)).toBe(true)
  })

  it('is false once DROPPED (nothing left to advance to)', () => {
    const trip = baseTrip({ steps: Object.values(TripStepEntityStep).map((s) => step(s)) })
    expect(isStatusAdvanceable(trip)).toBe(false)
  })

  it('is false once cancelled', () => {
    const trip = baseTrip({ assignmentCancelled: true, steps: [step(TripStepEntityStep.ENROUTE)] })
    expect(isStatusAdvanceable(trip)).toBe(false)
  })

  it('is false while locked behind an unassigned sub-contractor, even mid-way through steps', () => {
    const trip = baseTrip({
      subContractor: true,
      partnerId: null,
      steps: [step(TripStepEntityStep.TRANSMITTED)],
    })
    expect(isStatusAdvanceable(trip)).toBe(false)
  })
})

describe('dispatchButtonState', () => {
  it('dims a local, non-sub-contracted trip missing both driver and vehicle', () => {
    const state = dispatchButtonState(baseTrip({ driverId: null, fleetVehicleId: null }), true)
    expect(state).toEqual({
      dimmed: true,
      disabled: false,
      title: 'Assign a driver and a vehicle before sending to the driver',
    })
  })

  it('dims and names the vehicle when only the driver is assigned', () => {
    const state = dispatchButtonState(baseTrip({ driverId: 'driver-1', fleetVehicleId: null }), true)
    expect(state).toEqual({
      dimmed: true,
      disabled: false,
      title: 'Assign a vehicle (Reg Nbr) before sending to the driver',
    })
  })

  it('dims and names the driver when only the vehicle is assigned', () => {
    const state = dispatchButtonState(baseTrip({ driverId: null, fleetVehicleId: 'vehicle-1' }), true)
    expect(state).toEqual({
      dimmed: true,
      disabled: false,
      title: 'Assign a driver before sending',
    })
  })

  it('is ready to send once both are assigned and not yet dispatched', () => {
    const state = dispatchButtonState(baseTrip({ driverId: 'driver-1', fleetVehicleId: 'vehicle-1', dispatched: false }), true)
    expect(state).toEqual({ dimmed: false, disabled: false, title: 'Dispatch to the driver' })
  })

  it('is disabled (not dimmed) once already dispatched', () => {
    const state = dispatchButtonState(baseTrip({ driverId: 'driver-1', fleetVehicleId: 'vehicle-1', dispatched: true }), true)
    expect(state).toEqual({
      dimmed: false,
      disabled: true,
      title: 'Already sent — edit or reassign to send again',
    })
  })

  it('never dims a sub-contracted trip, even without a driver/vehicle assigned', () => {
    const state = dispatchButtonState(baseTrip({ subContractor: true, driverId: null, fleetVehicleId: null }), true)
    expect(state.dimmed).toBe(false)
  })

  it('never dims a Farm-out trip (isLocal=false), even without a driver/vehicle assigned', () => {
    const state = dispatchButtonState(baseTrip({ driverId: null, fleetVehicleId: null }), false)
    expect(state.dimmed).toBe(false)
  })
})

describe('isLocalTrip', () => {
  it('matches a known local area name, case/whitespace-insensitive', () => {
    expect(isLocalTrip(baseTrip({ area: 'Nice' }))).toBe(true)
    expect(isLocalTrip(baseTrip({ area: ' CANNES ' }))).toBe(true)
    expect(isLocalTrip(baseTrip({ area: 'Saint-Tropez' }))).toBe(true)
  })

  it('matches Monaco by country code regardless of area', () => {
    expect(isLocalTrip(baseTrip({ area: 'Somewhere else', countryCode: 'MC' }))).toBe(true)
  })

  it('matches when a local area name appears inside the pickup/drop-off text', () => {
    expect(
      isLocalTrip(
        baseTrip({ area: 'Other', countryCode: 'FR', pickupLocation: 'Nice Côte d\'Azur Airport', dropoffLocation: 'Villa' }),
      ),
    ).toBe(true)
  })

  it('is false for an unrelated area with no local keyword anywhere', () => {
    expect(
      isLocalTrip(baseTrip({ area: 'Berlin', countryCode: 'DE', pickupLocation: 'Berlin Airport', dropoffLocation: 'Hotel Adlon' })),
    ).toBe(false)
  })
})

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
// The POC (on-site contact) is only editable while nobody is on site yet —
// past "In position" the name and number are the ones already in use on the
// ground. Legacy isBeforeArrival (common.js:2391); the server enforces it
// (trip-progress.ts), this only lets the form say so first.
describe('isBeforeArrival', () => {
  const at = (...steps: TripStepEntityStep[]) => baseTrip({ steps: steps.map((s) => step(s)) })

  it('is true right up to the moment the driver is in position', () => {
    expect(isBeforeArrival(at())).toBe(true)
    expect(isBeforeArrival(at(TripStepEntityStep.TRANSMITTED))).toBe(true)
    expect(
      isBeforeArrival(
        at(
          TripStepEntityStep.TRANSMITTED,
          TripStepEntityStep.RECEIVED,
          TripStepEntityStep.ACCEPTED,
          TripStepEntityStep.ENROUTE,
        ),
      ),
    ).toBe(true)
  })

  it('is false from "In position" onwards', () => {
    expect(
      isBeforeArrival(
        at(TripStepEntityStep.TRANSMITTED, TripStepEntityStep.RECEIVED, TripStepEntityStep.ARRIVED),
      ),
    ).toBe(false)
    expect(
      isBeforeArrival(
        at(TripStepEntityStep.TRANSMITTED, TripStepEntityStep.ARRIVED, TripStepEntityStep.DROPPED),
      ),
    ).toBe(false)
  })

  it('is false for a cancelled assignment — there is nobody to meet', () => {
    expect(isBeforeArrival(baseTrip({ steps: [], assignmentCancelled: true }))).toBe(false)
  })
})
