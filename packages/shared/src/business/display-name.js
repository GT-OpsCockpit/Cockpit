/**
 * How a client account and a driver are named in every list, label and
 * message. Shared rather than duplicated because both tiers derive them: the
 * API exposes `name` on ClientEntity/DriverEntity and uses it in the WhatsApp
 * bodies, and the web re-derives them for the nested ClientBaseEntity /
 * DriverBaseEntity carried inside a TripEntity, which have no `name` field.
 *
 * Plain JS (not .ts) for the same reason as validation/email.js — see the
 * comment there.
 */

/**
 * The account's display name: company first, then the contact's full name,
 * then the ref. Ported verbatim from the legacy (server.js:449) — an account
 * always has something to be called.
 */
export function clientDisplayName(client) {
  const contactFullName = [client.contactFirstName, client.contactLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return client.company?.trim() || contactFullName || `Account ${client.ref}`;
}

/**
 * The driver's display name: first + last, joined and trimmed.
 *
 * Deliberately NO fallback to company or ref, matching the legacy
 * (server.js:604) — and unlike clientDisplayName just above, which has one.
 * The asymmetry is structural: in the legacy the Company is always its own
 * field (its own column in the Drivers tables, its own combobox in the
 * partner picker, common.js:2756), so the name never has to carry it.
 *
 * The result is therefore empty for a partner company with no named
 * chauffeur, which v2 allows (assertValidDriverFields lets a record with a
 * company have no first/last name). Callers that show a partner on a single
 * line compose the two halves themselves — see driverLabel and partnerLabel below.
 */
export function driverDisplayName(driver) {
  return [driver.firstName, driver.lastName].filter(Boolean).join(' ').trim();
}

/**
 * A driver on one short label, where the UI has room for a single line and no
 * separate Company column: the name, else the company, else the ref. This is
 * presentation, not the name rule above — it exists precisely so that
 * driverDisplayName can stay faithful to the legacy while a nameless partner
 * company still reads as something in a toast, a table cell or a picker.
 */
export function driverLabel(driver) {
  return driverDisplayName(driver) || driver.company?.trim() || driver.ref;
}

/**
 * A partner where the UI shows the chauffeur AND the company on one line (the
 * assignment comboboxes). Drops whichever half is missing rather than
 * rendering a dangling separator: "Jean Dupont — Acme", or "Acme" when the
 * company has nobody named on file.
 */
export function partnerLabel(driver) {
  const name = driverDisplayName(driver);
  const company = driver.company?.trim() || '';
  if (name && company) return `${name} — ${company}`;
  return name || company || driver.ref;
}
