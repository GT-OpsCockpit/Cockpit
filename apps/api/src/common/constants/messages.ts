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
}

export interface DriverDispatchContext {
  name: string;
}

export const MESSAGES = {
  updated: (t: TripMessageContext) =>
    `Hello ${t.pocName}, your booking details have been updated. Pickup planned at: ${t.pickupLocation} on ${t.pickupDate} at ${t.pickupTime} (local time). Booking ref: ${t.ref}`,
  accepted: (t: TripMessageContext) =>
    `Hello ${t.pocName}, driver ${t.driverName} has accepted ${t.passengerName}'s booking. Pickup planned at: ${t.pickupLocation} on ${t.pickupDate} at ${t.pickupTime} (local time). Booking ref: ${t.ref}`,
  enroute: (t: TripMessageContext) =>
    `Hello ${t.pocName}, this is ${t.driverName}, the driver. I'm on my way to the pickup point for ${t.passengerName}: ${t.pickupLocation}. Booking ref: ${t.ref}`,
  arrived: (t: TripMessageContext) =>
    `Hello ${t.pocName}, this is ${t.driverName}, the driver. I have arrived at the pickup point for ${t.passengerName}: ${t.pickupLocation}. Booking ref: ${t.ref}`,
  onboard: (t: TripMessageContext) =>
    `Hello ${t.pocName}, pickup of ${t.passengerName} confirmed. On the way to ${t.dropoffLocation}. Booking ref: ${t.ref}`,
  dropped: (t: TripMessageContext) =>
    `Hello ${t.pocName}, drop-off of ${t.passengerName} completed at ${t.dropoffLocation}. Thank you for riding with us. Booking ref: ${t.ref}`,
  driverDispatch: (t: TripMessageContext, d: DriverDispatchContext) =>
    `Hello ${d.name}, new trip to handle. Passenger: ${t.passengerName}. Pickup: ${t.pickupLocation} on ${t.pickupDate} at ${t.pickupTime} (local time). Drop-off: ${t.dropoffLocation || '—'}. Vehicle: ${t.vehicleType}. Booking ref: ${t.ref}`,
};
