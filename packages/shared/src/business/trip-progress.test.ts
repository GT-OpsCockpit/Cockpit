import { describe, expect, it } from 'vitest'
import { currentStep, isBeforeArrival, TRIP_STEP_ORDER } from './trip-progress.js'

const trip = (steps: string[], assignmentCancelled = false) => ({
  steps: steps.map((step) => ({ step })),
  assignmentCancelled,
})

describe('currentStep', () => {
  it('is null before anything has happened', () => {
    expect(currentStep([])).toBeNull()
  })

  it('returns the furthest step reached, whatever order the rows come back in', () => {
    // Deliberately not in pipeline order: on the API side these rows come
    // straight from the database, and reading the last one would give RECEIVED.
    expect(
      currentStep([{ step: 'ENROUTE' }, { step: 'TRANSMITTED' }, { step: 'RECEIVED' }]),
    ).toBe('ENROUTE')
  })

  it('reaches DROPPED once every step is present', () => {
    expect(currentStep(TRIP_STEP_ORDER.map((step) => ({ step })))).toBe('DROPPED')
  })
})

describe('isBeforeArrival', () => {
  it('is true right up to the moment the driver is in position', () => {
    expect(isBeforeArrival(trip([]))).toBe(true)
    expect(isBeforeArrival(trip(['TRANSMITTED']))).toBe(true)
    expect(isBeforeArrival(trip(['TRANSMITTED', 'RECEIVED']))).toBe(true)
    expect(isBeforeArrival(trip(['TRANSMITTED', 'RECEIVED', 'ACCEPTED', 'ENROUTE']))).toBe(true)
  })

  it('is false from "In position" onwards', () => {
    const upToArrived = ['TRANSMITTED', 'RECEIVED', 'ACCEPTED', 'ENROUTE', 'ARRIVED']
    expect(isBeforeArrival(trip(upToArrived))).toBe(false)
    expect(isBeforeArrival(trip([...upToArrived, 'ONBOARD']))).toBe(false)
    expect(isBeforeArrival(trip([...upToArrived, 'ONBOARD', 'DROPPED']))).toBe(false)
  })

  // A cancelled assignment has no driver on the way, so there is no on-site
  // contact to hand over either.
  it('is false for a cancelled assignment, however far it had got', () => {
    expect(isBeforeArrival(trip([], true))).toBe(false)
    expect(isBeforeArrival(trip(['RECEIVED'], true))).toBe(false)
  })
})
