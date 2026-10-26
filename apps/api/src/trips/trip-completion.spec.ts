import {
  subcontractCompletionBlocker,
  type TripForCompletion,
} from './trip-completion';

const trip = (over: Partial<TripForCompletion> = {}): TripForCompletion => ({
  subContractor: true,
  assignmentCancelled: false,
  partnerDeclinedAt: null,
  invoiced: false,
  steps: [{ step: 'TRANSMITTED' }],
  ...over,
});

describe('subcontractCompletionBlocker', () => {
  it('allows a sub-contracted trip that is Sent', () => {
    expect(subcontractCompletionBlocker(trip())).toBeNull();
  });

  it('allows a sub-contracted trip that is Confirmed', () => {
    const steps = [{ step: 'TRANSMITTED' }, { step: 'ACCEPTED' }];
    expect(subcontractCompletionBlocker(trip({ steps }))).toBeNull();
  });

  it('refuses a trip that is not sub-contracted', () => {
    expect(subcontractCompletionBlocker(trip({ subContractor: false }))).toMatch(
      /sub-contracted/,
    );
  });

  it('refuses a cancelled, declined or invoiced trip', () => {
    expect(
      subcontractCompletionBlocker(trip({ assignmentCancelled: true })),
    ).toMatch(/cancelled/);
    expect(
      subcontractCompletionBlocker(trip({ partnerDeclinedAt: new Date() })),
    ).toMatch(/declined/);
    expect(subcontractCompletionBlocker(trip({ invoiced: true }))).toMatch(
      /invoiced/,
    );
  });

  it('refuses a trip not yet sent, or already further along than Confirmed', () => {
    expect(subcontractCompletionBlocker(trip({ steps: [] }))).toMatch(
      /Sent or Confirmed/,
    );
    const onTheWay = [{ step: 'TRANSMITTED' }, { step: 'ENROUTE' }];
    expect(subcontractCompletionBlocker(trip({ steps: onTheWay }))).toMatch(
      /Sent or Confirmed/,
    );
  });
});
