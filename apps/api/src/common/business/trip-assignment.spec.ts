import { Role } from '../../../generated/prisma/enums';
import {
  decideAssignment,
  type TripBeforeEdit,
  type TripEditIntent,
} from './trip-assignment';

const NOW = new Date('2026-09-02T10:00:00.000Z');
const FUTURE = new Date('2026-09-05T10:00:00.000Z');
const PAST = new Date('2026-08-20T10:00:00.000Z');

const ADMIN: { role: Role } = { role: Role.ADMIN };
const DISPATCHER: { role: Role } = { role: Role.DISPATCHER };

const before = (overrides: Partial<TripBeforeEdit> = {}): TripBeforeEdit => ({
  pickupAt: FUTURE,
  driverId: 'driver-1',
  partnerId: null,
  priceEur: 200,
  partnerRateEur: 150,
  pocName: 'Jane Doe',
  pocPhone: '+33612345678',
  steps: [],
  assignmentCancelled: false,
  ...overrides,
});

/** The after-state a caller that changes nothing would build. */
const unchanged = (
  overrides: Partial<TripEditIntent> = {},
): TripEditIntent => ({
  driverId: 'driver-1',
  partnerId: null,
  subContractor: false,
  tracking: true,
  priceEur: 200,
  partnerRateEur: 150,
  pocName: 'Jane Doe',
  pocPhone: '+33612345678',
  notifyPoc: false,
  ...overrides,
});

const decide = (
  b: TripBeforeEdit,
  a: TripEditIntent,
  user = ADMIN,
  pastEditAction: 'Editing' | 'Reassigning' = 'Editing',
) => decideAssignment(b, a, user, { now: NOW, pastEditAction });

describe('permission refusals', () => {
  it('lets a dispatcher edit a booking whose pickup is still ahead', () => {
    expect(decide(before(), unchanged(), DISPATCHER).refusal).toBeNull();
  });

  it('refuses a dispatcher editing a booking whose pickup has passed', () => {
    expect(
      decide(before({ pickupAt: PAST }), unchanged(), DISPATCHER).refusal,
    ).toEqual({
      kind: 'forbidden',
      message:
        'Editing a booking whose pickup is already in the past requires the Admin role.',
    });
  });

  it('names what the caller was denied — the Planning drag & drop reassigns, it does not edit', () => {
    const decision = decide(
      before({ pickupAt: PAST }),
      unchanged(),
      DISPATCHER,
      'Reassigning',
    );
    expect(decision.refusal?.message).toBe(
      'Reassigning a booking whose pickup is already in the past requires the Admin role.',
    );
  });

  it('lets an admin past both, however far in the past', () => {
    expect(
      decide(before({ pickupAt: PAST }), unchanged(), ADMIN).refusal,
    ).toBeNull();
  });

  it('refuses a dispatcher changing either rate', () => {
    expect(
      decide(before(), unchanged({ priceEur: 250 }), DISPATCHER).refusal?.kind,
    ).toBe('forbidden');
    expect(
      decide(before(), unchanged({ partnerRateEur: 90 }), DISPATCHER).refusal
        ?.kind,
    ).toBe('forbidden');
  });

  it('lets a dispatcher save a booking whose rates it is not touching', () => {
    expect(
      decide(before(), unchanged({ pocName: 'John Roe' }), DISPATCHER).refusal,
    ).toBeNull();
  });

  // A caller that cannot reach the price at all (PATCH /assign) passes the
  // stored values straight back, and must not trip the price gate.
  it('sees no price change when the rates are handed back unchanged', () => {
    expect(
      decide(
        before({ priceEur: null, partnerRateEur: null }),
        unchanged({ priceEur: null, partnerRateEur: null }),
        DISPATCHER,
      ).refusal,
    ).toBeNull();
  });
});

