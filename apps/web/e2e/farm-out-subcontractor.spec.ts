import { expect, test } from '@playwright/test'
import { API_BASE_URL } from './config'

// Farm-out / sub-contractor path — never exercised end-to-end before (the
// main booking-lifecycle spec only covers a Local job with an own driver).
// Backed by trip-status.test.ts's isStatusLocked/isStatusAdvanceable unit
// coverage (session 9); this proves the same rule end to end: TripsService
// wires it identically on create (locks + auto-stamps TRANSMITTED when
// sub-contracted with no partner on file yet) and on advanceStep (rejects
// with a 400 while locked) — see trips.service.ts.
test.describe('Farm-out sub-contractor', () => {
  test('pinned at Sent with no partner; dispatches and advances normally once one is assigned', async ({
    page,
    request,
  }) => {
    const clientsResponse = await request.get(`${API_BASE_URL}/api/clients`)
    expect(clientsResponse.ok()).toBe(true)
    const clients = (await clientsResponse.json()) as { data: { ref: string; email: string | null }[] }
    const marcDubois = clients.data.find((c) => c.email === 'marc.dubois@example.com')
    if (!marcDubois) throw new Error('Expected the "Marc Dubois" seed client (seedFixtures()) to exist.')

    const driversResponse = await request.get(`${API_BASE_URL}/api/drivers?search=uberelite`)
    expect(driversResponse.ok()).toBe(true)
    const drivers = (await driversResponse.json()) as { data: { ref: string; email: string | null }[] }
    const uberElite = drivers.data.find((d) => d.email === 'james.whitfield@uberelite.example')
    if (!uberElite) throw new Error('Expected the "James Whitfield / Uber Elite London" seed driver (seedFixtures()) to exist.')

    const stamp = Date.now()
    const unassignedPassenger = `Farm-out No Partner ${stamp}`
    const assignedPassenger = `Farm-out With Partner ${stamp}`

    async function createTrip(passengerName: string, partnerRef?: string) {
      const res = await request.post(`${API_BASE_URL}/api/trips`, {
        data: {
          countryCode: 'GB',
          pickupAt: '2027-02-01T09:00:00.000Z',
          pickupLocation: 'Heathrow Airport',
          dropoffLocation: 'The Ritz London',
          service: 'TSF',
          clientRef: marcDubois.ref,
          passengerName,
          subContractor: true,
          ...(partnerRef ? { partnerRef } : {}),
        },
      })
      expect(res.ok()).toBe(true)
      return (await res.json()) as { ref: string }
    }

    const unassignedTrip = await createTrip(unassignedPassenger)
    const assignedTrip = await createTrip(assignedPassenger, uberElite.ref)

    await page.goto('/bookings')

    // --- Sub-contracted with no partner on file: pinned at Sent, badge not clickable ---
    const unassignedRow = page.getByRole('row').filter({ hasText: unassignedTrip.ref })
    await expect(unassignedRow.getByText('📤 Sent ✅')).toBeVisible()
    await expect(unassignedRow.getByTitle('Click to validate the next step')).toHaveCount(0)

    const directAdvance = await request.post(`${API_BASE_URL}/api/trips/${unassignedTrip.ref}/advance-step`)
    expect(directAdvance.status()).toBe(400)
    expect(await directAdvance.text()).toContain('sub-contracted to a company with no driver on file')

    // --- Sub-contracted with a partner: dispatches and advances like a normal job ---
    const assignedRow = page.getByRole('row').filter({ hasText: assignedTrip.ref })
    await expect(assignedRow.getByText('📤 Send ?')).toBeVisible()

    await assignedRow.getByTitle('Dispatch to the driver').click()
    await page.getByRole('alertdialog', { name: 'Dispatch to the driver?' }).getByRole('button', { name: 'Yes' }).click()
    await expect(page.getByText(`Trip ${assignedTrip.ref} dispatched to the driver.`).first()).toBeVisible()

    await expect(assignedRow.getByText('📤 Sent ✅')).toBeVisible()
    const advanceButton = assignedRow.getByTitle('Click to validate the next step')
    await expect(advanceButton).toBeVisible()
    await advanceButton.click()
    await page.getByRole('alertdialog', { name: 'Valid step?' }).getByRole('button', { name: 'Valid step' }).click()
    await expect(page.getByText(`Trip ${assignedTrip.ref} moved to the next step.`).first()).toBeVisible()
    await expect(assignedRow.getByText('📥 Received')).toBeVisible()
  })
})
