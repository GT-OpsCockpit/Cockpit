import { DateTime } from 'luxon'
import { TripEntityService, TripStepEntityStep } from '@cockpit/shared/api'
import type { ClientBaseEntity, DriverBaseEntity, TripEntity } from '@cockpit/shared/api'

// Same reference timezone the legacy header uses for every list/urgency
// computation ("times shown in Europe/Paris"), independent of the trip's own
// local timezone (shown separately, see pickupLocalInstant).
export const PARIS_ZONE = 'Europe/Paris'

export const STEP_ORDER = [
  TripStepEntityStep.TRANSMITTED,
  TripStepEntityStep.RECEIVED,
  TripStepEntityStep.ACCEPTED,
  TripStepEntityStep.ENROUTE,
  TripStepEntityStep.ARRIVED,
  TripStepEntityStep.ONBOARD,
  TripStepEntityStep.DROPPED,
] as const

export const STEP_LABELS: Record<TripStepEntityStep, string> = {
  TRANSMITTED: '📤 Sent ✅',
  RECEIVED: '📥 Received',
  ACCEPTED: '✔️ Confirmed',
  ENROUTE: '🛣️ OTW',
  ARRIVED: '📍 IP',
  ONBOARD: '🟢 POB',
  DROPPED: '✅ Done',
}

export const CANCELLED_LABEL = '🛑 Stop'

// Steps kept as a solid badge; everything else is plain colored text (matches
// the legacy's HIGHLIGHTED_STEPS distinction).
export const HIGHLIGHTED_STEPS: (TripStepEntityStep | 'CANCELLED')[] = [
  TripStepEntityStep.TRANSMITTED,
  TripStepEntityStep.RECEIVED,
  TripStepEntityStep.ACCEPTED,
  TripStepEntityStep.DROPPED,
  'CANCELLED',
]

// Steps from which the dispatcher can click the badge to validate the next
// one — everything except the last step (Done) and cancellation (Stop).
export const ADVANCEABLE_STEPS: TripStepEntityStep[] = [
  TripStepEntityStep.TRANSMITTED,
  TripStepEntityStep.RECEIVED,
  TripStepEntityStep.ACCEPTED,
  TripStepEntityStep.ENROUTE,
  TripStepEntityStep.ARRIVED,
  TripStepEntityStep.ONBOARD,
]

export type TripStatus = TripStepEntityStep | 'CANCELLED' | null

/** Latest step reached, or 'CANCELLED' if the assignment was pulled — mirrors the legacy's currentStatus(). */
export function currentStatus(trip: TripEntity): TripStatus {
  if (trip.assignmentCancelled) return 'CANCELLED'
  let last: TripStepEntityStep | null = null
  const present = new Set(trip.steps.map((s) => s.step))
  for (const step of STEP_ORDER) if (present.has(step)) last = step
  return last
}

/** A sub-contracted job with no specific partner driver on file is pinned at "Sent" server-side — the badge is never clickable in that case. */
export function isStatusLocked(trip: TripEntity): boolean {
  return trip.subContractor && !trip.partnerId
}

export function statusLabel(status: TripStatus): string {
  if (!status) return '📤 Send ?'
  if (status === 'CANCELLED') return CANCELLED_LABEL
  return STEP_LABELS[status]
}

export function isStatusHighlighted(status: TripStatus): boolean {
  return !!status && HIGHLIGHTED_STEPS.includes(status)
}

export function isStatusAdvanceable(trip: TripEntity): boolean {
  const status = currentStatus(trip)
  return !isStatusLocked(trip) && !!status && status !== 'CANCELLED' && ADVANCEABLE_STEPS.includes(status)
}

export function clientDisplayName(client: ClientBaseEntity): string {
  const contact = [client.contactFirstName, client.contactLastName].filter(Boolean).join(' ').trim()
  return client.company?.trim() || contact || `Account ${client.ref}`
}

export function driverDisplayName(driver: DriverBaseEntity): string {
  return [driver.firstName, driver.lastName].filter(Boolean).join(' ').trim() || driver.company || driver.ref
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

const LOCAL_AREA_NAMES = ['nice', 'cannes', 'st tropez', 'st-tropez', 'saint-tropez', 'saint tropez']

/** Geographic "Local" (Nice/Cannes/St-Tropez/Monaco) vs "Farm out" split for the two Bookings tables. */
export function isLocalTrip(trip: TripEntity): boolean {
  const area = (trip.area || '').trim().toLowerCase()
  if (LOCAL_AREA_NAMES.some((n) => area === n)) return true
  if (trip.countryCode === 'MC') return true
  const text = `${trip.pickupLocation || ''} ${trip.dropoffLocation || ''}`.toLowerCase()
  return LOCAL_AREA_NAMES.some((n) => text.includes(n))
}

/** The trip's own pickup instant, resolved in its stored local timezone (falls back to UTC if unset). */
export function pickupLocalInstant(trip: TripEntity): DateTime {
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

export function isPastDay(trip: TripEntity): boolean {
  return pickupParisInstant(trip) < DateTime.now().setZone(PARIS_ZONE).startOf('day')
}

/** Default list visibility: today's/upcoming trips always show; a past trip only if still unassigned (needs priority handling). */
export function baseVisibility(trip: TripEntity): boolean {
  if (!isPastDay(trip)) return true
  return !trip.driverId
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
