import { useMemo, useState } from 'react'
import type { TripEntity } from '@cockpit/shared/api'
import { useTripsControllerList } from '@cockpit/shared/api'
import { AdvanceStepConfirmDialog } from './advance-step-confirm-dialog'
import { BookingCancelDialog } from './booking-cancel-dialog'
import { BookingCreationBar } from './booking-creation-bar'
import { BookingEditDialog } from './booking-edit-dialog'
import { BookingFiltersBar } from './booking-filters-bar'
import { BookingsTable } from './bookings-table'
import { DispatchConfirmDialog } from './dispatch-confirm-dialog'
import { NameboardUploadDialog } from './nameboard-upload-dialog'
import { useTripEvents } from './use-trip-events'
import { applyBookingFilters, defaultBookingFilters, isLocalTrip } from './trip-status'

export function BookingsPage() {
  useTripEvents()

  const [filters, setFilters] = useState(defaultBookingFilters())
  // period is resolved server-side (TripsService.list()) — the single
  // source of truth for "what's on the board" (was previously duplicated
  // client-side in periodMatches/baseVisibility against a full unbounded
  // fetch, see docs/handoff for the 2026-08-27 session).
  const trips = useTripsControllerList({ period: filters.period })
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
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <BookingCreationBar />

      <div className="grid gap-3">
        <BookingFiltersBar filters={filters} onChange={setFilters} />
      </div>

      <div className="grid gap-2">
        <h2 className="text-lg font-semibold">Local</h2>
        <BookingsTable
          trips={localTrips}
          variant="local"
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onAdvance={setAdvanceTarget}
          onNameboard={setNameboardTarget}
        />
      </div>

      <div className="grid gap-2">
        <h2 className="text-lg font-semibold">Farm out</h2>
        <BookingsTable
          trips={farmTrips}
          variant="farmout"
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onAdvance={setAdvanceTarget}
          onNameboard={setNameboardTarget}
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
