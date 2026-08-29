import { DateTime } from 'luxon'
import { PARIS_ZONE } from './trip-display'

/**
 * How a page's own date range becomes the window it asks the API for.
 *
 * The pages whose window is a real date range — the Planning Gantt, the
 * Invoicing and Partner logs — used to ask for `period: 'all'`, which puts no
 * bound on the query at all, and narrow the whole history in the browser.
 * These build the bounds those pages already knew.
 */

export interface TripWindow {
  from?: string
  to?: string
}

/**
 * A Paris-local date range (`yyyy-MM-dd`, as the filter bars hold it) as the
 * half-open instant window the API takes: midnight on `dateStart`, up to but
 * not including midnight after `dateEnd`. An empty bound stays open.
 */
export function parisDateRangeWindow(dateStart: string, dateEnd: string): TripWindow {
  return {
    ...(dateStart && { from: parisMidnight(dateStart).toISO()! }),
    ...(dateEnd && { to: parisMidnight(dateEnd).plus({ days: 1 }).toISO()! }),
  }
}

/**
 * The window behind the Planning Gantt's visible days.
 *
 * `from` reaches back a further ASD_MAX_HOURS because the Gantt draws any
 * booking that *overlaps* the window, clipped — including one that started
 * before it and is still running (isTripInWindow, planning-timeline-math.ts).
 * An at-disposal booking runs up to 48h (the API caps `hours` there), so
 * that is how far back one can start and still be on screen.
 */
const ASD_MAX_HOURS = 48

export function timelineWindow(dateStart: string, days: number): TripWindow {
  const start = parisMidnight(dateStart)
  return {
    from: start.minus({ hours: ASD_MAX_HOURS }).toISO()!,
    to: start.plus({ days }).toISO()!,
  }
}

function parisMidnight(date: string): DateTime {
  return DateTime.fromISO(date, { zone: PARIS_ZONE }).startOf('day')
}
