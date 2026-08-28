import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import { EmptyState } from './empty-state'

afterEach(cleanup)

describe('EmptyState', () => {
  it('shows the genuinely-empty title/description and no reset button by default', () => {
    render(<EmptyState icon={Inbox} title="No bookings to display" description="Bookings created will appear here." />)
    expect(screen.getByText('No bookings to display')).toBeInTheDocument()
    expect(screen.getByText('Bookings created will appear here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument()
  })

  it('switches to the filtered-to-zero variant, with a reset button, once hasActiveFilters is true', () => {
    const onResetFilters = vi.fn()
    render(
      <EmptyState
        icon={Inbox}
        title="No bookings to display"
        description="Bookings created will appear here."
        hasActiveFilters
        onResetFilters={onResetFilters}
      />,
    )

    expect(screen.queryByText('No bookings to display')).not.toBeInTheDocument()
    expect(screen.getByText('No results for these filters')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(onResetFilters).toHaveBeenCalledOnce()
  })

  it('omits the reset button when filtered-to-zero but no onResetFilters is given', () => {
    render(<EmptyState icon={Inbox} title="No bookings to display" description="Bookings created will appear here." hasActiveFilters />)
    expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument()
  })
})
