import { describe, expect, it } from 'vitest'
import { driverFormSchema, type DriverFormValues } from './driver-form-schema'

function base(overrides: Partial<DriverFormValues> = {}): DriverFormValues {
  return {
    countryCode: '',
    area: '',
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    email: '',
    eventsOnly: false,
    eventCountry: '',
    eventArea: '',
    eventRef: '',
    ...overrides,
  }
}

function issuePaths(values: DriverFormValues): string[] {
  const result = driverFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]))
}

describe('driverFormSchema — conditional validation (mirrors assertValidDriverFields)', () => {
  describe('internal driver — no company: firstName, lastName and phone required', () => {
    it('accepts a fully valid internal driver', () => {
      expect(driverFormSchema.safeParse(base({ firstName: 'John', lastName: 'Smith', phone: '0611111111' })).success).toBe(
        true,
      )
    })

    it('rejects with any of firstName/lastName/phone blank', () => {
      expect(issuePaths(base({ lastName: 'Smith', phone: '0611111111' }))).toContain('firstName')
      expect(issuePaths(base({ firstName: 'John', phone: '0611111111' }))).toContain('lastName')
      expect(issuePaths(base({ firstName: 'John', lastName: 'Smith' }))).toContain('phone')
    })

    it('does not require email', () => {
      expect(driverFormSchema.safeParse(base({ firstName: 'John', lastName: 'Smith', phone: '0611111111' })).success).toBe(
        true,
      )
    })
  })

  describe('partner company, no contact name — email only required', () => {
    it('accepts with just company + email', () => {
      expect(driverFormSchema.safeParse(base({ company: 'Uber', email: 'ops@uber.test' })).success).toBe(true)
    })

    it('rejects with email blank', () => {
      expect(issuePaths(base({ company: 'Uber' }))).toContain('email')
    })

    it('does not require phone', () => {
      expect(driverFormSchema.safeParse(base({ company: 'Uber', email: 'ops@uber.test' })).success).toBe(true)
    })
  })

  describe('named partner chauffeur (company + a name) — email AND phone required', () => {
    it('accepts with company, a name, email and phone', () => {
      const result = driverFormSchema.safeParse(
        base({ company: 'Uber', firstName: 'Bob', email: 'bob@uber.test', phone: '0611111111' }),
      )
      expect(result.success).toBe(true)
    })

    it('rejects with email blank', () => {
      expect(issuePaths(base({ company: 'Uber', firstName: 'Bob', phone: '0611111111' }))).toContain('email')
    })

    it('rejects with phone blank', () => {
      expect(issuePaths(base({ company: 'Uber', firstName: 'Bob', email: 'bob@uber.test' }))).toContain('phone')
    })

    it('triggers on lastName alone, same as firstName alone', () => {
      expect(issuePaths(base({ company: 'Uber', lastName: 'Smith', email: 'bob@uber.test' }))).toContain('phone')
    })
  })

  describe('eventsOnly — company, firstName, lastName, email, phone, and the Event link all required', () => {
    function eventBase(overrides: Partial<DriverFormValues> = {}): DriverFormValues {
      return base({
        eventsOnly: true,
        company: 'Acme',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.test',
        phone: '0611111111',
        eventCountry: 'MC',
        eventArea: 'Monaco',
        eventRef: 'CE1',
        ...overrides,
      })
    }

    it('accepts a fully valid Events driver', () => {
      expect(driverFormSchema.safeParse(eventBase()).success).toBe(true)
    })

    it.each(['company', 'firstName', 'lastName', 'email', 'phone', 'eventCountry', 'eventArea', 'eventRef'] as const)(
      'rejects with %s blank',
      (field) => {
        expect(issuePaths(eventBase({ [field]: '' }))).toContain(field)
      },
    )

    it('bypasses the non-events partner/internal branches entirely', () => {
      // No company-based branching applies once eventsOnly is set — every
      // field above is unconditionally required regardless of company shape.
      expect(driverFormSchema.safeParse(eventBase()).success).toBe(true)
    })
  })
})
