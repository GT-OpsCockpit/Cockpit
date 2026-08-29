import { z } from 'zod'
import { ClientEntityBilling, ClientEntityClientType } from '@cockpit/shared/api'
import { optionalEmail, optionalPhone } from '@/lib/contact-fields'
import { addRequiredFieldIssues } from '@/lib/required-fields-issues'

/**
 * The field *declarations* below decide whether what was typed is a real email
 * or phone; which fields apply at all is the shared rule the API reads too
 * (record-requirements.js), so there is nothing left here to keep in step by
 * hand.
 */
export const clientFormSchema = z
  .object({
    clientType: z.enum([ClientEntityClientType.INDIVIDUAL, ClientEntityClientType.COMPANY, ClientEntityClientType.EVENT]),
    contactFirstName: z.string().optional(),
    contactLastName: z.string().optional(),
    company: z.string().optional(),
    acronym: z.string().optional(),
    refPoOther: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    countryCode: z.string().optional(),
    vatNumber: z.string().optional(),
    email: optionalEmail(),
    billing: z.enum([ClientEntityBilling.ACCOUNT, ClientEntityBilling.CASH, ClientEntityBilling.CARD]),
    pocName: z.string().optional(),
    pocPhone: optionalPhone(),
    pocEmail: optionalEmail(),
    eventCountry: z.string().optional(),
    eventArea: z.string().optional(),
    eventStartDate: z.string().optional(),
    eventEndDate: z.string().optional(),
  })
  .superRefine((data, ctx) => addRequiredFieldIssues('client', data, ctx))

export type ClientFormValues = z.infer<typeof clientFormSchema>

export function clientFormDefaults(): ClientFormValues {
  return {
    clientType: ClientEntityClientType.INDIVIDUAL,
    contactFirstName: '',
    contactLastName: '',
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
  }
}
