import { expect, test, type Page } from '@playwright/test'
import { API_BASE_URL } from './config'
import { fillArea } from './helpers'

/**
 * Covers the paths the handoff (docs/handoff/2026-08-27-frontend-clients.md)
 * flagged as never exercised end-to-end: Company/Events creation, editing an
 * existing account (prefill + save), deactivate/reactivate, and the filters
 * bar. Individual creation (incl. validation errors) was already verified in
 * that session — not repeated here.
 *
 * Runs against `cockpit_test` (see playwright.config.ts), seeded idempotently
 * by seedFixtures() (apps/api/prisma/seed-data.ts) with "Marc Dubois"
 * (Individual, CI-prefixed) and "Atlas Capital" (Company, CC-prefixed) — used
 * below as known fixtures for the filters checks. Refs for accounts created
 * by this spec are read back from the create toast, same reasoning as
 * booking-lifecycle.spec.ts: the seed is idempotent but not a truncating
 * reset, so ref numbers drift across accumulated local runs.
 */

// Select/SearchCombobox triggers get their accessible name from the
// associated <FormLabel> via FormControl id-forwarding (see
// client-form-fields.tsx and search-combobox.tsx) — same mechanism already
// verified for Bookings (booking-lifecycle.spec.ts's selectFromDropdown).
async function selectFromDropdown(page: Page, name: string, optionText: string) {
  await page.getByRole('combobox', { name, exact: true }).click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

async function selectCountry(page: Page, label: string, query: string, optionText: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByPlaceholder('Search country…').fill(query)
  await page.getByRole('option', { name: optionText }).click()
}

// Sonner renders each toast twice (visible + aria-live announcer copy) — `.first()` avoids strict-mode.
function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

// Matched on the ref cell, exactly — an accessible-name match is a substring
// one, and this database is never truncated between runs (playwright.config.ts),
// so a ref like "F8" also matches the "F80" a later run created.
function row(page: Page, text: string) {
  // Anchored on the ref, but not exact: the External vehicles table renders an
  // <InactivityBadge> inside the same cell. Anchoring still keeps "F8" from
  // matching the "F80" a later run created — this database is never truncated
  // between runs (playwright.config.ts).
  const ref = new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: ref }) })
}

/**
 * Narrows the list to a single account before asserting on its row.
 *
 * The table pages at 20 (PAGE_SIZE in clients-page.tsx) and orders by ref, so a
 * freshly created account lands on the *last* page — and cockpit_test is never
 * truncated between runs (see this file's module comment), so "just created,
 * therefore on screen" stops holding as soon as accounts pile up. Filtering by
 * ref is deterministic whatever the database already holds.
 */
async function showOnly(page: Page, ref: string) {
  await page.getByPlaceholder('Search by ref, name, email or acronym…').fill(ref)
}

