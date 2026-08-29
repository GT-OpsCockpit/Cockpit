import { useEffect, useState } from 'react'
import type { TripEntity } from '@cockpit/shared/api'
import {
  useInvoicesControllerDefaultPeriod,
  useInvoicesControllerList,
  useTripsControllerList,
} from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, ReceiptText } from 'lucide-react'
import { AdvanceStepConfirmDialog } from '../bookings/advance-step-confirm-dialog'
import { BookingCancelDialog } from '../bookings/booking-cancel-dialog'
import { BookingEditDialog } from '../bookings/booking-edit-dialog'
import { DispatchConfirmDialog } from '../bookings/dispatch-confirm-dialog'
import { clientDisplayName } from '@cockpit/shared'
import { CustomerFiltersBar } from './customer-filters-bar'
import {
  applyInvoiceFilters,
  applyPendingFilters,
  customerFilterTarget,
  customerListQuery,
  defaultCustomerFilters,
} from './customer-filters'
import { downloadCustomerPendingExcel, downloadInvoicesExcel } from './invoice-excel'
import { InvoiceCreateDialog } from './invoice-create-dialog'
import { InvoicedTable } from './invoiced-table'
import { PendingTripsTable } from './pending-trips-table'
import { filtersChanged } from '@/lib/utils'

export function CustomerTab() {
  const [filters, setFilters] = useState(() => defaultCustomerFilters({ start: '', end: '' }))
  // State rather than a ref, because the trips query below waits on it: the
  // first fetch has to carry the period, not go out unbounded and be corrected.
  const [datesInitialized, setDatesInitialized] = useState(false)

  // The opening period is the API's (invoicingDefaultPeriod) — working it out
  // in the browser is what made this tab download every trip ever recorded,
  // when all it needed was the oldest unbilled one.
  const defaultPeriod = useInvoicesControllerDefaultPeriod()
  const invoices = useInvoicesControllerList()

  const trips = useTripsControllerList(customerListQuery(filters), {
    query: { enabled: datesInitialized },
  })

  // "Reset" returns to the current default period, not to blank dates.
  const defaultFilters = defaultCustomerFilters(defaultPeriod.data ?? { start: '', end: '' })
  const hasActiveFilters = filtersChanged(filters, defaultFilters)
  const resetFilters = () => setFilters(defaultFilters)

  // Applied once, not on every refetch — matches the legacy's
  // custDatesInitialized flag (invoicing.html:234) so the dispatcher's own date
  // edits aren't fought on a background refresh.
  useEffect(() => {
    if (datesInitialized || !defaultPeriod.data) return
    setFilters((f) => ({ ...f, dateStart: defaultPeriod.data.start, dateEnd: defaultPeriod.data.end }))
    setDatesInitialized(true)
  }, [defaultPeriod.data, datesInitialized])

  const [editTarget, setEditTarget] = useState<TripEntity | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TripEntity | null>(null)
  const [dispatchTarget, setDispatchTarget] = useState<TripEntity | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<TripEntity | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const pendingTrips = applyPendingFilters(trips.data ?? [], filters)
  const filteredInvoices = applyInvoiceFilters(invoices.data ?? [], filters)

  const target = customerFilterTarget(filters)
  const canInvoice = pendingTrips.length > 0 && !!target
  const targetLabel = target && pendingTrips[0] ? clientDisplayName(pendingTrips[0].client) : 'AllClients'

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">Customer</h2>
        <CustomerFiltersBar filters={filters} onChange={setFilters} hasActiveFilters={hasActiveFilters} onReset={resetFilters} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Pending</h3>
          <span className="text-muted-foreground text-sm">{pendingTrips.length ? `${pendingTrips.length} trip(s) matching.` : ''}</span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              disabled={pendingTrips.length === 0}
              onClick={() => void downloadCustomerPendingExcel(pendingTrips, targetLabel, filters.dateStart, filters.dateEnd)}
            >
              <FileSpreadsheet />
              Export to Excel
            </Button>
            <Button
              disabled={!canInvoice}
              title={canInvoice ? undefined : 'Turn the trips currently shown here into one invoice line (requires a specific Client or Event selected above)'}
              onClick={() => setConfirmOpen(true)}
            >
              <ReceiptText />
              Invoice
            </Button>
          </div>
        </div>
        <PendingTripsTable
          trips={pendingTrips}
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onAdvance={setAdvanceTarget}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Invoiced</h3>
          <span className="text-muted-foreground text-sm">
            {filteredInvoices.length ? `${filteredInvoices.length} invoice(s) matching.` : ''}
          </span>
          <Button
            variant="outline"
            className="ml-auto"
            disabled={filteredInvoices.length === 0}
            onClick={() => void downloadInvoicesExcel(filteredInvoices, filters.dateStart, filters.dateEnd)}
          >
            <FileSpreadsheet />
            Export to Excel
          </Button>
        </div>
        <InvoicedTable invoices={filteredInvoices} hasActiveFilters={hasActiveFilters} onResetFilters={resetFilters} />
      </div>

      <InvoiceCreateDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pendingTrips={pendingTrips}
        clientRef={filters.eventsMode ? '' : filters.clientRef}
        eventRef={filters.eventsMode ? filters.eventRef : ''}
        periodStart={filters.dateStart}
        periodEnd={filters.dateEnd}
      />
      <BookingEditDialog trip={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <BookingCancelDialog trip={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <DispatchConfirmDialog trip={dispatchTarget} onOpenChange={(open) => !open && setDispatchTarget(null)} />
      <AdvanceStepConfirmDialog trip={advanceTarget} onOpenChange={(open) => !open && setAdvanceTarget(null)} />
    </div>
  )
}
