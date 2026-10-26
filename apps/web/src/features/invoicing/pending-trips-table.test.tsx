import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PendingTripsTable } from './pending-trips-table'
import { baseTrip } from '../bookings/test-fixtures'

vi.mock('@/features/auth/use-permission', () => ({ usePermission: () => false }))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }))

afterEach(cleanup)

const handlers = {
  onEdit: vi.fn(),
  onCancel: vi.fn(),
  onDispatch: vi.fn(),
  onAdvance: vi.fn(),
}

describe('PendingTripsTable selection', () => {
  const trips = [baseTrip({ ref: 'R-1' }), baseTrip({ ref: 'R-2', id: 'trip-2' })]

  it('ticks the trips whose ref is selected, and only those', () => {
    render(
      <PendingTripsTable
        trips={trips}
        selectedRefs={new Set(['R-2'])}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        {...handlers}
      />,
    )

    expect(screen.getByRole('checkbox', { name: 'Select trip R-1' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select trip R-2' })).toBeChecked()
  })

  it('reports the trip toggled from its row', () => {
    const onToggle = vi.fn()
    render(
      <PendingTripsTable
        trips={trips}
        selectedRefs={new Set()}
        onToggle={onToggle}
        onToggleAll={vi.fn()}
        {...handlers}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select trip R-1' }))
    expect(onToggle).toHaveBeenCalledWith(trips[0])
  })

  it('selects every trip from the header, and unselects them once all are ticked', () => {
    const onToggleAll = vi.fn()
    const { rerender } = render(
      <PendingTripsTable
        trips={trips}
        selectedRefs={new Set()}
        onToggle={vi.fn()}
        onToggleAll={onToggleAll}
        {...handlers}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all trips' }))
    expect(onToggleAll).toHaveBeenLastCalledWith(true)

    rerender(
      <PendingTripsTable
        trips={trips}
        selectedRefs={new Set(['R-1', 'R-2'])}
        onToggle={vi.fn()}
        onToggleAll={onToggleAll}
        {...handlers}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all trips' }))
    expect(onToggleAll).toHaveBeenLastCalledWith(false)
  })
})
