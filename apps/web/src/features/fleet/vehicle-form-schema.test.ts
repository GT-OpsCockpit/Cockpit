import { describe, expect, it } from 'vitest'
import { vehicleFormSchema, type VehicleFormValues } from './vehicle-form-schema'

/**
 * Which fields a vehicle needs given its Local/external and Events flags is
 * the shared rule, tested as a table in
 * packages/shared/src/business/record-requirements.test.ts. What is tested
 * here is that those gaps reach the right form fields, and the presence and
 * length rules the schema owns for its own free-typed boxes.
 */

function base(overrides: Partial<VehicleFormValues> = {}): VehicleFormValues {
  return {
    category: 'Business',
    isLocal: true,
    regNbr: 'AB-123-CD',
    acronym: 'S123',
    make: 'Mercedes-Benz',
    model: 'E-Class',
    yearOfBuild: 2025,
    color: 'Metallic Black',
    fourWD: false,
    nbPax: 3,
    countryCode: '',
    area: '',
    partnerCompany: '',
    eventsOnly: false,
    eventCountry: '',
    eventArea: '',
    eventRef: '',
    ...overrides,
  }
}

function issues(values: VehicleFormValues): { path: string; message: string }[] {
  const result = vehicleFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))
}

describe('vehicleFormSchema — the shared rules reach the right fields', () => {
  it('accepts a fully valid local vehicle', () => {
    expect(vehicleFormSchema.safeParse(base()).success).toBe(true)
  })

  // vehicles-lifecycle.spec.ts reads the first of these messages on screen,
  // character for character.
  it('marks each field an external vehicle is missing, with the shared message', () => {
    expect(issues(base({ isLocal: false }))).toEqual([
      { path: 'countryCode', message: 'Country is required for an external (non-local) vehicle.' },
      { path: 'area', message: 'Area is required for an external (non-local) vehicle.' },
      { path: 'partnerCompany', message: 'Partner is required for an external (non-local) vehicle.' },
    ])
  })

  it('marks the Event link block, and both blocks at once when both apply', () => {
    expect(issues(base({ eventsOnly: true })).map((i) => i.path)).toEqual(['eventCountry', 'eventArea', 'eventRef'])
    expect(issues(base({ isLocal: false, eventsOnly: true })).map((i) => i.path)).toEqual([
      'countryCode',
      'area',
      'partnerCompany',
      'eventCountry',
      'eventArea',
      'eventRef',
    ])
  })
})

describe('vehicleFormSchema — its own free-typed boxes', () => {
  it.each(['category', 'regNbr', 'acronym', 'make', 'model'] as const)('rejects with %s blank', (field) => {
    expect(issues(base({ [field]: '' })).map((i) => i.path)).toContain(field)
  })

  it('rejects an acronym longer than 6 characters', () => {
    expect(issues(base({ acronym: 'TOOLONG' })).map((i) => i.path)).toContain('acronym')
  })
})
