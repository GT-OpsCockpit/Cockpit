import {
  buildCanceledSubcontractEmail,
  buildSubcontractEmail,
  type TripForSubcontractEmail,
} from './subcontract-email.util';

const BASE: TripForSubcontractEmail = {
  ref: 'R-CI1-26-1',
  // 12:30 UTC — 14:30 in Paris, which is the point of the timezone below.
  pickupAt: new Date('2026-06-01T12:30:00.000Z'),
  timezone: 'Europe/Paris',
  pickupLocation: 'Nice Airport',
  dropoffLocation: 'Hotel Negresco',
  service: 'TSF',
  hours: null,
  passengerName: 'John Passenger',
  paxCount: 2,
  instructions: 'Gate B',
  partnerRateEur: { toNumber: () => 150 },
  vehicleType: { name: 'Business' },
  fleetVehicle: null,
};

const trip = (overrides: Partial<TripForSubcontractEmail> = {}) => ({
  ...BASE,
  ...overrides,
});

describe('buildSubcontractEmail', () => {
  it('recaps the mission, with the pickup in the trip’s own timezone', () => {
    const draft = buildSubcontractEmail(trip(), 'partner@example.test');

    expect(draft.to).toBe('partner@example.test');
    expect(draft.subject).toBe('Booking R-CI1-26-1');
    expect(draft.body).toContain('Ref: R-CI1-26-1');
    expect(draft.body).toContain('Pax Name: John Passenger (2 pax)');
    expect(draft.body).toContain('Pickup Date: 01/06/2026');
    // 14:30 local, not 12:30 UTC — and the 12h form alongside it.
    expect(draft.body).toContain('Pickup time: 14:30 (02:30 PM)');
    expect(draft.body).toContain('Pickup location: Nice Airport');
    expect(draft.body).toContain('Drop-off: Hotel Negresco');
    expect(draft.body).toContain('Info: Gate B');
  });

  // v2 stores and invoices in EUR (audit §7.1) — printing the trip country's
  // currency next to a figure that is actually in euros is the very confusion
  // that decision removed.
  it('prints the partner rate in euros', () => {
    expect(buildSubcontractEmail(trip(), 'x@y.test').body).toContain(
      'Partner rate net: 150.00€ Net',
    );
    expect(
      buildSubcontractEmail(trip({ partnerRateEur: null }), 'x@y.test').body,
    ).toContain('Partner rate net: —');
  });

  it('gives an ASD job its duration instead of a drop-off', () => {
    const body = buildSubcontractEmail(
      trip({ service: 'ASD', hours: 4 }),
      'x@y.test',
    ).body;
    expect(body).toContain('Duration: 4h');
    expect(body).not.toContain('Drop-off:');
  });

  it('names the actual car when one of ours is attached, the Category alone otherwise', () => {
    expect(buildSubcontractEmail(trip(), 'x@y.test').body).toContain(
      'Vehicle type: Business',
    );
    expect(
      buildSubcontractEmail(
        trip({ fleetVehicle: { make: 'Mercedes-Benz', model: 'E-Class' } }),
        'x@y.test',
      ).body,
    ).toContain('Vehicle type: Business - Mercedes-Benz - E-Class');
  });
});

describe('buildCanceledSubcontractEmail', () => {
  it('states the cancellation and signs with the company on file', () => {
    const draft = buildCanceledSubcontractEmail(
      trip(),
      'partner@example.test',
      'Cockpit Transport',
    );

    expect(draft.subject).toBe('🚨 Canceled booking R-CI1-26-1');
    expect(draft.body).toContain('Status : **Canceled**');
    expect(draft.body.trimEnd().endsWith('Cockpit Transport')).toBe(true);
    // The rate is the partner's own business and has no place in a cancellation.
    expect(draft.body).not.toContain('Partner rate net');
  });

  it('falls back to a generic sign-off when no company name is on file', () => {
    const draft = buildCanceledSubcontractEmail(trip(), 'x@y.test', null);
    expect(draft.body.trimEnd().endsWith('the dispatch team')).toBe(true);
  });
});
