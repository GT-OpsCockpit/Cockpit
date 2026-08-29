import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { TripEntity } from '@cockpit/shared/api'
import { useTripsControllerList } from '@cockpit/shared/api'
import { AdvanceStepConfirmDialog } from './advance-step-confirm-dialog'
import { BookingCancelDialog } from './booking-cancel-dialog'
import { BookingCreateDialog } from './booking-create-dialog'
import { BookingEditDialog } from './booking-edit-dialog'
import { BookingFiltersBar } from './booking-filters-bar'
import { BookingsTable } from './bookings-table'
import { DispatchConfirmDialog } from './dispatch-confirm-dialog'
import { NameboardUploadDialog } from './nameboard-upload-dialog'
import { useTripEvents } from './use-trip-events'
import { isLocalTrip } from '@cockpit/shared'
import { bookingListQuery, defaultBookingFilters } from './booking-filters'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { Button } from '@/components/ui/button'
import { PageTitle } from '@/components/layout/page-title'
import { filtersChanged } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 300

export function BookingsPage() {
  useTripEvents()

  const [createOpen, setCreateOpen] = useState(false)
  const [filters, setFilters] = useState(defaultBookingFilters())
  const hasActiveFilters = filtersChanged(filters, defaultBookingFilters())
  const resetFilters = () => setFilters(defaultBookingFilters())
  // The whole filter bar is resolved server-side (TripsService.list()) — the
  // single source of truth for what is on the board. `board: true` is what
  // drops a past trip that already has a driver, and it belongs to this page
  // alone: the legacy's baseVisibility never applied to
  // Invoicing/Events/Planning.
  //
  // The two free-text boxes are debounced so a query goes out once the
  // dispatcher stops typing rather than per keystroke — same delay the
  // request-on-demand pickers use.
  const search = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS)
  const passenger = useDebouncedValue(filters.passenger, SEARCH_DEBOUNCE_MS)
  const trips = useTripsControllerList(bookingListQuery({ ...filters, search, passenger }))
  const [dispatchTarget, setDispatchTarget] = useState<TripEntity | null>(null)
  const [editTarget, setEditTarget] = useState<TripEntity | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TripEntity | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<TripEntity | null>(null)
  const [nameboardTarget, setNameboardTarget] = useState<TripEntity | null>(null)

  // Local / Farm out is a presentation split into two tables, not a narrowing
  // — the only part of the board's view still decided here.
  const { localTrips, farmTrips } = useMemo(() => {
    const rows = trips.data ?? []
    return { localTrips: rows.filter(isLocalTrip), farmTrips: rows.filter((t) => !isLocalTrip(t)) }
  }, [trips.data])

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle>Bookings</PageTitle>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New booking
        </Button>
      </div>

      <div className="grid gap-3">
        <BookingFiltersBar filters={filters} onChange={setFilters} hasActiveFilters={hasActiveFilters} onReset={resetFilters} />
      </div>

      <div className="grid gap-2">
        <h2 className="text-lg font-semibold">Local</h2>
        <BookingsTable
          trips={localTrips}
          variant="local"
          loading={trips.isLoading}
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onAdvance={setAdvanceTarget}
          onNameboard={setNameboardTarget}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      </div>

      <div className="grid gap-2">
        <h2 className="text-lg font-semibold">Farm out</h2>
        <BookingsTable
          trips={farmTrips}
          variant="farmout"
          loading={trips.isLoading}
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onAdvance={setAdvanceTarget}
          onNameboard={setNameboardTarget}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      </div>

      <BookingCreateDialog open={createOpen} onOpenChange={setCreateOpen} draftKey="newBookingDraft" />
      <DispatchConfirmDialog trip={dispatchTarget} onOpenChange={(open) => !open && setDispatchTarget(null)} />
      <BookingEditDialog trip={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <BookingCancelDialog trip={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <AdvanceStepConfirmDialog trip={advanceTarget} onOpenChange={(open) => !open && setAdvanceTarget(null)} />
      <NameboardUploadDialog trip={nameboardTarget} onOpenChange={(open) => !open && setNameboardTarget(null)} />
    </div>
  )
}
