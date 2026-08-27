import { DateTime } from 'luxon'
import { TripEntityService } from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'
import { PARIS_ZONE, pickupParisInstant, type TripPeriod } from '../bookings/trip-status'

export type PlanningResource = 'drivers' | 'vehicles'
export type PlanningCategory = 'daily' | 'event' | 'all'
export type PlanningView = 'list' | 'timeline'

export interface PlanningFilters {
  resource: PlanningResource
  category: PlanningCategory
  view: PlanningView
  period: TripPeriod
  resourceRef: string
  timelineDate: string
  timelineDays: 1 | 2 | 3
}

export function defaultPlanningFilters(): PlanningFilters {
  return {
    resource: 'drivers',
    category: 'all',
    view: 'list',
    period: 'upcoming',
    resourceRef: '',
    timelineDate: DateTime.now().setZone(PARIS_ZONE).toFormat('yyyy-MM-dd'),
    timelineDays: 1,
  }
}

// Ported verbatim from the legacy's CATEGORY_COLORS/TIMELINE_FALLBACK_PALETTE
// (common.js:1972-1998) — one dedicated color per known vehicle-type Category,
// cycling through a small fallback palette (by META.vehicleTypes order) for
// any category not in this map.
const CATEGORY_COLORS: Record<string, string> = {
  Business: '#eab308',
  'E-Business': '#fde68a',
  Van: '#16a34a',
  'E-Van': '#86efac',
  First: '#ffab91',
  Luxe: '#ff7f50',
  'Lugg.': '#6b7280',
  SUV: '#2563eb',
  'Excep.': '#ef4444',
  Sprinter: '#c4b5fd',
  'Coach 35': '#d946ef',
  'Coach 50': '#8b5cf6',
}

const TIMELINE_FALLBACK_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
]

export function vehicleTypeColor(vehicleType: string | null | undefined, allVehicleTypeNames: string[]): string {
  const key = vehicleType || '—'
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key]
  const uncoloredTypes = allVehicleTypeNames.filter((t) => !CATEGORY_COLORS[t])
  const idx = uncoloredTypes.indexOf(key)
  return TIMELINE_FALLBACK_PALETTE[(idx === -1 ? uncoloredTypes.length : idx) % TIMELINE_FALLBACK_PALETTE.length]
}

/** ASD trips carry their own duration (Nb H); every other service gets a fixed 1h block just to stay visible/clickable — common.js:2000-2008. */
export function tripDurationMinutes(trip: TripEntity): number {
  if (trip.service === TripEntityService.ASD && trip.hours) {
    const h = Number(trip.hours)
    if (!Number.isNaN(h) && h > 0) return h * 60
  }
  return 60
}

export function pickupDateParis(trip: TripEntity): string {
  return pickupParisInstant(trip).toFormat('yyyy-MM-dd')
}

export function pickupMinutesOfDayParis(trip: TripEntity): number {
  const instant = pickupParisInstant(trip)
  return instant.hour * 60 + instant.minute
}

interface DateWindow {
  date?: string | null
  startDate?: string | null
  endDate?: string | null
}

/**
 * Whether a driver/vehicle unavailability record covers a given Paris-local
 * date (`yyyy-MM-dd`) — no v2 equivalent of the legacy's
 * isWithinAvailabilityWindow existed before Planning needed one for the
 * Gantt's dimmed/highlighted row state (common.js:2206, 2215).
 */
export function coversDate(unavailability: DateWindow | null | undefined, dateStr: string): boolean {
  if (!unavailability) return false
  if (unavailability.date) return unavailability.date.slice(0, 10) === dateStr
  if (unavailability.startDate && unavailability.endDate) {
    return unavailability.startDate.slice(0, 10) <= dateStr && dateStr <= unavailability.endDate.slice(0, 10)
  }
  return false
}
