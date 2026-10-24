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
  flightNumber: null,
  tailNbr: null,
  fboAddress: null,
  nameboard: null,
  nameboardUrl: null,
};

const trip = (overrides: Partial<TripForSubcontractEmail> = {}) => ({
  ...BASE,
  ...overrides,
});

describe('buildSubcontractEmail', () => {
  it('recaps the mission, with the pickup in the trip’s own timezone', () => {
    const draft = buildSubcontractEmail(trip(), 'partner@example.test');

    expect(draft.to).toBe('partner@example.test');
    expect(draft.subject).toBe('NEW BOOKING - R-CI1-26-1');
    expect(draft.body.startsWith('Dear Team,')).toBe(true);
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

  it('omits flight/tail/FBO lines entirely for a non-airport job', () => {
    const body = buildSubcontractEmail(trip(), 'x@y.test').body;
    expect(body).not.toContain('Flight:');
    expect(body).not.toContain('Tail nbr:');
    expect(body).not.toContain('FBO address:');
  });

  it('shows the flight number for a commercial airport pickup', () => {
    const body = buildSubcontractEmail(
      trip({ flightNumber: 'AF1234', fboAddress: null, tailNbr: null }),
      'x@y.test',
    ).body;
    expect(body).toContain('Flight: AF1234');
    expect(body).not.toContain('Tail nbr:');
  });

  it('shows the FBO address before the tail number for a private-aviation pickup', () => {
    const body = buildSubcontractEmail(
      trip({ tailNbr: 'N123AB', fboAddress: 'Signature Flight Support, Dulles' }),
      'x@y.test',
    ).body;
    expect(body).toContain('FBO address: Signature Flight Support, Dulles');
    expect(body).toContain('Tail nbr: N123AB');
    expect(body).not.toContain('Flight:');
    const lines = body.split('\n');
    expect(lines.indexOf('FBO address: Signature Flight Support, Dulles')).toBeLessThan(
      lines.indexOf('Tail nbr: N123AB'),
    );
  });

  it('places the airport info right after the pickup location', () => {
    const body = buildSubcontractEmail(
      trip({ flightNumber: 'AF1234', pickupLocation: 'CDG Airport' }),
      'x@y.test',
    ).body;
    const lines = body.split('\n');
    const pickupIdx = lines.indexOf('Pickup location: CDG Airport');
    expect(lines[pickupIdx + 1]).toBe('Flight: AF1234');
  });

  it('omits the nameboard line when neither text nor an upload is on file', () => {
    const body = buildSubcontractEmail(trip(), 'x@y.test').body;
    expect(body).not.toContain('Nameboard:');
  });

  it('shows the typed nameboard text under Pax Name', () => {
    const body = buildSubcontractEmail(
      trip({ nameboard: 'MR SMITH', passengerName: 'John Smith' }),
      'x@y.test',
    ).body;
    const lines = body.split('\n');
    const paxIdx = lines.indexOf('Pax Name: John Smith (2 pax)');
    expect(lines[paxIdx + 1]).toBe('Nameboard: MR SMITH');
  });

  it('falls back to the uploaded nameboard image when no text is typed', () => {
    const body = buildSubcontractEmail(
      trip({ nameboard: null, nameboardUrl: '/uploads/nameboards/abc.png' }),
      'x@y.test',
    ).body;
    expect(body).toContain('Nameboard: /uploads/nameboards/abc.png');
  });

  it('prefers the typed nameboard text over an uploaded image', () => {
    const body = buildSubcontractEmail(
      trip({ nameboard: 'MR SMITH', nameboardUrl: '/uploads/nameboards/abc.png' }),
      'x@y.test',
    ).body;
    expect(body).toContain('Nameboard: MR SMITH');
    expect(body).not.toContain('/uploads/nameboards/abc.png');
  });
});

describe('buildSubcontractEmail — updated variant', () => {
  it('is titled UPDATED BOOKING and asks for a new confirmation, with the same recap', () => {
    const draft = buildSubcontractEmail(trip(), 'p@x.com', 'updated');
    expect(draft.subject).toBe('UPDATED BOOKING - R-CI1-26-1');
    expect(draft.body.startsWith('Dear Team,')).toBe(true);
    expect(draft.body).toContain('**Updated**');
    expect(draft.body).toContain('confirm it again');
    expect(draft.body).toContain('Ref: R-CI1-26-1');
    expect(draft.body).toContain('Pickup location: Nice Airport');
  });
});

describe('buildCanceledSubcontractEmail', () => {
  it('states the cancellation and signs with the company on file', () => {
    const draft = buildCanceledSubcontractEmail(
      trip(),
      'partner@example.test',
      'Cockpit Transport',
    );

    expect(draft.subject).toBe('CANCELED BOOKING - R-CI1-26-1');
    expect(draft.body.startsWith('Dear Team,')).toBe(true);
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
