import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * Transcribes the manual browser walkthrough from
 * docs/handoff/2026-08-27-frontend-bookings-6.md: create & dispatch a trip,
 * advance it through every status step to Done, upload a nameboard, then
 * cancel it. Runs against `cockpit_test` (see playwright.config.ts) so the
 * fixtures below (Marc Dubois / CI1, driver Julien Petit, vehicle AA-001-BC)
 * come from apps/api/prisma/seed-data.ts's seedFixtures(), not hand-picked
 * dev data — but note `test:e2e:prepare` only ensures those baseline
 * fixtures exist (idempotently), it does NOT truncate the database, so trips
 * created by previous runs accumulate rather than reset. The test doesn't
 * assume a specific ref for that reason — it reads back whatever ref the
 * create toast reports and uses that throughout.
 */

const ADVANCE_STEP_COUNT = 6 // Sent -> Received -> Confirmed -> OTW -> IP -> POB -> Done

// Country/Customer/Driver use a custom SearchCombobox (Popover + Command). Its trigger's
// accessible name now comes from the associated <FormLabel> (search-combobox.tsx forwards
// FormControl's id/aria-* the same way shadcn's <SelectTrigger> already did — see
// docs/handoff/2026-08-27-frontend-bookings-10.md), so a plain accessible-name lookup works
// here now, same as selectFromDropdown below.
// `optionText` is matched as a substring (not exact) on purpose: client/driver option labels
// are "Name (REF)", and REF is a sequential counter that isn't necessarily "1" — e.g. after
// prior local runs against the same DB (see the module comment above) — so matching just the
// name keeps this from being coupled to a specific ref.
async function selectSearchCombobox(page: Page, label: string, query: string, optionText: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByPlaceholder(`Search ${label.toLowerCase()}…`).fill(query)
  await page.getByRole('option', { name: optionText }).click()
}

// Service/Vehicle/Payment/Reg Nbr use shadcn's <Select>, which *is* properly
// wired to its FormLabel (FormControl forwards the id) — a plain accessible
// name lookup works.
async function selectFromDropdown(page: Page, name: string, optionText: string) {
  await page.getByRole('combobox', { name }).click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

// Sonner renders each toast twice (the visible one plus a visually-hidden
// copy for its aria-live announcer region) — getByText alone hits Playwright
// strict mode. `.first()` is fine, both nodes carry identical text.
function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

test.describe('Booking lifecycle', () => {
  test('create & dispatch, advance every status to Done, upload a nameboard, then cancel', async ({ page }) => {
    await page.goto('/bookings')

    const form = page.locator('form').first()

    await selectSearchCombobox(page, 'Country', 'Fra', 'France (FR)')
    await form.locator('input[type="date"]').fill('2026-09-25')
    await form.locator('input[type="time"]').fill('14:30')
    await selectFromDropdown(page, 'Vehicle', 'Business')
    await selectSearchCombobox(page, 'Customer', 'Marc', 'Marc Dubois')
    await page.getByLabel('Pax Name').fill('E2E Playwright Passenger')
    await page.getByLabel('PU', { exact: true }).fill('Nice Airport')
    await page.getByLabel('DO', { exact: true }).fill('Hotel Negresco')
    await page.getByLabel('POC Name').fill('Sophie Durand')
    await page.getByLabel('POC Mobile').fill('+33612345678')
    await selectSearchCombobox(page, 'Driver', 'Julien', 'Julien Petit')
    await selectFromDropdown(page, 'Reg Nbr', 'AA-001-BC — Business')
    await page.getByLabel('Retail net').fill('150')

    const createAndDispatch = page.getByRole('button', { name: 'Create & Dispatch' })
    await expect(createAndDispatch).toBeEnabled()
    await createAndDispatch.click()

    const createdToast = toast(page, /^Trip (R-[\w-]+) created and dispatched\.$/)
    await expect(createdToast).toBeVisible()
    const ref = (await createdToast.textContent())?.match(/Trip (R-[\w-]+) created/)?.[1]
    if (!ref) throw new Error('Could not read the created trip ref off the toast.')

    const row = page.getByRole('row').filter({ hasText: ref })
    await expect(row).toBeVisible()
    await expect(row.getByText('Julien P.')).toBeVisible()

    // --- Advance through every status step to Done ---
    const advanceButton = row.getByTitle('Click to validate the next step')
    for (let i = 0; i < ADVANCE_STEP_COUNT; i++) {
      await advanceButton.click()
      await page.getByRole('alertdialog', { name: 'Valid step?' }).getByRole('button', { name: 'Valid step' }).click()
      await expect(toast(page, `Trip ${ref} moved to the next step.`)).toBeVisible()
    }
    await expect(row.getByText('Done', { exact: true })).toBeVisible()

    // --- Upload a nameboard ---
    await row.getByRole('button', { name: 'Upload nameboard' }).click()
    const nameboardDialog = page.getByRole('dialog', { name: `Upload nameboard — ${ref}` })
    await nameboardDialog
      .getByLabel('File (image or PDF, 10MB max)')
      .setInputFiles(path.join(import.meta.dirname, 'fixtures', 'nameboard-test.png'))
    await nameboardDialog.getByRole('button', { name: 'Upload' }).click()
    await expect(toast(page, `Nameboard uploaded for trip ${ref}.`)).toBeVisible()
    await expect(row.getByRole('button', { name: 'View / replace nameboard' })).toBeVisible()

    // --- Cancel it with a 50% fee ---
    // The dialog's own default is Free, which the backend treats as "never
    // really happened" and hard-deletes the trip outright (cancelAssignment,
    // `result.deleted` — a check purely on the fee, unrelated to how far the
    // trip got dispatched/advanced). Picking a paying fee here instead
    // exercises the *other* branch: the assignment is cleared but the trip
    // record — and its whole advance-step history above — is kept, badge
    // flips to Stop. That's the more interesting path to cover given
    // everything this test already built up.
    await row.getByRole('button', { name: 'Cancel' }).click()
    const cancelDialog = page.getByRole('dialog', { name: `Cancel booking — ${ref}` })
    await cancelDialog.getByRole('combobox', { name: 'Cancellation fee' }).click()
    await page.getByRole('option', { name: '50%', exact: true }).click()
    await expect(cancelDialog.getByRole('button', { name: 'Cancel booking' })).toBeEnabled()
    await cancelDialog.getByRole('button', { name: 'Cancel booking' }).click()

    await expect(toast(page, `Trip ${ref} cancelled (50% fee) — assignment cleared.`)).toBeVisible()
    await expect(row.getByText('Stop', { exact: true })).toBeVisible()
  })
})
