import { DateTime } from 'luxon'
import { TripEntityService, type CreateTripDto } from '@cockpit/shared/api'
import { toPickupAt } from '../bookings/trip-form-mapping'
import type { TripFormValues } from '../bookings/trip-form-schema'

/** Every date from `startIso` to `endIso` inclusive (both `yyyy-MM-dd`). */
export function eachDateInRange(startIso: string, endIso: string): string[] {
  const dates: string[] = []
  let d = DateTime.fromISO(startIso)
  const end = DateTime.fromISO(endIso)
  while (d <= end) {
    dates.push(d.toISODate()!)
    d = d.plus({ days: 1 })
  }
  return dates
}

export interface BulkLeg {
  pickupLocation: string
  dropoffLocation: string
}

/**
 * Chaining rule (ported from events.html's bulkLegForIndex): day 1 uses the
 * New booking bar's typed PU/DO as-is. Every following day's PU = DO = day
 * 1's drop-off — the client is assumed to stay put at that same location.
 * The very last day is left with no drop-off (final destination not yet fixed).
 */
export function bulkLegForIndex(
  i: number,
  lastIndex: number,
  templatePu: string,
  templateDo: string,
): BulkLeg {
  if (i === 0) return { pickupLocation: templatePu, dropoffLocation: templateDo }
  if (i === lastIndex) return { pickupLocation: templateDo, dropoffLocation: '' }
  return { pickupLocation: templateDo, dropoffLocation: templateDo }
}

const MIN_ASD_HOURS = 2
const MAX_ASD_HOURS = 48
const DEFAULT_ASD_HOURS = 4

/**
 * Builds one leg's create-trip payload — same field set as the plain
 * "Create" button (no driver/vehicle/partner wiring, assigned afterwards
 * from the Ride list), with the date and PU/DO overridden per `leg`.
 *
 * The last leg's empty drop-off is only valid for an ASD (at disposal)
 * service — force it there rather than let the server reject it, keeping
 * whatever hours are already typed if it's a valid ASD value, else 4h.
 */
export function buildBulkTripDto(
  values: TripFormValues,
  dateStr: string,
  leg: BulkLeg,
  options: { isLastLeg: boolean; reference?: string; instructions?: string },
): CreateTripDto {
  const legValues: TripFormValues = {
    ...values,
    pickupDate: dateStr,
    pickupLocation: leg.pickupLocation,
    dropoffLocation: leg.dropoffLocation,
  }

  let service = legValues.service
  let hours = legValues.hours
  if (options.isLastLeg && !leg.dropoffLocation) {
    service = TripEntityService.ASD
    if (hours === undefined || hours < MIN_ASD_HOURS || hours > MAX_ASD_HOURS) {
      hours = DEFAULT_ASD_HOURS
    }
  }

  const instructionParts: string[] = []
  if (options.reference) instructionParts.push(`Ref: ${options.reference}`)
  if (options.instructions) instructionParts.push(options.instructions)
  else if (legValues.instructions) instructionParts.push(legValues.instructions)

  return {
    countryCode: legValues.countryCode,
    area: legValues.area,
    pickupAt: toPickupAt(legValues),
    // Alongside the instant it was used to build — see toTripDto.
    pickupTimezone: legValues.pickupTimezone || undefined,
    pickupLocation: legValues.pickupLocation,
    dropoffLocation: legValues.dropoffLocation || undefined,
    service,
    hours: service === TripEntityService.ASD ? hours : undefined,
    instructions: instructionParts.length ? instructionParts.join(' — ') : undefined,
    clientRef: legValues.clientRef,
    passengerName: legValues.passengerName,
    pocName: legValues.pocName || undefined,
    pocPhone: legValues.pocPhone || undefined,
    // Forced on, whatever the bar was set to (events.html:655). An event runs
    // on a chain of bookings a whole team follows day by day — the one case
    // where the legacy would not let tracking be left off by accident.
    tracking: true,
    paxCount: legValues.paxCount,
    vehicleType: legValues.vehicleType,
    priceEur: legValues.priceEur,
    billing: legValues.billing,
    flightNumber: legValues.flightNumber || undefined,
    bufferTime: legValues.bufferTime,
    fboAddress: legValues.fboAddress || undefined,
    tailNbr: legValues.tailNbr || undefined,
    nameboard: legValues.nameboard || undefined,
    pickupIata: legValues.pickupIata || undefined,
    dropoffIata: legValues.dropoffIata || undefined,
  }
}
