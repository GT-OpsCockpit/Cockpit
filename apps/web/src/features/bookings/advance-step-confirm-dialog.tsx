import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerAdvanceStep } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function AdvanceStepConfirmDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const advanceStep = useTripsControllerAdvanceStep()

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

  return (
    <AlertDialog open={!!trip} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Valid step?</AlertDialogTitle>
          <AlertDialogDescription>
            {trip && `Trip ${trip.ref} will be moved to its next step.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={advanceStep.isPending} onClick={() => void confirm()}>
            Valid step
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
