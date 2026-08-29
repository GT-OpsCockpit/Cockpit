import { clientDisplayName } from '@cockpit/shared'
import type { TripEntity } from '@cockpit/shared/api'
import { tripDriverName } from './trip-display'

/**
 * What the dispatcher currently has in view on the Bookings board, on top of
 * the window the API already resolved (period + the live-board rule, see
 * TripsService.list()).
 */

export type TripPeriod = 'upcoming' | 'today' | 'week' | 'past' | 'all'

export interface BookingFilters {
  search: string
  period: TripPeriod
  clientRef: string
  driverRef: string
  passenger: string
  vehicleType: string
  service: string
}

export function defaultBookingFilters(): BookingFilters {
  return { search: '', period: 'upcoming', clientRef: '', driverRef: '', passenger: '', vehicleType: '', service: '' }
}

/**
 * Refines an already server-bounded result set (TripsService.list() resolves
 * `period` and the always-on date-window/Events-client rules — see the
 * 2026-08-27 handoff) — search/client/driver/passenger/vehicle/service are
 * lightweight in-memory narrowing over that bounded set, not a second copy
 * of the date-window logic. Mirrors the legacy's renderTrips() filter chain
 * (dispatcher.html L442-455) for these fields, minus the Local/Farm-out
 * split (done separately by isLocalTrip). Sort order is the server's
 * (pickupAt ascending) — filtering here never reorders.
 */
export function applyBookingFilters(trips: TripEntity[], filters: BookingFilters): TripEntity[] {
  const q = filters.search.trim().toLowerCase()
  const passenger = filters.passenger.trim().toLowerCase()

  return trips
    .filter(
      (t) =>
        !q ||
        t.ref.toLowerCase().includes(q) ||
        clientDisplayName(t.client).toLowerCase().includes(q) ||
        (t.passengerName || '').toLowerCase().includes(q) ||
        (tripDriverName(t) || '').toLowerCase().includes(q),
    )
    .filter((t) => !filters.clientRef || t.client.ref === filters.clientRef)
    .filter((t) => !filters.driverRef || t.driver?.ref === filters.driverRef)
    .filter((t) => !passenger || (t.passengerName || '').toLowerCase().includes(passenger))
    .filter((t) => !filters.vehicleType || t.vehicleType?.name === filters.vehicleType)
    .filter((t) => !filters.service || t.service === filters.service)
}
