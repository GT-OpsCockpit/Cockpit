import type { CreatePartnerDto, PartnerEntity, UpdatePartnerDto } from '@cockpit/shared/api'
import type { PartnerFormValues } from './partner-form-schema'

export function toCreatePartnerDto(values: PartnerFormValues): CreatePartnerDto {
  const contactName = `${values.firstName ?? ''} ${values.lastName ?? ''}`.trim()
  return {
    individual: values.individual,
    companyName: values.individual ? undefined : values.companyName,
    contactName,
    firstName: values.firstName || undefined,
    lastName: values.lastName || undefined,
    phone: values.phone || undefined,
    mobile: values.mobile || undefined,
    email: values.email,
    countryCode: values.countryCode || undefined,
    area: values.area || undefined,
    // The Individual's own vehicle — see partner-form-schema.ts's own
    // comment and PartnersService.createIndividualRoster.
    ...(values.individual && {
      vehicleCategory: values.vehicleCategory || undefined,
      vehicleMake: values.vehicleMake || undefined,
      vehicleModel: values.vehicleModel || undefined,
      vehicleColor: values.vehicleColor || undefined,
      vehicleRegNbr: values.vehicleRegNbr || undefined,
      vehicleFourWD: values.vehicleFourWD,
    }),
  }
}


/**
 * Seeds the edit form from a Partner record. `contactName` is the only name
 * Partner actually persists (see UpdatePartnerDto's comment — firstName/
 * lastName only ever seed the auto-created driver at *creation* time, for an
 * Individual), so it's split back on the first space to refill the same two
 * fields the create form uses. Good enough for "Ahmed Ben Salah" — if it's
 * ever wrong for a name with no space, the two fields just don't split evenly.
 */
export function partnerToFormValues(partner: PartnerEntity): PartnerFormValues {
  const [firstName = '', ...rest] = partner.contactName.split(' ')
  return {
    individual: partner.individual,
    companyName: partner.companyName ?? '',
    firstName,
    lastName: rest.join(' '),
    phone: partner.phone ?? '',
    mobile: partner.mobile ?? '',
    email: partner.email,
    countryCode: partner.countryCode ?? '',
    area: partner.area ?? '',
    // Not editable here — see PartnerFormFields' `editing` prop and
    // PartnersService.update(), which never touches the roster.
    vehicleCategory: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleRegNbr: '',
    vehicleFourWD: false,
  }
}

export function toUpdatePartnerDto(values: PartnerFormValues): UpdatePartnerDto {
  const contactName = `${values.firstName ?? ''} ${values.lastName ?? ''}`.trim()
  return {
    individual: values.individual,
    companyName: values.individual ? undefined : values.companyName,
    contactName,
    // Blank, not undefined: sent as '' so editing can clear the number.
    phone: values.phone ?? '',
    mobile: values.mobile || undefined,
    email: values.email,
    countryCode: values.countryCode || undefined,
    area: values.area || undefined,
  }
}
