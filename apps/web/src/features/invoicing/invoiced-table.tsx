import { Check, FileDown, FileSpreadsheet, PenSquare, ReceiptText, Send } from 'lucide-react'
import type { InvoiceEntity } from '@cockpit/shared/api'
import { useMetaControllerGetMeta } from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/features/auth/use-permission'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { EmptyState } from '@/components/empty-state'
import { clientDisplayName } from '@cockpit/shared'
import { downloadInvoiceDetailExcel } from './invoice-excel'
import { downloadInvoicePdf } from './invoice-pdf'
import { buildInvoiceMailto } from './invoice-send'

/**
 * One row per invoice (not per trip) — mirrors the legacy's
 * renderInvoicesTable/buildInvoiceRowHtml (invoicing.html:422-459).
 */
export function InvoicedTable({
  invoices,
  onCorrect,
  hasActiveFilters,
  onResetFilters,
}: {
  invoices: InvoiceEntity[]
  onCorrect: (invoice: InvoiceEntity) => void
  hasActiveFilters?: boolean
  onResetFilters?: () => void
}) {
  const meta = useMetaControllerGetMeta()
  const countryNameByCode = Object.fromEntries((meta.data?.countries ?? []).map((c) => [c.code, c.name]))

  const sorted = invoices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Taking an invoice back is an admin action (the API checks it, and asks for the password).
  const canCorrect = usePermission('invoice:correct')

  const sendInvoice = (invoice: InvoiceEntity) => {
    window.location.href = buildInvoiceMailto(invoice)
  }

  return (
    <TableCard>
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[12%]" />
          <col className="w-[20%]" />
          <col className="w-[13%]" />
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
        </colgroup>
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
              <TableCell colSpan={8} className="p-0 whitespace-normal">
                <EmptyState
                  icon={ReceiptText}
                  title="No invoices to display for this period"
                  description="Invoices created for this period will appear here."
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={onResetFilters}
                />
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
                  <TableCell className="text-center text-xs">
                    {invoice.isEvent ? <Check className="mx-auto size-3.5" aria-label="Event" /> : '–'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{invoice.createdAt.slice(0, 10)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div>{Number(invoice.totalTTC).toFixed(2)} € TTC</div>
                    <div className="text-muted-foreground text-[10px]">{Number(invoice.totalHT).toFixed(2)} € HT</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Download PDF" onClick={() => void downloadInvoicePdf(invoice, countryNameByCode[invoice.client.countryCode ?? ''] ?? null)}>
                        <FileDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Download Excel"
                        onClick={() => void downloadInvoiceDetailExcel(invoice, countryNameByCode[invoice.client.countryCode ?? ''] ?? null)}
                      >
                        <FileSpreadsheet className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Send" onClick={() => sendInvoice(invoice)}>
                        <Send className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={canCorrect ? 'Correct' : 'Only an admin can correct an invoice'}
                        disabled={!canCorrect}
                        onClick={() => onCorrect(invoice)}
                      >
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
    </TableCard>
  )
}
