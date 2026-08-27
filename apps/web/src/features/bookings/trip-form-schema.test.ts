import { describe, expect, it } from 'vitest'
import { TripEntityBilling, TripEntityService } from '@cockpit/shared/api'
import { tripFormSchema, type TripFormValues } from './trip-form-schema'

function validBase(overrides: Partial<TripFormValues> = {}): TripFormValues {
  return {
    countryCode: 'FR',
    area: 'Local',
    pickupDate: '2026-09-01',
    pickupTime: '10:00',
    service: TripEntityService.TSF,
    hours: undefined,
    vehicleType: 'business',
    paxCount: 1,
    clientRef: 'CI1',
    billing: TripEntityBilling.ACCOUNT,
    passengerName: 'Jane Doe',
    pickupLocation: 'Nice Airport',
    dropoffLocation: 'Hotel Negresco',
    instructions: '',
    pocName: '',
    pocPhone: '',
    driverRef: '',
    fleetRegNbr: '',
    subContractor: false,
    partnerRef: '',
    priceEur: undefined,
    partnerRateEur: undefined,
    tracking: true,
    flightNumber: '',
    bufferTime: undefined,
    fboAddress: '',
    tailNbr: '',
    pickupIata: '',
    dropoffIata: '',
    pickupTimezone: '',
    notifyDriver: false,
    ...overrides,
  }
}

function issuePaths(values: TripFormValues): string[] {
  const result = tripFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]))
}

describe('tripFormSchema — conditional validation', () => {
  it('accepts a fully valid TSF booking', () => {
    expect(tripFormSchema.safeParse(validBase()).success).toBe(true)
  })

  describe('drop-off location — required except for ASD', () => {
    it('rejects a TSF booking with no drop-off', () => {
      expect(issuePaths(validBase({ dropoffLocation: '' }))).toContain('dropoffLocation')
    })

    it('rejects a SPEC booking with no drop-off', () => {
      expect(
        issuePaths(validBase({ service: TripEntityService.SPEC, dropoffLocation: '', instructions: 'Meet at gate 4' })),
      ).toContain('dropoffLocation')
    })

    it('accepts an ASD booking with no drop-off', () => {
      const result = tripFormSchema.safeParse(
        validBase({ service: TripEntityService.ASD, dropoffLocation: '', hours: 4 }),
      )
      expect(result.success).toBe(true)
    })
  })

  describe('hours — required for ASD, between 2 and 48', () => {
    it('rejects ASD with hours unset', () => {
      expect(issuePaths(validBase({ service: TripEntityService.ASD, hours: undefined, dropoffLocation: '' }))).toContain(
        'hours',
      )
    })

    it.each([0, 1, 49, 100])('rejects ASD with out-of-range hours (%i)', (hours) => {
      expect(issuePaths(validBase({ service: TripEntityService.ASD, hours, dropoffLocation: '' }))).toContain('hours')
    })

    it.each([2, 48])('accepts ASD at the boundary (%i hours)', (hours) => {
      const result = tripFormSchema.safeParse(validBase({ service: TripEntityService.ASD, hours, dropoffLocation: '' }))
      expect(result.success).toBe(true)
    })

    it('is not enforced for a non-ASD service, even left unset', () => {
      const result = tripFormSchema.safeParse(validBase({ service: TripEntityService.TSF, hours: undefined }))
      expect(result.success).toBe(true)
    })
  })

  describe('instructions — required for SPEC', () => {
    it('rejects SPEC with no instructions', () => {
      expect(issuePaths(validBase({ service: TripEntityService.SPEC, instructions: '' }))).toContain('instructions')
    })

    it('rejects SPEC with whitespace-only instructions', () => {
      expect(issuePaths(validBase({ service: TripEntityService.SPEC, instructions: '   ' }))).toContain('instructions')
    })

    it('accepts SPEC once instructions are provided', () => {
      const result = tripFormSchema.safeParse(validBase({ service: TripEntityService.SPEC, instructions: 'Meet at gate 4' }))
      expect(result.success).toBe(true)
    })

    it('is not enforced for TSF or ASD', () => {
      const tsf = tripFormSchema.safeParse(validBase({ service: TripEntityService.TSF, instructions: '' }))
      const asd = tripFormSchema.safeParse(validBase({ service: TripEntityService.ASD, instructions: '', dropoffLocation: '', hours: 4 }))
      expect(tsf.success).toBe(true)
      expect(asd.success).toBe(true)
    })
  })
})
