import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlanningList } from './planning-list'
import { baseTrip } from '../bookings/test-fixtures'

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }))

afterEach(cleanup)

const handlers = {
  onEdit: vi.fn(),
  onCancel: vi.fn(),
  onDispatch: vi.fn(),
  onNameboard: vi.fn(),
  onAdvance: vi.fn(),
}

// The legacy rendered Bookings and both Planning lists through one row builder
// (buildTripRowHtml, common.js:3098-3141), so a booking could be dispatched or
// cancelled from wherever it was being looked at. v2's Planning list had
// dropped the whole Action column, and Sub-C with it.
describe('PlanningList', () => {
  it('offers the same row actions as the Bookings list', () => {
    render(<PlanningList trips={[baseTrip()]} {...handlers} />)

    for (const action of ['Edit', 'Cancel']) {
      expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /nameboard/i })).toBeInTheDocument()
  })

  it('cancels the booking of the row the button belongs to', () => {
    const onCancel = vi.fn()
    const trip = baseTrip({ ref: 'R-CI1-26-9' })
    render(<PlanningList trips={[trip]} {...handlers} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledWith(trip)
  })

  // Clicking a row opens the edit dialog, so the action buttons must not also
  // trigger it — TripActionsCell stops the click from reaching the row.
  it('does not open the edit dialog when an action button is clicked', () => {
    const onEdit = vi.fn()
    const onCancel = vi.fn()
    render(<PlanningList trips={[baseTrip()]} {...handlers} onEdit={onEdit} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('marks a sub-contracted booking in its own column', () => {
    render(<PlanningList trips={[baseTrip({ subContractor: true })]} {...handlers} />)
    expect(screen.getByLabelText('Sub-contracted')).toBeInTheDocument()
  })
})
