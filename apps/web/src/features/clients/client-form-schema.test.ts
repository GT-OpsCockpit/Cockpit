import { describe, expect, it } from 'vitest'
import { ClientEntityBilling, ClientEntityClientType } from '@cockpit/shared/api'
import { clientFormSchema, type ClientFormValues } from './client-form-schema'

function validBase(overrides: Partial<ClientFormValues> = {}): ClientFormValues {
  return {
    clientType: ClientEntityClientType.INDIVIDUAL,
    contactFirstName: 'Marc',
    contactLastName: 'Dubois',
    company: '',
    acronym: '',
    refPoOther: '',
    address: '',
    postalCode: '',
    city: '',
    countryCode: '',
    vatNumber: '',
    email: '',
    billing: ClientEntityBilling.ACCOUNT,
    pocName: '',
    pocPhone: '',
    pocEmail: '',
    eventCountry: '',
    eventArea: '',
    eventStartDate: '',
    eventEndDate: '',
    ...overrides,
  }
}

function issuePaths(values: ClientFormValues): string[] {
  const result = clientFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]))
}

describe('clientFormSchema — conditional validation', () => {
  it('accepts a fully valid Individual account', () => {
    expect(clientFormSchema.safeParse(validBase()).success).toBe(true)
  })

  describe('Individual — contact first/last name required', () => {
    it('rejects with both names blank', () => {
      const issues = issuePaths(validBase({ contactFirstName: '', contactLastName: '' }))
      expect(issues).toContain('contactFirstName')
      expect(issues).toContain('contactLastName')
    })

    it('rejects with only the first name blank', () => {
      expect(issuePaths(validBase({ contactFirstName: '' }))).toContain('contactFirstName')
    })

    it('rejects whitespace-only names', () => {
      const issues = issuePaths(validBase({ contactFirstName: '   ', contactLastName: '   ' }))
      expect(issues).toContain('contactFirstName')
      expect(issues).toContain('contactLastName')
    })

    it('is not enforced for Company or Events', () => {
      const company = clientFormSchema.safeParse(
        validBase({
          clientType: ClientEntityClientType.COMPANY,
          contactFirstName: '',
          contactLastName: '',
          company: 'Acme Corp',
        }),
      )
      expect(company.success).toBe(true)

      const event = clientFormSchema.safeParse(
        validBase({
          clientType: ClientEntityClientType.EVENT,
          contactFirstName: '',
          contactLastName: '',
          company: 'Grand Prix 2026',
          eventCountry: 'FR',
          eventArea: 'Nice',
          eventStartDate: '2026-09-01',
          eventEndDate: '2026-09-05',
        }),
      )
      expect(event.success).toBe(true)
    })
  })

  describe('Company — company name required', () => {
    it('rejects with company name blank', () => {
      expect(
        issuePaths(validBase({ clientType: ClientEntityClientType.COMPANY, contactFirstName: '', contactLastName: '', company: '' })),
      ).toContain('company')
    })

    it('accepts once company name is set', () => {
      const result = clientFormSchema.safeParse(
        validBase({ clientType: ClientEntityClientType.COMPANY, contactFirstName: '', contactLastName: '', company: 'Acme Corp' }),
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Events — company (event name), country, area, start/end date all required', () => {
    function eventBase(overrides: Partial<ClientFormValues> = {}): ClientFormValues {
      return validBase({
        clientType: ClientEntityClientType.EVENT,
        contactFirstName: '',
        contactLastName: '',
        company: 'Grand Prix 2026',
        eventCountry: 'FR',
        eventArea: 'Nice',
        eventStartDate: '2026-09-01',
        eventEndDate: '2026-09-05',
        ...overrides,
      })
    }

    it('accepts a fully valid Events account', () => {
      expect(clientFormSchema.safeParse(eventBase()).success).toBe(true)
    })

    it('rejects with the event name (company field) blank', () => {
      expect(issuePaths(eventBase({ company: '' }))).toContain('company')
    })

    it.each(['eventCountry', 'eventArea', 'eventStartDate', 'eventEndDate'] as const)(
      'rejects with %s blank',
      (field) => {
        expect(issuePaths(eventBase({ [field]: '' }))).toContain(field)
      },
    )

    it('does not require contact first/last name', () => {
      expect(clientFormSchema.safeParse(eventBase()).success).toBe(true)
    })
  })

  describe('email format — shared isValidEmail(), applies to both email and pocEmail', () => {
    it('accepts a blank email/pocEmail (both optional)', () => {
      expect(clientFormSchema.safeParse(validBase({ email: '', pocEmail: '' })).success).toBe(true)
    })

    it('rejects a malformed email', () => {
      expect(issuePaths(validBase({ email: 'not-an-email' }))).toContain('email')
    })

    it('rejects a malformed pocEmail', () => {
      expect(issuePaths(validBase({ pocEmail: 'not-an-email' }))).toContain('pocEmail')
    })

    it('accepts a well-formed email and pocEmail', () => {
      const result = clientFormSchema.safeParse(
        validBase({ email: 'sophie.martin@example.com', pocEmail: 'poc@example.com' }),
      )
      expect(result.success).toBe(true)
    })
  })
})
