import {
  isTripCompleted,
  nextSubcontractStep,
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

describe('isTripCompleted', () => {
  const NOW = new Date('2026-10-26T12:00:00Z');
  const base = {
    invoiced: false,
    steps: [{ step: 'TRANSMITTED' }],
    directPartnerId: null,
    partnerDeclinedAt: null,
    pickupAt: new Date('2026-10-27T12:00:00Z'),
  };

  it('is true once the trip is Done', () => {
    const steps = [{ step: 'TRANSMITTED' }, { step: 'DROPPED' }];
    expect(isTripCompleted({ ...base, steps }, NOW)).toBe(true);
  });

  it('is true once the trip is invoiced', () => {
    expect(isTripCompleted({ ...base, invoiced: true }, NOW)).toBe(true);
  });

  it('is false while the trip is still to be done', () => {
    expect(isTripCompleted(base, NOW)).toBe(false);
  });

  it('is true for a partner-company job a minute past its pickup — it is billable by then', () => {
    const job = {
      ...base,
      directPartnerId: 'p1',
      pickupAt: new Date('2026-10-26T11:58:00Z'),
    };
    expect(isTripCompleted(job, NOW)).toBe(true);
  });

  it('is false for a partner-company job not yet past its pickup, or one the partner declined', () => {
    expect(isTripCompleted({ ...base, directPartnerId: 'p1' }, NOW)).toBe(false);
    const declined = {
      ...base,
      directPartnerId: 'p1',
      partnerDeclinedAt: new Date('2026-10-25T10:00:00Z'),
      pickupAt: new Date('2026-10-26T11:00:00Z'),
    };
    expect(isTripCompleted(declined, NOW)).toBe(false);
  });
});

describe('nextSubcontractStep', () => {
  const job = (over: Partial<TripForCompletion & { partnerUpdatePending: boolean }> = {}) => ({
    subContractor: true,
    assignmentCancelled: false,
    partnerDeclinedAt: null,
    invoiced: false,
    partnerUpdatePending: false,
    steps: [] as { step: string }[],
    ...over,
  });

  it('moves "Send ?" to Sent', () => {
    expect(nextSubcontractStep(job())).toBe('TRANSMITTED');
  });

  it('moves "Updated - Send ?" to Sent', () => {
    expect(nextSubcontractStep(job({ partnerUpdatePending: true }))).toBe(
      'TRANSMITTED',
    );
  });

  it('moves Sent to Confirmed', () => {
    expect(
      nextSubcontractStep(job({ steps: [{ step: 'TRANSMITTED' }] })),
    ).toBe('ACCEPTED');
  });

  it('has nothing to record once Confirmed, nor for a trip that is not sub-contracted, declined or cancelled', () => {
    const confirmed = [{ step: 'TRANSMITTED' }, { step: 'ACCEPTED' }];
    expect(nextSubcontractStep(job({ steps: confirmed }))).toBeNull();
    expect(nextSubcontractStep(job({ subContractor: false }))).toBeNull();
    expect(
      nextSubcontractStep(job({ partnerDeclinedAt: new Date() })),
    ).toBeNull();
    expect(nextSubcontractStep(job({ assignmentCancelled: true }))).toBeNull();
  });
});
