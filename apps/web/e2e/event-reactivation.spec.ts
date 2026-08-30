import { expect, test } from '@playwright/test'
import { API_BASE_URL } from './config'
import { fillArea, fillCountry } from './helpers'

/**
 * offerEventReactivation (common.js:3905-3980), the one feature of the legacy
 * that saves real work rather than a click: a venue often hosts the same event
 * again a year later, and the crew set up for the previous edition is still on
 * file — scoped to it, and therefore dormant. Without this, a returning event
 * means reopening every driver and vehicle of the last edition one by one, the
 * day before it starts.
 *
 * What the candidate query and the linking itself do is covered where it is
 * cheap to cover — clients.e2e-spec.ts — and what the dialog renders is covered
 * in event-reactivation-dialog.test.tsx. What only a browser can answer is
 * whether the dialog is wired to the moment an Events account is created, so
 * that is all this does.
 *
 * Runs against `cockpit_test`, which is never truncated between runs — hence
 * the stamped Area, which keeps this run's dormant crew out of every other
 * run's candidate list.
 */
test.describe('Events — reactivating a dormant crew', () => {
  test('offers the other edition’s dormant driver when an event opens at the same place, and Skip leaves it where it was', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const area = `E2E Reac ${stamp}`

    // --- Another edition at the same place, not running today, with one
    // Events driver scoped to it. Its dates are ahead rather than behind
    // because EventLinkService refuses to link anyone to an event that has
    // already ended — and "dormant" covers both sides of the window anyway
    // (outsideEventWindowFilter, ported from !isWithinEventWindow). ---
    const otherEvent = await request.post(`${API_BASE_URL}/api/clients`, {
      data: {
        clientType: 'EVENT',
        company: `E2E Other Gala ${stamp}`,
        eventCountry: 'FR',
        eventArea: area,
        eventStartDate: '2028-01-01',
        eventEndDate: '2028-01-05',
      },
    })
    expect(otherEvent.ok()).toBe(true)
    const otherRef = ((await otherEvent.json()) as { ref: string }).ref

    const driverName = `E2E Dormant ${stamp}`
    const driver = await request.post(`${API_BASE_URL}/api/drivers`, {
      data: {
        countryCode: 'FR',
        area,
        firstName: 'E2E',
        lastName: `Dormant ${stamp}`,
        phone: `+3365${String(stamp).slice(-7)}`,
        company: `E2E Crew ${stamp}`,
        email: `dormant${stamp}@example.test`,
        eventsOnly: true,
        eventCountry: 'FR',
        eventArea: area,
        eventRef: otherRef,
      },
    })
    if (!driver.ok()) throw new Error(`Driver creation failed: ${driver.status()} ${await driver.text()}`)
    const driverRef = ((await driver.json()) as { ref: string }).ref

    // --- A new edition at that same place, created through the page itself ---
    await page.goto('/events')
    await page.getByRole('button', { name: 'New', exact: true }).click()
    const newDialog = page.getByRole('dialog', { name: 'New Events account' })
    await newDialog.getByLabel('Event name', { exact: true }).fill(`E2E Return Gala ${stamp}`)
    await fillCountry(page, newDialog, 'France', 'FR', 'Event country')
    await fillArea(page, newDialog, area, 'Event area')
    await newDialog.getByLabel('Start date', { exact: true }).fill('2027-09-01')
    await newDialog.getByLabel('End date', { exact: true }).fill('2027-09-05')
    await newDialog.getByRole('button', { name: 'Create' }).click()

    const reactivation = page.getByRole('dialog', { name: 'Reactivate existing Events drivers/vehicles?' })
    await expect(reactivation).toBeVisible()
    await expect(reactivation.getByText(driverName)).toBeVisible()

    // --- Skip does nothing at all: the driver stays on the other event ---
    await reactivation.getByRole('button', { name: 'Skip' }).click()
    await expect(reactivation).toBeHidden()

    // No GET /drivers/:ref — the list, narrowed to this one ref, is how every
    // other spec reads a driver back.
    const after = await request.get(`${API_BASE_URL}/api/drivers?search=${encodeURIComponent(driverRef)}`)
    expect(after.ok()).toBe(true)
    const [reread] = ((await after.json()) as { data: { ref: string; eventClient: { ref: string } }[] }).data
    expect(reread.ref).toBe(driverRef)
    expect(reread.eventClient.ref).toBe(otherRef)
  })
})
