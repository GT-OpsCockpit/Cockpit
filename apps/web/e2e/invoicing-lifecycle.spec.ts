import { expect, test, type Locator, type Page } from '@playwright/test'
import { fillArea } from './helpers'

/**
 * Covers the /invoicing Customer tab (docs/handoff/2026-08-27-frontend-invoicing.md):
 * search a pending trip, turn it into an invoice, then exercise every action
 * on the resulting Invoiced row (PDF/Excel downloads, Send, Correct stub).
 * Also smoke-tests the other three tabs (Partner log renders, Driver
 * log/History are still the intentional placeholders).
 *
 * Runs against `cockpit_test` (see playwright.config.ts), not truncated
 * between runs — creates its own client (scoped by `Date.now()`) rather than
 * reusing a seed fixture, so the Pending/Invoiced counts asserted below are
 * never polluted by another spec's leftover trips for the same client.
 */

function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

async function selectSearchCombobox(page: Page, label: string, query: string, optionText: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByPlaceholder(`Search ${label.toLowerCase()}…`).fill(query)
  await page.getByRole('option', { name: optionText }).click()
}

/**
 * Same, scoped to a dialog. The Events page carries filters of its own with the
 * same labels (Country), so a page-wide lookup would match those too — the
 * popover the trigger opens is portalled to the body, hence page-scoped.
 */
async function selectInDialog(page: Page, scope: Locator, label: string, query: string, optionText: string) {
  await scope.getByLabel(label, { exact: true }).click()
  await page.getByPlaceholder(`Search ${label.toLowerCase()}…`).fill(query)
  await page.getByRole('option', { name: optionText }).click()
}

