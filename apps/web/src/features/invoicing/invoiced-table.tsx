import { FileDown, FileSpreadsheet, PenSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { InvoiceEntity } from '@cockpit/shared/api'
import { useMetaControllerGetMeta } from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { clientDisplayName } from '../bookings/trip-status'
import { downloadInvoiceDetailExcel } from './invoice-excel'
import { downloadInvoicePdf } from './invoice-pdf'
import { buildInvoiceMailto } from './invoice-send'

/**
 * One row per invoice (not per trip) — mirrors the legacy's
 * renderInvoicesTable/buildInvoiceRowHtml (invoicing.html:422-459).
 */
export function InvoicedTable({ invoices }: { invoices: InvoiceEntity[] }) {
  const meta = useMetaControllerGetMeta()
  // The invoice's nested trips are the lean TripBaseEntity (no joined vehicleType) — resolve the
  // "Category" column's display name from meta instead (see invoice-calc.ts's invoiceLineRows).
  const vehicleTypeNameById = Object.fromEntries((meta.data?.vehicleTypes ?? []).map((v) => [v.id, v.name]))

  const sorted = invoices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // "Correct" is gated behind the Manager password in legacy, but the workflow
  // behind it was never defined there either (docs/agents/permissions.md:103
  // — nothing to port) — replicated as the same no-op stub, without a fake
  // password prompt that would imply a security check that doesn't exist.
  const correctInvoice = (invoice: InvoiceEntity) =>
    toast.info(`Invoice ${invoice.ref}: the correction workflow is not defined yet.`)

  const sendInvoice = (invoice: InvoiceEntity) => {
    window.location.href = buildInvoiceMailto(invoice)
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Booking nbr</TableHead>
            <TableHead>Ref/PO</TableHead>
            <TableHead className="text-center">Event</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground text-center">
                No invoices to display for this period.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((invoice) => {
              const period =
                invoice.periodStart || invoice.periodEnd
                  ? `${invoice.periodStart?.slice(0, 10) ?? '…'} → ${invoice.periodEnd?.slice(0, 10) ?? '…'}`
                  : '–'
              const refs = invoice.trips.map((t) => t.trip.ref).join(', ')
              return (
                <TableRow key={invoice.ref}>
                  <TableCell className="text-xs whitespace-nowrap">{period}</TableCell>
                  <TableCell className="text-xs">{clientDisplayName(invoice.client)}</TableCell>
                  <TableCell className="text-xs" title={refs}>
                    {invoice.trips.length}
                  </TableCell>
                  <TableCell className="text-xs">{invoice.refPo || '–'}</TableCell>
                  <TableCell className="text-center text-xs">{invoice.isEvent ? '✅' : '–'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{invoice.createdAt.slice(0, 10)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div>{Number(invoice.totalTTC).toFixed(2)} € TTC</div>
                    <div className="text-muted-foreground text-[10px]">{Number(invoice.totalHT).toFixed(2)} € HT</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Download PDF" onClick={() => void downloadInvoicePdf(invoice, vehicleTypeNameById)}>
                        <FileDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Download Excel"
                        onClick={() => void downloadInvoiceDetailExcel(invoice, vehicleTypeNameById)}
                      >
                        <FileSpreadsheet className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Send" onClick={() => sendInvoice(invoice)}>
                        <Send className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Correct" onClick={() => correctInvoice(invoice)}>
                        <PenSquare className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
