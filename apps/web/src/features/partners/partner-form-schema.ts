import { z } from 'zod'
import { optionalPhone, requiredEmail } from '@/lib/contact-fields'

// The email is required, unlike Driver's — a partner Cockpit can't email
// defeats the point of this feature (automatic notification on
// assign/unassign/cancel). The phone (landline) and mobile are both optional,
// except that an Individual needs one of them for their own driver record. See
// docs/feature-requests/partner-companies.md.
const partnerFormBaseSchema = z.object({
  individual: z.boolean(),
  companyName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: optionalPhone(),
  mobile: optionalPhone(),
  email: requiredEmail('Email is required.'),
  countryCode: z.string().optional(),
  area: z.string().optional(),
  // Only asked for — and only required — once Individual is checked: this
  // partner's own vehicle, created together with them (see
  // partner-form-mapping.ts / PartnersService.createIndividualRoster). Never
  // required when editing — PartnersService.update() never touches the
  // roster, and PartnerFormFields hides this block entirely there.
  vehicleCategory: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleRegNbr: z.string().optional(),
  vehicleFourWD: z.boolean().optional(),
})

function requireIdentity(data: z.infer<typeof partnerFormBaseSchema>, ctx: z.RefinementCtx) {
  if (!data.individual && !data.companyName?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['companyName'],
      message: 'Company name is required unless this partner is an individual.',
    })
  }
  // An Individual partner's own driver record needs a number to be reached on.
  if (data.individual && !data.phone?.trim() && !data.mobile?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: 'Enter a phone or a mobile number for an individual partner.',
    })
  }
  if (!data.firstName?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'First name is required.' })
  }
  if (!data.lastName?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Last name is required.' })
  }
}

export const partnerFormSchema = partnerFormBaseSchema.superRefine((data, ctx) => {
  requireIdentity(data, ctx)
  if (data.individual) {
    if (!data.vehicleCategory) {
      ctx.addIssue({ code: 'custom', path: ['vehicleCategory'], message: 'Category is required.' })
    }
    if (!data.vehicleMake) {
      ctx.addIssue({ code: 'custom', path: ['vehicleMake'], message: 'Make is required.' })
    }
    if (!data.vehicleModel) {
      ctx.addIssue({ code: 'custom', path: ['vehicleModel'], message: 'Model is required.' })
    }
    if (!data.vehicleRegNbr?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['vehicleRegNbr'], message: 'Reg Nbr is required.' })
    }
  }
})

// Editing never shows or sends the vehicle block (see above) — same identity
// checks, no vehicle requirement.
export const partnerEditFormSchema = partnerFormBaseSchema.superRefine(requireIdentity)

export type PartnerFormValues = z.infer<typeof partnerFormBaseSchema>

export function partnerFormDefaults(): PartnerFormValues {
  return {
    individual: false,
    companyName: '',
    firstName: '',
    lastName: '',
    phone: '',
    mobile: '',
    email: '',
    countryCode: '',
    area: '',
    vehicleCategory: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleRegNbr: '',
    vehicleFourWD: false,
  }
}
