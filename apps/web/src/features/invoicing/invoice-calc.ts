import type { InvoiceEntity } from '@cockpit/shared/api'
import { pickupLocalInstant } from '../bookings/trip-display'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface InvoiceLineRow {
  ref: string
  date: string
  time: string
  passenger: string
  pickup: string
  dropoff: string
  category: string
  net: number
  vat: number
  gross: number
}

/**
 * Per-line Net/VAT/Gross for the PDF/Excel detail table — distinct from the
 * invoice-level totalHT/totalTTC already on the record. VAT uses the
 * invoice's own persisted `vatRate` rather than a hardcoded 10% (the legacy
 * hardcoded 0.1 client-side too, but the backend already generalized this —
 * see InvoicesService.create). Mirrors invoiceDetailRows (invoicing.html:465-479).
 *
 * The "Category" column reads the vehicle type carried on the billed trip.
 * It used to be resolved against the caller's GET /meta, which lists *active*
 * types only — so retiring a type blanked that column on every invoice already
 * issued with it. An invoice is immutable; it names what it was billed with.
 */
export function invoiceLineRows(invoice: InvoiceEntity): InvoiceLineRow[] {
  const vatRate = Number(invoice.vatRate)

  return invoice.trips
    .map(({ trip }) => trip)
    .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt))
    .map((trip) => {
      const net = round2(trip.priceEur != null ? Number(trip.priceEur) : 0)
      const vat = round2(net * vatRate)
      const gross = round2(net + vat)
      const local = pickupLocalInstant(trip)
      return {
        ref: trip.ref,
        date: local.toISODate() ?? '',
        time: local.toFormat('HH:mm'),
        passenger: trip.passengerName,
        pickup: trip.pickupLocation,
        dropoff: trip.dropoffLocation ?? '',
        category: trip.vehicleType?.name || '—',
        net,
        vat,
        gross,
      }
    })
}
