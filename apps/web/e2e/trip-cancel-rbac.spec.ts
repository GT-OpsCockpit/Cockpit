import { expect, test } from '@playwright/test'
import { API_BASE_URL, dispatcherAuthFile } from './config'

// See docs/agents/permissions.md — trip:cancel is Admin-only, unconditionally,
// on both layers (TripsController.cancelAssignment's @RequirePermission guard,
// and booking-cancel-dialog.tsx's usePermission('trip:cancel') UX mirror).
// Never exercised end-to-end before this spec — the earlier Bookings handoffs
// (sessions 7/8) all ran as Admin only.
test.use({ storageState: dispatcherAuthFile })

test.describe('Trip cancel — RBAC (DISPATCHER)', () => {
  test('the Cancel dialog blocks a DISPATCHER, and the API rejects a direct call too', async ({ page, request }) => {
    // "Marc Dubois" is the individual client seeded by seedFixtures() (apps/api/prisma/seed-data.ts)
    // — matched by email (stable) rather than `ref` (a sequential counter that drifts across
    // accumulated local runs, same caveat as booking-lifecycle.spec.ts's module comment).
    const clientsResponse = await request.get(`${API_BASE_URL}/api/clients`)
    expect(clientsResponse.ok()).toBe(true)
    const clients = (await clientsResponse.json()) as { data: { ref: string; email: string | null }[] }
    const marcDubois = clients.data.find((c) => c.email === 'marc.dubois@example.com')
    if (!marcDubois) throw new Error('Expected the "Marc Dubois" seed client (seedFixtures()) to exist.')

    // Trip creation itself isn't permission-gated (TripsController.create has no
    // @RequirePermission) — a DISPATCHER can create bookings, just not cancel them.
    const passengerName = `RBAC Cancel Test ${Date.now()}`
    const createTripResponse = await request.post(`${API_BASE_URL}/api/trips`, {
      data: {
        countryCode: 'FR',
        pickupAt: '2027-01-15T10:00:00.000Z',
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Hotel Negresco',
        service: 'TSF',
        clientRef: marcDubois.ref,
        passengerName,
      },
    })
    expect(createTripResponse.ok()).toBe(true)
    const trip = (await createTripResponse.json()) as { ref: string }

    await page.goto('/bookings')
    await page.getByPlaceholder('Search by ref., account, passenger or driver…').fill(passengerName)
    const row = page.getByRole('row', { name: passengerName })
    await row.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Cancelling a booking requires the Admin role.')).toBeVisible()
    await expect(page.getByLabel('Cancellation fee')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Cancel booking' })).toBeDisabled()
    // Two "Close" buttons in the DOM here (the dialog's own footer button plus
    // Radix's visually-hidden top-right dismiss button) — either works, `.first()` picks one.
    await page.getByRole('button', { name: 'Close' }).first().click()

    // The frontend disabling the control is UX only — confirm the backend
    // enforces this independently, same guarantee docs/agents/permissions.md promises.
    const directCancelResponse = await request.post(`${API_BASE_URL}/api/trips/${trip.ref}/cancel-assignment`, {
      data: { cancellationFee: 'FREE' },
    })
    expect(directCancelResponse.status()).toBe(403)
  })
})
