import { describe, expect, it } from 'vitest'
import { effectiveActivity, isWithinAvailabilityWindow, isWithinEventWindow } from './effective-activity.js'

const TODAY = '2026-06-15'

describe('isWithinAvailabilityWindow', () => {
  it('is true when nothing is on file', () => {
    expect(isWithinAvailabilityWindow(null, TODAY)).toBe(true)
  })

  // Structural on purpose, like the legacy: a single `date` (a day off) or a
  // `startDate`/`endDate` range (everything else), so a new marker type on
  // either the driver or the vehicle side needs no change here.
  it('excludes the single day a day off falls on, and nothing else', () => {
    expect(isWithinAvailabilityWindow({ date: '2026-06-15' }, TODAY)).toBe(false)
    expect(isWithinAvailabilityWindow({ date: '2026-06-16' }, TODAY)).toBe(true)
  })

  it('excludes a range inclusively at both ends', () => {
    expect(isWithinAvailabilityWindow({ startDate: '2026-06-15', endDate: '2026-06-20' }, TODAY)).toBe(false)
    expect(isWithinAvailabilityWindow({ startDate: '2026-06-10', endDate: '2026-06-15' }, TODAY)).toBe(false)
    expect(isWithinAvailabilityWindow({ startDate: '2026-06-16', endDate: '2026-06-20' }, TODAY)).toBe(true)
  })

  it('reads a full ISO timestamp as the day it falls on', () => {
    expect(isWithinAvailabilityWindow({ date: '2026-06-15T00:00:00.000Z' }, TODAY)).toBe(false)
  })
})

describe('isWithinEventWindow', () => {
  const event = { eventStartDate: '2026-06-10', eventEndDate: '2026-06-20' }

  it('is true for a record that is not Events-scoped', () => {
    expect(isWithinEventWindow({ eventsOnly: false }, event, TODAY)).toBe(true)
  })

  it('is true when the linked event has no dates to gate on', () => {
    expect(isWithinEventWindow({ eventsOnly: true }, null, TODAY)).toBe(true)
    expect(isWithinEventWindow({ eventsOnly: true }, { eventStartDate: null, eventEndDate: null }, TODAY)).toBe(true)
  })

  it('is false before the event starts and after it ends', () => {
    expect(isWithinEventWindow({ eventsOnly: true }, event, '2026-06-09')).toBe(false)
    expect(isWithinEventWindow({ eventsOnly: true }, event, '2026-06-21')).toBe(false)
    expect(isWithinEventWindow({ eventsOnly: true }, event, TODAY)).toBe(true)
  })
})

describe('effectiveActivity', () => {
  it('is active when nothing gates the record', () => {
    expect(effectiveActivity({ active: true }, null, TODAY)).toEqual({ active: true, reason: null })
  })

  // The legacy showed one badge, and these three reasons in this order
  // (inactivityBadge, common.js:3486-3493).
  it('reports manual deactivation ahead of every automatic gate', () => {
    expect(
      effectiveActivity({ active: false, unavailability: { date: TODAY } }, null, TODAY),
    ).toEqual({ active: false, reason: 'DEACTIVATED' })
  })

  it('reports an unavailability in effect ahead of the event window', () => {
    expect(
      effectiveActivity(
        { active: true, eventsOnly: true, unavailability: { date: TODAY } },
        { eventStartDate: '2026-01-01', eventEndDate: '2026-01-02' },
        TODAY,
      ),
    ).toEqual({ active: false, reason: 'UNAVAILABLE' })
  })

  it('reports a record resting outside its event dates', () => {
    expect(
      effectiveActivity(
        { active: true, eventsOnly: true },
        { eventStartDate: '2026-01-01', eventEndDate: '2026-01-02' },
        TODAY,
      ),
    ).toEqual({ active: false, reason: 'OUTSIDE_EVENT' })
  })

  // An unavailability on file but not covering today leaves the record active —
  // the marker only counts while it is actually in effect.
  it('ignores an unavailability that does not cover today', () => {
    expect(
      effectiveActivity({ active: true, unavailability: { date: '2026-07-01' } }, null, TODAY),
    ).toEqual({ active: true, reason: null })
  })
})
