import { DateTime } from 'luxon';
import { tripWindow } from './trip-window';
import { ClientType, Service } from '../../generated/prisma/enums';

// 2026-06-15 is a Monday. 10:00 UTC is 12:00 in Paris, so "today (Paris)"
// starts at 22:00 UTC the previous day — the offset every date case below
// turns on.
const NOW = DateTime.fromISO('2026-06-15T10:00:00.000Z', { zone: 'utc' });
const PARIS_MIDNIGHT = new Date('2026-06-14T22:00:00.000Z');

describe('tripWindow — the named periods', () => {
  it('defaults to upcoming: everything from this instant on', () => {
    expect(tripWindow({}, NOW).pickupAt).toEqual({ gte: NOW.toJSDate() });
  });

  it("bounds 'today' to the Paris day, not the UTC one", () => {
    expect(tripWindow({ period: 'today' }, NOW).pickupAt).toEqual({
      gte: PARIS_MIDNIGHT,
      lt: new Date('2026-06-15T22:00:00.000Z'),
    });
  });

  it("bounds 'week' to the Paris week, starting Monday", () => {
    expect(tripWindow({ period: 'week' }, NOW).pickupAt).toEqual({
      gte: PARIS_MIDNIGHT,
      lt: new Date('2026-06-21T22:00:00.000Z'),
    });
  });

  it("bounds 'past' to everything before this instant", () => {
    expect(tripWindow({ period: 'past' }, NOW).pickupAt).toEqual({
      lt: NOW.toJSDate(),
    });
  });

  it("leaves 'all' unbounded — no pickupAt key at all", () => {
    expect(tripWindow({ period: 'all' }, NOW)).not.toHaveProperty('pickupAt');
  });

  it('resolves the same window whatever zone the caller hands it', () => {
    const inTokyo = NOW.setZone('Asia/Tokyo');
    expect(tripWindow({ period: 'today' }, inTokyo).pickupAt).toEqual(
      tripWindow({ period: 'today' }, NOW).pickupAt,
    );
  });
});

