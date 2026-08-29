import { Image, Pencil, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { isLocalTrip } from '@cockpit/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TableCell } from '@/components/ui/table'
import { dispatchButtonState } from './trip-status'

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

export interface TripRowActions {
  onEdit: (trip: TripEntity) => void
  onCancel: (trip: TripEntity) => void
  onDispatch: (trip: TripEntity) => void
  onNameboard: (trip: TripEntity) => void
}

/**
 * The Action column of a booking row: edit, send to the driver, nameboard,
 * cancel.
 *
 * Shared because the legacy shared it — Bookings and both Planning lists were
 * rendered by the same buildTripRowHtml (common.js:3098-3141), so a booking
 * could be dispatched or cancelled from wherever it was being looked at.
 */
export function TripActionsCell({
  trip,
  onEdit,
  onCancel,
  onDispatch,
  onNameboard,
}: TripRowActions & { trip: TripEntity }) {
  // Whether a Reg Nbr is expected before sending — asked of the booking itself
  // rather than taken from the caller, so a list that doesn't split Local from
  // Farm-out (Planning) can't get it wrong.
  const isLocal = isLocalTrip(trip)
  return (
    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
  )
}
