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
import { Form } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TripFormFields } from './trip-form-fields'
import { tripFormDefaults, tripFormSchema, type TripFormValues } from './trip-form-schema'
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
 * never locked. See docs/feature-requests/booking-creation-modal.md.
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

  const driverRef = form.watch('driverRef')
  const fleetRegNbr = form.watch('fleetRegNbr')
  const subContractor = form.watch('subContractor')
  const partnerRef = form.watch('partnerRef')

  // Two independent ways to be ready to dispatch: a Partner (farmed out), or a
  // Driver with a Fleet vehicle actually assigned. Both at once is a conflicting
  // state, blocked outright until the dispatcher clears one of the two.
  const driverBranchOk = !!driverRef && !!fleetRegNbr
  const partnerBranchOk = !!subContractor && !!partnerRef
  const conflict = driverBranchOk && partnerBranchOk
  const canDispatch = !conflict && (driverBranchOk || partnerBranchOk)

  const afterCreate = () => {
    clearDraft(draftKey)
    onOpenChange(false)
    void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
  }

  const onCreate = form.handleSubmit(async (values) => {
    try {
      const trip = await createTrip.mutateAsync({ data: toCreateTripDto(values, { dispatch: false }) })
      toast.success(`Trip ${trip.ref} created (account ${trip.client.ref}).`)
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
      afterCreate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error during creation.'))
    }
  })

  const submitting = createTrip.isPending || dispatchDriver.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onCreate}>
            <TripFormFields
              form={form}
              clientSeedOption={prefill?.clientRef ? { value: prefill.clientRef, label: prefill.clientLabel ?? prefill.clientRef } : null}
              driverSeedOption={prefill?.driverRef ? { value: prefill.driverRef, label: prefill.driverLabel ?? prefill.driverRef } : null}
              partnerSeedOption={prefill?.partnerRef ? { value: prefill.partnerRef, label: prefill.partnerLabel ?? prefill.partnerRef } : null}
              regNbrSeedOption={prefill?.fleetRegNbr ? { value: prefill.fleetRegNbr, label: prefill.regNbrLabel ?? prefill.fleetRegNbr } : null}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner /> : <Plus />}
                Create
              </Button>
              <Button type="button" variant="secondary" disabled={submitting || !canDispatch} onClick={onCreateAndDispatch}>
                {submitting ? <Spinner /> : <Send />}
                Create &amp; Dispatch
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
