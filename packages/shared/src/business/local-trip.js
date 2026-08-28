/**
 * "Local" vs "Farm out": a booking is Local when it starts OR ends in Nice,
 * Cannes, St-Tropez or Monaco. Ported verbatim from the legacy's isLocalTrip
 * (common.js:2944-2951). There is no structured city field for the drop-off,
 * so the Area field (which describes the pickup city) is complemented by a
 * plain text search over both addresses.
 *
 * Shared rather than duplicated because it drives three different things:
 * the Bookings Local/Farm-out table split (web, on already-loaded trips),
 * the driver-eligibility filter (api, on a draft trip), and whether the
 * Reg Nbr field applies at all (web, on the form draft).
 *
 * Plain JS (not .ts) for the same reason as validation/email.js — see the
 * comment there.
 */
const LOCAL_AREA_NAMES = [
  'nice',
  'cannes',
  'st tropez',
  'st-tropez',
  'saint-tropez',
  'saint tropez',
];

const MONACO_COUNTRY_CODE = 'MC';

export function isLocalTrip(trip) {
  const area = (trip.area || '').trim().toLowerCase();
  if (LOCAL_AREA_NAMES.some((name) => area === name)) return true;
  if (trip.countryCode === MONACO_COUNTRY_CODE) return true;
  const text = `${trip.pickupLocation || ''} ${trip.dropoffLocation || ''}`.toLowerCase();
  return LOCAL_AREA_NAMES.some((name) => text.includes(name));
}
