import { TripStepKind } from '../../../generated/prisma/enums';

/** Steps the driver/partner can trigger themselves (public driver link). */
export const STEP_ORDER: TripStepKind[] = [
  TripStepKind.ACCEPTED,
  TripStepKind.ENROUTE,
  TripStepKind.ARRIVED,
  TripStepKind.ONBOARD,
  TripStepKind.DROPPED,
];

/** Full pipeline, including the two dispatcher/system-driven steps. */
export const FULL_STEP_ORDER: TripStepKind[] = [
  TripStepKind.TRANSMITTED,
  TripStepKind.RECEIVED,
  ...STEP_ORDER,
];
