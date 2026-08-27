import { expect, test, type Page } from '@playwright/test'
import { API_BASE_URL } from './config'

/**
 * Covers the /settings → Users tab: create (with a password — CreateUserDto
 * requires one, unlike the legacy's Access panel), edit (role/name — no
 * password field, UpdateUserDto has none), and deactivate. Deactivation has
 * no reverse — there is no reactivate endpoint for users (unlike
 * drivers/vehicles) — so once deactivated a user stays deactivated for good;
 * this spec accepts that instead of trying to clean up afterwards.
 */

function toast(page: Page, textOrPattern: string | RegExp) {
  return page.getByText(textOrPattern).first()
}

function row(page: Page, text: string) {
  return page.getByRole('row', { name: text })
}

test.describe('Settings — Users tab (ADMIN)', () => {
  test('creates, edits and deactivates a user', async ({ page, request }) => {
    const stamp = Date.now()
    const email = `e2e.settings.${stamp}@cockpit.test`

    await page.goto('/settings')
    await page.getByRole('tab', { name: 'Users' }).click()
    const usersPanel = page.getByRole('tabpanel', { name: 'Users' })
    const dialog = page.getByRole('dialog')

    // --- Create ---
    await usersPanel.getByRole('button', { name: 'New user' }).click()
    await dialog.getByLabel('Surname', { exact: true }).fill('E2E')
    await dialog.getByLabel('Name', { exact: true }).fill(`Settings ${stamp}`)
    await dialog.getByLabel('Email', { exact: true }).fill(email)
    await dialog.getByLabel('Mobile', { exact: true }).fill('0611111111')
    await dialog.getByLabel('Password', { exact: true }).fill('password123')
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(toast(page, `User ${email} created.`)).toBeVisible()
    await expect(row(page, email)).toBeVisible()
    await expect(row(page, email).getByText('DISPATCHER')).toBeVisible()

    // A short password is rejected client-side before it ever reaches the API.
    await usersPanel.getByRole('button', { name: 'New user' }).click()
    await dialog.getByLabel('Surname', { exact: true }).fill('E2E')
    await dialog.getByLabel('Name', { exact: true }).fill('ShortPwd')
    await dialog.getByLabel('Email', { exact: true }).fill(`short.${stamp}@cockpit.test`)
    await dialog.getByLabel('Password', { exact: true }).fill('short1')
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(dialog.getByText('Password must be at least 8 characters.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // --- Edit: prefilled, no password field, role change round-trips ---
    await row(page, email).getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByRole('heading', { name: `Edit user — ${email}` })).toBeVisible()
    await expect(dialog.getByLabel('Surname', { exact: true })).toHaveValue('E2E')
    await expect(dialog.getByLabel('Password', { exact: true })).toHaveCount(0)
    await dialog.getByLabel('Role', { exact: true }).click()
    await page.getByRole('option', { name: 'Admin', exact: true }).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(toast(page, `User ${email} updated.`)).toBeVisible()
    await expect(row(page, email).getByText('ADMIN')).toBeVisible()

    // --- Deactivate: irreversible-action confirm, then disabled row actions ---
    await row(page, email).getByRole('button', { name: 'Deactivate' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Deactivate this user?' })
    await expect(confirm).toContainText("can't be undone")
    await confirm.getByRole('button', { name: 'Deactivate' }).click()
    await expect(toast(page, `User ${email} deactivated.`)).toBeVisible()
    await expect(row(page, email)).toHaveClass(/opacity-50/)
    await expect(row(page, email).getByText(/^Deactivated /)).toBeVisible()
    await expect(row(page, email).getByRole('button', { name: 'Edit' })).toBeDisabled()
    await expect(row(page, email).getByRole('button', { name: 'Deactivate' })).toBeDisabled()

    // No reactivate path exists at all — confirm the API has nothing to call either.
    const usersResponse = await request.get(`${API_BASE_URL}/api/users`)
    const users = (await usersResponse.json()) as { email: string; id: string; active: boolean }[]
    const created = users.find((u) => u.email === email)
    expect(created?.active).toBe(false)
  })
})
