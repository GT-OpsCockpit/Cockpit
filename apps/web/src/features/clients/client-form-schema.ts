import { z } from 'zod'
import { isValidEmail } from '@cockpit/shared'
import { ClientEntityBilling, ClientEntityClientType } from '@cockpit/shared/api'

/** Mirrors ClientsService.create()/update()'s conditional validation exactly (apps/api/src/clients/clients.service.ts). */
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
    email: z.string().optional(),
    billing: z.enum([ClientEntityBilling.ACCOUNT, ClientEntityBilling.CASH, ClientEntityBilling.CARD]),
    pocName: z.string().optional(),
    pocPhone: z.string().optional(),
    pocEmail: z.string().optional(),
    eventCountry: z.string().optional(),
    eventArea: z.string().optional(),
    eventStartDate: z.string().optional(),
    eventEndDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isCompany = data.clientType === ClientEntityClientType.COMPANY
    const isEvent = data.clientType === ClientEntityClientType.EVENT

    if (isCompany && !data.company?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['company'], message: 'Company name is required for a Company-type account.' })
    }
    if (isEvent && !data.company?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['company'], message: 'Event name is required for an Events-type account.' })
    }
    if (isEvent) {
      if (!data.eventCountry?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventCountry'], message: 'Country is required for an Events-type account.' })
      }
      if (!data.eventArea?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventArea'], message: 'Area is required for an Events-type account.' })
      }
      if (!data.eventStartDate?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventStartDate'], message: 'Start date is required for an Events-type account.' })
      }
      if (!data.eventEndDate?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventEndDate'], message: 'End date is required for an Events-type account.' })
      }
    }
    if (!isCompany && !isEvent && !(data.contactFirstName?.trim() && data.contactLastName?.trim())) {
      const message = 'First and last name are required for an Individual-type account.'
      ctx.addIssue({ code: 'custom', path: ['contactFirstName'], message })
      ctx.addIssue({ code: 'custom', path: ['contactLastName'], message })
    }

    // Mirrors ClientsService.create()/update()'s format check exactly — same
    // isValidEmail() from @cockpit/shared, not a second regex re-derived here.
    if (data.email?.trim() && !isValidEmail(data.email.trim())) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Please enter a valid email address.' })
    }
    if (data.pocEmail?.trim() && !isValidEmail(data.pocEmail.trim())) {
      ctx.addIssue({ code: 'custom', path: ['pocEmail'], message: 'Please enter a valid POC email address.' })
    }
  })

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
