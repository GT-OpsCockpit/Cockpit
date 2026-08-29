import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TripEntityCancellationFee } from '@cockpit/shared/api'
import { baseTrip } from './test-fixtures'

const mutateAsync = vi.fn(async () => ({ deleted: false }))

vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  useTripsControllerCancelAssignment: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/features/auth/use-permission', () => ({ usePermission: () => true }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { BookingCancelDialog } = await import('./booking-cancel-dialog')

afterEach(() => {
  cleanup()
  mutateAsync.mockClear()
})

describe('BookingCancelDialog', () => {
  // The legacy filled the popup from the booking itself (common.js:2483,
  // `cancellationFee: trip.cancellationFee || 'Free'`). Opening an
  // already-cancelled booking on "Free" is not a cosmetic default: confirming
  // it sends FREE, and the server deletes the row and releases its ref
  // (TripsService.cancelAssignment) — a booking cancelled at 50% is destroyed
  // by a second look at it.
  it('opens on the fee the booking was already cancelled with', () => {
    render(
      <BookingCancelDialog
        trip={baseTrip({ cancellationFee: TripEntityCancellationFee.FIFTY, assignmentCancelled: true })}
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByLabelText('Cancellation fee')).toHaveTextContent('50%')
  })

  it('opens on Free for a booking that was never cancelled', () => {
    render(<BookingCancelDialog trip={baseTrip({ cancellationFee: null })} onOpenChange={() => {}} />)

    expect(screen.getByLabelText('Cancellation fee')).toHaveTextContent('Free')
  })
})
