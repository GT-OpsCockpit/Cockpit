import { describe, expect, it } from 'vitest'
import { TripStepEntityStep } from '@cockpit/shared/api'
import { currentStatus, dispatchButtonState, isStatusAdvanceable, isStatusLocked } from './trip-status'
import { baseTrip, step } from './test-fixtures'

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
