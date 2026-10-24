import { useState } from 'react'
import type { DriverEntity, DriversControllerListParams } from '@cockpit/shared/api'
import { getDriversControllerListQueryKey, useDriversControllerList, useDriversControllerSetActive } from '@cockpit/shared/api'
import { useRoster } from '@/lib/use-roster'
import { FilterCard } from '@/components/filter-card'
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
import { PartnerCreateDialog } from '@/features/partners/partner-create-dialog'
import { PartnersSection } from '@/features/partners/partners-section'

type DriverExtraParams = Pick<DriversControllerListParams, 'inHouse' | 'partnerId' | 'countryCode' | 'area' | 'category'>

export function DriversPage() {
  const [editTarget, setEditTarget] = useState<DriverEntity | null>(null)
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<DriverEntity | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<DriverEntity | null>(null)
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null)

  const roster = useRoster<DriverFilters, DriverEntity, DriverExtraParams>({
    defaults: defaultDriverFilters,
    useList: useDriversControllerList,
    useSetActive: useDriversControllerSetActive,
    listQueryKey: getDriversControllerListQueryKey(),
    extraParams: (filters) => ({
      inHouse: filters.inHouse === '' ? undefined : filters.inHouse === 'true',
      partnerId: filters.partnerId || undefined,
      countryCode: filters.countryCode || undefined,
      area: filters.area || undefined,
      category: filters.category || undefined,
    }),
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
        <PageTitle />
        <div className="flex items-center gap-2">
          <DriverCreateDialog />
          <PartnerCreateDialog />
        </div>
      </div>

      <FilterCard hasActiveFilters={roster.hasActiveFilters} onReset={roster.resetFilters}>
        <DriverFiltersBar filters={roster.filters} onChange={roster.setFilters} />
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

      <PartnersSection />

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
