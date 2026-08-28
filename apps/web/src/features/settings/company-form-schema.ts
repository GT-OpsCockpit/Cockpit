import { z } from 'zod'
import { requiredEmail, requiredPhone } from '@/lib/contact-fields'

/**
 * Mirrors UpdateCompanyInfoDto exactly (apps/api/src/company/dto/update-company-info.dto.ts):
 * all 13 fields are required together, and the two emails and the mobile also
 * have to be well-formed — the same @IsEmailFormat/@IsPhone the DTO applies.
 */
export const companyFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  legalName: z.string().min(1, 'Legal name is required.'),
  street1: z.string().min(1, 'Street is required.'),
  zipCode: z.string().min(1, 'Zip code is required.'),
  city: z.string().min(1, 'City is required.'),
  countryCode: z.string().min(1, 'Country is required.'),
  vatNbr: z.string().min(1, 'VAT number is required.'),
  email: requiredEmail('Email is required.'),
  website: z.string().min(1, 'Website is required.'),
  ownerSurname: z.string().min(1, 'Owner surname is required.'),
  ownerName: z.string().min(1, 'Owner name is required.'),
  mobile: requiredPhone('Mobile is required.'),
  ownerEmail: requiredEmail('Owner email is required.'),
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
