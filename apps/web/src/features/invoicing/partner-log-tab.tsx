import { useState } from 'react'
import type { TripEntity } from '@cockpit/shared/api'
import { useTripsControllerList } from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet } from 'lucide-react'
import { AdvanceStepConfirmDialog } from '../bookings/advance-step-confirm-dialog'
import { BookingCancelDialog } from '../bookings/booking-cancel-dialog'
import { BookingEditDialog } from '../bookings/booking-edit-dialog'
import { BookingsTable } from '../bookings/bookings-table'
import { DispatchConfirmDialog } from '../bookings/dispatch-confirm-dialog'
import { NameboardUploadDialog } from '../bookings/nameboard-upload-dialog'
import { downloadPartnerExcel } from './invoice-excel'
import { PartnerFiltersBar } from './partner-filters-bar'
import { applyPartnerFilters, defaultPartnerFilters, partnerListQuery } from './partner-filters'
import { filtersChanged } from '@/lib/utils'

/**
 * Same search mechanics as Customer, scoped to trip.partner instead of
 * trip.client — no invoicing action for partners in the legacy, only search
 * + export (invoicing.html:694-795). Results reuse the generic Bookings
 * table + its dialogs, same cross-feature reuse precedent as Events/Planning.
 */
export function PartnerLogTab() {
  const [filters, setFilters] = useState(defaultPartnerFilters())
  const hasActiveFilters = filtersChanged(filters, defaultPartnerFilters())
  const resetFilters = () => setFilters(defaultPartnerFilters())
  // The date range and "has a partner" are the server's now — this tab used
  // to fetch every trip ever recorded and throw away all but one month of
  // farmed-out ones.
  const trips = useTripsControllerList(partnerListQuery(filters))

  const [editTarget, setEditTarget] = useState<TripEntity | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TripEntity | null>(null)
  const [dispatchTarget, setDispatchTarget] = useState<TripEntity | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<TripEntity | null>(null)
  const [nameboardTarget, setNameboardTarget] = useState<TripEntity | null>(null)

  const filteredTrips = applyPartnerFilters(trips.data ?? [], filters)
  const targetLabel = filteredTrips[0]?.partner ? (filteredTrips[0].partner.firstName ?? filteredTrips[0].partner.company ?? 'AllPartners') : 'AllPartners'

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">Partner log</h2>
        <PartnerFiltersBar filters={filters} onChange={setFilters} hasActiveFilters={hasActiveFilters} onReset={resetFilters} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{filteredTrips.length ? `${filteredTrips.length} trip(s) matching.` : ''}</span>
          <Button
            variant="outline"
            className="ml-auto"
            disabled={filteredTrips.length === 0}
            onClick={() => void downloadPartnerExcel(filteredTrips, targetLabel, filters.dateStart, filters.dateEnd)}
          >
            <FileSpreadsheet />
            Export to Excel
          </Button>
        </div>
        <h3 className="font-semibold">Results</h3>
        <BookingsTable
          trips={filteredTrips}
          variant="farmout"
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onAdvance={setAdvanceTarget}
          onNameboard={setNameboardTarget}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      </div>

      <DispatchConfirmDialog trip={dispatchTarget} onOpenChange={(open) => !open && setDispatchTarget(null)} />
      <BookingEditDialog trip={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <BookingCancelDialog trip={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <AdvanceStepConfirmDialog trip={advanceTarget} onOpenChange={(open) => !open && setAdvanceTarget(null)} />
      <NameboardUploadDialog trip={nameboardTarget} onOpenChange={(open) => !open && setNameboardTarget(null)} />
    </div>
  )
}
