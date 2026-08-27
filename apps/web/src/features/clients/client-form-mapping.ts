import { ClientEntityBilling, type ClientEntity, type CreateClientDto, type UpdateClientDto } from '@cockpit/shared/api'
import type { ClientFormValues } from './client-form-schema'

/** Inverse of toCreateClientDto/toUpdateClientDto — prefills the edit dialog's form from an existing client. */
export function clientToFormValues(client: ClientEntity): ClientFormValues {
  return {
    clientType: client.clientType,
    contactFirstName: client.contactFirstName ?? '',
    contactLastName: client.contactLastName ?? '',
    company: client.company ?? '',
    acronym: client.acronym ?? '',
    refPoOther: client.refPoOther ?? '',
    address: client.address ?? '',
    postalCode: client.postalCode ?? '',
    city: client.city ?? '',
    countryCode: client.countryCode ?? '',
    vatNumber: client.vatNumber ?? '',
    email: client.email ?? '',
    billing: client.billing ?? ClientEntityBilling.ACCOUNT,
    pocName: client.pocName ?? '',
    pocPhone: client.pocPhone ?? '',
    pocEmail: client.pocEmail ?? '',
    eventCountry: client.eventCountry ?? '',
    eventArea: client.eventArea ?? '',
    // eventStartDate/eventEndDate are Prisma DateTime columns, serialized as
    // full ISO instants — <input type="date"> needs just the date portion,
    // else the browser silently rejects the value and shows the field empty.
    eventStartDate: client.eventStartDate?.slice(0, 10) ?? '',
    eventEndDate: client.eventEndDate?.slice(0, 10) ?? '',
  }
}

/** Shared by create and update — the API accepts the exact same field set for both (see CreateClientDto/UpdateClientDto). */
function toClientDto(values: ClientFormValues): CreateClientDto {
  const isEvent = values.clientType === 'EVENT'
  return {
    clientType: values.clientType,
    contactFirstName: values.contactFirstName || undefined,
    contactLastName: values.contactLastName || undefined,
    company: values.company || undefined,
    acronym: values.acronym || undefined,
    refPoOther: values.refPoOther || undefined,
    address: values.address || undefined,
    postalCode: values.postalCode || undefined,
    city: values.city || undefined,
    countryCode: values.countryCode || undefined,
    vatNumber: values.vatNumber || undefined,
    email: values.email || undefined,
    billing: values.billing,
    pocName: values.pocName || undefined,
    pocPhone: values.pocPhone || undefined,
    pocEmail: values.pocEmail || undefined,
    eventCountry: isEvent ? values.eventCountry || undefined : undefined,
    eventArea: isEvent ? values.eventArea || undefined : undefined,
    eventStartDate: isEvent ? values.eventStartDate || undefined : undefined,
    eventEndDate: isEvent ? values.eventEndDate || undefined : undefined,
  }
}

export function toCreateClientDto(values: ClientFormValues): CreateClientDto {
  return toClientDto(values)
}

export function toUpdateClientDto(values: ClientFormValues): UpdateClientDto {
  return toClientDto(values)
}
