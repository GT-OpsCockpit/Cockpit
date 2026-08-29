import { describe, expect, it } from 'vitest'
import { baseClient } from '../bookings/test-fixtures'
import { baseInvoice } from './test-fixtures'
import { applyInvoiceFilters, customerFilterTarget, defaultCustomerFilters } from './customer-filters'

describe('customerFilterTarget', () => {
  it('reads clientRef when not in Events mode, eventRef otherwise', () => {
    const base = defaultCustomerFilters({ start: '2026-01-01', end: '2026-01-31' })
    expect(customerFilterTarget({ ...base, clientRef: 'CI1' })).toBe('CI1')
    expect(customerFilterTarget({ ...base, eventsMode: true, clientRef: 'CI1', eventRef: 'CE1' })).toBe('CE1')
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
