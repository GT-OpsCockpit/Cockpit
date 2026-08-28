import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DriverUnavailabilityEntityType } from '@cockpit/shared/api'
import { DriversTable } from './drivers-table'
import { baseDriver } from './test-fixtures'

afterEach(cleanup)

const noop = { onEdit: vi.fn(), onUnavailability: vi.fn(), onToggleActive: vi.fn(), onUnlinkVehicle: vi.fn(), onNewBooking: vi.fn() }

describe('DriversTable', () => {
  it('shows a placeholder row in both groups when there are no drivers', () => {
    render(<DriversTable drivers={[]} canReactivate {...noop} />)
    expect(screen.getAllByText('No records to display.')).toHaveLength(2)
  })

  it('splits an internal driver into Chauffeurs and a company driver into Partenaires', () => {
    const chauffeur = baseDriver({ ref: 'D-FR-INT-001', company: null })
    const partner = baseDriver({ ref: 'D-US-LO-UBE-001', company: 'Uber', name: 'Uber Ops' })
    render(<DriversTable drivers={[chauffeur, partner]} canReactivate {...noop} />)

    const chauffeursGroup = screen.getByText('Chauffeurs').closest('div')!
    const partnersGroup = screen.getByText('Partenaires').closest('div')!
    expect(within(chauffeursGroup).getByText('D-FR-INT-001')).toBeInTheDocument()
    expect(within(chauffeursGroup).queryByText('D-US-LO-UBE-001')).not.toBeInTheDocument()
    expect(within(partnersGroup).getByText('D-US-LO-UBE-001')).toBeInTheDocument()
    expect(within(partnersGroup).queryByText('D-FR-INT-001')).not.toBeInTheDocument()
  })

  it('renders the company next to the name only for a partner', () => {
    const partner = baseDriver({ ref: 'D-US-LO-UBE-001', company: 'Uber' })
    render(<DriversTable drivers={[partner]} canReactivate {...noop} />)
    expect(screen.getByText('(Uber)')).toBeInTheDocument()
  })

  it('dims an inactive driver and offers Reactivate instead of Deactivate', () => {
    const inactive = baseDriver({ ref: 'D-FR-INT-001', active: false })
    render(<DriversTable drivers={[inactive]} canReactivate {...noop} />)

    expect(screen.getByRole('row', { name: /D-FR-INT-001/ })).toHaveClass('opacity-50')
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('disables the Reactivate action when the viewer lacks driver:reactivate', () => {
    const inactive = baseDriver({ ref: 'D-FR-INT-001', active: false })
    render(<DriversTable drivers={[inactive]} canReactivate={false} {...noop} />)
    expect(screen.getByRole('button', { name: 'Reactivating requires the Admin role' })).toBeDisabled()
  })

  it('never disables Deactivate, regardless of driver:reactivate', () => {
    const active = baseDriver({ ref: 'D-FR-INT-001', active: true })
    render(<DriversTable drivers={[active]} canReactivate={false} {...noop} />)
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeEnabled()
  })

  it('calls onEdit/onUnavailability/onToggleActive with the clicked driver', () => {
    const onEdit = vi.fn()
    const onUnavailability = vi.fn()
    const onToggleActive = vi.fn()
    const driver = baseDriver({ ref: 'D-FR-INT-001', active: true })
    render(
      <DriversTable
        drivers={[driver]}
        onEdit={onEdit}
        onUnavailability={onUnavailability}
        onToggleActive={onToggleActive}
        onUnlinkVehicle={noop.onUnlinkVehicle}
        onNewBooking={noop.onNewBooking}
        canReactivate
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(driver)
    fireEvent.click(screen.getByRole('button', { name: 'Unavailability' }))
    expect(onUnavailability).toHaveBeenCalledWith(driver)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(onToggleActive).toHaveBeenCalledWith(driver)
  })

  it('shows no padlock when a driver has no reserved vehicle', () => {
    const driver = baseDriver({ ref: 'D-US-LO-UBE-001', company: 'Uber' })
    render(<DriversTable drivers={[driver]} canReactivate {...noop} />)
    expect(screen.queryByRole('button', { name: 'Unlink this vehicle from the chauffeur' })).not.toBeInTheDocument()
  })

  it('shows the reserved vehicle reg nbr and calls onUnlinkVehicle from its padlock', () => {
    const onUnlinkVehicle = vi.fn()
    const driver = baseDriver({
      ref: 'D-US-LO-UBE-001',
      company: 'Uber',
      fleetReserved: {
        id: 'vehicle-1',
        ref: 'F1',
        categoryId: 'type-1',
        regNbr: 'AB-123-CD',
        make: 'Mercedes-Benz',
        model: 'E-Class',
        yearOfBuild: 2025,
        fourWD: false,
        nbPax: 3,
        color: 'Metallic Black',
        acronym: null,
        isLocal: false,
        countryCode: null,
        area: null,
        partnerCompany: 'Uber',
        driverId: 'driver-1',
        eventsOnly: false,
        eventCountry: null,
        eventArea: null,
        eventClientId: null,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    render(<DriversTable drivers={[driver]} canReactivate onEdit={noop.onEdit} onUnavailability={noop.onUnavailability} onToggleActive={noop.onToggleActive} onUnlinkVehicle={onUnlinkVehicle} onNewBooking={noop.onNewBooking} />)

    expect(screen.getByText('AB-123-CD')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Unlink this vehicle from the chauffeur' }))
    expect(onUnlinkVehicle).toHaveBeenCalledWith(driver)
  })

  it('shows the unavailability label when set, an em dash otherwise', () => {
    const off = baseDriver({
      ref: 'D-FR-INT-001',
      unavailability: { id: 'u1', driverId: 'driver-1', type: DriverUnavailabilityEntityType.OFF, date: '2026-06-01T00:00:00.000Z', startDate: null, endDate: null },
    })
    const { rerender } = render(<DriversTable drivers={[off]} canReactivate {...noop} />)
    expect(screen.getByText('Off 01/06/2026')).toBeInTheDocument()

    const none = baseDriver({ ref: 'D-FR-INT-002' })
    rerender(<DriversTable drivers={[none]} canReactivate {...noop} />)
    expect(screen.queryByText(/Off /)).not.toBeInTheDocument()
  })

  it('falls back to an em dash for a missing phone or email', () => {
    const driver = baseDriver({ ref: 'D-FR-INT-001', phone: null, email: null })
    render(<DriversTable drivers={[driver]} canReactivate {...noop} />)

    const row = screen.getByRole('row', { name: /D-FR-INT-001/ })
    expect(row.textContent?.match(/—/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
