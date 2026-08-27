import { expect, test } from '@playwright/test'
import { API_BASE_URL, dispatcherAuthFile } from './config'

// See docs/agents/permissions.md and client-edit-dialog.tsx: client:edit is
// Admin-only, unconditionally, on both layers (ClientsController.update's
// @RequirePermission guard, and the dialog's usePermission('client:edit')
// UX mirror that disables the whole form + shows a banner) — same shape as
// trip:cancel (trip-cancel-rbac.spec.ts). Never exercised end-to-end before
// this spec.
test.use({ storageState: dispatcherAuthFile })

test.describe('Client edit — RBAC (DISPATCHER)', () => {
  test('the edit dialog is locked for a DISPATCHER, and the API rejects a direct call too', async ({ page, request }) => {
    // "Marc Dubois" is the individual client seeded by seedFixtures()
    // (apps/api/prisma/seed-data.ts) — matched by email (stable), same
    // reasoning as trip-cancel-rbac.spec.ts / trip-edit-rbac.spec.ts.
    const clientsResponse = await request.get(`${API_BASE_URL}/api/clients`)
    expect(clientsResponse.ok()).toBe(true)
    const clients = (await clientsResponse.json()) as { data: { ref: string; email: string | null }[] }
    const marcDubois = clients.data.find((c) => c.email === 'marc.dubois@example.com')
    if (!marcDubois) throw new Error('Expected the "Marc Dubois" seed client (seedFixtures()) to exist.')

    await page.goto('/clients')
    await page.getByRole('row', { name: 'Marc Dubois' }).getByRole('button', { name: 'Edit' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Editing an account requires the Admin role.')).toBeVisible()
    await expect(dialog.getByLabel('First name', { exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // The frontend disabling the form is UX only — confirm the backend
    // enforces this independently, same guarantee docs/agents/permissions.md promises.
    const directUpdateResponse = await request.put(`${API_BASE_URL}/api/clients/${marcDubois.ref}`, {
      data: { contactFirstName: 'Marc', contactLastName: 'Dubois-Hacked' },
    })
    expect(directUpdateResponse.status()).toBe(403)
  })
})
