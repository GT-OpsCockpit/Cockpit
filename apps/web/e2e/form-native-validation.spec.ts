import { expect, test } from '@playwright/test'

/**
 * Every form in this app is validated by a zod resolver, whose messages are
 * written in English and rendered by <FormMessage>. Native HTML constraints
 * (`type="email"`, `min`, `max`) are checked by the *browser*, before the
 * submit event — so one badly-typed value used to abort the submission
 * outright: `handleSubmit` never ran, no message was written or cleared, and
 * the only feedback was a browser bubble in the browser's own language.
 *
 * The visible symptom was stale errors: fields the dispatcher had since filled
 * in kept their "required" message, because nothing re-ran to clear it.
 *
 * Covered here on the account dialog (a `type="email"` field) — the same
 * `noValidate` seam serves every record form, so this stands for all of them.
 */
test.describe('Forms do not let native validation pre-empt their own messages', () => {
  test('clears a fixed field and reports the real error when an email is malformed', async ({ page }) => {
    await page.goto('/clients')
    await page.getByRole('button', { name: 'New account' }).click()
    const dialog = page.getByRole('dialog')

    // First submit: nothing filled — the Individual name rule fires.
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(
      dialog.getByText('First and last name are required for an Individual-type account.').first(),
    ).toBeVisible()

    // Fix the names, then type an email the browser itself would reject.
    await dialog.getByLabel('First name').fill('QA')
    await dialog.getByLabel('Last name').fill('Native Validation')
    await dialog.getByLabel('Email', { exact: true }).fill('not-an-email')
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()

    // The app's own message, in the app's own language…
    await expect(dialog.getByText('Enter a valid email address.').first()).toBeVisible()
    // …and the rule that no longer applies is gone, which only happens if the
    // submit actually reached the resolver.
    await expect(
      dialog.getByText('First and last name are required for an Individual-type account.'),
    ).toHaveCount(0)
  })

  // Same defect as PriceField on the booking form: the rule exists and is
  // enforced (restored 2026-08-29, `24107ea` — the legacy capped it too), but
  // the field had no <FormMessage> slot, so Create simply did nothing.
  test('says why it will not accept an over-long acronym', async ({ page }) => {
    await page.goto('/clients')
    await page.getByRole('button', { name: 'New account' }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByLabel('First name').fill('QA')
    await dialog.getByLabel('Last name').fill('Acronym')
    await dialog.getByLabel('Acronym', { exact: true }).fill('ABCDE')
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(dialog.getByText('Acronym must be 4 characters or fewer.').first()).toBeVisible()
  })
})
