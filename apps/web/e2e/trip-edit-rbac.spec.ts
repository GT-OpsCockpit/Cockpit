import { expect, test } from '@playwright/test'
import { API_BASE_URL, dispatcherAuthFile } from './config'

// See docs/agents/permissions.md and booking-edit-dialog.tsx: trip:edit-price
// (Admin-only) locks just the price fields; trip:edit-past (also Admin-only)
// additionally locks the whole form once the trip's pickup is in the past.
// Never exercised end-to-end before this spec.
test.use({ storageState: dispatcherAuthFile })

test.describe('Trip edit — RBAC (DISPATCHER)', () => {
  test('price is locked on a future trip; the whole form is locked on a past trip', async ({ page, request }) => {
    // "Marc Dubois" is the individual client seeded by seedFixtures() (apps/api/prisma/seed-data.ts)
    // — matched by email (stable), same reasoning as trip-cancel-rbac.spec.ts.
    // Searched, not scanned: /api/clients pages at DEFAULT_LIMIT and orders by
    // ref, so an unfiltered call only ever returns the first page — and
    // cockpit_test is never truncated between runs (playwright.config.ts), so
    // the seed client drops off that page as soon as enough accounts pile up.
    // `email` is one of the searched columns (ClientsService.list).
    const clientsResponse = await request.get(
      `${API_BASE_URL}/api/clients?search=marc.dubois@example.com`,
    )
    expect(clientsResponse.ok()).toBe(true)
    const clients = (await clientsResponse.json()) as { data: { ref: string; email: string | null }[] }
    const marcDubois = clients.data.find((c) => c.email === 'marc.dubois@example.com')
    if (!marcDubois) throw new Error('Expected the "Marc Dubois" seed client (seedFixtures()) to exist.')

    async function createTrip(pickupAt: string, passengerName: string) {
      const res = await request.post(`${API_BASE_URL}/api/trips`, {
        data: {
          countryCode: 'FR',
          pickupAt,
          pickupLocation: 'Nice Airport',
          dropoffLocation: 'Hotel Negresco',
          service: 'TSF',
          clientRef: marcDubois.ref,
          passengerName,
        },
      })
      expect(res.ok()).toBe(true)
    }

    const stamp = Date.now()
    const futurePassenger = `RBAC Edit Future ${stamp}`
    const pastPassenger = `RBAC Edit Past ${stamp}`
    await createTrip('2027-01-15T10:00:00.000Z', futurePassenger)
    await createTrip('2020-01-15T10:00:00.000Z', pastPassenger)

    await page.goto('/bookings')

    // Reveal past trips too — default period filter is "Upcoming", which would
    // hide the past fixture entirely. The filter bar's period <Select> has no
    // <FormLabel> (unlike the create-bar's fields), so no accessible name to
    // target — matched by its rendered text instead.
    await page.getByRole('combobox').filter({ hasText: 'Upcoming' }).click()
    await page.getByRole('option', { name: 'All' }).click()

    const search = page.getByPlaceholder('Search by ref., account, passenger or driver…')

    // Future trip: price is Admin-only, everything else stays editable.
    await search.fill(futurePassenger)
    await page.getByRole('row', { name: futurePassenger }).getByRole('button', { name: 'Edit' }).click()
    const futureDialog = page.getByRole('dialog')
    await expect(futureDialog.getByText('Changing the Retail net / Partner rate net requires the Admin role.')).toBeVisible()
    await expect(futureDialog.getByLabel('Retail net')).toBeDisabled()
    await expect(futureDialog.getByLabel('Pax Name')).toBeEnabled()
    await expect(futureDialog.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled()
    await futureDialog.getByRole('button', { name: 'Cancel' }).click()

    // Past trip: the past-pickup lockout additionally disables the entire form.
    await search.fill(pastPassenger)
    await page.getByRole('row', { name: pastPassenger }).getByRole('button', { name: 'Edit' }).click()
    const pastDialog = page.getByRole('dialog')
    await expect(
      pastDialog.getByText("This booking's pickup is already in the past — only an Admin can edit it."),
    ).toBeVisible()
    await expect(pastDialog.getByLabel('Pax Name')).toBeDisabled()
    await expect(pastDialog.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled()
  })
})
