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
