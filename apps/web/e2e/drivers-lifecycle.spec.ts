import { expect, test, type Locator, type Page } from '@playwright/test'
import { API_BASE_URL, dispatcherAuthFile } from './config'
import { fillArea } from './helpers'

/**
 * Covers the /drivers vertical end-to-end: the four conditional-validation
 * branches (internal / partner-company-only / named-partner / eventsOnly —
 * see driver-form-schema.ts, mirroring DriversService.assertValidDriverFields()
 * exactly), the type-locked unavailability popup, search + pagination, and
 * the driver:reactivate RBAC gate (deactivate is ungated, reactivate is
 * Admin-only — docs/agents/permissions.md).
 *
 * Runs against `cockpit_test` (see playwright.config.ts). Every driver used
 * here is created fresh by the spec itself (stamped refs/names, cleaned up
 * where cheap to do so) rather than depending on a shared seed fixture — refs
 * are read back from the create toast, same reasoning as
 * booking-lifecycle.spec.ts's module comment (the seed is idempotent but not
 * a truncating reset, so ref numbers drift across accumulated local runs).
 */

function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

function row(page: Page, text: string) {
  return page.getByRole('row', { name: text })
}

/**
 * A dialable French mobile in E.164, distinct per `slot`.
 *
 * Since the phone port, the API and the form both validate against
 * libphonenumber's `/max` metadata (see packages/shared/src/validation/phone.js),
 * which checks the digit *pattern* and not just the length — a raw timestamp
 * lands in unallocated ranges ("07 17 87 94 83" is not a French mobile) and is
 * rejected outright. Keeping the 06 prefix and varying only the tail stays
 * inside an allocated range whatever the clock says. `slot` keeps them unique:
 * DriversService.create() dedups by phone, which is a unique column.
 */
function mobile(stamp: number, slot: number) {
  return `+336${String(stamp).slice(-6)}${String(slot).padStart(2, '0')}`
}

/**
 * Narrows the list to a single driver before asserting on its row.
 *
 * The table pages at 20 (PAGE_SIZE in drivers-page.tsx) and orders by ref, so a
 * freshly created driver lands on the *last* page — and cockpit_test is never
 * truncated between runs (see playwright.config.ts), so "just created,
 * therefore on screen" stops holding as soon as drivers pile up. Filtering by
 * ref is deterministic whatever the database already holds.
 */
async function showOnly(page: Page, ref: string) {
  await page.getByPlaceholder('Search by ref, name, company, email or phone…').fill(ref)
}

async function createDriverAndReadRef(page: Page, fill: () => Promise<void>): Promise<string> {
  await page.getByRole('button', { name: 'New driver' }).click()
  await fill()
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
  const created = toast(page, /^Driver (\S+) created\.$/)
  await expect(created).toBeVisible()
  const ref = (await created.textContent())?.match(/Driver (\S+) created/)?.[1]
  if (!ref) throw new Error('Could not read the created driver ref off the toast.')
  await expect(created).toBeHidden({ timeout: 6000 })
  return ref
}

