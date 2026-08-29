import { CalendarOff, Wrench } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { DriverEntity, FleetVehicleEntity, TripEntity } from '@cockpit/shared/api'
import { formatPhoneDisplay } from '@cockpit/shared'
import {
  getTripsControllerListQueryKey,
  useDriversControllerList,
  useFleetVehiclesControllerList,
  useMetaControllerGetMeta,
  useTripsControllerAssign,
  useTripsControllerList,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePermission } from '../auth/use-permission'
import { AdvanceStepConfirmDialog } from '../bookings/advance-step-confirm-dialog'
import { BookingCancelDialog } from '../bookings/booking-cancel-dialog'
import { BookingEditDialog } from '../bookings/booking-edit-dialog'
import { DispatchConfirmDialog } from '../bookings/dispatch-confirm-dialog'
import { NameboardUploadDialog } from '../bookings/nameboard-upload-dialog'
import { driverLabel } from '@cockpit/shared'
import { useTripEvents } from '../bookings/use-trip-events'
import { unavailabilityLabel as driverUnavailabilityLabel } from '../drivers/driver-status'
import { DriverUnavailabilityDialog } from '../drivers/driver-unavailability-dialog'
import { unavailabilityLabel as vehicleUnavailabilityLabel } from '../fleet/vehicle-status'
import { VehicleUnavailabilityDialog } from '../fleet/vehicle-unavailability-dialog'
import { PlanningFiltersBar } from './planning-filters-bar'
import { PlanningList } from './planning-list'
import { coversDate, defaultPlanningFilters, vehicleTypeColor, type PlanningResource } from './planning-status'
import { PlanningTimeline, type TimelineRow } from './planning-timeline'
import { planningListView, planningTimelineView } from '../bookings/trip-views'
import { FilterCard } from '@/components/filter-card'
import { PageTitle } from '@/components/layout/page-title'
import { filtersChanged } from '@/lib/utils'

// The backend caps `limit` at 100 on every paginated list endpoint (see
// e.g. ListDriversQueryDto) — the Gantt's row roster reuses that same bound
// rather than requesting an unbounded fetch.
const ROSTER_LIMIT = 100

