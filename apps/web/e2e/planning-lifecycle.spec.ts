import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { API_BASE_URL } from './config'

/**
 * Covers the /planning vertical end-to-end: the List/Timeline toggle, the
 * Drivers/Vehicles resource toggle, and — the riskiest part to port from the
 * legacy's hand-rolled Gantt (common.js's renderTimeline) — native HTML5
 * drag&drop: pile→row assigns a trip, block→pile unassigns it, and a
 * category-incompatible vehicle drop is rejected client-side before ever
 * reaching the API (canDrop/incompatibleMessage, mirroring the legacy).
 *
 * Runs against `cockpit_test` (see playwright.config.ts) and its seeded
 * fixtures (apps/api/prisma/seed-data.ts): client Marc Dubois/CI1, drivers
 * Karim Haddad/Julien Petit, fleet vehicles AA-001-BC (Business) and
 * AA-002-BC (Van) — same fixtures booking-lifecycle.spec.ts relies on. Every
 * trip used here is created fresh by the spec itself (stamped passenger
 * names) inside a try/finally, so a mid-test assertion failure still frees it
 * — the seed is a non-truncating replay (see that spec's module comment), so
 * an orphaned trip would otherwise sit in the shared "tomorrow" pile forever
 * and inflate every later run's unassigned count. Assertions target each
 * test's own trip by ref rather than assuming the pile is otherwise empty,
 * for the same reason.
 */

interface TripBody {
  ref: string
  driverId: string | null
  fleetVehicleId: string | null
}

interface DriverBody {
  id: string
  ref: string
  firstName: string
}

function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

/**
 * Reads a trip's assignment state back from the API.
 *
 * Deliberately NOT `GET /api/trips/:ref` — that route is @Public() and returns
 * a PublicTripEntity, which carries neither driverId nor fleetVehicleId (it's
 * reachable from the driver/track links without a session, so it exposes only
 * what those pages need). Asserting on those fields there yields `undefined`,
 * which makes `.toBeNull()` fail and — worse — makes `.not.toBeNull()` pass
 * while checking nothing. The authenticated list route returns full TripEntity
 * rows, so assignment state is read from there instead.
 */
async function fetchAssignmentState(request: APIRequestContext, ref: string): Promise<TripBody> {
  const res = await request.get(`${API_BASE_URL}/api/trips?period=all`)
  expect(res.ok()).toBe(true)
  const trip = ((await res.json()) as TripBody[]).find((t) => t.ref === ref)
  expect(trip, `trip ${ref} missing from GET /api/trips`).toBeDefined()
  return trip!
}

/**
 * `locator.dragTo()` simulates a real mouse gesture (move + down + up), which
 * is timing-sensitive and was flaky against this Gantt's native HTML5 DnD
 * (draggable + DataTransfer, common.js's own approach — see
 * planning-timeline.tsx). Dispatching the drag events directly with a shared
 * DataTransfer handle is Playwright's documented workaround for exactly this
 * case and is deterministic — no mouse movement/timing involved.
 */
async function htmlDragAndDrop(page: Page, source: Locator, target: Locator) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await source.dispatchEvent('dragstart', { dataTransfer })
  await target.dispatchEvent('dragenter', { dataTransfer })
  await target.dispatchEvent('dragover', { dataTransfer })
  await target.dispatchEvent('drop', { dataTransfer })
  await source.dispatchEvent('dragend', { dataTransfer })
}

/**
 * A successful drop fires PATCH /assign fully asynchronously (onDrop calls
 * `void runAssign(...)`, never awaited by the caller — see planning-page.tsx)
 * — checking the result via a direct API call right after the drag races the
 * mutation. Waiting for that response is what booking-lifecycle.spec.ts's
 * toast-visibility waits achieve for other mutations; there's no toast on a
 * successful (re)assign here, so wait on the network call itself instead. Only
 * for a drop expected to actually reach the API — a client-side-rejected
 * (incompatible category) drop never sends this request.
 */
async function dragAndWaitForAssign(page: Page, source: Locator, target: Locator) {
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/assign') && res.request().method() === 'PATCH'),
    htmlDragAndDrop(page, source, target),
  ])
  expect(response.ok()).toBe(true)
}

// Tomorrow at a fixed hour — always "upcoming" regardless of when the suite
// runs, and never crosses into the day after (avoids any midnight-boundary
// flakiness in the Timeline's own date math).
function tomorrowIso(hourUtc: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(hourUtc, 0, 0, 0)
  return d.toISOString()
}