test.describe('Drivers — lifecycle (ADMIN)', () => {
  test('creates each driver kind, edits, sets/clears unavailability, searches and paginates', async ({ page, request }) => {
    const stamp = Date.now()
    await page.goto('/drivers')
    const dialog = page.getByRole('dialog')

    // --- Internal driver (no company): firstName/lastName/phone required ---
    await page.getByRole('button', { name: 'New driver' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
    await expect(dialog.getByText('First name is required.')).toBeVisible()
    await dialog.getByLabel('First name', { exact: true }).fill(`E2E${stamp}`)
    await dialog.getByLabel('Last name', { exact: true }).fill('Internal')
    await dialog.getByLabel('Phone', { exact: true }).fill(mobile(stamp, 1))
    await dialog.getByRole('button', { name: 'Create' }).click()
    const internalToast = toast(page, /^Driver (\S+) created\.$/)
    await expect(internalToast).toBeVisible()
    const internalRef = (await internalToast.textContent())?.match(/Driver (\S+) created/)?.[1]
    if (!internalRef) throw new Error('Could not read the created internal driver ref off the toast.')
    await showOnly(page, internalRef)
    await expect(row(page, internalRef)).toBeVisible()
    await expect(internalToast).toBeHidden({ timeout: 6000 })

    // --- Partner company, no contact name: email only required ---
    const companyOnlyRef = await createDriverAndReadRef(page, async () => {
      await dialog.getByLabel('Company', { exact: true }).fill(`E2E Partner Co ${stamp}`)
      await dialog.getByRole('button', { name: 'Create' }).click()
      await expect(dialog.getByText('Email is required for a partner company.')).toBeVisible()
      await dialog.getByLabel('Email', { exact: true }).fill(`partner${stamp}@example.test`)
    })
    await showOnly(page, companyOnlyRef)
    await expect(row(page, companyOnlyRef)).toBeVisible()

    // --- Named partner chauffeur (company + a name): email AND phone required ---
    const namedPartnerRef = await createDriverAndReadRef(page, async () => {
      await dialog.getByLabel('First name', { exact: true }).fill(`E2E${stamp}`)
      await dialog.getByLabel('Company', { exact: true }).fill(`E2E Partner Named ${stamp}`)
      await dialog.getByLabel('Email', { exact: true }).fill(`named${stamp}@example.test`)
      await dialog.getByLabel('Phone', { exact: true }).fill(mobile(stamp, 2))
    })
    await showOnly(page, namedPartnerRef)
    await expect(row(page, namedPartnerRef)).toBeVisible()

    // --- Edit: verify prefill, change a field, save ---
    await showOnly(page, internalRef)
    await row(page, internalRef).getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByRole('heading', { name: `Edit driver — ${internalRef}` })).toBeVisible()
    await expect(dialog.getByLabel('First name', { exact: true })).toHaveValue(`E2E${stamp}`)
    await fillArea(page, dialog, 'Riviera')
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(toast(page, `Driver ${internalRef} updated.`)).toBeVisible()
    await expect(row(page, internalRef).getByText('Riviera')).toBeVisible()

    // --- Unavailability: set (Day off), verify type-locked view, clear ---
    await row(page, internalRef).getByRole('button', { name: 'Unavailability' }).click()
    let unavailabilityDialog = page.getByRole('dialog')
    await unavailabilityDialog.getByLabel('Type', { exact: true }).click()
    await page.getByRole('option', { name: 'Day off' }).click()
    await unavailabilityDialog.getByLabel('Date', { exact: true }).fill('2026-10-01')
    await unavailabilityDialog.getByRole('button', { name: 'Save' }).click()
    await expect(toast(page, `Unavailability set for ${internalRef}.`)).toBeVisible()
    await expect(row(page, internalRef).getByText(/^Off /)).toBeVisible()

    await row(page, internalRef).getByRole('button', { name: 'Unavailability' }).click()
    unavailabilityDialog = page.getByRole('dialog')
    await expect(unavailabilityDialog.getByText(/^Off /)).toBeVisible()
    await expect(unavailabilityDialog.getByText('Clear it before setting a different kind of unavailability.')).toBeVisible()
    await unavailabilityDialog.getByRole('button', { name: 'Clear' }).click()
    await expect(toast(page, `Unavailability cleared for ${internalRef}.`)).toBeVisible()
    await expect(row(page, internalRef).getByText(/^Off /)).toHaveCount(0)

    // --- Deactivate / reactivate (ungated for an ADMIN — the RBAC gate on
    // reactivate only is covered by the "reactivate RBAC" describe below) ---
    await row(page, internalRef).getByRole('button', { name: 'Deactivate' }).click()
    await expect(toast(page, `Driver ${internalRef} deactivated.`)).toBeVisible()
    await expect(row(page, internalRef)).toHaveCount(0) // default filters hide inactive drivers

    await page.getByLabel('Show deactivated', { exact: true }).check()
    await expect(row(page, internalRef)).toBeVisible()
    await expect(row(page, internalRef)).toHaveClass(/opacity-50/)

    await row(page, internalRef).getByRole('button', { name: 'Reactivate' }).click()
    await expect(toast(page, `Driver ${internalRef} reactivated.`)).toBeVisible()
    await expect(row(page, internalRef)).not.toHaveClass(/opacity-50/)
    await page.getByLabel('Show deactivated', { exact: true }).uncheck()

    // --- Search: server-side, bounded to this spec's own fixtures ---
    const search = page.getByPlaceholder('Search by ref, name, company, email or phone…')
    await search.fill(`E2E${stamp}`)
    await expect(row(page, internalRef)).toBeVisible()
    await expect(row(page, namedPartnerRef)).toBeVisible()
    await expect(row(page, companyOnlyRef)).toHaveCount(0) // no "E2E{stamp}" name on the company-only partner
    await search.fill('')

    // --- Pagination (PAGE_SIZE=20 in drivers-page.tsx) ---
    const paginationPrefix = `E2E Pagination ${stamp}`
    const createdRefs: string[] = []
    try {
      for (let i = 0; i < 25; i++) {
        // Distinct phones matter here — DriversService.create() dedups by
        // phone, so 25 colliding numbers would silently collapse into one
        // driver instead of 25 (phone is a real unique DB column, so the loop
        // index must land inside the national number's own digits).
        // E.164 since the phone port: @IsPhone rejects a national number
        // outright, there is no server-side guess (validation/phone.js).
        const res = await request.post(`${API_BASE_URL}/api/drivers`, {
          data: { firstName: paginationPrefix, lastName: `${i}`, phone: mobile(stamp, 10 + i) },
        })
        expect(res.ok()).toBe(true)
        createdRefs.push(((await res.json()) as { ref: string }).ref)
      }

      await search.fill(paginationPrefix)
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
        await request.delete(`${API_BASE_URL}/api/drivers/${ref}`)
      }
    }
  })

  test('creates an eventsOnly driver linked to an Event account, and the edit dialog reseeds the Event picker by ref', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const eventClientResponse = await request.post(`${API_BASE_URL}/api/clients`, {
      data: {
        clientType: 'EVENT',
        company: `E2E Grand Prix ${stamp}`,
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

    await page.goto('/drivers')
    const dialog = page.getByRole('dialog')

    const driverRef = await (async () => {
      await page.getByRole('button', { name: 'New driver' }).click()
      await dialog.getByLabel('First name', { exact: true }).fill(`E2E${stamp}`)
      await dialog.getByLabel('Last name', { exact: true }).fill('Events')
      await dialog.getByLabel('Company', { exact: true }).fill(`E2E Events Crew ${stamp}`)
      await dialog.getByLabel('Phone', { exact: true }).fill(`09${stamp}`.slice(0, 10))
      await dialog.getByLabel('Email', { exact: true }).fill(`events${stamp}@example.test`)
      // A driver can only be linked to an Event happening where it is, so its
      // own Country/Area come first — the Event country/area below just mirror
      // them, read-only, exactly as the legacy popup showed them.
      await dialog.getByLabel('Country', { exact: true }).click()
      await page.getByPlaceholder('Search country…').fill('Monaco')
      await page.getByRole('option', { name: 'Monaco (MC)' }).click()
      await fillArea(page, dialog, 'Monaco')

      await dialog.getByLabel('Events-only driver (linked to a single Event account)').check()
      await expect(dialog.getByLabel('Event country', { exact: true })).toHaveValue('MC')
      await expect(dialog.getByLabel('Event area', { exact: true })).toHaveValue('Monaco')

      await dialog.getByLabel('Event', { exact: true }).click()
      await page.getByPlaceholder('Search event…').fill(`E2E Grand Prix ${stamp}`)
      await page.getByRole('option', { name: new RegExp(`E2E Grand Prix ${stamp}`) }).click()

      await dialog.getByRole('button', { name: 'Create' }).click()
      const created = toast(page, /^Driver (\S+) created\.$/)
      await expect(created).toBeVisible()
      const ref = (await created.textContent())?.match(/Driver (\S+) created/)?.[1]
      if (!ref) throw new Error('Could not read the created eventsOnly driver ref off the toast.')
      return ref
    })()

    // Creating a Company + eventsOnly driver also triggers the "Link a
    // vehicle to this partner?" prompt (see the dedicated "Ind." test below)
    // — not what this test is covering, so decline it before continuing.
    await page.getByRole('alertdialog').getByRole('button', { name: 'No' }).click()

    await showOnly(page, driverRef)
    await expect(row(page, driverRef)).toBeVisible()

    // Editing without touching anything must round-trip cleanly — this is
    // exactly the case DriverEntity.eventClient exists to support (seeding
    // the Event picker by ref on edit, not just the opaque eventClientId).
    await row(page, driverRef).getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByLabel('Event', { exact: true })).toHaveText(new RegExp(`E2E Grand Prix ${stamp}`))
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(toast(page, `Driver ${driverRef} updated.`)).toBeVisible()

    await request.delete(`${API_BASE_URL}/api/drivers/${driverRef}`)
    await request.delete(`${API_BASE_URL}/api/clients/${eventClientRef}`)
  })

  test('"Ind." opens the Link-a-vehicle popup right after creating a partner, and the vehicle shows up on /vehicles', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const company = `E2E Ind Partner ${stamp}`
    await page.goto('/drivers')
    const dialog = page.getByRole('dialog')

    await page.getByRole('button', { name: 'New driver' }).click()
    await dialog.getByLabel('Company', { exact: true }).fill(company)
    await dialog.getByLabel('Email', { exact: true }).fill(`ind${stamp}@example.test`)
    const indCheckbox = dialog.getByLabel('Link a vehicle to this partner once created')
    await expect(indCheckbox).toBeEnabled()
    await indCheckbox.check()
    await dialog.getByRole('button', { name: 'Create' }).click()
    const driverToast = toast(page, /^Driver (\S+) created\.$/)
    await expect(driverToast).toBeVisible()
    const driverRef = (await driverToast.textContent())?.match(/Driver (\S+) created/)?.[1]
    if (!driverRef) throw new Error('Could not read the created partner driver ref off the toast.')

    // "Ind." skips the Yes/No prompt (that's only for the Events branch) and
    // opens the Link popup directly — same popup, "Local" forced/locked off,
    // "Partner" preseeded from the driver's just-typed Company.
    const linkDialog = page.getByRole('dialog')
    await expect(linkDialog.getByRole('heading', { name: `Link a vehicle to ${company}` })).toBeVisible()
    await expect(linkDialog.getByLabel('Local', { exact: true })).toBeDisabled()
    await expect(linkDialog.getByLabel('Local', { exact: true })).not.toBeChecked()
    await expect(linkDialog.getByLabel('Partner', { exact: true })).toHaveValue(company)

    await linkDialog.getByLabel('Category', { exact: true }).click()
    await page.getByRole('option', { name: 'Business', exact: true }).click()
    const regNbr = `E2E-LINK-${stamp}`
    await linkDialog.getByLabel('Reg Nbr', { exact: true }).fill(regNbr)
    await linkDialog.getByLabel('Acr.', { exact: true }).fill(`LNK${String(stamp).slice(-3)}`)
    // Country/Area aren't carried over from the driver form — same as the
    // legacy popup, only Partner is preseeded — so they still need filling.
    await linkDialog.getByLabel('Country', { exact: true }).click()
    await page.getByPlaceholder('Search country…').fill('France')
    await page.getByRole('option', { name: 'France (FR)' }).click()
    await fillArea(page, linkDialog, 'Paris')
    await linkDialog.getByRole('button', { name: 'Link' }).click()

    const vehicleToast = toast(page, new RegExp(`^Vehicle (\\S+) linked to ${company}\\.$`))
    await expect(vehicleToast).toBeVisible()
    const vehicleRef = (await vehicleToast.textContent())?.match(/Vehicle (\S+) linked/)?.[1]
    if (!vehicleRef) throw new Error('Could not read the linked vehicle ref off the toast.')

    // Shows up on /vehicles, External table, with the partner's name under the Reg Nbr.
    await page.goto('/vehicles')
    await page.getByPlaceholder('Search by ref, reg nbr, make, model or acronym…').fill(regNbr)
    await expect(row(page, vehicleRef)).toBeVisible()
    // Shows twice on this row for a company-only partner: the "Partner" column,
    // and the linked-driver subline under Reg Nbr (driverDisplayName falls back
    // to company when there's no first/last name) — either match proves it.
    await expect(row(page, vehicleRef).getByText(company).first()).toBeVisible()

    // The padlock (ported from the legacy's unlinkVehicleFromDriver,
    // common.js:3565) shows up on the Partners table, under the driver's
    // Name cell, with the reserved vehicle's reg nbr.
    await page.goto('/drivers')
    await page.getByPlaceholder('Search by ref, name, company, email or phone…').fill(company)
    const partnerRow = row(page, driverRef)
    await expect(partnerRow.getByText(regNbr)).toBeVisible()
    await partnerRow.getByRole('button', { name: 'Unlink this vehicle from the chauffeur' }).click()
    await expect(
      page.getByRole('alertdialog', { name: 'Unlink this vehicle from the chauffeur?' }),
    ).toContainText(`${regNbr} will no longer be reserved for ${company}`)
    await page.getByRole('button', { name: 'Unlink' }).click()
    await expect(toast(page, `Vehicle ${regNbr} unlinked.`)).toBeVisible()
    await expect(partnerRow.getByText(regNbr)).toBeHidden()

    // Kept in sync on /vehicles too (both invalidated on unlink) — the
    // "Partner" column (partnerCompany) is untouched by an unlink, only the
    // driver subline under Reg Nbr clears, so `company` now matches once
    // instead of twice on this row.
    await page.goto('/vehicles')
    await page.getByPlaceholder('Search by ref, reg nbr, make, model or acronym…').fill(regNbr)
    await expect(row(page, vehicleRef).getByText(company)).toHaveCount(1)

    await request.delete(`${API_BASE_URL}/api/fleet-vehicles/${vehicleRef}`)
    await request.delete(`${API_BASE_URL}/api/drivers/${driverRef}`)
  })
})