export function PlanningPage() {
  useTripEvents()

  const [filters, setFilters] = useState(defaultPlanningFilters())
  const hasActiveFilters = filtersChanged(filters, defaultPlanningFilters())
  const resetFilters = () => setFilters(defaultPlanningFilters())
  const [editTarget, setEditTarget] = useState<TripEntity | null>(null)
  // The legacy rendered Bookings and both Planning lists through the same row
  // builder (buildTripRowHtml, common.js:3098-3141), so a booking could be
  // dispatched or cancelled from wherever it was being looked at.
  const [cancelTarget, setCancelTarget] = useState<TripEntity | null>(null)
  const [dispatchTarget, setDispatchTarget] = useState<TripEntity | null>(null)
  const [nameboardTarget, setNameboardTarget] = useState<TripEntity | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<TripEntity | null>(null)
  const [driverAvailabilityTarget, setDriverAvailabilityTarget] = useState<DriverEntity | null>(null)
  const [vehicleAvailabilityTarget, setVehicleAvailabilityTarget] = useState<FleetVehicleEntity | null>(null)

  const canEditPast = usePermission('trip:edit-past')
  const isEditable = (trip: TripEntity) => new Date(trip.pickupAt) >= new Date() || canEditPast

  // Two views, not one with a flag: the List narrows to the selected driver
  // or vehicle server-side, while the Gantt must NOT — it draws one row per
  // resource, so narrowing would empty every other row (see trip-views.ts).
  const trips = useTripsControllerList(
    filters.view === 'timeline' ? planningTimelineView(filters) : planningListView(filters),
  )

  const drivers = useDriversControllerList(
    { includeInactive: false, limit: ROSTER_LIMIT },
    { query: { enabled: filters.resource === 'drivers' } },
  )
  const vehicles = useFleetVehiclesControllerList(
    { includeInactive: false, limit: ROSTER_LIMIT },
    { query: { enabled: filters.resource === 'vehicles' } },
  )
  const meta = useMetaControllerGetMeta()
  const vehicleTypeNames = (meta.data?.vehicleTypes ?? []).map((v) => v.name)
  const legend = vehicleTypeNames.map((name) => ({ label: name, color: vehicleTypeColor(name, vehicleTypeNames) }))

  const assign = useTripsControllerAssign()
  async function runAssign(trip: TripEntity, data: { driverRef?: string; fleetRegNbr?: string }) {
    try {
      const result = await assign.mutateAsync({ ref: trip.ref, data })
      // Reassigning a booking that already had a driver tells the POC about
      // it (see TripsService.assign) — non-blocking, so surface a message
      // that didn't go out rather than letting it pass silently.
      if (result.notifyWarning) toast.warning(result.notifyWarning)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error reassigning the booking.'))
    }
  }

  const handleResourceChange = (resource: PlanningResource) => setFilters({ ...filters, resource, resourceRef: '' })

  const resourceOptions =
    filters.resource === 'drivers'
      ? (drivers.data?.data ?? []).map((d) => ({ value: d.ref, label: driverLabel(d) }))
      : (vehicles.data?.data ?? []).map((v) => ({ value: v.regNbr, label: v.regNbr }))

  const driverRows: TimelineRow[] = (drivers.data?.data ?? [])
    .slice()
    .sort((a, b) => driverLabel(a).localeCompare(driverLabel(b)))
    .map((d) => {
      const active = coversDate(d.unavailability, filters.timelineDate)
      return {
        key: d.ref,
        label: driverLabel(d),
        subLabel: formatPhoneDisplay(d.phone) || undefined,
        icon: {
          icon: CalendarOff,
          title: 'Day off / Holidays / Sickness leave',
          placement: 'inline',
          dimmed: !active,
          onClick: () => setDriverAvailabilityTarget(d),
        },
        statusLabel: active ? driverUnavailabilityLabel(d.unavailability) : null,
      }
    })

  const vehicleRows: TimelineRow[] = (vehicles.data?.data ?? [])
    .slice()
    .sort((a, b) => a.regNbr.localeCompare(b.regNbr))
    .map((v) => {
      const active = coversDate(v.unavailability, filters.timelineDate)
      return {
        key: v.regNbr,
        label: [v.regNbr, v.category.name].filter(Boolean).join(' · '),
        subLabel: [v.make, v.model].filter(Boolean).join(' '),
        icon: v.isLocal
          ? {
              icon: Wrench,
              title: 'Repair shop / Manufacturer service / Bodywork',
              placement: 'thirdLine',
              dimmed: !active,
              onClick: () => setVehicleAvailabilityTarget(v),
            }
          : undefined,
        statusLabel: active ? vehicleUnavailabilityLabel(v.unavailability) : null,
      }
    })

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle>Planning</PageTitle>
        <Tabs value={filters.resource} onValueChange={(v) => handleResourceChange(v as PlanningResource)}>
          <TabsList>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <FilterCard hasActiveFilters={hasActiveFilters} onReset={resetFilters}>
        <PlanningFiltersBar
          filters={filters}
          onChange={setFilters}
          resourceOptions={resourceOptions}
          resourceLabel={filters.resource === 'drivers' ? 'driver' : 'vehicle'}
        />
      </FilterCard>

      {filters.view === 'list' ? (
        <PlanningList
          trips={trips.data ?? []}
          onEdit={setEditTarget}
          onCancel={setCancelTarget}
          onDispatch={setDispatchTarget}
          onNameboard={setNameboardTarget}
          onAdvance={setAdvanceTarget}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      ) : filters.resource === 'drivers' ? (
        <PlanningTimeline
          trips={trips.data ?? []}
          rows={driverRows}
          dateStr={filters.timelineDate}
          days={filters.timelineDays}
          getRowKey={(trip) => trip.driver?.ref ?? ''}
          colorFor={(trip) => vehicleTypeColor(trip.vehicleType?.name, vehicleTypeNames)}
          isEditable={isEditable}
          onAssign={(trip, rowKey) => void runAssign(trip, { driverRef: rowKey })}
          onUnassign={(trip) => void runAssign(trip, { driverRef: '' })}
          onOpenTrip={setEditTarget}
          legend={legend}
        />
      ) : (
        <PlanningTimeline
          trips={trips.data ?? []}
          rows={vehicleRows}
          dateStr={filters.timelineDate}
          days={filters.timelineDays}
          getRowKey={(trip) => trip.fleetVehicle?.regNbr ?? ''}
          colorFor={(trip) => vehicleTypeColor(trip.vehicleType?.name, vehicleTypeNames)}
          isEditable={isEditable}
          onAssign={(trip, rowKey) => void runAssign(trip, { fleetRegNbr: rowKey })}
          onUnassign={(trip) => void runAssign(trip, { fleetRegNbr: '' })}
          onOpenTrip={setEditTarget}
          canDrop={(trip, row) => {
            if (!trip.vehicleType) return true
            const vehicle = (vehicles.data?.data ?? []).find((v) => v.regNbr === row.key)
            if (!vehicle) return true
            const allowed = meta.data?.vehicleCompatibility?.[trip.vehicleType.name] ?? [trip.vehicleType.name]
            return allowed.includes(vehicle.category.name)
          }}
          incompatibleMessage={(trip, row) => {
            const vehicle = (vehicles.data?.data ?? []).find((v) => v.regNbr === row.key)
            return `Vehicle ${row.key} (${vehicle?.category.name ?? '?'}) cannot service a ${trip.vehicleType?.name ?? '?'} trip.`
          }}
          legend={legend}
        />
      )}

      <BookingEditDialog trip={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <DispatchConfirmDialog trip={dispatchTarget} onOpenChange={(open) => !open && setDispatchTarget(null)} />
      <BookingCancelDialog trip={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <NameboardUploadDialog trip={nameboardTarget} onOpenChange={(open) => !open && setNameboardTarget(null)} />
      <AdvanceStepConfirmDialog trip={advanceTarget} onOpenChange={(open) => !open && setAdvanceTarget(null)} />
      <DriverUnavailabilityDialog
        driver={driverAvailabilityTarget}
        onOpenChange={(open) => !open && setDriverAvailabilityTarget(null)}
      />
      <VehicleUnavailabilityDialog
        vehicle={vehicleAvailabilityTarget}
        onOpenChange={(open) => !open && setVehicleAvailabilityTarget(null)}
      />
    </div>
  )
}
