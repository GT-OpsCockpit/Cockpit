import { describe, expect, it } from 'vitest'
import type { GeocodeTzEntity } from '@cockpit/shared/api'
import { applyBookingEdit, dispatchReadiness, type BookingMeta } from './booking-draft'
import { tripFormDefaults, type TripFormValues } from './trip-form-schema'

/**
 * These are the transitions that used to be reachable only from a Playwright
 * run — every one of them lived in an onChange handler inside a 1000-line
 * form. Asserted here as values.
 */

const meta: BookingMeta = {
  countries: [
    { name: 'France', code: 'FR', tz: 'Europe/Paris', currency: 'EUR' },
    { name: 'Morocco', code: 'MA', tz: 'Africa/Casablanca', currency: 'MAD' },
  ],
  vehicleTypes: [
    { id: '1', ref: 'VT1', name: 'Business', maxPax: 3, active: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: '2', ref: 'VT2', name: 'Van', maxPax: 7, active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
}

const draft = (overrides: Partial<TripFormValues> = {}): TripFormValues => ({ ...tripFormDefaults(), ...overrides })

const geocode = (overrides: Partial<GeocodeTzEntity> = {}): GeocodeTzEntity => ({
  tz: 'Europe/Paris',
  lat: 43.66,
  lon: 7.21,
  displayName: 'Nice Côte d’Azur Airport',
  countryCode: 'FR',
  isAirport: true,
  iata: 'NCE',
  ...overrides,
})

describe('applyBookingEdit — country', () => {
  it('sets the timezone and clears the area, which belonged to the old country', () => {
    expect(applyBookingEdit(draft({ area: 'Nice', pickupTimezone: 'Europe/Paris' }), { kind: 'countryCode', value: 'MA' }, meta)).toEqual({
      pickupTimezone: 'Africa/Casablanca',
      area: '',
    })
  })

  // A country the meta endpoint doesn't know has no timezone to offer, but
  // the area is stale either way.
  it('still clears the area for a country with no timezone on file', () => {
    expect(applyBookingEdit(draft({ area: 'Nice' }), { kind: 'countryCode', value: 'ZZ' }, meta)).toEqual({ area: '' })
  })
})

describe('applyBookingEdit — vehicle type', () => {
  it('brings the passenger count down to what the smaller car fits', () => {
    expect(applyBookingEdit(draft({ paxCount: 7 }), { kind: 'vehicleType', value: 'Business' }, meta)).toEqual({
      paxCount: 3,
    })
  })

  it('leaves a count the car already fits alone', () => {
    expect(applyBookingEdit(draft({ paxCount: 2 }), { kind: 'vehicleType', value: 'Business' }, meta)).toEqual({})
    expect(applyBookingEdit(draft({ paxCount: 3 }), { kind: 'vehicleType', value: 'Business' }, meta)).toEqual({})
  })

  // Moving up a size is not a reason to raise the party.
  it('never raises the count when a bigger car is picked', () => {
    expect(applyBookingEdit(draft({ paxCount: 2 }), { kind: 'vehicleType', value: 'Van' }, meta)).toEqual({})
  })

  it('changes nothing for a vehicle type it has no capacity for', () => {
    expect(applyBookingEdit(draft({ paxCount: 40 }), { kind: 'vehicleType', value: 'Unknown' }, meta)).toEqual({})
  })
})

describe('applyBookingEdit — sub-contracted', () => {
  // The two branches are mutually exclusive and only one is on screen at a
  // time: an off-screen driver would silently block Create & Dispatch.
  it('clears the driver and the vehicle when ticked, leaving the partner', () => {
    const values = draft({ driverRef: 'D1', fleetRegNbr: 'AB-123-CD', partnerRef: 'P1' })
    expect(applyBookingEdit(values, { kind: 'subContractor', value: true }, meta)).toEqual({
      driverRef: '',
      fleetRegNbr: '',
    })
  })

  it('clears the partner when unticked, leaving the driver and the vehicle', () => {
    const values = draft({ driverRef: 'D1', fleetRegNbr: 'AB-123-CD', partnerRef: 'P1' })
    expect(applyBookingEdit(values, { kind: 'subContractor', value: false }, meta)).toEqual({ partnerRef: '' })
  })
})

describe('applyBookingEdit — geocode', () => {
  it('fills the pickup IATA and timezone', () => {
    expect(
      applyBookingEdit(draft(), { kind: 'geocode', field: 'pickupLocation', result: geocode() }, meta),
    ).toEqual({ pickupIata: 'NCE', pickupTimezone: 'Europe/Paris' })
  })

  it('fills only the drop-off IATA — the trip keeps the pickup timezone', () => {
    expect(
      applyBookingEdit(
        draft({ pickupTimezone: 'Europe/Paris' }),
        { kind: 'geocode', field: 'dropoffLocation', result: geocode({ tz: 'Europe/Rome', iata: 'FCO' }) },
        meta,
      ),
    ).toEqual({ dropoffIata: 'FCO' })
  })

  it('clears a stale IATA when the new address is not an airport', () => {
    expect(
      applyBookingEdit(
        draft({ pickupIata: 'NCE' }),
        { kind: 'geocode', field: 'pickupLocation', result: geocode({ isAirport: false, iata: null }) },
        meta,
      ),
    ).toEqual({ pickupIata: '', pickupTimezone: 'Europe/Paris' })
  })

  it('pre-fills the FBO address the directory knows', () => {
    const patch = applyBookingEdit(
      draft(),
      {
        kind: 'geocode',
        field: 'pickupLocation',
        result: geocode(),
        fbo: { found: true, name: 'Swissport', fbo: '1 Terminal Aviation, Nice' },
      },
      meta,
    )
    expect(patch.fboAddress).toBe('1 Terminal Aviation, Nice')
  })

  // The field stays editable, so an address the dispatcher already typed is
  // theirs — the directory never overwrites it.
  it('never overwrites an FBO address already typed', () => {
    const patch = applyBookingEdit(
      draft({ fboAddress: 'Hand-typed handling agent' }),
      {
        kind: 'geocode',
        field: 'pickupLocation',
        result: geocode(),
        fbo: { found: true, name: 'Swissport', fbo: '1 Terminal Aviation, Nice' },
      },
      meta,
    )
    expect(patch.fboAddress).toBeUndefined()
  })

  it('writes no FBO address when the airport is not in the directory', () => {
    const patch = applyBookingEdit(
      draft(),
      { kind: 'geocode', field: 'pickupLocation', result: geocode(), fbo: { found: false, name: null, fbo: null } },
      meta,
    )
    expect(patch.fboAddress).toBeUndefined()
  })
})

describe('dispatchReadiness', () => {
  it('is ready with a driver AND a fleet vehicle', () => {
    expect(dispatchReadiness(draft({ driverRef: 'D1', fleetRegNbr: 'AB-123-CD' }))).toEqual({
      canDispatch: true,
      blockedReason: '',
    })
  })

  it('is ready with a partner, once sub-contracted', () => {
    expect(dispatchReadiness(draft({ subContractor: true, partnerRef: 'P1' })).canDispatch).toBe(true)
    // A partner picked without the box ticked is not a farm-out.
    expect(dispatchReadiness(draft({ partnerRef: 'P1' })).canDispatch).toBe(false)
  })

  it('is not ready with a driver but no vehicle', () => {
    expect(dispatchReadiness(draft({ driverRef: 'D1' }))).toEqual({
      canDispatch: false,
      blockedReason: 'Assign a driver and a fleet vehicle, or tick Sub-contracted and pick a partner.',
    })
  })

  it('blocks both branches at once outright, and says which two to choose between', () => {
    expect(
      dispatchReadiness(draft({ driverRef: 'D1', fleetRegNbr: 'AB-123-CD', subContractor: true, partnerRef: 'P1' })),
    ).toEqual({
      canDispatch: false,
      blockedReason: 'A driver and a partner are both assigned — clear one of the two.',
    })
  })

  it('asks for the partner once the box is ticked', () => {
    expect(dispatchReadiness(draft({ subContractor: true })).blockedReason).toBe(
      'Pick the partner company this booking is farmed out to.',
    )
  })
})
