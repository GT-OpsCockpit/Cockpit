import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { baseClient, baseTrip } from '../bookings/test-fixtures'
import { PARIS_ZONE } from '../bookings/trip-display'
import { baseInvoice } from './test-fixtures'
import {
  applyCustomerTripFilters,
  applyInvoiceFilters,
  applyPendingFilters,
  computeCustomerDefaultPeriod,
  customerFilterTarget,
  defaultCustomerFilters,
} from './customer-filters'

function iso(dateOnly: string): string {
  return DateTime.fromISO(dateOnly, { zone: PARIS_ZONE }).plus({ hours: 10 }).toUTC().toISO()!
}

describe('computeCustomerDefaultPeriod', () => {
  it('defaults to the previous calendar month when there is no older backlog', () => {
    const now = DateTime.now().setZone(PARIS_ZONE)
    const trips = [baseTrip({ invoiced: true, pickupAt: iso(now.minus({ months: 1 }).toISODate()!) })]
    const { start, end } = computeCustomerDefaultPeriod(trips)
    expect(start).toBe(now.startOf('month').minus({ months: 1 }).toISODate())
    expect(end).toBe(now.startOf('month').minus({ days: 1 }).toISODate())
  })

  it('pulls the start back to an older unbilled trip’s month, ignoring already-invoiced ones', () => {
    const now = DateTime.now().setZone(PARIS_ZONE)
    const oldMonth = now.startOf('month').minus({ months: 5 })
    const trips = [
      baseTrip({ ref: 'R1', invoiced: false, pickupAt: iso(oldMonth.plus({ days: 2 }).toISODate()!) }),
      baseTrip({ ref: 'R2', invoiced: true, pickupAt: iso(now.minus({ years: 1 }).toISODate()!) }),
    ]
    const { start, end } = computeCustomerDefaultPeriod(trips)
    expect(start).toBe(oldMonth.toISODate())
    expect(end).toBe(now.startOf('month').minus({ days: 1 }).toISODate())
  })
})

describe('customerFilterTarget', () => {
  it('reads clientRef when not in Events mode, eventRef otherwise', () => {
    const base = defaultCustomerFilters({ start: '2026-01-01', end: '2026-01-31' })
    expect(customerFilterTarget({ ...base, clientRef: 'CI1' })).toBe('CI1')
    expect(customerFilterTarget({ ...base, eventsMode: true, clientRef: 'CI1', eventRef: 'CE1' })).toBe('CE1')
  })
})

describe('applyCustomerTripFilters / applyPendingFilters', () => {
  const filters = { ...defaultCustomerFilters({ start: '2026-06-01', end: '2026-06-30' }) }

  it('scopes by client ref, date range, ref/PO (on the client account) and passenger', () => {
    const client = baseClient({ ref: 'CI1', refPoOther: 'PO-123' })
    const inRange = baseTrip({ ref: 'R1', client, pickupAt: '2026-06-15T10:00:00.000Z', passengerName: 'Jane Doe' })
    const outOfRange = baseTrip({ ref: 'R2', client, pickupAt: '2026-07-15T10:00:00.000Z' })
    const otherClient = baseTrip({ ref: 'R3', client: baseClient({ ref: 'CI2' }), pickupAt: '2026-06-10T10:00:00.000Z' })

    const result = applyCustomerTripFilters([inRange, outOfRange, otherClient], { ...filters, clientRef: 'CI1' })
    expect(result.map((t) => t.ref)).toEqual(['R1'])

    expect(applyCustomerTripFilters([inRange], { ...filters, refPo: 'po-123' }).map((t) => t.ref)).toEqual(['R1'])
    expect(applyCustomerTripFilters([inRange], { ...filters, refPo: 'nope' })).toEqual([])
    expect(applyCustomerTripFilters([inRange], { ...filters, passenger: 'jane' }).map((t) => t.ref)).toEqual(['R1'])
    expect(applyCustomerTripFilters([inRange], { ...filters, passenger: 'bob' })).toEqual([])
  })

  it('Pending excludes already-invoiced trips', () => {
    const pending = baseTrip({ ref: 'R1', invoiced: false, pickupAt: '2026-06-15T10:00:00.000Z' })
    const invoiced = baseTrip({ ref: 'R2', invoiced: true, pickupAt: '2026-06-15T10:00:00.000Z' })
    expect(applyPendingFilters([pending, invoiced], filters).map((t) => t.ref)).toEqual(['R1'])
  })
})

describe('applyInvoiceFilters', () => {
  const filters = defaultCustomerFilters({ start: '2026-06-01', end: '2026-06-30' })

  it('matches by client ref and by period overlap, not strict containment', () => {
    const client = baseClient({ ref: 'CI1' })
    const spanning = baseInvoice({
      ref: 'INV1',
      client,
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-08-31T00:00:00.000Z',
    })
    const before = baseInvoice({
      ref: 'INV2',
      client,
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-02-28T00:00:00.000Z',
    })
    const otherClient = baseInvoice({ ref: 'INV3', client: baseClient({ ref: 'CI2' }) })

    const result = applyInvoiceFilters([spanning, before, otherClient], { ...filters, clientRef: 'CI1' })
    expect(result.map((i) => i.ref)).toEqual(['INV1'])
  })

  it('matches Ref/PO on the invoice itself', () => {
    const inv = baseInvoice({ ref: 'INV1', refPo: 'PO-999' })
    expect(applyInvoiceFilters([inv], { ...filters, refPo: 'po-999' }).map((i) => i.ref)).toEqual(['INV1'])
    expect(applyInvoiceFilters([inv], { ...filters, refPo: 'nope' })).toEqual([])
  })
})
