import { useEffect } from 'react'
import { Plus, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  getTripsControllerListQueryKey,
  useTripsControllerCreate,
  useTripsControllerDispatchDriver,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { TripFormFields } from './trip-form-fields'
import { tripFormDefaults, tripFormSchema, type TripFormValues } from './trip-form-schema'
import { dispatchReadiness } from './booking-draft'
import { openSubcontractEmailDraft } from './subcontract-email'
import { toCreateTripDto } from './trip-form-mapping'

/**
 * A row's already-known client/driver/vehicle, carried into the form as a starting
 * point — still fully editable, never locked (only the Events flow locks a field, see
 * event-create-dialog.tsx). Each `*Label` mirrors the option format TripFormFields'
 * own combobox search would produce, so the seeded value renders correctly before any
 * search has run — see SearchCombobox's `selectedLabel`.
 */
export interface BookingPrefill {
  clientRef?: string
  clientLabel?: string
  driverRef?: string
  driverLabel?: string
  subContractor?: boolean
  partnerRef?: string
  partnerLabel?: string
  vehicleType?: string
  fleetRegNbr?: string
  regNbrLabel?: string
}

function loadDraft(draftKey: string): TripFormValues {
  try {
    const raw = localStorage.getItem(draftKey)
    if (!raw) return tripFormDefaults()
    return { ...tripFormDefaults(), ...JSON.parse(raw) }
  } catch {
    return tripFormDefaults()
  }
}

function saveDraft(draftKey: string, values: TripFormValues) {
  try {
    localStorage.setItem(draftKey, JSON.stringify(values))
  } catch {
    // storage unavailable — nothing to do
  }
}

function clearDraft(draftKey: string) {
  try {
    localStorage.removeItem(draftKey)
  } catch {
    // ignore
  }
}

function withPrefill(base: TripFormValues, prefill?: BookingPrefill): TripFormValues {
  if (!prefill) return base
  return {
    ...base,
    ...(prefill.clientRef !== undefined && { clientRef: prefill.clientRef }),
    ...(prefill.driverRef !== undefined && { driverRef: prefill.driverRef }),
    ...(prefill.subContractor !== undefined && { subContractor: prefill.subContractor }),
    ...(prefill.partnerRef !== undefined && { partnerRef: prefill.partnerRef }),
    ...(prefill.vehicleType !== undefined && { vehicleType: prefill.vehicleType }),
    ...(prefill.fleetRegNbr !== undefined && { fleetRegNbr: prefill.fleetRegNbr }),
  }
}

/**
 * "New booking" modal shared by the Bookings, Clients, Drivers, and Vehicles pages
 * (Events has its own EventCreateDialog — locked Customer field, "Create bulk" instead
 * of "Create & Dispatch", no driver/vehicle wiring). Opening it from a Clients/Drivers/
 * Vehicles row seeds the matching field via `prefill` — a convenience starting point,
 * never locked.
 */
export function BookingCreateDialog({
  open,
  onOpenChange,
  draftKey,
  prefill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftKey: string
  prefill?: BookingPrefill
}) {
  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: withPrefill(loadDraft(draftKey), prefill),
  })

  // Re-seeds from the latest draft + prefill every time the dialog opens — covers both
  // "closed without submitting, reopened later" and "opened from a different row" (the
  // prefill changes but this form instance stays mounted across opens/closes).
  useEffect(() => {
    if (open) form.reset(withPrefill(loadDraft(draftKey), prefill))
    // Deliberately only re-syncing on `open` — `prefill`/`draftKey` are read fresh
    // inside, not tracked as dependencies (they only matter at the moment of opening).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const subscription = form.watch((values) => saveDraft(draftKey, values as TripFormValues))
    return () => subscription.unsubscribe()
  }, [form, draftKey])

  const createTrip = useTripsControllerCreate()
  const dispatchDriver = useTripsControllerDispatchDriver()

  // Whether this draft can go straight out to a driver — and, when it cannot,
  // why: the button being greyed out was the form's one silent dead end. The
  // rule lives beside the `subContractor` cascade that maintains the same
  // exclusivity (booking-draft.ts), not in this dialog.
  const { canDispatch, blockedReason } = dispatchReadiness(form.watch())

  const afterCreate = () => {
    clearDraft(draftKey)
    onOpenChange(false)
    void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
  }

  const onCreate = form.handleSubmit(async (values) => {
    try {
      const trip = await createTrip.mutateAsync({ data: toCreateTripDto(values, { dispatch: false }) })
      toast.success(`Trip ${trip.ref} created (account ${trip.client.ref}).`)
      if (values.subContractor) {
        await openSubcontractEmailDraft(trip.ref, 'assigned')
      }
      afterCreate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error during creation.'))
    }
  })

  const onCreateAndDispatch = form.handleSubmit(async (values) => {
    try {
      const trip = await createTrip.mutateAsync({ data: toCreateTripDto(values, { dispatch: true }) })
      try {
        await dispatchDriver.mutateAsync({ ref: trip.ref })
        toast.success(`Trip ${trip.ref} created and dispatched.`)
      } catch (dispatchError) {
        toast.error(`Trip ${trip.ref} created, but dispatch failed: ${getApiErrorMessage(dispatchError, 'unknown error')}`)
      }
      // Independent of whether the WhatsApp dispatch above succeeded — the
      // email is its own notification channel (common.js:4400).
      if (values.subContractor) {
        await openSubcontractEmailDraft(trip.ref, 'assigned')
      }
      afterCreate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error during creation.'))
    }
  })

  const submitting = createTrip.isPending || dispatchDriver.isPending

  return (
    <RecordFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New booking"
      record={{ form, onSubmit: onCreate, isSubmitting: submitting }}
      submitLabel="Create"
      submitIcon={<Plus />}
      contentClassName="sm:max-w-4xl"
      layout="scroll-body"
      actions={
        <Tooltip>
          {/* A disabled button fires no pointer events, so the trigger has to
              be the wrapper rather than the button itself. */}
          <TooltipTrigger asChild>
            <span className={canDispatch ? undefined : 'cursor-not-allowed'}>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting || !canDispatch}
                onClick={onCreateAndDispatch}
              >
                {submitting ? <Spinner /> : <Send />}
                Create &amp; Dispatch
              </Button>
            </span>
          </TooltipTrigger>
          {!canDispatch && <TooltipContent>{blockedReason}</TooltipContent>}
        </Tooltip>
      }
    >
      <TripFormFields
        form={form}
        clientSeedOption={prefill?.clientRef ? { value: prefill.clientRef, label: prefill.clientLabel ?? prefill.clientRef } : null}
        driverSeedOption={prefill?.driverRef ? { value: prefill.driverRef, label: prefill.driverLabel ?? prefill.driverRef } : null}
        partnerSeedOption={prefill?.partnerRef ? { value: prefill.partnerRef, label: prefill.partnerLabel ?? prefill.partnerRef } : null}
        regNbrSeedOption={prefill?.fleetRegNbr ? { value: prefill.fleetRegNbr, label: prefill.regNbrLabel ?? prefill.fleetRegNbr } : null}
      />
    </RecordFormDialog>
  )
}
