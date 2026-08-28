import { TripStepKind } from '../../../generated/prisma/enums';
import { FULL_STEP_ORDER } from '../constants/step-order';

/** The furthest step a trip has reached, or null if it hasn't started. */
export function currentStep(
  steps: { step: TripStepKind }[],
): TripStepKind | null {
  const present = new Set(steps.map((s) => s.step));
  let last: TripStepKind | null = null;
  for (const key of FULL_STEP_ORDER) if (present.has(key)) last = key;
  return last;
}

/**
 * Whether the driver has yet to arrive on site.
 *
 * The legacy gated the POC (on-site contact) on this: changing who meets the
 * passenger only makes sense while nobody is there yet — once the driver is
 * "In position" the name and number the dispatcher would be editing are the
 * ones already in use on the ground. Ported from isBeforeArrival
 * (common.js:2391); a cancelled assignment is not "before arrival" either,
 * there is nothing to meet.
 */
export function isBeforeArrival(trip: {
  steps: { step: TripStepKind }[];
  assignmentCancelled: boolean;
}): boolean {
  if (trip.assignmentCancelled) return false;
  const step = currentStep(trip.steps);
  if (!step) return true;
  return (
    FULL_STEP_ORDER.indexOf(step) <
    FULL_STEP_ORDER.indexOf(TripStepKind.ARRIVED)
  );
}
