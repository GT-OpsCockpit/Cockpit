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
