import { expect, test, type Locator, type Page } from '@playwright/test'
import { fillArea } from './helpers'

/**
 * Covers the /events vertical (docs/handoff/2026-08-27-frontend-events.md):
 * create an Events-type client via the page's own "New" flow, confirm it
 * (locking the Customer field), create a plain booking, then Create bulk
 * over a 3-day range and verify the chaining rule from bulk-create.ts (day 1
 * uses the typed PU/DO, middle days stay put at day 1's drop-off, the last
 * day is forced to ASD with no drop-off), plus the Event name filter.
 *
 * Runs against `cockpit_test` (see playwright.config.ts) — not truncated
 * between runs, so this test creates its own Events client and reads back
 * every ref from toasts rather than assuming fixed values.
 */

// `scope` is the trigger's container, not the page: the Events page carries a
// Country filter of its own (event-filters-bar.tsx's aria-label="Country"), so
// a page-wide lookup matches it as well as the dialog's field. The popover it
// opens is portalled to the body, so the search box and the options stay
// page-scoped.
async function selectSearchCombobox(
  page: Page,
  scope: Locator,
  label: string,
  query: string,
  optionText: string,
) {
  await scope.getByLabel(label, { exact: true }).click()
  await page.getByPlaceholder(`Search ${label.toLowerCase()}…`).fill(query)
  await page.getByRole('option', { name: optionText }).click()
}

