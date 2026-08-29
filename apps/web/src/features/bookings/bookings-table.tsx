import { Calendar, Check, Image, Pencil, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from './status-badge'
import { dispatchButtonState } from './trip-status'
import { clientAccountLabel, displayPickup, itineraryLabel, shortDriverName, tripDriverName, urgencyRowClass } from './trip-display'

export function DispatchButton({
  trip,
  isLocal,
  onDispatch,
  onEdit,
}: {
  trip: TripEntity
  isLocal: boolean
  onDispatch: (trip: TripEntity) => void
  onEdit: (trip: TripEntity) => void
}) {
  const { dimmed, disabled, title } = dispatchButtonState(trip, isLocal)
  // Legacy opened a per-field quick-popup here (driver/vehicle cell edit) when
  // dispatch was attempted without both assigned. Quick-popups were deliberately not
  // ported (see docs/agents/permissions.md) — the full edit dialog is where that
  // reassignment happens now, so route there instead of letting the click through to
  // a doomed dispatch-driver call that the server would reject with a 400.
  const handleClick = () => {
    if (dimmed) {
      toast.warning(title)
      onEdit(trip)
      return
    }
    onDispatch(trip)
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      disabled={disabled}
      className={cn(dimmed && 'opacity-40')}
      onClick={handleClick}
    >
      <Send className="size-3.5" />
    </Button>
  )
}

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
                  <TableCell className="whitespace-nowrap text-xs">{displayPickup(trip).local}</TableCell>
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
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(trip)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <DispatchButton trip={trip} isLocal={isLocal} onDispatch={onDispatch} onEdit={onEdit} />
                      <Button
                        variant="ghost"
                        size="icon"
                        title={trip.nameboardUrl ? 'View / replace nameboard' : 'Upload nameboard'}
                        className={cn(trip.nameboardUrl && 'text-primary')}
                        onClick={() => onNameboard(trip)}
                      >
                        <Image className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Cancel" onClick={() => onCancel(trip)}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </TableCard>
  )
}
