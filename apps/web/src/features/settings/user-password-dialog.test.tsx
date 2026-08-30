import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mutateAsync = vi.fn(async () => ({}))

vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  useUsersControllerSetPassword: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { UserPasswordDialog } = await import('./user-password-dialog')
const { baseUser } = await import('./test-fixtures')

afterEach(() => {
  cleanup()
  mutateAsync.mockClear()
})

// Every other form in the app reports its rejections through <FormMessage/>,
// wired to the field by react-hook-form. This dialog rolled its own paragraph
// and its own length check, so the one place a password is set was also the
// one place the error markup could drift from the rest.
describe('UserPasswordDialog', () => {
  const password = () => screen.getByLabelText('New password')

  it('reports too short a password through the form, and refuses to submit it', async () => {
    render(<UserPasswordDialog user={baseUser()} onOpenChange={vi.fn()} />)

    fireEvent.change(password(), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
    // Wired to the field, not floating beside it.
    expect(password()).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits a long enough password', async () => {
    render(<UserPasswordDialog user={baseUser({ id: 'user-9' })} onOpenChange={vi.fn()} />)

    fireEvent.change(password(), { target: { value: 'long-enough-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'user-9', data: { password: 'long-enough-password' } })
    })
  })
})
