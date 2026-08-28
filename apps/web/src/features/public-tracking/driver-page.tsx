import { useState } from 'react'
import { useParams } from 'react-router'
import { DateTime } from 'luxon'
import { toast } from 'sonner'
import {
  useTripsControllerGetPublic,
  useTripsControllerNotify,
  NotifyStepDtoStep,
  TripStepEntityStep,
  type PublicTripEntity,
} from '@cockpit/shared/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { pickupLocalInstant } from '@/features/bookings/trip-status'
import { usePublicTripEvents } from './use-public-trip-events'
import { PublicPageShell, PublicPageEmpty, InfoRow, StepIcon } from './public-trip-ui'
import { retryPublicQuery } from './retry-public-query'

// Auto-recorded server-side (no button: transmitted as soon as the driver is
// assigned, received as soon as this page is opened) — see TripsService.getPublic.
const AUTO_STEPS = [
  { key: TripStepEntityStep.TRANSMITTED, title: 'Sent to driver' },
  { key: TripStepEntityStep.RECEIVED, title: 'Received by driver' },
] as const

const ACTION_STEPS = [
  { key: NotifyStepDtoStep.ACCEPTED, title: 'Accepted by driver', sub: 'Confirm that you are taking this trip' },
  { key: NotifyStepDtoStep.ENROUTE, title: 'On the way', sub: 'Heading to the pickup point' },
  { key: NotifyStepDtoStep.ARRIVED, title: 'In position', sub: 'Arrived at the pickup point' },
  { key: NotifyStepDtoStep.ONBOARD, title: 'Passenger on board', sub: 'Departing for the destination' },
  { key: NotifyStepDtoStep.DROPPED, title: 'Drop-off completed', sub: 'Trip completed' },
] as const

function stepTime(steps: PublicTripEntity['steps'], step: string): string | null {
  const found = steps.find((s) => s.step === step)
  return found ? DateTime.fromISO(found.occurredAt).toFormat('HH:mm') : null
}

export function DriverPage() {
  const { ref = '' } = useParams()
  // The app-wide default is retry: false (see lib/query-client.ts) — right
  // for authenticated queries, where a failure is almost always a 401 that
  // should redirect straight to /login instead of retrying. This public page
  // has no login to redirect to, and a transient failure (a driver's phone
  // briefly losing signal, say) should behave at least as well as the
  // legacy's dumb 5s-polling reload did — see retryPublicQuery.
  const query = useTripsControllerGetPublic(ref, { viewer: 'driver' }, { query: { retry: retryPublicQuery } })
  const notify = useTripsControllerNotify()
  const [pendingStep, setPendingStep] = useState<NotifyStepDtoStep | null>(null)

  usePublicTripEvents(ref, () => void query.refetch())

  async function handleNotify(step: NotifyStepDtoStep) {
    setPendingStep(step)
    try {
      await notify.mutateAsync({ ref, data: { step } })
      void query.refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error sending notification.'))
    } finally {
      setPendingStep(null)
    }
  }

  if (query.isLoading) {
    return (
      <PublicPageShell>
        <PublicPageEmpty>Loading…</PublicPageEmpty>
      </PublicPageShell>
    )
  }

  if (query.isError || !query.data) {
    return (
      <PublicPageShell>
        <PublicPageEmpty>Trip not found for ref {ref}.</PublicPageEmpty>
      </PublicPageShell>
    )
  }

  const trip = query.data
  const doneSteps = new Set(trip.steps.map((s) => s.step))
  const pickup = pickupLocalInstant(trip)

  return (
    <PublicPageShell>
      <div className="bg-primary text-primary-foreground px-6 py-5">
        <p className="text-xs font-medium tracking-wide uppercase opacity-80">Ref {trip.ref}</p>
        <h1 className="mt-1 text-lg font-semibold">Hello {trip.driverName || 'Driver'}</h1>
      </div>

      {!trip.tracking && (
        <div className="border-warning/30 bg-warning/10 text-warning-foreground border-b px-6 py-3 text-xs">
          Tracking disabled for this trip: steps are recorded but no WhatsApp message is sent.
        </div>
      )}

      <div className="space-y-2.5 border-b px-6 py-4 text-sm">
        <InfoRow label="Account" value={`${trip.clientName} (${trip.clientRef})`} />
        <InfoRow
          label="Passenger"
          value={`${trip.passengerName}${trip.paxCount ? ` · ${trip.paxCount} pax` : ''}`}
        />
        {trip.tracking && <InfoRow label="POC WhatsApp" value={`${trip.pocName ?? ''} (${trip.pocPhone ?? '—'})`} />}
        <InfoRow label="Date / time" value={`${pickup.toFormat('dd/MM/yyyy')} at ${pickup.toFormat('HH:mm')} (local time)`} />
        <InfoRow label="Pickup" value={trip.pickupLocation} />
        <InfoRow label="Destination" value={trip.dropoffLocation || '—'} />
        {trip.vehicleTypeName && <InfoRow label="Vehicle" value={trip.vehicleTypeName} />}
        {trip.instructions && <InfoRow label="Info" value={trip.instructions} />}
      </div>

      <div className="px-6">
        {AUTO_STEPS.map((step) => {
          const done = doneSteps.has(step.key)
          const time = stepTime(trip.steps, step.key)
          return (
            <div key={step.key} className="flex items-center gap-3.5 border-b py-3.5 opacity-70 last:border-b-0">
              <StepIcon done={done} step={step.key} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-muted-foreground text-xs">{done ? time : 'Automatic'}</p>
              </div>
            </div>
          )
        })}
        {ACTION_STEPS.map((step) => {
          const done = doneSteps.has(step.key)
          const time = stepTime(trip.steps, step.key)
          const actionLabel = done ? 'Resend' : trip.tracking ? 'Notify' : 'Mark'
          return (
            <div key={step.key} className="flex items-center gap-3.5 border-b py-3.5 last:border-b-0">
              <StepIcon done={done} step={step.key} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-muted-foreground text-xs">{step.sub}</p>
                {done && (
                  <p className="text-primary mt-0.5 text-xs font-semibold">
                    {trip.tracking ? 'Sent at' : 'Marked at'} {time}
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant={done ? 'secondary' : 'default'}
                disabled={pendingStep === step.key}
                aria-label={`${actionLabel} — ${step.title}`}
                onClick={() => void handleNotify(step.key)}
              >
                {pendingStep === step.key ? 'Sending…' : actionLabel}
              </Button>
            </div>
          )
        })}
      </div>

      <p className="text-muted-foreground px-6 py-4 text-xs leading-relaxed">
        {trip.tracking
          ? 'Each button automatically sends a WhatsApp message to the POC — no further action required.'
          : 'Tracking disabled: buttons just mark progress, without sending any WhatsApp message.'}
      </p>
    </PublicPageShell>
  )
}
