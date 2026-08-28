import { expect, test } from '@playwright/test'
import { API_BASE_URL } from './config'

/**
 * Covers /settings → Company tab. `PUT /company-info` is a singleton, but it
 * is NOT write-once: the 409 that used to reject every save after the first
 * was audit item B3 — the legacy always let the Owner re-edit the panel
 * behind its password, so refusing outright was a regression, not a rule.
 * `saved` now only means "filled in at least once", and it drives a read-only
 * view with a pencil that re-opens the form (company-tab.tsx).
 *
 * Because that state is global and survives across local e2e re-runs
 * (`reuseExistingServer` means the API isn't always freshly migrated+seeded —
 * same non-resetting-DB caveat as drivers-lifecycle.spec.ts), this spec reads
 * the API's current state first and adapts: an unsaved panel goes through the
 * first-save flow, an already-saved one starts straight at the pencil.
 */
const COMPANY = {
  name: 'Cockpit Transport',
  legalName: 'Cockpit Transport SARL',
  street1: '1 Rue de la Paix',
  zipCode: '75002',
  city: 'Paris',
  vatNbr: 'FR12345678901',
  website: 'https://cockpit.test',
  email: 'contact@cockpit.test',
  ownerSurname: 'Dubois',
  ownerName: 'Marc',
  mobile: '0611111111',
  ownerEmail: 'marc.dubois@cockpit.test',
}

test.describe('Settings — Company tab (ADMIN)', () => {
  test('saves company info, shows it read-only, and re-opens it through the pencil', async ({ page, request }) => {
    const existing = await request.get(`${API_BASE_URL}/api/company-info`)
    expect(existing.ok()).toBe(true)
    const company = (await existing.json()) as { saved: boolean }

    await page.goto('/settings')
    const companyPanel = page.getByRole('tabpanel', { name: 'Company' })

    async function fillForm(name: string) {
      await companyPanel.getByLabel('Name', { exact: true }).fill(name)
      await companyPanel.getByLabel('Legal name', { exact: true }).fill(COMPANY.legalName)
      await companyPanel.getByLabel('Street', { exact: true }).fill(COMPANY.street1)
      await companyPanel.getByLabel('Zip code', { exact: true }).fill(COMPANY.zipCode)
      await companyPanel.getByLabel('City', { exact: true }).fill(COMPANY.city)
      await companyPanel.getByLabel('Country', { exact: true }).click()
      await page.getByPlaceholder('Search country…').fill('France')
      await page.getByRole('option', { name: 'France (FR)' }).click()
      await companyPanel.getByLabel('VAT number', { exact: true }).fill(COMPANY.vatNbr)
      await companyPanel.getByLabel('Website', { exact: true }).fill(COMPANY.website)
      await companyPanel.getByLabel('Email', { exact: true }).fill(COMPANY.email)
      await companyPanel.getByLabel('Owner surname', { exact: true }).fill(COMPANY.ownerSurname)
      await companyPanel.getByLabel('Owner name', { exact: true }).fill(COMPANY.ownerName)
      await companyPanel.getByLabel('Mobile', { exact: true }).fill(COMPANY.mobile)
      await companyPanel.getByLabel('Owner email', { exact: true }).fill(COMPANY.ownerEmail)
      await companyPanel.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Company info saved.').first()).toBeVisible()
    }

    if (!company.saved) await fillForm(COMPANY.name)

    // Saved ⇒ read-only: the values are rendered as text, not inputs, and the
    // only control left is the pencil.
    const editButton = companyPanel.getByRole('button', { name: 'Edit company info' })
    await expect(editButton).toBeVisible()
    await expect(companyPanel.getByRole('button', { name: 'Save' })).toHaveCount(0)
    await expect(companyPanel.getByRole('textbox')).toHaveCount(0)

    // The pencil re-opens the form, prefilled — this is the part B3 restored.
    await editButton.click()
    await expect(companyPanel.getByLabel('Legal name', { exact: true })).toHaveValue(COMPANY.legalName)

    // Cancel backs out without saving, straight to the read-only view.
    await companyPanel.getByRole('button', { name: 'Cancel' }).click()
    await expect(editButton).toBeVisible()

    // A second save actually goes through — no 409 any more.
    const renamed = `Cockpit Transport ${Date.now()}`
    await editButton.click()
    await fillForm(renamed)
    await expect(companyPanel.getByText(renamed)).toBeVisible()

    const afterRename = await request.get(`${API_BASE_URL}/api/company-info`)
    expect(((await afterRename.json()) as { name: string }).name).toBe(renamed)

    // Reload — read-only again, so `saved` is persisted, not component state.
    await page.reload()
    await expect(page.getByRole('tabpanel', { name: 'Company' }).getByText(renamed)).toBeVisible()
  })
})
