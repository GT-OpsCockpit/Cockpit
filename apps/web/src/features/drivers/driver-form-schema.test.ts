import { describe, expect, it } from 'vitest'
import { driverFormSchema, type DriverFormValues } from './driver-form-schema'

/**
 * Which fields a driver needs is the shared rule, tested as a table in
 * packages/shared/src/business/record-requirements.test.ts. What is tested
 * here is that those gaps reach the right form fields, and the contact
 * formats the schema owns on its own.
 */

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

function issues(values: DriverFormValues): { path: string; message: string }[] {
  const result = driverFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))
}

describe('driverFormSchema — the shared rules reach the right fields', () => {
  it('accepts a fully valid own chauffeur', () => {
    expect(driverFormSchema.safeParse(base({ firstName: 'John', lastName: 'Smith', phone: '+33611111111' })).success).toBe(
      true,
    )
  })

  it('marks every missing field of an own chauffeur, each with its own message', () => {
    expect(issues(base())).toEqual([
      { path: 'firstName', message: 'First name is required.' },
      { path: 'lastName', message: 'Last name is required.' },
      { path: 'phone', message: 'Phone is required.' },
    ])
  })

  // The discriminant is a field of the form itself: typing a Company changes
  // which boxes the form marks, live.
  it('marks a different set as soon as a Company is typed', () => {
    expect(issues(base({ company: 'Uber' }))).toEqual([
      { path: 'email', message: 'Email is required for a partner company.' },
    ])
  })

  it('marks the whole Events block, the Event link included', () => {
    expect(issues(base({ eventsOnly: true })).map((i) => i.path)).toEqual([
      'company',
      'firstName',
      'lastName',
      'email',
      'phone',
      'eventCountry',
      'eventArea',
      'eventRef',
    ])
  })
})

describe("driverFormSchema — contact formats (mirrors the API's @IsPhone / @IsEmailFormat)", () => {
  it('rejects a phone that is not E.164, including the national form it used to store', () => {
    for (const phone of ['0611111111', 'not-a-phone', '+33400456789']) {
      expect(issues(base({ firstName: 'John', lastName: 'Smith', phone })).map((i) => i.path)).toContain('phone')
    }
  })

  it('rejects an email that is not one', () => {
    expect(issues(base({ company: 'Uber', email: 'ops@uber' })).map((i) => i.path)).toContain('email')
  })

  it('accepts a partner company with just a company and a well-formed email', () => {
    expect(driverFormSchema.safeParse(base({ company: 'Uber', email: 'ops@uber.test' })).success).toBe(true)
  })
})
