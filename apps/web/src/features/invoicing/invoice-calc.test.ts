import { describe, expect, it } from 'vitest'
import { TripEntityService } from '@cockpit/shared/api'
import { baseTrip } from '../bookings/test-fixtures'
import { baseInvoice } from './test-fixtures'
import { invoiceLineRows, round2 } from './invoice-calc'

describe('round2', () => {
  it('rounds to 2 decimals', () => {
    expect(round2(10.005)).toBe(10.01)
    expect(round2(10)).toBe(10)
  })
})

describe('invoiceLineRows', () => {
  it('computes net/vat/gross per trip using the invoice’s own vatRate, sorted by pickup', () => {
    const t1 = baseTrip({ ref: 'R1', priceEur: '100', pickupAt: '2026-06-02T10:00:00.000Z' })
    const t2 = baseTrip({ ref: 'R2', priceEur: '50.5', pickupAt: '2026-06-01T10:00:00.000Z' })
    const invoice = baseInvoice({
      vatRate: '0.10',
      trips: [
        { invoiceId: 'invoice-1', tripId: 'trip-1', trip: t1 },
        { invoiceId: 'invoice-1', tripId: 'trip-2', trip: t2 },
      ],
    })

    const rows = invoiceLineRows(invoice)
    expect(rows.map((r) => r.ref)).toEqual(['R2', 'R1']) // sorted chronologically

    const r1 = rows.find((r) => r.ref === 'R1')!
    // 100 € retail includes the 10% VAT: 90.91 net + 9.09 VAT.
    expect(r1.net).toBe(90.91)
    expect(r1.vat).toBe(9.09)
    expect(r1.gross).toBe(100)
  })

  it('details a transfer at quantity 1 and an ASD at its hourly rate times the hours', () => {
    const transfer = baseTrip({ ref: 'R1', priceEur: '120', service: TripEntityService.TSF })
    const asd = baseTrip({ ref: 'R2', priceEur: '250', hours: 4, service: TripEntityService.ASD })
    const invoice = baseInvoice({
      trips: [
        { invoiceId: 'invoice-1', tripId: 'trip-1', trip: transfer },
        { invoiceId: 'invoice-1', tripId: 'trip-2', trip: asd },
      ],
    })
    const rows = invoiceLineRows(invoice)
    expect(rows.find((r) => r.ref === 'R1')).toMatchObject({ unitPrice: 109.09, quantity: 1, net: 109.09 })
    expect(rows.find((r) => r.ref === 'R2')).toMatchObject({ unitPrice: 227.27, quantity: 4, net: 909.09 })
  })

  it('treats a null priceEur as 0', () => {
    const trip = baseTrip({ ref: 'R1', priceEur: null })
    const invoice = baseInvoice({ trips: [{ invoiceId: 'invoice-1', tripId: 'trip-1', trip }] })
    const [row] = invoiceLineRows(invoice)
    expect(row).toMatchObject({ net: 0, vat: 0, gross: 0 })
  })

  // An invoice is immutable, so it carries the vehicle type it was billed with.
  // Resolving the name against GET /meta instead — which lists active types
  // only — blanked this column on every invoice already issued with a type
  // retired since.
  it('names Category from the type carried on the billed trip, falling back to a dash', () => {
    const withType = baseTrip({
      ref: 'R1',
      vehicleTypeId: 'type-1',
      vehicleType: { id: 'type-1', ref: 'V1', name: 'Business', maxPax: 3, active: false, createdAt: '2026-01-01T00:00:00.000Z' },
    })
    const withoutType = baseTrip({ ref: 'R2', vehicleTypeId: null, vehicleType: null })
    const invoice = baseInvoice({
      trips: [
        { invoiceId: 'invoice-1', tripId: 'trip-1', trip: withType },
        { invoiceId: 'invoice-1', tripId: 'trip-2', trip: withoutType },
      ],
    })
    const rows = invoiceLineRows(invoice)
    expect(rows.find((r) => r.ref === 'R1')?.category).toBe('Business')
    expect(rows.find((r) => r.ref === 'R2')?.category).toBe('—')
  })
})
