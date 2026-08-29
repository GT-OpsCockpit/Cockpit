import type { TripsControllerListParams, TripsControllerListService } from '@cockpit/shared/api'

/**
 * What the dispatcher currently has in view on the Bookings board — held here,
 * resolved by the API.
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
 * The board's filter bar as the API's own query.
 *
 * Every one of these used to narrow an already-fetched list in the browser
 * (applyBookingFilters), on top of a fetch that `period: 'all'` could leave
 * unbounded. They are the server's now — see TripsService.list(). What is
 * still done here is the Local / Farm-out split, which is a presentation
 * split into two tables rather than a narrowing.
 */
export function bookingListQuery(filters: BookingFilters): TripsControllerListParams {
  const search = filters.search.trim()
  const passenger = filters.passenger.trim()
  return {
    period: filters.period,
    board: true,
    ...(search && { search }),
    ...(passenger && { passenger }),
    ...(filters.clientRef && { clientRef: filters.clientRef }),
    ...(filters.driverRef && { driverRef: filters.driverRef }),
    ...(filters.vehicleType && { vehicleType: filters.vehicleType }),
    ...(filters.service && { service: filters.service as TripsControllerListService }),
  }
}
