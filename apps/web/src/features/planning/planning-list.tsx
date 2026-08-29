import { CalendarClock } from 'lucide-react'
import type { TripEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from '../bookings/status-badge'
import { clientAccountLabel, displayPickup, itineraryLabel, tripDriverName, urgencyRowClass } from '../bookings/trip-display'

interface PlanningListProps {
  trips: TripEntity[]
  onEdit: (trip: TripEntity) => void
  onAdvance: (trip: TripEntity) => void
  hasActiveFilters?: boolean
  onResetFilters?: () => void
}

/**
 * Flat table, sorted chronologically (server order) — unlike Bookings this
 * is a single list, not split Local/Farm-out (common.js's planning List view
 * reused the same row format but never applied that split).
 */
export function PlanningList({ trips, onEdit, onAdvance, hasActiveFilters, onResetFilters }: PlanningListProps) {
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
            <TableHead>Reg Nbr</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0 whitespace-normal">
                <EmptyState
                  icon={CalendarClock}
                  title="No trips to display"
                  description="Trips scheduled for this view will appear here."
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={onResetFilters}
                />
              </TableCell>
            </TableRow>
          ) : (
            trips.map((trip) => {
              const account = clientAccountLabel(trip)
              const rowClass = trip.assignmentCancelled ? 'bg-destructive/10' : urgencyRowClass(trip)
              return (
                <TableRow
                  key={trip.ref}
                  className={cn(rowClass, 'cursor-pointer')}
                  onClick={() => onEdit(trip)}
                >
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
                  <TableCell className="text-xs">{trip.vehicleType?.name ?? '—'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{trip.fleetVehicle?.acronym ?? '—'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{tripDriverName(trip) ?? '—'}</TableCell>
                  <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge trip={trip} onAdvance={onAdvance} />
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
