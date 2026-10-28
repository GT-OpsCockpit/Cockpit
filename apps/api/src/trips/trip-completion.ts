import { currentStep } from '@cockpit/shared';

/** The statuses a dispatcher may close by hand: the partner has been sent the job, or has confirmed it. */
const COMPLETABLE_STEPS = ['TRANSMITTED', 'ACCEPTED'];

export interface TripForCompletion {
  subContractor: boolean;
  assignmentCancelled: boolean;
  partnerDeclinedAt: Date | null;
  invoiced: boolean;
  steps: { step: string }[];
}

/**
 * Why a booking cannot be closed by hand, or null when it can. Only a
 * sub-contracted booking sitting at Sent or Confirmed qualifies: our own
 * drivers close theirs from the driver link, and anything cancelled, declined
 * or already billed is not a finished job.
 */
export function subcontractCompletionBlocker(
  trip: TripForCompletion,
): string | null {
  if (!trip.subContractor) {
    return 'Only a sub-contracted trip can be ended by hand.';
  }
  if (trip.assignmentCancelled) return 'This trip is cancelled (Stop status).';
  if (trip.partnerDeclinedAt) {
    return 'The partner declined this trip: reassign it first.';
  }
  if (trip.invoiced) return 'This trip is already invoiced.';
  const status = currentStep(trip.steps);
  if (!status || !COMPLETABLE_STEPS.includes(status)) {
    return 'Only a trip at Sent or Confirmed can be ended by hand.';
  }
  return null;
}

/**
 * A finished booking — marked Done, already on an invoice, or given to a partner
 * company and past its pickup time (billable from a minute after it, see
 * tripWindow). It can no longer be cancelled: cancelling would pull a job that
 * was done out of the billing.
 */
export function isTripCompleted(
  trip: {
    invoiced: boolean;
    steps: { step: string }[];
    directPartnerId: string | null;
    partnerDeclinedAt: Date | null;
    pickupAt: Date;
  },
  now: Date,
): boolean {
  if (trip.invoiced || trip.steps.some((s) => s.step === 'DROPPED')) return true;
  return (
    !!trip.directPartnerId &&
    !trip.partnerDeclinedAt &&
    trip.pickupAt.getTime() < now.getTime() - 60_000
  );
}

/**
 * The step a dispatcher may record by hand on a sub-contracted booking:
 * "Send ?" / "Updated - Send ?" → Sent, then Sent → Confirmed — for a partner
 * told by phone or by their own mail, outside the app. Null when there is
 * nothing to record (cancelled, declined, invoiced, already Confirmed or
 * beyond).
 */
export function nextSubcontractStep(
  trip: TripForCompletion & { partnerUpdatePending: boolean },
): 'TRANSMITTED' | 'ACCEPTED' | null {
  if (!trip.subContractor) return null;
  if (trip.assignmentCancelled || trip.partnerDeclinedAt || trip.invoiced) {
    return null;
  }
  if (trip.partnerUpdatePending) return 'TRANSMITTED';
  const status = currentStep(trip.steps);
  if (!status) return 'TRANSMITTED';
  if (status === 'TRANSMITTED' || status === 'RECEIVED') return 'ACCEPTED';
  return null;
}