// See docs/agents/permissions.md and drivers-table.tsx — driver:reactivate is
// Admin-only, but (unlike client:edit) only on the false→true transition:
// deactivating stays ungated even for a DISPATCHER. Same shape as
// trip-cancel-rbac.spec.ts. Creates its own throwaway driver (DISPATCHER can
// create/deactivate freely — only reactivate is gated) rather than mutating a
// shared seed fixture.
test.describe('Drivers — reactivate RBAC (DISPATCHER)', () => {
  test.use({ storageState: dispatcherAuthFile })

  test('deactivate succeeds, reactivate is blocked (UI-disabled and API-rejected)', async ({ page, request }) => {
    const stamp = Date.now()
    const createResponse = await request.post(`${API_BASE_URL}/api/drivers`, {
      data: { firstName: 'RBAC', lastName: `Test ${stamp}`, phone: mobile(stamp, 3) },
    })
    expect(createResponse.ok()).toBe(true)
    const driver = (await createResponse.json()) as { ref: string }

    await page.goto('/drivers')
    await page.getByLabel('Show deactivated', { exact: true }).check()
    await showOnly(page, driver.ref)
    await row(page, driver.ref).getByRole('button', { name: 'Deactivate' }).click()
    await expect(toast(page, `Driver ${driver.ref} deactivated.`)).toBeVisible()

    await expect(row(page, driver.ref).getByRole('button', { name: 'Reactivating requires the Admin role' })).toBeDisabled()

    // The frontend disabling the control is UX only — confirm the backend
    // enforces this independently, same guarantee docs/agents/permissions.md promises.
    const directReactivateResponse = await request.patch(`${API_BASE_URL}/api/drivers/${driver.ref}/active`, {
      data: { active: true },
    })
    expect(directReactivateResponse.status()).toBe(403)
  })
})
