import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerDispatchDriver } from '@cockpit/shared/api'
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

export function DispatchConfirmDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const dispatchDriver = useTripsControllerDispatchDriver()

  const confirm = async () => {
    if (!trip) return
    try {
      await dispatchDriver.mutateAsync({ ref: trip.ref })
      toast.success(`Trip ${trip.ref} dispatched to the driver.`)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error sending to the driver.'))
    } finally {
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={!!trip} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dispatch to the driver?</AlertDialogTitle>
          <AlertDialogDescription>
            {trip && `Trip ${trip.ref} will be sent to the assigned driver via WhatsApp.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction disabled={dispatchDriver.isPending} onClick={() => void confirm()}>
            Yes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
