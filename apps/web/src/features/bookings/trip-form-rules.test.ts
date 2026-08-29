import { describe, expect, it } from 'vitest'
import { TripEntityService, TripStepEntityStep } from '@cockpit/shared/api'
import { tripFormRules, type TripFormRulesInput } from './trip-form-rules'
import { baseTrip, step } from './test-fixtures'

const values = (overrides: Partial<TripFormRulesInput> = {}): TripFormRulesInput => ({
  service: TripEntityService.TSF,
  countryCode: 'FR',
  area: 'Nice',
  pickupLocation: '',
  dropoffLocation: '',
  pickupIata: '',
  dropoffIata: '',
  pickupDate: '',
  pickupTime: '',
  pickupTimezone: '',
  ...overrides,
})

describe('regNbrApplies', () => {
  it('is on for a local booking — our own fleet can serve it', () => {
    expect(tripFormRules(values({ area: 'Cannes' })).regNbrApplies).toBe(true)
    expect(tripFormRules(values({ area: 'Other', countryCode: 'MC' })).regNbrApplies).toBe(true)
  })

  it('is off for a farmed-out booking — there is no vehicle of ours to name', () => {
    expect(tripFormRules(values({ area: 'Berlin', countryCode: 'DE' })).regNbrApplies).toBe(false)
  })
})

describe('pocLocked', () => {
  it('is unlocked while creating a booking — there is no trip yet', () => {
    expect(tripFormRules(values()).pocLocked).toBe(false)
  })

  it('is unlocked until the driver is in position', () => {
    const trip = baseTrip({ steps: [step(TripStepEntityStep.ENROUTE)] })
    expect(tripFormRules(values(), trip).pocLocked).toBe(false)
  })

  it('locks once the driver is in position — the contact is already in use on the ground', () => {
    const trip = baseTrip({ steps: [step(TripStepEntityStep.ARRIVED)] })
    expect(tripFormRules(values(), trip).pocLocked).toBe(true)
  })
})

describe('parisHint', () => {
  it('restates the pickup time in Paris, and shows the day it lands on', () => {
    // 09:00 in New York on 2 Sept is 15:00 the same day in Paris.
    const rules = tripFormRules(
      values({ pickupTimezone: 'America/New_York', pickupDate: '2026-09-02', pickupTime: '09:00' }),
    )
    expect(rules.parisHint).toBe('Eq. 🕐 Paris : 15:00 (02/09)')
  })

  it('shows the day shift when the conversion crosses midnight', () => {
    // 23:00 in Tokyo on 2 Sept is 16:00 the same day in Paris; 02:00 is the day before.
    const rules = tripFormRules(
      values({ pickupTimezone: 'Asia/Tokyo', pickupDate: '2026-09-02', pickupTime: '02:00' }),
    )
    expect(rules.parisHint).toBe('Eq. 🕐 Paris : 19:00 (01/09)')
  })

  it('stays a bare label while the date/time/zone are not all known', () => {
    expect(tripFormRules(values()).parisHint).toBe('Eq. 🕐 Paris')
    expect(tripFormRules(values({ pickupTimezone: 'Europe/Paris', pickupDate: '2026-09-02' })).parisHint).toBe(
      'Eq. 🕐 Paris',
    )
  })

  it('stays a bare label rather than showing "Invalid DateTime" on a half-typed time', () => {
    const rules = tripFormRules(
      values({ pickupTimezone: 'Europe/Paris', pickupDate: '2026-09-02', pickupTime: '9' }),
    )
    expect(rules.parisHint).toBe('Eq. 🕐 Paris')
  })
})

describe('dropoffApplies / showAirportInfo', () => {
  it('drops the drop-off for an at-disposal booking — the car stays with the passenger', () => {
    expect(tripFormRules(values({ service: TripEntityService.ASD })).dropoffApplies).toBe(false)
    expect(tripFormRules(values({ service: TripEntityService.TSF })).dropoffApplies).toBe(true)
  })

  it('reveals the flight block as soon as either IATA code is known', () => {
    expect(tripFormRules(values()).showAirportInfo).toBe(false)
    expect(tripFormRules(values({ pickupIata: 'NCE' })).showAirportInfo).toBe(true)
    expect(tripFormRules(values({ dropoffIata: 'CDG' })).showAirportInfo).toBe(true)
  })
})

describe('price hints', () => {
  it('totals an ASD hourly rate over the booked hours, for both rates', () => {
    const rules = tripFormRules(
      values({ service: TripEntityService.ASD, hours: 4, priceEur: 250, partnerRateEur: 180 }),
    )
    expect(rules.retailAsdTotal).toBe('Total net: 1000.00 €')
    expect(rules.partnerAsdTotal).toBe('Total net: 720.00 €')
  })

  it('shows no total for a non-ASD booking — the rate is already the price', () => {
    const rules = tripFormRules(
      values({ service: TripEntityService.TSF, hours: 4, priceEur: 250, partnerRateEur: 180 }),
    )
    expect(rules.retailAsdTotal).toBeUndefined()
    expect(rules.partnerAsdTotal).toBeUndefined()
  })

  it('shows the margin once both rates are in, French VAT stripped abroad', () => {
    expect(tripFormRules(values({ countryCode: 'FR', priceEur: 200, partnerRateEur: 150 })).marginHint).toBe(
      '% Margin: 25.0 %',
    )
    expect(tripFormRules(values({ countryCode: 'CH', priceEur: 200, partnerRateEur: 150 })).marginHint).toBe(
      '% Margin: 17.5 %',
    )
  })

  it('shows nothing rather than a misleading 0% while a rate is missing', () => {
    expect(tripFormRules(values({ priceEur: 200 })).marginHint).toBeUndefined()
    expect(tripFormRules(values({ partnerRateEur: 150 })).marginHint).toBeUndefined()
  })
})
