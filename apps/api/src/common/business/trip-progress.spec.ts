import { TripStepKind } from '../../../generated/prisma/enums';
import { currentStep, isBeforeArrival } from './trip-progress';

const trip = (steps: TripStepKind[], assignmentCancelled = false) => ({
  steps: steps.map((step) => ({ step })),
  assignmentCancelled,
});

describe('currentStep', () => {
  it('returns the furthest step reached, whatever order the rows come back in', () => {
    expect(currentStep([])).toBeNull();
    // Deliberately not in pipeline order: the rows come from the database,
    // and reading the last one would give RECEIVED here.
    expect(
      currentStep([
        { step: TripStepKind.ENROUTE },
        { step: TripStepKind.TRANSMITTED },
        { step: TripStepKind.RECEIVED },
      ]),
    ).toBe(TripStepKind.ENROUTE);
  });
});

describe('isBeforeArrival', () => {
  it('is true right up to the moment the driver is in position', () => {
    expect(isBeforeArrival(trip([]))).toBe(true);
    expect(isBeforeArrival(trip([TripStepKind.TRANSMITTED]))).toBe(true);
    expect(
      isBeforeArrival(trip([TripStepKind.TRANSMITTED, TripStepKind.RECEIVED])),
    ).toBe(true);
    expect(
      isBeforeArrival(
        trip([
          TripStepKind.TRANSMITTED,
          TripStepKind.RECEIVED,
          TripStepKind.ACCEPTED,
          TripStepKind.ENROUTE,
        ]),
      ),
    ).toBe(true);
  });

  it('is false from "In position" onwards', () => {
    const upToArrived = [
      TripStepKind.TRANSMITTED,
      TripStepKind.RECEIVED,
      TripStepKind.ACCEPTED,
      TripStepKind.ENROUTE,
      TripStepKind.ARRIVED,
    ];
    expect(isBeforeArrival(trip(upToArrived))).toBe(false);
    expect(isBeforeArrival(trip([...upToArrived, TripStepKind.ONBOARD]))).toBe(
      false,
    );
    expect(
      isBeforeArrival(
        trip([...upToArrived, TripStepKind.ONBOARD, TripStepKind.DROPPED]),
      ),
    ).toBe(false);
  });

  // A cancelled assignment has no driver on the way, so there is no on-site
  // contact to hand over either.
  it('is false for a cancelled assignment, however far it had got', () => {
    expect(isBeforeArrival(trip([], true))).toBe(false);
    expect(isBeforeArrival(trip([TripStepKind.RECEIVED], true))).toBe(false);
  });
});
