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
import { applyBookingFilters, defaultBookingFilters } from './booking-filters'
import { Button } from '@/components/ui/button'
import { PageTitle } from '@/components/layout/page-title'
import { filtersChanged } from '@/lib/utils'

export function BookingsPage() {
  useTripEvents()

  const [createOpen, setCreateOpen] = useState(false)
  const [filters, setFilters] = useState(defaultBookingFilters())
  const hasActiveFilters = filtersChanged(filters, defaultBookingFilters())
  const resetFilters = () => setFilters(defaultBookingFilters())
  // period + the live-board window are resolved server-side
  // (TripsService.list()) — the single source of truth for "what's on the
  // board" (was previously duplicated client-side in periodMatches/
  // baseVisibility against a full unbounded fetch, see docs/handoff for the
  // 2026-08-27 session). `board: true` is what drops a past trip that
  // already has a driver, and it belongs to this page alone — the legacy's
  // baseVisibility never applied to Invoicing/Events/Planning.
  const trips = useTripsControllerList({ period: filters.period, board: true })
  const [dispatchTarget, setDispatchTarget] = useState<TripEntity | null>(null)
  const [editTarget, setEditTarget] = useState<TripEntity | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TripEntity | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<TripEntity | null>(null)
  const [nameboardTarget, setNameboardTarget] = useState<TripEntity | null>(null)

  const { localTrips, farmTrips } = useMemo(() => {
    const filtered = applyBookingFilters(trips.data ?? [], filters)
    return {
      localTrips: filtered.filter(isLocalTrip),
      farmTrips: filtered.filter((t) => !isLocalTrip(t)),
    }
  }, [trips.data, filters])

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