async function selectFromDropdown(page: Page, name: string, optionText: string) {
  await page.getByRole('combobox', { name }).click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

test.describe('Invoicing — Customer tab lifecycle', () => {
  test('search a pending trip, invoice it, then exercise PDF/Excel/Send/Correct', async ({ page }) => {
    const stamp = Date.now()
    const clientName = `E2E Invoicing ${stamp}`

    // --- Fresh client, so the counts asserted below can't be polluted by another run ---
    await page.goto('/clients')
    await page.getByRole('button', { name: 'New account' }).click()
    const clientDialog = page.getByRole('dialog')
    await clientDialog.getByLabel('First name', { exact: true }).fill('E2E')
    await clientDialog.getByLabel('Last name', { exact: true }).fill(`Invoicing ${stamp}`)
    await clientDialog.getByRole('button', { name: 'Create' }).click()
    await expect(toast(page, /^Account \w+ created\.$/)).toBeVisible()

    // --- A plain booking (no dispatch needed) for that client, with a price to invoice ---
    await page.goto('/bookings')
    // Since the UI refresh the creation bar is a dialog (BookingCreateDialog),
    // so the form only exists while it is open.
    await page.getByRole('button', { name: 'New booking' }).click()
    const form = page.getByRole('dialog', { name: 'New booking' })
    await selectSearchCombobox(page, 'Country', 'Fra', 'France (FR)')
    // Choosing a Country clears the Area (resetAreaField, common.js:871), so it
    // is always filled after the Country, never before.
    await fillArea(page, form, 'Nice')
    await form.locator('input[type="date"]').fill('2026-09-25')
    await form.locator('input[type="time"]').fill('14:30')
    await selectFromDropdown(page, 'Vehicle', 'Business')
    await selectSearchCombobox(page, 'Customer', clientName, clientName)
    await form.getByLabel('Pax Name').fill('E2E Invoicing Passenger')
    await form.getByLabel('PU', { exact: true }).fill('Nice Airport')
    await form.getByLabel('DO', { exact: true }).fill('Cannes')
    await form.getByLabel('POC Mobile').fill('+33612345678')
    await form.getByLabel('Retail net').fill('100')

    await form.getByRole('button', { name: 'Create', exact: true }).click()
    const createdToast = toast(page, /^Trip (R-[\w-]+) created \(account \w+\)\.$/)
    await expect(createdToast).toBeVisible()
    const tripRef = (await createdToast.textContent())?.match(/Trip (R-[\w-]+) created/)?.[1]
    if (!tripRef) throw new Error('Could not read the created trip ref off the toast.')

    // --- Invoicing: select the fresh client, widen dates to cover any pickup date ---
    await page.goto('/invoicing')
    await selectSearchCombobox(page, 'Client', clientName, clientName)
    await page.getByLabel('Date in', { exact: true }).fill('2000-01-01')
    await page.getByLabel('Date out', { exact: true }).fill('2099-12-31')

    await expect(page.getByText('1 trip(s) matching.')).toBeVisible()
    const pendingRow = page.getByRole('row').filter({ hasText: tripRef })
    await expect(pendingRow).toBeVisible()
    await expect(pendingRow.getByText('100.00 €')).toBeVisible()

    // --- Pending export downloads a real file (Pending's button is the first
    // of the two "Export to Excel" buttons on the page, Invoiced's the second) ---
    const pendingExportPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export to Excel' }).first().click()
    const pendingExport = await pendingExportPromise
    expect(pendingExport.suggestedFilename()).toMatch(/^Invoicing_Customer_Pending_.*\.xlsx$/)

    // --- Invoice creation ---
    const invoiceButton = page.getByRole('button', { name: 'Invoice', exact: true })
    await expect(invoiceButton).toBeEnabled()
    await invoiceButton.click()
    await expect(
      page.getByRole('alertdialog', { name: 'Are you sure you want to invoice these rides?' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Yes' }).click()

    const invoiceToast = toast(page, /^Invoice (INV\d+) created\.$/)
    await expect(invoiceToast).toBeVisible()
    const invoiceRef = (await invoiceToast.textContent())?.match(/Invoice (INV\d+) created/)?.[1]
    if (!invoiceRef) throw new Error('Could not read the created invoice ref off the toast.')

    // Client + a widened date range are both active filters here, so the empty
    // state is the "filtered to zero" variant, not the generic empty-dataset one.
    await expect(page.getByText('No results for these filters')).toBeVisible()
    await expect(page.getByText('1 invoice(s) matching.')).toBeVisible()
    const invoiceRow = page.getByRole('row').filter({ hasText: clientName })
    await expect(invoiceRow.getByRole('cell', { name: '1', exact: true })).toBeVisible() // booking nbr
    await expect(invoiceRow.getByText('110.00 € TTC')).toBeVisible() // 100 net + 10% VAT
    await expect(invoiceRow.getByText('100.00 € HT')).toBeVisible()

    // --- PDF / Excel downloads on the invoice row ---
    const pdfPromise = page.waitForEvent('download')
    await invoiceRow.getByRole('button', { name: 'Download PDF' }).click()
    const pdf = await pdfPromise
    expect(pdf.suggestedFilename()).toBe(`Invoice_${invoiceRef}.pdf`)

    const excelPromise = page.waitForEvent('download')
    await invoiceRow.getByRole('button', { name: 'Download Excel' }).click()
    const excel = await excelPromise
    expect(excel.suggestedFilename()).toBe(`Invoice_${invoiceRef}.xlsx`)

    // --- Send opens a mailto: draft — no real navigation away from the app ---
    await invoiceRow.getByRole('button', { name: 'Send' }).click()
    await expect(page).toHaveURL(/\/invoicing$/)

    // --- Correct is the same undefined-workflow stub as the legacy (no real backend behind it) ---
    await invoiceRow.getByRole('button', { name: 'Correct' }).click()
    await expect(toast(page, `Invoice ${invoiceRef}: the correction workflow is not defined yet.`)).toBeVisible()

    // --- Invoiced panel's own export ---
    const invoicesExportPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export to Excel' }).last().click()
    const invoicesExport = await invoicesExportPromise
    expect(invoicesExport.suggestedFilename()).toMatch(/^Invoicing_Invoiced_.*\.xlsx$/)

    // --- Other tabs: Partner log renders, Driver log/History are the intentional placeholders ---
    await page.getByRole('tab', { name: 'Partner log' }).click()
    await expect(page.getByRole('heading', { name: 'Partner log' })).toBeVisible()

    await page.getByRole('tab', { name: 'Driver log' }).click()
    await expect(page.getByText('Coming soon.')).toBeVisible()

    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByText('Coming soon.')).toBeVisible()
  })
})

/**
 * An Events booking can only be invoiced from this tab — the Events page has
 * no invoicing action, and the Bookings creation dialog excludes Events
 * accounts from its Customer picker. So this walks the one route there is.
 */
test.describe('Invoicing — Events mode', () => {
  test('invoices an Events booking through the Customer tab', async ({ page }) => {
    const stamp = Date.now()
    const eventName = `E2E Inv Gala ${stamp}`

    // --- An Events account and one priced booking against it ---
    await page.goto('/events')
    await page.getByRole('button', { name: 'New', exact: true }).click()
    const newDialog = page.getByRole('dialog', { name: 'New Events account' })
    await newDialog.getByLabel('Event name', { exact: true }).fill(eventName)
    await newDialog.getByLabel('Event country', { exact: true }).click()
    await page.getByPlaceholder('Search country…').fill('Fra')
    await page.getByRole('option', { name: 'France (FR)' }).click()
    await fillArea(page, newDialog, 'Monte-Carlo', 'Event area')
    await newDialog.getByLabel('Start date', { exact: true }).fill('2027-06-01')
    await newDialog.getByLabel('End date', { exact: true }).fill('2027-06-03')
    await newDialog.getByRole('button', { name: 'Create' }).click()
    await expect(toast(page, /^Event account \w+ created\.$/)).toBeVisible()

    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.getByRole('button', { name: 'New booking' }).click()
    const bookingDialog = page.getByRole('dialog', { name: `New booking — ${eventName}` })
    await selectInDialog(page, bookingDialog, 'Country', 'Fra', 'France (FR)')
    await fillArea(page, bookingDialog, 'Nice')
    await bookingDialog.locator('input[type="date"]').fill('2027-06-01')
    await bookingDialog.locator('input[type="time"]').fill('10:00')
    await selectFromDropdown(page, 'Vehicle', 'Business')
    await bookingDialog.getByLabel('Pax Name').fill(`E2E Inv Event Pax ${stamp}`)
    await bookingDialog.getByLabel('PU', { exact: true }).fill('Nice Airport')
    await bookingDialog.getByLabel('DO', { exact: true }).fill('Hotel Negresco')
    await bookingDialog.getByLabel('POC Mobile').fill('+33612345678')
    await bookingDialog.getByLabel('Retail net').fill('250')
    await bookingDialog.getByRole('button', { name: 'Create', exact: true }).click()

    const createdToast = toast(page, /^Trip (R-[\w-]+) created \(account \w+\)\.$/)
    await expect(createdToast).toBeVisible()
    const tripRef = (await createdToast.textContent())?.match(/Trip (R-[\w-]+) created/)?.[1]
    if (!tripRef) throw new Error('Could not read the created trip ref off the toast.')

    // --- Invoicing, Events mode: the booking has to be listed as pending ---
    await page.goto('/invoicing')
    await page.getByLabel('Events', { exact: true }).check()
    // By role, not by label: the Invoiced table's Event column renders a check
    // icon that also carries aria-label="Event", so a label lookup is ambiguous
    // as soon as one event invoice is already on screen.
    await page.getByRole('combobox', { name: 'Event' }).click()
    await page.getByPlaceholder('Search event…').fill(eventName)
    await page.getByRole('option', { name: eventName }).click()
    await page.getByLabel('Date in', { exact: true }).fill('2000-01-01')
    await page.getByLabel('Date out', { exact: true }).fill('2099-12-31')

    const pendingRow = page.getByRole('row').filter({ hasText: tripRef })
    await expect(pendingRow).toBeVisible()
    await expect(pendingRow.getByText('250.00 €')).toBeVisible()

    // --- and invoiced from there ---
    const invoiceButton = page.getByRole('button', { name: 'Invoice', exact: true })
    await expect(invoiceButton).toBeEnabled()
    await invoiceButton.click()
    await page.getByRole('button', { name: 'Yes' }).click()

    const invoiceToast = toast(page, /^Invoice (INV\d+) created\.$/)
    await expect(invoiceToast).toBeVisible()

    const invoiceRow = page.getByRole('row').filter({ hasText: eventName })
    await expect(invoiceRow.getByText('275.00 € TTC')).toBeVisible() // 250 net + 10% VAT
    await expect(invoiceRow.getByText('250.00 € HT')).toBeVisible()
  })
})
