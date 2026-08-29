import {
  refuseIncompatibleFleetVehicle,
  resolveBookingFields,
  shouldHonourReservedVehicle,
  type BookingClient,
  type BookingFieldsDeps,
  type BookingFieldsDto,
} from './booking-fields';
import { Billing, Service } from '../../../generated/prisma/enums';

// The booking a dispatcher types in the simplest valid case: a transfer, with
// an account that carries its own POC. Every test below states only what it
// changes from here, so what a case is actually about stays readable.
function dto(overrides: Partial<BookingFieldsDto> = {}): BookingFieldsDto {
  return {
    countryCode: 'FR',
    pickupAt: '2026-09-01T10:00:00.000Z',
    pickupLocation: 'CDG',
    dropoffLocation: 'Paris',
    service: Service.TSF,
    passengerName: 'Alice Martin',
    ...overrides,
  };
}

const CLIENT: BookingClient = {
  id: 'client-1',
  pocName: 'Account POC',
  pocPhone: '+33611111111',
  billing: Billing.ACCOUNT,
};

function deps(
  overrides: Partial<BookingFieldsDeps<BookingClient>> = {},
): BookingFieldsDeps<BookingClient> {
  return {
    client: CLIENT,
    driver: null,
    vehicleType: null,
    fleetVehicle: null,
    countryInfo: { defaultTimezone: 'Europe/Paris' },
    reservedVehicle: null,
    ...overrides,
  };
}

/** The columns of an accepted booking — fails the test rather than the type when it was refused. */
function columnsOf(
  result: ReturnType<typeof resolveBookingFields<BookingClient>>,
) {
  if (result.refusal) {
    throw new Error(
      `expected an accepted booking, got: ${result.refusal.message}`,
    );
  }
  return result.data;
}

function messageOf(
  result: ReturnType<typeof resolveBookingFields<BookingClient>>,
): string | null {
  return result.refusal?.message ?? null;
}

