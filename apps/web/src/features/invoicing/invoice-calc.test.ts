import { describe, expect, it } from 'vitest'
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

    const rows = invoiceLineRows(invoice, {})
    expect(rows.map((r) => r.ref)).toEqual(['R2', 'R1']) // sorted chronologically

    const r1 = rows.find((r) => r.ref === 'R1')!
    expect(r1.net).toBe(100)
    expect(r1.vat).toBe(10)
    expect(r1.gross).toBe(110)
  })

  it('treats a null priceEur as 0', () => {
    const trip = baseTrip({ ref: 'R1', priceEur: null })
    const invoice = baseInvoice({ trips: [{ invoiceId: 'invoice-1', tripId: 'trip-1', trip }] })
    const [row] = invoiceLineRows(invoice, {})
    expect(row).toMatchObject({ net: 0, vat: 0, gross: 0 })
  })

  it('resolves Category from the vehicleTypeNameById lookup, falling back to a dash', () => {
    const withType = baseTrip({ ref: 'R1', vehicleTypeId: 'type-1' })
    const withoutType = baseTrip({ ref: 'R2', vehicleTypeId: null })
    const invoice = baseInvoice({
      trips: [
        { invoiceId: 'invoice-1', tripId: 'trip-1', trip: withType },
        { invoiceId: 'invoice-1', tripId: 'trip-2', trip: withoutType },
      ],
    })
    const rows = invoiceLineRows(invoice, { 'type-1': 'Business' })
    expect(rows.find((r) => r.ref === 'R1')?.category).toBe('Business')
    expect(rows.find((r) => r.ref === 'R2')?.category).toBe('—')
  })
})
