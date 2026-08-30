import { describe, expect, it } from 'vitest'
import { TripEntityService, TripStepEntityStep, type TripEntity } from '@cockpit/shared/api'
import { flightCheckBlocker, tripFormRules, type TripFormRulesInput } from './trip-form-rules'
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

  // Geocoding recognises an airport more often than it can name one: JFK comes
  // back as an airport with no IATA in its tags. Keyed on the code alone, an
  // airport pickup then had nowhere to enter its flight number at all — the
  // legacy opened its Flight info popup on "is an airport" (common.js:1406).
  it('reveals it for an airport the geocoder could not name a code for', () => {
    expect(tripFormRules(values({ pickupIata: '', pickupIsAirport: true })).showAirportInfo).toBe(true)
    expect(tripFormRules(values({ dropoffIata: '', dropoffIsAirport: true })).showAirportInfo).toBe(true)
  })

  // `pickupIsAirport` is form-only: it comes off the live geocode and is gone
  // once the dialog is reopened on a saved booking, which then fell back on
  // the IATA code alone — the very case the test above covers. Its flight
  // number, buffer, FBO address, tail number and nameboard all went invisible
  // and uneditable. What the saved booking carries says it is an airport one.
  it('keeps it open on a saved booking that carries flight data but no code', () => {
    const carrying = (overrides: Partial<TripEntity>) =>
      tripFormRules(values(), baseTrip({ pickupIata: null, dropoffIata: null, ...overrides })).showAirportInfo
    expect(carrying({ flightNumber: 'AF1234' })).toBe(true)
    expect(carrying({ bufferTime: 45 })).toBe(true)
    expect(carrying({ fboAddress: 'Signature Flight Support Nice' })).toBe(true)
    expect(carrying({ tailNbr: 'FGHIJ' })).toBe(true)
    expect(carrying({ nameboard: 'Mr Smith' })).toBe(true)
  })

  it('stays shut on a saved booking with nothing of the sort in it', () => {
    expect(tripFormRules(values(), baseTrip()).showAirportInfo).toBe(false)
  })
})

// A flight number is only ever a commercial one; the handling agent (FBO) and
// tail number describe a private aircraft. The legacy locked the two out as
// soon as a flight number was typed rather than leaving them editable but
// meaningless (applyCommercialFlightLock, common.js:1658).
describe('commercialFlight / tailNbrIncomplete', () => {
  it('locks FBO and Tail out once a flight number is entered', () => {
    expect(tripFormRules(values()).commercialFlight).toBe(false)
    expect(tripFormRules(values({ flightNumber: '  ' })).commercialFlight).toBe(false)
    expect(tripFormRules(values({ flightNumber: 'AF1234' })).commercialFlight).toBe(true)
  })

  // Flagged, not refused — the legacy highlighted the field and left the
  // booking submittable (refreshTailHighlight, common.js:1649).
  it('flags a tail number that is not a whole one yet', () => {
    expect(tripFormRules(values({ tailNbr: '' })).tailNbrIncomplete).toBe(false)
    expect(tripFormRules(values({ tailNbr: 'FGH' })).tailNbrIncomplete).toBe(true)
    expect(tripFormRules(values({ tailNbr: 'FGHIJ' })).tailNbrIncomplete).toBe(false)
  })
})

// Clicking "Check" and getting nothing back is the one outcome that reads as a
// broken button. The legacy said what was missing instead ("Enter the PU
// date/time to verify the flight", common.js:1693).
describe('flightCheckBlocker', () => {
  it('lets the check run once the flight, date and time are all there', () => {
    expect(flightCheckBlocker({ flightNumber: 'AF7315', pickupDate: '2026-09-15', pickupTime: '14:30' })).toBeNull()
  })

  it('asks for a flight number before anything else', () => {
    expect(flightCheckBlocker({ flightNumber: '  ', pickupDate: '2026-09-15', pickupTime: '14:30' })).toBe(
      'Enter a flight number to check it.',
    )
  })

  it.each([
    ['no date', { pickupDate: '', pickupTime: '14:30' }],
    ['no time', { pickupDate: '2026-09-15', pickupTime: '' }],
    ['neither', { pickupDate: '', pickupTime: '' }],
  ])('says the pickup date/time is what it is missing — %s', (_case, when) => {
    expect(flightCheckBlocker({ flightNumber: 'AF7315', ...when })).toBe(
      'Enter the pickup date and time to verify the flight.',
    )
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
