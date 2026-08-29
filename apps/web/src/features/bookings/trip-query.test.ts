import { describe, expect, it } from 'vitest'
import { parisDateRangeWindow, timelineWindow } from './trip-query'

describe('parisDateRangeWindow', () => {
  it('spans midnight to midnight, Paris-local, with the end day included', () => {
    // June is CEST (UTC+2), so Paris midnight is 22:00 UTC the day before.
    expect(parisDateRangeWindow('2026-06-01', '2026-06-30')).toEqual({
      from: '2026-06-01T00:00:00.000+02:00',
      to: '2026-07-01T00:00:00.000+02:00',
    })
  })

  it('shifts with the winter offset rather than assuming a fixed one', () => {
    expect(parisDateRangeWindow('2026-01-01', '2026-01-31')).toEqual({
      from: '2026-01-01T00:00:00.000+01:00',
      to: '2026-02-01T00:00:00.000+01:00',
    })
  })

  it('leaves a bound open when the filter bar has no date for it', () => {
    expect(parisDateRangeWindow('', '2026-06-30')).toEqual({ to: '2026-07-01T00:00:00.000+02:00' })
    expect(parisDateRangeWindow('2026-06-01', '')).toEqual({ from: '2026-06-01T00:00:00.000+02:00' })
    expect(parisDateRangeWindow('', '')).toEqual({})
  })
})

describe('timelineWindow', () => {
  it('covers the visible days, and reaches back a full ASD so a booking still running is not lost', () => {
    // The Gantt draws any booking overlapping the window, clipped — one that
    // started up to 48h earlier can still be on screen.
    expect(timelineWindow('2026-06-10', 1)).toEqual({
      from: '2026-06-08T00:00:00.000+02:00',
      to: '2026-06-11T00:00:00.000+02:00',
    })
  })

  it('widens with the day span', () => {
    expect(timelineWindow('2026-06-10', 3)).toEqual({
      from: '2026-06-08T00:00:00.000+02:00',
      to: '2026-06-13T00:00:00.000+02:00',
    })
  })
})
