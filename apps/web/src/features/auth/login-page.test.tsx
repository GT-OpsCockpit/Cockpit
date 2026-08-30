import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const loginMutate = vi.fn(async () => ({}) as { devCode?: string })

vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  useAuthControllerLogin: () => ({ mutateAsync: loginMutate, isPending: false }),
  useAuthControllerVerify: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: vi.fn() } }))

const { LoginPage } = await import('./login-page')

afterEach(() => {
  cleanup()
  loginMutate.mockClear()
})

async function signIn() {
  render(<LoginPage />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dana@cockpit.local' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2hunter2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('button', { name: 'Back' })
}

describe('LoginPage', () => {
  // The OTP step is where a mistyped address or a wrong account is noticed —
  // it names the address the code went to. "Back" is the way out of that, and
  // it used to hand back an empty form: the credentials form was unmounted on
  // the way in, taking its state with it. Both fields have to survive the
  // round trip, the password included, or the operator retypes everything to
  // fix a typo in the email.
  it('keeps email and password when coming back from the OTP step', async () => {
    await signIn()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveValue('dana@cockpit.local')
    })
    expect(screen.getByLabelText('Password')).toHaveValue('hunter2hunter2')
  })

  it('shows the OTP step and hides the credentials form while it is up', async () => {
    await signIn()

    expect(screen.getByLabelText('Verification code')).toBeVisible()
    // Still mounted — that is what preserves the state — but out of the way.
    expect(screen.getByLabelText('Email')).not.toBeVisible()
  })
})
