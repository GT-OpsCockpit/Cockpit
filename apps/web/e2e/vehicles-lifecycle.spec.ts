import { expect, test, type Locator, type Page } from '@playwright/test'
import { API_BASE_URL, dispatcherAuthFile } from './config'
import { fillArea } from './helpers'

/**
 * Covers the /vehicles vertical end-to-end: internal vs. external creation
 * (Local toggle gating Country/Area/Partner — see vehicle-form-schema.ts,
 * mirroring FleetVehiclesService.assertValid() exactly), the chained
 * Category→Make→Model selects with auto-computed Nb Pax, the type-locked
 * unavailability popup (internal vehicles only), search + pagination, and
 * the vehicle:reactivate RBAC gate (deactivate is ungated, reactivate is
 * Admin-only — docs/agents/permissions.md).
 *
 * Runs against `cockpit_test` (see playwright.config.ts). Every vehicle used
 * here is created fresh by the spec itself (stamped reg numbers, cleaned up
 * where cheap to do so) rather than depending on a shared seed fixture, same
 * reasoning as drivers-lifecycle.spec.ts's module comment.
 */

function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

function row(page: Page, text: string) {
  return page.getByRole('row', { name: text })
}

async function selectOption(page: Page, dialog: Locator, label: string, optionName: string) {
  await dialog.getByLabel(label, { exact: true }).click()
  await page.getByRole('option', { name: optionName, exact: true }).click()
}

