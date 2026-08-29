import { describe, expect, it } from 'vitest'
import { baseClient, baseTrip } from '../bookings/test-fixtures'
import { baseInvoice } from './test-fixtures'
import {
  applyCustomerTripFilters,
  applyInvoiceFilters,
  customerFilterTarget,
  customerListQuery,
  defaultCustomerFilters,
} from './customer-filters'

describe('customerListQuery', () => {
  // This tab is the only route to invoicing an Events booking — the Events page
  // has no invoicing action, and the Bookings creation dialog will not offer an
  // Events account. The API's `daily` default would drop every one of them.
  it("asks for every account type, or the tab's Events mode can never list a row", () => {
    expect(customerListQuery(defaultCustomerFilters({ start: '2026-06-01', end: '2026-06-30' })).category).toBe('all')
  })

  it('asks for the period on screen, and only what is still to be billed', () => {
    expect(customerListQuery(defaultCustomerFilters({ start: '2026-06-01', end: '2026-06-30' }))).toEqual({
      from: '2026-06-01T00:00:00.000+02:00',
      to: '2026-07-01T00:00:00.000+02:00',
      category: 'all',
      unbilled: true,
    })
  })

  it('falls back to the whole history only once both dates are cleared', () => {
    expect(customerListQuery(defaultCustomerFilters({ start: '', end: '' }))).toEqual({
      period: 'all',
      category: 'all',
      unbilled: true,
    })
  })
})

describe('customerFilterTarget', () => {
  it('reads clientRef when not in Events mode, eventRef otherwise', () => {
    const base = defaultCustomerFilters({ start: '2026-01-01', end: '2026-01-31' })
    expect(customerFilterTarget({ ...base, clientRef: 'CI1' })).toBe('CI1')
    expect(customerFilterTarget({ ...base, eventsMode: true, clientRef: 'CI1', eventRef: 'CE1' })).toBe('CE1')
  })
})

// The date range, "not yet invoiced" and the opening period are the API's now
// (from/to, unbilled, GET /invoices/default-period — see invoices.e2e-spec.ts).
// What is left here is the narrowing the API has no parameter for.
describe('applyCustomerTripFilters', () => {
  const filters = { ...defaultCustomerFilters({ start: '2026-06-01', end: '2026-06-30' }) }

  it('scopes by client ref, ref/PO (on the client account) and passenger', () => {
    const client = baseClient({ ref: 'CI1', refPoOther: 'PO-123' })
    const mine = baseTrip({ ref: 'R1', client, pickupAt: '2026-06-15T10:00:00.000Z', passengerName: 'Jane Doe' })
    const otherClient = baseTrip({ ref: 'R3', client: baseClient({ ref: 'CI2' }), pickupAt: '2026-06-10T10:00:00.000Z' })

    expect(applyCustomerTripFilters([mine, otherClient], { ...filters, clientRef: 'CI1' }).map((t) => t.ref)).toEqual([
      'R1',
    ])
    expect(applyCustomerTripFilters([mine], { ...filters, refPo: 'po-123' }).map((t) => t.ref)).toEqual(['R1'])
    expect(applyCustomerTripFilters([mine], { ...filters, refPo: 'nope' })).toEqual([])
    expect(applyCustomerTripFilters([mine], { ...filters, passenger: 'jane' }).map((t) => t.ref)).toEqual(['R1'])
    expect(applyCustomerTripFilters([mine], { ...filters, passenger: 'bob' })).toEqual([])
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
