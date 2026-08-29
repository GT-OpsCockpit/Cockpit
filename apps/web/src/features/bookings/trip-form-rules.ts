import { DateTime } from 'luxon'
import { asdTotal, isLocalTrip, marginPercent } from '@cockpit/shared'
import { TripEntityService } from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'
import { isBeforeArrival, PARIS_ZONE } from './trip-status'

/**
 * Everything the booking form derives from what the dispatcher has typed so
 * far — which fields apply, which are locked, and the live hints under the
 * price fields.
 *
 * Extracted from TripFormFields so these can be asserted as plain values
 * rather than by rendering a 1000-line form with four live pickers behind it.
 * The component keeps the queries and the markup; this decides.
 */

/** The subset of the form the rules below read — the fields TripFormFields watches. */
export interface TripFormRulesInput {
  service: TripEntityService
  countryCode: string
  area: string
  // Optional exactly where TripFormValues leaves them optional — the form
  // hands these over mid-typing, half-filled.
  pickupLocation?: string | null
  dropoffLocation?: string | null
  pickupIata?: string | null
  dropoffIata?: string | null
  pickupDate?: string | null
  pickupTime?: string | null
  pickupTimezone?: string | null
  priceEur?: number | null
  partnerRateEur?: number | null
  hours?: number | null
}

export interface TripFormRules {
  /** Reg Nbr only applies to a local booking served by our own fleet. */
  regNbrApplies: boolean
  /** The on-site contact fields are frozen once the driver is on site. */
  pocLocked: boolean
  /** The pickup time restated in Paris, for a Paris-based dispatcher. */
  parisHint: string
  /** An at-disposal booking has no drop-off — the car stays with the passenger. */
  dropoffApplies: boolean
  /** The flight block only shows once one of the two IATA codes is known. */
  showAirportInfo: boolean
  /** Grand total under an ASD hourly rate — undefined when not computable. */
  retailAsdTotal?: string
  partnerAsdTotal?: string
  /** Booking margin, shown beside the Partner rate as in the legacy. */
  marginHint?: string
}

const NO_PARIS_TIME = 'Eq. 🕐 Paris'

function formatTotal(total: number | null): string | undefined {
  return total === null ? undefined : `Total net: ${total.toFixed(2)} €`
}

/**
 * Lets a Paris-based dispatcher read the pickup time without doing the
 * timezone math themselves — always shown in Paris regardless of the trip's
 * own timezone, the conversion can shift the day either way.
 */
function parisHintFor(values: TripFormRulesInput): string {
  const { pickupTimezone, pickupDate, pickupTime } = values
  if (!pickupTimezone || !pickupDate || !pickupTime) return NO_PARIS_TIME
  const local = DateTime.fromISO(`${pickupDate}T${pickupTime}`, { zone: pickupTimezone })
  if (!local.isValid) return NO_PARIS_TIME
  const paris = local.setZone(PARIS_ZONE)
  return `${NO_PARIS_TIME} : ${paris.toFormat('HH:mm')} (${paris.toFormat('dd/MM')})`
}

export function tripFormRules(values: TripFormRulesInput, trip?: TripEntity | null): TripFormRules {
  const { service, countryCode, priceEur, partnerRateEur, hours } = values

  // The margin and the ASD totals are restored from the legacy
  // (updateMarginHint / updateAsdTotalHints); the formulas live in
  // @cockpit/shared rather than behind an endpoint because both are live hints
  // recomputed as the dispatcher types — a round trip per keystroke would be
  // the wrong trade.
  const margin = marginPercent({ priceEur, partnerRateEur, countryCode })

  return {
    regNbrApplies: isLocalTrip({
      area: values.area,
      countryCode,
      pickupLocation: values.pickupLocation,
      dropoffLocation: values.dropoffLocation,
    }),
    // The server refuses a POC change past "In position" (isBeforeArrival,
    // common.js:2391) — this just says so before the user types.
    pocLocked: !!trip && !isBeforeArrival(trip),
    parisHint: parisHintFor(values),
    // The schema mirrors this (trip-form-schema.ts's superRefine).
    dropoffApplies: service !== TripEntityService.ASD,
    showAirportInfo: !!values.pickupIata || !!values.dropoffIata,
    retailAsdTotal: formatTotal(asdTotal({ rate: priceEur, hours, service })),
    partnerAsdTotal: formatTotal(asdTotal({ rate: partnerRateEur, hours, service })),
    marginHint: margin === null ? undefined : `% Margin: ${margin.toFixed(1)} %`,
  }
}