async function selectFromDropdown(page: Page, name: string, optionText: string) {
  await page.getByRole('combobox', { name }).click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

// Sonner renders each toast twice (visible + aria-live announcer copy) — `.first()` avoids strict-mode.
function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

/** The New booking dialog's form, filled the same way for the single and the bulk run. */
async function fillBookingForm(page: Page, dialog: Locator, passengerName: string) {
  await selectSearchCombobox(page, dialog, 'Country', 'Fra', 'France (FR)')
  // Choosing a Country clears the Area (resetAreaField, common.js:871), so it
  // is always filled after the Country, never before.
  await fillArea(page, dialog, 'Nice')
  await dialog.locator('input[type="date"]').fill('2027-06-01')
  await dialog.locator('input[type="time"]').fill('10:00')
  await selectFromDropdown(page, 'Vehicle', 'Business')
  await dialog.getByLabel('Pax Name').fill(passengerName)
  await dialog.getByLabel('PU', { exact: true }).fill('Nice Airport')
  await dialog.getByLabel('DO', { exact: true }).fill('Hotel Negresco')
  await dialog.getByLabel('POC Mobile').fill('+33612345678')
}

test.describe('Events — select/create event, bulk-create bookings', () => {
  test('creates an Events account, confirms it, creates a booking, then bulk-creates a chained range', async ({
    page,
  }) => {
    const stamp = Date.now()
    const eventName = `E2E Gala ${stamp}`
    await page.goto('/events')

    // --- "New": create a brand-new Events account without leaving the page ---
    await page.getByRole('button', { name: 'New', exact: true }).click()
    const newDialog = page.getByRole('dialog', { name: 'New Events account' })
    await expect(newDialog.getByLabel('Account type', { exact: true })).toHaveText('Events')
    await newDialog.getByLabel('Event name', { exact: true }).fill(eventName)
    await newDialog.getByLabel('Event country', { exact: true }).click()
    await page.getByPlaceholder('Search country…').fill('Fra')
    await page.getByRole('option', { name: 'France (FR)' }).click()
    await fillArea(page, newDialog, 'Monte-Carlo', 'Event area')
    await newDialog.getByLabel('Start date', { exact: true }).fill('2027-06-01')
    await newDialog.getByLabel('End date', { exact: true }).fill('2027-06-03')
    await newDialog.getByRole('button', { name: 'Create' }).click()

    const createdToast = toast(page, /^Event account (\w+) created\.$/)
    await expect(createdToast).toBeVisible()
    const eventRef = (await createdToast.textContent())?.match(/Event account (\w+) created/)?.[1]
    if (!eventRef) throw new Error('Could not read the created event account ref off the toast.')

    // Auto-selected (not auto-confirmed) — mirrors the legacy's "New" flow.
    await expect(page.getByLabel('Client', { exact: true })).toHaveText(eventName)
    await expect(page.getByLabel('Dates', { exact: true })).toHaveValue('2027-06-01 → 2027-06-03')

    // --- Confirm: locks the Customer field in the New booking dialog ---
    await page.getByRole('button', { name: 'Confirm' }).click()

    // Since the UI refresh the creation bar is a dialog (EventCreateDialog),
    // so the booking form only exists while it is open.
    const bookingDialog = page.getByRole('dialog', { name: `New booking — ${eventName}` })
    await page.getByRole('button', { name: 'New booking' }).click()
    const customerField = bookingDialog.getByLabel('Customer', { exact: true })
    await expect(customerField).toBeDisabled()
    await expect(customerField).toHaveText(eventName)

    // --- Plain "Create": a single booking tied to the confirmed event ---
    await fillBookingForm(page, bookingDialog, 'E2E Playwright Passenger')
    await bookingDialog.getByRole('button', { name: 'Create', exact: true }).click()
    const singleToast = toast(page, /^Trip (R-[\w-]+) created \(account \w+\)\.$/)
    await expect(singleToast).toBeVisible()
    const singleRef = (await singleToast.textContent())?.match(/Trip (R-[\w-]+) created/)?.[1]
    if (!singleRef) throw new Error('Could not read the created trip ref off the toast.')
    await expect(page.getByRole('row').filter({ hasText: singleRef })).toBeVisible()

    // --- "Create bulk": reopen the dialog, refill it, then a 3-day chained range ---
    await page.getByRole('button', { name: 'New booking' }).click()
    // The form resets after Create, but the Customer lock survives (re-set from confirmedEvent).
    await expect(customerField).toHaveText(eventName)
    await fillBookingForm(page, bookingDialog, 'E2E Bulk Passenger')

    const bulkButton = bookingDialog.getByRole('button', { name: 'Create bulk' })
    await expect(bulkButton).toBeEnabled()
    await bulkButton.click()

    const bulkDialog = page.getByRole('dialog', { name: `Create bulk — ${eventName}` })
    await expect(bulkDialog.getByLabel('Date start', { exact: true })).toHaveValue('2027-06-01')
    await expect(bulkDialog.getByLabel('Date end', { exact: true })).toHaveValue('2027-06-03')
    await bulkDialog.getByLabel('Booking reference', { exact: true }).fill('PO-E2E-001')
    await bulkDialog.getByRole('button', { name: 'Create bulk' }).click()

    await expect(toast(page, '3 booking(s) created.')).toBeVisible()

    // --- Event name filter: narrow to just this run's trips before asserting on
    // itinerary text — the test DB isn't truncated between runs (see this file's
    // module comment), so unscoped text like "Nice Airport → Hotel Negresco" would
    // also match earlier runs' leftover trips.
    await page.getByPlaceholder('Search event name…').fill(eventName)

    // --- Chaining rule: day 1 as typed, day 2 stays put, last day forced to ASD ---
    await expect(page.getByText('Nice Airport → Hotel Negresco')).toHaveCount(2) // the single trip + bulk day 1
    await expect(page.getByText('Hotel Negresco → Hotel Negresco')).toBeVisible() // bulk day 2
    await expect(page.getByText('Hotel Negresco → ASD (4h)')).toBeVisible() // bulk day 3 (last)

    // One of the bulk legs carries the reference in its Info field — spot-check via the edit dialog.
    const bulkDay2Row = page.getByRole('row').filter({ hasText: 'Hotel Negresco → Hotel Negresco' })
    await bulkDay2Row.getByRole('button', { name: 'Edit' }).click()
    const editDialog = page.getByRole('dialog', { name: /^Edit booking/ })
    await expect(editDialog.getByLabel('Info', { exact: true })).toHaveValue('Ref: PO-E2E-001')
    await editDialog.getByRole('button', { name: 'Cancel', exact: true }).click()

    // --- A non-matching event name filters everything out ---
    await page.getByPlaceholder('Search event name…').fill('definitely not a real event name')
    await expect(page.getByText('No results for these filters')).toBeVisible()
  })
})
