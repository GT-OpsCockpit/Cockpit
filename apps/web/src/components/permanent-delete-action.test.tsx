import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const hasPermission = vi.fn(() => true)
vi.mock('@/features/auth/use-permission', () => ({ usePermission: () => hasPermission() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: vi.fn() } }))

const { PermanentDeleteAction } = await import('./permanent-delete-action')

afterEach(() => {
  cleanup()
  hasPermission.mockReturnValue(true)
})

const props = {
  label: 'account CI1',
  description: 'Atlas Capital will be removed for good.',
  invalidateKey: ['clients'],
}

describe('PermanentDeleteAction', () => {
  // The legacy put this behind the Manager password (onPermanentDelete,
  // common.js:385-395); v2 replaced that password with record:delete.
  it('is absent entirely without the record:delete permission', () => {
    hasPermission.mockReturnValue(false)
    render(<PermanentDeleteAction {...props} onDelete={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Delete permanently/ })).not.toBeInTheDocument()
  })

  it('asks before deleting, and does nothing until confirmed', () => {
    const onDelete = vi.fn()
    render(<PermanentDeleteAction {...props} onDelete={onDelete} onDeleted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Delete permanently/ }))
    expect(screen.getByText('Delete account CI1 for good?')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes and closes the form once confirmed', async () => {
    const onDelete = vi.fn(async () => undefined)
    const onDeleted = vi.fn()
    render(<PermanentDeleteAction {...props} onDelete={onDelete} onDeleted={onDeleted} />)

    fireEvent.click(screen.getByRole('button', { name: /Delete permanently/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce())
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
  })

  // The API refuses the delete outright when a booking or invoice still points
  // at the record — the record has to survive that refusal.
  it('keeps the record when the API refuses the delete', async () => {
    const onDeleted = vi.fn()
    render(
      <PermanentDeleteAction
        {...props}
        onDelete={() => Promise.reject(new Error('still referenced'))}
        onDeleted={onDeleted}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Delete permanently/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
