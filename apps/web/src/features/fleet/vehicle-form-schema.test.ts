import { describe, expect, it } from 'vitest'
import { vehicleFormSchema, type VehicleFormValues } from './vehicle-form-schema'

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

function issuePaths(values: VehicleFormValues): string[] {
  const result = vehicleFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]))
}

describe('vehicleFormSchema — conditional validation (mirrors FleetVehiclesService.assertValid)', () => {
  it('accepts a fully valid local vehicle', () => {
    expect(vehicleFormSchema.safeParse(base()).success).toBe(true)
  })

  it.each(['category', 'regNbr', 'acronym', 'make', 'model'] as const)('rejects with %s blank', (field) => {
    expect(issuePaths(base({ [field]: '' }))).toContain(field)
  })

  it('rejects an acronym longer than 6 characters', () => {
    expect(issuePaths(base({ acronym: 'TOOLONG' }))).toContain('acronym')
  })

  describe('external (non-local) — country, area and partner all required', () => {
    it('accepts with all three set', () => {
      expect(
        vehicleFormSchema.safeParse(base({ isLocal: false, countryCode: 'FR', area: 'Paris', partnerCompany: 'Acme' })).success,
      ).toBe(true)
    })

    it.each(['countryCode', 'area', 'partnerCompany'] as const)('rejects with %s blank', (field) => {
      expect(
        issuePaths(base({ isLocal: false, countryCode: 'FR', area: 'Paris', partnerCompany: 'Acme', [field]: '' })),
      ).toContain(field)
    })

    it('does not require them when local', () => {
      expect(vehicleFormSchema.safeParse(base({ isLocal: true })).success).toBe(true)
    })
  })

  describe('eventsOnly — event country, area and ref all required', () => {
    function eventBase(overrides: Partial<VehicleFormValues> = {}): VehicleFormValues {
      return base({ eventsOnly: true, eventCountry: 'MC', eventArea: 'Monaco', eventRef: 'CE1', ...overrides })
    }

    it('accepts a fully valid Events vehicle', () => {
      expect(vehicleFormSchema.safeParse(eventBase()).success).toBe(true)
    })

    it.each(['eventCountry', 'eventArea', 'eventRef'] as const)('rejects with %s blank', (field) => {
      expect(issuePaths(eventBase({ [field]: '' }))).toContain(field)
    })
  })
})
