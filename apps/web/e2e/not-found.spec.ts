import { expect, test } from '@playwright/test'

/**
 * An address nobody typed on purpose — a stale bookmark, a truncated link.
 * The router had no catch-all, so React Router fell through to its own
 * development error screen ("Unexpected Application Error! … Hey developer 👋
 * You can provide a way better UX than this"), addressed to whoever built the
 * app rather than to the dispatcher reading it.
 */
test.describe('Unknown URL', () => {
  test('shows a real page, not React Router’s developer error screen', async ({ page }) => {
    await page.goto('/no-such-page')

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page.getByText('Hey developer')).toHaveCount(0)
    await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)

    // The shell stays around it, so the visitor is one click from somewhere real.
    await page.getByRole('link', { name: 'Back to Bookings' }).click()
    await expect(page).toHaveURL(/\/bookings$/)
  })
})
