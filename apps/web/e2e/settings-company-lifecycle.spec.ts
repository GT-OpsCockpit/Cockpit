import { expect, test } from '@playwright/test'
import { API_BASE_URL } from './config'

/**
 * Covers the /settings → Company tab: PUT /company-info is a singleton that
 * hard-locks after its first successful save (company.service.ts throws
 * ConflictException once `saved` is true) — there is no v2 equivalent of the
 * legacy's pencil-icon/password re-edit flow (see docs/handoff and
 * company-tab.tsx). Because that lock is global and survives across local
 * e2e re-runs (`reuseExistingServer` means the API isn't always freshly
 * migrated+seeded — same non-resetting-DB caveat as drivers-lifecycle.spec.ts),
 * this spec checks the API's current state first and adapts: if company info
 * isn't saved yet, it exercises the full create → lock flow; if a previous
 * run already saved it, it only verifies the locked/read-only view.
 */
test.describe('Settings — Company tab (ADMIN)', () => {
  test('creates company info once, then it is permanently locked/read-only', async ({ page, request }) => {
    const existing = await request.get(`${API_BASE_URL}/api/company-info`)
    expect(existing.ok()).toBe(true)
    const company = (await existing.json()) as { saved: boolean }

    await page.goto('/settings')
    const companyPanel = page.getByRole('tabpanel', { name: 'Company' })

    if (!company.saved) {
      await companyPanel.getByLabel('Name', { exact: true }).fill('Cockpit Transport')
      await companyPanel.getByLabel('Legal name', { exact: true }).fill('Cockpit Transport SARL')
      await companyPanel.getByLabel('Street', { exact: true }).fill('1 Rue de la Paix')
      await companyPanel.getByLabel('Zip code', { exact: true }).fill('75002')
      await companyPanel.getByLabel('City', { exact: true }).fill('Paris')
      await companyPanel.getByLabel('Country', { exact: true }).click()
      await page.getByPlaceholder('Search country…').fill('France')
      await page.getByRole('option', { name: 'France (FR)' }).click()
      await companyPanel.getByLabel('VAT number', { exact: true }).fill('FR12345678901')
      await companyPanel.getByLabel('Website', { exact: true }).fill('https://cockpit.test')
      await companyPanel.getByLabel('Email', { exact: true }).fill('contact@cockpit.test')
      await companyPanel.getByLabel('Owner surname', { exact: true }).fill('Dubois')
      await companyPanel.getByLabel('Owner name', { exact: true }).fill('Marc')
      await companyPanel.getByLabel('Mobile', { exact: true }).fill('0611111111')
      await companyPanel.getByLabel('Owner email', { exact: true }).fill('marc.dubois@cockpit.test')
      await companyPanel.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Company info saved.').first()).toBeVisible()
    }

    // Either way, the panel now shows the locked, read-only view — no Save
    // button, no editable inputs, "Locked" badge.
    await expect(companyPanel.getByText('Locked')).toBeVisible()
    await expect(companyPanel.getByText("can only be set once and can't be edited afterwards")).toBeVisible()
    await expect(companyPanel.getByRole('button', { name: 'Save' })).toHaveCount(0)
    await expect(companyPanel.getByRole('textbox')).toHaveCount(0)

    // A second PUT attempt is rejected server-side too (not just hidden from the UI).
    const directRetry = await request.put(`${API_BASE_URL}/api/company-info`, {
      data: {
        name: 'x',
        legalName: 'x',
        street1: 'x',
        zipCode: 'x',
        city: 'x',
        countryCode: 'FR',
        vatNbr: 'x',
        email: 'x@x.test',
        website: 'x',
        ownerSurname: 'x',
        ownerName: 'x',
        mobile: 'x',
        ownerEmail: 'x@x.test',
      },
    })
    expect(directRetry.status()).toBe(409)

    // Reload — the lock is persisted, not just local component state.
    await page.reload()
    await expect(page.getByRole('tabpanel', { name: 'Company' }).getByText('Locked')).toBeVisible()
  })
})
