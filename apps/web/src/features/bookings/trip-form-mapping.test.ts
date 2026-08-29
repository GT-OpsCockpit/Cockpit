import { describe, expect, it } from 'vitest'
import { TripEntityBilling, TripEntityService } from '@cockpit/shared/api'
import { toUpdateTripDto } from './trip-form-mapping'
import type { TripFormValues } from './trip-form-schema'

/** A saved booking reopened in the edit dialog, farmed out to a partner. */
function values(overrides: Partial<TripFormValues> = {}): TripFormValues {
  return {
    countryCode: 'FR',
    area: 'Nice',
    pickupDate: '2026-09-01',
    pickupTime: '10:00',
    pickupTimezone: 'Europe/Paris',
    service: TripEntityService.TSF,
    vehicleType: 'Sedan',
    paxCount: 1,
    clientRef: 'CI1',
    billing: TripEntityBilling.ACCOUNT,
    passengerName: 'Jane Doe',
    pickupLocation: 'Nice Airport',
    dropoffLocation: 'Hotel Negresco',
    subContractor: true,
    partnerRef: 'D-FR-NI-ACM-001',
    partnerRateEur: 90,
    priceEur: 150,
    tracking: true,
    ...overrides,
  }
}

describe('toUpdateTripDto', () => {
  // Un-ticking "Sub-contracted" is how a booking is taken back in-house, and the
  // legacy said so explicitly: quickUpdateTrip(trip, { subContractor: false,
  // partnerRef: '' }) (common.js:2795-2802), which the PUT read as partnerRef =
  // null (server.js:2436-2440). Omitting the key instead leaves the key out of
  // the JSON, so the API's `if (dto.partnerRef !== undefined)` never fires and
  // the booking keeps its partner — still farmed out, still in the Partner log.
  it('detaches the partner explicitly when Sub-contracted is un-ticked', () => {
    const dto = toUpdateTripDto(values({ subContractor: false }), { notifyDriver: false })

    expect(dto.subContractor).toBe(false)
    expect(dto.partnerRef).toBe('')
  })

  // The PUT is a full replacement: an optional field left out is cleared. The
  // legacy's payload builder always sent the partner rate back (tripToPutPayload,
  // common.js:3286-3300) and its edit modal showed the field whatever the Sub-C
  // state, so taking a booking back in-house never destroyed what the partner
  // had been quoted. Dropping it here also reads as a price change to
  // trip-assignment's `priceChanged` gate, which 403s a DISPATCHER who never
  // touched a price.
  it('keeps the partner rate when Sub-contracted is un-ticked', () => {
    const dto = toUpdateTripDto(values({ subContractor: false }), { notifyDriver: false })

    expect(dto.partnerRateEur).toBe(90)
  })

  // The instant is only unambiguous alongside the zone it was read in: the API
  // stores this one rather than the country's default, which is a different
  // zone wherever a country spans several (Canaries under ES).
  it('sends the timezone the pickup was geocoded in, next to the instant built from it', () => {
    const dto = toUpdateTripDto(
      values({ pickupTimezone: 'Atlantic/Canary', pickupDate: '2026-09-01', pickupTime: '10:00' }),
      { notifyDriver: false },
    )

    expect(dto.pickupTimezone).toBe('Atlantic/Canary')
    // 10:00 in the Canaries (UTC+1 in September) is 09:00Z. Re-read in Spain's
    // default Europe/Madrid (UTC+2) that same instant reads 11:00 — the hour
    // the booking would show, and the POC would be told, without this field.
    expect(dto.pickupAt).toBe('2026-09-01T09:00:00.000Z')
  })

  it('sends the partner and rate as typed while Sub-contracted is on', () => {
    const dto = toUpdateTripDto(values(), { notifyDriver: false })

    expect(dto.partnerRef).toBe('D-FR-NI-ACM-001')
    expect(dto.partnerRateEur).toBe(90)
  })
})