test.describe('Vehicles — lifecycle (ADMIN)', () => {
  test('creates an internal and an external vehicle, edits, sets/clears unavailability, searches and paginates', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    await page.goto('/vehicles')
    const dialog = page.getByRole('dialog')

    // --- Internal vehicle: Category required, Make/Model auto-fill from it, Nb Pax auto-computed ---
    await page.getByRole('button', { name: 'New vehicle' }).click()
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(dialog.getByText('Category is required.')).toBeVisible()
    await selectOption(page, dialog, 'Category', 'Business')
    await expect(dialog.getByLabel('Nb Pax', { exact: true })).toHaveValue('3')
    const internalRegNbr = `E2E-${stamp}`
    await dialog.getByLabel('Reg Nbr', { exact: true }).fill(internalRegNbr)
    await dialog.getByLabel('Acr.', { exact: true }).fill(`E2E${String(stamp).slice(-3)}`)
    await dialog.getByRole('button', { name: 'Create' }).click()
    const internalToast = toast(page, /^Vehicle (\S+) created\.$/)
    await expect(internalToast).toBeVisible()
    const internalRef = (await internalToast.textContent())?.match(/Vehicle (\S+) created/)?.[1]
    if (!internalRef) throw new Error('Could not read the created internal vehicle ref off the toast.')
    await expect(row(page, internalRef)).toBeVisible()
    await expect(internalToast).toBeHidden({ timeout: 6000 })

    // --- External vehicle: unchecking Local requires Country/Area/Partner ---
    await page.getByRole('button', { name: 'New vehicle' }).click()
    await selectOption(page, dialog, 'Category', 'Van')
    const externalRegNbr = `E2E-EXT-${stamp}`
    await dialog.getByLabel('Reg Nbr', { exact: true }).fill(externalRegNbr)
    await dialog.getByLabel('Acr.', { exact: true }).fill(`EXT${String(stamp).slice(-3)}`)
    await dialog.getByLabel('Local', { exact: true }).uncheck()
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(dialog.getByText('Country is required for an external (non-local) vehicle.')).toBeVisible()
    await dialog.getByLabel('Country', { exact: true }).click()
    await page.getByPlaceholder('Search country…').fill('France')
    await page.getByRole('option', { name: 'France (FR)' }).click()
    await fillArea(page, dialog, 'Paris')
    await dialog.getByLabel('Partner', { exact: true }).fill(`E2E Partner ${stamp}`)
    await dialog.getByRole('button', { name: 'Create' }).click()
    const externalToast = toast(page, /^Vehicle (\S+) created\.$/)
    await expect(externalToast).toBeVisible()
    const externalRef = (await externalToast.textContent())?.match(/Vehicle (\S+) created/)?.[1]
    if (!externalRef) throw new Error('Could not read the created external vehicle ref off the toast.')
    await expect(row(page, externalRef)).toBeVisible()

    // --- Edit: verify prefill, change a field, save ---
    await row(page, internalRef).getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByRole('heading', { name: `Edit vehicle — ${internalRef}` })).toBeVisible()
    await expect(dialog.getByLabel('Reg Nbr', { exact: true })).toHaveValue(internalRegNbr)
    await dialog.getByLabel('4WD', { exact: true }).check()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(toast(page, `Vehicle ${internalRef} updated.`)).toBeVisible()

    // --- Unavailability (internal only): set (Repair shop), verify type-locked view, clear ---
    await row(page, internalRef).getByTitle('Repair shop / Manufacturer service / Bodywork').click()
    let unavailabilityDialog = page.getByRole('dialog')
    await unavailabilityDialog.getByLabel('Type', { exact: true }).click()
    await page.getByRole('option', { name: 'Repair shop' }).click()
    await unavailabilityDialog.getByLabel('Start date', { exact: true }).fill('2026-10-01')
    await unavailabilityDialog.getByLabel('End date', { exact: true }).fill('2026-10-05')
    await unavailabilityDialog.getByRole('button', { name: 'Save' }).click()
    await expect(toast(page, `Unavailability set for ${internalRef}.`)).toBeVisible()
    await expect(row(page, internalRef).getByText(/^Repair shop —/)).toBeVisible()

    await row(page, internalRef).getByTitle('Repair shop / Manufacturer service / Bodywork').click()
    unavailabilityDialog = page.getByRole('dialog')
    await expect(unavailabilityDialog.getByText(/^Repair shop —/)).toBeVisible()
    await expect(unavailabilityDialog.getByText('Clear it before setting a different kind of unavailability.')).toBeVisible()
    await unavailabilityDialog.getByRole('button', { name: 'Clear' }).click()
    await expect(toast(page, `Unavailability cleared for ${internalRef}.`)).toBeVisible()
    await expect(row(page, internalRef).getByText(/^Repair shop —/)).toHaveCount(0)

    // No wrench action is offered on an External row.
    await expect(row(page, externalRef).getByTitle('Repair shop / Manufacturer service / Bodywork')).toHaveCount(0)

    // --- Deactivate / reactivate (ungated for an ADMIN) ---
    await row(page, internalRef).getByRole('button', { name: 'Deactivate' }).click()
    await expect(toast(page, `Vehicle ${internalRef} deactivated.`)).toBeVisible()
    await expect(row(page, internalRef)).toHaveCount(0) // default filters hide inactive vehicles

    await page.getByLabel('Show deactivated', { exact: true }).check()
    await expect(row(page, internalRef)).toBeVisible()
    await expect(row(page, internalRef)).toHaveClass(/opacity-50/)

    await row(page, internalRef).getByRole('button', { name: 'Reactivate' }).click()
    await expect(toast(page, `Vehicle ${internalRef} reactivated.`)).toBeVisible()
    await expect(row(page, internalRef)).not.toHaveClass(/opacity-50/)
    await page.getByLabel('Show deactivated', { exact: true }).uncheck()

    // --- Search: server-side, bounded to this spec's own fixtures ---
    const search = page.getByPlaceholder('Search by ref, reg nbr, make, model or acronym…')
    await search.fill(`E2E-${stamp}`)
    await expect(row(page, internalRef)).toBeVisible()
    await search.fill('')

    // --- Pagination (PAGE_SIZE=20 in vehicles-page.tsx) ---
    const paginationRegPrefix = `E2EPG${String(stamp).slice(-6)}`
    const createdRefs: string[] = []
    try {
      for (let i = 0; i < 25; i++) {
        const res = await request.post(`${API_BASE_URL}/api/fleet-vehicles`, {
          data: {
            category: 'Business',
            regNbr: `${paginationRegPrefix}-${i}`,
            make: 'Mercedes-Benz',
            model: 'E-Class',
            yearOfBuild: new Date().getFullYear() - 1,
            fourWD: false,
            nbPax: 3,
          },
        })
        expect(res.ok()).toBe(true)
        createdRefs.push(((await res.json()) as { ref: string }).ref)
      }

      await search.fill(paginationRegPrefix)
      await expect(page.getByText('1–20 of 25')).toBeVisible()
      await expect(page.getByText('Page 1 of 2')).toBeVisible()
      const nextButton = page.getByRole('button', { name: 'Next' })
      const previousButton = page.getByRole('button', { name: 'Previous' })
      await expect(previousButton).toBeDisabled()

      await nextButton.click()
      await expect(page.getByText('21–25 of 25')).toBeVisible()
      await expect(page.getByText('Page 2 of 2')).toBeVisible()
      await expect(nextButton).toBeDisabled()

      await previousButton.click()
      await expect(page.getByText('Page 1 of 2')).toBeVisible()
    } finally {
      for (const ref of createdRefs) {
        await request.delete(`${API_BASE_URL}/api/fleet-vehicles/${ref}`)
      }
      await request.delete(`${API_BASE_URL}/api/fleet-vehicles/${internalRef}`)
      await request.delete(`${API_BASE_URL}/api/fleet-vehicles/${externalRef}`)
    }
  })

  test('creates an eventsOnly vehicle linked to an Event account, and the edit dialog reseeds the Event picker by ref', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const eventClientResponse = await request.post(`${API_BASE_URL}/api/clients`, {
      data: {
        clientType: 'EVENT',
        company: `E2E Grand Prix Fleet ${stamp}`,
        eventCountry: 'MC',
        eventArea: 'Monaco',
        // Must not have ended: openEventLinkModal only ever offered upcoming
        // Events (common.js:3034), a rule EventLinkService now enforces.
        eventStartDate: '2027-05-20',
        eventEndDate: '2027-05-24',
      },
    })
    expect(eventClientResponse.ok()).toBe(true)
    const eventClientRef = ((await eventClientResponse.json()) as { ref: string }).ref

    await page.goto('/vehicles')
    const dialog = page.getByRole('dialog')

    await page.getByRole('button', { name: 'New vehicle' }).click()
    await selectOption(page, dialog, 'Category', 'Business')
    await dialog.getByLabel('Reg Nbr', { exact: true }).fill(`E2E-EVT-${stamp}`)
    await dialog.getByLabel('Acr.', { exact: true }).fill(`EVT${String(stamp).slice(-3)}`)

    // A vehicle can only be linked to an Event happening where it is, and a
    // Local vehicle stores no location of its own — so this one is external,
    // based in MC / Monaco. The Event country/area below just mirror that,
    // read-only, exactly as the legacy popup showed them.
    await dialog.getByLabel('Local', { exact: true }).uncheck()
    await dialog.getByLabel('Country', { exact: true }).click()
    await page.getByPlaceholder('Search country…').fill('Monaco')
    await page.getByRole('option', { name: 'Monaco (MC)' }).click()
    await fillArea(page, dialog, 'Monaco')
    await dialog.getByLabel('Partner', { exact: true }).fill(`E2E Events Partner ${stamp}`)

    await dialog.getByLabel('Events-only vehicle (linked to a single Event account)').check()
    await expect(dialog.getByLabel('Event country', { exact: true })).toHaveValue('MC')
    await expect(dialog.getByLabel('Event area', { exact: true })).toHaveValue('Monaco')

    await dialog.getByLabel('Event', { exact: true }).click()
    await page.getByPlaceholder('Search event…').fill(`E2E Grand Prix Fleet ${stamp}`)
    await page.getByRole('option', { name: new RegExp(`E2E Grand Prix Fleet ${stamp}`) }).click()
    await dialog.getByRole('button', { name: 'Create' }).click()

    const created = toast(page, /^Vehicle (\S+) created\.$/)
    await expect(created).toBeVisible()
    const vehicleRef = (await created.textContent())?.match(/Vehicle (\S+) created/)?.[1]
    if (!vehicleRef) throw new Error('Could not read the created eventsOnly vehicle ref off the toast.')
    await expect(row(page, vehicleRef)).toBeVisible()

    // Editing without touching anything must round-trip cleanly — this is
    // exactly the case FleetVehicleEntity.eventClient exists to support
    // (seeding the Event picker by ref on edit, not just eventClientId).
    await row(page, vehicleRef).getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByLabel('Event', { exact: true })).toHaveText(new RegExp(`E2E Grand Prix Fleet ${stamp}`))
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(toast(page, `Vehicle ${vehicleRef} updated.`)).toBeVisible()

    await request.delete(`${API_BASE_URL}/api/fleet-vehicles/${vehicleRef}`)
    await request.delete(`${API_BASE_URL}/api/clients/${eventClientRef}`)
  })
})

