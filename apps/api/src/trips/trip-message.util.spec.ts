import { buildTripMessageContext, TripForMessage } from './trip-message.util';

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
});