describe('resolveBookingFields', () => {
  describe('the payload rules, in the order they are asked', () => {
    it('refuses a non-ASD booking with no dropoff', () => {
      expect(
        messageOf(resolveBookingFields(dto({ dropoffLocation: '' }), deps())),
      ).toBe('dropoffLocation is required (except for an ASD service)');
    });

    // An "at disposal" booking ends where it started, and the legacy said so by
    // mirroring the pickup into the dropoff field (common.js:1478-1486,
    // syncDropoffFromPickup). That is not cosmetic: the onboard and dropped
    // WhatsApp templates interpolate dropoffLocation with no fallback, so a
    // null here reaches the POC as "On the way to null".
    it('gives an ASD booking the pickup as its dropoff, since it returns where it started', () => {
      const result = resolveBookingFields(
        dto({
          service: Service.ASD,
          pickupLocation: 'Hotel Martinez, Cannes',
          dropoffLocation: '',
          hours: 4,
        }),
        deps(),
      );
      expect(columnsOf(result).dropoffLocation).toBe('Hotel Martinez, Cannes');
    });

    it('keeps a dropoff the dispatcher typed on an ASD booking', () => {
      const result = resolveBookingFields(
        dto({
          service: Service.ASD,
          pickupLocation: 'Nice',
          dropoffLocation: 'Monaco',
          hours: 4,
        }),
        deps(),
      );
      expect(columnsOf(result).dropoffLocation).toBe('Monaco');
    });

    it.each([
      ['no Nb H at all', undefined],
      ['under two hours', 1],
      ['over forty-eight hours', 49],
    ])('refuses an ASD booking with %s', (_case, hours) => {
      expect(
        messageOf(
          resolveBookingFields(
            dto({ service: Service.ASD, dropoffLocation: '', hours }),
            deps(),
          ),
        ),
      ).toBe('hours (Nb H) is required for an ASD service, between 2 and 48');
    });

    it('refuses a SPEC booking with no instructions', () => {
      expect(
        messageOf(
          resolveBookingFields(
            dto({ service: Service.SPEC, instructions: '   ' }),
            deps(),
          ),
        ),
      ).toBe('instructions is required for a SPEC service');
    });

    it('refuses a vehicle type that matches no vehicle type on file', () => {
      expect(
        messageOf(
          resolveBookingFields(dto({ vehicleType: 'Hovercraft' }), deps()),
        ),
      ).toBe(
        'vehicleType "Hovercraft" does not match an existing vehicle type',
      );
    });

    it('refuses more passengers than the vehicle type seats', () => {
      expect(
        messageOf(
          resolveBookingFields(
            dto({ vehicleType: 'Business', paxCount: 4 }),
            deps({ vehicleType: { id: 'vt-1', maxPax: 3 } }),
          ),
        ),
      ).toBe('Business accepts a maximum of 3 passengers.');
    });

    it('refuses a Reg Nbr that matches no fleet vehicle', () => {
      expect(
        messageOf(
          resolveBookingFields(dto({ fleetRegNbr: 'XX-000-XX' }), deps()),
        ),
      ).toBe('No Fleet vehicle with registration "XX-000-XX"');
    });

    it('refuses a fleet vehicle whose category cannot service the booking', () => {
      expect(
        messageOf(
          resolveBookingFields(
            dto({ vehicleType: 'Business', fleetRegNbr: 'AA-111-AA' }),
            deps({
              vehicleType: { id: 'vt-1', maxPax: 3 },
              fleetVehicle: {
                id: 'fv-1',
                regNbr: 'AA-111-AA',
                category: { name: 'Van' },
              },
            }),
          ),
        ),
      ).toBe(
        'Vehicle AA-111-AA (Van) cannot service a Business trip — compatible categories: Business',
      );
    });

    it('refuses an account that matches no client on file', () => {
      expect(
        messageOf(resolveBookingFields(dto(), deps({ client: null }))),
      ).toBe('clientRef is required and must match an existing client account');
    });

    it('refuses a booking nobody can be reached about', () => {
      expect(
        messageOf(
          resolveBookingFields(
            dto(),
            deps({ client: { ...CLIENT, pocPhone: null } }),
          ),
        ),
      ).toBe('No POC phone: set it on the client account or for this trip.');
    });

    it('refuses a driver that matches no driver on file', () => {
      expect(
        messageOf(resolveBookingFields(dto({ driverRef: 'D9' }), deps())),
      ).toBe('driverRef "D9" does not match an existing driver');
    });

    // The order is the interface: a doubly-invalid payload has always been
    // told about its dropoff first, and moving a rule would change that.
    it('reports the first thing wrong, not the last', () => {
      expect(
        messageOf(
          resolveBookingFields(
            dto({ dropoffLocation: '', driverRef: 'D9' }),
            deps({ client: null }),
          ),
        ),
      ).toBe('dropoffLocation is required (except for an ASD service)');
    });
  });

  describe('the columns it writes', () => {
    it('falls back to Local when no area was given', () => {
      expect(
        columnsOf(resolveBookingFields(dto({ area: '  ' }), deps())).area,
      ).toBe('Local');
      expect(
        columnsOf(resolveBookingFields(dto({ area: 'Nice' }), deps())).area,
      ).toBe('Nice');
    });

    // pickupAt is an instant, and the client builds it by reading the typed
    // wall-clock in the timezone it geocoded from the pickup address. Storing
    // the country's default instead makes the two disagree wherever a country
    // spans more than one zone (Canaries under ES, Azores under PT) — the
    // booking is then re-read, and announced to the POC, an hour or more off.
    it('stores the timezone the pickup was actually geocoded in', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({ countryCode: 'ES', pickupTimezone: 'Atlantic/Canary' }),
            deps({ countryInfo: { defaultTimezone: 'Europe/Madrid' } }),
          ),
        ).timezone,
      ).toBe('Atlantic/Canary');
    });

    it("falls back to the country's timezone when the pickup was never geocoded", () => {
      expect(columnsOf(resolveBookingFields(dto(), deps())).timezone).toBe(
        'Europe/Paris',
      );
      expect(
        columnsOf(resolveBookingFields(dto(), deps({ countryInfo: null })))
          .timezone,
      ).toBeNull();
    });

    it('stores Nb H for an ASD service only', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({ service: Service.ASD, dropoffLocation: '', hours: 4 }),
            deps(),
          ),
        ).hours,
      ).toBe(4);
      expect(
        columnsOf(resolveBookingFields(dto({ hours: 4 }), deps())).hours,
      ).toBeNull();
    });

    it.each([
      ['the booking when it names one', { pocName: 'Trip POC' }, 'Trip POC'],
      ['the account when the booking names none', {}, 'Account POC'],
    ])('takes the POC name from %s', (_case, overrides, expected) => {
      expect(
        columnsOf(resolveBookingFields(dto(overrides), deps())).pocName,
      ).toBe(expected);
    });

    it('falls back to the passenger when neither the booking nor the account names a POC', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto(),
            deps({ client: { ...CLIENT, pocName: null } }),
          ),
        ).pocName,
      ).toBe('Alice Martin');
    });

    it("prefers the booking's own POC phone over the account's", () => {
      expect(
        columnsOf(
          resolveBookingFields(dto({ pocPhone: '+33622222222' }), deps()),
        ).pocPhone,
      ).toBe('+33622222222');
      expect(columnsOf(resolveBookingFields(dto(), deps())).pocPhone).toBe(
        '+33611111111',
      );
    });

    it('tracks the booking unless it was turned off explicitly', () => {
      expect(columnsOf(resolveBookingFields(dto(), deps())).tracking).toBe(
        true,
      );
      expect(
        columnsOf(resolveBookingFields(dto({ tracking: false }), deps()))
          .tracking,
      ).toBe(false);
    });

    it.each([
      [
        'the booking when it says how to bill',
        { billing: Billing.CASH },
        Billing.CASH,
      ],
      ['the account otherwise', {}, Billing.ACCOUNT],
    ])('bills as %s', (_case, overrides, expected) => {
      expect(
        columnsOf(resolveBookingFields(dto(overrides), deps())).billing,
      ).toBe(expected);
    });
  });

  describe('the Lugg. note', () => {
    const luggInAVan = deps({
      vehicleType: { id: 'vt-lugg', maxPax: 0 },
      fleetVehicle: {
        id: 'fv-van',
        regNbr: 'BB-222-BB',
        category: { name: 'Van' },
      },
    });

    it('tells the driver to remove the seats when a Lugg. rides in a Van', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({ vehicleType: 'Lugg.', fleetRegNbr: 'BB-222-BB' }),
            luggInAVan,
          ),
        ).instructions,
      ).toBe('Need to remove seats');
    });

    it('appends it to what the dispatcher wrote rather than replacing it', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({
              vehicleType: 'Lugg.',
              fleetRegNbr: 'BB-222-BB',
              instructions: 'Two suitcases',
            }),
            luggInAVan,
          ),
        ).instructions,
      ).toBe('Two suitcases — Need to remove seats');
    });

    it('never says it twice, however many times the booking is saved', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({
              vehicleType: 'Lugg.',
              fleetRegNbr: 'BB-222-BB',
              instructions: 'Two suitcases — Need to remove seats',
            }),
            luggInAVan,
          ),
        ).instructions,
      ).toBe('Two suitcases — Need to remove seats');
    });

    it('says nothing when the Lugg. rides in an actual Lugg.', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({ vehicleType: 'Lugg.', fleetRegNbr: 'CC-333-CC' }),
            deps({
              vehicleType: { id: 'vt-lugg', maxPax: 0 },
              fleetVehicle: {
                id: 'fv-lugg',
                regNbr: 'CC-333-CC',
                category: { name: 'Lugg.' },
              },
            }),
          ),
        ).instructions,
      ).toBeNull();
    });
  });

  describe('the reserved vehicle', () => {
    it("attaches the driver's reserved vehicle when the booking names none", () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({ driverRef: 'D1' }),
            deps({
              driver: { id: 'driver-1' },
              reservedVehicle: { id: 'fv-res' },
            }),
          ),
        ).fleetVehicleId,
      ).toBe('fv-res');
    });

    it('never overrides the Reg Nbr the dispatcher named', () => {
      expect(
        columnsOf(
          resolveBookingFields(
            dto({ driverRef: 'D1', fleetRegNbr: 'DD-444-DD' }),
            deps({
              driver: { id: 'driver-1' },
              fleetVehicle: {
                id: 'fv-named',
                regNbr: 'DD-444-DD',
                category: { name: 'Business' },
              },
              reservedVehicle: { id: 'fv-res' },
            }),
          ),
        ).fleetVehicleId,
      ).toBe('fv-named');
    });
  });
});

