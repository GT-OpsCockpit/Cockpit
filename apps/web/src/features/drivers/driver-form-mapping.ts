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

/**
 * Shared by create and update — DriversController.update accepts the same
 * CreateDriverDto shape as create.
 *
 * firstName/lastName/phone/company/area/email are sent as-is, blank or not:
 * update() only writes a field when it's present at all
 * (`dto.field !== undefined`), so this form — which always submits the whole
 * record — has to send a deliberately emptied field as `''`, not omit it as
 * `undefined`, or clearing it in the UI would silently leave the old value in
 * the database (e.g. a Phone or Company the user just blanked out and saved
 * would come right back on the next load). countryCode is the one exception
 * still mapped to `undefined`: it's always required, so the form's own
 * required-fields check never lets an empty one reach here.
 */
function toDriverDto(values: DriverFormValues): CreateDriverDto {
  return {
    countryCode: values.countryCode || undefined,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    company: values.company,
    area: values.area,
    email: values.email,
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
