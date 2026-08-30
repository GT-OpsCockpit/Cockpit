import { DateTime } from 'luxon'
import { clientDisplayName, driverLabel, formatPhoneDisplay } from '@cockpit/shared'
import { TripEntityCancellationFee, TripEntityService } from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'

/**
 * How a booking reads in a row — the account and driver labels, the pickup
 * restated in two timezones, the urgency highlight and the itinerary.
 *
 * Read well beyond Bookings: Planning, Invoicing, Events and the public
 * tracking pages all render trips through these.
 */

// Same reference timezone the legacy header uses for every list/urgency
// computation ("times shown in Europe/Paris"), independent of the trip's own
// local timezone (shown separately, see pickupLocalInstant).
export const PARIS_ZONE = 'Europe/Paris'

/**
 * A cancellation fee as a dispatcher reads it, not as Prisma stores it.
 *
 * The enum member is what the table used to print, so a booking cancelled at
 * half price showed "Fee: FIFTY" — the legacy printed the percentage
 * (common.js:3114). Shared with the cancel dialog's own select so the two can
 * never drift apart again.
 */
export const CANCELLATION_FEE_LABELS: Record<NonNullable<TripEntityCancellationFee>, string> = {
  [TripEntityCancellationFee.FREE]: 'Free',
  [TripEntityCancellationFee.FIFTY]: '50%',
  [TripEntityCancellationFee.SEVENTYFIVE]: '75%',
  [TripEntityCancellationFee.HUNDRED]: '100%',
}

export function cancellationFeeLabel(fee: TripEntityCancellationFee): string | null {
  return fee ? CANCELLATION_FEE_LABELS[fee] : null
}

/** "Cust / Pax" column's account label: the acronym when set, name as a plain clarifier — falls back to the name alone. */
export function clientAccountLabel(trip: TripEntity): { primary: string; secondary?: string } {
  if (trip.client.acronym) return { primary: trip.client.acronym, secondary: clientDisplayName(trip.client) }
  return { primary: clientDisplayName(trip.client) }
}

/** Farm-out or Local: driver name, falling back to the sub-contracted partner's name. */
/**
 * What to say on hover over the passenger line, or null to say nothing.
 *
 * The person to call when a pickup goes wrong is often not the passenger — a
 * PA, an event coordinator — and their number is what a dispatcher reaches for
 * under time pressure. Only shown when the POC actually differs from the
 * passenger (common.js:3108): on a list where most bookings have the passenger
 * as their own contact, repeating it on every row is noise nobody reads.
 */
export function pocTooltipLabel(trip: TripEntity): string | null {
  if (!trip.pocName || trip.pocName === trip.passengerName) return null
  const phone = formatPhoneDisplay(trip.pocPhone)
  return phone ? `POC: ${trip.pocName} · ${phone}` : `POC: ${trip.pocName}`
}

/**
 * The Reg Nbr cell. The acronym is what the column is sized for, but a vehicle
 * without one used to render as "—", indistinguishable from no vehicle at all
 * (seen on AA-001-BC, assigned and shown as "—"). The legacy had the same
 * blind spot and kept it (common.js:2604-2611); the plate is the honest
 * fallback, and "—" is left to mean what it says.
 */
export function fleetVehicleLabel(trip: TripEntity): string {
  return trip.fleetVehicle?.acronym ?? trip.fleetVehicle?.regNbr ?? '—'
}

export function tripDriverName(trip: TripEntity): string | null {
  if (trip.driver) return driverLabel(trip.driver)
  if (trip.partner) return driverLabel(trip.partner)
  return null
}

/** "Jean Dupont" -> "Jean D." (Local table's Driver column, to save space). */
export function shortDriverName(name: string | null | undefined): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  const first = parts[0]
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  return `${first} ${lastInitial}.`
}

/**
 * The trip's own pickup instant, resolved in its stored local timezone
 * (falls back to UTC if unset). Takes the minimal shape rather than the
 * full TripEntity so it also works on the leaner TripBaseEntity nested
 * under InvoiceEntity.trips[].trip.
 */
