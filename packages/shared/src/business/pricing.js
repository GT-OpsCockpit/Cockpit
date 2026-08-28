/**
 * Booking margin — ported from the legacy's updateMarginHint
 * (common.js:1286-1300). Two formulas depending on where the job happens:
 *
 * - France: margin = (retail − partner) / retail
 * - Abroad: margin = ((retail / 1.1) − partner) / (retail / 1.1)
 *   French VAT is stripped from the retail price before comparing, because a
 *   foreign partner's rate carries none to strip.
 *
 * The /1.1 is about VAT, not currency, so it holds unchanged now that both
 * amounts are stored in EUR (the legacy stored each in its own local
 * currency under a column named priceEur — see docs/LEGACY_PARITY_AUDIT.md).
 *
 * Returns null when the margin isn't computable yet (no retail price, a zero
 * retail price, or no partner rate) — the caller shows nothing rather than
 * a misleading 0%.
 */
const FRANCE_COUNTRY_CODE = 'FR';
const FRENCH_VAT_MULTIPLIER = 1.1;

export function marginPercent({ priceEur, partnerRateEur, countryCode }) {
  if (priceEur == null || partnerRateEur == null) return null;
  if (!Number.isFinite(priceEur) || !Number.isFinite(partnerRateEur)) return null;
  if (priceEur === 0) return null;
  const base =
    countryCode === FRANCE_COUNTRY_CODE ? priceEur : priceEur / FRENCH_VAT_MULTIPLIER;
  return ((base - partnerRateEur) / base) * 100;
}

/**
 * For an "ASD" (at disposal) booking, Retail net and Partner rate net hold an
 * HOURLY rate — this is the resulting grand total, shown under each field so
 * the hourly figure isn't mistaken for the full booking price
 * (legacy updateAsdTotalHints, common.js:1344-1379). Null for any other
 * service, or while the rate/hours aren't both filled in.
 */
export function asdTotal({ rate, hours, service }) {
  if (service !== 'ASD') return null;
  if (rate == null || hours == null) return null;
  if (!Number.isFinite(rate) || !Number.isFinite(hours)) return null;
  return rate * hours;
}
