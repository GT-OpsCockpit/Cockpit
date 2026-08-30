import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Fills an Area field ("Area" or "Event area").
 *
 * Since the §8.5 port these are constrained comboboxes (AreaField over
 * search-combobox's `allowCustomValue`), not plain inputs: they suggest the
 * chosen country's major cities and only offer "Local" in France, while still
 * accepting a city that isn't catalogued — exactly as the legacy's field did.
 * So a value is committed by picking either the matching suggestion or the
 * "Use “…”" row, never by typing alone.
 */
export async function fillArea(page: Page, scope: Locator, value: string, label = 'Area') {
  await scope.getByLabel(label, { exact: true }).click()
  await page.getByPlaceholder('Search or type an area…').fill(value)
  await page.getByRole('option', { name: new RegExp(`^(${value}|Use “${value}”)$`) }).click()
  await expect(scope.getByLabel(label, { exact: true })).toHaveText(value)
}

/**
 * Fills a PU / DO address field.
 *
 * Since the address search was restored (2026-08-29, `0308256`) these are
 * comboboxes over `GET /geo/geocode-search`, not plain inputs — `fill()` on
 * them fails with "Element is not an <input>". The value is committed by
 * picking a row, and the "Use “…”" row is the one to pick: it commits exactly
 * what was typed, so the test does not depend on what the geocoder happens to
 * return today.
 */
export async function fillAddress(page: Page, scope: Locator, label: 'PU' | 'DO', value: string) {
  // PU and DO share a placeholder, and the popover unmounts a beat after a
  // selection commits — hence the count assertions either side: without them
  // the next field's click lands while both are mounted, and the locator is
  // ambiguous.
  await fillCombobox(page, scope, label, value, 'Search an address or airport…')
}

/**
 * Fills the "POC Name" field, a combobox over `GET /geo/poc-search` since
 * 2026-08-29 (`35fbf52`) — it suggests contacts already on file and fills in
 * their number, as the legacy's did (`common.js:1881-1889`). Free text is
 * still accepted, which is what this picks.
 */
export async function fillPocName(page: Page, scope: Locator, value: string) {
  await fillCombobox(page, scope, 'POC Name', value, 'Search a contact…')
}

/**
 * Fills the Vehicles form's "Partner" field with a company that need not exist
 * yet.
 *
 * Restored as a combobox over the partner directory on 2026-08-29 (`35fbf52`),
 * so `fill()` no longer applies — but it keeps `allowCustomValue`, exactly as
 * the legacy's free-text field did, and that is the row to pick here.
 */
export async function fillPartnerCompany(page: Page, scope: Locator, value: string) {
  await fillCombobox(page, scope, 'Partner', value, 'Search a partner company…')
}

/**
 * Commits a value into a free-text SearchCombobox (`allowCustomValue`).
 *
 * Two rows can carry the value and only ever one of them at a time: the
 * "Use “…”" row is suppressed when an option already reads exactly the same
 * (search-combobox.tsx's `showCustomValue`), which is why this matches either.
 *
 * The count assertions either side are not ceremony: the popover unmounts a
 * beat after a selection commits, and several of these fields share a search
 * placeholder — filling the next one while the previous is still mounted makes
 * the locator ambiguous.
 */
async function fillCombobox(
  page: Page,
  scope: Locator,
  label: string,
  value: string,
  searchPlaceholder: string,
) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const search = page.getByPlaceholder(searchPlaceholder)
  await scope.getByLabel(label, { exact: true }).click()
  await expect(search).toHaveCount(1)
  await search.fill(value)
  // These lists are remote and debounced: rows are re-rendered as results
  // land, which detaches the one being clicked. CommandList marks the wait
  // with aria-busy, so wait for it rather than racing the re-render.
  await expect(page.locator('[data-slot="command-list"][aria-busy="true"]')).toHaveCount(0)
  // Matched on the start, not the whole name: an option renders its
  // description beside its label (a POC's phone number, an address's
  // timezone), and that is part of its accessible name. The free-text row is
  // rendered above the results, so `.first()` prefers it whenever it is there
  // — which is exactly when the typed value is not already an option.
  await page
    .getByRole('option', { name: new RegExp(`^(Use “${escaped}”|${escaped}\\b)`) })
    .first()
    .click()
  await expect(scope.getByLabel(label, { exact: true })).toHaveText(value)
  await expect(search).toHaveCount(0)
}
