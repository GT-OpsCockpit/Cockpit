import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerDispatchDriver } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'

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
    <ConfirmActionDialog
      open={!!trip}
      onOpenChange={onOpenChange}
      title="Dispatch to the driver?"
      description={trip && `Trip ${trip.ref} will be sent to the assigned driver via WhatsApp.`}
      cancelLabel="No"
      confirmLabel="Yes"
      pending={dispatchDriver.isPending}
      onConfirm={confirm}
    />
  )
}
