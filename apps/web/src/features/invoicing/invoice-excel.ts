import type { InvoiceEntity, TripEntity } from '@cockpit/shared/api'
import {
  clientDisplayName,
  currentStatus,
  driverLabel,
  pickupLocalInstant,
  statusLabel,
} from '../bookings/trip-status'
import { invoiceLineRows, round2 } from './invoice-calc'

/** Strips anything but word chars/dashes so a free-text label is safe as part of a filename. */
function slug(text: string): string {
  return text.replace(/[^\w-]+/g, '_')
}

function sortedByPickup(trips: TripEntity[]): TripEntity[] {
  return trips.slice().sort((a, b) => a.pickupAt.localeCompare(b.pickupAt))
}

/** Generic trip export shared by the Customer tab's Pending export — mirrors tripsToExcelRows (invoicing.html:625-648). */
export function tripsExcelRows(trips: TripEntity[]) {
  return sortedByPickup(trips).map((t) => {
    const local = pickupLocalInstant(t)
    return {
      Ref: t.ref,
      Date: local.toISODate() ?? '',
      Time: local.toFormat('HH:mm'),
      Client: clientDisplayName(t.client),
      Passenger: t.passengerName,
      Pickup: t.pickupLocation,
      Dropoff: t.dropoffLocation ?? '',
      Vehicle: t.vehicleType?.name ?? '',
      'Reg Nbr': t.fleetVehicle?.regNbr ?? '',
      'Driver / Partner': (t.driver && driverLabel(t.driver)) || (t.partner && driverLabel(t.partner)) || '',
      'Sub-C': t.subContractor ? 'Yes' : 'No',
      'Retail net (€)': t.priceEur != null ? Number(t.priceEur) : '',
      Status: statusLabel(currentStatus(t)),
    }
  })
}

/** Partner log export — same shape, Partner + Partner rate instead of the generic Driver/Partner + Sub-C columns (invoicing.html:770-783). */
export function partnerTripsExcelRows(trips: TripEntity[]) {
  return sortedByPickup(trips).map((t) => {
    const local = pickupLocalInstant(t)
    return {
      Ref: t.ref,
      Date: local.toISODate() ?? '',
      Time: local.toFormat('HH:mm'),
      Client: clientDisplayName(t.client),
      Passenger: t.passengerName,
      Pickup: t.pickupLocation,
      Dropoff: t.dropoffLocation ?? '',
      Vehicle: t.vehicleType?.name ?? '',
      'Reg Nbr': t.fleetVehicle?.regNbr ?? '',
      Partner: (t.partner && driverLabel(t.partner)) || '',
      'Partner rate (€)': t.partnerRateEur != null ? Number(t.partnerRateEur) : '',
      Status: statusLabel(currentStatus(t)),
    }
  })
}

/** Invoiced panel's own export — the invoice lines themselves, not the underlying trips (invoicing.html:669-691). */
export function invoicesExcelRows(invoices: InvoiceEntity[]) {
  return invoices
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((inv) => {
      const totalHT = Number(inv.totalHT)
      const totalTTC = Number(inv.totalTTC)
      return {
        'Period start': inv.periodStart?.slice(0, 10) ?? '',
        'Period end': inv.periodEnd?.slice(0, 10) ?? '',
        Customer: clientDisplayName(inv.client),
        'Booking nbr': inv.trips.length,
        'Ref/PO': inv.refPo ?? '',
        Event: inv.isEvent ? 'Yes' : 'No',
        Created: inv.createdAt.slice(0, 10),
        'Total Net (€)': totalHT,
        'VAT (€)': round2(totalTTC - totalHT),
        'Total Gross (€)': totalTTC,
        'Invoice Ref': inv.ref,
      }
    })
}

// `xlsx` is dynamically imported — it's only needed once a user actually
// clicks a download button, not on every page load.
async function downloadRows(rows: Record<string, unknown>[], sheetName: string, filename: string): Promise<void> {
  const { utils, writeFile } = await import('xlsx')
  const ws = utils.json_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, sheetName)
  writeFile(wb, filename)
}

export async function downloadCustomerPendingExcel(trips: TripEntity[], targetLabel: string, dateStart: string, dateEnd: string): Promise<void> {
  if (!trips.length) return
  await downloadRows(
    tripsExcelRows(trips),
    'Trips',
    `Invoicing_Customer_Pending_${slug(targetLabel)}_${dateStart || 'start'}_${dateEnd || 'end'}.xlsx`,
  )
}

export async function downloadInvoicesExcel(invoices: InvoiceEntity[], dateStart: string, dateEnd: string): Promise<void> {
  if (!invoices.length) return
  await downloadRows(invoicesExcelRows(invoices), 'Invoices', `Invoicing_Invoiced_${dateStart || 'start'}_${dateEnd || 'end'}.xlsx`)
}

export async function downloadPartnerExcel(trips: TripEntity[], targetLabel: string, dateStart: string, dateEnd: string): Promise<void> {
  if (!trips.length) return
  await downloadRows(
    partnerTripsExcelRows(trips),
    'Trips',
    `Invoicing_Partner_${slug(targetLabel)}_${dateStart || 'start'}_${dateEnd || 'end'}.xlsx`,
  )
}

/** Per-invoice detail export (📊 in the Invoiced row) — header block + ride details + totals, mirrors downloadInvoiceExcel (invoicing.html:551-594). */
export async function downloadInvoiceDetailExcel(
  invoice: InvoiceEntity,
  vehicleTypeNameById: Record<string, string>,
  /** The client's country spelled out — an invoice address reads "France", not "FR". */
  countryName: string | null,
): Promise<void> {
  const addressLine = [invoice.client.address, [invoice.client.postalCode, invoice.client.city].filter(Boolean).join(' '), countryName ?? invoice.client.countryCode]
    .filter(Boolean)
    .join(', ')
  const rows = invoiceLineRows(invoice, vehicleTypeNameById)
  const totalHT = Number(invoice.totalHT)
  const totalTTC = Number(invoice.totalTTC)
  const totalVat = round2(totalTTC - totalHT)

  const aoa: (string | number)[][] = [
    ['Customer', clientDisplayName(invoice.client)],
    ['Address', addressLine],
    [],
    ['Period', `${invoice.periodStart?.slice(0, 10) ?? ''} to ${invoice.periodEnd?.slice(0, 10) ?? ''}`],
    ['Ref/PO', invoice.refPo ?? ''],
    ...(invoice.isEvent ? [['Event', clientDisplayName(invoice.client)]] : []),
    [],
    ['Ref', 'Date', 'Time', 'Passenger', 'Pickup', 'Dropoff', 'Category', 'Net (€)', 'VAT (€)', 'Gross (€)'],
    ...rows.map((r) => [r.ref, r.date, r.time, r.passenger, r.pickup, r.dropoff, r.category, r.net, r.vat, r.gross]),
    [],
    ['Total Net', '', '', '', '', '', '', totalHT],
    ['VAT', '', '', '', '', '', '', totalVat],
    ['Total Gross', '', '', '', '', '', '', totalTTC],
  ]
  const { utils, writeFile } = await import('xlsx')
  const ws = utils.aoa_to_sheet(aoa)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Invoice')
  writeFile(wb, `Invoice_${invoice.ref}.xlsx`)
}
