/**
 * The app's country catalogue (api/src/common/constants/countries.ts) is not
 * pure ISO 3166-1 alpha-2: 16 large or multi-timezone countries are split
 * into pseudo-codes carrying an ISO 3166-2 subdivision suffix — 'US-NY',
 * 'US-CA', 'AU-NSW', 'BR-SP', 'CA-ON', 'RU-MOW'… — because each split needs
 * its own default timezone. Those codes are the records' real identity
 * (Country.code, the D-FR-NI-ABC driver ref prefix, the Area logic), so they
 * are not renamed; anything speaking actual ISO (flag sprites, phone number
 * metadata) goes through here instead.
 *
 * 'XK' (Kosovo) is not ISO-assigned either, but both flag-icons and
 * libphonenumber know it, so it passes through untouched.
 *
 * Plain JS (not .ts) for the same reason as validation/email.js — see the
 * comment there.
 */

/** ISO alpha-2 for a catalogue country code, or null when there is none. */
export function toIso2(code) {
  if (typeof code !== 'string') return null;
  const base = code.trim().split('-')[0].toUpperCase();
  return base.length === 2 ? base : null;
}
