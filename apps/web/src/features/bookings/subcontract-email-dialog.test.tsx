import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const tripsControllerSubcontractEmail = vi.fn()
const tripsControllerSendSubcontractEmail = vi.fn(async () => ({ ok: true as const, to: 'dispatch@rivieravtc.fr' }))

vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  getBaseUrl: () => 'https://cockpit.example.test',
  tripsControllerSubcontractEmail,
  tripsControllerSendSubcontractEmail,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

const { SubcontractEmailDialog } = await import('./subcontract-email-dialog')

afterEach(() => {
  cleanup()
  tripsControllerSubcontractEmail.mockReset()
  tripsControllerSendSubcontractEmail.mockClear()
})

// This dialog replaced a fire-and-forget mailto: draft (subcontract-email.ts,
// now removed) precisely because a mailto: link can't force the From address
// the requester needs (contact@gt-ops.club) — see
// docs/feature-requests/partner-companies.md §6. Nothing may be sent without
// an explicit "Send" click, however the draft was reached.
describe('SubcontractEmailDialog', () => {
  it('previews the fetched draft and only sends on an explicit click', async () => {
    tripsControllerSubcontractEmail.mockResolvedValue({
      to: 'dispatch@rivieravtc.fr',
      subject: 'Booking R-1',
      body: 'A job has been subcontracted to you...',
    })

    render(<SubcontractEmailDialog target={{ ref: 'R-1', kind: 'assigned' }} onOpenChange={vi.fn()} />)

    expect(await screen.findByDisplayValue('dispatch@rivieravtc.fr')).toBeInTheDocument()
    expect(tripsControllerSendSubcontractEmail).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(tripsControllerSendSubcontractEmail).toHaveBeenCalledWith('R-1', {
        kind: 'assigned',
        partnerRef: undefined,
        subject: 'Booking R-1',
        body: 'A job has been subcontracted to you...',
      })
    })
  })

  it('resolves a relative nameboard link to an absolute one before showing it', async () => {
    tripsControllerSubcontractEmail.mockResolvedValue({
      to: 'dispatch@rivieravtc.fr',
      subject: 'Booking R-1',
      body: 'Nameboard: /uploads/nameboards/xyz.png',
    })

    render(<SubcontractEmailDialog target={{ ref: 'R-1', kind: 'assigned' }} onOpenChange={vi.fn()} />)

    expect(
      await screen.findByDisplayValue('Nameboard: https://cockpit.example.test/uploads/nameboards/xyz.png'),
    ).toBeInTheDocument()
  })

  it('shows nothing to send when the partner has no email on file', async () => {
    tripsControllerSubcontractEmail.mockResolvedValue({ to: null, subject: 'Booking R-1', body: '—' })

    render(<SubcontractEmailDialog target={{ ref: 'R-1', kind: 'assigned' }} onOpenChange={vi.fn()} />)

    expect(await screen.findByText('No email address on file for this partner — nothing to send.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
  })
})
