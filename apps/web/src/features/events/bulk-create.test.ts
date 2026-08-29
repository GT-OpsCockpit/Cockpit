import { describe, expect, it } from 'vitest'
import { TripEntityBilling, TripEntityService } from '@cockpit/shared/api'
import type { TripFormValues } from '../bookings/trip-form-schema'
import { bulkLegForIndex, buildBulkTripDto, eachDateInRange } from './bulk-create'

function baseFormValues(overrides: Partial<TripFormValues> = {}): TripFormValues {
  return {
    countryCode: 'FR',
    area: 'Local',
    pickupDate: '2026-09-01',
    pickupTime: '10:00',
    service: TripEntityService.TSF,
    hours: undefined,
    vehicleType: 'Business',
    paxCount: 2,
    clientRef: 'CE1',
    billing: TripEntityBilling.ACCOUNT,
    passengerName: 'Jane Doe',
    pickupLocation: 'Nice Airport',
    dropoffLocation: 'Hotel Negresco',
    instructions: '',
    pocName: '',
    pocPhone: '',
    driverRef: 'D-1',
    fleetRegNbr: 'AB-123-CD',
    subContractor: true,
    partnerRef: 'D-2',
    priceEur: 150,
    partnerRateEur: 90,
    tracking: true,
    flightNumber: '',
    bufferTime: undefined,
    fboAddress: '',
    tailNbr: '',
    pickupIata: '',
    dropoffIata: '',
    pickupTimezone: 'Europe/Paris',
    notifyDriver: false,
    ...overrides,
  }
}

describe('eachDateInRange', () => {
  it('is inclusive of both endpoints', () => {
    expect(eachDateInRange('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('is a single day when start equals end', () => {
    expect(eachDateInRange('2026-09-01', '2026-09-01')).toEqual(['2026-09-01'])
  })
})

describe('bulkLegForIndex', () => {
  it('day 1 uses the typed PU/DO as-is', () => {
    expect(bulkLegForIndex(0, 3, 'Nice Airport', 'Hotel Negresco')).toEqual({
      pickupLocation: 'Nice Airport',
      dropoffLocation: 'Hotel Negresco',
    })
  })

  it('a middle day picks up and drops off at day 1\'s drop-off (client stays put)', () => {
    expect(bulkLegForIndex(1, 3, 'Nice Airport', 'Hotel Negresco')).toEqual({
      pickupLocation: 'Hotel Negresco',
      dropoffLocation: 'Hotel Negresco',
    })
  })

  it('the last day picks up from day 1\'s drop-off but has no drop-off', () => {
    expect(bulkLegForIndex(3, 3, 'Nice Airport', 'Hotel Negresco')).toEqual({
      pickupLocation: 'Hotel Negresco',
      dropoffLocation: '',
    })
  })

  it('a single-day range is both day 1 and the last day — day 1 wins', () => {
    expect(bulkLegForIndex(0, 0, 'Nice Airport', 'Hotel Negresco')).toEqual({
      pickupLocation: 'Nice Airport',
      dropoffLocation: 'Hotel Negresco',
    })
  })
})

describe('buildBulkTripDto', () => {
  it('strips driver/vehicle/partner wiring — bulk legs are never dispatched at creation', () => {
    const dto = buildBulkTripDto(
      baseFormValues(),
      '2026-09-02',
      { pickupLocation: 'Hotel Negresco', dropoffLocation: 'Hotel Negresco' },
      { isLastLeg: false },
    )
    expect(dto).not.toHaveProperty('driverRef')
    expect(dto).not.toHaveProperty('fleetRegNbr')
    expect(dto).not.toHaveProperty('subContractor')
    expect(dto).not.toHaveProperty('partnerRef')
    expect(dto).not.toHaveProperty('partnerRateEur')
  })

  it('overrides the date and PU/DO from the leg, keeps every other field from the bar', () => {
    const dto = buildBulkTripDto(
      baseFormValues(),
      '2026-09-02',
      { pickupLocation: 'Hotel Negresco', dropoffLocation: 'Hotel Negresco' },
      { isLastLeg: false },
    )
    expect(dto.pickupLocation).toBe('Hotel Negresco')
    expect(dto.dropoffLocation).toBe('Hotel Negresco')
    expect(dto.pickupAt.startsWith('2026-09-02')).toBe(true)
    expect(dto.clientRef).toBe('CE1')
    expect(dto.vehicleType).toBe('Business')
  })

  it('forces the last leg to ASD with a default of 4h when its drop-off is empty and no valid ASD hours are set', () => {
    const dto = buildBulkTripDto(
      baseFormValues({ service: TripEntityService.TSF, hours: undefined }),
      '2026-09-05',
      { pickupLocation: 'Hotel Negresco', dropoffLocation: '' },
      { isLastLeg: true },
    )
    expect(dto.service).toBe(TripEntityService.ASD)
    expect(dto.hours).toBe(4)
    expect(dto.dropoffLocation).toBeUndefined()
  })

  it('keeps an already-valid ASD hours value on the forced last leg instead of overwriting it', () => {
    const dto = buildBulkTripDto(
      baseFormValues({ service: TripEntityService.TSF, hours: 10 }),
      '2026-09-05',
      { pickupLocation: 'Hotel Negresco', dropoffLocation: '' },
      { isLastLeg: true },
    )
    expect(dto.service).toBe(TripEntityService.ASD)
    expect(dto.hours).toBe(10)
  })

  it('does not force ASD on the last leg when it still has a drop-off (single-day range)', () => {
    const dto = buildBulkTripDto(
      baseFormValues({ service: TripEntityService.TSF }),
      '2026-09-01',
      { pickupLocation: 'Nice Airport', dropoffLocation: 'Hotel Negresco' },
      { isLastLeg: true },
    )
    expect(dto.service).toBe(TripEntityService.TSF)
    expect(dto.dropoffLocation).toBe('Hotel Negresco')
  })

  it('combines a booking reference and per-batch instructions, else falls back to the bar\'s own instructions', () => {
    const withOverride = buildBulkTripDto(baseFormValues({ instructions: 'From the bar' }), '2026-09-02', {
      pickupLocation: 'A',
      dropoffLocation: 'B',
    }, { isLastLeg: false, reference: 'PO-123', instructions: 'Batch note' })
    expect(withOverride.instructions).toBe('Ref: PO-123 — Batch note')

    const withoutOverride = buildBulkTripDto(baseFormValues({ instructions: 'From the bar' }), '2026-09-02', {
      pickupLocation: 'A',
      dropoffLocation: 'B',
    }, { isLastLeg: false })
    expect(withoutOverride.instructions).toBe('From the bar')
  })

  // An event runs on a chain of bookings a whole team follows day by day, so
  // the legacy pinned tracking on for every one it generated, whatever the bar
  // was set to (events.html:655).
  it('tracks every booking it generates, even with the bar’s tracking switched off', () => {
    const dto = buildBulkTripDto(baseFormValues({ tracking: false }), '2026-09-02', {
      pickupLocation: 'A',
      dropoffLocation: 'B',
    }, { isLastLeg: false })
    expect(dto.tracking).toBe(true)
  })
})
