import { DateTime } from 'luxon'
import type { TripEntity } from '@cockpit/shared/api'
import { PARIS_ZONE, pickupParisInstant } from '../bookings/trip-display'
import { pickupDateParis, pickupMinutesOfDayParis, tripDurationMinutes } from './planning-status'

/**
 * Pure port of the legacy renderTimeline()'s layout math (common.js:2097-2232)
 * — kept separate from the rendering component so the trickiest part (day
 * windowing, midnight-crossing clip) is unit-testable on its own.
 */
export interface TimelineWindow {
  /** Paris-local yyyy-MM-dd, one entry per visible day (1-3). */
  dateList: string[]
  daysCount: number
  /** % of the total track width given to each day's 24h band. */
  dayWidthPct: number
  /** Total minutes across the whole visible window (daysCount * 1440). */
  windowEndAbsMin: number
  /** Only every Nth hour gets a label as more days are packed in (gridlines are drawn every hour regardless). */
  hourStep: number
}

export function computeTimelineWindow(dateStr: string, days: number): TimelineWindow {
  const daysCount = Math.min(Math.max(days || 1, 1), 3)
  const startDt = DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone: PARIS_ZONE })
  const dateList = Array.from({ length: daysCount }, (_, i) => startDt.plus({ days: i }).toFormat('yyyy-MM-dd'))
  return {
    dateList,
    daysCount,
    dayWidthPct: 100 / daysCount,
    windowEndAbsMin: daysCount * 1440,
    hourStep: daysCount === 1 ? 1 : daysCount === 2 ? 2 : 3,
  }
}

/** Minutes from the very start of the visible window (dateList[0] 00:00 Paris) to the trip's pickup — negative if it started before the window. */
export function absStartMinutes(trip: TripEntity, window: TimelineWindow): number | null {
  const startDt = DateTime.fromFormat(window.dateList[0], 'yyyy-MM-dd', { zone: PARIS_ZONE })
  return pickupParisInstant(trip).diff(startDt, 'minutes').minutes
}

export interface TimelineBlockGeometry {
  leftPct: number
  widthPct: number
}

/**
 * Position/width (in % of the track) for a trip clipped to the visible
 * window — null if none of it falls inside. A trip that starts before
 * midnight and runs past it is clipped to pick up at 0%; one still running
 * past the last visible day is cut off at 100% (common.js:2166-2179).
 */
export function blockGeometry(trip: TripEntity, window: TimelineWindow): TimelineBlockGeometry | null {
  const startAbs = absStartMinutes(trip, window)
  if (startAbs === null) return null
  const endAbs = startAbs + tripDurationMinutes(trip)
  const segStart = Math.max(startAbs, 0)
  const segEnd = Math.min(endAbs, window.windowEndAbsMin)
  if (segEnd <= segStart) return null
  return {
    leftPct: (segStart / window.windowEndAbsMin) * 100,
    widthPct: Math.max(((segEnd - segStart) / window.windowEndAbsMin) * 100, 1.2),
  }
}

/** A trip belongs on the grid (as a block, not the unassigned pile) once any part of it falls inside the visible window. */
export function isTripInWindow(trip: TripEntity, window: TimelineWindow): boolean {
  const startAbs = absStartMinutes(trip, window)
  if (startAbs === null) return false
  const endAbs = startAbs + tripDurationMinutes(trip)
  return endAbs > 0 && startAbs < window.windowEndAbsMin
}

/** Unassigned-pile membership: a trip whose own pickup date falls on one of the visible days (independent of the assigned/window logic above, mirrors common.js:2115-2120). */
export function isTripOnVisibleDay(trip: TripEntity, window: TimelineWindow): boolean {
  return window.dateList.includes(pickupDateParis(trip))
}

/** Chronological order for the unassigned pile — date first, then time of day (common.js:2116-2119). */
export function compareUnassignedTrips(a: TripEntity, b: TripEntity): number {
  const da = pickupDateParis(a)
  const db = pickupDateParis(b)
  if (da !== db) return da.localeCompare(db)
  return pickupMinutesOfDayParis(a) - pickupMinutesOfDayParis(b)
}

/** % position of "now" across the track — null when today isn't one of the visible days at all. No legacy equivalent (common.js never drew this); a small addition on top of the port. */
export function nowLinePercent(window: TimelineWindow, now: DateTime = DateTime.now().setZone(PARIS_ZONE)): number | null {
  const dayIndex = window.dateList.indexOf(now.toFormat('yyyy-MM-dd'))
  if (dayIndex === -1) return null
  const minutesOfDay = now.hour * 60 + now.minute
  return dayIndex * window.dayWidthPct + (minutesOfDay / 1440) * window.dayWidthPct
}
