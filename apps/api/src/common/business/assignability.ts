import { DateTime } from 'luxon';
import { isLocalTrip } from '@cockpit/shared';
import type { Prisma } from '../../../generated/prisma/client';

// The app's reference zone everywhere a "today" is needed (same as
// TripsService's period windows and the urgency highlight). The legacy used
// the browser's own midnight (todayDateStr, common.js:2962); resolving it
// server-side means every dispatcher sees the same roster whatever their
// machine's clock is set to.
const PARIS_ZONE = 'Europe/Paris';

/** Midnight (Paris) of the current day, as the UTC instant the date columns are stored at. */
export function todayUtcMidnight(now: DateTime = DateTime.now()): Date {
  return new Date(`${now.setZone(PARIS_ZONE).toISODate()!}T00:00:00.000Z`);
}

/**
 * "Within its linked Event's date range today" — an Events-scoped driver or
 * vehicle is resting before its event starts and done once it has ended.
 * Ported from isWithinEventWindow (common.js:2970-2986); a record with no
 * event link, or an event with no dates on file, always passes.
 *
 * Gated on *today*, not on the trip's own pickup date — that coarseness is
 * the legacy's own, deliberately kept.
 */
function withinEventWindow(today: Date) {
  return {
    OR: [
      { eventsOnly: false },
      { eventClientId: null },
      {
        eventClient: {
          is: {
            OR: [
              { eventStartDate: null },
              { eventEndDate: null },
              {
                AND: [
                  { eventStartDate: { lte: today } },
                  { eventEndDate: { gte: today } },
                ],
              },
            ],
          },
        },
      },
    ],
  };
}

/**
 * The negation of withinEventWindow, as a filter: records that ARE scoped to
 * an Event, that Event has dates on file, and today falls outside them — the
 * dormant Events drivers/vehicles offerEventReactivation proposed relinking
 * (common.js:3912). A record with no event link, or one whose event has no
 * dates, is never dormant: it is simply always available.
 */
export function outsideEventWindowFilter(today: Date) {
  return {
    eventsOnly: true,
    eventClient: {
      is: {
        eventStartDate: { not: null },
        eventEndDate: { not: null },
        OR: [
          { eventStartDate: { gt: today } },
          { eventEndDate: { lt: today } },
        ],
      },
    },
  };
}

/** Blocked by a date range covering today (startDate ≤ today ≤ endDate). */
function outsideRange(today: Date) {
  return {
    OR: [{ startDate: { gt: today } }, { endDate: { lt: today } }],
  };
}

/**
 * `active` + not marked unavailable today + within its event window — the
 * legacy's isEffectivelyActive (common.js:3010-3012), which gated every
 * assignment picker.
 *
 * Drivers carry either a single-day marker (🫥 day off, `date`) or a range
 * (holidays / sick leave); fleet vehicles only ever carry a range (🔧 repair
 * / service / bodywork), which is why the two can't share one filter.
 */
export function driverEffectivelyActiveFilter(
  today: Date,
): Prisma.DriverWhereInput {
  return {
    AND: [
      { active: true },
      {
        OR: [
          { unavailability: { is: null } },
          // Day off: only that exact date is blocked.
          {
            unavailability: {
              is: { date: { not: null }, NOT: { date: today } },
            },
          },
          { unavailability: { is: { date: null, ...outsideRange(today) } } },
        ],
      },
      withinEventWindow(today),
    ],
  };
}

export function fleetVehicleEffectivelyActiveFilter(
  today: Date,
): Prisma.FleetVehicleWhereInput {
  return {
    AND: [
      { active: true },
      {
        OR: [
          { unavailability: { is: null } },
          { unavailability: { is: outsideRange(today) } },
        ],
      },
      withinEventWindow(today),
    ],
  };
}

/** The trip context driver eligibility is decided against — a saved trip or a form draft. */
export interface TripAssignmentContext {
  /** True when the booking's client account is an Events-type account. */
  isEvent: boolean;
  area?: string | null;
  countryCode?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
}

/**
 * Which drivers may service a given booking — ported from
 * driverEligibleForTrip (common.js:3087-3093):
 *
 * - Events-checked driver (in-house or partner alike): Events jobs only,
 *   any locality.
 * - In-house driver (no Company): every daily job, and an Events job only
 *   if it's local.
 * - Partner driver (Company set): daily jobs only, any locality.
 *
 * Expressed as a where-fragment rather than a predicate so it composes with
 * the paginated list query instead of forcing an unbounded fetch + filter.
 */
export function driverEligibilityFilter(
  trip: TripAssignmentContext,
): Prisma.DriverWhereInput {
  if (!trip.isEvent) return { eventsOnly: false };

  return {
    OR: [
      { eventsOnly: true },
      // In-house drivers can take an Events job, but only a local one.
      ...(isLocalTrip(trip) ? [{ eventsOnly: false, company: null }] : []),
    ],
  };
}
