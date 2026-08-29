import { DateTime } from 'luxon'
import { TripEntityBilling, type CreateTripDto, type TripEntity, type UpdateTripDto } from '@cockpit/shared/api'
import { pickupLocalInstant } from './trip-display'
import type { TripFormValues } from './trip-form-schema'

/** Combines the form's date/time/timezone fields into the ISO instant the API's `pickupAt` expects. */
export function toPickupAt(values: TripFormValues): string {
  const zone = values.pickupTimezone || 'utc'
  return DateTime.fromISO(`${values.pickupDate}T${values.pickupTime}`, { zone }).toUTC().toISO()!
}

/** Inverse of `toPickupAt` — prefills the edit dialog's form from an existing trip. */
export function tripToFormValues(trip: TripEntity): TripFormValues {
  const local = pickupLocalInstant(trip)

  return {
    countryCode: trip.countryCode ?? '',
    area: trip.area ?? '',
    pickupDate: local.toFormat('yyyy-MM-dd'),
    pickupTime: local.toFormat('HH:mm'),
    service: trip.service,
    hours: trip.hours ?? undefined,
    vehicleType: trip.vehicleType?.name ?? '',
    paxCount: trip.paxCount ?? 1,
    clientRef: trip.client.ref,
    billing: trip.billing ?? TripEntityBilling.ACCOUNT,
    passengerName: trip.passengerName,
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation ?? '',
    instructions: trip.instructions ?? '',
    pocName: trip.pocName ?? '',
    pocPhone: trip.pocPhone ?? '',
    driverRef: trip.driver?.ref ?? '',
    fleetRegNbr: trip.fleetVehicle?.regNbr ?? '',
    subContractor: trip.subContractor,
    partnerRef: trip.partner?.ref ?? '',
    priceEur: trip.priceEur != null ? Number(trip.priceEur) : undefined,
    partnerRateEur: trip.partnerRateEur != null ? Number(trip.partnerRateEur) : undefined,
    tracking: trip.tracking,
    flightNumber: trip.flightNumber ?? '',
    bufferTime: trip.bufferTime ?? undefined,
    fboAddress: trip.fboAddress ?? '',
    tailNbr: trip.tailNbr ?? '',
    nameboard: trip.nameboard ?? '',
    pickupIata: trip.pickupIata ?? '',
    dropoffIata: trip.dropoffIata ?? '',
    pickupTimezone: trip.timezone ?? '',
    notifyDriver: false,
  }
}

/**
 * Shared by create and update — the API accepts the same field set for both
 * (UpdateTripDto is CreateTripDto minus pocEmail/ref, neither of which the form
 * collects). Driver/vehicle/partner assignment is what actually differs between
 * the two callers, so it's layered on by `toCreateTripDto`/`toUpdateTripDto`
 * rather than duplicated here.
 */
function toTripDto(values: TripFormValues): CreateTripDto {
  return {
    countryCode: values.countryCode,
    area: values.area,
    pickupAt: toPickupAt(values),
    pickupLocation: values.pickupLocation,
    dropoffLocation: values.dropoffLocation || undefined,
    service: values.service,
    hours: values.service === 'ASD' ? values.hours : undefined,
    instructions: values.instructions || undefined,
    clientRef: values.clientRef,
    passengerName: values.passengerName,
    pocName: values.pocName || undefined,
    pocPhone: values.pocPhone || undefined,
    tracking: values.tracking,
    paxCount: values.paxCount,
    vehicleType: values.vehicleType,
    priceEur: values.priceEur,
    billing: values.billing,
    flightNumber: values.flightNumber || undefined,
    bufferTime: values.bufferTime,
    fboAddress: values.fboAddress || undefined,
    tailNbr: values.tailNbr || undefined,
    nameboard: values.nameboard || undefined,
    pickupIata: values.pickupIata || undefined,
    dropoffIata: values.dropoffIata || undefined,
  }
}

export function toCreateTripDto(values: TripFormValues, { dispatch }: { dispatch: boolean }): CreateTripDto {
  const dto = toTripDto(values)

  // Plain "Create" never wires up an internal driver/vehicle — that's reserved for
  // "Create & Dispatch". A Sub-C assignment is kept either way: the booking is
  // farmed out from the moment it's created, dispatch or not.
  if (dispatch) {
    dto.driverRef = values.driverRef || undefined
    dto.fleetRegNbr = values.fleetRegNbr || undefined
  }
  if (values.subContractor) {
    dto.subContractor = true
    dto.partnerRef = values.partnerRef || undefined
    dto.partnerRateEur = values.partnerRateEur
  }

  return dto
}

export function toUpdateTripDto(values: TripFormValues, { notifyDriver }: { notifyDriver: boolean }): UpdateTripDto {
  return {
    ...toTripDto(values),
    // Unlike the creation bar, the edit dialog is also where driver/vehicle/partner
    // reassignment happens (the legacy's per-cell quick-popups were deliberately not
    // ported — see the handoff doc) — so these are always sent, never gated.
    driverRef: values.driverRef || undefined,
    fleetRegNbr: values.fleetRegNbr || undefined,
    subContractor: values.subContractor,
    partnerRef: values.subContractor ? values.partnerRef || undefined : undefined,
    partnerRateEur: values.subContractor ? values.partnerRateEur : undefined,
    notifyDriver,
  }
}
