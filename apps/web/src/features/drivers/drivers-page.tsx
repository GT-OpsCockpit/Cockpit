import { useState } from 'react'
import type { DriverEntity } from '@cockpit/shared/api'
import { getDriversControllerListQueryKey, useDriversControllerList, useDriversControllerSetActive } from '@cockpit/shared/api'
import { useRoster } from '@/lib/use-roster'
import { FilterCard } from '@/components/filter-card'
import { ListPagination } from '@/components/list-pagination'
import { SearchAndInactiveFiltersBar } from '@/components/search-and-inactive-filters-bar'
import { usePermission } from '@/features/auth/use-permission'
import { BookingCreateDialog, type BookingPrefill } from '@/features/bookings/booking-create-dialog'
import { DriverCreateDialog } from './driver-create-dialog'
import { DriverEditDialog } from './driver-edit-dialog'
import { DriversTable } from './drivers-table'
import { DriverUnavailabilityDialog } from './driver-unavailability-dialog'
import { UnlinkVehicleDialog } from './unlink-vehicle-dialog'
import { defaultDriverFilters, driverBookingPrefill, type DriverFilters } from './driver-status'
import { PageTitle } from '@/components/layout/page-title'

export function DriversPage() {
  const [editTarget, setEditTarget] = useState<DriverEntity | null>(null)
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<DriverEntity | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<DriverEntity | null>(null)
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null)

  const roster = useRoster<DriverFilters, DriverEntity>({
    defaults: defaultDriverFilters,
    useList: useDriversControllerList,
    useSetActive: useDriversControllerSetActive,
    listQueryKey: getDriversControllerListQueryKey(),
    label: 'Driver',
    errorLabel: 'driver',
  })

  // UX-layer mirror of the server-side gate (DriversService.setActive,
  // driver:reactivate — see docs/agents/permissions.md). Deactivating stays
  // ungated; only the false→true transition needs this.
  const canReactivate = usePermission('driver:reactivate')

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle>Drivers</PageTitle>
        <DriverCreateDialog />
      </div>

      <FilterCard hasActiveFilters={roster.hasActiveFilters} onReset={roster.resetFilters}>
        <SearchAndInactiveFiltersBar
          filters={roster.filters}
          onChange={roster.setFilters}
          idPrefix="dr"
          searchPlaceholder="Search by ref, name, company, email or phone…"
        />
      </FilterCard>

      <DriversTable
        drivers={roster.rows}
        loading={roster.loading}
        onEdit={setEditTarget}
        onUnavailability={setUnavailabilityTarget}
        onToggleActive={roster.toggleActive}
        onUnlinkVehicle={setUnlinkTarget}
        onNewBooking={(d) => setBookingPrefill(driverBookingPrefill(d))}
        canReactivate={canReactivate}
        hasActiveFilters={roster.hasActiveFilters}
        onResetFilters={roster.resetFilters}
      />

      <ListPagination page={roster.page} limit={roster.pageSize} total={roster.total} onPageChange={roster.setPage} />

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