export function pickupLocalInstant(trip: Pick<TripEntity, 'pickupAt' | 'timezone'>): DateTime {
  return DateTime.fromISO(trip.pickupAt, { zone: trip.timezone ?? 'utc' })
}

export function pickupParisInstant(trip: TripEntity): DateTime {
  return DateTime.fromISO(trip.pickupAt).setZone(PARIS_ZONE)
}

export function displayPickup(trip: TripEntity): { local: string; paris: string } {
  const local = pickupLocalInstant(trip)
  const paris = pickupParisInstant(trip)
  return { local: local.toFormat('dd/MM HH:mm'), paris: paris.toFormat('HH:mm') }
}

/** H-6/H-3/H-1 row highlight — only for upcoming trips (a past unassigned trip is shown without urgency styling). */
export function urgencyRowClass(trip: TripEntity): string {
  const hoursLeft = pickupParisInstant(trip).diff(DateTime.now().setZone(PARIS_ZONE), 'hours').hours
  if (hoursLeft < 0) return ''
  if (hoursLeft < 1) return 'bg-destructive/15'
  if (hoursLeft < 3) return 'bg-orange-500/15'
  if (hoursLeft < 6) return 'bg-amber-400/15'
  return ''
}

export function itineraryLabel(trip: TripEntity): string {
  const pu = shortPlaceLabel(trip.pickupLocation, trip.pickupIata, trip.timezone)
  const dropoff =
    trip.service === TripEntityService.ASD
      ? `ASD (${trip.hours ?? '?'}h)`
      : shortPlaceLabel(trip.dropoffLocation, trip.dropoffIata, trip.timezone)
  return `${pu} → ${dropoff}`
}

/** The city a timezone names — "Europe/Paris" is Paris, "America/New_York" is New York. */
function timezoneCityName(timezone: string | null | undefined): string {
  if (!timezone) return ''
  return (timezone.split('/').pop() ?? '').replace(/_/g, ' ')
}

/**
 * An address as one narrow column can carry it — always leading with the city,
 * then whatever of the address fits after it.
 *
 * A full street address doesn't fit next to Reg Nbr, Sub-C and Driver, and
 * cutting it at the first comma is the wrong end: "12 avenue des Fleurs" says
 * far less than "Nice, 12 avenue des Fleurs". The city is picked in the
 * legacy's own order (shortPlaceLabel, common.js:2032): a Paris arrondissement
 * found via a 750xx postal code, then the trip's own city if the address names
 * it, then the city segment of a comma-separated address. An airport keeps its
 * IATA code behind the city — "Paris, CDG".
 */
export function shortPlaceLabel(
  location: string | null | undefined,
  iata: string | null | undefined,
  timezone: string | null | undefined,
): string {
  const tzCity = timezoneCityName(timezone)
  if (iata) return tzCity ? `${tzCity}, ${iata}` : iata
  if (!location?.trim()) return '—'
  const trimmed = location.trim()

  const joinRest = (rest: string) =>
    rest
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ')

  const arrondissement = trimmed.match(/\b750(\d{2})\b/)
  if (tzCity === 'Paris' && arrondissement) {
    const rest = joinRest(
      trimmed.split(arrondissement[0]).join('').replace(new RegExp(`\\b${tzCity}\\b`, 'i'), ''),
    )
    const label = `Paris ${parseInt(arrondissement[1], 10)}`
    return rest ? `${label}, ${rest}` : label
  }

  if (tzCity && new RegExp(`\\b${tzCity}\\b`, 'i').test(trimmed)) {
    const rest = joinRest(trimmed.replace(new RegExp(`\\b${tzCity}\\b`, 'i'), ''))
    return rest ? `${tzCity}, ${rest}` : tzCity
  }

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const city = parts[parts.length - 2]
    const rest = parts.slice(0, parts.length - 2).join(', ')
    return rest ? `${city}, ${rest}` : city
  }

  return tzCity ? `${tzCity}, ${trimmed}` : trimmed
}
