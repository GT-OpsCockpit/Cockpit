import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TripStepEntityStep } from '@cockpit/shared/api'
import { StatusBadge } from './status-badge'
import { baseTrip, step } from './test-fixtures'

let canComplete = false
vi.mock('@/features/auth/use-permission', () => ({ usePermission: () => canComplete }))

afterEach(() => {
  cleanup()
  canComplete = false
})

describe('StatusBadge', () => {
  it('shows "Send ?" and is not clickable when no step has been recorded yet', () => {
    const onAdvance = vi.fn()
    render(<StatusBadge trip={baseTrip()} onAdvance={onAdvance} />)

    expect(screen.getByText('Send ?')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows "Stop" and is not clickable once the assignment is cancelled, even mid-way through steps', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ assignmentCancelled: true, steps: [step(TripStepEntityStep.ENROUTE)] })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    expect(screen.getByText('Stop')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a highlighted step as a clickable badge and calls onAdvance when clicked', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ steps: [step(TripStepEntityStep.TRANSMITTED)] })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    const badge = screen.getByRole('button', { name: 'Sent' })
    fireEvent.click(badge)
    expect(onAdvance).toHaveBeenCalledWith(trip)
  })

  it('renders a plain (non-highlighted) step as clickable text too', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ steps: [step(TripStepEntityStep.ENROUTE)] })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    const badge = screen.getByRole('button', { name: 'OTW' })
    fireEvent.click(badge)
    expect(onAdvance).toHaveBeenCalledWith(trip)
  })

  it('does not render a button — and a click does nothing — once DROPPED (nothing left to advance to)', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({ steps: Object.values(TripStepEntityStep).map((s) => step(s)) })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    const badge = screen.getByText('Done')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    fireEvent.click(badge)
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('is clickable on a Sent sub-contracted trip, even one given to a partner company', () => {
    const onAdvance = vi.fn()
    const trip = baseTrip({
      subContractor: true,
      partnerId: null,
      steps: [step(TripStepEntityStep.TRANSMITTED)],
    })
    render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sent' }))
    expect(onAdvance).toHaveBeenCalledWith(trip)
  })

  it('is clickable on "Send ?" and "Updated - Send ?" of a sub-contracted trip', () => {
    const noStatus = baseTrip({ subContractor: true })
    const { unmount } = render(<StatusBadge trip={noStatus} onAdvance={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Send ?' })).toBeInTheDocument()
    unmount()

    render(<StatusBadge trip={baseTrip({ subContractor: true, partnerUpdatePending: true })} onAdvance={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Updated - Send ?' })).toBeInTheDocument()
  })

  it('stays locked on a Confirmed trip given to a partner company, unless the user can end it', () => {
    const trip = baseTrip({
      subContractor: true,
      partnerId: null,
      steps: [step(TripStepEntityStep.TRANSMITTED), step(TripStepEntityStep.ACCEPTED)],
    })
    render(<StatusBadge trip={trip} onAdvance={vi.fn()} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is not clickable when no onAdvance callback is given at all, even if otherwise advanceable', () => {
    const trip = baseTrip({ steps: [step(TripStepEntityStep.ENROUTE)] })
    render(<StatusBadge trip={trip} />)

    expect(screen.getByText('OTW')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  describe('ending a sub-contracted trip by hand', () => {
    const confirmedByPartnerCompany = () =>
      baseTrip({
        subContractor: true,
        partnerId: null,
        steps: [step(TripStepEntityStep.TRANSMITTED), step(TripStepEntityStep.ACCEPTED)],
      })

    it('lets an admin click a Confirmed sub-contracted trip, even one given to a partner company', () => {
      canComplete = true
      const onAdvance = vi.fn()
      const trip = confirmedByPartnerCompany()
      render(<StatusBadge trip={trip} onAdvance={onAdvance} />)

      fireEvent.click(screen.getByRole('button', { name: 'Confirmed' }))
      expect(onAdvance).toHaveBeenCalledWith(trip)
    })

    it('keeps it locked for anyone without the permission', () => {
      render(<StatusBadge trip={confirmedByPartnerCompany()} onAdvance={vi.fn()} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