function tomorrowDateStr(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

test.describe('Planning — lifecycle (ADMIN)', () => {
  test('Timeline (Drivers): drag assigns, the availability icon opens the existing dialog, drag-back unassigns', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const driversRes = await request.get(`${API_BASE_URL}/api/drivers?search=Julien`)
    expect(driversRes.ok()).toBe(true)
    const julien = ((await driversRes.json()) as { data: DriverBody[] }).data[0]

    const tripRes = await request.post(`${API_BASE_URL}/api/trips`, {
      data: {
        countryCode: 'FR',
        pickupAt: tomorrowIso(14),
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Cannes',
        service: 'TSF',
        passengerName: `E2E Planning DnD ${stamp}`,
        clientRef: 'CI1',
        vehicleType: 'Business',
      },
    })
    expect(tripRes.ok()).toBe(true)
    const trip = (await tripRes.json()) as TripBody

    try {
      await page.goto('/planning')
      await page.getByRole('tab', { name: 'Timeline' }).click()
      await page.getByLabel('Date', { exact: true }).fill(tomorrowDateStr())

      const card = page.locator(`[data-ref="${trip.ref}"]`)
      await expect(card).toBeVisible()

      const julienRow = page.locator(`[data-row-key="${julien.ref}"]`)
      await dragAndWaitForAssign(page, card, julienRow)
      // Still the same DOM query — now resolves to the assigned block instead
      // of the pile card, since a trip is never both at once.
      await expect(card).toBeVisible()

      expect((await fetchAssignmentState(request, trip.ref)).driverId).toBe(julien.id)

      // --- The day-off icon reuses the exact same dialog the /drivers vertical built. ---
      await julienRow.locator('..').getByTitle('Day off / Holidays / Sickness leave').click()
      await expect(page.getByRole('dialog', { name: `Unavailability — ${julien.ref}` })).toBeVisible()
      await page.keyboard.press('Escape')

      // --- Drag the block back onto the pile to unassign. ---
      const pile = page.locator('[data-drop-zone="unassigned-pile"]')
      await dragAndWaitForAssign(page, card, pile)
      await expect(card).toBeVisible()

      expect((await fetchAssignmentState(request, trip.ref)).driverId).toBeNull()
    } finally {
      await request.post(`${API_BASE_URL}/api/trips/${trip.ref}/cancel-assignment`, { data: { cancellationFee: 'FREE' } })
    }
  })

  test('Timeline (Vehicles): an incompatible category is rejected client-side, a compatible one assigns', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const tripRes = await request.post(`${API_BASE_URL}/api/trips`, {
      data: {
        countryCode: 'FR',
        pickupAt: tomorrowIso(16),
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Monaco',
        service: 'TSF',
        passengerName: `E2E Planning Vehicle ${stamp}`,
        clientRef: 'CI1',
        vehicleType: 'Business',
      },
    })
    expect(tripRes.ok()).toBe(true)
    const trip = (await tripRes.json()) as TripBody

    try {
      await page.goto('/planning')
      await page.getByRole('tab', { name: 'Vehicles' }).click()
      await page.getByRole('tab', { name: 'Timeline' }).click()
      await page.getByLabel('Date', { exact: true }).fill(tomorrowDateStr())

      const card = page.locator(`[data-ref="${trip.ref}"]`)
      await expect(card).toBeVisible()

      // --- AA-002-BC is a Van; a Business trip can't be serviced by it (VEHICLE_COMPATIBILITY). ---
      const vanRow = page.locator('[data-row-key="AA-002-BC"]')
      await htmlDragAndDrop(page, card, vanRow)
      const rejectionToast = toast(page, /AA-002-BC \(Van\) cannot service a Business trip\./)
      await expect(rejectionToast).toBeVisible()
      await expect(card).toBeVisible() // still the pile card — the drop never reached the API

      expect((await fetchAssignmentState(request, trip.ref)).fleetVehicleId).toBeNull()

      // Let the error toast clear — Sonner renders it as an overlay that can
      // otherwise intercept the next drag's pointer events.
      await expect(rejectionToast).toBeHidden({ timeout: 6000 })

      // --- AA-001-BC is Business — compatible, the drop succeeds. ---
      const businessRow = page.locator('[data-row-key="AA-001-BC"]')
      await dragAndWaitForAssign(page, card, businessRow)
      await expect(card).toBeVisible() // now the assigned block

      expect((await fetchAssignmentState(request, trip.ref)).fleetVehicleId).not.toBeNull()

      // --- The wrench icon (Internal vehicles only) reuses the /vehicles vertical's dialog. ---
      await businessRow.locator('..').getByTitle('Repair shop / Manufacturer service / Bodywork').click()
      await expect(page.getByRole('dialog', { name: 'Unavailability — F' })).toBeVisible()
      await page.keyboard.press('Escape')
    } finally {
      await request.post(`${API_BASE_URL}/api/trips/${trip.ref}/cancel-assignment`, { data: { cancellationFee: 'FREE' } })
    }
  })

  test('List view: Daily/Event/All category filter, click-through to the edit dialog', async ({ page, request }) => {
    const stamp = Date.now()
    const tripRes = await request.post(`${API_BASE_URL}/api/trips`, {
      data: {
        countryCode: 'FR',
        pickupAt: tomorrowIso(18),
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Cannes',
        service: 'TSF',
        passengerName: `E2E Planning List ${stamp}`,
        clientRef: 'CI1',
      },
    })
    expect(tripRes.ok()).toBe(true)
    const trip = (await tripRes.json()) as TripBody

    try {
      await page.goto('/planning')
      const row = page.getByRole('row').filter({ hasText: trip.ref })

      // Default category is "All" — visible regardless of Daily/Event.
      await expect(row).toBeVisible()
      await page.getByRole('tab', { name: 'Daily', exact: true }).click()
      await expect(row).toBeVisible() // CI1 is not an Events-type client
      await page.getByRole('tab', { name: 'Event', exact: true }).click()
      await expect(row).toHaveCount(0)
      await page.getByRole('tab', { name: 'All', exact: true }).click()
      await expect(row).toBeVisible()

      await row.click()
      await expect(page.getByRole('dialog', { name: `Edit booking — ${trip.ref}` })).toBeVisible()
      await page.keyboard.press('Escape')
    } finally {
      await request.post(`${API_BASE_URL}/api/trips/${trip.ref}/cancel-assignment`, { data: { cancellationFee: 'FREE' } })
    }
  })
})
