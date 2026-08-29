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
