import { describe, expect, it } from 'vitest'
import { ClientEntityBilling, ClientEntityClientType } from '@cockpit/shared/api'
import { clientFormSchema, type ClientFormValues } from './client-form-schema'

/**
 * Which fields an account needs is the shared rule, tested as a table in
 * packages/shared/src/business/record-requirements.test.ts. What is tested
 * here is the two things the schema itself owns: that the shared gaps land on
 * the right form fields (addRequiredFieldIssues), and the format validation
 * that never depended on the account type.
 */

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

function issues(values: ClientFormValues): { path: string; message: string }[] {
  const result = clientFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))
}

describe('clientFormSchema — the shared rules reach the right fields', () => {
  it('accepts a fully valid Individual account', () => {
    expect(clientFormSchema.safeParse(validBase()).success).toBe(true)
  })

  // One rule about two fields: the form has to mark both boxes, not only the
  // one the rule happened to be written against.
  it('marks both name fields, with the shared message, when an Individual has no name', () => {
    expect(issues(validBase({ contactFirstName: '', contactLastName: '' }))).toEqual([
      { path: 'contactFirstName', message: 'First and last name are required for an Individual-type account.' },
      { path: 'contactLastName', message: 'First and last name are required for an Individual-type account.' },
    ])
  })

  // Four separate gaps have to stay four separate fields — a single combined
  // message could not say which box is empty.
  it("marks each of an Events account's own fields separately", () => {
    const eventBase = validBase({
      clientType: ClientEntityClientType.EVENT,
      contactFirstName: '',
      contactLastName: '',
      company: '',
    })
    expect(issues(eventBase).map((i) => i.path)).toEqual([
      'company',
      'eventCountry',
      'eventArea',
      'eventStartDate',
      'eventEndDate',
    ])
  })

  it('applies no account-type requirement the shared rules did not raise', () => {
    const event = validBase({
      clientType: ClientEntityClientType.EVENT,
      contactFirstName: '',
      contactLastName: '',
      company: 'Grand Prix 2026',
      eventCountry: 'FR',
      eventArea: 'Nice',
      eventStartDate: '2026-09-01',
      eventEndDate: '2026-09-05',
    })
    expect(clientFormSchema.safeParse(event).success).toBe(true)
  })
})

describe('clientFormSchema — formats, which do not depend on the account type', () => {
  it('accepts a blank email/pocEmail (both optional)', () => {
    expect(clientFormSchema.safeParse(validBase({ email: '', pocEmail: '' })).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(issues(validBase({ email: 'not-an-email' })).map((i) => i.path)).toContain('email')
  })

  it('rejects a malformed pocEmail', () => {
    expect(issues(validBase({ pocEmail: 'not-an-email' })).map((i) => i.path)).toContain('pocEmail')
  })

  it('accepts a well-formed email and pocEmail', () => {
    const result = clientFormSchema.safeParse(
      validBase({ email: 'sophie.martin@example.com', pocEmail: 'poc@example.com' }),
    )
    expect(result.success).toBe(true)
  })
})
