import { useState } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DriverEntity } from '@cockpit/shared/api'
import { getDriversControllerListQueryKey, useDriversControllerList, useDriversControllerSetActive } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { ListPagination } from '@/components/list-pagination'
import { usePermission } from '@/features/auth/use-permission'
import { BookingCreateDialog, type BookingPrefill } from '@/features/bookings/booking-create-dialog'
import { DriverCreateDialog } from './driver-create-dialog'
import { DriverEditDialog } from './driver-edit-dialog'
import { DriverFiltersBar } from './driver-filters-bar'
import { DriversTable } from './drivers-table'
import { DriverUnavailabilityDialog } from './driver-unavailability-dialog'
import { UnlinkVehicleDialog } from './unlink-vehicle-dialog'
import { defaultDriverFilters, driverBookingPrefill, type DriverFilters } from './driver-status'
import { PageTitle } from '@/components/layout/page-title'
import { filtersChanged } from '@/lib/utils'

const PAGE_SIZE = 20

export function DriversPage() {
  const [filters, setFilters] = useState(defaultDriverFilters())
  const hasActiveFilters = filtersChanged(filters, defaultDriverFilters())
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState<DriverEntity | null>(null)
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<DriverEntity | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<DriverEntity | null>(null)
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null)

  // Debounced so typing doesn't fire a request per keystroke — search/showInactive
  // are resolved server-side (DriversService.list()), not filtered in the browser.
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const drivers = useDriversControllerList(
    {
      search: debouncedSearch || undefined,
      includeInactive: filters.showInactive || undefined,
      page,
      limit: PAGE_SIZE,
    },
    { query: { placeholderData: keepPreviousData } },
  )

  const setActive = useDriversControllerSetActive()

  // UX-layer mirror of the server-side gate (DriversService.setActive,
  // driver:reactivate — see docs/agents/permissions.md). Deactivating stays
  // ungated; only the false→true transition needs this.
  const canReactivate = usePermission('driver:reactivate')

  const handleFiltersChange = (next: DriverFilters) => {
    setFilters(next)
    setPage(1)
  }

  const resetFilters = () => handleFiltersChange(defaultDriverFilters())

  const handleToggleActive = async (driver: DriverEntity) => {
    try {
      await setActive.mutateAsync({ ref: driver.ref, data: { active: !driver.active } })
      toast.success(`Driver ${driver.ref} ${driver.active ? 'deactivated' : 'reactivated'}.`)
      void queryClient.invalidateQueries({ queryKey: getDriversControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating driver status.'))
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle>Drivers</PageTitle>
        <DriverCreateDialog />
      </div>

      <DriverFiltersBar filters={filters} onChange={handleFiltersChange} hasActiveFilters={hasActiveFilters} onReset={resetFilters} />

      <DriversTable
        drivers={drivers.data?.data ?? []}
        loading={drivers.isLoading}
        onEdit={setEditTarget}
        onUnavailability={setUnavailabilityTarget}
        onToggleActive={(d) => void handleToggleActive(d)}
        onUnlinkVehicle={setUnlinkTarget}
        onNewBooking={(d) => setBookingPrefill(driverBookingPrefill(d))}
        canReactivate={canReactivate}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
      />

      <ListPagination page={page} limit={PAGE_SIZE} total={drivers.data?.total ?? 0} onPageChange={setPage} />

      <DriverEditDialog driver={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <DriverUnavailabilityDialog driver={unavailabilityTarget} onOpenChange={(open) => !open && setUnavailabilityTarget(null)} />
      <UnlinkVehicleDialog driver={unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)} />
      <BookingCreateDialog
        open={bookingPrefill !== null}
        onOpenChange={(open) => !open && setBookingPrefill(null)}
        draftKey="newBookingDraft:drivers"
        prefill={bookingPrefill ?? undefined}
      />
    </div>
  )
}
