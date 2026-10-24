// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js MESSAGES.
// English only — the legacy's `lang` field was dead code, never used to pick a
// language, so no i18n is reintroduced here (see docs/LEGACY_FEATURES.md §9).

export interface TripMessageContext {
  ref: string;
  pocName: string | null;
  driverName: string | null;
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  pickupDate: string;
  pickupTime: string;
  vehicleType: string | null;
  // Turn-by-turn directions from wherever the driver opens the link, to the
  // pickup/drop-off address — no API key needed, Maps geocodes the address
  // text itself. `dropoffMapsLink` is null exactly when there's no
  // drop-off address to link to.
  pickupMapsLink: string;
  dropoffMapsLink: string | null;
  service: string;
  instructions: string | null;
  paxCount: number | null;
  regNbr: string | null;
  billing: string | null;
  /** Retail net + 10%, only ever set when `billing === 'CASH'`. */
  cashAmount: number | null;
}

export interface DriverDispatchContext {
  name: string;
}

/**
 * The booking recap the POC gets when a driver is assigned and again when
 * something relevant changes: the driver-side details minus everything that is
 * internal or only useful behind the wheel (Maps links, Info, cash collection).
 */
function pocBookingLines(t: TripMessageContext): string[] {
  const lines = [
    `Booking ref: ${t.ref}`,
    `Date: ${t.pickupDate}`,
    `Pickup time: ${t.pickupTime} (local time)`,
    `Service type: ${t.service}`,
    `Pickup location: ${t.pickupLocation}`,
  ];
  if (t.service === 'TSF' && t.dropoffLocation) {
    lines.push(`Drop off location: ${t.dropoffLocation}`);
  }
  lines.push(
    '',
    `Pax name: ${t.passengerName}`,
    `Pax nbr: ${t.paxCount ?? '-'}`,
    `Driver: ${t.driverName ?? '-'}`,
    `Vehicle type: ${t.vehicleType ?? '-'}`,
    `Reg nbr: ${t.regNbr ?? '-'}`,
  );
  return lines;
}

const greeting = (t: TripMessageContext) => `Hello ${t.pocName || 'there'}`;

export const MESSAGES = {
  // To the POC, five moments only: assigned, updated, arrived, on board,
  // dropped (the legacy's "accepted" and "on my way" messages are gone — those
  // two steps are still recorded, they just no longer message anyone).
  assigned: (t: TripMessageContext) =>
    [`${greeting(t)}, a driver has been assigned to your booking.`, '', ...pocBookingLines(t)].join('\n'),
  updated: (t: TripMessageContext) =>
    [`${greeting(t)}, your booking has been updated. Please find the new details below.`, '', ...pocBookingLines(t)].join('\n'),
  arrived: (t: TripMessageContext) =>
    [
      `${greeting(t)}, the chauffeur ${t.driverName ?? ''} appointed for ${t.passengerName} has arrived at the pickup location (${t.pickupLocation}).`,
      `Booking ref: ${t.ref}`,
    ].join('\n'),
  // Same rule as the driver's recap: only a transfer (TSF) has a single
  // drop-off to announce; an ASD/SPEC job just says it is on its way.
  onboard: (t: TripMessageContext) =>
    [
      `${greeting(t)}, passenger ${t.passengerName} is on board. On the way${t.service === 'TSF' && t.dropoffLocation ? ` to ${t.dropoffLocation}` : ''}.`,
      `Booking ref: ${t.ref}`,
    ].join('\n'),
  dropped: (t: TripMessageContext) =>
    [
      `${greeting(t)}, drop-off and service completed with ${t.passengerName}.`,
      `Booking ref: ${t.ref}`,
      '',
      'Thank you for your trust. It was a pleasure to have had the opportunity to transport your guest.',
    ].join('\n'),
  driverDispatch: (t: TripMessageContext, d: DriverDispatchContext) => {
    const lines = [
      `Dear ${d.name},`,
      `Please see below booking ${t.ref} details:`,
      '',
      `Date: ${t.pickupDate}`,
      `Pickup time: ${t.pickupTime} (local time)`,
      `Service type: ${t.service}`,
      `Pickup location: ${t.pickupLocation} 🗺️ ${t.pickupMapsLink}`,
      `Info: ${t.instructions || '-'}`,
    ];
    // Only a transfer (TSF) has a meaningful single drop-off address to
    // hand the driver — ASD (disposal) and SPEC bookings run by the hour or
    // by a custom itinerary instead, so there's nothing useful to put here.
    if (t.service === 'TSF' && t.dropoffLocation) {
      lines.push(
        `Drop off location: ${t.dropoffLocation}${t.dropoffMapsLink ? ` 🗺️ ${t.dropoffMapsLink}` : ''}`,
      );
    }
    lines.push(
      '',
      `Pax name: ${t.passengerName}`,
      `Pax nbr: ${t.paxCount ?? '-'}`,
      `Vehicle type: ${t.vehicleType ?? '-'}`,
    );
    // Only when a car is actually assigned (a local booking, or a sub-contracted
    // individual driver with a vehicle) — otherwise there is nothing to show.
    if (t.regNbr) lines.push(`Reg nbr: ${t.regNbr}`);
    // Account/card bookings settle separately (invoiced or already charged);
    // cash is the one case the driver needs to know to collect on the spot,
    // and how much.
    if (t.billing === 'CASH' && t.cashAmount != null) {
      lines.push('', `Payment: Cash (${t.cashAmount.toFixed(2)} €)`);
    }
    return lines.join('\n');
  },
  /**
   * A partner's own driver, told a job they were dispatched is off — either
   * cancelled outright or taken back in-house. Sent automatically alongside
   * (never instead of) the cancellation email to their company, unlike the
   * dispatch/update messages above which are the only channel for the POC.
   */
  driverCancellation: (t: TripMessageContext, d: DriverDispatchContext) =>
    `Dear ${d.name}, booking ${t.ref} (${t.pickupDate} at ${t.pickupTime}, pickup: ${t.pickupLocation}) has been cancelled. You no longer need to run this job.`,
};
