import { useState } from 'react'
import { toast } from 'sonner'
import type { DriverEntity, FleetVehicleEntity, TripEntity } from '@cockpit/shared/api'
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
import { BookingEditDialog } from '../bookings/booking-edit-dialog'
import { driverDisplayName } from '../bookings/trip-status'
import { useTripEvents } from '../bookings/use-trip-events'
import { unavailabilityLabel as driverUnavailabilityLabel } from '../drivers/driver-status'
import { DriverUnavailabilityDialog } from '../drivers/driver-unavailability-dialog'
import { unavailabilityLabel as vehicleUnavailabilityLabel } from '../fleet/vehicle-status'
import { VehicleUnavailabilityDialog } from '../fleet/vehicle-unavailability-dialog'
import { PlanningFiltersBar } from './planning-filters-bar'
import { PlanningList } from './planning-list'
import { coversDate, defaultPlanningFilters, vehicleTypeColor, type PlanningResource } from './planning-status'
import { PlanningTimeline, type TimelineRow } from './planning-timeline'

// The backend caps `limit` at 100 on every paginated list endpoint (see
// e.g. ListDriversQueryDto) — the Gantt's row roster reuses that same bound
// rather than requesting an unbounded fetch.
const ROSTER_LIMIT = 100

export function PlanningPage() {
  useTripEvents()

  const [filters, setFilters] = useState(defaultPlanningFilters())
  const [editTarget, setEditTarget] = useState<TripEntity | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<TripEntity | null>(null)
  const [driverAvailabilityTarget, setDriverAvailabilityTarget] = useState<DriverEntity | null>(null)
  const [vehicleAvailabilityTarget, setVehicleAvailabilityTarget] = useState<FleetVehicleEntity | null>(null)

  const canEditPast = usePermission('trip:edit-past')
  const isEditable = (trip: TripEntity) => new Date(trip.pickupAt) >= new Date() || canEditPast

  // The Timeline navigates to an arbitrary date + 1-3 day span, which the
  // named `period` enum can't bound precisely — 'all' is still a bounded,
  // "operationally relevant" set (today onward, plus the never-dropped past
  // backlog — see TripsService.list()), not the unbounded fetch this project
  // has otherwise ruled out; the List view keeps using the selected period.
  const trips = useTripsControllerList({
    period: filters.view === 'timeline' ? 'all' : filters.period,
    category: filters.category,
  })

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
      await assign.mutateAsync({ ref: trip.ref, data })
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error reassigning the booking.'))
    }
  }

  const handleResourceChange = (resource: PlanningResource) => setFilters({ ...filters, resource, resourceRef: '' })

  const resourceOptions =
    filters.resource === 'drivers'
      ? (drivers.data?.data ?? []).map((d) => ({ value: d.ref, label: driverDisplayName(d) }))
      : (vehicles.data?.data ?? []).map((v) => ({ value: v.regNbr, label: v.regNbr }))

  const listTrips = (trips.data ?? []).filter((t) => {
    if (!filters.resourceRef) return true
    return filters.resource === 'drivers'
      ? t.driver?.ref === filters.resourceRef
      : t.fleetVehicle?.regNbr === filters.resourceRef
  })

  const driverRows: TimelineRow[] = (drivers.data?.data ?? [])
    .slice()
    .sort((a, b) => driverDisplayName(a).localeCompare(driverDisplayName(b)))
    .map((d) => {
      const active = coversDate(d.unavailability, filters.timelineDate)
      return {
        key: d.ref,
        label: driverDisplayName(d),
        subLabel: d.phone ?? undefined,
        icon: {
          symbol: '🫥',
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
              symbol: '🔧',
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
        <h1 className="text-2xl font-semibold">Planning</h1>
        <Tabs value={filters.resource} onValueChange={(v) => handleResourceChange(v as PlanningResource)}>
          <TabsList>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <PlanningFiltersBar
        filters={filters}
        onChange={setFilters}
        resourceOptions={resourceOptions}
        resourceLabel={filters.resource === 'drivers' ? 'driver' : 'vehicle'}
      />

      {filters.view === 'list' ? (
        <PlanningList trips={listTrips} onEdit={setEditTarget} onAdvance={setAdvanceTarget} />
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
