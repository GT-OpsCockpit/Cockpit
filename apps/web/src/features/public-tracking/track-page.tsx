import { useParams } from 'react-router'
import { DateTime } from 'luxon'
import { useTripsControllerGetPublic, NotifyStepDtoStep, type PublicTripEntity } from '@cockpit/shared/api'
import { pickupLocalInstant } from '@/features/bookings/trip-status'
import { usePublicTripEvents } from './use-public-trip-events'
import { PublicPageShell, PublicPageEmpty, InfoRow, StepIcon } from './public-trip-ui'
import { retryPublicQuery } from './retry-public-query'

// Fewer steps than the driver page: no "enroute" — matches the legacy
// dashboard.html, which never surfaced that intermediate step to the client.
const TRACK_STEPS = [
  { key: NotifyStepDtoStep.ACCEPTED, title: 'Trip accepted', sub: 'The driver has accepted the trip' },
  { key: NotifyStepDtoStep.ARRIVED, title: 'In position', sub: 'The driver has arrived' },
  { key: NotifyStepDtoStep.ONBOARD, title: 'Passenger picked up', sub: 'On the way to the destination' },
  { key: NotifyStepDtoStep.DROPPED, title: 'Dropped off', sub: 'Trip completed' },
] as const

function stepTime(steps: PublicTripEntity['steps'], step: string): string | null {
  const found = steps.find((s) => s.step === step)
  return found ? DateTime.fromISO(found.occurredAt).toFormat('HH:mm') : null
}

export function TrackPage() {
  const { ref = '' } = useParams()
  // See driver-page.tsx for why this overrides the app-wide retry: false.
  const query = useTripsControllerGetPublic(ref, {}, { query: { retry: retryPublicQuery } })

  usePublicTripEvents(ref, () => void query.refetch())

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
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase opacity-80">
          <span className="bg-success size-2 animate-pulse rounded-full" aria-hidden />
          Ref {trip.ref} — live tracking
        </p>
        <h1 className="mt-1 text-lg font-semibold">{trip.passengerName || trip.clientName}</h1>
      </div>

      <div className="space-y-2.5 border-b px-6 py-4 text-sm">
        <InfoRow label="Account" value={`${trip.clientName} (${trip.clientRef})`} />
        <InfoRow label="Driver" value={trip.driverName || 'To be confirmed'} />
        <InfoRow label="Date / time" value={`${pickup.toFormat('dd/MM/yyyy')} at ${pickup.toFormat('HH:mm')} (local time)`} />
        <InfoRow label="Pickup" value={trip.pickupLocation} />
        <InfoRow label="Destination" value={trip.dropoffLocation || '—'} />
        {trip.vehicleTypeName && <InfoRow label="Vehicle" value={trip.vehicleTypeName} />}
      </div>

      <div className="px-6">
        {TRACK_STEPS.map((step) => {
          const done = doneSteps.has(step.key)
          const time = stepTime(trip.steps, step.key)
          return (
            <div key={step.key} className="flex items-center gap-3.5 border-b py-3.5 last:border-b-0">
              <StepIcon done={done} step={step.key} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-muted-foreground text-xs">{step.sub}</p>
                {done && <p className="text-primary mt-0.5 text-xs font-semibold">Confirmed at {time}</p>}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-muted-foreground px-6 py-4 text-xs leading-relaxed">
        Updates live — no need to refresh this page.
      </p>
    </PublicPageShell>
  )
}
