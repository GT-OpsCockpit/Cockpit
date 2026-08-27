import { z } from 'zod'

/**
 * Mirrors FleetVehiclesService's assertValid() (apps/api/src/fleet/fleet-vehicles.service.ts)
 * for the fields that depend on user input/choices — category/make/model/color are
 * constrained to META-driven option lists in the UI itself (vehicle-form-fields.tsx),
 * so this only re-validates what a free-typed field could still get wrong: presence,
 * and the isLocal/eventsOnly conditional requirements, same shape as driverFormSchema.
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
  .superRefine((data, ctx) => {
    if (!data.isLocal) {
      if (!data.countryCode?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['countryCode'], message: 'Country is required for an external (non-local) vehicle.' })
      }
      if (!data.area?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['area'], message: 'Area is required for an external (non-local) vehicle.' })
      }
      if (!data.partnerCompany?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['partnerCompany'], message: 'Partner is required for an external (non-local) vehicle.' })
      }
    }

    if (data.eventsOnly) {
      if (!data.eventCountry?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventCountry'], message: 'Country is required to link an Event.' })
      }
      if (!data.eventArea?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventArea'], message: 'Area is required to link an Event.' })
      }
      if (!data.eventRef?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['eventRef'], message: 'An Event must be selected.' })
      }
    }
  })

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
