import { DateTime } from 'luxon'
import { clientDisplayName, driverLabel } from '@cockpit/shared'
import { TripEntityService } from '@cockpit/shared/api'
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

/** "Cust / Pax" column's account label: the acronym when set, name as a plain clarifier — falls back to the name alone. */
export function clientAccountLabel(trip: TripEntity): { primary: string; secondary?: string } {
  if (trip.client.acronym) return { primary: trip.client.acronym, secondary: clientDisplayName(trip.client) }
  return { primary: clientDisplayName(trip.client) }
}

/** Farm-out or Local: driver name, falling back to the sub-contracted partner's name. */
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
  const pu = trip.pickupIata || shortenLocation(trip.pickupLocation)
  const dropoff =
    trip.service === TripEntityService.ASD
      ? `ASD (${trip.hours ?? '?'}h)`
      : trip.dropoffIata || shortenLocation(trip.dropoffLocation) || '—'
  return `${pu} → ${dropoff}`
}

function shortenLocation(location: string | null | undefined): string {
  if (!location) return '—'
  const firstSegment = location.split(',')[0]?.trim()
  return firstSegment || location
}
