import { DateTime } from 'luxon';
import type { Prisma } from '../../generated/prisma/client';
import { ClientType, Service } from '../../generated/prisma/enums';
import type { TripCategory, TripPeriod } from './dto/list-trips-query.dto';

/**
 * What bounds a booking list.
 *
 * `GET /trips` is not paginated — its bound is its window plus its filters
 * (see docs/adr/0001). This module is that bound: every narrowing the five
 * Trip list views can ask for, turned into the one `where` the query runs
 * with. Kept apart from TripsService so the rule the ADR chose *instead* of
 * pagination can be asserted as a value, rather than inferred from a
 * Playwright run against a live Postgres.
 *
 * The caller states what the dispatcher asked for; when "now" is is this
 * module's business, and so is the reference zone.
 */

// Single source of truth for "what's in view" on the Bookings board — this
// used to be recomputed client-side (isPastDay/periodMatches/baseVisibility
// in apps/web's trip-status.ts) against a full, ever-growing, unfiltered
// fetch. Same reference zone as the legacy header / the urgency highlight.
const PARIS_ZONE = 'Europe/Paris';

/**
 * The narrowing a caller may ask for. Structurally satisfied by
 * ListTripsQueryDto — spelled out here so the rules never depend on the
 * transport, the same division booking-fields.ts and trip-assignment.ts use.
 */
export interface TripWindowQuery {
  from?: string;
  to?: string;
  period?: TripPeriod;
  category?: TripCategory;
  board?: boolean;
  search?: string;
  clientRef?: string;
  driverRef?: string;
  partnerRef?: string;
  passenger?: string;
  vehicleType?: string;
  fleetRegNbr?: string;
  refPo?: string;
  service?: Service;
  hasPartner?: boolean;
  unbilled?: boolean;
}

/** Date range for the user-facing period filter — `null` means "no bound" (period 'all'). */
function periodDateRange(
  period: TripPeriod,
  nowParis: DateTime,
): Prisma.DateTimeFilter | null {
  switch (period) {
    case 'all':
      return null;
    case 'today': {
      const start = nowParis.startOf('day');
      return { gte: start.toJSDate(), lt: start.plus({ days: 1 }).toJSDate() };
    }
    case 'week': {
      const start = nowParis.startOf('week');
      return { gte: start.toJSDate(), lt: start.plus({ weeks: 1 }).toJSDate() };
    }
    case 'upcoming':
      return { gte: nowParis.toJSDate() };
    case 'past':
      return { lt: nowParis.toJSDate() };
  }
}

/**
 * The Bookings board's search box, token by token: every word typed has to turn
 * up somewhere, in any of the searched fields.
 *
 * Same rule as searchTokensFilter (Clients/Drivers/Vehicles), spelled out here
 * because the fields it has to reach are on four different records. The account
 * and driver `name`s a dispatcher types are derived, never stored, so what gets
 * searched is what they are derived from — including the partner's, since the
 * board's Driver column falls back to it.
 */
function tripSearchFilter(
  search: string | undefined,
): Prisma.TripWhereInput[] | undefined {
  const tokens = (search ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;

  const has = (token: string) =>
    ({ contains: token, mode: 'insensitive' }) as const;
  const assignee = (token: string) => ({
    OR: [
      { firstName: has(token) },
      { lastName: has(token) },
      { company: has(token) },
      { ref: has(token) },
    ],
  });

  return tokens.map((token) => ({
    OR: [
      { ref: has(token) },
      { passengerName: has(token) },
      {
        client: {
          OR: [
            { company: has(token) },
            { contactFirstName: has(token) },
            { contactLastName: has(token) },
            { ref: has(token) },
          ],
        },
      },
      { driver: assignee(token) },
      { partner: assignee(token) },
    ],
  }));
}

/**
 * Every narrowing the caller asked for, as one `where`.
 *
 * `now` is the instant the window is resolved against — defaulted so callers
 * stay one-liners, passed explicitly by the spec.
 */
export function tripWindow(
  query: TripWindowQuery,
  now: DateTime = DateTime.now(),
): Prisma.TripWhereInput {
  const period = query.period ?? 'upcoming';
  const category = query.category ?? 'daily';
  const nowParis = now.setZone(PARIS_ZONE);

  // Live dispatch board only (`board=true`, Bookings): a trip whose pickup
  // was before *today* (Paris) drops out of view once it has a driver —
  // an already-handled job is clutter, an unassigned one still needs
  // attention. The legacy applied this client-side on the Bookings page
  // and nowhere else, so it must stay opt-in: Invoicing bills completed
  // months, and Events/Partner log/Planning all need their past history.
  const where: Prisma.TripWhereInput = query.board
    ? {
        OR: [
          { pickupAt: { gte: nowParis.startOf('day').toJSDate() } },
          { driverId: null },
        ],
      }
    : {};

  const client: Prisma.ClientWhereInput = {};
  if (category === 'daily') client.clientType = { not: ClientType.EVENT };
  else if (category === 'event') client.clientType = ClientType.EVENT;
  if (query.clientRef) client.ref = query.clientRef;
  // Ref/PO is a field of the account, not of the booking — so it joins the
  // same `client` filter rather than becoming a second one (which would
  // overwrite the clientType/ref keys built just above).
  if (query.refPo?.trim()) {
    client.refPoOther = {
      contains: query.refPo.trim(),
      mode: 'insensitive',
    };
  }
  if (Object.keys(client).length > 0) where.client = client;

  // The board's own filter bar, resolved here rather than over an unbounded
  // fetch in the browser (was applyBookingFilters, trip-status.ts).
  const search = tripSearchFilter(query.search);
  if (search) where.AND = search;
  if (query.driverRef) where.driver = { ref: query.driverRef };
  if (query.partnerRef) where.partner = { ref: query.partnerRef };
  if (query.vehicleType) where.vehicleType = { name: query.vehicleType };
  if (query.fleetRegNbr) where.fleetVehicle = { regNbr: query.fleetRegNbr };
  if (query.service) where.service = query.service;
  if (query.passenger?.trim()) {
    where.passengerName = {
      contains: query.passenger.trim(),
      mode: 'insensitive',
    };
  }

  // An explicit window replaces the named period entirely — see
  // ListTripsQueryDto.from.
  const window =
    query.from || query.to
      ? {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lt: new Date(query.to) }),
        }
      : periodDateRange(period, nowParis);
  if (window) where.pickupAt = window;

  if (query.hasPartner) where.partnerId = { not: null };
  if (query.unbilled) where.invoiced = false;

  return where;
}
