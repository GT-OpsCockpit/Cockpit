import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { CreateTripDto } from '@cockpit/shared/api'
import {
  getTripsControllerListQueryKey,
  useTripsControllerCreate,
  useTripsControllerDispatchDriver,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { TripFormFields } from './trip-form-fields'
import { tripFormDefaults, tripFormSchema, type TripFormValues } from './trip-form-schema'
import { toPickupAt } from './trip-form-mapping'

const DRAFT_KEY = 'newBookingDraft'

function loadDraft(): TripFormValues {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return tripFormDefaults()
    return { ...tripFormDefaults(), ...JSON.parse(raw) }
  } catch {
    return tripFormDefaults()
  }
}

function saveDraft(values: TripFormValues) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
  } catch {
    // storage unavailable — nothing to do
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

function toCreateTripDto(values: TripFormValues, { dispatch }: { dispatch: boolean }): CreateTripDto {
  const dto: CreateTripDto = {
    countryCode: values.countryCode,
    area: values.area,
    pickupAt: toPickupAt(values),
    pickupLocation: values.pickupLocation,
    dropoffLocation: values.dropoffLocation || undefined,
    service: values.service,
    hours: values.service === 'ASD' ? values.hours : undefined,
    instructions: values.instructions || undefined,
    clientRef: values.clientRef,
    passengerName: values.passengerName,
    pocName: values.pocName || undefined,
    pocPhone: values.pocPhone || undefined,
    tracking: values.tracking,
    paxCount: values.paxCount,
    vehicleType: values.vehicleType,
    priceEur: values.priceEur,
    billing: values.billing,
    flightNumber: values.flightNumber || undefined,
    bufferTime: values.bufferTime,
    fboAddress: values.fboAddress || undefined,
    tailNbr: values.tailNbr || undefined,
    pickupIata: values.pickupIata || undefined,
    dropoffIata: values.dropoffIata || undefined,
  }

  // Plain "Create" never wires up an internal driver/vehicle — that's reserved for
  // "Create & Dispatch". A Sub-C assignment is kept either way: the booking is
  // farmed out from the moment it's created, dispatch or not.
  if (dispatch) {
    dto.driverRef = values.driverRef || undefined
    dto.fleetRegNbr = values.fleetRegNbr || undefined
  }
  if (values.subContractor) {
    dto.subContractor = true
    dto.partnerRef = values.partnerRef || undefined
    dto.partnerRateEur = values.partnerRateEur
  }

  return dto
}

export function BookingCreationBar() {
  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: loadDraft(),
  })

  useEffect(() => {
    const subscription = form.watch((values) => saveDraft(values as TripFormValues))
    return () => subscription.unsubscribe()
  }, [form])

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
    form.reset(tripFormDefaults())
    clearDraft()
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
    <Card>
      <CardHeader>
        <CardTitle>New booking</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onCreate}>
            <TripFormFields form={form} />
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={submitting}>
                Create
              </Button>
              <Button type="button" variant="secondary" disabled={submitting || !canDispatch} onClick={onCreateAndDispatch}>
                Create &amp; Dispatch
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
