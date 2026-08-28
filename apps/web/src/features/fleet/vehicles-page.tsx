import { useState } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FleetVehicleEntity } from '@cockpit/shared/api'
import {
  getFleetVehiclesControllerListQueryKey,
  useFleetVehiclesControllerList,
  useFleetVehiclesControllerSetActive,
  useMetaControllerGetMeta,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { ListPagination } from '@/components/list-pagination'
import { usePermission } from '@/features/auth/use-permission'
import { BookingCreateDialog, type BookingPrefill } from '@/features/bookings/booking-create-dialog'
import { VehicleCreateDialog } from './vehicle-create-dialog'
import { VehicleEditDialog } from './vehicle-edit-dialog'
import { VehicleFiltersBar } from './vehicle-filters-bar'
import { VehiclesTable } from './vehicles-table'
import { VehicleUnavailabilityDialog } from './vehicle-unavailability-dialog'
import { defaultVehicleFilters, vehicleBookingPrefill, type VehicleFilters } from './vehicle-status'
import { PageTitle } from '@/components/layout/page-title'
import { filtersChanged } from '@/lib/utils'

const PAGE_SIZE = 20

export function VehiclesPage() {
  const [filters, setFilters] = useState(defaultVehicleFilters())
  const hasActiveFilters = filtersChanged(filters, defaultVehicleFilters())
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState<FleetVehicleEntity | null>(null)
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<FleetVehicleEntity | null>(null)
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null)

  // Debounced so typing doesn't fire a request per keystroke — search/showInactive
  // are resolved server-side (FleetVehiclesService.list()), not filtered in the browser.
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const vehicles = useFleetVehiclesControllerList(
    {
      search: debouncedSearch || undefined,
      includeInactive: filters.showInactive || undefined,
      page,
      limit: PAGE_SIZE,
    },
    { query: { placeholderData: keepPreviousData } },
  )

  const meta = useMetaControllerGetMeta()
  const setActive = useFleetVehiclesControllerSetActive()

  // UX-layer mirror of the server-side gate (FleetVehiclesService.setActive,
  // vehicle:reactivate — see docs/agents/permissions.md). Deactivating stays
  // ungated; only the false→true transition needs this.
  const canReactivate = usePermission('vehicle:reactivate')

  const handleFiltersChange = (next: VehicleFilters) => {
    setFilters(next)
    setPage(1)
  }

  const resetFilters = () => handleFiltersChange(defaultVehicleFilters())

  const handleToggleActive = async (vehicle: FleetVehicleEntity) => {
    try {
      await setActive.mutateAsync({ ref: vehicle.ref, data: { active: !vehicle.active } })
      toast.success(`Vehicle ${vehicle.ref} ${vehicle.active ? 'deactivated' : 'reactivated'}.`)
      void queryClient.invalidateQueries({ queryKey: getFleetVehiclesControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating vehicle status.'))
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle>Vehicles</PageTitle>
        <VehicleCreateDialog />
      </div>

      <VehicleFiltersBar filters={filters} onChange={handleFiltersChange} hasActiveFilters={hasActiveFilters} onReset={resetFilters} />

      <VehiclesTable
        vehicles={vehicles.data?.data ?? []}
        loading={vehicles.isLoading}
        onEdit={setEditTarget}
        onUnavailability={setUnavailabilityTarget}
        onToggleActive={(v) => void handleToggleActive(v)}
        onNewBooking={(v) => setBookingPrefill(vehicleBookingPrefill(v))}
        canReactivate={canReactivate}
        fleetColors={meta.data?.fleetColors}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
      />

      <ListPagination page={page} limit={PAGE_SIZE} total={vehicles.data?.total ?? 0} onPageChange={setPage} />

      <VehicleEditDialog vehicle={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <VehicleUnavailabilityDialog vehicle={unavailabilityTarget} onOpenChange={(open) => !open && setUnavailabilityTarget(null)} />
      <BookingCreateDialog
        open={bookingPrefill !== null}
        onOpenChange={(open) => !open && setBookingPrefill(null)}
        draftKey="newBookingDraft:vehicles"
        prefill={bookingPrefill ?? undefined}
      />
    </div>
  )
}
