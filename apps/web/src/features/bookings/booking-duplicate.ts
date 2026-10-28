import type { TripFormValues } from './trip-form-schema'

/** A copy repeats the booking in the same direction; a return runs it the other way round. */
export type CopyKind = 'duplicate' | 'return'

export interface CopyOptions {
  kind: CopyKind
  pickupDate: string
  pickupTime: string
  vehicleType: string
  /** How many bookings to create. */
  count: number
}

export const MAX_COPIES = 10

/**
 * The form values of one copy of a booking. Who and what is carried over is the
 * client, the passenger, the price and the party; who drives is not — a copy
 * starts unassigned, since the driver or partner of the first leg has not been
 * asked about this one.
 *
 * A return swaps pickup and drop-off, each with what belongs to its end (airport
 * code, postal code, country). The flight, train and meet-and-greet details
 * described the first leg's pickup and are dropped; its timezone and, when the
 * two ends are in different countries, its country are those of the old drop-off
 * — the caller looks the new pickup up again to fill them in
 * (booking-duplicate-dialog.tsx).
 */
export function copyValues(values: TripFormValues, { kind, pickupDate, pickupTime, vehicleType }: CopyOptions): TripFormValues {
  const copy: TripFormValues = {
    ...values,
    pickupDate,
    pickupTime,
    vehicleType,
    driverRef: '',
    fleetRegNbr: '',
    subContractor: false,
    partnerRef: '',
    directPartnerRef: '',
    subContractorNoDriver: false,
    partnerRateEur: undefined,
    notifyDriver: false,
  }
  if (kind === 'duplicate') return copy

  const countryChanged = !!values.dropoffCountryCode && values.dropoffCountryCode !== values.countryCode
  return {
    ...copy,
    countryCode: values.dropoffCountryCode || values.countryCode,
    dropoffCountryCode: values.countryCode,
    area: countryChanged ? '' : values.area,
    pickupLocation: values.dropoffLocation ?? '',
    dropoffLocation: values.pickupLocation,
    pickupIata: values.dropoffIata,
    dropoffIata: values.pickupIata,
    pickupIsAirport: values.dropoffIsAirport,
    dropoffIsAirport: values.pickupIsAirport,
    pickupPostalCode: values.dropoffPostalCode,
    dropoffPostalCode: values.pickupPostalCode,
    pickupIsTrainStation: false,
    pickupTimezone: '',
    flightNumber: '',
    bufferTime: undefined,
    fboAddress: '',
    tailNbr: '',
    trainNumber: '',
    trainObservation: '',
    nameboard: '',
  }
}

/** Whether a booking can run backwards: an ASD has no drop-off to become a pickup. */
export function canReturn(values: Pick<TripFormValues, 'service' | 'dropoffLocation'>): boolean {
  return values.service !== 'ASD' && !!values.dropoffLocation?.trim()
}
