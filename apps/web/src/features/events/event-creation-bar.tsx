import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { ClientEntity, CreateTripDto } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerCreate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { TripFormFields } from '../bookings/trip-form-fields'
import { tripFormDefaults, tripFormSchema, type TripFormValues } from '../bookings/trip-form-schema'
import { toPickupAt } from '../bookings/trip-form-mapping'
import { BulkDatesDialog } from './bulk-dates-dialog'

// Deliberately separate from Bookings' "newBookingDraft" key — an event-locked
// client ref should never leak onto the plain Bookings creation bar later.
const DRAFT_KEY = 'newEventBookingDraft'

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

function toCreateTripDto(values: TripFormValues): CreateTripDto {
  return {
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
    // No driver/vehicle/partner wiring — every event trip starts unassigned,
    // dispatched afterwards from the Ride list (bulk legs never dispatch either).
  }
}

/**
 * "New booking" bar for the Events page (events.html:63-228, minus the
 * dispatcher-specific bits): same TripFormFields as Bookings, but the
 * Customer field locks to the confirmed event once one is picked above, and
 * "Create & Dispatch" is replaced by "Create bulk" (dispatching one driver
 * at a time doesn't apply to a batch).
 */
export function EventCreationBar({ confirmedEvent }: { confirmedEvent: ClientEntity | null }) {
  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: loadDraft(),
  })
  const [bulkOpen, setBulkOpen] = useState(false)

  useEffect(() => {
    const subscription = form.watch((values) => saveDraft(values as TripFormValues))
    return () => subscription.unsubscribe()
  }, [form])

  useEffect(() => {
    form.setValue('clientRef', confirmedEvent?.ref ?? '')
  }, [confirmedEvent, form])

  const createTrip = useTripsControllerCreate()

  const afterCreate = () => {
    form.reset({ ...tripFormDefaults(), clientRef: confirmedEvent?.ref ?? '' })
    clearDraft()
    void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
  }

  const onCreate = form.handleSubmit(async (values) => {
    try {
      const trip = await createTrip.mutateAsync({ data: toCreateTripDto(values) })
      toast.success(`Trip ${trip.ref} created (account ${trip.client.ref}).`)
      afterCreate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error during creation.'))
    }
  })

  const onCreateBulk = async () => {
    if (!confirmedEvent?.eventStartDate || !confirmedEvent?.eventEndDate) {
      toast.error('Select an event above first (Client, in the Select event box).')
      return
    }
    const valid = await form.trigger()
    if (!valid) return
    setBulkOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New booking</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onCreate}>
            <TripFormFields
              form={form}
              clientFieldDisabled={!!confirmedEvent}
              clientSeedOption={confirmedEvent ? { value: confirmedEvent.ref, label: confirmedEvent.name } : null}
            />
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={createTrip.isPending}>
                Create
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={createTrip.isPending || !confirmedEvent}
                title={confirmedEvent ? undefined : 'Select an event above first'}
                onClick={onCreateBulk}
              >
                Create bulk
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      {confirmedEvent && (
        <BulkDatesDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          confirmedEvent={confirmedEvent}
          formValues={form.getValues()}
          onDone={afterCreate}
        />
      )}
    </Card>
  )
}
