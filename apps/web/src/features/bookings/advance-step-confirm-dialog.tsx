import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerAdvanceStep } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { usePermission } from '@/features/auth/use-permission'
import { CompleteSubcontractDialog } from './complete-subcontract-dialog'
import { isStatusCompletable } from './trip-status'

export function AdvanceStepConfirmDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const advanceStep = useTripsControllerAdvanceStep()
  const canComplete = usePermission('trip:complete-subcontract')

  const confirm = async () => {
    if (!trip) return
    try {
      await advanceStep.mutateAsync({ ref: trip.ref })
      toast.success(`Trip ${trip.ref} moved to the next step.`)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error moving to the next step.'))
    } finally {
      onOpenChange(false)
    }
  }

  // An admin clicking a sub-contracted Sent/Confirmed badge ends the trip (behind
  // their password) rather than nudging it one step.
  if (trip && canComplete && isStatusCompletable(trip)) {
    return <CompleteSubcontractDialog trip={trip} onOpenChange={onOpenChange} />
  }

  return (
    <ConfirmActionDialog
      open={!!trip}
      onOpenChange={onOpenChange}
      title="Valid step?"
      description={trip && `Trip ${trip.ref} will be moved to its next step.`}
      confirmLabel="Valid step"
      pending={advanceStep.isPending}
      onConfirm={confirm}
    />
  )
}
