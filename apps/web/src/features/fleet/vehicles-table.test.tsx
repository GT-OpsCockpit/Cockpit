import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { FleetUnavailabilityEntityType } from '@cockpit/shared/api'
import { VehiclesTable } from './vehicles-table'
import { baseVehicle } from './test-fixtures'

afterEach(cleanup)

const noop = { onEdit: vi.fn(), onUnavailability: vi.fn(), onToggleActive: vi.fn(), onNewBooking: vi.fn() }

describe('VehiclesTable', () => {
  it('shows a placeholder row in both groups when there are no vehicles', () => {
    render(<VehiclesTable vehicles={[]} canReactivate {...noop} />)
    expect(screen.getByText('No internal vehicles yet.')).toBeInTheDocument()
    expect(screen.getByText('No external vehicles yet.')).toBeInTheDocument()
  })

  it('splits a Local vehicle into Fleet - Internal and a non-Local one into Fleet - External', () => {
    const internal = baseVehicle({ ref: 'F1', isLocal: true })
    const external = baseVehicle({ ref: 'F2', isLocal: false, countryCode: 'FR', area: 'Paris', partnerCompany: 'Acme' })
    render(<VehiclesTable vehicles={[internal, external]} canReactivate {...noop} />)

    const internalGroup = screen.getByText('Fleet - Internal').closest('div')!
    const externalGroup = screen.getByText('Fleet - External').closest('div')!
    expect(within(internalGroup).getByText('F1')).toBeInTheDocument()
    expect(within(internalGroup).queryByText('F2')).not.toBeInTheDocument()
    expect(within(externalGroup).getByText('F2')).toBeInTheDocument()
    expect(within(externalGroup).queryByText('F1')).not.toBeInTheDocument()
  })

  it('only shows Country/Area/Partner columns on the External table', () => {
    const external = baseVehicle({ ref: 'F2', isLocal: false, countryCode: 'FR', area: 'Paris', partnerCompany: 'Acme' })
    render(<VehiclesTable vehicles={[external]} canReactivate {...noop} />)

    const externalGroup = screen.getByText('Fleet - External').closest('div')!
    expect(within(externalGroup).getByText('FR')).toBeInTheDocument()
    expect(within(externalGroup).getByText('Paris')).toBeInTheDocument()
    expect(within(externalGroup).getByText('Acme')).toBeInTheDocument()
  })

  it('only offers the Unavailability (wrench) action on the Internal table', () => {
    const internal = baseVehicle({ ref: 'F1', isLocal: true })
    const external = baseVehicle({ ref: 'F2', isLocal: false, countryCode: 'FR', area: 'Paris', partnerCompany: 'Acme' })
    render(<VehiclesTable vehicles={[internal, external]} canReactivate {...noop} />)

    const wrenchButtons = screen.getAllByTitle('Repair shop / Manufacturer service / Bodywork')
    expect(wrenchButtons).toHaveLength(1)
  })

  it('dims an inactive vehicle and offers Reactivate instead of Deactivate', () => {
    const inactive = baseVehicle({ ref: 'F1', active: false })
    render(<VehiclesTable vehicles={[inactive]} canReactivate {...noop} />)

    expect(screen.getByRole('row', { name: /F1/ })).toHaveClass('opacity-50')
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('disables the Reactivate action when the viewer lacks vehicle:reactivate', () => {
    const inactive = baseVehicle({ ref: 'F1', active: false })
    render(<VehiclesTable vehicles={[inactive]} canReactivate={false} {...noop} />)
    expect(screen.getByRole('button', { name: 'Reactivating requires the Admin role' })).toBeDisabled()
  })

  it('never disables Deactivate, regardless of vehicle:reactivate', () => {
    const active = baseVehicle({ ref: 'F1', active: true })
    render(<VehiclesTable vehicles={[active]} canReactivate={false} {...noop} />)
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeEnabled()
  })

  it('calls onEdit/onUnavailability/onToggleActive with the clicked vehicle', () => {
    const onEdit = vi.fn()
    const onUnavailability = vi.fn()
    const onToggleActive = vi.fn()
    const vehicle = baseVehicle({ ref: 'F1', isLocal: true, active: true })
    render(
      <VehiclesTable
        vehicles={[vehicle]}
        onEdit={onEdit}
        onUnavailability={onUnavailability}
        onToggleActive={onToggleActive}
        onNewBooking={noop.onNewBooking}
        canReactivate
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(vehicle)
    fireEvent.click(screen.getByTitle('Repair shop / Manufacturer service / Bodywork'))
    expect(onUnavailability).toHaveBeenCalledWith(vehicle)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(onToggleActive).toHaveBeenCalledWith(vehicle)
  })

  it('shows the unavailability label when set on an internal vehicle', () => {
    const vehicle = baseVehicle({
      ref: 'F1',
      isLocal: true,
      unavailability: {
        id: 'u1',
        fleetVehicleId: 'vehicle-1',
        type: FleetUnavailabilityEntityType.REPAIR,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-10T00:00:00.000Z',
      },
    })
    render(<VehiclesTable vehicles={[vehicle]} canReactivate {...noop} />)
    expect(screen.getByText('Repair shop — 01/06/2026 → 10/06/2026')).toBeInTheDocument()
  })

  it('shows the linked driver name on an External vehicle row', () => {
    const vehicle = baseVehicle({
      ref: 'F2',
      isLocal: false,
      countryCode: 'FR',
      area: 'Paris',
      partnerCompany: 'Acme',
      driver: {
        id: 'driver-1',
        ref: 'D-FR-PA-ACM-001',
        countryCode: 'FR',
        firstName: 'Bob',
        lastName: 'Partner',
        phone: '0611111111',
        company: 'Acme',
        email: 'bob@acme.test',
        area: 'Paris',
        eventsOnly: false,
        eventCountry: null,
        eventArea: null,
        eventClientId: null,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    render(<VehiclesTable vehicles={[vehicle]} canReactivate {...noop} />)
    expect(screen.getByText('Bob Partner')).toBeInTheDocument()
  })
})