describe('the POC lock', () => {
  const upTo = (...steps: string[]) => steps.map((step) => ({ step }));

  it('lets the POC be changed while nobody is on site yet', () => {
    const decision = decide(
      before({ steps: upTo('TRANSMITTED', 'RECEIVED', 'ACCEPTED', 'ENROUTE') }),
      unchanged({ pocName: 'John Roe' }),
    );
    expect(decision.refusal).toBeNull();
  });

  it('refuses it once the driver is in position — no role lifts this', () => {
    const inPosition = before({
      steps: upTo('TRANSMITTED', 'RECEIVED', 'ACCEPTED', 'ENROUTE', 'ARRIVED'),
    });
    expect(
      decide(inPosition, unchanged({ pocName: 'John Roe' }), ADMIN).refusal,
    ).toEqual({
      kind: 'invalid',
      message:
        'The POC can no longer be changed: the driver is already in position.',
    });
    expect(
      decide(inPosition, unchanged({ pocPhone: '+33700000000' }), ADMIN).refusal
        ?.kind,
    ).toBe('invalid');
  });

  it('still allows an unrelated edit on a booking already in position', () => {
    const inPosition = before({
      steps: upTo('TRANSMITTED', 'RECEIVED', 'ACCEPTED', 'ENROUTE', 'ARRIVED'),
    });
    expect(
      decide(inPosition, unchanged({ driverId: 'driver-2' })).refusal,
    ).toBeNull();
  });
});

describe('the Send button', () => {
  it('re-arms on every saved edit, so the driver is re-sent the new information', () => {
    expect(
      decide(before(), unchanged({ pocName: 'John Roe' })).dispatched,
    ).toBe(false);
    expect(
      decide(before(), unchanged({ driverId: 'driver-2' })).dispatched,
    ).toBe(false);
  });

  it('stays pinned at "Sent" for a sub-contract farmed to a company with nobody named', () => {
    const decision = decide(
      before(),
      unchanged({ subContractor: true, partnerId: null }),
    );
    expect(decision.locked).toBe(true);
    expect(decision.dispatched).toBe(true);
  });

  it('re-arms again once that company names a chauffeur', () => {
    const decision = decide(
      before(),
      unchanged({ subContractor: true, partnerId: 'partner-1' }),
    );
    expect(decision.locked).toBe(false);
    expect(decision.dispatched).toBe(false);
  });
});

describe('reassignment', () => {
  it('is true when the driver changes, including to nobody', () => {
    expect(
      decide(before(), unchanged({ driverId: 'driver-2' })).reassigned,
    ).toBe(true);
    expect(decide(before(), unchanged({ driverId: null })).reassigned).toBe(
      true,
    );
  });

  it('is true when the partner changes', () => {
    expect(
      decide(
        before(),
        unchanged({ subContractor: true, partnerId: 'partner-1' }),
      ).reassigned,
    ).toBe(true);
  });

  // A vehicle swap or a price edit re-arms the Send button (above) without
  // restarting the pipeline the driver has already been walking through.
  it('is false for an edit that leaves the assignee alone', () => {
    expect(
      decide(before(), unchanged({ pocName: 'John Roe' })).reassigned,
    ).toBe(false);
    expect(decide(before(), unchanged({ priceEur: 300 })).reassigned).toBe(
      false,
    );
  });
});

describe('telling the POC', () => {
  it('sends when the caller asks and there is a driver to announce', () => {
    expect(decide(before(), unchanged({ notifyPoc: true })).notifyPoc).toBe(
      true,
    );
  });

  it('stays quiet when the caller did not ask', () => {
    expect(decide(before(), unchanged({ notifyPoc: false })).notifyPoc).toBe(
      false,
    );
  });

  it('stays quiet with no driver on the booking — there is nothing to announce', () => {
    expect(
      decide(before(), unchanged({ notifyPoc: true, driverId: null }))
        .notifyPoc,
    ).toBe(false);
  });

  it('stays quiet when the booking has tracking turned off', () => {
    expect(
      decide(before(), unchanged({ notifyPoc: true, tracking: false }))
        .notifyPoc,
    ).toBe(false);
  });
});
