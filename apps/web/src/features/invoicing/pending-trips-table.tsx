import { Pencil, X } from 'lucide-react'
import type { TripEntity } from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DispatchButton } from '../bookings/bookings-table'
import { StatusBadge } from '../bookings/status-badge'
import { clientAccountLabel, displayPickup, itineraryLabel } from '../bookings/trip-status'

/**
 * Billing-oriented columns, deliberately not the generic Bookings table —
 * mirrors the legacy's renderPendingTable/buildPendingRowHtml (invoicing.html:332-372).
 */
export function PendingTripsTable({
  trips,
  onEdit,
  onCancel,
  onDispatch,
  onAdvance,
}: {
  trips: TripEntity[]
  onEdit: (trip: TripEntity) => void
  onCancel: (trip: TripEntity) => void
  onDispatch: (trip: TripEntity) => void
  onAdvance: (trip: TripEntity) => void
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Booking ref</TableHead>
            <TableHead>Cust / Pax</TableHead>
            <TableHead>Itinerary</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Ref/PO</TableHead>
            <TableHead className="text-center">Event</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-muted-foreground text-center">
                No trips to display for this period.
              </TableCell>
            </TableRow>
          ) : (
            trips.map((trip) => {
              const account = clientAccountLabel(trip)
              const isEvent = trip.client.clientType === 'EVENT'
              return (
                <TableRow key={trip.ref}>
                  <TableCell className="whitespace-nowrap text-xs">{displayPickup(trip).local}</TableCell>
                  <TableCell className="text-xs font-medium">{trip.ref}</TableCell>
                  <TableCell className="text-xs">
                    <div>
                      {account.primary}
                      {account.secondary && <span className="text-muted-foreground text-[10px]"> ({account.secondary})</span>}
                    </div>
                    <div className="text-muted-foreground text-[10px]">{trip.passengerName}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{itineraryLabel(trip)}</TableCell>
                  <TableCell className="text-xs">{trip.vehicleType?.name ?? '—'}</TableCell>
                  <TableCell className="text-xs">{trip.client.refPoOther || '–'}</TableCell>
                  <TableCell className="text-center text-xs">{isEvent ? '✅' : '–'}</TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge trip={trip} onAdvance={onAdvance} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{trip.priceEur != null ? `${Number(trip.priceEur).toFixed(2)} €` : '–'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(trip)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <DispatchButton trip={trip} isLocal onDispatch={onDispatch} onEdit={onEdit} />
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
    </div>
  )
}
