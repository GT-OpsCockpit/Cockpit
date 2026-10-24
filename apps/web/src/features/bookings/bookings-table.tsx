import type { ReactNode } from 'react'
import { Calendar, Check } from 'lucide-react'
import type { TripEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from './status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  cancellationFeeLabel,
  clientAccountLabel,
  fleetVehicleLabel,
  pocTooltipLabel,
  shortDriverName,
  tripDriverName,
  urgencyRowClass,
} from './trip-display'
import { Itinerary } from './itinerary'
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
  /** Click on the Reg Nbr / Driver cell of a Local row: opens the quick assign popup. */
  onAssign?: (trip: TripEntity) => void
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
  onAssign,
  hasActiveFilters,
  onResetFilters,
}: BookingsTableProps) {
  const isLocal = variant === 'local'
  const colSpan = 10

  return (
    <TableCard>
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[11%]" />
          <col className="w-[35%]" />
          <col className="w-[6%]" />
          <col className="w-[5%]" />
          <col className="w-[4%]" />
          <col className="w-[6%]" />
          <col className="w-[10%]" />
          <col className="w-[6%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Pickup</TableHead>
            <TableHead>REF</TableHead>
            <TableHead>Cust / Pax</TableHead>
            <TableHead>Itinerary</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Reg Nbr</TableHead>
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
              const rowClass =
                trip.assignmentCancelled || (trip.subContractor && trip.partnerDeclinedAt)
                  ? 'bg-destructive/10'
                  : urgencyRowClass(trip)
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
                    <PassengerLine trip={trip} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-normal"><Itinerary trip={trip} /></TableCell>
                  <TableCell className="text-xs">
                    {trip.vehicleType?.name ?? '—'}
                    <br />
                    <span className="text-muted-foreground text-[9.5px]">{trip.paxCount ?? '?'} pax</span>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {isLocal ? (
                      <AssignCell trip={trip} onAssign={onAssign}>
                        {fleetVehicleLabel(trip)}
                      </AssignCell>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {trip.subContractor ? <Check className="mx-auto size-3.5" aria-label="Sub-contracted" /> : '—'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <AssignCell trip={trip} onAssign={onAssign}>
                      {isLocal ? shortDriverName(driverName) : (driverName ?? '—')}
                    </AssignCell>
                  </TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge trip={trip} onAdvance={onAdvance} />
                    {trip.cancellationFee && trip.cancellationFee !== 'FREE' && (
                      <div className="text-muted-foreground text-[9.5px]">
                        Fee: {cancellationFeeLabel(trip.cancellationFee)}
                      </div>
                    )}
                  </TableCell>
                  <TripActionsCell
                    trip={trip}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    onDispatch={onDispatch}
                    onNameboard={onNameboard}
                    onAssign={onAssign}
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

/**
 * The passenger's name, carrying the POC on hover when the two differ.
 *
 * A shadcn Tooltip rather than a native `title`: the browser's own delay is
 * around a second, which is too long for the one thing a dispatcher reaches
 * for when a pickup is going wrong.
 */
function PassengerLine({ trip }: { trip: TripEntity }) {
  const poc = pocTooltipLabel(trip)
  const name = <div className="text-muted-foreground text-[10px]">{trip.passengerName}</div>
  if (!poc) return name

  return (
    <Tooltip>
      <TooltipTrigger asChild>{name}</TooltipTrigger>
      <TooltipContent>{poc}</TooltipContent>
    </Tooltip>
  )
}

/** A Reg Nbr / Driver value that opens the quick assign popup — a plain text when the board gives no handler. */
function AssignCell({
  trip,
  onAssign,
  children,
}: {
  trip: TripEntity
  onAssign?: (trip: TripEntity) => void
  children: ReactNode
}) {
  if (!onAssign) return <>{children}</>
  return (
    <button
      type="button"
      className="hover:text-primary -mx-1 cursor-pointer rounded px-1 text-left underline-offset-2 hover:underline"
      title={`Assign ${trip.ref}`}
      onClick={() => onAssign(trip)}
    >
      {children}
    </button>
  )
}
