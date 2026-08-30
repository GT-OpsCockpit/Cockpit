import { DateTime } from 'luxon'
import { asdTotal, isLocalTrip, marginPercent } from '@cockpit/shared'
import { TripEntityService } from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'
import { isBeforeArrival } from '@cockpit/shared'
import { PARIS_ZONE } from './trip-display'

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
  pickupIsAirport?: boolean
  dropoffIsAirport?: boolean
  flightNumber?: string | null
  tailNbr?: string | null
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
  /** The flight block shows as soon as either end is known to be an airport. */
  showAirportInfo: boolean
  /**
   * A flight number was entered, so this is a commercial arrival — FBO and
   * Tail nbr belong to private aviation and are locked out.
   */
  commercialFlight: boolean
  /** A tail number is being typed and isn't a whole one yet (they are five characters). */
  tailNbrIncomplete: boolean
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

/**
 * Whether a saved booking already holds something only the flight block can
 * show — the evidence that survives a reload, unlike the geocode's own flags.
 */
function carriesFlightInfo(trip?: TripEntity | null): boolean {
  if (!trip) return false
  return (
    !!trip.flightNumber?.trim() ||
    trip.bufferTime != null ||
    !!trip.fboAddress?.trim() ||
    !!trip.tailNbr?.trim() ||
    !!trip.nameboard?.trim()
  )
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
    // Not gated on the IATA code alone: geocoding recognises an airport more
    // often than it can name one, and an airport pickup whose code came back
    // empty then had nowhere to enter its flight number. The legacy opened the
    // popup on "is an airport" (common.js:1406).
    // …and not on the live flags alone either: `pickupIsAirport` comes off the
    // geocode call and is gone the moment the dialog is reopened on a saved
    // booking, which then fell back on the IATA code — so an airport booking
    // the geocoder could not name a code for hid its own flight number, FBO
    // address and nameboard as soon as it was saved. What it carries says it.
    showAirportInfo:
      !!values.pickupIata ||
      !!values.dropoffIata ||
      !!values.pickupIsAirport ||
      !!values.dropoffIsAirport ||
      carriesFlightInfo(trip),
    // A flight number is only ever a commercial one — private aviation has
    // none to look up — and the handling agent and tail number only describe
    // the private case. The legacy locked them out rather than leaving them
    // editable but meaningless (applyCommercialFlightLock, common.js:1658).
    commercialFlight: !!values.flightNumber?.trim(),
    // Flagged, not refused: the legacy highlighted a part-typed tail number
    // (refreshTailHighlight, common.js:1649) without blocking anything.
    tailNbrIncomplete: (values.tailNbr?.trim().length ?? 0) > 0 && values.tailNbr!.trim().length < 5,
    retailAsdTotal: formatTotal(asdTotal({ rate: priceEur, hours, service })),
    partnerAsdTotal: formatTotal(asdTotal({ rate: partnerRateEur, hours, service })),
    marginHint: margin === null ? undefined : `% Margin: ${margin.toFixed(1)} %`,
  }
}

/**
 * Why the "Check" button can't verify the flight yet, or null when it can.
 *
 * The verification compares the airline's schedule against the pickup time, so
 * it needs the date and time as much as the flight number. Returning a reason
 * rather than nothing is the point: a button that silently does nothing reads
 * as broken. The legacy said which field was missing (common.js:1693).
 */
export function flightCheckBlocker(values: {
  flightNumber?: string | null
  pickupDate?: string | null
  pickupTime?: string | null
}): string | null {
  if (!values.flightNumber?.trim()) return 'Enter a flight number to check it.'
  if (!values.pickupDate || !values.pickupTime) {
    return 'Enter the pickup date and time to verify the flight.'
  }
  return null
}
