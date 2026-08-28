import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerUpdate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermission } from '@/features/auth/use-permission'
import { PermissionWarning } from '@/components/permission-warning'
import { TripFormFields } from './trip-form-fields'
import { tripFormDefaults, tripFormSchema, type TripFormValues } from './trip-form-schema'
import { toUpdateTripDto, tripToFormValues } from './trip-form-mapping'
import { openSubcontractEmailDraft } from './subcontract-email'

export function BookingEditDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    values: trip ? tripToFormValues(trip) : tripFormDefaults(),
  })

  const updateTrip = useTripsControllerUpdate()
  // Mirrors the legacy's openEditTripModal: whether to notify the driver via WhatsApp
  // after saving is never a user choice here — it's "yes" iff the trip already had a
  // driver assigned before this edit (hence the "Confirm and send" vs "Confirm" label).
  const hadDriver = !!trip?.driver

  // UX-layer mirror of the server-side gate in TripsService.update() (see
  // docs/agents/permissions.md) — disables controls the API would reject
  // anyway, before the user tries. The API enforces this independently
  // regardless of what's disabled here.
  const canEditPast = usePermission('trip:edit-past')
  const canEditPrice = usePermission('trip:edit-price')
  const isPast = !!trip && new Date(trip.pickupAt) < new Date()
  const pastLockout = isPast && !canEditPast
  const priceLockout = !canEditPrice

  const onSubmit = form.handleSubmit(async (values) => {
    if (!trip || pastLockout) return
    // Captured BEFORE the save, because the cancellation notice goes to the
    // partner the booking is being taken away from — by the time the PUT
    // returns, partnerRef no longer names them (common.js:2686).
    const outgoingPartnerRef = trip.partner?.ref
    const wasFarmedOut = trip.subContractor
    try {
      const result = await updateTrip.mutateAsync({
        ref: trip.ref,
        data: toUpdateTripDto(values, { notifyDriver: hadDriver }),
      })
      toast.success(`Trip ${trip.ref} updated.`)
      if (result.notifyWarning) toast.warning(result.notifyWarning)

      // Farmed out here: recap the mission to the partner. Taken back off
      // them: tell them it's cancelled. Both are drafts, never sends.
      if (!wasFarmedOut && values.subContractor) {
        await openSubcontractEmailDraft(trip.ref, 'assigned')
      } else if (wasFarmedOut && !values.subContractor && outgoingPartnerRef) {
        await openSubcontractEmailDraft(trip.ref, 'cancelled', outgoingPartnerRef)
      }

      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating booking.'))
    }
  })

  return (
    <Dialog open={!!trip} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit booking{trip ? ` — ${trip.ref}` : ''}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            {pastLockout && (
              <PermissionWarning>
                This booking's pickup is already in the past — only an Admin can edit it.
              </PermissionWarning>
            )}
            <TripFormFields
              form={form}
              trip={trip}
              disabled={pastLockout}
              priceDisabled={priceLockout}
              priceDisabledReason={
                priceLockout && !pastLockout
                  ? 'Changing the Retail net / Partner rate net requires the Admin role.'
                  : undefined
              }
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTrip.isPending || pastLockout}>
                {updateTrip.isPending && <Spinner />}
                {hadDriver ? 'Confirm and send' : 'Confirm'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
