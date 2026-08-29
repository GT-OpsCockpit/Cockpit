import type { TripEntity, UpdateTripResponseEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerUpdate } from '@cockpit/shared/api'
import { toast } from 'sonner'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { usePermission } from '@/features/auth/use-permission'
import { PermissionWarning } from '@/components/permission-warning'
import { TripFormFields } from './trip-form-fields'
import { tripFormDefaults, tripFormSchema, type TripFormValues } from './trip-form-schema'
import { toUpdateTripDto, tripToFormValues } from './trip-form-mapping'
import { openSubcontractEmailDraft } from './subcontract-email'

/** What the save needs to know about the booking as it was *before* it — see submit(). */
interface SavedEdit {
  response: UpdateTripResponseEntity
  outgoingPartnerRef?: string
  wasFarmedOut: boolean
}

export function BookingEditDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
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

  const record = useRecordForm<TripFormValues, SavedEdit>({
    schema: tripFormSchema,
    values: trip ? tripToFormValues(trip) : tripFormDefaults(),
    submit: async (values) => {
      // Captured BEFORE the save, because the cancellation notice goes to the
      // partner the booking is being taken away from — by the time the PUT
      // returns, partnerRef no longer names them (common.js:2686).
      const outgoingPartnerRef = trip!.partner?.ref
      const wasFarmedOut = trip!.subContractor
      const response = await updateTrip.mutateAsync({
        ref: trip!.ref,
        data: toUpdateTripDto(values, { notifyDriver: hadDriver }),
      })
      return { response, outgoingPartnerRef, wasFarmedOut }
    },
    success: () => `Trip ${trip?.ref} updated.`,
    error: 'Error updating booking.',
    invalidate: [getTripsControllerListQueryKey()],
    close: () => onOpenChange(false),
    onSuccess: async ({ response, outgoingPartnerRef, wasFarmedOut }, values) => {
      if (response.notifyWarning) toast.warning(response.notifyWarning)
      // Farmed out here: recap the mission to the partner. Taken back off
      // them: tell them it's cancelled. Both are drafts, never sends.
      if (!wasFarmedOut && values.subContractor) {
        await openSubcontractEmailDraft(trip!.ref, 'assigned')
      } else if (wasFarmedOut && !values.subContractor && outgoingPartnerRef) {
        await openSubcontractEmailDraft(trip!.ref, 'cancelled', outgoingPartnerRef)
      }
    },
    disabled: !trip || pastLockout,
  })

  return (
    <RecordFormDialog
      open={!!trip}
      onOpenChange={onOpenChange}
      title={`Edit booking${trip ? ` — ${trip.ref}` : ''}`}
      record={record}
      submitLabel={hadDriver ? 'Confirm and send' : 'Confirm'}
      submitDisabled={pastLockout}
      contentClassName="sm:max-w-4xl"
      layout="scroll-body"
    >
      <div className="grid gap-4">
        {pastLockout && (
          <PermissionWarning>
            This booking's pickup is already in the past — only an Admin can edit it.
          </PermissionWarning>
        )}
        <TripFormFields
          form={record.form}
          trip={trip}
          disabled={pastLockout}
          priceDisabled={priceLockout}
          priceDisabledReason={
            priceLockout && !pastLockout
              ? 'Changing the Retail net / Partner rate net requires the Admin role.'
              : undefined
          }
        />
      </div>
    </RecordFormDialog>
  )
}
