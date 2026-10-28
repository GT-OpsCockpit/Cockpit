import { asdTotal, billedAmount } from '@cockpit/shared'
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
  /** Price of one unit: the hourly rate for an ASD, the flat price otherwise. */
  unitPrice: number
  /** Hours for an ASD, 1 for a transfer. */
  quantity: number
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
      const rate = trip.priceEur != null ? Number(trip.priceEur) : null
      const net = round2(billedAmount({ rate, hours: trip.hours, service: trip.service }) ?? 0)
      const unitPrice = round2(rate ?? 0)
      // An ASD without hours is billed at its bare rate, so its quantity is 1 too.
      const quantity = asdTotal({ rate, hours: trip.hours, service: trip.service }) != null ? Number(trip.hours) : 1
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
        unitPrice,
        quantity,
        net,
        vat,
        gross,
      }
    })
}
