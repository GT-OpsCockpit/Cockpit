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

  // Farming a job out is agreeing a price for it — the legacy refused to
  // confirm the sub-contract popup without one (common.js:2812).
  describe('partnerRateEur — required to sub-contract', () => {
    it('rejects a sub-contracted booking with no partner rate', () => {
      expect(issuePaths(validBase({ subContractor: true, partnerRateEur: undefined }))).toContain('partnerRateEur')
    })

    it('rejects a zero partner rate, which is not a price', () => {
      expect(issuePaths(validBase({ subContractor: true, partnerRateEur: 0 }))).toContain('partnerRateEur')
    })

    it('accepts a sub-contracted booking once a rate is given', () => {
      expect(
        tripFormSchema.safeParse(validBase({ subContractor: true, partnerRateEur: 90, partnerRef: 'D-XX-XX-UBE-001' }))
          .success,
      ).toBe(true)
    })

    it('asks nothing of a booking that is not sub-contracted', () => {
      expect(tripFormSchema.safeParse(validBase({ subContractor: false, partnerRateEur: undefined })).success).toBe(true)
    })
  })

  // The legacy kept the submit button greyed out until the Partner company was
  // entered (refreshFormGuards, common.js:1046-1054). Without it a booking is
  // farmed out to nobody: the server pins it at "Sent" and never re-arms the
  // Send button (decideAssignment's `locked`), so it silently goes nowhere.
  describe('partnerRef — required to sub-contract', () => {
    it('rejects a sub-contracted booking with no partner company', () => {
      expect(issuePaths(validBase({ subContractor: true, partnerRateEur: 90, partnerRef: '' }))).toContain('partnerRef')
    })

    it('rejects a partner company that is only whitespace', () => {
      expect(issuePaths(validBase({ subContractor: true, partnerRateEur: 90, partnerRef: '   ' }))).toContain(
        'partnerRef',
      )
    })

    it('asks nothing of a booking that is not sub-contracted', () => {
      expect(tripFormSchema.safeParse(validBase({ subContractor: false, partnerRef: '' })).success).toBe(true)
    })
  })

  // Every message here is rendered verbatim to the dispatcher by <FormMessage>.
  // Zod's own defaults ("Too small: expected string to have >=1 characters")
  // are internal wording that leaked to the screen on Area and Pax nb — this
  // block pins the readable text and guards the whole schema against the next
  // constraint added without one.
  describe('error messages — readable, never Zod internals', () => {
    function messagesFor(values: TripFormValues): string[] {
      const result = tripFormSchema.safeParse(values)
      return result.success ? [] : result.error.issues.map((i) => i.message)
    }

    it('names the Area field rather than its string length', () => {
      expect(messagesFor(validBase({ area: '' }))).toContain('Area is required.')
    })

    it.each([0, 51])('states the Pax nb range rather than the bound (%i)', (paxCount) => {
      expect(messagesFor(validBase({ paxCount }))).toContain('Pax nb must be between 1 and 50.')
    })

    it('states the Pax nb range for a fractional count', () => {
      expect(messagesFor(validBase({ paxCount: 2.5 }))).toContain('Pax nb must be between 1 and 50.')
    })

    it('rejects a negative price in words', () => {
      expect(messagesFor(validBase({ priceEur: -5 }))).toContain('A price cannot be negative.')
    })

    it('rejects a negative buffer time in words', () => {
      expect(messagesFor(validBase({ bufferTime: -10 }))).toContain('Buffer time cannot be negative.')
    })

    it('leaves no Zod default message anywhere, however many fields are wrong', () => {
      const messages = messagesFor(
        validBase({
          area: '',
          paxCount: 0,
          countryCode: '',
          passengerName: '',
          pickupLocation: '',
          priceEur: -1,
          bufferTime: -1,
        }),
      )
      expect(messages.length).toBeGreaterThan(0)
      for (const message of messages) {
        expect(message).not.toMatch(/^(Too small|Too big|Invalid input|Invalid option)/)
      }
    })
  })
})
