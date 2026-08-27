import { expect, test } from '@playwright/test'
import { API_BASE_URL, dispatcherAuthFile } from './config'

// See docs/agents/permissions.md — unlike client:edit (which only gates the
// mutation, GET /clients stays open to any authenticated user), both
// company:edit and user:manage are class-level @RequirePermission on their
// whole controller, so a DISPATCHER's GET itself 403s. company-tab.tsx and
// users-tab.tsx don't even fire that query in that case — they show an empty
// state instead, which is what this spec checks, alongside the direct API
// calls also being rejected.
test.use({ storageState: dispatcherAuthFile })

test.describe('Settings — RBAC (DISPATCHER)', () => {
  test('both tabs show an Admin-only empty state, and the API rejects direct calls too', async ({ page, request }) => {
    await page.goto('/settings')

    const companyPanel = page.getByRole('tabpanel', { name: 'Company' })
    await expect(companyPanel.getByText('Viewing company info requires the Admin role.')).toBeVisible()
    await expect(companyPanel.getByRole('textbox')).toHaveCount(0)

    await page.getByRole('tab', { name: 'Users' }).click()
    const usersPanel = page.getByRole('tabpanel', { name: 'Users' })
    await expect(usersPanel.getByText('Managing users requires the Admin role.')).toBeVisible()
    await expect(usersPanel.getByRole('button', { name: 'New user' })).toHaveCount(0)
    await expect(usersPanel.getByRole('table')).toHaveCount(0)

    const companyResponse = await request.get(`${API_BASE_URL}/api/company-info`)
    expect(companyResponse.status()).toBe(403)

    const usersResponse = await request.get(`${API_BASE_URL}/api/users`)
    expect(usersResponse.status()).toBe(403)
  })
})
