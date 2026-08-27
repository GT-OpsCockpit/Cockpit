import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TripStepEntityStep } from '@cockpit/shared/api'
import { StatusBadge } from './status-badge'
import { baseTrip, step } from './test-fixtures'

afterEach(cleanup)

describe('StatusBadge', () => {
  it('shows "Send ?" and is not clickable when no step has been recorded yet', () => {
    const onAdvance = vi.fn()
    render(<StatusBadge trip={baseTrip()} onAdvance={onAdvance} />)

    expect(screen.getByText('📤 Send ?')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows "Stop" and is not clickable once the assignment is cancelled, even mid-way through steps', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ assignmentCancelled: true, steps: [step(TripStepEntityStep.ENROUTE)] })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    expect(screen.getByText('🛑 Stop')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a highlighted step as a clickable badge and calls onAdvance when clicked', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ steps: [step(TripStepEntityStep.TRANSMITTED)] })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    const badge = screen.getByRole('button', { name: '📤 Sent ✅' })
    fireEvent.click(badge)
    expect(onAdvance).toHaveBeenCalledWith(trip)
  })

  it('renders a plain (non-highlighted) step as clickable text too', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ steps: [step(TripStepEntityStep.ENROUTE)] })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    const badge = screen.getByRole('button', { name: '🛣️ OTW' })
    fireEvent.click(badge)
    expect(onAdvance).toHaveBeenCalledWith(trip)
  })

  it('does not render a button — and a click does nothing — once DROPPED (nothing left to advance to)', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ steps: Object.values(TripStepEntityStep).map((s) => step(s)) })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    const badge = screen.getByText('✅ Done')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    fireEvent.click(badge)
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('is not clickable while locked behind an unassigned sub-contractor, even mid-way through steps', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({
      subContractor: true,
      partnerId: null,
      steps: [step(TripStepEntityStep.TRANSMITTED)],
    })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    const badge = screen.getByText('📤 Sent ✅')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    fireEvent.click(badge)
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('is not clickable when no onAdvance callback is given at all, even if otherwise advanceable', () => {
    const trip = baseTrip({ steps: [step(TripStepEntityStep.ENROUTE)] })
    render(<StatusBadge trip={trip} />)

    expect(screen.getByText('🛣️ OTW')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
