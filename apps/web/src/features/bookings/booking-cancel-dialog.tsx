import { useState } from 'react'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import {
  CancelAssignmentDtoCancellationFee,
  getTripsControllerListQueryKey,
  useTripsControllerCancelAssignment,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermission } from '@/features/auth/use-permission'
import { PermissionWarning } from '@/components/permission-warning'
import { clientAccountLabel, itineraryLabel, tripDriverName } from './trip-display'
import { PickupTime } from './pickup-time'

const FEE_OPTIONS: { value: CancelAssignmentDtoCancellationFee; label: string }[] = [
  { value: CancelAssignmentDtoCancellationFee.FREE, label: 'Free' },
  { value: CancelAssignmentDtoCancellationFee.FIFTY, label: '50%' },
  { value: CancelAssignmentDtoCancellationFee.SEVENTYFIVE, label: '75%' },
  { value: CancelAssignmentDtoCancellationFee.HUNDRED, label: '100%' },
]

/**
 * The fee this booking already carries. A cancelled booking can be reopened —
 * and the select has to show what it was cancelled with, not "Free": the
 * server reads FREE as "no fee at all" and deletes the row outright
 * (TripsService.cancelAssignment), so defaulting a booking cancelled at 50%
 * back to Free destroys it on the second confirm. The legacy filled the popup
 * from the booking for the same reason (common.js:2483).
 *
 * `TripEntity` and `CancelAssignmentDto` carry the same four values under two
 * generated enum types.
 */
function alreadyCancelledAt(trip: TripEntity): CancelAssignmentDtoCancellationFee {
  return (
    (trip.cancellationFee as CancelAssignmentDtoCancellationFee | null) ?? CancelAssignmentDtoCancellationFee.FREE
  )
}

export function BookingCancelDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const [fee, setFee] = useState<CancelAssignmentDtoCancellationFee>(CancelAssignmentDtoCancellationFee.FREE)
  const [feeLoadedFor, setFeeLoadedFor] = useState<string | null>(null)
  const cancelAssignment = useTripsControllerCancelAssignment()

  // UX-layer mirror of the server-side gate (TripsController.cancelAssignment,
  // trip:cancel — see docs/agents/permissions.md). The API enforces this
  // independently regardless of what's disabled here.
  const canCancel = usePermission('trip:cancel')

  // The dialog is mounted once and handed a different booking each time it
  // opens, so the fee is (re)read from whichever booking it is showing now.
  if (trip && trip.ref !== feeLoadedFor) {
    setFeeLoadedFor(trip.ref)
    setFee(alreadyCancelledAt(trip))
  }

  const close = (open: boolean) => {
    if (!open) setFeeLoadedFor(null)
    onOpenChange(open)
  }

  const confirm = async () => {
    if (!trip || !canCancel) return
    try {
      const result = await cancelAssignment.mutateAsync({ ref: trip.ref, data: { cancellationFee: fee } })
      toast.success(
        result.deleted
          ? `Trip ${trip.ref} cancelled and removed.`
          : `Trip ${trip.ref} cancelled (${FEE_OPTIONS.find((o) => o.value === fee)?.label} fee) — assignment cleared.`,
      )
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error cancelling booking.'))
    }
  }

  const account = trip ? clientAccountLabel(trip) : null

  return (
    <Dialog open={!!trip} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel booking{trip ? ` — ${trip.ref}` : ''}</DialogTitle>
        </DialogHeader>
        {trip && (
          <div className="grid gap-4">
            {!canCancel && <PermissionWarning>Cancelling a booking requires the Admin role.</PermissionWarning>}
            <div className="text-muted-foreground grid gap-1 text-sm">
              <div>
                {account?.primary}
                {account?.secondary && <span> ({account.secondary})</span>} — {trip.passengerName}
              </div>
              <div>
                <PickupTime trip={trip} />
              </div>
              <div>{itineraryLabel(trip)}</div>
              <div>Driver: {tripDriverName(trip) ?? '—'}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cancellation-fee">Cancellation fee</Label>
              <Select
                value={fee}
                onValueChange={(v) => setFee(v as CancelAssignmentDtoCancellationFee)}
                disabled={!canCancel}
              >
                <SelectTrigger id="cancellation-fee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={cancelAssignment.isPending || !canCancel}
            onClick={() => void confirm()}
          >
            {cancelAssignment.isPending && <Spinner />}
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
