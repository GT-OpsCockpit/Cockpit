import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ClientsTable } from './clients-table'
import { baseClient } from './test-fixtures'

afterEach(cleanup)

describe('ClientsTable', () => {
  it('shows a placeholder row when there are no accounts', () => {
    render(<ClientsTable clients={[]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)
    expect(screen.getByText('No accounts to display')).toBeInTheDocument()
  })

  it('shows a filtered-empty state with a working reset action when filters are active', () => {
    const onResetFilters = vi.fn()
    render(
      <ClientsTable
        clients={[]}
        onEdit={vi.fn()}
        onToggleActive={vi.fn()}
        onNewBooking={vi.fn()}
        hasActiveFilters
        onResetFilters={onResetFilters}
      />,
    )

    expect(screen.queryByText('No accounts to display')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(onResetFilters).toHaveBeenCalledOnce()
  })

  it('renders the acronym next to the name only when set', () => {
    const withAcronym = baseClient({ ref: 'CC1', name: 'Atlas Capital', acronym: 'ATL' })
    const { rerender } = render(<ClientsTable clients={[withAcronym]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)
    expect(screen.getByText('(ATL)')).toBeInTheDocument()

    const withoutAcronym = baseClient({ ref: 'CI1', name: 'Marc Dubois', acronym: null })
    rerender(<ClientsTable clients={[withoutAcronym]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)
    expect(screen.queryByText('(ATL)')).not.toBeInTheDocument()
  })

  it('dims an inactive account and offers Reactivate instead of Deactivate', () => {
    const inactive = baseClient({ ref: 'CI1', active: false })
    render(<ClientsTable clients={[inactive]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    expect(screen.getByRole('row', { name: /CI1/ })).toHaveClass('opacity-50')
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('does not dim an active account and offers Deactivate instead of Reactivate', () => {
    const active = baseClient({ ref: 'CI1', active: true })
    render(<ClientsTable clients={[active]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    expect(screen.getByRole('row', { name: /CI1/ })).not.toHaveClass('opacity-50')
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('calls onEdit with the clicked client', () => {
    const onEdit = vi.fn()
    const client = baseClient({ ref: 'CI1' })
    render(<ClientsTable clients={[client]} onEdit={onEdit} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(client)
  })

  it('calls onToggleActive with the clicked client', () => {
    const onToggleActive = vi.fn()
    const client = baseClient({ ref: 'CI1', active: true })
    render(<ClientsTable clients={[client]} onEdit={vi.fn()} onToggleActive={onToggleActive} onNewBooking={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(onToggleActive).toHaveBeenCalledWith(client)
  })

  it('falls back to an em dash for a missing email, POC phone or billing', () => {
    const client = baseClient({ ref: 'CI1', email: null, pocPhone: null, billing: null })
    render(<ClientsTable clients={[client]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    const row = screen.getByRole('row', { name: /CI1/ })
    expect(row.textContent?.match(/—/g)).toHaveLength(3)
  })
})
