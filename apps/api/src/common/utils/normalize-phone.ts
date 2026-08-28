import { toE164 } from '@cockpit/shared';

/**
 * Canonicalises a phone number to E.164 ("+33612345678") before storage, or
 * null when there is nothing storable. Applied everywhere a phone is written
 * (POC, driver, client, user, company info).
 *
 * Null rather than '' for an absent number: Driver.phone is a unique column,
 * where several phone-less rows would collide on '' but not on NULL, and SQL
 * already has a word for "unknown". Client.pocPhone used to store '' instead,
 * which meant the same absence was written two different ways depending on
 * the table.
 *
 * The DTOs (@IsPhone) reject anything that isn't already E.164, so by the time
 * a request reaches a service this only strips spacing. The `countryHint` is
 * for the data backfill and for callers holding a legacy national number.
 */
export function normalizePhone(
  phone: string | null | undefined,
  countryHint?: string | null,
): string | null {
  return toE164(phone, countryHint);
}
