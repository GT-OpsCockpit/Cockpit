import { DateTime } from 'luxon'
import type { TripEntity, TripsControllerListParams } from '@cockpit/shared/api'
import { parisDateRangeWindow } from '../bookings/trip-query'
import { PARIS_ZONE } from '../bookings/trip-display'

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
 * The farmed-out bookings this tab logs, as the API's own query. `category:
 * 'all'` for the same reason as the Customer tab: the API's `daily` default
 * would drop every Events-account booking, and the legacy logged those too
 * (invoicing.html:740 filtered the full list).
 */
export function partnerListQuery(filters: PartnerFilters): TripsControllerListParams {
  return {
    ...parisDateRangeWindow(filters.dateStart, filters.dateEnd),
    ...(!filters.dateStart && !filters.dateEnd && { period: 'all' as const }),
    category: 'all',
    hasPartner: true,
  }
}

/**
 * Same mechanics as the Customer tab, scoped to trip.partner instead of
 * trip.client (invoicing.html:733-750) — Partner and Event selects are
 * mutually exclusive, same convention as Customer's Client/Event toggle.
 */
export function applyPartnerFilters(trips: TripEntity[], filters: PartnerFilters): TripEntity[] {
  const refPo = filters.refPo.trim().toLowerCase()

  // The date range and "has a partner" are resolved server-side (hasPartner +
  // from/to, see partner-log-tab.tsx) — what stays here is the narrowing the
  // API has no parameter for.
  return trips
    .filter((t) => !filters.partnerRef || t.partner?.ref === filters.partnerRef)
    .filter((t) => !filters.eventRef || t.client.ref === filters.eventRef)
    .filter((t) => !refPo || (t.client.refPoOther ?? '').toLowerCase().includes(refPo))
}
