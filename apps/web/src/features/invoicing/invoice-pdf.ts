import type { InvoiceEntity } from '@cockpit/shared/api'
import { clientDisplayName } from '../bookings/trip-status'
import { invoiceLineRows, round2 } from './invoice-calc'

/**
 * Client-side PDF generation (no server dependency, same as the legacy's
 * downloadInvoicePdf, invoicing.html:483-547). Layout: customer name +
 * address top-left, Period/Ref-PO/Event top-right, ride detail table, totals.
 *
 * jspdf/jspdf-autotable are dynamically imported — they (plus their shared
 * html2canvas/purify chunk) are only needed once a user actually clicks a
 * download button, not on every page load.
 */
export async function downloadInvoicePdf(
  invoice: InvoiceEntity,
  vehicleTypeNameById: Record<string, string>,
  /** The client's country spelled out — an invoice address reads "France", not "FR". */
  countryName: string | null,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF()
  const rightX = doc.internal.pageSize.getWidth() - 14

  let leftY = 18
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(clientDisplayName(invoice.client), 14, leftY)
  leftY += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const addressLines = [
    invoice.client.address,
    [invoice.client.postalCode, invoice.client.city].filter(Boolean).join(' '),
    countryName ?? invoice.client.countryCode,
  ].filter((line): line is string => !!line)
  for (const line of addressLines) {
    doc.text(line, 14, leftY)
    leftY += 5
  }

  let rightY = 18
  doc.setFontSize(10)
  doc.text(`Period: ${invoice.periodStart?.slice(0, 10) ?? '…'} to ${invoice.periodEnd?.slice(0, 10) ?? '…'}`, rightX, rightY, {
    align: 'right',
  })
  rightY += 5
  if (invoice.refPo) {
    doc.text(`Ref/PO: ${invoice.refPo}`, rightX, rightY, { align: 'right' })
    rightY += 5
  }
  if (invoice.isEvent) {
    doc.text(`Event: ${clientDisplayName(invoice.client)}`, rightX, rightY, { align: 'right' })
    rightY += 5
  }

  let y = Math.max(leftY, rightY) + 8
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Invoice ${invoice.ref}`, 14, y)
  y += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Invoice date: ${invoice.createdAt.slice(0, 10)}`, 14, y)

  const rows = invoiceLineRows(invoice, vehicleTypeNameById)
  autoTable(doc, {
    startY: y + 5,
    head: [['Date', 'Passenger', 'Itinerary', 'Category', 'Net €', 'VAT €', 'Gross €']],
    body: rows.map((r) => [r.date, r.passenger, `${r.pickup} -> ${r.dropoff}`, r.category, r.net.toFixed(2), r.vat.toFixed(2), r.gross.toFixed(2)]),
    styles: { fontSize: 8.5 },
    margin: { left: 14, right: 14 },
  })

  const totalHT = Number(invoice.totalHT)
  const totalTTC = Number(invoice.totalTTC)
  const totalVat = round2(totalTTC - totalHT)
  // jspdf-autotable@5 sets this on the doc instance at runtime (see its
  // jsPDF.API.lastAutoTable default) but doesn't type it on the jsPDF class.
  const lastAutoTable = (doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }).lastAutoTable
  const finalY = (lastAutoTable?.finalY ?? y + 10) + 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Net: ${totalHT.toFixed(2)} €`, 140, finalY)
  doc.text(`VAT: ${totalVat.toFixed(2)} €`, 140, finalY + 6)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Gross: ${totalTTC.toFixed(2)} €`, 140, finalY + 12)

  doc.save(`Invoice_${invoice.ref}.pdf`)
}
