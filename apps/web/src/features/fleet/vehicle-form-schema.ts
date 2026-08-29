import { z } from 'zod'
import { addRequiredFieldIssues } from '@/lib/required-fields-issues'

/**
 * Category/make/model/colour are constrained to META-driven option lists in
 * the UI itself (vehicle-form-fields.tsx) and checked against the same tables
 * server-side, so what a free-typed field could still get wrong is presence —
 * and the isLocal/eventsOnly conditional requirements, which are the shared
 * rule the API reads too (record-requirements.js).
 */
export const vehicleFormSchema = z
  .object({
    category: z.string().min(1, 'Category is required.'),
    isLocal: z.boolean(),
    regNbr: z.string().min(1, 'Reg Nbr is required.'),
    acronym: z.string().min(1, 'Acr. is required.').max(6, 'Acr. must be 6 characters or fewer.'),
    make: z.string().min(1, 'Make is required.'),
    model: z.string().min(1, 'Model is required.'),
    yearOfBuild: z.number(),
    color: z.string().optional(),
    fourWD: z.boolean(),
    nbPax: z.number(),
    countryCode: z.string().optional(),
    area: z.string().optional(),
    partnerCompany: z.string().optional(),
    eventsOnly: z.boolean(),
    eventCountry: z.string().optional(),
    eventArea: z.string().optional(),
    eventRef: z.string().optional(),
  })
  .superRefine((data, ctx) => addRequiredFieldIssues('fleetVehicle', data, ctx))

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export function vehicleFormDefaults(): VehicleFormValues {
  return {
    category: '',
    isLocal: true,
    regNbr: '',
    acronym: '',
    make: '',
    model: '',
    yearOfBuild: new Date().getFullYear(),
    color: '',
    fourWD: false,
    nbPax: 3,
    countryCode: '',
    area: '',
    partnerCompany: '',
    eventsOnly: false,
    eventCountry: '',
    eventArea: '',
    eventRef: '',
  }
}