describe('tripWindow — an explicit from/to', () => {
  it('replaces the named period entirely, rather than narrowing it', () => {
    const where = tripWindow(
      {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
        period: 'today',
      },
      NOW,
    );
    expect(where.pickupAt).toEqual({
      gte: new Date('2026-01-01T00:00:00.000Z'),
      lt: new Date('2026-02-01T00:00:00.000Z'),
    });
  });

  it('replaces it even when only one bound is given', () => {
    expect(
      tripWindow({ from: '2026-01-01T00:00:00.000Z' }, NOW).pickupAt,
    ).toEqual({
      gte: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(
      tripWindow({ to: '2026-02-01T00:00:00.000Z' }, NOW).pickupAt,
    ).toEqual({
      lt: new Date('2026-02-01T00:00:00.000Z'),
    });
  });
});

describe('tripWindow — the live dispatch board', () => {
  it('is off by default: no OR, so past assigned trips stay in view', () => {
    expect(tripWindow({}, NOW)).not.toHaveProperty('OR');
  });

  it('keeps a past booking only while it has no driver', () => {
    expect(tripWindow({ board: true }, NOW).OR).toEqual([
      { pickupAt: { gte: PARIS_MIDNIGHT } },
      { driverId: null },
    ]);
  });

  it('narrows by the period as well as the board rule, never instead of it', () => {
    const where = tripWindow({ board: true, period: 'past' }, NOW);
    expect(where.OR).toBeDefined();
    expect(where.pickupAt).toEqual({ lt: NOW.toJSDate() });
  });
});

describe('tripWindow — the account filters', () => {
  it("defaults to 'daily': every account that is not an Event", () => {
    expect(tripWindow({}, NOW).client).toEqual({
      clientType: { not: ClientType.EVENT },
    });
  });

  it("shows only Event accounts for 'event'", () => {
    expect(tripWindow({ category: 'event' }, NOW).client).toEqual({
      clientType: ClientType.EVENT,
    });
  });

  it("filters no account type at all for 'all'", () => {
    expect(tripWindow({ category: 'all' }, NOW)).not.toHaveProperty('client');
  });

  it('joins Ref/PO to the same account filter rather than overwriting it', () => {
    expect(
      tripWindow(
        { category: 'event', clientRef: 'C-1', refPo: '  PO-42 ' },
        NOW,
      ).client,
    ).toEqual({
      clientType: ClientType.EVENT,
      ref: 'C-1',
      refPoOther: { contains: 'PO-42', mode: 'insensitive' },
    });
  });

  it('ignores a Ref/PO that is only whitespace', () => {
    expect(
      tripWindow({ category: 'all', refPo: '   ' }, NOW),
    ).not.toHaveProperty('client');
  });
});

describe('tripWindow — the assignment and billing filters', () => {
  it('matches the driver only, never the partner', () => {
    const where = tripWindow({ driverRef: 'D-1' }, NOW);
    expect(where.driver).toEqual({ ref: 'D-1' });
    expect(where).not.toHaveProperty('partner');
  });

  it('matches the partner only, never the driver', () => {
    const where = tripWindow({ partnerRef: 'D-9' }, NOW);
    expect(where.partner).toEqual({ ref: 'D-9' });
    expect(where).not.toHaveProperty('driver');
  });

  it('carries the vehicle, service and passenger narrowings', () => {
    const where = tripWindow(
      {
        vehicleType: 'Business',
        fleetRegNbr: 'AB-123-CD',
        service: Service.TSF,
        passenger: '  Dubois ',
      },
      NOW,
    );
    expect(where.vehicleType).toEqual({ name: 'Business' });
    expect(where.fleetVehicle).toEqual({ regNbr: 'AB-123-CD' });
    expect(where.service).toBe(Service.TSF);
    expect(where.passengerName).toEqual({
      contains: 'Dubois',
      mode: 'insensitive',
    });
  });

  it('ignores a passenger box holding only whitespace', () => {
    expect(tripWindow({ passenger: '  ' }, NOW)).not.toHaveProperty(
      'passengerName',
    );
  });

  it('reads hasPartner and unbilled as one-way switches', () => {
    const on = tripWindow({ hasPartner: true, unbilled: true }, NOW);
    expect(on.partnerId).toEqual({ not: null });
    expect(on.invoiced).toBe(false);

    // `false` is not a filter for "no partner" / "already billed" — see
    // ListTripsQueryDto.hasPartner.
    const off = tripWindow({ hasPartner: false, unbilled: false }, NOW);
    expect(off).not.toHaveProperty('partnerId');
    expect(off).not.toHaveProperty('invoiced');
  });
});

describe('tripWindow — the search box', () => {
  it('adds nothing when the box is empty or blank', () => {
    expect(tripWindow({}, NOW)).not.toHaveProperty('AND');
    expect(tripWindow({ search: '   ' }, NOW)).not.toHaveProperty('AND');
  });

  it('requires every token to turn up somewhere — one AND clause each', () => {
    const and = tripWindow({ search: 'Marc  Dubois' }, NOW).AND;
    expect(and).toHaveLength(2);
  });

  it('reaches the booking, the account, the driver and the partner', () => {
    const [clause] = tripWindow({ search: 'Dubois' }, NOW).AND as Record<
      string,
      unknown
    >[];
    expect(clause.OR).toEqual([
      { ref: { contains: 'Dubois', mode: 'insensitive' } },
      { passengerName: { contains: 'Dubois', mode: 'insensitive' } },
      {
        client: {
          OR: [
            { company: { contains: 'Dubois', mode: 'insensitive' } },
            { contactFirstName: { contains: 'Dubois', mode: 'insensitive' } },
            { contactLastName: { contains: 'Dubois', mode: 'insensitive' } },
            { ref: { contains: 'Dubois', mode: 'insensitive' } },
          ],
        },
      },
      {
        driver: {
          OR: [
            { firstName: { contains: 'Dubois', mode: 'insensitive' } },
            { lastName: { contains: 'Dubois', mode: 'insensitive' } },
            { company: { contains: 'Dubois', mode: 'insensitive' } },
            { ref: { contains: 'Dubois', mode: 'insensitive' } },
          ],
        },
      },
      {
        partner: {
          OR: [
            { firstName: { contains: 'Dubois', mode: 'insensitive' } },
            { lastName: { contains: 'Dubois', mode: 'insensitive' } },
            { company: { contains: 'Dubois', mode: 'insensitive' } },
            { ref: { contains: 'Dubois', mode: 'insensitive' } },
          ],
        },
      },
    ]);
  });
});

describe('tripWindow — the five Trip list views', () => {
  it('the Bookings board: its own window, its own filters, nothing re-filtered', () => {
    const where = tripWindow(
      { board: true, period: 'upcoming', search: 'Nice' },
      NOW,
    );
    // All four narrowings coexist — the board rule, the account type, the
    // search and the period, none of them overwriting another.
    expect(Object.keys(where).sort()).toEqual([
      'AND',
      'OR',
      'client',
      'pickupAt',
    ]);
    expect(where.OR).toEqual([
      { pickupAt: { gte: PARIS_MIDNIGHT } },
      { driverId: null },
    ]);
    expect(where.client).toEqual({ clientType: { not: ClientType.EVENT } });
    expect(where.AND).toHaveLength(1);
    expect(where.pickupAt).toEqual({ gte: NOW.toJSDate() });
  });

  it('the Invoicing Customer tab: a billing month of unbilled bookings', () => {
    expect(
      tripWindow(
        {
          from: '2026-05-01T00:00:00.000Z',
          to: '2026-06-01T00:00:00.000Z',
          unbilled: true,
          category: 'all',
        },
        NOW,
      ),
    ).toEqual({
      pickupAt: {
        gte: new Date('2026-05-01T00:00:00.000Z'),
        lt: new Date('2026-06-01T00:00:00.000Z'),
      },
      invoiced: false,
    });
  });

  it('the Partner log: the same month, farmed out only', () => {
    expect(
      tripWindow(
        {
          from: '2026-05-01T00:00:00.000Z',
          to: '2026-06-01T00:00:00.000Z',
          hasPartner: true,
          category: 'all',
        },
        NOW,
      ),
    ).toEqual({
      pickupAt: {
        gte: new Date('2026-05-01T00:00:00.000Z'),
        lt: new Date('2026-06-01T00:00:00.000Z'),
      },
      partnerId: { not: null },
    });
  });

  it('the Planning Gantt: an arbitrary span, past history included', () => {
    const where = tripWindow(
      {
        from: '2026-03-02T00:00:00.000Z',
        to: '2026-03-05T00:00:00.000Z',
        category: 'all',
      },
      NOW,
    );
    expect(where).not.toHaveProperty('OR');
    expect(where.pickupAt).toEqual({
      gte: new Date('2026-03-02T00:00:00.000Z'),
      lt: new Date('2026-03-05T00:00:00.000Z'),
    });
  });
});
