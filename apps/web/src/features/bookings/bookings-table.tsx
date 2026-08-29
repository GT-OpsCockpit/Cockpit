import { Calendar, Check } from 'lucide-react'
import type { TripEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from './status-badge'
import { clientAccountLabel, itineraryLabel, shortDriverName, tripDriverName, urgencyRowClass } from './trip-display'
import { PickupTime } from './pickup-time'
import { TripActionsCell } from './trip-actions-cell'

interface BookingsTableProps {
  trips: TripEntity[]
  variant: 'local' | 'farmout'
  /** First (uncached) load of the trips query — shows skeleton rows instead of the empty-state line. */
  loading?: boolean
  onEdit: (trip: TripEntity) => void
  onCancel: (trip: TripEntity) => void
  onDispatch: (trip: TripEntity) => void
  onAdvance: (trip: TripEntity) => void
  onNameboard: (trip: TripEntity) => void
  /** Whether the caller's filters are away from their defaults — switches the empty state to the "no results" variant with a reset action. */
  hasActiveFilters?: boolean
  onResetFilters?: () => void
}

export function BookingsTable({
  trips,
  variant,
  loading = false,
  onEdit,
  onCancel,
  onDispatch,
  onAdvance,
  onNameboard,
  hasActiveFilters,
  onResetFilters,
}: BookingsTableProps) {
  const isLocal = variant === 'local'
  const colSpan = isLocal ? 10 : 9

  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pickup</TableHead>
            <TableHead>REF</TableHead>
            <TableHead>Cust / Pax</TableHead>
            <TableHead>Itinerary</TableHead>
            <TableHead>Vehicle</TableHead>
            {isLocal && <TableHead>Reg Nbr</TableHead>}
            <TableHead>Sub-C</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeletonRows columns={colSpan} />
          ) : trips.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="p-0 whitespace-normal">
                <EmptyState
                  icon={Calendar}
                  title="No bookings to display"
                  description="Bookings created will appear here."
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={onResetFilters}
                />
              </TableCell>
            </TableRow>
          ) : (
            trips.map((trip) => {
              const account = clientAccountLabel(trip)
              const driverName = tripDriverName(trip)
              const rowClass = trip.assignmentCancelled ? 'bg-destructive/10' : urgencyRowClass(trip)
              return (
                <TableRow key={trip.ref} className={cn(rowClass)}>
                  <TableCell className="whitespace-nowrap text-xs">
                    <PickupTime trip={trip} />
                  </TableCell>
                  <TableCell className="text-xs font-medium">{trip.ref}</TableCell>
                  <TableCell className="text-xs">
                    <div>
                      {account.primary}
                      {account.secondary && (
                        <span className="text-muted-foreground text-[10px]"> ({account.secondary})</span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-[10px]">{trip.passengerName}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{itineraryLabel(trip)}</TableCell>
                  <TableCell className="text-xs">
                    {trip.vehicleType?.name ?? '—'}
                    <br />
                    <span className="text-muted-foreground text-[9.5px]">{trip.paxCount ?? '?'} pax</span>
                  </TableCell>
                  {isLocal && (
                    <TableCell className="text-xs whitespace-nowrap">{trip.fleetVehicle?.acronym ?? '—'}</TableCell>
                  )}
                  <TableCell className="text-center text-xs">
                    {trip.subContractor ? <Check className="mx-auto size-3.5" aria-label="Sub-contracted" /> : '—'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {isLocal ? shortDriverName(driverName) : (driverName ?? '—')}
                  </TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge trip={trip} onAdvance={onAdvance} />
                    {trip.cancellationFee && trip.cancellationFee !== 'FREE' && (
                      <div className="text-muted-foreground text-[9.5px]">Fee: {trip.cancellationFee}</div>
                    )}
                  </TableCell>
                  <TripActionsCell
                    trip={trip}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    onDispatch={onDispatch}
                    onNameboard={onNameboard}
                  />
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </TableCard>
  )
}
