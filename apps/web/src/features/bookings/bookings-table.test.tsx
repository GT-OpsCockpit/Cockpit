import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { toast } from 'sonner'
import { DispatchButton } from './trip-actions-cell'
import { baseTrip } from './test-fixtures'

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.mocked(toast.warning).mockClear()
})

// Regression coverage for the "driver/véhicule manquant" fix (session 8, item #7
// of the Bookings handoffs) — the legacy opened a per-field quick-popup here;
// v2 instead warns and routes to the full edit dialog rather than letting the
// click through to a dispatch-driver call the server would reject with a 400.
describe('DispatchButton', () => {
  it('warns and routes to Edit instead of dispatching, when a Local job is missing its driver/vehicle', () => {
    const onDispatch = vi.fn()
    const onEdit = vi.fn()
    const trip = baseTrip({ driverId: null, fleetVehicleId: null })
    render(<DispatchButton trip={trip} isLocal onDispatch={onDispatch} onEdit={onEdit} />)

    fireEvent.click(screen.getByRole('button'))

    expect(toast.warning).toHaveBeenCalledWith('Assign a driver and a vehicle before sending to the driver')
    expect(onEdit).toHaveBeenCalledWith(trip)
    expect(onDispatch).not.toHaveBeenCalled()
  })

  it('dispatches directly once both driver and vehicle are assigned', () => {
    const onDispatch = vi.fn()
    const onEdit = vi.fn()
    const trip = baseTrip({ driverId: 'driver-1', fleetVehicleId: 'vehicle-1', dispatched: false })
    render(<DispatchButton trip={trip} isLocal onDispatch={onDispatch} onEdit={onEdit} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onDispatch).toHaveBeenCalledWith(trip)
    expect(onEdit).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('never warns/reroutes for a Farm-out or sub-contracted job, even with no driver/vehicle assigned', () => {
    const onDispatch = vi.fn()
    const onEdit = vi.fn()
    const trip = baseTrip({ driverId: null, fleetVehicleId: null })
    render(<DispatchButton trip={trip} isLocal={false} onDispatch={onDispatch} onEdit={onEdit} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onDispatch).toHaveBeenCalledWith(trip)
    expect(onEdit).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('is disabled — and does nothing on click — once already dispatched', () => {
    const onDispatch = vi.fn()
    const onEdit = vi.fn()
    const trip = baseTrip({ driverId: 'driver-1', fleetVehicleId: 'vehicle-1', dispatched: true })
    render(<DispatchButton trip={trip} isLocal onDispatch={onDispatch} onEdit={onEdit} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onDispatch).not.toHaveBeenCalled()
    expect(onEdit).not.toHaveBeenCalled()
  })
})
