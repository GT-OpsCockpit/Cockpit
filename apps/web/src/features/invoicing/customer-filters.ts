import type { InvoiceEntity } from '@cockpit/shared/api'

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

/** The specific Client or Event ref currently targeted, or '' if "All clients". */
export function customerFilterTarget(filters: CustomerFilters): string {
  return filters.eventsMode ? filters.eventRef : filters.clientRef
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
