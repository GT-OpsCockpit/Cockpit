/**
 * Single source of truth for phone numbers, in E.164 ("+33612345678") — the
 * format Twilio's WhatsApp API expects and the only one that is unambiguous
 * on its own. The previous convention (digits only, `+` stripped) let
 * "0612345678" and "33612345678" coexist in the same column with no way to
 * tell a trunk prefix from a country code, and made every number entered
 * without an indicative undeliverable (`whatsapp:+0612345678`).
 *
 * `isValidPhone` deliberately requires the leading `+`: the web <PhoneInput>
 * always emits E.164, so a national number never reaches the API and the
 * server never has to guess a country. `toE164` is the one place that does
 * guess, from an explicit hint — it exists for the data backfill and as a
 * defensive canonicaliser, not as a way to accept national input over HTTP.
 *
 * `/max` metadata (not the default `/min`): only it validates digit patterns
 * rather than length alone. "+33400456789" is length-plausible but is not an
 * allocated French number — `min` accepts it, `max` rejects it.
 *
 * Plain JS (not .ts) for the same reason as validation/email.js — see the
 * comment there.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/**
 * Every call below passes the default-country argument explicitly, even when it
 * is `undefined`. The `/max` entry point appends its metadata as a trailing
 * argument, so a one-argument call arrives as `(text, metadata)` — and the
 * library then decides whether that second argument is a country or the
 * metadata by checking `metadata.constructor === {}.constructor`. Under Jest's
 * ESM mode the metadata JSON is loaded in a different realm than that check, so
 * the constructors differ and the call throws "Invalid second argument".
 * Spelling the argument out makes it `(text, undefined, metadata)`, which is
 * unambiguous.
 */

/**
 * True when `value` is a complete, allocated phone number in E.164.
 * Empty/absent is *not* valid — callers decide whether a phone is required,
 * this only answers "is what I was given a real number".
 */
export function isValidPhone(value) {
  if (typeof value !== 'string') return false;
  // Without a leading `+` libphonenumber would need a default country to
  // parse at all, and would happily read "33612345678" as a French national
  // number — the exact ambiguity E.164 exists to remove.
  if (!value.trim().startsWith('+')) return false;
  // Defined as "toE164 can canonicalise it", so validity and storability can
  // never disagree.
  return toE164(value) !== null;
}

/**
 * Canonicalises `value` to E.164, or null when it isn't a valid number.
 * `defaultCountry` (ISO alpha-2) lets a national number ("06 12 34 56 78")
 * parse; without it only an already-international number can.
 */
export function toE164(value, defaultCountry) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry || undefined);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/**
 * Human-readable international form ("+33 6 12 34 56 78") for tables and
 * read-only cards. Anything unparsable is returned as-is rather than blanked,
 * so a row the backfill could not convert still shows its stored value.
 */
export function formatPhoneDisplay(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = parsePhoneNumberFromString(value.trim(), undefined);
  return parsed ? parsed.formatInternational() : value;
}

/** ISO alpha-2 country the number belongs to, or null. */
export function phoneCountry(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = parsePhoneNumberFromString(value.trim(), undefined);
  return parsed?.country ?? null;
}
