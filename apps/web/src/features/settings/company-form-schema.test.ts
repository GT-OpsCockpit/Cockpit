import { describe, expect, it } from 'vitest'
import { companyFormDefaults, companyFormSchema, type CompanyFormValues } from './company-form-schema'

function fullyValid(): CompanyFormValues {
  return {
    name: 'Cockpit Transport',
    legalName: 'Cockpit Transport SARL',
    street1: '1 Rue de la Paix',
    zipCode: '75002',
    city: 'Paris',
    countryCode: 'FR',
    vatNbr: 'FR12345678901',
    email: 'contact@cockpit.test',
    website: 'https://cockpit.test',
    ownerSurname: 'Dubois',
    ownerName: 'Marc',
    mobile: '0611111111',
    ownerEmail: 'marc.dubois@cockpit.test',
  }
}

describe('companyFormSchema — mirrors UpdateCompanyInfoDto (all-or-nothing, no format checks)', () => {
  it('accepts a fully filled form', () => {
    expect(companyFormSchema.safeParse(fullyValid()).success).toBe(true)
  })

  it('rejects an all-empty form (companyFormDefaults())', () => {
    const result = companyFormSchema.safeParse(companyFormDefaults())
    expect(result.success).toBe(false)
  })

  it.each([
    'name',
    'legalName',
    'street1',
    'zipCode',
    'city',
    'countryCode',
    'vatNbr',
    'email',
    'website',
    'ownerSurname',
    'ownerName',
    'mobile',
    'ownerEmail',
  ] as const)('rejects with only %s blank', (field) => {
    const result = companyFormSchema.safeParse({ ...fullyValid(), [field]: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((i) => String(i.path[0]))).toContain(field)
  })

  it('does not require email/ownerEmail to look like an email — the backend never has either', () => {
    expect(companyFormSchema.safeParse({ ...fullyValid(), email: 'not-an-email', ownerEmail: 'also-not' }).success).toBe(
      true,
    )
  })
})
