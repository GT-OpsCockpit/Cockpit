/** Steps the driver/partner can trigger themselves, from the public driver link. */
export type DriverStep = 'ACCEPTED' | 'ENROUTE' | 'ARRIVED' | 'ONBOARD' | 'DROPPED';

/** The full pipeline, including the two dispatcher/system-driven steps. */
export type TripStep = 'TRANSMITTED' | 'RECEIVED' | DriverStep;

export const DRIVER_STEP_ORDER: readonly DriverStep[];
export const TRIP_STEP_ORDER: readonly TripStep[];

export function currentStep<T extends string>(steps: { step: T }[]): T | null;

export function isBeforeArrival(trip: {
  steps: { step: string }[];
  assignmentCancelled: boolean;
}): boolean;
