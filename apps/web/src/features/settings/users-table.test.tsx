import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UsersTable } from './users-table'
import { baseUser } from './test-fixtures'

afterEach(cleanup)

describe('UsersTable', () => {
  it('shows a placeholder row when there are no users', () => {
    render(<UsersTable users={[]} onEdit={vi.fn()} onDeactivate={vi.fn()} canManage />)
    expect(screen.getByText('No records to display.')).toBeInTheDocument()
  })

  it('renders a user row with its fields', () => {
    const user = baseUser({ email: 'jane.doe@cockpit.test', firstName: 'Jane', lastName: 'Doe', role: 'ADMIN' })
    render(<UsersTable users={[user]} onEdit={vi.fn()} onDeactivate={vi.fn()} canManage />)
    expect(screen.getByText('jane.doe@cockpit.test')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
    expect(screen.getByText('Doe')).toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('dims an inactive user and shows its deactivated date', () => {
    const inactive = baseUser({ active: false, deactivatedAt: '2026-02-01T00:00:00.000Z' })
    render(<UsersTable users={[inactive]} onEdit={vi.fn()} onDeactivate={vi.fn()} canManage />)
    expect(screen.getByRole('row', { name: /Doe/ })).toHaveClass('opacity-50')
    expect(screen.getByText(/Deactivated/)).toBeInTheDocument()
  })

  it('disables Edit and Deactivate once a user is inactive', () => {
    const inactive = baseUser({ active: false })
    render(<UsersTable users={[inactive]} onEdit={vi.fn()} onDeactivate={vi.fn()} canManage />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled()
  })

  it('disables Edit and Deactivate when the viewer lacks user:manage', () => {
    const active = baseUser({ active: true })
    render(<UsersTable users={[active]} onEdit={vi.fn()} onDeactivate={vi.fn()} canManage={false} />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled()
  })

  it('calls onEdit/onDeactivate with the clicked user', () => {
    const onEdit = vi.fn()
    const onDeactivate = vi.fn()
    const user = baseUser({ active: true })
    render(<UsersTable users={[user]} onEdit={onEdit} onDeactivate={onDeactivate} canManage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(user)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(onDeactivate).toHaveBeenCalledWith(user)
  })

  it('falls back to an em dash for a missing phone', () => {
    const user = baseUser({ phone: null })
    render(<UsersTable users={[user]} onEdit={vi.fn()} onDeactivate={vi.fn()} canManage />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
