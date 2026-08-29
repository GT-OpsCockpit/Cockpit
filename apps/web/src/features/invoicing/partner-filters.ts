import { DateTime } from 'luxon'
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
