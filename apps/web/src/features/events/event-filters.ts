import { DateTime } from 'luxon'
import type { TripEntity } from '@cockpit/shared/api'
import { PARIS_ZONE } from '../bookings/trip-display'

export interface EventFilters {
  clientRef: string
  countryCode: string
  vehicleType: string
  dateStart: string
  dateEnd: string
  eventName: string
  refPoOther: string
}

export function defaultEventFilters(): EventFilters {
  return { clientRef: '', countryCode: '', vehicleType: '', dateStart: '', dateEnd: '', eventName: '', refPoOther: '' }
}

/**
 * Mirrors the legacy's Events search block (events.html renderRideList) —
 * narrows the already server-bounded `category=event` result set. Event
 * name / Ref-PO-Other live on the linked (Events-type) client account, not
 * on the trip itself.
 */
export function applyEventFilters(trips: TripEntity[], filters: EventFilters): TripEntity[] {
  const eventName = filters.eventName.trim().toLowerCase()
  const refPoOther = filters.refPoOther.trim().toLowerCase()

  return trips
    .filter((t) => !filters.clientRef || t.client.ref === filters.clientRef)
    .filter((t) => !filters.countryCode || t.countryCode === filters.countryCode)
    .filter((t) => !filters.vehicleType || t.vehicleType?.name === filters.vehicleType)
    .filter((t) => !filters.dateStart || DateTime.fromISO(t.pickupAt).setZone(PARIS_ZONE).toISODate()! >= filters.dateStart)
    .filter((t) => !filters.dateEnd || DateTime.fromISO(t.pickupAt).setZone(PARIS_ZONE).toISODate()! <= filters.dateEnd)
    .filter((t) => !eventName || (t.client.company ?? '').toLowerCase().includes(eventName))
    .filter((t) => !refPoOther || (t.client.refPoOther ?? '').toLowerCase().includes(refPoOther))
}
