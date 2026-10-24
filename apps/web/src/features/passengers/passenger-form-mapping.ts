import type { CreatePassengerDto, PassengerEntity, UpdatePassengerDto } from '@cockpit/shared/api'
import type { PassengerFormValues } from './passenger-form-schema'

/** Inverse of toCreatePassengerDto/toUpdatePassengerDto — prefills the edit dialog's form from an existing passenger. */
export function passengerToFormValues(passenger: PassengerEntity): PassengerFormValues {
  return {
    firstName: passenger.firstName ?? '',
    lastName: passenger.lastName ?? '',
    phone: passenger.phone ?? '',
    email: passenger.email ?? '',
    notes: passenger.notes ?? '',
    clientRef: passenger.client?.ref ?? '',
  }
}

export function toCreatePassengerDto(values: PassengerFormValues): CreatePassengerDto {
  return {
    firstName: values.firstName || undefined,
    lastName: values.lastName || undefined,
    phone: values.phone || undefined,
    email: values.email || undefined,
    notes: values.notes || undefined,
    clientRef: values.clientRef || undefined,
  }
}

export function toUpdatePassengerDto(values: PassengerFormValues): UpdatePassengerDto {
  return {
    firstName: values.firstName || undefined,
    lastName: values.lastName || undefined,
    phone: values.phone || undefined,
    email: values.email || undefined,
    notes: values.notes || undefined,
    // Empty string clears the link (independent passenger) — the service
    // treats '' the same as null, see PassengersService.update.
    clientRef: values.clientRef ?? '',
  }
}
