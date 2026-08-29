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

/**
 * The currency a Retail net figure is quoted in.
 *
 * What we charge the customer is priced in one of four currencies, whatever
 * the country's own: the euro zone in EUR, Switzerland in CHF, the UK in GBP,
 * everywhere else in USD (bookingCurrency, common.js:1193-1201). Distinct from
 * the Partner rate, which is quoted in the currency of the country the job
 * runs in — so a booking in Japan is charged in USD while its partner is paid
 * in JPY, and showing "≈ … JPY" under Retail net says the wrong thing.
 *
 * Independent of where the amounts are *stored*: v2 stores both in EUR (see
 * LEGACY_PARITY_AUDIT §7.1). This is the unit the figure is read in.
 */
const RETAIL_CURRENCIES = ['EUR', 'CHF', 'GBP'];

export function retailCurrency(countryCurrency) {
  if (!countryCurrency) return null;
  const code = String(countryCurrency).trim().toUpperCase();
  return RETAIL_CURRENCIES.includes(code) ? code : 'USD';
}
