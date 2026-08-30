import { expect, test } from '@playwright/test'

/**
 * What the New booking dialog says when it refuses to submit.
 *
 * Split out of the feature specs because the defect these cover was not in any
 * one rule: three fields carried a native HTML constraint (`min`/`max`), which
 * the browser checks *before* the submit event. An out-of-range value there
 * aborted the whole submission — so every other field's message vanished too
 * and Create appeared to do nothing at all. The rules themselves are unit
 * covered (trip-form-schema.test.ts, booking-fields.spec.ts); what is covered
 * here is that the dispatcher is actually told.
 */
test.describe('New booking — validation messages', () => {
  test('reports every empty required field rather than silently doing nothing', async ({ page }) => {
    await page.goto('/bookings')
    await page.getByRole('button', { name: 'New booking' }).click()
    const form = page.getByRole('dialog', { name: 'New booking' })

    await form.getByLabel('Pax nb').fill('99')
    await form.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(form.getByText('Country is required.')).toBeVisible()
    await expect(form.getByText('Area is required.')).toBeVisible()
    await expect(form.getByText('Passenger name is required.')).toBeVisible()
    // Out of range itself, and — the actual regression — not swallowing the rest.
    await expect(form.getByText('Pax nb must be between 1 and 50.')).toBeVisible()
  })

  test('warns live when the headcount exceeds the chosen vehicle', async ({ page }) => {
    await page.goto('/bookings')
    await page.getByRole('button', { name: 'New booking' }).click()
    const form = page.getByRole('dialog', { name: 'New booking' })

    await form.getByRole('combobox', { name: 'Vehicle' }).click()
    await page.getByRole('option', { name: 'Business', exact: true }).click()
    await form.getByLabel('Pax nb').fill('5')

    // Same wording the server refuses with (booking-fields.ts:172) and the
    // legacy flagged the Vehicle select with (common.js:1033).
    await expect(form.getByText('Business accepts a maximum of 3 passengers.')).toBeVisible()
  })

  // The rule this asserts is already unit-covered (trip-form-schema.test.ts,
  // "partnerRateEur — required to sub-contract"). What is covered *here* is
  // that the dispatcher is told: PriceField rendered no <FormMessage>, so the
  // form simply refused to submit with nothing on screen explaining why —
  // Create looked broken rather than blocked.
  test('says why it will not create a sub-contracted booking with no partner rate', async ({ page }) => {
    await page.goto('/bookings')
    await page.getByRole('button', { name: 'New booking' }).click()
    const form = page.getByRole('dialog', { name: 'New booking' })

    await form.getByRole('checkbox', { name: 'Sub-contracted' }).click()
    await expect(form.getByLabel('Partner rate net')).toBeVisible()
    await form.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(form.getByText('Partner rate net is required to sub-contract a booking.')).toBeVisible()
  })

  test('says why it will not accept a negative price', async ({ page }) => {
    await page.goto('/bookings')
    await page.getByRole('button', { name: 'New booking' }).click()
    const form = page.getByRole('dialog', { name: 'New booking' })

    await form.getByLabel('Retail net').fill('-5')
    await form.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(form.getByText('A price cannot be negative.')).toBeVisible()
  })
})
