import { useState } from 'react'
import type { TripEntity, UpdateTripResponseEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerUpdate } from '@cockpit/shared/api'
import { toast } from 'sonner'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { usePermission } from '@/features/auth/use-permission'
import { PermissionWarning } from '@/components/permission-warning'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TripFormFields } from './trip-form-fields'
import { isTripCompleted } from './trip-status'
import { tripFormDefaults, tripFormSchema, type TripFormValues } from './trip-form-schema'
import { toUpdateTripDto, tripToFormValues } from './trip-form-mapping'
import { SubcontractEmailDialog, type SubcontractEmailTarget } from './subcontract-email-dialog'

/** What the save needs to know about the booking as it was *before* it — see submit(). */
interface SavedEdit {
  response: UpdateTripResponseEntity
  outgoingPartnerRef?: string
  outgoingDirectPartnerRef?: string
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
  // Outlives the edit dialog closing (RecordFormDialog's `open` toggles off
  // right after a successful save) — see SubcontractEmailDialog's doc
  // comment on why this can no longer be a fire-and-forget mailto: draft.
  const [emailTarget, setEmailTarget] = useState<SubcontractEmailTarget | null>(null)
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
  // Changing a price on a finished or invoiced trip also asks for the admin's password (the API checks it).
  const [adminPassword, setAdminPassword] = useState('')

  const record = useRecordForm<TripFormValues, SavedEdit>({
    schema: tripFormSchema,
    values: trip ? tripToFormValues(trip) : tripFormDefaults(),
    submit: async (values) => {
      // Captured BEFORE the save, because the cancellation notice goes to the
      // partner the booking is being taken away from — by the time the PUT
      // returns, partnerRef no longer names them (common.js:2686).
      const outgoingPartnerRef = trip!.partner?.ref
      const outgoingDirectPartnerRef = trip!.directPartner?.ref
      const wasFarmedOut = trip!.subContractor
      const response = await updateTrip.mutateAsync({
        ref: trip!.ref,
        data: toUpdateTripDto(values, { notifyDriver: hadDriver, adminPassword }),
      })
      return { response, outgoingPartnerRef, outgoingDirectPartnerRef, wasFarmedOut }
    },
    success: () => `Trip ${trip?.ref} updated.`,
    error: 'Error updating booking.',
    invalidate: [getTripsControllerListQueryKey()],
    close: () => {
      setAdminPassword('')
      onOpenChange(false)
    },
    onSuccess: async ({ response, outgoingPartnerRef, outgoingDirectPartnerRef, wasFarmedOut }, values) => {
      if (response.notifyWarning) toast.warning(response.notifyWarning)
      // Farmed out here: recap the mission to the partner. Taken back off
      // them: tell them it's cancelled. Both open a review-then-send dialog —
      // nothing is sent until the dispatcher clicks Send in it.
      // …or handed to a different partner company: the new one is told too.
      const directPartnerChanged =
        !!values.directPartnerRef && values.directPartnerRef !== outgoingDirectPartnerRef
      const partnerDriverChanged =
        !values.subContractorNoDriver && !!values.partnerRef && values.partnerRef !== outgoingPartnerRef
      if (values.subContractor && (!wasFarmedOut || directPartnerChanged || partnerDriverChanged)) {
        setEmailTarget({ ref: trip!.ref, kind: 'assigned' })
      } else if (wasFarmedOut && !values.subContractor && outgoingPartnerRef) {
        setEmailTarget({ ref: trip!.ref, kind: 'cancelled', partnerRef: outgoingPartnerRef })
      } else if (response.subcontractUpdateRequired) {
        // Same partner, but the job they were sent has changed: the status went
        // back to Sent and they get the updated recap, with fresh Confirm/Decline
        // buttons (the old email's links no longer work).
        setEmailTarget({ ref: trip!.ref, kind: 'updated' })
      }
    },
    disabled: !trip || pastLockout,
  })

  const priceEur = record.form.watch('priceEur')
  const partnerRateEur = record.form.watch('partnerRateEur')
  const priceChanged =
    !!trip &&
    isTripCompleted(trip) &&
    (Number(priceEur ?? 0) !== Number(trip.priceEur ?? 0) ||
      Number(partnerRateEur ?? 0) !== Number(trip.partnerRateEur ?? 0))

  return (
    <>
      <RecordFormDialog
        open={!!trip}
        onOpenChange={onOpenChange}
        title={`Edit booking${trip ? ` — ${trip.ref}` : ''}`}
        record={record}
        submitLabel={hadDriver ? 'Confirm and send' : 'Confirm'}
        submitDisabled={pastLockout || (priceChanged && !adminPassword)}
        contentClassName="sm:max-w-6xl"
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
          {priceChanged && (
            <div className="grid max-w-xs gap-1.5">
              <Label htmlFor="trip-admin-password">Admin code (your login password) — required to change the price of a finished trip</Label>
              <Input
                id="trip-admin-password"
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>
          )}
        </div>
      </RecordFormDialog>
      <SubcontractEmailDialog target={emailTarget} onOpenChange={(open) => !open && setEmailTarget(null)} />
    </>
  )
}
