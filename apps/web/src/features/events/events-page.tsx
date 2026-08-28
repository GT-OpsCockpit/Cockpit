import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ClientEntity, TripEntity } from '@cockpit/shared/api'
import { useTripsControllerList } from '@cockpit/shared/api'
import { AdvanceStepConfirmDialog } from '../bookings/advance-step-confirm-dialog'
import { BookingCancelDialog } from '../bookings/booking-cancel-dialog'
import { BookingEditDialog } from '../bookings/booking-edit-dialog'
import { BookingsTable } from '../bookings/bookings-table'
import { DispatchConfirmDialog } from '../bookings/dispatch-confirm-dialog'
import { NameboardUploadDialog } from '../bookings/nameboard-upload-dialog'
import { useTripEvents } from '../bookings/use-trip-events'
import { EventCreateDialog } from './event-create-dialog'
import { EventFiltersBar } from './event-filters-bar'
import { applyEventFilters, defaultEventFilters } from './event-filters'
import { EventSelectPanel } from './event-select-panel'
import { Button } from '@/components/ui/button'
import { PageTitle } from '@/components/layout/page-title'

export function EventsPage() {
  useTripEvents()

  const [confirmedEvent, setConfirmedEvent] = useState<ClientEntity | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [filters, setFilters] = useState(defaultEventFilters())

  // Bounded by the server-side `category` filter (same mechanism Planning's
  // Daily/Event/All toggle uses) — `period: 'all'` because event bookings are
  // spread across an arbitrary date range chosen in the Search block below,
  // not a live rolling window like Bookings.
  const trips = useTripsControllerList({ category: 'event', period: 'all' })
  const [dispatchTarget, setDispatchTarget] = useState<TripEntity | null>(null)
  const [editTarget, setEditTarget] = useState<TripEntity | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TripEntity | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<TripEntity | null>(null)
  const [nameboardTarget, setNameboardTarget] = useState<TripEntity | null>(null)

  const filteredTrips = useMemo(() => applyEventFilters(trips.data ?? [], filters), [trips.data, filters])

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle>Events</PageTitle>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New booking
        </Button>
      </div>

      <EventSelectPanel confirmedEvent={confirmedEvent} onConfirm={setConfirmedEvent} />

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">Search</h2>
        <EventFiltersBar filters={filters} onChange={setFilters} />
      </div>

      <div className="grid gap-2">
        <h2 className="text-lg font-semibold">Ride list</h2>
        <BookingsTable
          trips={filteredTrips}
          variant="local"
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onAdvance={setAdvanceTarget}
          onNameboard={setNameboardTarget}
        />
      </div>

      <EventCreateDialog open={createOpen} onOpenChange={setCreateOpen} confirmedEvent={confirmedEvent} />
      <DispatchConfirmDialog trip={dispatchTarget} onOpenChange={(open) => !open && setDispatchTarget(null)} />
      <BookingEditDialog trip={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <BookingCancelDialog trip={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <AdvanceStepConfirmDialog trip={advanceTarget} onOpenChange={(open) => !open && setAdvanceTarget(null)} />
      <NameboardUploadDialog trip={nameboardTarget} onOpenChange={(open) => !open && setNameboardTarget(null)} />
    </div>
  )
}
