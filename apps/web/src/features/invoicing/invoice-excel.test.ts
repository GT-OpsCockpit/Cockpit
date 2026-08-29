import { describe, expect, it } from 'vitest'
import { baseClient, baseDriver, baseTrip } from '../bookings/test-fixtures'
import { baseInvoice } from './test-fixtures'
import { invoicesExcelRows, partnerTripsExcelRows, tripsExcelRows } from './invoice-excel'

// These files go to the customer and to partners. On screen a booking with no
// step yet reads "Send ?" — a prompt to the dispatcher, not a state — and the
// legacy left the cell empty in the export (invoicing.html:646).
describe('the exported Status column', () => {
  it('leaves a not-yet-started booking blank rather than exporting "Send ?"', () => {
    expect(tripsExcelRows([baseTrip({ steps: [] })])[0].Status).toBe('')
    expect(partnerTripsExcelRows([baseTrip({ steps: [] })])[0].Status).toBe('')
  })

  it('exports the step a booking has reached', () => {
    const trip = baseTrip({ steps: [{ id: 's1', tripId: 'trip-1', step: 'TRANSMITTED', occurredAt: '2026-01-01T00:00:00.000Z' }] })
    expect(tripsExcelRows([trip])[0].Status).toBe('Sent')
  })
})

describe('tripsExcelRows', () => {
  it('shapes one row per trip, sorted chronologically, with Driver/Partner combined', () => {
    const t1 = baseTrip({ ref: 'R1', pickupAt: '2026-06-02T10:00:00.000Z', driver: baseDriver({ firstName: 'Jean', lastName: 'D.' }), partner: null })
    const t2 = baseTrip({
      ref: 'R2',
      pickupAt: '2026-06-01T10:00:00.000Z',
      driver: null,
      partner: baseDriver({ firstName: null, lastName: null, company: 'Acme' }),
    })

    const rows = tripsExcelRows([t1, t2])
    expect(rows.map((r) => r.Ref)).toEqual(['R2', 'R1'])
    expect(rows[1]['Driver / Partner']).toContain('Jean')
    expect(rows[0]['Driver / Partner']).toContain('Acme')
  })

  it('shows the client display name, not a raw entity dump', () => {
    const trip = baseTrip({ client: baseClient({ company: 'Acme Corp' }) })
    expect(tripsExcelRows([trip])[0].Client).toBe('Acme Corp')
  })
})

describe('partnerTripsExcelRows', () => {
  it('surfaces the Partner name and rate instead of the generic Driver/Partner + Sub-C columns', () => {
    const trip = baseTrip({ partner: baseDriver({ firstName: null, lastName: null, company: 'Acme' }), partnerRateEur: '42.50' })
    const [row] = partnerTripsExcelRows([trip])
    expect(row.Partner).toContain('Acme')
    expect(row['Partner rate (€)']).toBe(42.5)
  })
})

describe('invoicesExcelRows', () => {
  it('one row per invoice, most recent first, with VAT derived from totals', () => {
    const older = baseInvoice({ ref: 'INV1', createdAt: '2026-01-01T00:00:00.000Z', totalHT: '100', totalTTC: '110' })
    const newer = baseInvoice({ ref: 'INV2', createdAt: '2026-02-01T00:00:00.000Z', totalHT: '200', totalTTC: '220' })
    const rows = invoicesExcelRows([older, newer])
    expect(rows.map((r) => r['Invoice Ref'])).toEqual(['INV2', 'INV1'])
    expect(rows[0]['VAT (€)']).toBe(20)
  })
})
