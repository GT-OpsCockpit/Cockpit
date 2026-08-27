import { expect, test } from '@playwright/test'
import { API_BASE_URL } from './config'

/**
 * /driver/:ref and /track/:ref (ex-chauffeur.html/dashboard.html) are the
 * only two authenticated-app-free pages in Cockpit v2 — reachable with just
 * a ref, no login. That makes the redacted public projection
 * (PublicTripEntity, see apps/api/src/trips/public-trip.mapper.ts) the whole
 * ballgame: unlike every other trip read in this app, this one must never
 * put price/VAT/the raw client-driver records on the wire. This spec proves
 * both pages work for a genuinely cookie-less visitor (clears the admin
 * session before navigating to either) and that the network response behind
 * each page never carries the redacted fields, not just that the UI doesn't
 * render them.
 */
test.describe('Public driver/track pages', () => {
  test('driver steps through the trip without a session; track mirrors it live via SSE; neither leaks price/PII', async ({
    page,
    context,
    request,
  }) => {
    const clientsResponse = await request.get(`${API_BASE_URL}/api/clients`)
    expect(clientsResponse.ok()).toBe(true)
    const clients = (await clientsResponse.json()) as { data: { ref: string; email: string | null }[] }
    const marcDubois = clients.data.find((c) => c.email === 'marc.dubois@example.com')
    if (!marcDubois) throw new Error('Expected the "Marc Dubois" seed client (seedFixtures()) to exist.')

    const driversResponse = await request.get(`${API_BASE_URL}/api/drivers?search=Julien`)
    expect(driversResponse.ok()).toBe(true)
    const drivers = (await driversResponse.json()) as { data: { ref: string; firstName: string | null }[] }
    const julien = drivers.data.find((d) => d.firstName === 'Julien')
    if (!julien) throw new Error('Expected the "Julien Petit" seed driver (seedFixtures()) to exist.')

    const stamp = Date.now()
    const created = await request.post(`${API_BASE_URL}/api/trips`, {
      data: {
        countryCode: 'FR',
        pickupAt: '2027-03-01T14:30:00.000Z',
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Cannes',
        service: 'TSF',
        clientRef: marcDubois.ref,
        driverRef: julien.ref,
        passengerName: `Public Page E2E ${stamp}`,
        pocName: 'Sophie Durand',
        pocPhone: '+33611112222',
        instructions: 'Meet at Terminal 2 arrivals',
        priceEur: 275,
        partnerRateEur: 120,
      },
    })
    expect(created.ok()).toBe(true)
    const { ref } = (await created.json()) as { ref: string }

    // The whole point of these two pages: a visitor with no session cookie
    // at all must still be able to use them.
    await context.clearCookies()

    // --- /driver/:ref ---
    // Matched on res.ok(): DriverPage overrides the app-wide retry: false
    // (see driver-page.tsx) for exactly this kind of transient hiccup, so
    // capture the response the page itself ends up rendering from, not
    // necessarily the very first one.
    const [driverViewResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/api/trips/${ref}?viewer=driver`) && res.ok()),
      page.goto(`/driver/${ref}`),
    ])
    const driverViewBody = (await driverViewResponse.json()) as Record<string, unknown>
    expect(driverViewBody.priceEur).toBeUndefined()
    expect(driverViewBody.partnerRateEur).toBeUndefined()
    expect(driverViewBody.client).toBeUndefined()
    expect(driverViewBody.driver).toBeUndefined()
    // pocPhone is stored digits-only (normalizePhone strips the '+') — see
    // apps/api/src/common/utils/normalize-phone.ts.
    expect(driverViewBody.pocPhone).toBe('33611112222')
    expect(driverViewBody.instructions).toBe('Meet at Terminal 2 arrivals')

    await expect(page.getByRole('heading', { name: 'Hello Julien Petit' })).toBeVisible()
    await expect(page.getByText('Sent to driver')).toBeVisible()
    await expect(page.getByText('Received by driver')).toBeVisible()

    for (const label of ['Accepted by driver', 'On the way', 'In position'] as const) {
      await page.getByRole('button', { name: `Notify — ${label}` }).click()
      await expect(page.getByRole('button', { name: `Resend — ${label}` })).toBeVisible()
    }

    // --- /track/:ref, opened in a second, equally cookie-less tab ---
    const trackPage = await context.newPage()
    const [trackViewResponse] = await Promise.all([
      trackPage.waitForResponse(
        (res) => res.url().includes(`/api/trips/${ref}`) && !res.url().includes('viewer') && res.ok(),
      ),
      trackPage.goto(`/track/${ref}`),
    ])
    const trackViewBody = (await trackViewResponse.json()) as Record<string, unknown>
    expect(trackViewBody.priceEur).toBeUndefined()
    expect(trackViewBody.pocPhone).toBeNull()
    expect(trackViewBody.instructions).toBeNull()

    await expect(trackPage.getByText(`Public Page E2E ${stamp}`)).toBeVisible()
    await expect(trackPage.getByText('Trip accepted')).toBeVisible()
    await expect(trackPage.getByText('In position').first()).toBeVisible()

    // --- live update: advance from the driver tab, confirm the track tab
    //     picks it up on its own (SSE), no reload ---
    await page.getByRole('button', { name: 'Notify — Passenger on board' }).click()
    await expect(page.getByRole('button', { name: 'Resend — Passenger on board' })).toBeVisible()
    await expect(trackPage.getByText('Passenger picked up')).toBeVisible()

    // --- unknown ref: both pages show a not-found state, not a crash ---
    await page.goto('/driver/NOT-A-REAL-REF')
    await expect(page.getByText('Trip not found for ref NOT-A-REAL-REF.')).toBeVisible()
  })
})
