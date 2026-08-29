import { describe, expect, it } from 'vitest'
import { defaultCustomerFilters } from '../invoicing/customer-filters'
import { defaultPartnerFilters } from '../invoicing/partner-filters'
import { defaultPlanningFilters } from '../planning/planning-status'
import { defaultBookingFilters } from './booking-filters'
import { billingView, boardView, partnerLogView, planningListView, planningTimelineView } from './trip-views'

// The narrowing itself is the API's (see trips.e2e-spec.ts). What is pinned
// here is what each screen *asks for* — the part that used to be re-derived in
// four places, and got it wrong twice.

describe('boardView', () => {
  it('asks for the live board and the selected period, and nothing else, when the bar is untouched', () => {
    expect(boardView(defaultBookingFilters())).toEqual({ period: 'upcoming', category: 'daily', board: true })
  })

  it('sends each filled field, trimming the two free-text ones', () => {
    expect(
      boardView({
        ...defaultBookingFilters(),
        period: 'past',
        search: '  Marc Dubois  ',
        passenger: ' Alice ',
        clientRef: 'CI1',
        driverRef: 'D1',
        vehicleType: 'Business',
        service: 'ASD',
      }),
    ).toEqual({
      period: 'past',
      category: 'daily',
      board: true,
      search: 'Marc Dubois',
      passenger: 'Alice',
      clientRef: 'CI1',
      driverRef: 'D1',
      vehicleType: 'Business',
      service: 'ASD',
    })
  })

  it('drops a free-text field that holds nothing but whitespace', () => {
    expect(boardView({ ...defaultBookingFilters(), search: '   ', passenger: '  ' })).toEqual({
      period: 'upcoming',
      category: 'daily',
      board: true,
    })
  })

  it('is the only view that turns the live-board window on', () => {
    const june = defaultCustomerFilters({ start: '2026-06-01', end: '2026-06-30' })
    expect(billingView(june).board).toBeUndefined()
    expect(partnerLogView(defaultPartnerFilters()).board).toBeUndefined()
    expect(planningListView(defaultPlanningFilters()).board).toBeUndefined()
    expect(planningTimelineView(defaultPlanningFilters()).board).toBeUndefined()
  })
})

describe('billingView', () => {
  const june = defaultCustomerFilters({ start: '2026-06-01', end: '2026-06-30' })

  // This tab is the only route to invoicing an Events booking — the Events page
  // has no invoicing action, and the Bookings creation dialog will not offer an
  // Events account. The API's `daily` default would drop every one of them.
  it("asks for every account type, or the tab's Events mode can never list a row", () => {
    expect(billingView(june).category).toBe('all')
    expect(billingView({ ...june, eventsMode: true, eventRef: 'CE1' }).category).toBe('all')
  })

  it('asks for the period on screen, and only what is still to be billed', () => {
    expect(billingView(june)).toEqual({
      from: '2026-06-01T00:00:00.000+02:00',
      to: '2026-07-01T00:00:00.000+02:00',
      category: 'all',
      unbilled: true,
    })
  })

  it('falls back to the whole history only once both dates are cleared', () => {
    expect(billingView(defaultCustomerFilters({ start: '', end: '' }))).toEqual({
      period: 'all',
      category: 'all',
      unbilled: true,
    })
    // A half-open range is still a bound — `period` must not creep back in.
    expect(billingView({ ...june, dateStart: '' }).period).toBeUndefined()
    expect(billingView({ ...june, dateEnd: '' }).period).toBeUndefined()
  })

  // The tab used to fetch the whole period and then narrow it in the browser
  // (applyPendingFilters). Every one of these is a server parameter.
  it('sends the targeted account, the Ref/PO and the passenger rather than narrowing after the fetch', () => {
    expect(billingView({ ...june, clientRef: 'CI1', refPo: ' PO-1 ', passenger: ' Jane ' })).toMatchObject({
      clientRef: 'CI1',
      refPo: 'PO-1',
      passenger: 'Jane',
    })
  })

  it('sends the Event ref on the same clientRef slot in Events mode', () => {
    expect(billingView({ ...june, eventsMode: true, clientRef: 'CI1', eventRef: 'CE1' }).clientRef).toBe('CE1')
  })

  it('sends no account filter at all for "All clients"', () => {
    expect(billingView(june).clientRef).toBeUndefined()
  })
})

