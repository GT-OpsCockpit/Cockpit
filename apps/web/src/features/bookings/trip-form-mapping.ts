import { DateTime } from 'luxon'
import { TripEntityBilling, type TripEntity } from '@cockpit/shared/api'
import { pickupLocalInstant } from './trip-status'
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
    pickupIata: trip.pickupIata ?? '',
    dropoffIata: trip.dropoffIata ?? '',
    pickupTimezone: trip.timezone ?? '',
    notifyDriver: false,
  }
}
