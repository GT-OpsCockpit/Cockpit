import { z } from 'zod'
import { optionalEmail, optionalPhone } from '@/lib/contact-fields'
import { addRequiredFieldIssues } from '@/lib/required-fields-issues'

/**
 * Which fields a driver needs depends on the kind of driver, and that rule is
 * shared with the API (record-requirements.js). What stays here is whether
 * what was typed is a real phone or email, mirroring the API's
 * @IsPhone/@IsEmailFormat.
 */
export const driverFormSchema = z
  .object({
    countryCode: z.string().optional(),
    area: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: optionalPhone(),
    company: z.string().optional(),
    email: optionalEmail(),
    eventsOnly: z.boolean(),
    eventCountry: z.string().optional(),
    eventArea: z.string().optional(),
    eventRef: z.string().optional(),
  })
  .superRefine((data, ctx) => addRequiredFieldIssues('driver', data, ctx))

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
