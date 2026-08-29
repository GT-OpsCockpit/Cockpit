import { DateTime } from 'luxon'
import type { TripsControllerListParams, TripsControllerListService } from '@cockpit/shared/api'
import type { CustomerFilters } from '../invoicing/customer-filters'
import { customerFilterTarget } from '../invoicing/customer-filters'
import type { PartnerFilters } from '../invoicing/partner-filters'
import type { PlanningFilters } from '../planning/planning-status'
import type { BookingFilters } from './booking-filters'
import { PARIS_ZONE } from './trip-display'

/**
 * The five ways this app asks for a list of bookings.
 *
 * `GET /trips` takes sixteen orthogonal parameters, and four screens used to
 * assemble them each on their own — each one having to carry the same
 * unwritten rules:
 *
 * 1. `category` defaults to 'daily' server-side, which silently drops every
 *    Events-account booking. Two callers found that out the hard way (the
 *    Customer tab and the Partner log, fixed in c89ff57), so every view below
 *    states its category rather than inheriting one.
 * 2. Giving `from`/`to` replaces `period` entirely.
 * 3. `board: true` changes what "in view" means, and belongs to the Bookings
 *    board alone.
 *
 * A view is named after the screen it serves, so those rules are decided here
 * once instead of being re-learned per page. What is deliberately NOT here:
 * anything a page does with the rows it gets back (the board's Local /
 * Farm-out split, the Gantt's grouping) — that is presentation, not narrowing.
 */

/** The dispatcher's live board: today onwards, plus anything still unassigned. */
export function boardView(filters: BookingFilters): TripsControllerListParams {
  const search = filters.search.trim()
  const passenger = filters.passenger.trim()
  return {
    period: filters.period,
    // The API's own default, stated rather than inherited: the board is the
    // one screen that genuinely means "no Events accounts".
    category: 'daily',
    board: true,
    ...(search && { search }),
    ...(passenger && { passenger }),
    ...(filters.clientRef && { clientRef: filters.clientRef }),
    ...(filters.driverRef && { driverRef: filters.driverRef }),
    ...(filters.vehicleType && { vehicleType: filters.vehicleType }),
    ...(filters.service && { service: filters.service as TripsControllerListService }),
  }
}

/**
 * The Invoicing Customer tab's Pending table: what is still to be billed in
 * the period on screen.
 *
 * `category: 'all'` is not incidental — this tab is the only route to
 * invoicing an Events booking (the Events page has no invoicing action, and
 * the Bookings creation dialog will not even offer an Events account), so the
 * server's 'daily' default would make its Events mode permanently empty.
 */
export function billingView(filters: CustomerFilters): TripsControllerListParams {
  const target = customerFilterTarget(filters)
  const refPo = filters.refPo.trim()
  const passenger = filters.passenger.trim()
  return {
    ...periodOrWindow(filters.dateStart, filters.dateEnd),
    category: 'all',
    unbilled: true,
    // Client and Event are two mutually exclusive slots over the same
    // trip.client.ref (see customerFilterTarget), so both land on `clientRef`.
    ...(target && { clientRef: target }),
    ...(refPo && { refPo }),
    ...(passenger && { passenger }),
  }
}

/** The Invoicing Partner log: farmed-out bookings only, over its own month. */
export function partnerLogView(filters: PartnerFilters): TripsControllerListParams {
  const refPo = filters.refPo.trim()
  return {
    ...periodOrWindow(filters.dateStart, filters.dateEnd),
    // Same reason as billingView: the legacy logged farmed-out Events
    // bookings here too.
    category: 'all',
    hasPartner: true,
    ...(filters.partnerRef && { partnerRef: filters.partnerRef }),
    ...(filters.eventRef && { clientRef: filters.eventRef }),
    ...(refPo && { refPo }),
  }
}

/** The Planning list, narrowed to the selected driver or vehicle. */
export function planningListView(filters: PlanningFilters): TripsControllerListParams {
  return {
    period: filters.period,
    category: filters.category,
    ...(filters.resourceRef && filters.resource === 'drivers' && { driverRef: filters.resourceRef }),
    ...(filters.resourceRef && filters.resource === 'vehicles' && { fleetRegNbr: filters.resourceRef }),
  }
}

/**
 * The Planning Gantt — deliberately a separate view rather than the list one
 * with a flag, because it must NOT carry the resource filter.
 *
 * The Gantt draws one row per driver (or vehicle) and places each booking on
 * its own row; narrowing to the selected resource server-side would empty
 * every other row rather than highlighting one. The selection is a list
 * concern only.
 */
export function planningTimelineView(filters: PlanningFilters): TripsControllerListParams {
  return {
    ...timelineWindow(filters.timelineDate, filters.timelineDays),
    category: filters.category,
  }
}

interface TripWindow {
  from?: string
  to?: string
}

/**
 * A Paris-local date range (`yyyy-MM-dd`, as the filter bars hold it) as the
 * half-open instant window the API takes: midnight on `dateStart`, up to but
 * not including midnight after `dateEnd`.
 *
 * Only once BOTH bounds are cleared does this fall back to `period: 'all'` —
 * a half-open range is still a bound, and `period` would replace nothing
 * anyway (see ListTripsQueryDto.from).
 */
function periodOrWindow(dateStart: string, dateEnd: string): TripsControllerListParams {
  if (!dateStart && !dateEnd) return { period: 'all' }
  return {
    ...(dateStart && { from: parisMidnight(dateStart).toISO()! }),
    ...(dateEnd && { to: parisMidnight(dateEnd).plus({ days: 1 }).toISO()! }),
  }
}

/**
 * The window behind the Gantt's visible days.
 *
 * `from` reaches back a further ASD_MAX_HOURS because the Gantt draws any
 * booking that *overlaps* the window, clipped — including one that started
 * before it and is still running (isTripInWindow, planning-timeline-math.ts).
 * An at-disposal booking runs up to 48h (the API caps `hours` there), so
 * that is how far back one can start and still be on screen.
 */
const ASD_MAX_HOURS = 48

function timelineWindow(dateStart: string, days: number): TripWindow {
  const start = parisMidnight(dateStart)
  return {
    from: start.minus({ hours: ASD_MAX_HOURS }).toISO()!,
    to: start.plus({ days }).toISO()!,
  }
}

function parisMidnight(date: string): DateTime {
  return DateTime.fromISO(date, { zone: PARIS_ZONE }).startOf('day')
}
