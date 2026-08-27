import type { CreateDriverDto, DriverEntity } from '@cockpit/shared/api'
import type { DriverFormValues } from './driver-form-schema'

/** Inverse of toCreateDriverDto/toUpdateDriverDto — prefills the edit dialog's form from an existing driver. */
export function driverToFormValues(driver: DriverEntity): DriverFormValues {
  return {
    countryCode: driver.countryCode ?? '',
    area: driver.area ?? '',
    firstName: driver.firstName ?? '',
    lastName: driver.lastName ?? '',
    phone: driver.phone ?? '',
    company: driver.company ?? '',
    email: driver.email ?? '',
    eventsOnly: driver.eventsOnly,
    eventCountry: driver.eventCountry ?? '',
    eventArea: driver.eventArea ?? '',
    eventRef: driver.eventClient?.ref ?? '',
  }
}

/** Shared by create and update — DriversController.update accepts the same CreateDriverDto shape as create. */
function toDriverDto(values: DriverFormValues): CreateDriverDto {
  return {
    countryCode: values.countryCode || undefined,
    firstName: values.firstName || undefined,
    lastName: values.lastName || undefined,
    phone: values.phone || undefined,
    company: values.company || undefined,
    area: values.area || undefined,
    email: values.email || undefined,
    eventsOnly: values.eventsOnly,
    eventCountry: values.eventsOnly ? values.eventCountry || undefined : undefined,
    eventArea: values.eventsOnly ? values.eventArea || undefined : undefined,
    eventRef: values.eventsOnly ? values.eventRef || undefined : undefined,
  }
}

export function toCreateDriverDto(values: DriverFormValues): CreateDriverDto {
  return toDriverDto(values)
}

export function toUpdateDriverDto(values: DriverFormValues): CreateDriverDto {
  return toDriverDto(values)
}
