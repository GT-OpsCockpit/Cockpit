import { DateTime } from 'luxon';

/** The trip fields the two drafts read — a subset of the full TripEntity. */
export interface TripForSubcontractEmail {
  ref: string;
  pickupAt: Date;
  timezone: string | null;
  pickupLocation: string;
  dropoffLocation: string | null;
  service: string;
  hours: number | null;
  passengerName: string;
  paxCount: number | null;
  instructions: string | null;
  partnerRateEur: { toNumber(): number } | null;
  vehicleType: { name: string } | null;
  fleetVehicle: { make: string; model: string } | null;
}

export interface SubcontractEmailDraft {
  /**
   * The partner's email address on file, or null when there is none — the
   * legacy simply drew no draft in that case ("no email on file for this
   * partner — nothing to draft"), so the caller skips rather than errors.
   */
  to: string | null;
  subject: string;
  /** Plain text — a mailto: body has no formatting, hence the **asterisks** below. */
  body: string;
}

const DASH = '—';

/**
 * Pickup date and time, in the trip's own timezone. Time in 24h with the 12h
 * equivalent right next to it, e.g. "14:00 (02:00 PM)" — the legacy's format,
 * kept because partners abroad read one or the other.
 */
function pickupLines(trip: TripForSubcontractEmail) {
  const local = DateTime.fromJSDate(trip.pickupAt).setZone(
    trip.timezone ?? 'utc',
  );
  return {
    date: local.toFormat('dd/MM/yyyy'),
    time: `${local.toFormat('HH:mm')} (${local.toFormat('hh:mm a')})`,
  };
}

/**
 * Vehicle Category, plus the actual Fleet vehicle's Make/Model when one is
 * attached. A farmed-out job usually has none of ours on it, in which case
 * only the Category shows.
 */
function vehicleLine(trip: TripForSubcontractEmail) {
  const category = trip.vehicleType?.name ?? DASH;
  return trip.fleetVehicle
    ? `${category} - ${trip.fleetVehicle.make} - ${trip.fleetVehicle.model}`
    : category;
}

/**
 * The mission recap sent to a partner a job has just been farmed out to
 * (openSubcontractEmailDraft, common.js:2636).
 *
 * The partner rate is in EUR, not the trip country's currency the legacy
 * printed: v2 stores and invoices in EUR (audit §7.1), so printing "500 $"
 * next to a figure that is actually 500 € would reintroduce exactly the
 * currency confusion that decision removed.
 */
export function buildSubcontractEmail(
  trip: TripForSubcontractEmail,
  to: string | null,
): SubcontractEmailDraft {
  const { date, time } = pickupLines(trip);
  const isAsd = trip.service === 'ASD';
  const rate = trip.partnerRateEur;

  const lines = [
    'A job has been subcontracted to you please find below the details :',
    '',
    `Ref: ${trip.ref}`,
    `Vehicle type: ${vehicleLine(trip)}`,
    `Pax Name: ${trip.passengerName || DASH} (${trip.paxCount ?? '?'} pax)`,
    `Pickup Date: ${date}`,
    `Pickup time: ${time}`,
    `Pickup location: ${trip.pickupLocation || DASH}`,
    `Job type: ${trip.service || DASH}`,
    isAsd
      ? `Duration: ${trip.hours ?? '?'}h`
      : `Drop-off: ${trip.dropoffLocation || DASH}`,
    `Info: ${trip.instructions || DASH}`,
    `Partner rate net: ${rate ? `${rate.toNumber().toFixed(2)}€ Net` : DASH}`,
  ];

  return { to, subject: `Booking ${trip.ref}`, body: lines.join('\n') };
}

/**
 * Told to a partner whose job has been taken back off them
 * (openCanceledSubcontractEmailDraft, common.js:2686). Signed with the
 * company name from the Company sheet, with the legacy's own fallback.
 */
export function buildCanceledSubcontractEmail(
  trip: TripForSubcontractEmail,
  to: string | null,
  companyName: string | null,
): SubcontractEmailDraft {
  const { date, time } = pickupLines(trip);

  const lines = [
    'Please note the following job has been **Canceled** :',
    '',
    `Ref: ${trip.ref}`,
    `Vehicle type: ${vehicleLine(trip)}`,
    `Pax Name: ${trip.passengerName || DASH} (${trip.paxCount ?? '?'} pax)`,
    `Pickup Date: ${date}`,
    `Pickup time: ${time}`,
    `Pickup location: ${trip.pickupLocation || DASH}`,
    `Job type: ${trip.service || DASH}`,
    '',
    'Status : **Canceled**',
    '',
    'Thank you',
    '',
    'Best,',
    companyName || 'the dispatch team',
  ];

  return {
    to,
    subject: `🚨 Canceled booking ${trip.ref}`,
    body: lines.join('\n'),
  };
}
