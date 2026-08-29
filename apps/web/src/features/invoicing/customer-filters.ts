import type { InvoiceEntity, TripEntity, TripsControllerListParams } from '@cockpit/shared/api'
import { parisDateRangeWindow } from '../bookings/trip-query'

export interface CustomerFilters {
  /** Client and Event selects are mutually exclusive slots over the same trip.client.ref — same convention as Events' Search block. */
  eventsMode: boolean
  clientRef: string
  eventRef: string
  dateStart: string
  dateEnd: string
  refPo: string
  passenger: string
}

export function defaultCustomerFilters(period: { start: string; end: string }): CustomerFilters {
  return {
    eventsMode: false,
    clientRef: '',
    eventRef: '',
    dateStart: period.start,
    dateEnd: period.end,
    refPo: '',
    passenger: '',
  }
}

/**
 * The bookings this tab bills, as the API's own query.
 *
 * `category: 'all'` is not incidental: the API defaults to `daily`, which
 * excludes Events-account bookings, and this tab is the only place an Events
 * booking can be invoiced from — the Events page has no invoicing action and
 * the Bookings creation dialog will not even offer an Events account. The
 * legacy read every trip here (server.js:2277 returned them all), so its
 * Events mode worked; v2 inherited the `daily` default and killed it.
 */
export function customerListQuery(filters: CustomerFilters): TripsControllerListParams {
  return {
    ...parisDateRangeWindow(filters.dateStart, filters.dateEnd),
    ...(!filters.dateStart && !filters.dateEnd && { period: 'all' as const }),
    category: 'all',
    unbilled: true,
  }
}

/** The specific Client or Event ref currently targeted, or '' if "All clients". */
export function customerFilterTarget(filters: CustomerFilters): string {
  return filters.eventsMode ? filters.eventRef : filters.clientRef
}

/**
 * Trip-level search results (invoicing.html:280-299) — Ref/PO is matched
 * against the linked client account's Ref/PO/Other field, not a per-trip
 * field, same convention as Events' Search block.
 */
export function applyCustomerTripFilters(trips: TripEntity[], filters: CustomerFilters): TripEntity[] {
  const target = customerFilterTarget(filters)
  const refPo = filters.refPo.trim().toLowerCase()
  const passenger = filters.passenger.trim().toLowerCase()

  // The date range is the server's (from/to, see customer-tab.tsx) — what
  // stays here is the narrowing the API has no parameter for.
  return trips
    .filter((t) => !target || t.client.ref === target)
    .filter((t) => !refPo || (t.client.refPoOther ?? '').toLowerCase().includes(refPo))
    .filter((t) => !passenger || t.passengerName.toLowerCase().includes(passenger))
}

/**
 * Pending (invoicing.html:302). "Not yet invoiced" is the server's too
 * (`unbilled`), so this is now just the trip-level search under another name —
 * kept as the name the tab reads by, and as the place to re-add the guard if
 * the query ever stops carrying it.
 */
export function applyPendingFilters(trips: TripEntity[], filters: CustomerFilters): TripEntity[] {
  return applyCustomerTripFilters(trips, filters)
}

/**
 * Invoiced: NOT trip-level — one row per invoice, filtered by the same
 * Client/Event + Ref/PO, but by **period overlap** rather than strict
 * containment (an invoice spanning June-August still matches a July search)
 * — mirrors invoicing.html:306-322.
 */
export function applyInvoiceFilters(invoices: InvoiceEntity[], filters: CustomerFilters): InvoiceEntity[] {
  const target = customerFilterTarget(filters)
  const refPo = filters.refPo.trim().toLowerCase()

  return invoices
    .filter((inv) => !target || inv.client.ref === target)
    .filter((inv) => !filters.dateStart || !inv.periodEnd || inv.periodEnd.slice(0, 10) >= filters.dateStart)
    .filter((inv) => !filters.dateEnd || !inv.periodStart || inv.periodStart.slice(0, 10) <= filters.dateEnd)
    .filter((inv) => !refPo || (inv.refPo ?? '').toLowerCase().includes(refPo))
}
