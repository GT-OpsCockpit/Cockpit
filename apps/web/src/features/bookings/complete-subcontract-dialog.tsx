import { useState } from 'react'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerCompleteSubcontract } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Ends a sub-contracted booking by hand (Sent/Confirmed → Done) so it can be
 * invoiced. The partner has no driver link to mark it Done, so an admin does
 * it, re-entering their own password first.
 */
export function CompleteSubcontractDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const complete = useTripsControllerCompleteSubcontract()

  const close = (open: boolean) => {
    if (!open) setPassword('')
    onOpenChange(open)
  }

  const confirm = async () => {
    if (!trip) return
    try {
      await complete.mutateAsync({ ref: trip.ref, data: { password } })
      toast.success(`Trip ${trip.ref} ended — it can now be invoiced.`)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error ending this trip.'))
    }
  }

  return (
    <ConfirmActionDialog
      open={!!trip}
      onOpenChange={close}
      title="Do you want to end this trip?"
      description={trip && `Trip ${trip.ref} will be marked Done and become available for invoicing.`}
      confirmLabel="End trip"
      pending={complete.isPending}
      confirmDisabled={!password}
      onConfirm={confirm}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="complete-subcontract-password">Admin code (your login password)</Label>
        <Input
          id="complete-subcontract-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </ConfirmActionDialog>
  )
}