test.describe('Clients — account lifecycle', () => {
  test('create Company & Events accounts, edit, deactivate/reactivate, and filter', async ({ page }) => {
    const stamp = Date.now()
    await page.goto('/clients')

    // --- Create a Company account end-to-end ---
    const companyName = `E2E Company ${stamp}`
    await page.getByRole('button', { name: 'New account' }).click()
    let dialog = page.getByRole('dialog')
    await selectFromDropdown(page, 'Account type', 'Company')
    await dialog.getByLabel('Company name', { exact: true }).fill(companyName)
    // Also exercises the general address `countryCode` field (handoff flagged
    // it as never filled/saved before this spec) — verified round-tripping
    // through the edit dialog's prefill below.
    await selectCountry(page, 'Country', 'Fra', 'France (FR)')
    await dialog.getByRole('button', { name: 'Create' }).click()

    const companyToast = toast(page, /^Account (\w+) created\.$/)
    await expect(companyToast).toBeVisible()
    const companyRef = (await companyToast.textContent())?.match(/Account (\w+) created/)?.[1]
    if (!companyRef) throw new Error('Could not read the created Company account ref off the toast.')

    await showOnly(page, companyRef)
    await expect(row(page, companyRef)).toBeVisible()
    await expect(row(page, companyRef).getByText('Company', { exact: true })).toBeVisible()
    // Sonner auto-dismisses after a few seconds — wait it out so the next
    // step's generic "Account (\w+) created." matcher can't pick up this
    // still-lingering toast instead of the new one.
    await expect(companyToast).toBeHidden({ timeout: 6000 })

    // --- Create an Events account end-to-end ---
    const eventName = `E2E Event ${stamp}`
    await page.getByRole('button', { name: 'New account' }).click()
    dialog = page.getByRole('dialog')
    await selectFromDropdown(page, 'Account type', 'Events')
    await dialog.getByLabel('Event name', { exact: true }).fill(eventName)
    await selectCountry(page, 'Event country', 'Fra', 'France (FR)')
    await fillArea(page, dialog, 'Nice', 'Event area')
    await dialog.getByLabel('Start date', { exact: true }).fill('2026-09-01')
    await dialog.getByLabel('End date', { exact: true }).fill('2026-09-05')
    await dialog.getByRole('button', { name: 'Create' }).click()

    const eventToast = toast(page, /^Account (\w+) created\.$/)
    await expect(eventToast).toBeVisible()
    const eventRef = (await eventToast.textContent())?.match(/Account (\w+) created/)?.[1]
    if (!eventRef) throw new Error('Could not read the created Events account ref off the toast.')

    await showOnly(page, eventRef)
    await expect(row(page, eventRef)).toBeVisible()
    await expect(row(page, eventRef).getByText('Events', { exact: true })).toBeVisible()

    // --- Edit: open, verify prefill, change a field, save ---
    await showOnly(page, companyRef)
    await row(page, companyRef).getByRole('button', { name: 'Edit' }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: `Edit account — ${companyRef}` })).toBeVisible()
    await expect(dialog.getByLabel('Company name', { exact: true })).toHaveValue(companyName)
    await expect(dialog.getByLabel('Country', { exact: true })).toHaveText('France (FR)')

    // 4 characters, not 5: the legacy's cap was restored on 2026-08-29
    // (`24107ea`) and this spec still carried the old 'E2ECO'.
    await dialog.getByLabel('Acronym', { exact: true }).fill('E2EC')
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(toast(page, `Account ${companyRef} updated.`)).toBeVisible()
    await expect(row(page, companyRef).getByText('(E2EC)')).toBeVisible()

    // --- Deactivate / reactivate ---
    await row(page, companyRef).getByRole('button', { name: 'Deactivate' }).click()
    await expect(toast(page, `Account ${companyRef} deactivated.`)).toBeVisible()
    // Default filters hide inactive accounts — the row disappears entirely.
    await expect(row(page, companyRef)).toHaveCount(0)

    await page.getByLabel('Show deactivated', { exact: true }).check()
    await expect(row(page, companyRef)).toBeVisible()
    await expect(row(page, companyRef)).toHaveClass(/opacity-50/)

    await row(page, companyRef).getByRole('button', { name: 'Reactivate' }).click()
    await expect(toast(page, `Account ${companyRef} reactivated.`)).toBeVisible()
    await expect(row(page, companyRef)).not.toHaveClass(/opacity-50/)
    await page.getByLabel('Show deactivated', { exact: true }).uncheck()
    await expect(row(page, companyRef)).toBeVisible()

    // --- Filters bar: search + type filter, against both fresh and seeded fixtures ---
    const search = page.getByPlaceholder('Search by ref, name, email or acronym…')
    await search.fill(companyRef)
    await expect(row(page, companyRef)).toBeVisible()
    await expect(row(page, eventRef)).toHaveCount(0)
    await search.fill('')

    await search.fill('atlas capital')
    await expect(page.getByRole('row', { name: 'Atlas Capital' })).toBeVisible()
    await expect(row(page, companyRef)).toHaveCount(0)
    await search.fill('')

    await selectFromDropdown(page, 'Type', 'Individual')
    await expect(page.getByRole('row', { name: 'Marc Dubois' })).toBeVisible()
    await expect(row(page, companyRef)).toHaveCount(0)
    await expect(row(page, eventRef)).toHaveCount(0)

    await selectFromDropdown(page, 'Type', 'All types')
    await showOnly(page, companyRef)
    await expect(row(page, companyRef)).toBeVisible()
  })

  test('paginates once results exceed one page (PAGE_SIZE=20 in clients-page.tsx)', async ({ page, request }) => {
    const stamp = Date.now()
    const namePrefix = `Pagination Test ${stamp}`
    // The test DB is never truncated between runs (see this file's module
    // comment) — 25 accounts left behind would push every other spec's
    // default (unfiltered, page-1) view further and further off, so these
    // are hard-deleted in `finally` regardless of how the test ends. Safe:
    // fresh accounts with no trips/invoices on file (ClientsService.delete()
    // only blocks that case).
    const createdRefs: string[] = []
    try {
      for (let i = 0; i < 25; i++) {
        const res = await request.post(`${API_BASE_URL}/api/clients`, {
          data: { clientType: 'COMPANY', company: `${namePrefix} ${i}` },
        })
        expect(res.ok()).toBe(true)
        createdRefs.push(((await res.json()) as { ref: string }).ref)
      }

      await page.goto('/clients')
      await page.getByPlaceholder('Search by ref, name, email or acronym…').fill(namePrefix)

      await expect(page.getByText('1–20 of 25')).toBeVisible()
      await expect(page.getByText('Page 1 of 2')).toBeVisible()
      const previousButton = page.getByRole('button', { name: 'Previous' })
      const nextButton = page.getByRole('button', { name: 'Next' })
      await expect(previousButton).toBeDisabled()
      await expect(nextButton).toBeEnabled()
      const page1FirstRowText = await page.getByRole('row').nth(1).textContent()

      await nextButton.click()
      await expect(page.getByText('21–25 of 25')).toBeVisible()
      await expect(page.getByText('Page 2 of 2')).toBeVisible()
      await expect(nextButton).toBeDisabled()
      await expect(previousButton).toBeEnabled()
      const page2FirstRowText = await page.getByRole('row').nth(1).textContent()
      expect(page2FirstRowText).not.toBe(page1FirstRowText)

      await previousButton.click()
      await expect(page.getByText('Page 1 of 2')).toBeVisible()
      await expect(page.getByRole('row').nth(1)).toHaveText(page1FirstRowText ?? '')
    } finally {
      for (const ref of createdRefs) {
        await request.delete(`${API_BASE_URL}/api/clients/${ref}`)
      }
    }
  })
})
