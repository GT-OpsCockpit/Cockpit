import { DateTime } from 'luxon'
import type { TripEntity } from '@cockpit/shared/api'
import { PARIS_ZONE, pickupParisInstant } from '../bookings/trip-display'

export interface PartnerFilters {
  partnerRef: string
  eventRef: string
  dateStart: string
  dateEnd: string
  refPo: string
}

/** Partner log defaults to the current calendar month, unlike Customer's previous-month default (invoicing.html:210-213). */
export function firstAndLastOfMonth(): { start: string; end: string } {
  const now = DateTime.now().setZone(PARIS_ZONE)
  return { start: now.startOf('month').toISODate()!, end: now.endOf('month').toISODate()! }
}

export function defaultPartnerFilters(): PartnerFilters {
  const { start, end } = firstAndLastOfMonth()
  return { partnerRef: '', eventRef: '', dateStart: start, dateEnd: end, refPo: '' }
}

/**
 * Same mechanics as the Customer tab, scoped to trip.partner instead of
 * trip.client (invoicing.html:733-750) — Partner and Event selects are
 * mutually exclusive, same convention as Customer's Client/Event toggle.
 */
export function applyPartnerFilters(trips: TripEntity[], filters: PartnerFilters): TripEntity[] {
  const refPo = filters.refPo.trim().toLowerCase()

  return trips
    .filter((t) => !!t.partner)
    .filter((t) => !filters.partnerRef || t.partner?.ref === filters.partnerRef)
    .filter((t) => !filters.eventRef || t.client.ref === filters.eventRef)
    .filter((t) => !filters.dateStart || pickupParisInstant(t).toISODate()! >= filters.dateStart)
    .filter((t) => !filters.dateEnd || pickupParisInstant(t).toISODate()! <= filters.dateEnd)
    .filter((t) => !refPo || (t.client.refPoOther ?? '').toLowerCase().includes(refPo))
}
