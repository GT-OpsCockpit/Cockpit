import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { TripEntityService } from '@cockpit/shared/api'
import { baseTrip } from '../bookings/test-fixtures'
import {
  absStartMinutes,
  blockGeometry,
  compareUnassignedTrips,
  computeTimelineWindow,
  isTripInWindow,
  isTripOnVisibleDay,
  nowLinePercent,
} from './planning-timeline-math'

describe('computeTimelineWindow', () => {
  it('builds one date per day for a 1-3 day span, clamping outside that range', () => {
    expect(computeTimelineWindow('2026-06-05', 1).dateList).toEqual(['2026-06-05'])
    expect(computeTimelineWindow('2026-06-05', 2).dateList).toEqual(['2026-06-05', '2026-06-06'])
    expect(computeTimelineWindow('2026-06-05', 3).dateList).toEqual(['2026-06-05', '2026-06-06', '2026-06-07'])
    expect(computeTimelineWindow('2026-06-05', 0).dateList).toEqual(['2026-06-05'])
    expect(computeTimelineWindow('2026-06-05', 5).dateList).toEqual(['2026-06-05', '2026-06-06', '2026-06-07'])
  })

  it('gives each day an equal share of the track width', () => {
    expect(computeTimelineWindow('2026-06-05', 1).dayWidthPct).toBe(100)
    expect(computeTimelineWindow('2026-06-05', 2).dayWidthPct).toBe(50)
  })

  it('sizes the window in minutes as daysCount * 1440', () => {
    expect(computeTimelineWindow('2026-06-05', 1).windowEndAbsMin).toBe(1440)
    expect(computeTimelineWindow('2026-06-05', 3).windowEndAbsMin).toBe(4320)
  })

  it('spaces hour labels further apart as more days are packed in', () => {
    expect(computeTimelineWindow('2026-06-05', 1).hourStep).toBe(1)
    expect(computeTimelineWindow('2026-06-05', 2).hourStep).toBe(2)
    expect(computeTimelineWindow('2026-06-05', 3).hourStep).toBe(3)
  })
})

describe('absStartMinutes / blockGeometry', () => {
  it('positions a trip starting mid-window at the matching % offset', () => {
    const window = computeTimelineWindow('2026-06-05', 1)
    // 10:00 Paris (summer, UTC+2) on the window's own day -> 08:00 UTC.
    const trip = baseTrip({ pickupAt: '2026-06-05T08:00:00.000Z', service: TripEntityService.TSF, hours: null })
    expect(absStartMinutes(trip, window)).toBe(600) // 10:00 -> 600 minutes from 00:00
    const geometry = blockGeometry(trip, window)
    expect(geometry).not.toBeNull()
    expect(geometry!.leftPct).toBeCloseTo((600 / 1440) * 100)
    expect(geometry!.widthPct).toBeCloseTo((60 / 1440) * 100) // 1h default block
  })

  it('clips a trip that started the day before the window to pick up at 0%', () => {
    const window = computeTimelineWindow('2026-06-05', 1)
    // Pickup the day before at 23:00 Paris, ASD running 4h — ends at 2026-06-05 03:00
    // Paris, so only the last 3h of the 4h block are inside the window.
    const trip = baseTrip({
      pickupAt: '2026-06-04T21:00:00.000Z', // 2026-06-04 23:00 Paris
      service: TripEntityService.ASD,
      hours: 4,
    })
    const geometry = blockGeometry(trip, window)
    expect(geometry).not.toBeNull()
    expect(geometry!.leftPct).toBe(0)
    expect(geometry!.widthPct).toBeCloseTo((180 / 1440) * 100)
  })

  it('clips a trip that runs past the last visible day at 100%', () => {
    const window = computeTimelineWindow('2026-06-05', 1)
    const trip = baseTrip({
      pickupAt: '2026-06-05T21:00:00.000Z', // 23:00 Paris — 1h left before midnight
      service: TripEntityService.ASD,
      hours: 4,
    })
    const geometry = blockGeometry(trip, window)
    expect(geometry).not.toBeNull()
    expect(geometry!.leftPct).toBeCloseTo((1380 / 1440) * 100) // 23:00 -> 1380 minutes
    expect(geometry!.leftPct + geometry!.widthPct).toBeCloseTo(100) // clipped exactly at the window's end
  })

  it('returns null once no part of the trip falls inside the window', () => {
    const window = computeTimelineWindow('2026-06-05', 1)
    const farBefore = baseTrip({ pickupAt: '2026-06-01T08:00:00.000Z', service: TripEntityService.TSF, hours: null })
    const farAfter = baseTrip({ pickupAt: '2026-06-10T08:00:00.000Z', service: TripEntityService.TSF, hours: null })
    expect(blockGeometry(farBefore, window)).toBeNull()
    expect(blockGeometry(farAfter, window)).toBeNull()
    expect(isTripInWindow(farBefore, window)).toBe(false)
    expect(isTripInWindow(farAfter, window)).toBe(false)
  })
})

describe('isTripOnVisibleDay', () => {
  it('checks the trip\'s own pickup date against the visible day list, independent of the assigned-block window logic', () => {
    const window = computeTimelineWindow('2026-06-05', 2)
    const onFirstDay = baseTrip({ pickupAt: '2026-06-05T08:00:00.000Z' })
    const onSecondDay = baseTrip({ pickupAt: '2026-06-06T08:00:00.000Z' })
    const outside = baseTrip({ pickupAt: '2026-06-07T08:00:00.000Z' })
    expect(isTripOnVisibleDay(onFirstDay, window)).toBe(true)
    expect(isTripOnVisibleDay(onSecondDay, window)).toBe(true)
    expect(isTripOnVisibleDay(outside, window)).toBe(false)
  })
})

describe('nowLinePercent', () => {
  it('returns null when today is not one of the visible days', () => {
    const window = computeTimelineWindow('2026-06-05', 1)
    const now = DateTime.fromISO('2026-06-10T10:00:00', { zone: 'Europe/Paris' })
    expect(nowLinePercent(window, now)).toBeNull()
  })

  it('positions "now" at the matching % offset within a single-day window', () => {
    const window = computeTimelineWindow('2026-06-05', 1)
    const now = DateTime.fromISO('2026-06-05T06:00:00', { zone: 'Europe/Paris' }) // 06:00 -> 25%
    expect(nowLinePercent(window, now)).toBeCloseTo(25)
  })

  it('accounts for the day offset within a multi-day window', () => {
    const window = computeTimelineWindow('2026-06-05', 2)
    const now = DateTime.fromISO('2026-06-06T12:00:00', { zone: 'Europe/Paris' }) // day 2 of 2, noon -> 75%
    expect(nowLinePercent(window, now)).toBeCloseTo(75)
  })
})

describe('compareUnassignedTrips', () => {
  it('sorts by date first, then by time of day', () => {
    const early = baseTrip({ ref: 'early', pickupAt: '2026-06-05T07:00:00.000Z' })
    const late = baseTrip({ ref: 'late', pickupAt: '2026-06-05T20:00:00.000Z' })
    const nextDay = baseTrip({ ref: 'next-day', pickupAt: '2026-06-06T06:00:00.000Z' })
    const sorted = [nextDay, late, early].sort(compareUnassignedTrips)
    expect(sorted.map((t) => t.ref)).toEqual(['early', 'late', 'next-day'])
  })
})
