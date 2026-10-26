import { currentStep, TRIP_STEP_ORDER } from '@cockpit/shared'
import { TripStepEntityStep } from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'

/**
 * Where a booking is in the driver pipeline, and what the dispatcher may do
 * about it from the board — the status badge, its label, whether it can be
 * advanced, and the state of the Send button.
 *
 * The pipeline order and the arrival rule are the API's too and live in
 * @cockpit/shared/business/trip-progress.js. How a booking *reads* in a row is
 * trip-display.ts; what is in view is booking-filters.ts.
 */

export const STEP_ORDER = TRIP_STEP_ORDER as readonly TripStepEntityStep[]

// Text only — the leading emoji the legacy used are lucide icons now, rendered
// alongside the label by StatusBadge. Keeping the labels plain also keeps
// them usable outside React (the invoice Excel export).
export const STEP_LABELS: Record<TripStepEntityStep, string> = {
  TRANSMITTED: 'Sent',
  RECEIVED: 'Received',
  ACCEPTED: 'Confirmed',
  ENROUTE: 'OTW',
  ARRIVED: 'IP',
  ONBOARD: 'POB',
  DROPPED: 'Done',
}

export const CANCELLED_LABEL = 'Stop'

/** The sub-contracted partner declined it from their email — to be reassigned. */
export const DECLINED_LABEL = 'Declined'

/** Edited after it was sent to its partner: the updated email is still to be sent. */
export const UPDATE_PENDING_LABEL = 'Updated - Send ?'

export const NO_STATUS_LABEL = 'Send ?'

// Steps kept as a solid badge; everything else is plain colored text (matches
// the legacy's HIGHLIGHTED_STEPS distinction).
export const HIGHLIGHTED_STEPS: NonNullable<TripStatus>[] = [
  TripStepEntityStep.TRANSMITTED,
  TripStepEntityStep.RECEIVED,
  TripStepEntityStep.ACCEPTED,
  TripStepEntityStep.DROPPED,
  'CANCELLED',
  'DECLINED',
  'UPDATE_PENDING',
]

// Steps from which the dispatcher can click the badge to validate the next
// one — everything except the last step (Done) and cancellation (Stop).
export const ADVANCEABLE_STEPS: TripStepEntityStep[] = [
  TripStepEntityStep.TRANSMITTED,
  TripStepEntityStep.RECEIVED,
  TripStepEntityStep.ACCEPTED,
  TripStepEntityStep.ENROUTE,
  TripStepEntityStep.ARRIVED,
  TripStepEntityStep.ONBOARD,
]

export type TripStatus = TripStepEntityStep | 'CANCELLED' | 'DECLINED' | 'UPDATE_PENDING' | null

/** Latest step reached, or 'CANCELLED' if the assignment was pulled — mirrors the legacy's currentStatus(). */
export function currentStatus(trip: TripEntity): TripStatus {
  if (trip.assignmentCancelled) return 'CANCELLED'
  if (trip.partnerDeclinedAt && trip.subContractor) return 'DECLINED'
  if (trip.partnerUpdatePending && trip.subContractor) return 'UPDATE_PENDING'
  return currentStep(trip.steps)
}

/** A sub-contracted job with no specific partner driver on file is pinned at "Sent" server-side — the badge is never clickable in that case. */
export function isStatusLocked(trip: TripEntity): boolean {
  return trip.subContractor && !trip.partnerId
}

/**
 * A sub-contracted booking at Sent or Confirmed can be closed by hand by an
 * admin (the partner has no driver link to mark it Done), which is what lets it
 * be invoiced. Mirrors the API's subcontractCompletionBlocker.
 */
export function isStatusCompletable(trip: TripEntity): boolean {
  const status = currentStatus(trip)
  return (
    trip.subContractor &&
    !trip.invoiced &&
    (status === TripStepEntityStep.TRANSMITTED || status === TripStepEntityStep.ACCEPTED)
  )
}

export function statusLabel(status: TripStatus): string {
  if (!status) return NO_STATUS_LABEL
  if (status === 'CANCELLED') return CANCELLED_LABEL
  if (status === 'DECLINED') return DECLINED_LABEL
  if (status === 'UPDATE_PENDING') return UPDATE_PENDING_LABEL
  return STEP_LABELS[status]
}

export function isStatusHighlighted(status: TripStatus): boolean {
  return !!status && HIGHLIGHTED_STEPS.includes(status)
}

export function isStatusAdvanceable(trip: TripEntity): boolean {
  const status = currentStatus(trip)
  // Stop / Declined / "Updated - Send ?" are not steps: nothing to validate next.
  return (
    !isStatusLocked(trip) &&
    !!status &&
    status !== 'CANCELLED' &&
    status !== 'DECLINED' &&
    status !== 'UPDATE_PENDING' &&
    ADVANCEABLE_STEPS.includes(status)
  )
}

/**
 * Local dispatch (own driver + own Fleet vehicle) needs both assigned before there's
 * anything complete to send — greyed out (not disabled) until then, mirroring the
 * legacy's dispatchActionButtonHtml. Doesn't apply to a sub-contracted or Farm-out trip.
 */
export function dispatchButtonState(trip: TripEntity, isLocal: boolean): { dimmed: boolean; disabled: boolean; title: string } {
  if (isLocal && !trip.subContractor) {
    const hasDriver = !!trip.driverId
    const hasVehicle = !!trip.fleetVehicleId
    if (!hasDriver || !hasVehicle) {
      const missingBoth = !hasDriver && !hasVehicle
      const title = missingBoth
        ? 'Assign a driver and a vehicle before sending to the driver'
        : hasDriver
          ? 'Assign a vehicle (Reg Nbr) before sending to the driver'
          : 'Assign a driver before sending'
      return { dimmed: true, disabled: false, title }
    }
  }
  // Farm-out / sub-contracted: nobody to send to until a partner (driver or
  // company) or an own driver is on the booking.
  if ((!isLocal || trip.subContractor) && !trip.driverId && !trip.partnerId && !trip.directPartnerId) {
    return { dimmed: true, disabled: false, title: 'Assign a partner or a driver before sending' }
  }
  return {
    dimmed: false,
    disabled: trip.dispatched,
    title: trip.dispatched ? 'Already sent — edit or reassign to send again' : 'Dispatch to the driver',
  }
}
