import { z } from 'zod'

/**
 * Mirrors DriversService's assertValidDriverFields() exactly
 * (apps/api/src/drivers/drivers.service.ts) plus the Country/Area/Event
 * requirements EventLinkService.resolveEventClientId() enforces for an
 * eventsOnly driver. Unlike clientFormSchema, this deliberately does NOT
 * validate email format — the backend never has for drivers, only for
 * clients, and this schema mirrors the backend as it actually is rather than
 * inventing a stricter rule.
 */
export const driverFormSchema = z
  .object({
    countryCode: z.string().optional(),
    area: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    email: z.string().optional(),
    eventsOnly: z.boolean(),
    eventCountry: z.string().optional(),
    eventArea: z.string().optional(),
    eventRef: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.eventsOnly) {
      if (!data.company?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['company'], message: 'Company is required for an Events driver.' })
      }
      if (!data.firstName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'First name is required for an Events driver.' })
      }
      if (!data.lastName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Last name is required for an Events driver.' })
      }
      if (!data.email?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email is required for an Events driver.' })
      }
      if (!data.phone?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Phone is required for an Events driver.' })
      }
      if (!data.eventCountry?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventCountry'], message: 'Country is required to link an Event.' })
      }
      if (!data.eventArea?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventArea'], message: 'Area is required to link an Event.' })
      }
      if (!data.eventRef?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventRef'], message: 'An Event must be selected.' })
      }
      return
    }

    const isPartner = !!data.company?.trim()
    const hasName = !!data.firstName?.trim() || !!data.lastName?.trim()

    if (!isPartner) {
      if (!data.firstName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'First name is required.' })
      }
      if (!data.lastName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Last name is required.' })
      }
      if (!data.phone?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Phone is required.' })
      }
      return
    }

    if (hasName) {
      if (!data.email?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email is required for a partner chauffeur.' })
      }
      if (!data.phone?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Phone is required for a partner chauffeur.' })
      }
      return
    }

    if (!data.email?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email is required for a partner company.' })
    }
  })

export type DriverFormValues = z.infer<typeof driverFormSchema>

export function driverFormDefaults(): DriverFormValues {
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
  }
}
