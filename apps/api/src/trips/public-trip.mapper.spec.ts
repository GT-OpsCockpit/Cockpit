import { toPublicTrip, TripForPublicView } from './public-trip.mapper';

const BASE: TripForPublicView = {
  ref: 'R-CI1-26-1',
  tracking: true,
  assignmentCancelled: false,
  passengerName: 'Sophie Durand',
  paxCount: 2,
  pocName: 'Marc Dubois',
  pocPhone: '+33612345678',
  pickupAt: new Date('2026-06-01T12:00:00.000Z'),
  timezone: 'Europe/Paris',
  pickupLocation: 'Nice Airport',
  dropoffLocation: 'Hotel Negresco',
  instructions: 'Ring twice',
  vehicleType: { name: 'Business' },
  client: {
    ref: 'CI1',
    company: null,
    contactFirstName: 'Marc',
    contactLastName: 'Dubois',
  },
  driver: {
    ref: 'D-FR-INT-001',
    firstName: 'Julien',
    lastName: 'Petit',
    company: null,
  },
  partner: null,
  steps: [],
};

describe('toPublicTrip', () => {
  it('names the assigned driver', () => {
    expect(toPublicTrip(BASE, true).driverName).toBe('Julien Petit');
  });

  it('names the sub-contracted partner when there is no driver', () => {
    const trip = toPublicTrip(
      {
        ...BASE,
        driver: null,
        partner: {
          ref: 'D-GB-CE-UBE-001',
          firstName: 'James',
          lastName: 'Whitfield',
          company: 'Uber Elite London',
        },
      },
      false,
    );
    expect(trip.driverName).toBe('James Whitfield');
  });

  // A partner can be a company with nobody named on file — the legacy took
  // the company as free text and v2 keeps a nameless Driver row for it. The
  // passenger page then read "Driver — To be confirmed" on a booking that was
  // very much assigned.
  it('falls back to the partner company when nobody is named on it', () => {
    const trip = toPublicTrip(
      {
        ...BASE,
        driver: null,
        partner: {
          ref: 'D-XX-XX-UBE-001',
          firstName: null,
          lastName: null,
          company: 'Uber',
        },
      },
      false,
    );
    expect(trip.driverName).toBe('Uber');
  });

  it('leaves the driver name empty when nobody is assigned at all', () => {
    expect(
      toPublicTrip({ ...BASE, driver: null, partner: null }, false).driverName,
    ).toBeNull();
  });

  // The track view is served to the passenger; the driver view to the driver.
  it('withholds the POC and the instructions from the track view', () => {
    const track = toPublicTrip(BASE, false);
    expect(track.pocName).toBeNull();
    expect(track.pocPhone).toBeNull();
    expect(track.instructions).toBeNull();

    const driverView = toPublicTrip(BASE, true);
    expect(driverView.pocName).toBe('Marc Dubois');
    expect(driverView.instructions).toBe('Ring twice');
  });
});
