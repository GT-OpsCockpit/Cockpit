import { Check, Pencil, ReceiptText, X } from 'lucide-react'
import { billedAmount, retailNet } from '@cockpit/shared'
import type { TripEntity } from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { EmptyState } from '@/components/empty-state'
import { DispatchButton } from '../bookings/trip-actions-cell'
import { StatusBadge } from '../bookings/status-badge'
import { clientAccountLabel } from '../bookings/trip-display'
import { Itinerary } from '../bookings/itinerary'
import { PickupTime } from '../bookings/pickup-time'

/**
 * Billing-oriented columns, deliberately not the generic Bookings table —
 * mirrors the legacy's renderPendingTable/buildPendingRowHtml (invoicing.html:332-372).
 */
/** The net a booking will be invoiced at: retail is VAT-included (hourly rate × hours for an ASD). */
function netLabel(trip: TripEntity): string {
  const net = billedAmount({ rate: trip.priceEur != null ? Number(trip.priceEur) : null, hours: trip.hours, service: trip.service })
  return net != null ? `${retailNet(net).toFixed(2)} €` : '–'
}

export function PendingTripsTable({
  trips,
  onEdit,
  onCancel,
  onDispatch,
  onAdvance,
  selectedRefs,
  onToggle,
  onToggleAll,
  hasActiveFilters,
  onResetFilters,
}: {
  trips: TripEntity[]
  onEdit: (trip: TripEntity) => void
  onCancel: (trip: TripEntity) => void
  onDispatch: (trip: TripEntity) => void
  onAdvance: (trip: TripEntity) => void
  /** Refs of the trips ticked for the next invoice. */
  selectedRefs: ReadonlySet<string>
  onToggle: (trip: TripEntity) => void
  onToggleAll: (checked: boolean) => void
  hasActiveFilters?: boolean
  onResetFilters?: () => void
}) {
  return (
    <TableCard>
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[22%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[6%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[7%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                aria-label="Select all trips"
                disabled={trips.length === 0}
                checked={trips.length > 0 && trips.every((t) => selectedRefs.has(t.ref))}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
              />
            </TableHead>
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
              <TableCell colSpan={11} className="p-0 whitespace-normal">
                <EmptyState
                  icon={ReceiptText}
                  title="No trips to display for this period"
                  description="Trips pending invoicing for this period will appear here."
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={onResetFilters}
                />
              </TableCell>
            </TableRow>
          ) : (
            trips.map((trip) => {
              const account = clientAccountLabel(trip)
              const isEvent = trip.client.clientType === 'EVENT'
              return (
                <TableRow key={trip.ref} data-state={selectedRefs.has(trip.ref) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select trip ${trip.ref}`}
                      checked={selectedRefs.has(trip.ref)}
                      onCheckedChange={() => onToggle(trip)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    <PickupTime trip={trip} />
                  </TableCell>
                  <TableCell className="text-xs font-medium">{trip.ref}</TableCell>
                  <TableCell className="text-xs">
                    <div>
                      {account.primary}
                      {account.secondary && <span className="text-muted-foreground text-[10px]"> ({account.secondary})</span>}
                    </div>
                    <div className="text-muted-foreground text-[10px]">{trip.passengerName}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs"><Itinerary trip={trip} /></TableCell>
                  <TableCell className="text-xs">{trip.vehicleType?.name ?? '—'}</TableCell>
                  <TableCell className="text-xs">{trip.client.refPoOther || '–'}</TableCell>
                  <TableCell className="text-center text-xs">
                    {isEvent ? <Check className="mx-auto size-3.5" aria-label="Event" /> : '–'}
                  </TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge trip={trip} onAdvance={onAdvance} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{netLabel(trip)}</TableCell>
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
    </TableCard>
  )
}