describe('shouldHonourReservedVehicle', () => {
  it('honours it when the driver is being assigned to a booking with no Reg Nbr', () => {
    expect(
      shouldHonourReservedVehicle({
        driverId: 'driver-1',
        previousDriverId: null,
        fleetRegNbr: undefined,
      }),
    ).toBe(true);
  });

  // Deliberately clearing the Reg Nbr on a booking must not silently re-add
  // the reserved vehicle on every later save.
  it('leaves an unrelated edit alone, since the driver has not changed', () => {
    expect(
      shouldHonourReservedVehicle({
        driverId: 'driver-1',
        previousDriverId: 'driver-1',
        fleetRegNbr: undefined,
      }),
    ).toBe(false);
  });

  it('stands aside when the dispatcher named a vehicle themselves', () => {
    expect(
      shouldHonourReservedVehicle({
        driverId: 'driver-1',
        previousDriverId: null,
        fleetRegNbr: 'EE-555-EE',
      }),
    ).toBe(false);
  });

  it('treats a blank Reg Nbr as naming no vehicle at all', () => {
    expect(
      shouldHonourReservedVehicle({
        driverId: 'driver-1',
        previousDriverId: null,
        fleetRegNbr: '   ',
      }),
    ).toBe(true);
  });

  it('has nothing to honour when the booking is being unassigned', () => {
    expect(
      shouldHonourReservedVehicle({
        driverId: null,
        previousDriverId: 'driver-1',
        fleetRegNbr: undefined,
      }),
    ).toBe(false);
  });
});

describe('refuseIncompatibleFleetVehicle', () => {
  const vehicle = (name: string) => ({
    id: 'fv-1',
    regNbr: 'FF-666-FF',
    category: { name },
  });

  it('accepts a category the vehicle type is served by', () => {
    expect(refuseIncompatibleFleetVehicle('First', vehicle('Luxe'))).toBeNull();
  });

  it('accepts a Van for a Lugg. booking, as the catalogue allows', () => {
    expect(refuseIncompatibleFleetVehicle('Lugg.', vehicle('Van'))).toBeNull();
  });

  it('refuses one it is not, and names the categories that would do', () => {
    expect(refuseIncompatibleFleetVehicle('Luxe', vehicle('Business'))).toEqual(
      {
        kind: 'invalid',
        message:
          'Vehicle FF-666-FF (Business) cannot service a Luxe trip — compatible categories: Luxe, Excep.',
      },
    );
  });
});
