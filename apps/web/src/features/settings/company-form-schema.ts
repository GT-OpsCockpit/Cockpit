import { z } from 'zod'

/**
 * Mirrors UpdateCompanyInfoDto exactly (apps/api/src/company/dto/update-company-info.dto.ts):
 * all 13 fields are @IsNotEmpty(), no format validation (no email regex on
 * email/ownerEmail — the backend never has one either, unlike client-form-schema).
 */
export const companyFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  legalName: z.string().min(1, 'Legal name is required.'),
  street1: z.string().min(1, 'Street is required.'),
  zipCode: z.string().min(1, 'Zip code is required.'),
  city: z.string().min(1, 'City is required.'),
  countryCode: z.string().min(1, 'Country is required.'),
  vatNbr: z.string().min(1, 'VAT number is required.'),
  email: z.string().min(1, 'Email is required.'),
  website: z.string().min(1, 'Website is required.'),
  ownerSurname: z.string().min(1, 'Owner surname is required.'),
  ownerName: z.string().min(1, 'Owner name is required.'),
  mobile: z.string().min(1, 'Mobile is required.'),
  ownerEmail: z.string().min(1, 'Owner email is required.'),
})

export type CompanyFormValues = z.infer<typeof companyFormSchema>

export function companyFormDefaults(): CompanyFormValues {
  return {
    name: '',
    legalName: '',
    street1: '',
    zipCode: '',
    city: '',
    countryCode: '',
    vatNbr: '',
    email: '',
    website: '',
    ownerSurname: '',
    ownerName: '',
    mobile: '',
    ownerEmail: '',
  }
}
