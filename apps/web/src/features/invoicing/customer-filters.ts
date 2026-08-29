import { DateTime } from 'luxon'
import type { InvoiceEntity, TripEntity } from '@cockpit/shared/api'
import { PARIS_ZONE, pickupParisInstant } from '../bookings/trip-display'

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

/**
 * Date out defaults to the end of the month BEFORE the current one —
 * invoicing targets completed past months, not the still-in-progress
 * current one. Date in defaults to the 1st of that same previous month,
 * UNLESS an even older trip still isn't invoiced, in which case it pulls
 * back to the 1st of THAT trip's month — so a backlog from further back
 * never silently falls outside the default view. Mirrors the legacy's
 * computeCustomerDefaultPeriod (invoicing.html:221-233).
 */
export function computeCustomerDefaultPeriod(trips: TripEntity[]): { start: string; end: string } {
  const now = DateTime.now().setZone(PARIS_ZONE)
  const prevMonthStart = now.startOf('month').minus({ months: 1 })
  const prevMonthEnd = now.startOf('month').minus({ days: 1 })

  let start = prevMonthStart
  const unbilledDates = trips.filter((t) => !t.invoiced).map((t) => pickupParisInstant(t).toISODate()!)
  if (unbilledDates.length) {
    const oldest = unbilledDates.reduce((min, d) => (d < min ? d : min))
    const oldestMonthStart = DateTime.fromISO(oldest).setZone(PARIS_ZONE).startOf('month')
    if (oldestMonthStart < prevMonthStart) start = oldestMonthStart
  }
  return { start: start.toISODate()!, end: prevMonthEnd.toISODate()! }
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

  return trips
    .filter((t) => !target || t.client.ref === target)
    .filter((t) => !filters.dateStart || pickupParisInstant(t).toISODate()! >= filters.dateStart)
    .filter((t) => !filters.dateEnd || pickupParisInstant(t).toISODate()! <= filters.dateEnd)
    .filter((t) => !refPo || (t.client.refPoOther ?? '').toLowerCase().includes(refPo))
    .filter((t) => !passenger || t.passengerName.toLowerCase().includes(passenger))
}

/** Pending: trip-level results minus whatever's already been invoiced (invoicing.html:302). */
export function applyPendingFilters(trips: TripEntity[], filters: CustomerFilters): TripEntity[] {
  return applyCustomerTripFilters(trips, filters).filter((t) => !t.invoiced)
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
