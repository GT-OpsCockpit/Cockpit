import { buildTripMessageContext, driverFingerprint, driverRelevantChange, pocRelevantChange, TripForMessage } from './trip-message.util';

const BASE: TripForMessage = {
  ref: 'R-CI1-26-1',
  pocName: 'Marc Dubois',
  passengerName: 'Sophie Durand',
  pickupLocation: 'Nice Airport',
  dropoffLocation: 'Hotel Negresco',
  // 14:00 in Paris on a summer day = 12:00 UTC.
  pickupAt: new Date('2026-06-01T12:00:00.000Z'),
  timezone: 'Europe/Paris',
  vehicleType: { name: 'Business' },
  driver: {
    ref: 'D-FR-INT-002',
    firstName: 'Julien',
    lastName: 'Petit',
    company: null,
  },
  partner: null,
  service: 'TSF',
  instructions: 'Meet at arrivals, hold a name sign.',
  paxCount: 2,
  billing: 'ACCOUNT',
  priceEur: 320,
  fleetVehicle: { regNbr: 'AB-123-CD' },
};

describe('buildTripMessageContext', () => {
  // Every template says "(local time)". pickupAt is a real instant, so it has
  // to be read back in the trip's own zone — reading it in UTC announced a
  // pickup two hours off from the one the dispatcher typed.
  it('renders the pickup date/time in the trip timezone, not UTC', () => {
    const context = buildTripMessageContext(BASE);
    expect(context.pickupDate).toBe('2026-06-01');
    expect(context.pickupTime).toBe('14:00');
  });

  it('rolls the date over when the local zone is a day ahead of UTC', () => {
    const context = buildTripMessageContext({
      ...BASE,
      // 08:30 the next morning in Tokyo.
      pickupAt: new Date('2026-06-01T23:30:00.000Z'),
      timezone: 'Asia/Tokyo',
    });
    expect(context.pickupDate).toBe('2026-06-02');
    expect(context.pickupTime).toBe('08:30');
  });

  it('falls back to UTC when the trip has no resolved timezone', () => {
    const context = buildTripMessageContext({ ...BASE, timezone: null });
    expect(context.pickupDate).toBe('2026-06-01');
    expect(context.pickupTime).toBe('12:00');
  });

  it('names the sub-contracted partner when no driver is assigned', () => {
    const context = buildTripMessageContext({
      ...BASE,
      driver: null,
      partner: {
        ref: 'D-GB-CE-UBE-001',
        firstName: 'James',
        lastName: 'Whitfield',
        company: 'Uber Elite London',
      },
    });
    expect(context.driverName).toBe('James Whitfield');
  });

  // Every POC template puts this name mid-sentence ("this is <driver>, the
  // driver"). A partner company with nobody named on file left a hole in it.
  it('falls back to the partner company when nobody is named on it', () => {
    const context = buildTripMessageContext({
      ...BASE,
      driver: null,
      partner: {
        ref: 'D-XX-XX-UBE-001',
        firstName: null,
        lastName: null,
        company: 'Uber',
      },
    });
    expect(context.driverName).toBe('Uber');
  });

  it('builds a Google Maps directions link from the pickup address, URL-encoded', () => {
    const context = buildTripMessageContext(BASE);
    expect(context.pickupMapsLink).toBe(
      'https://maps.google.com/?daddr=Nice%20Airport',
    );
  });

  it('has no drop-off maps link when the trip has no drop-off address', () => {
    const context = buildTripMessageContext({ ...BASE, dropoffLocation: null });
    expect(context.dropoffMapsLink).toBeNull();
  });

  it('computes the cash-collection amount as retail net + 10%, only for cash bookings', () => {
    const cash = buildTripMessageContext({ ...BASE, billing: 'CASH', priceEur: 100 });
    expect(cash.cashAmount).toBeCloseTo(110);

    const account = buildTripMessageContext({ ...BASE, billing: 'ACCOUNT', priceEur: 100 });
    expect(account.cashAmount).toBeNull();
  });
});

describe('pocRelevantChange', () => {
  it('is false for an edit the POC does not care about', () => {
    expect(pocRelevantChange(BASE, { ...BASE, instructions: 'Other note', priceEur: 999 })).toBe(false);
  });

  it.each([
    ['pickup', { pickupLocation: 'Cannes' }],
    ['drop-off', { dropoffLocation: 'Hotel Martinez' }],
    ['date/time', { pickupAt: new Date('2026-06-01T13:00:00.000Z') }],
    ['service type', { service: 'ASD' }],
    ['pax', { paxCount: 3 }],
    ['vehicle type', { vehicleType: { name: 'Van' } }],
    ['reg nbr', { fleetVehicle: { regNbr: 'ZZ-999-ZZ' } }],
  ] as const)('is true when the %s changes', (_label, patch) => {
    expect(pocRelevantChange(BASE, { ...BASE, ...patch })).toBe(true);
  });
});

describe('driverRelevantChange', () => {
  it('is false for a price edit on an account booking', () => {
    expect(driverRelevantChange(BASE, { ...BASE, priceEur: 999 })).toBe(false);
  });

  it('is true for anything the POC is told about', () => {
    expect(driverRelevantChange(BASE, { ...BASE, paxCount: 3 })).toBe(true);
  });

  it.each([
    ['instructions', { instructions: 'Gate B' }],
    ['passenger', { passengerName: 'Someone Else' }],
    ['billing', { billing: 'CASH' }],
  ] as const)('is true when the %s changes', (_label, patch) => {
    expect(driverRelevantChange(BASE, { ...BASE, ...patch })).toBe(true);
  });

  it('is true when the cash amount to collect changes', () => {
    const cash = { ...BASE, billing: 'CASH', priceEur: 320 };
    expect(driverRelevantChange(cash, { ...cash, priceEur: 400 })).toBe(true);
  });
});

describe('driverFingerprint', () => {
  it('is stable for edits the partner was not told about', () => {
    expect(driverFingerprint({ ...BASE, partnerRateEur: 1 } as never)).toBe(driverFingerprint(BASE));
  });

  it('changes exactly when driverRelevantChange says so', () => {
    for (const patch of [
      { pickupLocation: 'Cannes' },
      { paxCount: 9 },
      { instructions: 'x' },
      { passengerName: 'Y' },
      { fleetVehicle: { regNbr: 'ZZ' } },
    ] as const) {
      const after = { ...BASE, ...patch };
      expect(driverFingerprint(after) !== driverFingerprint(BASE)).toBe(driverRelevantChange(BASE, after));
    }
  });
});
