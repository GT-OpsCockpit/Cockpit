import { DateTime } from 'luxon';
import { TripMessageContext } from '../common/constants/messages';

import { driverLabel } from '@cockpit/shared';
interface DriverForMessage {
  ref: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
}

export interface TripForMessage {
  ref: string;
  pocName: string | null;
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  pickupAt: Date;
  timezone: string | null;
  vehicleType: { name: string } | null;
  // `ref` and `company` are what driverLabel falls back on: a partner may be
  // a company with nobody named on it.
  driver: DriverForMessage | null;
  partner: DriverForMessage | null;
  service: string;
  instructions: string | null;
  paxCount: number | null;
  billing: string | null;
  // A Prisma Decimal, a plain number, or null — accepted as `unknown` here
  // so this util doesn't need to import the Prisma runtime type just to
  // widen it; `Number(...)` on any of the three does the right thing.
  priceEur: unknown;
  fleetVehicle: { regNbr: string } | null;
}

// Google's "dir" deep link with only a destination: opened on a phone, Maps
// (or the browser, falling back to Maps) routes from wherever the driver
// currently is — no origin to compute or keep in sync, and no API key,
// since the address text itself is geocoded when the link opens rather than
// ahead of time. Works identically as a plain https:// link inside a
// WhatsApp message, a future PDF mission sheet, or anywhere else a trip's
// address ends up.
export function buildGoogleMapsLink(address: string): string {
  return `https://maps.google.com/?daddr=${encodeURIComponent(address)}`;
}

// Every message template says "(local time)", and the legacy meant it: it
// stored the pickup as the wall-clock date/time at the pickup location.
// pickupAt here is a real instant, so it has to be read back in the trip's
// own timezone — reading it in UTC (or in the server's zone) would announce
// a pickup hours off from the one the dispatcher typed. Falls back to UTC
// only when no timezone was resolved for the trip at all.
export function buildTripMessageContext(
  trip: TripForMessage,
): TripMessageContext {
  const localPickup = DateTime.fromJSDate(trip.pickupAt).setZone(
    trip.timezone ?? 'utc',
  );
  const pickupDate = localPickup.toFormat('yyyy-MM-dd');
  const pickupTime = localPickup.toFormat('HH:mm');
  return {
    ref: trip.ref,
    pocName: trip.pocName,
    // driverLabel, not driverDisplayName: these templates put the name
    // mid-sentence ("this is <driver>, the driver"), and a partner company
    // with nobody named on file left a hole in it.
    driverName:
      trip.driver || trip.partner
        ? driverLabel((trip.driver ?? trip.partner)!)
        : null,
    passengerName: trip.passengerName,
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    pickupDate,
    pickupTime,
    vehicleType: trip.vehicleType?.name ?? null,
    pickupMapsLink: buildGoogleMapsLink(trip.pickupLocation),
    dropoffMapsLink: trip.dropoffLocation
      ? buildGoogleMapsLink(trip.dropoffLocation)
      : null,
    service: trip.service,
    instructions: trip.instructions,
    paxCount: trip.paxCount,
    regNbr: trip.fleetVehicle?.regNbr ?? null,
    billing: trip.billing,
    // The legacy's cash-collection convention: the driver collects retail
    // net plus a flat 10% (card/account bookings settle separately, so this
    // only ever applies — and only ever gets read by the template — when
    // billing is CASH).
    cashAmount:
      trip.billing === 'CASH' && trip.priceEur != null
        ? Number(trip.priceEur) * 1.1
        : null,
  };
}

/**
 * What the POC is told about when a saved booking changes: where/when/what —
 * pickup, drop-off (and the service type that decides whether a drop-off
 * exists), date and time, vehicle (type or reg nbr) and pax. Anything else
 * (price, instructions, billing…) is not their business.
 */
export function pocRelevantChange(
  before: Pick<
    TripForMessage,
    | 'pickupLocation'
    | 'dropoffLocation'
    | 'pickupAt'
    | 'service'
    | 'paxCount'
    | 'vehicleType'
    | 'fleetVehicle'
  >,
  after: typeof before,
): boolean {
  return (
    before.pickupLocation !== after.pickupLocation ||
    (before.dropoffLocation ?? '') !== (after.dropoffLocation ?? '') ||
    before.pickupAt.getTime() !== after.pickupAt.getTime() ||
    before.service !== after.service ||
    before.paxCount !== after.paxCount ||
    (before.vehicleType?.name ?? null) !== (after.vehicleType?.name ?? null) ||
    (before.fleetVehicle?.regNbr ?? null) !== (after.fleetVehicle?.regNbr ?? null)
  );
}

/**
 * What invalidates a mission the driver was already sent: everything the POC
 * cares about (see pocRelevantChange) plus what only the driver reads —
 * instructions, passenger name and the cash to collect.
 */
export function driverRelevantChange(
  before: Pick<
    TripForMessage,
    | 'pickupLocation'
    | 'dropoffLocation'
    | 'pickupAt'
    | 'service'
    | 'paxCount'
    | 'vehicleType'
    | 'fleetVehicle'
    | 'instructions'
    | 'passengerName'
    | 'billing'
    | 'priceEur'
  >,
  after: typeof before,
): boolean {
  if (pocRelevantChange(before, after)) return true;
  if ((before.instructions ?? '') !== (after.instructions ?? '')) return true;
  if (before.passengerName !== after.passengerName) return true;
  if (before.billing !== after.billing) return true;
  return (
    after.billing === 'CASH' && Number(before.priceEur) !== Number(after.priceEur)
  );
}

/**
 * Everything a sub-contracted partner (or driver) was told about the job,
 * boiled down to one string — the same fields driverRelevantChange compares.
 * Signed into the Confirm/Decline links of an email, so a link stops working
 * the moment the booking it described is edited.
 */
export function driverFingerprint(
  trip: Parameters<typeof driverRelevantChange>[0],
): string {
  return JSON.stringify([
    trip.pickupLocation,
    trip.dropoffLocation ?? '',
    trip.pickupAt.getTime(),
    trip.service,
    trip.paxCount,
    trip.vehicleType?.name ?? null,
    trip.fleetVehicle?.regNbr ?? null,
    trip.instructions ?? '',
    trip.passengerName,
    trip.billing,
    trip.billing === 'CASH' ? Number(trip.priceEur) : null,
  ]);
}