describe('partnerLogView', () => {
  const june = { ...defaultPartnerFilters(), dateStart: '2026-06-01', dateEnd: '2026-06-30' }

  // Same reason as billingView: the API's `daily` default would drop every
  // farmed-out Events booking, which the legacy logged here too.
  it('asks for every account type, its own month, and farmed-out bookings only', () => {
    expect(partnerLogView(june)).toEqual({
      from: '2026-06-01T00:00:00.000+02:00',
      to: '2026-07-01T00:00:00.000+02:00',
      category: 'all',
      hasPartner: true,
    })
  })

  it('sends the partner, the Event and the Ref/PO rather than narrowing after the fetch', () => {
    expect(partnerLogView({ ...june, partnerRef: 'D1', eventRef: 'CE1', refPo: ' PO-1 ' })).toMatchObject({
      partnerRef: 'D1',
      clientRef: 'CE1',
      refPo: 'PO-1',
    })
  })
})

describe('planningListView', () => {
  const base = defaultPlanningFilters()

  it('carries the selected category and period', () => {
    expect(planningListView({ ...base, category: 'event', period: 'week' })).toEqual({
      period: 'week',
      category: 'event',
    })
  })

  it('narrows to the selected driver, by ref', () => {
    expect(planningListView({ ...base, resource: 'drivers', resourceRef: 'D1' })).toMatchObject({ driverRef: 'D1' })
    expect(planningListView({ ...base, resource: 'drivers', resourceRef: 'D1' }).fleetRegNbr).toBeUndefined()
  })

  it('narrows to the selected vehicle, by reg nbr', () => {
    expect(planningListView({ ...base, resource: 'vehicles', resourceRef: 'AB-123-CD' })).toMatchObject({
      fleetRegNbr: 'AB-123-CD',
    })
    expect(planningListView({ ...base, resource: 'vehicles', resourceRef: 'AB-123-CD' }).driverRef).toBeUndefined()
  })
})

describe('planningTimelineView', () => {
  const base = { ...defaultPlanningFilters(), view: 'timeline' as const, timelineDate: '2026-06-10' }

  it('covers the visible days, and reaches back a full ASD so a booking still running is not lost', () => {
    // The Gantt draws any booking overlapping the window, clipped — one that
    // started up to 48h earlier can still be on screen.
    expect(planningTimelineView(base)).toEqual({
      from: '2026-06-08T00:00:00.000+02:00',
      to: '2026-06-11T00:00:00.000+02:00',
      category: 'all',
    })
  })

  it('widens with the day span', () => {
    expect(planningTimelineView({ ...base, timelineDays: 3 })).toMatchObject({
      from: '2026-06-08T00:00:00.000+02:00',
      to: '2026-06-13T00:00:00.000+02:00',
    })
  })

  it('shifts with the winter offset rather than assuming a fixed one', () => {
    expect(planningTimelineView({ ...base, timelineDate: '2026-01-10' })).toMatchObject({
      from: '2026-01-08T00:00:00.000+01:00',
      to: '2026-01-11T00:00:00.000+01:00',
    })
  })

  // The Gantt places every booking on its own resource row: filtering to the
  // selected one server-side would empty all the others instead of
  // highlighting it. This is the whole reason the list and the timeline are
  // two views and not one with a flag.
  it('never sends a resource filter, whichever resource is selected', () => {
    const withDriver = planningTimelineView({ ...base, resource: 'drivers', resourceRef: 'D1' })
    const withVehicle = planningTimelineView({ ...base, resource: 'vehicles', resourceRef: 'AB-123-CD' })
    expect(withDriver.driverRef).toBeUndefined()
    expect(withVehicle.fleetRegNbr).toBeUndefined()
    expect(withDriver).toEqual(planningTimelineView(base))
    expect(withVehicle).toEqual(planningTimelineView(base))
  })
})