// See docs/agents/permissions.md and vehicles-table.tsx — vehicle:reactivate
// is Admin-only, but (like driver:reactivate) only on the false→true
// transition: deactivating stays ungated even for a DISPATCHER. Creates its
// own throwaway vehicle rather than mutating a shared seed fixture.
test.describe('Vehicles — reactivate RBAC (DISPATCHER)', () => {
  test.use({ storageState: dispatcherAuthFile })

  test('deactivate succeeds, reactivate is blocked (UI-disabled and API-rejected)', async ({ page, request }) => {
    const stamp = Date.now()
    const createResponse = await request.post(`${API_BASE_URL}/api/fleet-vehicles`, {
      data: {
        category: 'Business',
        regNbr: `E2E-RBAC-${stamp}`,
        make: 'Mercedes-Benz',
        model: 'E-Class',
        yearOfBuild: new Date().getFullYear() - 1,
        fourWD: false,
        nbPax: 3,
      },
    })
    expect(createResponse.ok()).toBe(true)
    const vehicle = (await createResponse.json()) as { ref: string }

    await page.goto('/vehicles')
    await page.getByLabel('Show deactivated', { exact: true }).check()
    await row(page, vehicle.ref).getByRole('button', { name: 'Deactivate' }).click()
    await expect(toast(page, `Vehicle ${vehicle.ref} deactivated.`)).toBeVisible()

    await expect(row(page, vehicle.ref).getByRole('button', { name: 'Reactivating requires the Admin role' })).toBeDisabled()

    // The frontend disabling the control is UX only — confirm the backend
    // enforces this independently, same guarantee docs/agents/permissions.md promises.
    const directReactivateResponse = await request.patch(`${API_BASE_URL}/api/fleet-vehicles/${vehicle.ref}/active`, {
      data: { active: true },
    })
    expect(directReactivateResponse.status()).toBe(403)

    await request.delete(`${API_BASE_URL}/api/fleet-vehicles/${vehicle.ref}`)
  })
})
