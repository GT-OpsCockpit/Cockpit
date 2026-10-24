import { MESSAGES, TripMessageContext } from './messages';

const BASE: TripMessageContext = {
  ref: 'R-CI1-26-1',
  pocName: 'Marc Dubois',
  driverName: 'Julien Petit',
  passengerName: 'Sophie Durand',
  pickupLocation: 'Nice Airport',
  dropoffLocation: 'Hotel Negresco',
  pickupDate: '2026-06-01',
  pickupTime: '14:00',
  vehicleType: 'Business',
  pickupMapsLink: 'https://maps.google.com/?daddr=Nice%20Airport',
  dropoffMapsLink: 'https://maps.google.com/?daddr=Hotel%20Negresco',
  service: 'TSF',
  instructions: 'Meet at arrivals, hold a name sign.',
  paxCount: 2,
  regNbr: 'AB-123-CD',
  billing: 'ACCOUNT',
  cashAmount: null,
};

describe('MESSAGES.driverDispatch', () => {
  it('includes every field, in order, with the pickup Maps link', () => {
    const body = MESSAGES.driverDispatch(BASE, { name: 'Julien Petit' });
    expect(body).toBe(
      [
        'Dear Julien Petit,',
        'Please see below booking R-CI1-26-1 details:',
        '',
        'Date: 2026-06-01',
        'Pickup time: 14:00 (local time)',
        'Service type: TSF',
        'Pickup location: Nice Airport 🗺️ https://maps.google.com/?daddr=Nice%20Airport',
        'Info: Meet at arrivals, hold a name sign.',
        'Drop off location: Hotel Negresco 🗺️ https://maps.google.com/?daddr=Hotel%20Negresco',
        '',
        'Pax name: Sophie Durand',
        'Pax nbr: 2',
        'Vehicle type: Business',
        'Reg nbr: AB-123-CD',
      ].join('\n'),
    );
  });

  it('omits the drop-off line for a non-TSF service (ASD/SPEC run by the hour or a custom itinerary)', () => {
    const body = MESSAGES.driverDispatch({ ...BASE, service: 'ASD' }, { name: 'Julien Petit' });
    expect(body).not.toContain('Drop off location');
  });

  it('omits the drop-off line for a TSF trip with no drop-off address on file', () => {
    const body = MESSAGES.driverDispatch({ ...BASE, dropoffLocation: null }, { name: 'Julien Petit' });
    expect(body).not.toContain('Drop off location');
  });

  it('falls back to "-" for a blank Info field', () => {
    const body = MESSAGES.driverDispatch({ ...BASE, instructions: null }, { name: 'Julien Petit' });
    expect(body).toContain('Info: -');
  });

  it('leaves out the Reg nbr line when no vehicle is assigned', () => {
    const body = MESSAGES.driverDispatch({ ...BASE, regNbr: null }, { name: 'Julien Petit' });
    expect(body).not.toContain('Reg nbr');
    expect(body).toContain('Vehicle type: Business');
  });

  it('adds a cash-collection line only when billing is CASH', () => {
    const cashBody = MESSAGES.driverDispatch(
      { ...BASE, billing: 'CASH', cashAmount: 352 },
      { name: 'Julien Petit' },
    );
    expect(cashBody).toContain('Payment: Cash (352.00 €)');

    const accountBody = MESSAGES.driverDispatch(BASE, { name: 'Julien Petit' });
    expect(accountBody).not.toContain('Payment');
  });
});

describe('POC messages', () => {
  it('assigned: recaps the booking with the driver, and no Maps link, Info or cash line', () => {
    const body = MESSAGES.assigned({ ...BASE, billing: 'CASH', cashAmount: 352 });
    expect(body).toBe(
      [
        'Hello Marc Dubois, a driver has been assigned to your booking.',
        '',
        'Booking ref: R-CI1-26-1',
        'Date: 2026-06-01',
        'Pickup time: 14:00 (local time)',
        'Service type: TSF',
        'Pickup location: Nice Airport',
        'Drop off location: Hotel Negresco',
        '',
        'Pax name: Sophie Durand',
        'Pax nbr: 2',
        'Driver: Julien Petit',
        'Vehicle type: Business',
        'Reg nbr: AB-123-CD',
      ].join('\n'),
    );
    expect(body).not.toContain('http');
    expect(body).not.toContain('Cash');
  });

  it('updated: same recap under an "updated" headline', () => {
    const body = MESSAGES.updated(BASE);
    expect(body.split('\n')[0]).toBe(
      'Hello Marc Dubois, your booking has been updated. Please find the new details below.',
    );
    expect(body).toContain('Pickup location: Nice Airport');
  });

  it('omits the drop-off line for a non-TSF service', () => {
    expect(MESSAGES.assigned({ ...BASE, service: 'ASD' })).not.toContain('Drop off location');
  });

  it('no longer has the "accepted" and "on my way" messages', () => {
    expect('accepted' in MESSAGES).toBe(false);
    expect('enroute' in MESSAGES).toBe(false);
  });

  it('arrived', () => {
    expect(MESSAGES.arrived(BASE)).toBe(
      [
        'Hello Marc Dubois, the chauffeur Julien Petit appointed for Sophie Durand has arrived at the pickup location (Nice Airport).',
        'Booking ref: R-CI1-26-1',
      ].join('\n'),
    );
  });

  it('on board: names the drop-off for a transfer, just "On the way." for an ASD job', () => {
    expect(MESSAGES.onboard(BASE)).toBe(
      [
        'Hello Marc Dubois, passenger Sophie Durand is on board. On the way to Hotel Negresco.',
        'Booking ref: R-CI1-26-1',
      ].join('\n'),
    );
    expect(MESSAGES.onboard({ ...BASE, service: 'ASD' })).toContain('On the way.');
    expect(MESSAGES.onboard({ ...BASE, service: 'ASD' })).not.toContain('Negresco');
  });

  it('dropped', () => {
    expect(MESSAGES.dropped(BASE)).toBe(
      [
        'Hello Marc Dubois, drop-off and service completed with Sophie Durand.',
        'Booking ref: R-CI1-26-1',
        '',
        'Thank you for your trust. It was a pleasure to have had the opportunity to transport your guest.',
      ].join('\n'),
    );
  });

  it('on board / dropped read cleanly with no drop-off address', () => {
    const t = { ...BASE, dropoffLocation: null };
    expect(MESSAGES.onboard(t)).not.toContain('null');
    expect(MESSAGES.dropped(t)).not.toContain('null');
  });
});
