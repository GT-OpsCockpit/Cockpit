import type { InvoiceEntity } from '@cockpit/shared/api'
import { baseClient, baseTrip } from '../bookings/test-fixtures'

/** Shared builder for Invoicing tests. */
export function baseInvoice(overrides: Partial<InvoiceEntity> = {}): InvoiceEntity {
  return {
    id: 'invoice-1',
    ref: 'INV1',
    clientId: 'client-1',
    client: baseClient(),
    isEvent: false,
    refPo: null,
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-06-30T00:00:00.000Z',
    totalHT: '150.50',
    vatRate: '0.10',
    totalTTC: '165.55',
    createdAt: '2026-07-01T09:00:00.000Z',
    trips: [{ invoiceId: 'invoice-1', tripId: 'trip-1', trip: baseTrip() }],
    ...overrides,
  }
}
