import type { CreateFleetVehicleDto, FleetVehicleEntity } from '@cockpit/shared/api'
import type { VehicleFormValues } from './vehicle-form-schema'

/** Inverse of toCreateFleetVehicleDto/toUpdateFleetVehicleDto — prefills the edit dialog's form from an existing vehicle. */
export function vehicleToFormValues(vehicle: FleetVehicleEntity): VehicleFormValues {
  return {
    category: vehicle.category.name,
    isLocal: vehicle.isLocal,
    regNbr: vehicle.regNbr,
    acronym: vehicle.acronym ?? '',
    make: vehicle.make,
    model: vehicle.model,
    yearOfBuild: vehicle.yearOfBuild,
    color: vehicle.color,
    fourWD: vehicle.fourWD,
    nbPax: vehicle.nbPax,
    countryCode: vehicle.countryCode ?? '',
    area: vehicle.area ?? '',
    partnerCompany: vehicle.partnerCompany ?? '',
    eventsOnly: vehicle.eventsOnly,
    eventCountry: vehicle.eventCountry ?? '',
    eventArea: vehicle.eventArea ?? '',
    eventRef: vehicle.eventClient?.ref ?? '',
  }
}

/** Shared by create and update — FleetVehiclesController.update accepts the same CreateFleetVehicleDto shape as create. */
function toFleetVehicleDto(values: VehicleFormValues): CreateFleetVehicleDto {
  return {
    category: values.category,
    isLocal: values.isLocal,
    regNbr: values.regNbr,
    acronym: values.acronym || undefined,
    make: values.make,
    model: values.model,
    yearOfBuild: values.yearOfBuild,
    color: values.color || undefined,
    fourWD: values.fourWD,
    nbPax: values.nbPax,
    countryCode: !values.isLocal ? values.countryCode || undefined : undefined,
    area: !values.isLocal ? values.area || undefined : undefined,
    partnerCompany: !values.isLocal ? values.partnerCompany || undefined : undefined,
    eventsOnly: values.eventsOnly,
    eventCountry: values.eventsOnly ? values.eventCountry || undefined : undefined,
    eventArea: values.eventsOnly ? values.eventArea || undefined : undefined,
    eventRef: values.eventsOnly ? values.eventRef || undefined : undefined,
  }
}

export function toCreateFleetVehicleDto(values: VehicleFormValues): CreateFleetVehicleDto {
  return toFleetVehicleDto(values)
}

export function toUpdateFleetVehicleDto(values: VehicleFormValues): CreateFleetVehicleDto {
  return toFleetVehicleDto(values)
}
