import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DriverUnavailabilityEntityType } from '@cockpit/shared/api'

// The Country column renders <CountryLabel>, which reads the country catalogue
// off /meta to spell the code out. Stub just that hook (the rest of the module
// is kept) so the table stays renderable without a QueryClientProvider.
vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  useMetaControllerGetMeta: () => ({ data: { countries: [{ code: 'FR', name: 'France' }] } }),
}))

const { DriversTable } = await import('./drivers-table')
const { baseDriver } = await import('./test-fixtures')

afterEach(cleanup)

const noop = { onEdit: vi.fn(), onUnavailability: vi.fn(), onToggleActive: vi.fn(), onUnlinkVehicle: vi.fn(), onNewBooking: vi.fn() }

describe('DriversTable', () => {
  it('shows a placeholder row in both groups when there are no drivers', () => {
    render(<DriversTable drivers={[]} canReactivate {...noop} />)
    expect(screen.getAllByText('No records to display')).toHaveLength(2)
  })

  it('shows a filtered-empty state with a working reset action when filters are active', () => {
    const onResetFilters = vi.fn()
    render(<DriversTable drivers={[]} canReactivate {...noop} hasActiveFilters onResetFilters={onResetFilters} />)

    const resetButtons = screen.getAllByRole('button', { name: 'Reset filters' })
    expect(resetButtons).toHaveLength(2)
    expect(screen.queryByText('No records to display')).not.toBeInTheDocument()

    fireEvent.click(resetButtons[0])
    expect(onResetFilters).toHaveBeenCalledOnce()
  })

  it('splits an internal driver into Drivers and a company driver into Partners', () => {
    const chauffeur = baseDriver({ ref: 'D-FR-INT-001', company: null })
    const partner = baseDriver({ ref: 'D-US-LO-UBE-001', company: 'Uber', name: 'Uber Ops' })
    render(<DriversTable drivers={[chauffeur, partner]} canReactivate {...noop} />)

    const chauffeursGroup = screen.getByText('Drivers').closest('div')!
    const partnersGroup = screen.getByText('Partners').closest('div')!
    expect(within(chauffeursGroup).getByText('D-FR-INT-001')).toBeInTheDocument()
    expect(within(chauffeursGroup).queryByText('D-US-LO-UBE-001')).not.toBeInTheDocument()
    expect(within(partnersGroup).getByText('D-US-LO-UBE-001')).toBeInTheDocument()
    expect(within(partnersGroup).queryByText('D-FR-INT-001')).not.toBeInTheDocument()
  })

  // The row is greyed and badged for all three reasons the legacy greyed it
  // for, not just the manual flag (isEffectivelyActive, common.js:3010): a
  // driver on holiday and one resting outside their event's dates both read
  // exactly like an available driver otherwise.
  describe('why a row is unavailable today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

    it('names a manual deactivation', () => {
      render(<DriversTable drivers={[baseDriver({ active: false })]} canReactivate {...noop} />)
      expect(screen.getByText('Deactivated')).toBeInTheDocument()
    })

    it('names an unavailability that covers today', () => {
      const driver = baseDriver({
        unavailability: { id: 'u1', driverId: 'driver-1', type: DriverUnavailabilityEntityType.OFF, date: today, startDate: null, endDate: null },
      })
      render(<DriversTable drivers={[driver]} canReactivate {...noop} />)
      expect(screen.getAllByText(/^Day off — /)).not.toHaveLength(0)
    })

    it('says nothing when the unavailability on file does not cover today', () => {
      const driver = baseDriver({
        unavailability: { id: 'u1', driverId: 'driver-1', type: DriverUnavailabilityEntityType.OFF, date: inDays(30), startDate: null, endDate: null },
      })
      render(<DriversTable drivers={[driver]} canReactivate {...noop} />)
      expect(screen.queryByText('Deactivated')).not.toBeInTheDocument()
      expect(screen.queryByText('Outside event dates')).not.toBeInTheDocument()
    })

    it('names an Events driver resting outside its event dates', () => {
      const driver = baseDriver({
        eventsOnly: true,
        eventClient: { ...baseDriver().eventClient, eventStartDate: inDays(10), eventEndDate: inDays(20) } as never,
      })
      render(<DriversTable drivers={[driver]} canReactivate {...noop} />)
      expect(screen.getByText('Outside event dates')).toBeInTheDocument()
    })
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
    expect(screen.getByText('Day off — 01/06/2026')).toBeInTheDocument()

    const none = baseDriver({ ref: 'D-FR-INT-002' })
    rerender(<DriversTable drivers={[none]} canReactivate {...noop} />)
    expect(screen.queryByText(/Day off /)).not.toBeInTheDocument()
  })

  it('falls back to an em dash for a missing phone or email', () => {
    const driver = baseDriver({ ref: 'D-FR-INT-001', phone: null, email: null })
    render(<DriversTable drivers={[driver]} canReactivate {...noop} />)

    const row = screen.getByRole('row', { name: /D-FR-INT-001/ })
    expect(row.textContent?.match(/—/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

// The legacy's Drivers & Partners lists both carried Country as a column
// (common.js:3531). Without it, a partner's country only showed through their
// ref prefix — and an in-house chauffeur's ref is always D-FR-INT, so it
// showed nowhere at all.
describe('DriversTable — Country', () => {
  const firstRow = () => within(screen.getAllByRole('table')[0]).getAllByRole('row')[1]
  // Ref | Country | Name | Phone | Email | Area | Unavailability | Action
  const cell = (index: number) => within(firstRow()).getAllByRole('cell')[index]

  it('spells the country out, the same way the Fleet list does', () => {
    render(<DriversTable drivers={[baseDriver({ countryCode: 'FR' })]} canReactivate {...noop} />)
    expect(cell(1)).toHaveTextContent('France (FR)')
  })

  it('says "—" in the Country cell itself for a driver with no country on file', () => {
    render(<DriversTable drivers={[baseDriver({ countryCode: null })]} canReactivate {...noop} />)
    expect(cell(1)).toHaveTextContent('—')
  })
})
