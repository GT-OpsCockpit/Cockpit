import { describe, expect, it } from 'vitest'
import { partnerFormDefaults, partnerFormSchema, type PartnerFormValues } from './partner-form-schema'

function validBase(overrides: Partial<PartnerFormValues> = {}): PartnerFormValues {
  return {
    ...partnerFormDefaults(),
    individual: false,
    companyName: 'Riviera VTC Services',
    firstName: 'Marc',
    lastName: 'Voisin',
    phone: '+33612345678',
    email: 'dispatch@rivieravtc.fr',
    ...overrides,
  }
}

function validIndividual(overrides: Partial<PartnerFormValues> = {}): PartnerFormValues {
  return validBase({
    individual: true,
    companyName: '',
    firstName: 'Ahmed',
    lastName: 'Ben Salah',
    vehicleCategory: 'Business',
    vehicleMake: 'Mercedes-Benz',
    vehicleModel: 'E-Class',
    vehicleColor: 'Metallic Black',
    vehicleRegNbr: 'AB-123-CD',
    mobile: '+33612345679',
    countryCode: 'FR',
    area: 'Local',
    ...overrides,
  })
}

describe('partnerFormSchema', () => {
  it('accepts a fully valid company partner', () => {
    expect(partnerFormSchema.safeParse(validBase()).success).toBe(true)
  })

  it('accepts a fully valid individual with their own vehicle', () => {
    const result = partnerFormSchema.safeParse(validIndividual())
    expect(result.success).toBe(true)
  })

  it('rejects a company partner with no company name', () => {
    const result = partnerFormSchema.safeParse(validBase({ companyName: '' }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0])).toContain('companyName')
    }
  })

  it('accepts a company partner with no landline — only the email is required', () => {
    expect(partnerFormSchema.safeParse(validBase({ phone: '' })).success).toBe(true)
  })

  it('rejects a malformed phone', () => {
    expect(partnerFormSchema.safeParse(validBase({ phone: 'not a phone' })).success).toBe(false)
  })

  it('asks an individual for every driver and vehicle field, the landline excepted', () => {
    const paths = (overrides: Partial<PartnerFormValues>) => {
      const result = partnerFormSchema.safeParse(validIndividual(overrides))
      return result.success ? [] : result.error.issues.map((i) => i.path[0])
    }
    expect(paths({ mobile: '' })).toContain('mobile')
    expect(paths({ countryCode: '' })).toContain('countryCode')
    expect(paths({ area: '' })).toContain('area')
    expect(paths({ vehicleColor: '' })).toContain('vehicleColor')
    expect(paths({ phone: '' })).toEqual([])
  })

  it('rejects a missing email', () => {
    const result = partnerFormSchema.safeParse(validBase({ email: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects a missing first or last name', () => {
    expect(partnerFormSchema.safeParse(validBase({ firstName: '' })).success).toBe(false)
    expect(partnerFormSchema.safeParse(validBase({ lastName: '' })).success).toBe(false)
  })

  it('rejects an invalid mobile', () => {
    const result = partnerFormSchema.safeParse(validBase({ mobile: 'not a phone' }))
    expect(result.success).toBe(false)
  })

  it('accepts no mobile at all — it is optional', () => {
    expect(partnerFormSchema.safeParse(validBase({ mobile: '' })).success).toBe(true)
  })

  it('rejects an individual with no vehicle filled in', () => {
    const result = partnerFormSchema.safeParse(
      validIndividual({ vehicleCategory: '', vehicleMake: '', vehicleModel: '', vehicleRegNbr: '' }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toEqual(
        expect.arrayContaining(['vehicleCategory', 'vehicleMake', 'vehicleModel', 'vehicleRegNbr']),
      )
    }
  })

  it('does not require a vehicle for a company partner', () => {
    expect(partnerFormSchema.safeParse(validBase()).success).toBe(true)
  })
})
