/**
 * Where a booking is in the driver pipeline. Ported from the legacy's step
 * bookkeeping (common.js) and shared rather than duplicated because the same
 * two questions are asked on both sides of the wire: the API enforces the POC
 * lock in TripsService.update(), and the booking form greys the POC fields out
 * before the dispatcher types (trip-form-fields.tsx). They must agree.
 *
 * Steps are plain strings on purpose — structurally identical to Prisma's
 * TripStepKind (api) and orval's TripStepEntityStep (web), so both tiers pass
 * their own enum values in without a conversion.
 *
 * Plain JS (not .ts) for the same reason as validation/email.js — see the
 * comment there.
 */

/** Steps the driver/partner can trigger themselves, from the public driver link. */
export const DRIVER_STEP_ORDER = [
  'ACCEPTED',
  'ENROUTE',
  'ARRIVED',
  'ONBOARD',
  'DROPPED',
];

/** The full pipeline, including the two dispatcher/system-driven steps. */
export const TRIP_STEP_ORDER = ['TRANSMITTED', 'RECEIVED', ...DRIVER_STEP_ORDER];

/**
 * The furthest step a trip has reached, or null if it hasn't started.
 * Insertion order is irrelevant — the pipeline order is what ranks them.
 */
export function currentStep(steps) {
  const present = new Set(steps.map((s) => s.step));
  let last = null;
  for (const key of TRIP_STEP_ORDER) if (present.has(key)) last = key;
  return last;
}

/**
 * Whether the driver has yet to arrive on site.
 *
 * The legacy gated the POC (on-site contact) on this: changing who meets the
 * passenger only makes sense while nobody is there yet — once the driver is
 * "In position" the name and number being edited are the ones already in use
 * on the ground. Ported from isBeforeArrival (common.js:2391); a cancelled
 * assignment is not "before arrival" either, there is nothing to meet.
 */
export function isBeforeArrival(trip) {
  if (trip.assignmentCancelled) return false;
  const step = currentStep(trip.steps);
  if (!step) return true;
  return TRIP_STEP_ORDER.indexOf(step) < TRIP_STEP_ORDER.indexOf('ARRIVED');
}
