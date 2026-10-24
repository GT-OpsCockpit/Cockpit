import { useState } from 'react'
import type { FleetVehicleEntity, FleetVehiclesControllerListParams } from '@cockpit/shared/api'
import {
  getFleetVehiclesControllerListQueryKey,
  useFleetVehiclesControllerList,
  useFleetVehiclesControllerSetActive,
  useMetaControllerGetMeta,
} from '@cockpit/shared/api'
import { useRoster } from '@/lib/use-roster'
import { FilterCard } from '@/components/filter-card'
import { ListPagination } from '@/components/list-pagination'
import { usePermission } from '@/features/auth/use-permission'
import { VehicleCreateDialog } from './vehicle-create-dialog'
import { VehicleEditDialog } from './vehicle-edit-dialog'
import { VehicleFiltersBar } from './vehicle-filters-bar'
import { VehiclesTable } from './vehicles-table'
import { VehicleUnavailabilityDialog } from './vehicle-unavailability-dialog'
import { defaultVehicleFilters, type VehicleFilters } from './vehicle-status'
import { PageTitle } from '@/components/layout/page-title'

type VehicleExtraParams = Pick<FleetVehiclesControllerListParams, 'isLocal' | 'partnerId' | 'countryCode' | 'area' | 'model'>

export function VehiclesPage() {
  const [editTarget, setEditTarget] = useState<FleetVehicleEntity | null>(null)
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<FleetVehicleEntity | null>(null)

  const roster = useRoster<VehicleFilters, FleetVehicleEntity, VehicleExtraParams>({
    defaults: defaultVehicleFilters,
    useList: useFleetVehiclesControllerList,
    useSetActive: useFleetVehiclesControllerSetActive,
    listQueryKey: getFleetVehiclesControllerListQueryKey(),
    extraParams: (filters) => ({
      isLocal: filters.isLocal === '' ? undefined : filters.isLocal === 'true',
      partnerId: filters.partnerId || undefined,
      countryCode: filters.countryCode || undefined,
      area: filters.area || undefined,
      model: filters.model || undefined,
    }),
    label: 'Vehicle',
    errorLabel: 'vehicle',
  })

  const meta = useMetaControllerGetMeta()

  // UX-layer mirror of the server-side gate (FleetVehiclesService.setActive,
  // vehicle:reactivate — see docs/agents/permissions.md). Deactivating stays
  // ungated; only the false→true transition needs this.
  const canReactivate = usePermission('vehicle:reactivate')

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle />
        <VehicleCreateDialog />
      </div>

      <FilterCard hasActiveFilters={roster.hasActiveFilters} onReset={roster.resetFilters}>
        <VehicleFiltersBar filters={roster.filters} onChange={roster.setFilters} />
      </FilterCard>

      <VehiclesTable
        vehicles={roster.rows}
        loading={roster.loading}
        onEdit={setEditTarget}
        onUnavailability={setUnavailabilityTarget}
        onToggleActive={roster.toggleActive}
        canReactivate={canReactivate}
        fleetColors={meta.data?.fleetColors}
        hasActiveFilters={roster.hasActiveFilters}
        onResetFilters={roster.resetFilters}
      />

      <ListPagination page={roster.page} limit={roster.pageSize} total={roster.total} onPageChange={roster.setPage} />

      <VehicleEditDialog vehicle={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <VehicleUnavailabilityDialog vehicle={unavailabilityTarget} onOpenChange={(open) => !open && setUnavailabilityTarget(null)} />
    </div>
  )
}
